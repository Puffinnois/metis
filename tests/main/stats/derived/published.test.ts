import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  buildPublished,
  canBuildPublished,
  markPublishedStale,
  PUBLISHED_VERSION,
  publishedStale
} from '@main/stats/derived/published'
import { MATCHUP_COUNTS } from '@main/stats/derived/publishedTables'
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
      // The defenders' matchups: the rollup, with the pair file taking over where it is out.
      real.PUBLISHED_TABLES.find((t) => t.table === 'pub_player_matchups')!,
      real.PUBLISHED_TABLES.find((t) => t.table === 'pub_player_matchup_positions')!,
      // SportsDataverse's impact models, and DARKO from the regular season alone.
      real.PUBLISHED_TABLES.find((t) => t.table === 'pub_player_impact')!,
      real.PUBLISHED_TABLES.find((t) => t.table === 'pub_player_darko')!,
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

  describe('matchups', () => {
    const COUNTS = MATCHUP_COUNTS.map((c) => `${c} DOUBLE`).join(', ')
    /** A row of the rollup or the pair file: every count is `n`, so each row's share is plain. */
    const counts = (n: number): string => MATCHUP_COUNTS.map(() => n).join(', ')

    beforeEach(async () => {
      await db.exec(`CREATE TABLE src_nba_matchup_rollups (def_player_id BIGINT, position VARCHAR,
        gp BIGINT, matchup_min VARCHAR, partial_poss DOUBLE, ${COUNTS}, season INTEGER,
        season_type VARCHAR, per_mode VARCHAR)`)
      await db.exec(`CREATE TABLE src_nba_season_matchups (off_player_id BIGINT,
        def_player_id BIGINT, gp BIGINT, matchup_min VARCHAR, partial_poss DOUBLE, ${COUNTS},
        season INTEGER, season_type VARCHAR, per_mode VARCHAR, matchup_time_sec DOUBLE)`)
      // LeBron James (2544) guarding in 2025-26 and 2026-27. The 2025-26 rollup reads short of the
      // pair file, as measured; 2026-27 has no pair file yet. `9:60` is how the source writes a
      // clock it rounded up.
      await db.exec(`INSERT INTO src_nba_matchup_rollups VALUES
        (2544, 'TOTAL', 60, '749:48', 3861.3, ${counts(10)}, 2026, 'regular-season', 'totals'),
        (2544, 'G', 60, '315:04', 1616.7, ${counts(4)}, 2026, 'regular-season', 'totals'),
        (2544, 'F', 60, '356:37', 1823, ${counts(5)}, 2026, 'regular-season', 'totals'),
        (2544, 'C', 50, '78:07', 421.6, ${counts(1)}, 2026, 'regular-season', 'totals'),
        (2544, 'TOTAL', 60, '12.5', 64.4, ${counts(1)}, 2026, 'regular-season', 'pergame'),
        (2544, 'TOTAL', 5, '9:60', 60, ${counts(2)}, 2026, 'playoffs', 'totals'),
        (2544, 'G', 5, '9:60', 60, ${counts(2)}, 2026, 'playoffs', 'totals'),
        (2544, 'TOTAL', 7, '80:30', 410, ${counts(3)}, 2027, 'regular-season', 'totals'),
        (2544, 'TOTAL', 70, '800:00', 4000, ${counts(9)}, 2017, 'regular-season', 'totals')`)
      await db.exec(`INSERT INTO src_nba_season_matchups VALUES
        (1, 2544, 3, '30:00', 150, ${counts(6)}, 2026, 'regular-season', 'totals', 1800),
        (2, 2544, 2, '9:60', 60, ${counts(5)}, 2026, 'regular-season', 'totals', 599.5),
        (2, 2544, 2, '5.0', 30, ${counts(2)}, 2026, 'regular-season', 'pergame', 300)`)
    })

    it('add up the pair file in its seasons, and keep the rollup for the games and the rest', async () => {
      await buildPublished(db)
      const sums = await db.all<Record<string, number>>(
        `SELECT season, game_type, sum(games) AS games, sum(possessions) AS poss,
                sum(matchup_minutes) AS minutes, sum(player_pts) AS pts, sum(sfl) AS sfl
         FROM pub_player_matchups WHERE player_id = 2544 GROUP BY ALL ORDER BY ALL`
      )
      expect(sums).toEqual([
        // The pair file's two pairs, over the rollup's 60 games.
        { season: 2026, game_type: 'playoffs', games: 5, poss: 60, minutes: 10, pts: 2, sfl: 2 },
        {
          season: 2026,
          game_type: 'regular',
          games: 60,
          poss: 210,
          minutes: (1800 + 599.5) / 60,
          pts: 11,
          sfl: 11
        },
        { season: 2027, game_type: 'regular', games: 7, poss: 410, minutes: 80.5, pts: 3, sfl: 3 }
      ])
    })

    it('split the rollup by the position guarded, over its own total', async () => {
      await buildPublished(db)
      const [row] = await db.all<Record<string, number>>(
        `SELECT sum(pos_all_minutes) AS all_min, sum(pos_g_minutes) AS g_min,
                sum(pos_c_poss) AS c_poss, sum(pos_f_pts) AS f_pts, sum(pos_g_fga) AS g_fga
         FROM pub_player_matchup_positions
         WHERE player_id = 2544 AND season = 2026 AND game_type = 'regular'`
      )
      expect(row.g_min / row.all_min).toBeCloseTo(0.4202009424735, 9)
      expect(row).toMatchObject({ c_poss: 421.6, f_pts: 5, g_fga: 4 })
    })

    it('list each pair of a season, from the pair file’s totals', async () => {
      await buildPublished(db)
      expect(
        await db.all(`SELECT off_player_id, games, minutes, partial_poss, player_pts
          FROM pub_matchup_pairs ORDER BY off_player_id`)
      ).toEqual([
        { off_player_id: 1, games: 3, minutes: 30, partial_poss: 150, player_pts: 6 },
        { off_player_id: 2, games: 2, minutes: 599.5 / 60, partial_poss: 60, player_pts: 5 }
      ])
    })
  })

  describe('impact models', () => {
    beforeEach(async () => {
      await db.exec(`CREATE TABLE src_nba_impact (player_id BIGINT, season INTEGER,
        season_type VARCHAR, o_rapm DOUBLE, d_rapm DOUBLE, rapm DOUBLE, off_poss BIGINT,
        def_poss BIGINT, o_adj_rapm DOUBLE, d_adj_rapm DOUBLE, adj_rapm DOUBLE, ospm DOUBLE,
        dspm DOUBLE, spm DOUBLE, min DOUBLE, gp BIGINT, obpm DOUBLE, dbpm DOUBLE, bpm DOUBLE,
        war DOUBLE, darko_filtered_skill DOUBLE, darko_projected_rating DOUBLE,
        darko_projected_sd DOUBLE, boban_filtered_skill DOUBLE, boban_projected_rating DOUBLE,
        boban_projected_sd DOUBLE)`)
      // LeBron James's 2025-26, rounded from the source. DARKO's playoff row repeats the regular
      // season's, as on every player.
      await db.exec(`INSERT INTO src_nba_impact VALUES
        (2544, 2026, 'Regular Season', -0.24, 0.97, 0.74, 4105, 4101, 10.85, -10.11, 0.74,
         1.24, 0.04, 1.28, 1988, 60, 1.07, 4.18, 5.24, 5.93, 2.1, 1.9, 1.94, NULL, NULL, NULL),
        (2544, 2026, 'Playoffs', -0.33, -0.13, -0.46, 732, 732, 10.73, -10.02, 0.71,
         1.0, -0.15, 0.86, 382, 10, -5.04, 3.73, -1.31, 0.59, 2.1, 1.9, 1.94, NULL, NULL, NULL)`)
    })

    it('store each model value times what it was fitted on', async () => {
      await buildPublished(db)
      const [r] = await db.all<Record<string, number>>(
        `SELECT * FROM pub_player_impact WHERE game_type = 'regular'`
      )
      expect(r.rapm / r.impact_poss).toBeCloseTo(0.74, 9)
      expect(r.o_rapm / r.off_poss).toBeCloseTo(-0.24, 9)
      expect(r.d_adj_rapm / r.def_poss).toBeCloseTo(-10.11, 9)
      expect(r.bpm / r.minutes).toBeCloseTo(5.24, 9)
      expect(r).toMatchObject({ games: 60, minutes: 1988, impact_poss: 8206, war: 5.93 })
    })

    it('weight two season types by what each was fitted on', async () => {
      await buildPublished(db)
      const [r] = await db.all<Record<string, number>>(
        `SELECT sum(rapm) / sum(impact_poss) AS rapm, sum(war) AS war FROM pub_player_impact`
      )
      expect(r.rapm).toBeCloseTo((0.74 * 8206 - 0.46 * 1464) / (8206 + 1464), 9)
      expect(r.war).toBeCloseTo(6.52, 9)
    })

    it('read DARKO under the name the file now gives it', async () => {
      // A fresh download: the darko_* columns are empty and the values sit in boban_*.
      await db.exec(`UPDATE src_nba_impact SET darko_filtered_skill = NULL,
        darko_projected_rating = NULL, darko_projected_sd = NULL, boban_filtered_skill = 2.2,
        boban_projected_rating = 1.9, boban_projected_sd = 1.94`)
      await buildPublished(db)
      expect(
        await db.all(`SELECT games, darko_filtered_skill / games AS skill,
          darko_projected_rating / games AS next, darko_projected_sd / games AS sd
          FROM pub_player_darko`)
      ).toEqual([{ games: 60, skill: 2.2, next: 1.9, sd: 1.94 }])
    })

    it('read DARKO from the regular season only', async () => {
      await buildPublished(db)
      expect(
        await db.all(`SELECT game_type, games, darko_projected_rating / games AS next
          FROM pub_player_darko`)
      ).toEqual([{ game_type: 'regular', games: 60, next: 1.9 }])
    })
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
