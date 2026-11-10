import type { StatsDb } from '../db'
import { PUBLISHED_TABLES, type PublishedColumn, type PublishedTable } from './publishedTables'
import { column, inspect, type Have } from './sql'
import { TOKEN } from '@shared/stats/catalogue'

/** Bump when a table changes, so the next refresh builds them without downloading anything. */
export const PUBLISHED_VERSION = 4

/** What the engine divides a published sum by. A table always has these, NULL when not published. */
export const PUBLISHED_DIVISORS = ['games', 'minutes', 'possessions'] as const

export const publishedTable = (name: string): PublishedTable | undefined =>
  PUBLISHED_TABLES.find((t) => t.table === name)

const nameOf = (c: string | PublishedColumn): string => (typeof c === 'string' ? c : c.name)

/** The components a published table holds. */
export const publishedComponents = (t: PublishedTable): string[] => [
  ...PUBLISHED_DIVISORS,
  ...t.columns.map(nameOf)
]

const keyOf = (t: PublishedTable): string => (t.entity === 'player' ? 'player_id' : 'team_id')

/**
 * The tables, empty, for whatever a build has not reached. Created on every open: the first load
 * reads them from the core tier on, before the published tier has arrived, and a query must get a
 * null with a reason there, not a missing table.
 */
export function publishedBootstrap(): string[] {
  return PUBLISHED_TABLES.flatMap((t) => [
    `CREATE TABLE IF NOT EXISTS ${t.table} (
       ${keyOf(t)} BIGINT, season INTEGER, game_type VARCHAR,
       ${publishedComponents(t)
         .map((c) => `${c} DOUBLE`)
         .join(', ')})`,
    ...publishedComponents(t).map(
      (c) => `ALTER TABLE ${t.table} ADD COLUMN IF NOT EXISTS ${c} DOUBLE`
    )
  ])
}

/** A season type, as either spelling the sources use, in the one set (D12). */
const gameType = (seasonType: string): string =>
  `CASE lower(replace(${seasonType}, ' ', '-'))
     WHEN 'regular-season' THEN 'regular' WHEN 'playoffs' THEN 'playoffs' END`

/**
 * One table, from the source's rows of totals. The per-game files are not simply totals over games
 * (`nba-data-sources.md`), and a total can be added across seasons. What is missing reads as NULL.
 */
function buildSql(t: PublishedTable, have: Have): string {
  const held = have.columns.get(t.source)
  const one = (name: string): string => column(have, t.source, 's', name, 'DOUBLE')
  // A bare name is the source's column; anything else is worked out from `{column}`s.
  const read = (sql: string | null | undefined): string =>
    !sql
      ? 'NULL::DOUBLE'
      : sql.includes('{')
        ? `(${sql.replace(TOKEN, (_, c: string) => one(c))})`
        : one(sql)
  const season = column(have, t.source, 's', 'season')
  const type = gameType(column(have, t.source, 's', 'season_type', 'VARCHAR'))
  const where = [`${type} IS NOT NULL`]
  if (held?.has('per_mode')) where.push("lower(s.per_mode) = 'totals'")
  if (t.firstSeason !== undefined) where.push(`${season} >= ${t.firstSeason}`)
  const columns = [
    `${read(t.games)} AS games`,
    `${read(t.minutes)} AS minutes`,
    `${read(t.possessions)} AS possessions`,
    ...t.columns.map((c) => `${read(typeof c === 'string' ? c : c.sql)} AS ${nameOf(c)}`)
  ]
  return `CREATE OR REPLACE TABLE ${t.table} AS
    SELECT ${column(have, t.source, 's', keyOf(t), 'BIGINT')} AS ${keyOf(t)},
           ${season} AS season, ${type} AS game_type, ${columns.join(', ')}
    FROM ${held ? t.source : '(SELECT 1)'} s
    WHERE ${where.join(' AND ')}`
}

/** With no table to build, there is no step to log. */
export function canBuildPublished(): boolean {
  return PUBLISHED_TABLES.length > 0
}

export async function publishedStale(db: StatsDb): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'published'"
  )
  return (row?.version ?? 0) < PUBLISHED_VERSION
}

/** Marks the tables out of date, so a build the app never got to still happens on the next refresh. */
export async function markPublishedStale(db: StatsDb): Promise<void> {
  await db.exec("INSERT OR REPLACE INTO derived_state VALUES ('published', 0)")
}

/**
 * Builds every published table. They read only their own sources, so this needs nothing else to be
 * loaded. Each replaces the old one in its own statement, so a screen sees the old rows or the new.
 * Returns the rows written.
 */
export async function buildPublished(db: StatsDb): Promise<number> {
  const have = await inspect(db)
  let rows = 0
  for (const t of PUBLISHED_TABLES) {
    await db.exec(buildSql(t, have))
    const row = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${t.table}`)
    rows += row?.n ?? 0
  }
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', [
    'published',
    PUBLISHED_VERSION
  ])
  return rows
}
