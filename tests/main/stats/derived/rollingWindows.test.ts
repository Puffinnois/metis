import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { rollingSql, ROLLING_TABLE } from '@main/stats/derived/rollingWindows'
import { inspect } from '@main/stats/derived/sql'
import { openTestDb } from '../../../fixtures/stats'

/**
 * SportsDataverse's rolling windows (T1703.2) on rows written in the file's shape, made up: player 1
 * with a filled 50-attempt FG% window and an unfilled 200-attempt one, and 3P% windows; player 2 with
 * one window; a team row, which the file does not hold but the builder must skip.
 */
let db: StatsDb

const create = async (table: string): Promise<void> => {
  await db.exec(`CREATE TABLE ${table} (season INTEGER, entity_type VARCHAR, entity_id VARCHAR,
    entity_name VARCHAR, team_id VARCHAR, metric VARCHAR, window_unit VARCHAR, window_n BIGINT,
    cur DOUBLE, prev DOUBLE, season_start DOUBLE, career_baseline DOUBLE, delta_prev DOUBLE,
    delta_season DOUBLE, delta_career DOUBLE, delta_prev_rank BIGINT, n BIGINT, qualified BOOLEAN,
    last_event_date DATE, as_of_date DATE, id_source VARCHAR, file_season INTEGER)`)
  await db.exec(`INSERT INTO ${table} VALUES
    (2026, 'player', '1', 'One', '10', 'fg_pct', 'fga', 50, 0.50, 0.46, 0.48, 0.47, 0.04, 0.02, 0.03, 10, 50, true, DATE '2026-04-12', DATE '2026-06-13', 'nba_stats', 2026),
    (2026, 'player', '1', 'One', '10', 'fg_pct', 'fga', 200, 0.49, NULL, 0.48, 0.47, NULL, 0.01, 0.02, 20, 120, false, DATE '2026-04-12', DATE '2026-06-13', 'nba_stats', 2026),
    (2026, 'player', '1', 'One', '10', 'fg3_pct', 'fg3a', 50, 0.40, 0.36, 0.38, 0.37, 0.04, 0.02, 0.03, 5, 50, true, DATE '2026-04-12', DATE '2026-06-13', 'nba_stats', 2026),
    (2026, 'player', '2', 'Two', '20', 'fg_pct', 'fga', 50, 0.44, 0.45, 0.43, 0.46, -0.01, 0.01, -0.02, 40, 50, true, DATE '2026-04-10', DATE '2026-06-13', 'nba_stats', 2026),
    (2026, 'team', '10', 'Team', '10', 'fg_pct', 'fga', 50, 0.47, 0.46, 0.45, 0.46, 0.01, 0.02, 0.01, 1, 50, true, DATE '2026-04-12', DATE '2026-06-13', 'nba_stats', 2026)`)
}

beforeEach(async () => {
  db = await openTestDb()
})
afterEach(async () => {
  await db.close()
})

const rows = (): Promise<Record<string, number | null>[]> =>
  db.all(
    `SELECT player_id, season, rw_fg50_q, rw_fg50_cur, rw_fg50_dprev, rw_fg200_q, rw_fg200_cur,
            rw_fg3_50_cur / rw_fg3_50_q AS fg3_50, rw_fg3_200_q
     FROM ${ROLLING_TABLE} ORDER BY player_id`
  )

describe('the rolling windows', () => {
  it('keep each window’s values times the file’s own qualified flag, a row a player-season', async () => {
    await create('src_nba_rolling_windows')
    await db.exec(rollingSql(await inspect(db)))
    expect(await rows()).toEqual([
      {
        player_id: 1,
        season: 2026,
        rw_fg50_q: 1,
        rw_fg50_cur: 0.5,
        rw_fg50_dprev: 0.04,
        // Unfilled: 120 of 200 attempts, so its value reads nothing (0 over 0).
        rw_fg200_q: 0,
        rw_fg200_cur: 0,
        fg3_50: 0.4,
        // No row for that window: nothing at all.
        rw_fg3_200_q: null
      },
      {
        player_id: 2,
        season: 2026,
        rw_fg50_q: 1,
        rw_fg50_cur: 0.44,
        rw_fg50_dprev: -0.01,
        rw_fg200_q: null,
        rw_fg200_cur: null,
        fg3_50: null,
        rw_fg3_200_q: null
      }
    ])
  })

  it('reads the WNBA’s file of the same shape, and builds empty with neither', async () => {
    await create('src_wnba_rolling_windows')
    await db.exec(rollingSql(await inspect(db)))
    expect((await rows()).map((r) => r.player_id)).toEqual([1, 2])
    await db.exec('DROP TABLE src_wnba_rolling_windows')
    await db.exec(rollingSql(await inspect(db)))
    expect(await rows()).toEqual([])
  })
})
