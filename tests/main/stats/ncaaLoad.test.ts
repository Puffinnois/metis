import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import type { Downloads, FetchedFile } from '@main/stats/download'
import { includedSources, leftOutIn, leftOutProblem, requiredReleases } from '@main/stats/leftOut'
import { loadSourceFile, type LoadedFile } from '@main/stats/load'
import {
  fileUrl,
  LEFT_OUT_RELEASES,
  NCAA_STATS_RELEASES,
  SOURCES_BY_LEAGUE,
  type SourceFile
} from '@main/stats/sources'
import { refreshStats, STATS_LEFT_OUT_STEP } from '@main/stats/sync'
import { LEAGUES } from '@shared/leagues'
import { openTestDb, tempDir } from '../../fixtures/stats'

/**
 * The college file shapes the loader meets, on fixtures cut from the real files of 2026-11-18
 * (`~/.cache/metis-dev/ncaa-raw`): one 2025-26 game, 401823425, from ESPN's and stats.ncaa.org's
 * player box scores; three games of 2020-21 and three of 2021-22 from ESPN's schedule master; two
 * teams of the stats.ncaa.org team crosswalk in 2020-21, 2021-22 and 2025-26; the whole groups file;
 * one conference of the combined group file and of its 2025-26 season file; the games-in-repo rows of
 * the master's three 2021-22 games. They prove the window (D39), the season published as text, ids
 * kept as published, the repeats that keep the combined group file and the games-in-repo file out
 * (D23), and the switch that runs a league without stats.ncaa.org's releases (D41).
 */
const FIXTURES = join(__dirname, '../../fixtures/ncaa')
const fixture = (name: string): string => join(FIXTURES, `${name}.parquet`)
const ncaam = SOURCES_BY_LEAGUE.ncaam
const sourceOf = (id: string): SourceFile => ncaam.find((s) => s.id === id)!

async function load(
  db: StatsDb,
  source: SourceFile,
  season: number,
  name: string
): Promise<LoadedFile> {
  return loadSourceFile(db, source, season, fixture(name))
}

describe('a college file of every season', () => {
  it('keeps its rows from 2021-22 on', async () => {
    const db = await openTestDb()
    const loaded = await load(db, sourceOf('espn_schedule_master'), 0, 'mbb_schedule_master')
    // Three games of 2020-21 in the file are left out.
    expect(loaded.rows).toBe(3)
    const seasons = await db.all<{ season: number; n: number }>(
      'SELECT season, count(*)::INTEGER AS n FROM src_espn_schedule_master GROUP BY 1'
    )
    expect(seasons).toEqual([{ season: 2022, n: 3 }])
  })

  it('reads a season published as text by its final year, and keeps the rest as published', async () => {
    const db = await openTestDb()
    const loaded = await load(db, sourceOf('xwalk_ncaa_teams'), 0, 'ncaa_espn_team_crosswalk')
    expect(loaded.rows).toBe(4)
    const rows = await db.all<{ season: number; n: number }>(
      'SELECT season, count(*)::INTEGER AS n FROM src_xwalk_ncaa_teams GROUP BY 1 ORDER BY 1'
    )
    expect(rows).toEqual([
      { season: 2022, n: 2 },
      { season: 2026, n: 2 }
    ])
    const types = await db.all<{ c: string; t: string }>(
      `SELECT column_name AS c, data_type AS t FROM duckdb_columns()
       WHERE table_name = 'src_xwalk_ncaa_teams' AND column_name IN ('season', 'espn_team_id', 'ncaa_team_id')
       ORDER BY 1`
    )
    expect(types).toEqual([
      { c: 'espn_team_id', t: 'VARCHAR' },
      { c: 'ncaa_team_id', t: 'BIGINT' },
      { c: 'season', t: 'INTEGER' }
    ])
  })

  it('is kept whole when it has no season column', async () => {
    const db = await openTestDb()
    const loaded = await load(db, sourceOf('groups'), 0, 'mbb_groups')
    expect(loaded.rows).toBe(64)
  })
})

describe('stats.ncaa.org’s player box scores', () => {
  it('keep their text ids and every column, beside ESPN’s lines for the same game', async () => {
    const db = await openTestDb()
    const ncaa = await load(db, sourceOf('ncaa_player_box'), 2026, 'ncaa_mbb_player_box_2026')
    const espn = await load(db, sourceOf('espn_player_box'), 2026, 'player_box_2026')
    expect(ncaa.notes).toEqual([])
    expect(espn.notes).toEqual([])
    expect([ncaa.rows, espn.rows]).toEqual([24, 32])
    // 125 columns as published, plus `file_season`.
    const columns = await db.get<{ n: number }>(
      "SELECT count(*)::INTEGER AS n FROM duckdb_columns() WHERE table_name = 'src_ncaa_player_box'"
    )
    expect(columns!.n).toBe(126)
    const types = await db.all<{ c: string; t: string }>(
      `SELECT column_name AS c, data_type AS t FROM duckdb_columns()
       WHERE table_name = 'src_ncaa_player_box' AND column_name IN ('contest_id', 'espn_game_id', 'season')
       ORDER BY 1`
    )
    expect(types).toEqual([
      { c: 'contest_id', t: 'VARCHAR' },
      { c: 'espn_game_id', t: 'VARCHAR' },
      { c: 'season', t: 'INTEGER' }
    ])
    // The two families' points for the game agree, each summed from its own lines.
    const points = await db.get<{ ncaa: number; espn: number }>(
      `SELECT (SELECT sum(pts) FROM src_ncaa_player_box)::INTEGER AS ncaa,
              (SELECT sum(points) FROM src_espn_player_box)::INTEGER AS espn`
    )
    expect(points!.ncaa).toBe(points!.espn)
  })
})

describe('the combined group file', () => {
  it('holds its season files’ rows, so it is not loaded (D23)', async () => {
    const db = await openTestDb()
    await load(db, sourceOf('team_groups'), 2026, 'mbb_team_group_seasons_2026')
    const combined: SourceFile = {
      ...sourceOf('groups'),
      id: 'left_out_groups',
      table: 'src_left_out_groups',
      stem: 'mbb_team_group_seasons'
    }
    await load(db, combined, 0, 'mbb_team_group_seasons')
    const differ = await db.get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM (
         (SELECT * EXCLUDE (file_season) FROM src_team_groups
          EXCEPT ALL SELECT * FROM src_left_out_groups)
         UNION ALL
         (SELECT * FROM src_left_out_groups
          EXCEPT ALL SELECT * EXCLUDE (file_season) FROM src_team_groups))`
    )
    expect(differ!.n).toBe(0)
    expect(ncaam.some((s) => s.stem === 'mbb_team_group_seasons' && s.allSeasons)).toBe(false)
  })
})

describe('the games-in-repo file', () => {
  it('repeats the schedule master’s rows from 2021-22 on, so it is not loaded (D23)', async () => {
    const db = await openTestDb()
    await load(db, sourceOf('espn_schedule_master'), 0, 'mbb_schedule_master')
    const repo: SourceFile = {
      ...sourceOf('espn_schedule_master'),
      id: 'left_out_repo',
      table: 'src_left_out_repo',
      stem: 'mbb_games_in_data_repo'
    }
    const loaded = await load(db, repo, 0, 'mbb_games_in_data_repo')
    expect(loaded.rows).toBe(3)
    const extra = await db.get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM (
         SELECT * FROM src_left_out_repo EXCEPT ALL SELECT * FROM src_espn_schedule_master)`
    )
    expect(extra!.n).toBe(0)
    expect(ncaam.some((s) => s.stem === 'mbb_games_in_data_repo')).toBe(false)
  })
})

describe('a college league without stats.ncaa.org’s releases (D41)', () => {
  const NOW = new Date('2026-11-18T12:00:00Z')
  const SWITCHED = [...LEFT_OUT_RELEASES, ...NCAA_STATS_RELEASES]
  const SERVED: [SourceFile, string][] = [
    [sourceOf('espn_player_box'), 'player_box_2026'],
    [sourceOf('ncaa_player_box'), 'ncaa_mbb_player_box_2026']
  ]

  function downloads(asked: string[]): Downloads {
    const dir = tempDir()
    let n = 0
    return {
      async fetchFile(url): Promise<FetchedFile> {
        asked.push(url)
        const hit = SERVED.find(([s]) => fileUrl(s, 2026) === url)
        if (!hit) return { kind: 'missing' }
        const path = join(dir, `${n++}.parquet`)
        copyFileSync(fixture(hit[1]), path)
        return { kind: 'file', path, etag: '"e"', bytes: 1, modified: '2026-11-18T06:00:00.000Z' }
      },
      removeFile: async () => undefined
    }
  }

  it('is a list the build accepts for both leagues, ESPN’s tables and the dataset’s kept', () => {
    for (const league of ['ncaam', 'ncaaw'] as const) {
      const sources = SOURCES_BY_LEAGUE[league]
      const mine = leftOutIn(SWITCHED, sources)
      expect(leftOutProblem(mine, sources)).toBeNull()
      expect(mine).toHaveLength(14)
      const kept = includedSources(mine, sources)
      expect(kept.some((s) => s.release.startsWith('ncaa_'))).toBe(false)
      expect(kept.some((s) => s.id === 'espn_pbp')).toBe(false)
      expect(new Set(kept.map((s) => s.release)).size).toBe(15)
      expect(requiredReleases(sources).some((r) => r.startsWith('ncaa_'))).toBe(false)
    }
    // The NBA's and the WNBA's lists are untouched by it.
    expect(leftOutIn(SWITCHED, SOURCES_BY_LEAGUE.nba)).toEqual([])
    expect(leftOutIn(SWITCHED, SOURCES_BY_LEAGUE.wnba)).toEqual([])
  })

  it('drops what stats.ncaa.org’s releases had loaded and downloads only the rest', async () => {
    const db = await openTestDb()
    const sources = SERVED.map(([s]) => s)
    const first: string[] = []
    await refreshStats(
      { db, league: LEAGUES.ncaam, downloads: downloads(first), now: () => NOW },
      {},
      sources
    )
    expect(first.some((u) => u.includes('/ncaa_mbb_player_box/'))).toBe(true)
    const before = await db.get<{ n: number }>(
      'SELECT count(*)::INTEGER AS n FROM src_ncaa_player_box'
    )
    expect(before!.n).toBe(24)

    const second: string[] = []
    const result = await refreshStats(
      { db, league: LEAGUES.ncaam, downloads: downloads(second), now: () => NOW },
      { force: true },
      sources,
      SWITCHED
    )
    expect(result.steps.filter((s) => s.status === 'error')).toEqual([])
    expect(result.steps.find((s) => s.source === STATS_LEFT_OUT_STEP)?.message).toBe('2 left out')
    expect(second.some((u) => u.includes('/ncaa_mbb_'))).toBe(false)
    const tables = await db.all<{ t: string }>(
      "SELECT table_name AS t FROM duckdb_tables() WHERE table_name LIKE 'src_%' ORDER BY 1"
    )
    expect(tables).toEqual([{ t: 'src_espn_player_box' }])
  })
})
