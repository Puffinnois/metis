import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDatabase, type Db } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { getLeagueSetting } from '@main/db/repos/settings'
import type { StatsClient } from '@main/stats/client'
import { createLeagueControl, type LeagueControl } from '@main/stats/leagueControl'
import type { LinksClient } from '@main/stats/links/protocol'
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
      ['wnba', false, false],
      ['ncaam', false, false],
      ['ncaaw', false, false]
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
    status: vi.fn(async () => ({ available: true, builtAt: 'b', paused: false, noRoom: null })),
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

// A worker opens a tick after it is asked for (`workerPool.ts`).
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('the league control', () => {
  it('starts nothing on a clean profile until the first run is answered', async () => {
    const { leagues, calls } = control()
    leagues.open()
    await flush()
    expect(calls).toEqual([])
    expect(leagues.client('nba')).toBeNull()
    expect((await leagues.reads('wnba').status()).noData).toMatch(/WNBA/)
    await leagues.setDownloads({ nba: true, wnba: true })
    await flush()
    expect(calls).toEqual(['start nba', 'start wnba', 'refresh nba', 'refresh wnba'])
  })

  it('opens an existing profile’s NBA and downloads nothing for the WNBA', async () => {
    const { leagues, calls } = control(['stats-nba.duckdb'])
    leagues.open()
    await flush()
    expect(calls).toEqual(['start nba', 'refresh nba'])
    leagues.refreshAll()
    await flush()
    expect(calls.filter((c) => c.includes('wnba'))).toEqual([])
  })

  it('turns a league off: its refresh stops, and its file stays readable', async () => {
    const { leagues, calls, changed } = control(['stats-nba.duckdb'])
    leagues.open()
    await flush()
    calls.length = 0
    await leagues.setDownloads({ wnba: true })
    await flush()
    expect(calls).toEqual(['start wnba', 'refresh wnba'])
    // The WNBA's first load writes its file.
    writeFileSync(join(dir!, 'stats-wnba.duckdb'), 'x')
    calls.length = 0
    await leagues.setDownloads({ wnba: false })
    // Closed, which interrupts a running refresh; the file stays readable, opened again on a read.
    expect(calls).toEqual(['close wnba'])
    leagues.refreshAll()
    await flush()
    expect(calls).toEqual(['close wnba', 'refresh nba'])
    await leagues.reads('wnba').status()
    expect(calls).toEqual(['close wnba', 'refresh nba', 'start wnba'])
    // Told once for each change, besides each refresh's own notice when it ends.
    expect(changed.filter((l) => l === 'wnba').length).toBeGreaterThanOrEqual(2)
  })

  it('deletes a league’s file only once it is off', async () => {
    const { leagues, dataDir, calls } = control(['stats-nba.duckdb', 'stats-wnba.duckdb'])
    leagues.open()
    await flush()
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
    await flush()
    const status = await leagues.reads('nba').status()
    expect(status.available).toBe(false)
    expect(status.noData).toBeUndefined()
  })
})

/**
 * The league workers through the pool (D22's addition of 2026-11-22): a refresh of a league not on
 * screen opens its worker and the paired league's for the links step, both close once idle, and a
 * closed league's status answers without opening it.
 */
describe('the league workers, opened for what needs them and closed when idle', () => {
  function lifecycle(): {
    leagues: LeagueControl
    calls: string[]
    tick: (ms: number) => Promise<void>
  } {
    const { db, dataDir } = profile(['stats-nba.duckdb', 'stats-ncaam.duckdb'])
    setLeagueDownloads(db, { nba: true, ncaam: true })
    const calls: string[] = []
    let now = 0
    let next = 1
    const timers = new Map<number, { at: number; fn: () => void }>()
    const tick = async (ms: number): Promise<void> => {
      now += ms
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id)
          t.fn()
        }
      }
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
    }
    const worker = (league: LeagueId): StatsClient =>
      ({
        refresh: async () => {
          calls.push(`refresh ${league}`)
          return { steps: [{ rowsWritten: 3 }] }
        },
        status: async () => ({
          available: true,
          builtAt: `${league} built`,
          paused: false,
          noRoom: null
        }),
        linkSide: async () => {
          calls.push(`linkSide ${league}`)
          return null
        },
        linkLines: async () => {
          calls.push(`linkLines ${league}`)
          return null
        },
        catalogue: async () => [],
        close: async () => void calls.push(`close ${league}`)
      }) as unknown as StatsClient
    const links = {
      ping: async () => undefined,
      refreshPaired: async () => [],
      ingestSide: async () => undefined,
      ingestLines: async () => undefined,
      linkedIds: async () => [1],
      counts: async () => ({}),
      failed: async () => undefined,
      close: async () => void calls.push('close links')
    } as unknown as LinksClient
    const leagues = createLeagueControl({
      db,
      dataDir,
      start: (league) => {
        calls.push(`start ${league}`)
        return worker(league)
      },
      startLinks: () => {
        calls.push('start links')
        return links
      },
      onChanged: () => {},
      free,
      log: () => {},
      idleMs: 60_000,
      setTimer: (fn, ms) => {
        const id = next++
        timers.set(id, { at: now + ms, fn })
        return id
      },
      clearTimer: (t) => void timers.delete(t as number)
    })
    return { leagues, calls, tick }
  }

  it('opens a league not on screen for its refresh and the paired league for the links step, then closes them', async () => {
    const { leagues, calls, tick } = lifecycle()
    leagues.onScreen('wnba')
    leagues.refresh('nba')
    await tick(0)
    expect(calls).toEqual([
      'start nba',
      'refresh nba',
      'start links',
      'linkSide nba',
      'start ncaam',
      'linkLines ncaam',
      'linkLines nba'
    ])
    await tick(60_000)
    expect(calls.slice(-3).sort()).toEqual(['close links', 'close nba', 'close ncaam'])
    expect(leagues.client('nba')).toBeNull()
    // Its status, kept as it closed, answers without opening it.
    calls.length = 0
    expect((await leagues.reads('nba').status()).builtAt).toBe('nba built')
    expect(calls).toEqual([])
    // Any other read opens it again.
    await leagues.reads('nba').catalogue()
    expect(calls).toEqual(['start nba'])
  })

  it('keeps the league on screen open until a refresh writes rows, then reopens it on the next read', async () => {
    const { leagues, calls, tick } = lifecycle()
    leagues.onScreen('ncaam')
    await leagues.reads('ncaam').status()
    await tick(120_000)
    expect(leagues.client('ncaam')).not.toBeNull()
    leagues.refresh('ncaam')
    await tick(0)
    await tick(60_000)
    expect(calls).toContain('close ncaam')
    expect(leagues.client('ncaam')).toBeNull()
    await leagues.reads('ncaam').catalogue()
    expect(calls.at(-1)).toBe('start ncaam')
  })
})
