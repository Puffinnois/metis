import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { loadSourceFile, type LoadedFile } from '@main/stats/load'
import { SOURCES_BY_LEAGUE, type SourceFile } from '@main/stats/sources'
import { openTestDb } from '../../fixtures/stats'

/**
 * The WNBA's file shapes that differ from the NBA's, on fixtures cut from the real files of
 * 2026-11-17 (`~/.cache/metis-dev/wnba-raw`): one game, 1022600001, from each 2026 file of the league's
 * stats site; ESPN's player box scores for the first game of 2002, 2024 and 2026; the coaches of 2024
 * and the 2026 rows whose `sort_sequence` is empty. The loader is the NBA's: these prove it keeps each
 * shape as published, and they prove again the repeats `wnba-data-sources.md` measured, which is why
 * those files are not in the registry (D23).
 */
const FIXTURES = join(__dirname, '../../fixtures/wnba')
const fixture = (name: string): string => join(FIXTURES, `${name}.parquet`)
const wnba = SOURCES_BY_LEAGUE.wnba
const sourceOf = (id: string): SourceFile => wnba.find((s) => s.id === id)!

/** A source for a file the registry leaves out, to load it beside its twin and compare. */
const leftOut = (table: string, stem: string): SourceFile => ({
  ...sourceOf('wnba_schedule'),
  id: table.slice('src_'.length),
  table,
  stem
})

async function load(
  db: StatsDb,
  source: SourceFile,
  season: number,
  name: string
): Promise<LoadedFile> {
  return loadSourceFile(db, source, season, fixture(name))
}

describe('the WNBA game logs', () => {
  it('load player rows and team rows as published, zeros kept', async () => {
    const db = await openTestDb()
    const loaded = await load(db, sourceOf('wnba_game_logs'), 2026, 'player_game_logs_2026')
    expect(loaded.rows).toBe(21)
    const counts = await db.get<{ players: number; teams: number; team_min: number }>(
      `SELECT count(player_id)::INTEGER AS players,
              count(*) FILTER (WHERE player_id IS NULL)::INTEGER AS teams,
              max(min) FILTER (WHERE player_id IS NULL)::INTEGER AS team_min
       FROM src_wnba_game_logs WHERE file_season = 2026`
    )
    // Two team rows a game, with the team's minutes: summing every row would double a team's points.
    expect(counts).toEqual({ players: 19, teams: 2, team_min: 200 })
    const zeros = await db.get<{ n: number }>(
      'SELECT count(*)::INTEGER AS n FROM src_wnba_game_logs WHERE blk = 0 OR fg3m = 0'
    )
    expect(zeros!.n).toBeGreaterThan(0)
    const team = await db.get<{ pts: number; summed: number }>(
      `SELECT max(pts) FILTER (WHERE player_id IS NULL)::INTEGER AS pts,
              sum(pts) FILTER (WHERE player_id IS NOT NULL)::INTEGER AS summed
       FROM src_wnba_game_logs
       WHERE team_id = (SELECT min(team_id) FROM src_wnba_game_logs)`
    )
    expect(team!.pts).toBe(team!.summed)
  })

  it('are what `wnba_stats_schedule_2026` holds, so that file is not loaded', async () => {
    const db = await openTestDb()
    await load(db, sourceOf('wnba_game_logs'), 2026, 'player_game_logs_2026')
    await load(
      db,
      leftOut('src_left_out_schedule', 'wnba_stats_schedule'),
      2026,
      'wnba_stats_schedule_2026'
    )
    const differ = await db.get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM (
         (SELECT * EXCLUDE (file_season) FROM src_wnba_game_logs
          EXCEPT ALL SELECT * EXCLUDE (file_season) FROM src_left_out_schedule)
         UNION ALL
         (SELECT * EXCLUDE (file_season) FROM src_left_out_schedule
          EXCEPT ALL SELECT * EXCLUDE (file_season) FROM src_wnba_game_logs))`
    )
    expect(differ!.n).toBe(0)
    expect(
      wnba.some((s) => s.stem === 'wnba_stats_schedule' || s.stem === 'wnba_stats_schedule_master')
    ).toBe(false)
  })
})

describe('the WNBA play by play', () => {
  it('holds every play of `play_by_play_2026` with more columns, so that file is not loaded', async () => {
    const db = await openTestDb()
    const full = await load(db, sourceOf('wnba_pbp'), 2026, 'wnba_play_by_play_2026')
    await load(db, leftOut('src_left_out_pbp', 'play_by_play'), 2026, 'play_by_play_2026')
    expect(full.rows).toBe(469)
    const columns = async (table: string): Promise<number> =>
      (await db.get<{ n: number }>(
        `SELECT count(*)::INTEGER AS n FROM duckdb_columns() WHERE table_name = '${table}'`
      ))!.n
    // 38 and 25 published, plus `file_season`.
    expect(await columns('src_wnba_pbp')).toBe(39)
    expect(await columns('src_left_out_pbp')).toBe(26)
    const key = 'game_id, action_number, clock, period, score_home, score_away, description'
    const differ = await db.get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM (
         (SELECT ${key} FROM src_left_out_pbp EXCEPT ALL SELECT ${key} FROM src_wnba_pbp)
         UNION ALL
         (SELECT ${key} FROM src_wnba_pbp EXCEPT ALL SELECT ${key} FROM src_left_out_pbp))`
    )
    expect(differ!.n).toBe(0)
    // `season` is published as BIGINT here and INTEGER in the other: cast to INTEGER as for every file.
    const type = await db.get<{ t: string }>(
      "SELECT data_type AS t FROM duckdb_columns() WHERE table_name = 'src_wnba_pbp' AND column_name = 'season'"
    )
    expect(type!.t).toBe('INTEGER')
  })
})

describe('the WNBA 2026 player box scores', () => {
  it('keep minutes as published, `mm:ss` text and blank for a player who did not play', async () => {
    const db = await openTestDb()
    const loaded = await load(db, sourceOf('wnba_player_box'), 2026, 'player_boxscores_2026')
    expect(loaded.rows).toBe(25)
    const minutes = await db.all<{ minutes: string }>(
      'SELECT DISTINCT minutes FROM src_wnba_player_box ORDER BY minutes'
    )
    const values = minutes.map((m) => m.minutes)
    expect(values.some((m) => /^\d{1,2}:\d{2}$/.test(m))).toBe(true)
    expect(values.some((m) => m === '' || m === null)).toBe(true)
    const type = await db.get<{ t: string }>(
      "SELECT data_type AS t FROM duckdb_columns() WHERE table_name = 'src_wnba_player_box' AND column_name = 'minutes'"
    )
    expect(type!.t).toBe('VARCHAR')
  })
})

describe('ESPN’s WNBA player box scores across seasons', () => {
  it('widen a column whose type changes and keep 2002’s zeros', async () => {
    const db = await openTestDb()
    const box = sourceOf('espn_player_box')
    // Newest first, as a first load runs.
    await load(db, box, 2026, 'player_box_2026')
    await load(db, box, 2024, 'player_box_2024')
    const old = await load(db, box, 2002, 'player_box_2002')
    expect(old.rows).toBe(22)
    // 2002's jersey is published with no type (read as INTEGER, all empty); the text column stays.
    const types = await db.all<{ c: string; t: string }>(
      `SELECT column_name AS c, data_type AS t FROM duckdb_columns()
       WHERE table_name = 'src_espn_player_box' AND column_name IN ('athlete_jersey', 'points', 'minutes')
       ORDER BY 1`
    )
    expect(types).toEqual([
      { c: 'athlete_jersey', t: 'VARCHAR' },
      { c: 'minutes', t: 'DOUBLE' },
      { c: 'points', t: 'INTEGER' }
    ])
    // ESPN's 2002 lines are all zeros as published, and minutes null: loaded as they are.
    const lines = await db.get<{ zeros: number; minutes: number }>(
      `SELECT count(*) FILTER (WHERE points = 0)::INTEGER AS zeros, count(minutes)::INTEGER AS minutes
       FROM src_espn_player_box WHERE file_season = 2002`
    )
    expect(lines).toEqual({ zeros: 22, minutes: 0 })
  })
})

describe('the WNBA coaches', () => {
  it('keep `sort_sequence` whole when a later season publishes it empty', async () => {
    const db = await openTestDb()
    const coaches = sourceOf('wnba_coaches')
    await load(db, coaches, 2026, 'coaches_2026')
    await load(db, coaches, 2024, 'coaches_2024')
    const types = await db.all<{ c: string; t: string }>(
      `SELECT column_name AS c, data_type AS t FROM duckdb_columns()
       WHERE table_name = 'src_wnba_coaches' AND column_name LIKE '%sort_sequence' ORDER BY 1`
    )
    expect(types).toEqual([
      { c: 'sort_sequence', t: 'BIGINT' },
      { c: 'sub_sort_sequence', t: 'BIGINT' }
    ])
    const filled = await db.get<{ y2024: number; y2026: number }>(
      `SELECT count(sort_sequence) FILTER (WHERE file_season = 2024)::INTEGER AS y2024,
              count(sort_sequence) FILTER (WHERE file_season = 2026)::INTEGER AS y2026
       FROM src_wnba_coaches`
    )
    expect(filled).toEqual({ y2024: 5, y2026: 0 })
  })
})
