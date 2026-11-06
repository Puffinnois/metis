import type { StatsDb } from '../db'
import { PLAYER_SUMS, TEAM_SUMS } from './game'

const sums = (columns: readonly string[]): string =>
  columns.map((c) => `sum(${c}) AS ${c}`).join(', ')

/**
 * One row per player, season, game type and team, and one with no team for all of it. A traded
 * player's total is its own row: anything reading this table takes the rows of a team or the row with
 * no team, never both, so the two cannot be added together.
 */
const PLAYER_SEASON = `CREATE OR REPLACE TABLE player_season AS
  SELECT player_id, season, game_type, team_id,
         arg_max(team_id, game_date) AS last_team_id, max(game_date) AS last_date,
         mode(position) AS position, ${sums(PLAYER_SUMS)}
  FROM player_game
  GROUP BY GROUPING SETS ((player_id, season, game_type, team_id), (player_id, season, game_type))`

/** One row per team, season and game type. */
const TEAM_SEASON = `CREATE OR REPLACE TABLE team_season AS
  SELECT team_id, season, game_type, max(game_date) AS last_date, ${sums(TEAM_SUMS)}
  FROM team_game GROUP BY 1, 2, 3`

export async function buildSeasonTables(db: StatsDb): Promise<void> {
  await db.exec(PLAYER_SEASON)
  await db.exec(TEAM_SEASON)
}
