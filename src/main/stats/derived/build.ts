import type { StatsDb } from '../db'
import { buildGameTables } from './game'
import { buildSeasonTables } from './season'
import { inspect } from './sql'

/** Bump when these tables change, so the next refresh builds them without downloading anything. */
export const DERIVED_VERSION = 1

/** Without the identity tables and one box score there is nothing to build from. */
const NEEDS = ['game', 'team', 'player_ids', 'src_espn_player_box', 'src_nba_player_box']

export async function canDerive(db: StatsDb): Promise<boolean> {
  const row = await db.get<{ n: number }>(
    `SELECT count(*) AS n FROM duckdb_tables()
     WHERE schema_name = 'main' AND table_name IN (${NEEDS.map((t) => `'${t}'`).join(', ')})`
  )
  return row?.n === NEEDS.length
}

export async function derivedStale(db: StatsDb): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'derived'"
  )
  return (row?.version ?? 0) < DERIVED_VERSION
}

/** Marks the tables out of date, so a build the app never got to still happens on the next refresh. */
export async function markDerivedStale(db: StatsDb): Promise<void> {
  await db.exec("INSERT OR REPLACE INTO derived_state VALUES ('derived', 0)")
}

/**
 * Builds the game tables, then the season tables from them. Each table replaces the old one in its
 * own statement, so a screen reading it sees the old rows or the new ones. Returns the player lines.
 */
export async function buildDerived(db: StatsDb): Promise<number> {
  const lines = await buildGameTables(db, await inspect(db))
  await buildSeasonTables(db)
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', ['derived', DERIVED_VERSION])
  return lines
}
