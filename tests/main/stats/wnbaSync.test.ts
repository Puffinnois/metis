import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Downloads, FetchedFile } from '@main/stats/download'
import { leftOutIn, leftOutProblem, requiredReleases } from '@main/stats/leftOut'
import { openStatsService, type StatsService } from '@main/stats/service'
import { fileUrl, SOURCES, SOURCES_BY_LEAGUE, type SourceFile } from '@main/stats/sources'
import { refreshStats, STATS_DERIVED_STEP } from '@main/stats/sync'
import { LEAGUES } from '@shared/leagues'
import { openTestDb, tempDir } from '../../fixtures/stats'

const wnba = LEAGUES.wnba
const FIXTURES = join(__dirname, '../../fixtures/wnba')
const NOW = new Date('2026-11-17T12:00:00Z')
const sourceOf = (id: string): SourceFile => SOURCES_BY_LEAGUE.wnba.find((s) => s.id === id)!
/** Two files of the WNBA's own shape: the 2026 game logs and ESPN's 2026 player box scores. */
const SERVED: [SourceFile, string][] = [
  [sourceOf('wnba_game_logs'), 'player_game_logs_2026'],
  [sourceOf('espn_player_box'), 'player_box_2026']
]

function downloads(): Downloads {
  const dir = tempDir()
  let n = 0
  return {
    async fetchFile(url): Promise<FetchedFile> {
      const hit = SERVED.find(([s]) => fileUrl(s, 2026) === url)
      if (!hit) return { kind: 'missing' }
      const path = join(dir, `${n++}.parquet`)
      copyFileSync(join(FIXTURES, `${hit[1]}.parquet`), path)
      return { kind: 'file', path, etag: '"e"', bytes: 1, modified: '2026-10-31T13:14:25.000Z' }
    },
    removeFile: async () => undefined
  }
}

describe('a WNBA refresh', () => {
  it('loads its files and builds nothing before its schedule and identity files are in', async () => {
    const db = await openTestDb()
    const sources = SERVED.map(([s]) => s)
    const result = await refreshStats(
      { db, league: wnba, downloads: downloads(), now: () => NOW },
      {},
      sources
    )
    const files = result.steps.filter((s) => s.source !== STATS_DERIVED_STEP)
    expect(files.filter((s) => s.status === 'ok').map((s) => s.rowsWritten)).toEqual([21, 25])
    // Its game tables are in its entry now (T1301.6), so no step says they never will be: they wait
    // for the identity tables, which wait for the schedules.
    expect(result.steps.filter((s) => s.source === STATS_DERIVED_STEP)).toEqual([])
    const built = await db.all<{ t: string }>(
      `SELECT table_name AS t FROM duckdb_tables()
       WHERE table_name IN ('game', 'team', 'player', 'player_game', 'player_season')`
    )
    expect(built).toEqual([])
    // The season ended on 2026-10-31 and the files have not changed for 17 days: sealed.
    const states = await db.all<{ sealed: boolean; modified_at: string }>(
      'SELECT sealed, modified_at FROM source_state ORDER BY source'
    )
    expect(states).toEqual([
      { sealed: true, modified_at: '2026-10-31T13:14:25.000Z' },
      { sealed: true, modified_at: '2026-10-31T13:14:25.000Z' }
    ])
  })

  it('logs nothing when nothing was loaded', async () => {
    const db = await openTestDb()
    const result = await refreshStats(
      {
        db,
        league: wnba,
        downloads: { fetchFile: async () => ({ kind: 'missing' }), removeFile: async () => {} },
        now: () => NOW
      },
      {},
      [sourceOf('wnba_game_logs')]
    )
    // Every season's file not published here, so nothing written and no build step logged.
    expect(result.steps).toHaveLength(30)
    expect(
      result.steps.every((s) => s.status === 'skipped' && s.source !== STATS_DERIVED_STEP)
    ).toBe(true)
  })
})

describe('the source switch on the WNBA', () => {
  const sources = SOURCES_BY_LEAGUE.wnba
  const SIX = [
    'espn_wnba_player_boxscores',
    'espn_wnba_schedules',
    'wnba_crosswalk',
    'wnba_groups',
    'wnba_stats_player_game_logs',
    'wnba_stats_schedules'
  ]

  it('refuses the six releases the keys are built from', () => {
    expect(requiredReleases(sources)).toEqual(SIX)
    for (const tag of SIX) {
      expect(leftOutProblem([tag], sources)).toBe(
        `LEFT_OUT_RELEASES names a release the game, team and player tables are built from, which cannot be left out: ${tag}.`
      )
    }
  })

  it('leaves out any other WNBA release, and the NBA’s are unchanged', () => {
    expect(leftOutProblem(['wnba_stats_shots', 'wnba_player_impact'], sources)).toBeNull()
    expect(requiredReleases(SOURCES)).not.toContain('wnba_crosswalk')
  })

  it('gives each league its part of the one list', () => {
    const list = ['nba_stats_shots', 'wnba_stats_shots', 'no_such_release']
    expect(leftOutIn(list, sources)).toEqual(['wnba_stats_shots', 'no_such_release'])
    expect(leftOutIn(list, SOURCES)).toEqual(['nba_stats_shots', 'no_such_release'])
    expect(leftOutProblem(leftOutIn(list, sources), sources)).toMatch(/no_such_release/)
  })
})

let service: StatsService | null = null
afterEach(async () => {
  await service?.close()
  service = null
})

describe('the WNBA worker before its tables exist', () => {
  it('opens its own file and answers as the NBA does before its first load gets that far', async () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'tmp'))
    service = await openStatsService({ league: 'wnba', dataDir: dir, tempDir: join(dir, 'tmp') })
    const s = service
    await expect(
      s.query({ entity: 'player', metrics: ['pts'], scope: { seasons: [2026] } })
    ).rejects.toThrow(wnba.notBuilt)
    expect(await s.seasons()).toEqual([])
    expect(await s.games(2026)).toEqual([])
    expect(await s.standings(2026)).toEqual([])
    expect(await s.player('1628932')).toBeNull()
    await expect(s.officialsSeason(2026, ['regular'])).resolves.toBeDefined()
    const data = await s.data()
    expect(data.families).toHaveLength(37)
    expect((await s.read("SELECT current_setting('memory_limit') AS m")).length).toBe(1)
  })
})
