import type { StatsDb } from '../db'
import { PUBLISHED_TABLES, type PublishedColumn, type PublishedTable } from './publishedTables'
import { column, gameType, inspect, type Have } from './sql'
import { LINEUPS, lineupsBootstrap, lineupsSql } from './lineups'
import { MATCHUP_PAIRS, matchupPairsBootstrap, matchupPairsSql } from './matchupPairs'
import { GAME_MATCHUPS, gameMatchupsBootstrap, gameMatchupsSql } from './gameMatchups'

/** Bump when a table changes, so the next refresh builds them without downloading anything. */
export const PUBLISHED_VERSION = 11

/**
 * Sources of a later tier that a table here reads: the game matchups are in the events tier, which
 * loads after this step has run, so a refresh that writes them builds the tables again at its end.
 */
export const PUBLISHED_LATE_SOURCES: readonly string[] = ['src_nba_game_matchups']

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
  return [
    ...matchupPairsBootstrap(),
    ...gameMatchupsBootstrap(),
    ...lineupsBootstrap(),
    ...PUBLISHED_TABLES.flatMap((t) => [
      `CREATE TABLE IF NOT EXISTS ${t.table} (
       ${keyOf(t)} BIGINT, season INTEGER, game_type VARCHAR,
       ${publishedComponents(t)
         .map((c) => `${c} DOUBLE`)
         .join(', ')})`,
      ...publishedComponents(t).map(
        (c) => `ALTER TABLE ${t.table} ADD COLUMN IF NOT EXISTS ${c} DOUBLE`
      )
    ])
  ]
}

/** A source's column in a worked-out component: `{min}` as a number, `{min:text}` as published. */
const SOURCE_TOKEN = /\{([a-z0-9_]+)(:text)?\}/g

/** Where a source's rows of totals come from, and which of them to read. */
interface Rows {
  source: string
  match?: Readonly<Record<string, string>>
  firstSeason?: number
  /** A column already holding the season type in the one set (D12), as the built tables do. */
  typeColumn?: string
  /** Only these season types. */
  types?: readonly string[]
}

/** The pieces of a SELECT over one source's rows of totals: what to read, and how. */
function rowsOf(
  r: Rows,
  have: Have
): {
  source: string
  read: (sql: string | null | undefined) => string
  season: string
  type: string
  from: string
  where: string[]
} {
  const held = have.columns.get(r.source)
  // A bare name is the source's column; anything else is worked out from `{column}`s.
  const read = (sql: string | null | undefined): string =>
    !sql
      ? 'NULL::DOUBLE'
      : sql.includes('{')
        ? `(${sql.replace(SOURCE_TOKEN, (_, c: string, text?: string) =>
            column(have, r.source, 's', c, text ? 'VARCHAR' : 'DOUBLE')
          )})`
        : column(have, r.source, 's', sql, 'DOUBLE')
  const season = column(have, r.source, 's', 'season')
  const type = r.typeColumn
    ? column(have, r.source, 's', r.typeColumn, 'VARCHAR')
    : gameType(column(have, r.source, 's', 'season_type', 'VARCHAR'))
  const where = [`${type} IS NOT NULL`]
  if (r.types) where.push(`${type} IN (${r.types.map((x) => `'${x}'`).join(', ')})`)
  if (held?.has('per_mode')) where.push("lower(s.per_mode) = 'totals'")
  if (r.firstSeason !== undefined) where.push(`${season} >= ${r.firstSeason}`)
  for (const [name, value] of Object.entries(r.match ?? {})) {
    where.push(
      `lower(${column(have, r.source, 's', name, 'VARCHAR')}) = '${value.toLowerCase().replaceAll("'", "''")}'`
    )
  }
  return { source: r.source, read, season, type, from: held ? r.source : '(SELECT 1)', where }
}

/**
 * One table, from the source's rows of totals. The per-game files are not simply totals over games
 * (`nba-data-sources.md`), and a total can be added across seasons. What is missing reads as NULL.
 */
function buildSql(t: PublishedTable, have: Have): string {
  if (t.sql) return t.sql(have)
  const key = keyOf(t)
  const main = rowsOf(t, have)
  const reps = t.replacedBy ? [t.replacedBy].flat() : []
  const named = [
    { name: 'games', sql: t.games },
    { name: 'minutes', sql: t.minutes },
    { name: 'possessions', sql: t.possessions },
    ...t.columns.map((c) => ({ name: nameOf(c), sql: typeof c === 'string' ? c : c.sql }))
  ]
  // Where a replacement holds the season and type, this source's values of what it takes over are
  // left out; its rows still give the rest.
  const mine = (name: string, sql: string | null | undefined): string => {
    const held = reps.flatMap((r, i) => (name in r.columns ? [`c${i}.season IS NULL`] : []))
    return held.length
      ? `CASE WHEN ${held.join(' AND ')} THEN ${main.read(sql)} END`
      : main.read(sql)
  }
  const select = (
    rows: ReturnType<typeof rowsOf>,
    keyColumn: string,
    value: (name: string, sql: string | null | undefined) => string,
    join = ''
  ): string => `
    SELECT ${column(have, rows.source, 's', keyColumn, 'BIGINT')} AS ${key},
           ${rows.season} AS season, ${rows.type} AS game_type,
           ${named.map((n) => `${value(n.name, n.sql)} AS ${n.name}`).join(', ')}
    FROM ${rows.from} s ${join}
    WHERE ${rows.where.join(' AND ')}`
  if (reps.length === 0) {
    return `CREATE OR REPLACE TABLE ${t.table} AS ${select(main, t.key ?? key, (_, sql) => main.read(sql))}`
  }
  const others = reps.map((r) =>
    rowsOf(
      { source: r.source, firstSeason: t.firstSeason, typeColumn: r.typeColumn, types: r.types },
      have
    )
  )
  // A replacement's rows are added up per player or team first: the engine would add them anyway,
  // and the pair file has hundreds of rows for each defender.
  return `CREATE OR REPLACE TABLE ${t.table} AS
    WITH ${others
      .map(
        (o, i) => `c${i} AS (SELECT DISTINCT ${o.season} AS season, ${o.type} AS game_type
               FROM ${o.from} s WHERE ${o.where.join(' AND ')})`
      )
      .join(',\n')}
    ${select(
      main,
      t.key ?? key,
      mine,
      others
        .map(
          (_, i) =>
            `LEFT JOIN c${i} ON c${i}.season = ${main.season} AND c${i}.game_type = ${main.type}`
        )
        .join(' ')
    )}
    ${reps
      .map(
        (r, i) => `UNION ALL
    SELECT ${key}, season, game_type, ${named.map((n) => `sum(${n.name}) AS ${n.name}`).join(', ')}
    FROM (${select(others[i], r.key ?? key, (name) => others[i].read(r.columns[name]))})
    GROUP BY ${key}, season, game_type`
      )
      .join('\n')}`
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
  // First: the defenders' playoff matchups add it up.
  await db.exec(gameMatchupsSql(have))
  const matchups = await db.get<{ n: number }>(
    `SELECT count(*)::INTEGER AS n FROM ${GAME_MATCHUPS}`
  )
  rows += matchups?.n ?? 0
  for (const t of PUBLISHED_TABLES) {
    await db.exec(buildSql(t, have))
    const row = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${t.table}`)
    rows += row?.n ?? 0
  }
  await db.exec(matchupPairsSql(have))
  const pairs = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${MATCHUP_PAIRS}`)
  rows += pairs?.n ?? 0
  await db.exec(lineupsSql(have))
  const units = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${LINEUPS}`)
  rows += units?.n ?? 0
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', [
    'published',
    PUBLISHED_VERSION
  ])
  return rows
}
