import {
  DEFAULT_LEAGUE,
  type DerivedRecipeName,
  type League,
  leagueOf,
  recipeOf
} from '@shared/leagues'
import type { StatsDb } from '../db'
import { buildGameTables, NBA_DERIVED, type DerivedRecipe } from './game'
import { COLLEGE_DERIVED } from './gameCollege'
import { WNBA_DERIVED } from './gameWnba'
import { buildSeasonTables } from './season'
import { inspect } from './sql'

/** Every recipe, by the name a league's registry entry gives (`League.derived`). */
export const DERIVED_RECIPES: Readonly<Record<DerivedRecipeName, DerivedRecipe>> = {
  nba: NBA_DERIVED,
  wnba: WNBA_DERIVED,
  college: COLLEGE_DERIVED
}

/** The NBA recipe's version; each recipe keeps its own, so changing one never rebuilds another. */
export const DERIVED_VERSION = NBA_DERIVED.version

/**
 * Without the identity tables and a box score there is nothing to build from. Every recipe's needs
 * together: whatever the league, these tables' releases can never be left out of a build (`leftOut.ts`).
 */
export const DERIVED_NEEDS = [...new Set(Object.values(DERIVED_RECIPES).flatMap((r) => r.needs))]

// A script or test that names no league builds the NBA's, the league every file was before leagues.
const NBA = leagueOf(DEFAULT_LEAGUE)

/** The recipe a league's registry entry names. */
export const derivedRecipe = (league: League): DerivedRecipe =>
  DERIVED_RECIPES[recipeOf(league, 'derived')]

export async function canDerive(db: StatsDb, league: League = NBA): Promise<boolean> {
  const needs = derivedRecipe(league).needs
  const row = await db.get<{ n: number }>(
    `SELECT count(*) AS n FROM duckdb_tables()
     WHERE schema_name = 'main' AND table_name IN (${needs.map((t) => `'${t}'`).join(', ')})`
  )
  return row?.n === needs.length
}

export async function derivedStale(db: StatsDb, league: League = NBA): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'derived'"
  )
  return (row?.version ?? 0) < derivedRecipe(league).version
}

/** The tables `narrowCounts` rewrites. */
export const NARROWED = ['player_game', 'team_game', 'player_season', 'team_season'] as const

/**
 * Rewrites the game and season tables with their 128-bit integer columns (what DuckDB's `sum()`
 * gives) as BIGINT, in the same row order. The values are the same: a season's counts are far below
 * BIGINT's limit, and a sum over BIGINT is again 128-bit, so no query reads a different number. A
 * board reads the 128-bit integers some 40 times slower: about 40 ms a column over a college season
 * table's 126,000 rows, against 1 ms. Each table replaces the old one in its own statement.
 */
export async function narrowCounts(db: StatsDb): Promise<void> {
  for (const table of NARROWED) {
    const wide = await db.all<{ c: string }>(
      `SELECT column_name AS c FROM duckdb_columns()
       WHERE schema_name = 'main' AND table_name = ? AND data_type = 'HUGEINT' ORDER BY column_index`,
      [table]
    )
    if (wide.length === 0) continue
    const cast = wide.map((r) => `${r.c}::BIGINT AS ${r.c}`).join(', ')
    await db.exec(
      `CREATE OR REPLACE TABLE ${table} AS SELECT * REPLACE (${cast}) FROM ${table} ORDER BY rowid`
    )
  }
}

/** Marks the tables out of date, so a build the app never got to still happens on the next refresh. */
export async function markDerivedStale(db: StatsDb): Promise<void> {
  await db.exec("INSERT OR REPLACE INTO derived_state VALUES ('derived', 0)")
}

/**
 * Builds the game tables with the league's recipe, then the season tables from them, which are one
 * for every league. Each table replaces the old one in its own statement, so a screen reading it sees
 * the old rows or the new ones. Returns the player lines.
 */
export async function buildDerived(db: StatsDb, league: League = NBA): Promise<number> {
  const recipe = derivedRecipe(league)
  const lines = await buildGameTables(db, await inspect(db), recipe, league)
  await buildSeasonTables(db)
  if (recipe.narrowCounts) await narrowCounts(db)
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', ['derived', recipe.version])
  return lines
}
