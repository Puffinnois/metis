import type { League } from '@shared/leagues'
import type { RatingHistory, RatingPoint, RatingSeries } from '@shared/stats/types'
import type { StatsDb } from './db'
import { BUILT_AT_NEXT_REFRESH } from './engine/compile'

/**
 * A player's ratings over time (Plan T1704), a read beside the engine for the chart on the player
 * page: every series the file holds for one player, each named with its maker, every point oldest
 * first. One series so far:
 *
 * - **SportsDataverse's expected impact** (`src_nba_current_impact`, T1703.2): every weekly row as
 *   published, from opening night to early April, each from the games before its date only. The
 *   season's last and opening-night rows are the metrics `sdv_current_impact` and
 *   `sdv_expected_impact`; here are all of them.
 *
 * DARKO's snapshots (D55) and Metis's own game-by-game estimate (T1703.4) join it as they are built.
 * A player with no rows answers an empty list with the reason, a file without the table "Built at this
 * league's next refresh." (as the engine does, #145), a league with no such file its own reason.
 */

const EXPECTED_IMPACT = 'src_nba_current_impact'

export const RATINGS_NOT_PUBLISHED = (league: League): string =>
  `Not published for the ${league.name}: SportsDataverse's current-impact file covers the NBA alone.`
export const NO_RATINGS = 'No rating over time is published for this player.'

const EXPECTED_IMPACT_NOTES = [
  'The points per 100 possessions SportsDataverse expects the player to add, offence and defence, on each date from the games before it: its own estimate, not a box score.',
  'Weekly, from opening night to early April of each regular season, 2006-07 on; no playoffs. The season under way appears once its file is published.',
  'A box prior moves toward what the games show, so early-season points lean on earlier seasons.'
]

const exists = async (db: StatsDb, table: string): Promise<boolean> =>
  !!(await db.get(
    "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
    [table]
  ))

async function expectedImpact(db: StatsDb, playerId: string): Promise<RatingSeries | null> {
  const rows = await db.all<{
    date: string
    season: number
    total: number | null
    offense: number | null
    defense: number | null
    possessions: number | null
    last_game: string | null
  }>(
    `SELECT strftime(as_of, '%Y-%m-%d') AS date, season::INTEGER AS season,
            current_impact AS total, o_current_impact AS offense, d_current_impact AS defense,
            (off_poss + def_poss)::DOUBLE AS possessions,
            strftime(last_game_date, '%Y-%m-%d') AS last_game
     FROM ${EXPECTED_IMPACT}
     WHERE player_id = TRY_CAST(? AS BIGINT) AND as_of IS NOT NULL
     ORDER BY as_of`,
    [playerId]
  )
  if (rows.length === 0) return null
  const points: RatingPoint[] = rows.map((r) => ({
    date: r.date,
    season: Number(r.season),
    total: r.total === null ? null : Number(r.total),
    offense: r.offense === null ? null : Number(r.offense),
    defense: r.defense === null ? null : Number(r.defense),
    possessions: r.possessions === null ? null : Number(r.possessions),
    lastGame: r.last_game
  }))
  return {
    id: 'sdv_expected_impact',
    label: 'Expected impact (SportsDataverse)',
    maker: 'SportsDataverse',
    unit: 'rating',
    grain: 'weekly',
    points,
    notes: EXPECTED_IMPACT_NOTES
  }
}

export async function readRatingHistory(
  db: StatsDb,
  playerId: string,
  league: League
): Promise<RatingHistory> {
  if (league.id !== 'nba') return { playerId, series: [], reason: RATINGS_NOT_PUBLISHED(league) }
  if (!(await exists(db, EXPECTED_IMPACT))) {
    return { playerId, series: [], reason: BUILT_AT_NEXT_REFRESH }
  }
  const series = [await expectedImpact(db, playerId)].filter((s): s is RatingSeries => s !== null)
  return { playerId, series, reason: series.length === 0 ? NO_RATINGS : null }
}
