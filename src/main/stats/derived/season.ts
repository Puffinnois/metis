import type { StatsDb } from '../db'
import { EXTRA_PLAYER_SUMS, EXTRA_TEAM_SUMS, PLAYER_SUMS, TEAM_SUMS } from './game'

const sums = (columns: readonly string[]): string =>
  columns.map((c) => `sum(${c}) AS ${c}`).join(', ')

/**
 * One row per player, season, game type and team, and one with no team for all of it. A traded
 * player's total is its own row: anything reading this table takes the rows of a team or the row with
 * no team, never both, so the two cannot be added together.
 */
const playerSeason = (
  columns: readonly string[]
): string => `CREATE OR REPLACE TABLE player_season AS
  SELECT player_id, season, game_type, team_id,
         arg_max(team_id, game_date) AS last_team_id, max(game_date) AS last_date,
         mode(position) AS position, ${sums(columns)}
  FROM player_game
  GROUP BY GROUPING SETS ((player_id, season, game_type, team_id), (player_id, season, game_type))`

/** One row per team, season and game type. */
const teamSeason = (columns: readonly string[]): string => `CREATE OR REPLACE TABLE team_season AS
  SELECT team_id, season, game_type, max(game_date) AS last_date, ${sums(columns)}
  FROM team_game GROUP BY 1, 2, 3`

/** The columns a game table holds. */
async function columnsOf(db: StatsDb, table: string): Promise<Set<string>> {
  const rows = await db.all<{ c: string }>(
    `SELECT column_name AS c FROM duckdb_columns() WHERE schema_name = 'main' AND table_name = ?`,
    [table]
  )
  return new Set(rows.map((r) => r.c))
}

/**
 * The season tables, one for every league: the shared sums, and a recipe's own columns where its game
 * tables hold them (the college leagues' stats.ncaa.org splits), so the NBA's and the WNBA's are as
 * they were.
 */
export async function buildSeasonTables(db: StatsDb): Promise<void> {
  const player = await columnsOf(db, 'player_game')
  const team = await columnsOf(db, 'team_game')
  await db.exec(playerSeason([...PLAYER_SUMS, ...EXTRA_PLAYER_SUMS.filter((c) => player.has(c))]))
  await db.exec(teamSeason([...TEAM_SUMS, ...EXTRA_TEAM_SUMS.filter((c) => team.has(c))]))
}
