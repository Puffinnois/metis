import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDatabase, type Db } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { getLeagueSetting } from '@main/db/repos/settings'
import type { StatsClient } from '@main/stats/client'
import { createLeagueControl, type LeagueControl } from '@main/stats/leagueControl'
import { DOWNLOAD_KEY, leagueDownloads, setLeagueDownloads } from '@main/stats/leagueDownloads'
import type { LeagueId } from '@shared/leagues'
import type { LeagueDownload, LeagueDownloads } from '@shared/stats/types'

let dir: string | null = null
// Windows refuses to delete a database file that is still open, so each one opened is closed first.
const opened: Db[] = []
function open(path: string): Db {
  const db = openDatabase(path)
  opened.push(db)
  return db
}
afterEach(() => {
  for (const db of opened.splice(0)) {
    try {
      db.close()
    } catch {
      // The test closed it already.
    }
  }
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = null
})

/** A profile: a data folder with `metis.db` migrated, and the stats files named. */
function profile(files: string[] = []): { db: Db; dataDir: string } {
  dir = mkdtempSync(join(tmpdir(), 'metis-leagues-'))
  const db = open(join(dir, 'metis.db'))
  migrate(db)
  for (const f of files) writeFileSync(join(dir, f), 'x'.repeat(1000))
  return { db, dataDir: dir }
}

const free = (): number => 50 * 1024 ** 3
const byLeague = (d: LeagueDownloads): Record<string, LeagueDownload> =>
  Object.fromEntries(d.leagues.map((l) => [l.league, l]))

describe('leagueDownloads', () => {
  it('asks on a clean profile, before anything is downloaded', () => {
    const { db, dataDir } = profile()
    const d = leagueDownloads(db, dataDir, free)
    expect(d.decided).toBe(false)
    expect(d.leagues.map((l) => [l.league, l.on, l.hasData])).toEqual([
      ['nba', false, false],
      ['wnba', false, false]
    ])
    expect(d.freeBytes).toBe(50 * 1024 ** 3)
    // Each league's first load needs its own measured room.
    expect(byLeague(d).nba.roomNeeded).toBe(6 * 1024 ** 3)
    expect(byLeague(d).wnba.roomNeeded).toBeLessThan(byLeague(d).nba.roomNeeded)
    expect(getLeagueSetting(db, 'nba', DOWNLOAD_KEY)).toBeNull()
  })

  it('keeps the NBA on and the WNBA off on an existing profile, and writes it down', () => {
    const { db, dataDir } = profile(['stats-nba.duckdb'])
    const d = leagueDownloads(db, dataDir, free)
    expect(d.decided).toBe(true)
    expect(byLeague(d).nba).toMatchObject({
      on: true,
      hasFile: true,
      hasData: true,
      fileBytes: 1000
    })
    expect(byLeague(d).wnba).toMatchObject({ on: false, hasFile: false, hasData: false })
    expect(getLeagueSetting(db, 'nba', DOWNLOAD_KEY)).toBe('on')
    expect(getLeagueSetting(db, 'wnba', DOWNLOAD_KEY)).toBe('off')
  })

  it('counts a profile from before files were per league as the NBA’s', () => {
    const { db, dataDir } = profile(['stats.duckdb'])
    expect(byLeague(leagueDownloads(db, dataDir, free)).nba.on).toBe(true)
  })

  it('keeps the user’s choice once made, whatever files are there', () => {
    const { db, dataDir } = profile(['stats-nba.duckdb'])
    setLeagueDownloads(db, { nba: false, wnba: true })
    const d = byLeague(leagueDownloads(db, dataDir, free))
    // Off with a file: still something to read, until it is deleted.
    expect(d.nba).toMatchObject({ on: false, hasFile: true, hasData: true })
    expect(d.wnba).toMatchObject({ on: true, hasFile: false, hasData: true })
  })

  it('treats a first-run answer of neither league as decided', () => {
    const { db, dataDir } = profile()
    setLeagueDownloads(db, { nba: false, wnba: false })
    expect(leagueDownloads(db, dataDir, free).decided).toBe(true)
  })
})

/** A worker that records what it was asked. */
function fakeClient(league: LeagueId, calls: string[]): StatsClient {
  return {
    refresh: vi.fn(async () => {
      calls.push(`refresh ${league}`)
      return { steps: [] }
    }),
    close: vi.fn(async () => {
      calls.push(`close ${league}`)
    })
  } as unknown as StatsClient
}

function control(
  files: string[] = [],
  failing: LeagueId[] = []
): {
  leagues: LeagueControl
  calls: string[]
  changed: LeagueId[]
  db: Db
  dataDir: string
} {
  const { db, dataDir } = profile(files)
  const calls: string[] = []
  const changed: LeagueId[] = []
  const leagues = createLeagueControl({
    db,
    dataDir,
    start: (league) => {
      if (failing.includes(league)) throw new Error('no worker')
      calls.push(`start ${league}`)
      return fakeClient(league, calls)
    },
    onChanged: (league) => changed.push(league),
    free,
    log: () => {}
  })
  return { leagues, calls, changed, db, dataDir }
}

describe('the league control', () => {
  it('starts nothing on a clean profile until the first run is answered', async () => {
    const { leagues, calls } = control()
    leagues.open()
    expect(calls).toEqual([])
    expect(leagues.client('nba')).toBeNull()
    expect((await leagues.reads('wnba').status()).noData).toMatch(/WNBA/)
    await leagues.setDownloads({ nba: true, wnba: true })
    expect(calls).toEqual(['start nba', 'refresh nba', 'start wnba', 'refresh wnba'])
  })

  it('opens an existing profile’s NBA and downloads nothing for the WNBA', () => {
    const { leagues, calls } = control(['stats-nba.duckdb'])
    leagues.open()
    expect(calls).toEqual(['start nba', 'refresh nba'])
    leagues.refreshAll()
    expect(calls.filter((c) => c.includes('wnba'))).toEqual([])
  })

  it('turns a league off: its refresh stops, and its file stays readable', async () => {
    const { leagues, calls, changed } = control(['stats-nba.duckdb'])
    leagues.open()
    calls.length = 0
    await leagues.setDownloads({ wnba: true })
    expect(calls).toEqual(['start wnba', 'refresh wnba'])
    // The WNBA's first load writes its file.
    writeFileSync(join(dir!, 'stats-wnba.duckdb'), 'x')
    calls.length = 0
    await leagues.setDownloads({ wnba: false })
    // Closed, which interrupts a running refresh, then opened again to read.
    expect(calls).toEqual(['close wnba', 'start wnba'])
    leagues.refreshAll()
    expect(calls).toEqual(['close wnba', 'start wnba', 'refresh nba'])
    // Told once for each change, besides each refresh's own notice when it ends.
    expect(changed.filter((l) => l === 'wnba').length).toBeGreaterThanOrEqual(2)
  })

  it('deletes a league’s file only once it is off', async () => {
    const { leagues, dataDir, calls } = control(['stats-nba.duckdb', 'stats-wnba.duckdb'])
    leagues.open()
    await expect(leagues.deleteFile('wnba')).rejects.toThrow('Turn the WNBA off first.')
    await leagues.setDownloads({ wnba: false })
    const after = await leagues.deleteFile('wnba')
    expect(existsSync(join(dataDir, 'stats-wnba.duckdb'))).toBe(false)
    expect(existsSync(join(dataDir, 'stats-nba.duckdb'))).toBe(true)
    expect(after.leagues.find((l) => l.league === 'wnba')).toMatchObject({
      on: false,
      hasFile: false,
      hasData: false
    })
    expect(leagues.client('wnba')).toBeNull()
    expect(calls.at(-1)).toBe('close wnba')
  })

  it('says the stats are off for a league whose worker did not start', async () => {
    const { leagues } = control(['stats-nba.duckdb'], ['nba'])
    leagues.open()
    const status = await leagues.reads('nba').status()
    expect(status.available).toBe(false)
    expect(status.noData).toBeUndefined()
  })
})
