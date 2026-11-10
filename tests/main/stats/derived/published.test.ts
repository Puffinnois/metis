import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  buildPublished,
  canBuildPublished,
  markPublishedStale,
  PUBLISHED_VERSION,
  publishedStale
} from '@main/stats/derived/published'
import { bootstrapStatsDb } from '@main/stats/schema'
import { openTestDb } from '../../../fixtures/stats'

vi.mock('@main/stats/derived/publishedTables', async (actual) => {
  const real = await actual<typeof import('@main/stats/derived/publishedTables')>()
  return {
    ...real,
    PUBLISHED_TABLES: [
      // A real one: the catch-and-shoot file, whose blank threes need reading as 0.
      real.PUBLISHED_TABLES.find((t) => t.table === 'pub_player_catch_shoot')!,
      // A play type, read from the one file of them all.
      real.PUBLISHED_TABLES.find((t) => t.table === 'pub_player_pt_d_iso')!,
      {
        table: 'published_test_widgets',
        entity: 'player',
        source: 'src_test_widgets',
        firstSeason: 2014,
        games: 'gp',
        minutes: 'min',
        columns: ['widgets', 'gone']
      },
      {
        table: 'published_test_teams',
        entity: 'team',
        source: 'src_test_teams',
        games: null,
        minutes: 'min',
        possessions: 'poss',
        columns: ['widgets', { name: 'rated', sql: '{rating} * {poss}' }]
      }
    ]
  }
})

let db: StatsDb

interface WidgetRow {
  player_id: number
  season: number
  game_type: string
  games: number | null
  minutes: number | null
  possessions: number | null
  widgets: number | null
  gone: number | null
}

const widgets = (): Promise<WidgetRow[]> =>
  db.all<WidgetRow>('SELECT * FROM published_test_widgets ORDER BY season, game_type')

beforeEach(async () => {
  db = await openTestDb()
})

describe('the published tables', () => {
  it('exist empty from the first open, with every column', async () => {
    expect(await widgets()).toEqual([])
    const cols = await db.all<{ column_name: string }>(
      "SELECT column_name FROM duckdb_columns() WHERE table_name = 'published_test_teams'"
    )
    expect(cols.map((c) => c.column_name)).toEqual([
      'team_id',
      'season',
      'game_type',
      'games',
      'minutes',
      'possessions',
      'widgets',
      'rated'
    ])
  })

  it('gain a column a new version adds on the next open, keeping their rows', async () => {
    await db.exec('DROP TABLE published_test_widgets')
    await db.exec(
      `CREATE TABLE published_test_widgets (player_id BIGINT, season INTEGER, game_type VARCHAR)`
    )
    await db.exec(`INSERT INTO published_test_widgets VALUES (1, 2026, 'regular')`)
    await bootstrapStatsDb(db, new Date())
    expect(await widgets()).toMatchObject([{ player_id: 1, widgets: null }])
  })

  it('read totals only, and map both spellings of a season type', async () => {
    await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER,
      season_type VARCHAR, per_mode VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
    await db.exec(`INSERT INTO src_test_widgets VALUES
      (1, 2026, 'Regular Season', 'Totals', 70, 2000, 500),
      (1, 2026, 'Regular Season', 'PerGame', 70, 28.6, 7.1),
      (1, 2025, 'regular-season', 'totals', 60, 1800, 400),
      (1, 2026, 'Playoffs', 'Totals', 5, 150, 30),
      (1, 2026, 'PlayIn', 'Totals', 1, 30, 5)`)
    await buildPublished(db)
    expect(await widgets()).toMatchObject([
      { season: 2025, game_type: 'regular', games: 60, minutes: 1800, widgets: 400 },
      { season: 2026, game_type: 'playoffs', games: 5, minutes: 150, widgets: 30 },
      { season: 2026, game_type: 'regular', games: 70, minutes: 2000, widgets: 500 }
    ])
  })

  it('keep zeros, and read a column the source does not have as NULL', async () => {
    await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER,
      season_type VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
    await db.exec(`INSERT INTO src_test_widgets VALUES (1, 2026, 'Regular Season', 0, 0, 0)`)
    await buildPublished(db)
    expect(await widgets()).toMatchObject([
      { games: 0, minutes: 0, possessions: null, widgets: 0, gone: null }
    ])
  })

  it('leave out seasons before the first with real values', async () => {
    await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER,
      season_type VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
    await db.exec(`INSERT INTO src_test_widgets VALUES
      (1, 2013, 'Regular Season', 80, 2400, 0), (1, 2014, 'Regular Season', 80, 2400, 90)`)
    await buildPublished(db)
    expect((await widgets()).map((r) => r.season)).toEqual([2014])
  })

  it('read a team by its id, with what it publishes', async () => {
    await db.exec(`CREATE TABLE src_test_teams (team_id BIGINT, season INTEGER,
      season_type VARCHAR, min DOUBLE, poss DOUBLE, widgets BIGINT, rating DOUBLE)`)
    await db.exec(
      `INSERT INTO src_test_teams VALUES (7, 2026, 'Regular Season', 3950, 8100, 12, 110.5)`
    )
    await buildPublished(db)
    const rows = await db.all('SELECT * FROM published_test_teams')
    expect(rows).toMatchObject([
      {
        team_id: 7,
        games: null,
        minutes: 3950,
        possessions: 8100,
        widgets: 12,
        rated: 110.5 * 8100
      }
    ])
  })

  it('work a column out of the source columns, NULL when one is missing', async () => {
    await db.exec(`CREATE TABLE src_test_teams (team_id BIGINT, season INTEGER,
      season_type VARCHAR, min DOUBLE, poss DOUBLE)`)
    await db.exec(`INSERT INTO src_test_teams VALUES (7, 2026, 'Regular Season', 3950, 8100)`)
    await buildPublished(db)
    expect(await db.all('SELECT rated FROM published_test_teams')).toEqual([{ rated: null }])
  })

  it('read blank threes on a row with attempts as 0, and leave a row with none blank', async () => {
    await db.exec(`CREATE TABLE src_dash_player_tracking_catchshoot (player_id BIGINT,
      season INTEGER, season_type VARCHAR, per_mode VARCHAR, gp BIGINT, min DOUBLE,
      catch_shoot_fgm BIGINT, catch_shoot_fga BIGINT, catch_shoot_pts BIGINT,
      catch_shoot_fg3_m BIGINT, catch_shoot_fg3_a BIGINT)`)
    // Measured on 2025-26: Charles Bassey made 2 of 5, none of them threes, published as blanks.
    await db.exec(`INSERT INTO src_dash_player_tracking_catchshoot VALUES
      (1, 2026, 'Regular Season', 'Totals', 13, 120, 2, 5, 4, NULL, NULL),
      (2, 2026, 'Regular Season', 'Totals', 60, 1800, 66, 173, 198, 66, 171),
      (3, 2026, 'Regular Season', 'Totals', 1, 3, NULL, NULL, NULL, NULL, NULL),
      (4, 2013, 'Regular Season', 'Totals', 80, 2400, 0, 0, 0, 0, 0)`)
    await buildPublished(db)
    expect(
      await db.all(`SELECT player_id, catch_shoot_fga, catch_shoot_fg3_m, catch_shoot_fg3_a
        FROM pub_player_catch_shoot ORDER BY player_id`)
    ).toEqual([
      { player_id: 1, catch_shoot_fga: 5, catch_shoot_fg3_m: 0, catch_shoot_fg3_a: 0 },
      { player_id: 2, catch_shoot_fga: 173, catch_shoot_fg3_m: 66, catch_shoot_fg3_a: 171 },
      { player_id: 3, catch_shoot_fga: null, catch_shoot_fg3_m: null, catch_shoot_fg3_a: null }
    ])
  })

  it('read one play type and side out of the file of them all, a row per team', async () => {
    await db.exec(`CREATE TABLE src_nba_play_types (player_id BIGINT, team_id BIGINT,
      play_type VARCHAR, type_grouping VARCHAR, gp BIGINT, poss_pct DOUBLE, efg_pct DOUBLE,
      ft_poss_pct DOUBLE, tov_poss_pct DOUBLE, sf_poss_pct DOUBLE, plusone_poss_pct DOUBLE,
      score_poss_pct DOUBLE, poss DOUBLE, pts DOUBLE, fgm DOUBLE, fga DOUBLE, season INTEGER,
      season_type VARCHAR, per_mode VARCHAR)`)
    // Nikola Jokić's isolations defended in 2025-26, as published, and rows to leave out: their own
    // isolations, the per-game file, another type and a season before the first. A traded player
    // keeps a row per team, and a share rounded to 0 leaves the frequency's parts blank.
    await db.exec(`INSERT INTO src_nba_play_types VALUES
      (1, 10, 'Isolation', 'Defensive', 61, 0.042, 0.549, 0.146, 0.083, 0.146, 0.083, 0.5,
        48, 53, 21, 41, 2026, 'regular-season', 'totals'),
      (1, 10, 'Isolation', 'Offensive', 63, 0.067, 0.571, 0.106, 0.125, 0.096, 0.048, 0.51,
        104, 112, 47, 85, 2026, 'regular-season', 'totals'),
      (1, 10, 'Isolation', 'Defensive', 61, 0.042, 0.549, 0.146, 0.083, 0.146, 0.083, 0.5,
        0.8, 0.9, 0.3, 0.7, 2026, 'regular-season', 'pergame'),
      (1, 10, 'PRRollMan', 'Defensive', 61, 0.147, 0.623, 0.089, 0.083, 0.089, 0.036, 0.544,
        169, 200, 84, 146, 2026, 'regular-season', 'totals'),
      (2, 10, 'Isolation', 'Defensive', 20, 0.05, 0.5, 0.1, 0.1, 0.1, 0, 0.4,
        20, 18, 8, 16, 2016, 'regular-season', 'totals'),
      (2, 11, 'Isolation', 'Defensive', 30, 0, 0.5, 0, 0, 0, 0, 0.5,
        2, 2, 1, 2, 2016, 'regular-season', 'totals'),
      (3, 10, 'Isolation', 'Defensive', 9, 0.05, 0.5, 0.1, 0.1, 0.1, 0, 0.4,
        5, 4, 2, 4, 2015, 'regular-season', 'totals')`)
    await buildPublished(db)
    const rows = await db.all<Record<string, number>>(
      'SELECT * FROM pub_player_pt_d_iso ORDER BY player_id, d_iso_poss DESC'
    )
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      player_id: 1,
      season: 2026,
      game_type: 'regular',
      games: 61,
      minutes: null,
      d_iso_poss: 48,
      d_iso_pts: 53,
      d_iso_fgm: 21,
      d_iso_fga: 41,
      d_iso_freq_poss: 48
    })
    expect(rows[0].d_iso_all_poss).toBeCloseTo(48 / 0.042, 6)
    expect(rows[0].d_iso_efg_w).toBeCloseTo(0.549 * 41, 6)
    expect(rows[0].d_iso_tov_w).toBeCloseTo(0.083 * 48, 6)
    expect(rows[0].d_iso_score_w).toBeCloseTo(0.5 * 48, 6)
    expect(rows.slice(1)).toMatchObject([
      { player_id: 2, games: 20, d_iso_poss: 20, d_iso_freq_poss: 20 },
      { player_id: 2, games: 30, d_iso_poss: 2, d_iso_freq_poss: null, d_iso_all_poss: null }
    ])
  })

  it('build empty, without failing, while a source is not loaded', async () => {
    expect(await buildPublished(db)).toBe(0)
    expect(await widgets()).toEqual([])
  })

  it('return the rows they wrote, and replace them on a rebuild', async () => {
    await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER,
      season_type VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
    await db.exec(`INSERT INTO src_test_widgets VALUES (1, 2026, 'Regular Season', 1, 1, 1)`)
    expect(await buildPublished(db)).toBe(1)
    await db.exec('DELETE FROM src_test_widgets')
    expect(await buildPublished(db)).toBe(0)
    expect(await widgets()).toEqual([])
  })

  it('say when they are out of date', async () => {
    expect(canBuildPublished()).toBe(true)
    expect(await publishedStale(db)).toBe(true)
    await buildPublished(db)
    expect(await publishedStale(db)).toBe(false)
    const state = await db.get<{ version: number }>(
      "SELECT version FROM derived_state WHERE name = 'published'"
    )
    expect(state?.version).toBe(PUBLISHED_VERSION)
    await markPublishedStale(db)
    expect(await publishedStale(db)).toBe(true)
  })
})
