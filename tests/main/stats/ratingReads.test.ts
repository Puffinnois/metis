import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { BUILT_AT_NEXT_REFRESH } from '@main/stats/engine/compile'
import { NO_RATINGS, readRatingHistory } from '@main/stats/ratingReads'
import { LEAGUES } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'

/**
 * A player's ratings over time (Plan T1704), on rows written in the shape of SportsDataverse's
 * current-impact file: player 1 over two seasons, out of order in the table, one week with no
 * defence; player 2 one week.
 */
let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
  await db.exec(`CREATE TABLE src_nba_current_impact (player_id BIGINT, as_of DATE, season INTEGER,
    o_current_impact DOUBLE, d_current_impact DOUBLE, current_impact DOUBLE, o_prior DOUBLE,
    d_prior DOUBLE, off_poss BIGINT, def_poss BIGINT, last_game_date DATE, file_season INTEGER)`)
  await db.exec(`INSERT INTO src_nba_current_impact VALUES
    (1, DATE '2025-10-28', 2026, 2.5, 1.0, 3.5, 2.0, 0.5, 300, 310, DATE '2025-10-27', 2026),
    (1, DATE '2024-10-22', 2025, 1.0, 0.5, 1.5, 1.0, 0.5, 0, 0, NULL, 2025),
    (1, DATE '2024-10-29', 2025, 1.5, NULL, 1.4, 1.0, 0.5, 250, 240, DATE '2024-10-27', 2025),
    (2, DATE '2025-10-28', 2026, -1.0, -0.5, -1.5, -1.0, 0.0, 100, 90, DATE '2025-10-26', 2026)`)
})

describe('a player’s ratings over time', () => {
  it('gives SportsDataverse’s expected impact, every weekly row, oldest first, named with its maker', async () => {
    const history = await readRatingHistory(db, '1', LEAGUES.nba)
    expect(history.reason).toBeNull()
    expect(history.series).toHaveLength(1)
    const [s] = history.series
    expect(s).toMatchObject({
      id: 'sdv_expected_impact',
      label: 'Expected impact (SportsDataverse)',
      maker: 'SportsDataverse',
      unit: 'rating',
      grain: 'weekly'
    })
    expect(s.notes.length).toBeGreaterThan(0)
    expect(s.points).toEqual([
      {
        date: '2024-10-22',
        season: 2025,
        total: 1.5,
        offense: 1.0,
        defense: 0.5,
        possessions: 0,
        lastGame: null
      },
      {
        date: '2024-10-29',
        season: 2025,
        total: 1.4,
        offense: 1.5,
        defense: null,
        possessions: 490,
        lastGame: '2024-10-27'
      },
      {
        date: '2025-10-28',
        season: 2026,
        total: 3.5,
        offense: 2.5,
        defense: 1.0,
        possessions: 610,
        lastGame: '2025-10-27'
      }
    ])
  })

  it('answers a player with no rows with the reason, never an error', async () => {
    expect(await readRatingHistory(db, '99', LEAGUES.nba)).toEqual({
      playerId: '99',
      series: [],
      reason: NO_RATINGS
    })
  })

  it('answers a file built before the table with "Built at this league’s next refresh."', async () => {
    await db.exec('DROP TABLE src_nba_current_impact')
    expect(await readRatingHistory(db, '1', LEAGUES.nba)).toEqual({
      playerId: '1',
      series: [],
      reason: BUILT_AT_NEXT_REFRESH
    })
  })

  it('answers another league with its own reason', async () => {
    const wnba = await readRatingHistory(db, '1', LEAGUES.wnba)
    expect(wnba.series).toEqual([])
    expect(wnba.reason).toMatch(/^Not published for the WNBA/)
  })
})
