import {
  DEFAULT_LEAGUE,
  type League,
  leagueOf,
  type PublishedRecipeName,
  recipeOf
} from '@shared/leagues'
import type { StatsDb } from '../db'
import {
  ADDED_ROW_COLUMNS,
  PUBLISHED_TABLES,
  type PublishedColumn,
  type PublishedTable
} from './publishedTables'
import { column, gameType, inspect, type Have } from './sql'
import { LINEUPS, lineupsBootstrap, lineupsSql } from './lineups'
import { MATCHUP_PAIRS, matchupPairsBootstrap, matchupPairsSql } from './matchupPairs'
import { GAME_MATCHUPS, gameMatchupsBootstrap, gameMatchupsSql } from './gameMatchups'

/**
 * What the published tables read differently by league, on the identity and derived recipes' pattern
 * (`League.published`). The tables, their columns and the SQL are one for every league; a recipe names
 * the league's file where it differs from the one a table names, and how a team's id in its files is
 * the team's key in `team`. A table whose file the league does not publish (tracking, hustle, play
 * types, matchups, the injury report for the WNBA) is built empty, and its metrics read the reason the
 * catalogue gives.
 */
export interface PublishedRecipe {
  /** Bumped when this league's tables change; each recipe keeps its own. */
  version: number
  /** The league's file for a table's source, where it is not the one the table names. */
  sources: Readonly<Record<string, string>>
  /** A team's id in the league's files, in the season `season` names, as its key in `team`. */
  team: (id: string, season: string) => string
  /**
   * False where the lineups tab is not the league's published dashboards: the college leagues' units
   * are built by their plays step from stats.ncaa.org's lineup file (`collegePlays.ts`).
   */
  lineups?: false
}

export const NBA_PUBLISHED: PublishedRecipe = {
  // 13: a NaN as published reads NULL (T1301.7). 14: the availability table breaks a tie between
  // two teams on one report the same way on every build (T1301.8). 15: BOBAN, and the impact file's
  // box prior and REML RAPM (T1703.2). 16: the published fantasy points (T1703.2). 17: the
  // standings' records by situation (T1703.2). 18: SportsDataverse's current impact (T1703.2).
  // 19: FiveThirtyEight's RAPTOR (D54). 20: DARKO imported by hand (D55). 21: the rolling windows
  // (T1703.2). 22: the dashboards' two-, three- and four-man groups (T1703.2).
  version: 22,
  sources: {},
  team: (id) => id
}

/**
 * The WNBA's: the league dashboards under the NBA's names (`src_dash_*`), the impact file under its
 * own, and the 2026 Portland Fire, 1611661327 in every file and `-1611661327` in `team` (T1301.5).
 */
export const WNBA_PUBLISHED: PublishedRecipe = {
  // 2: a NaN as published reads NULL. 3: BOBAN (T1703.2). 4: the published fantasy points (T1703.2).
  // 5: the standings' records by situation (T1703.2). 6: the rolling windows (T1703.2). 7: the
  // dashboards' two-, three- and four-man groups (T1703.2).
  version: 7,
  sources: {
    src_nba_impact: 'src_wnba_impact',
    src_nba_rolling_windows: 'src_wnba_rolling_windows'
  },
  team: (id, season) =>
    `(CASE WHEN EXISTS (SELECT 1 FROM team tk WHERE tk.team_id = -(${id}) AND tk.season = ${season})
           THEN -(${id}) ELSE ${id} END)`
}

/**
 * The college leagues' (D44): SportsDataverse's team ratings, box-score BPM and two RAPM fits
 * (`publishedCollege.ts`). The team files' ids are ESPN's, the teams' keys. No league dashboard is
 * published, so the lineups tab is the plays step's.
 */
export const COLLEGE_PUBLISHED: PublishedRecipe = {
  // 2: a player's rows under a type they have a line in, not always the regular season (T1302.8).
  version: 2,
  sources: {},
  team: (id) => id,
  lineups: false
}

/** Every recipe, by the name a league's registry entry gives. */
export const PUBLISHED_RECIPES: Readonly<Record<PublishedRecipeName, PublishedRecipe>> = {
  nba: NBA_PUBLISHED,
  wnba: WNBA_PUBLISHED,
  college: COLLEGE_PUBLISHED
}

// A script or test that names no league builds the NBA's, the league every file was before leagues.
const NBA = leagueOf(DEFAULT_LEAGUE)

/** The recipe a league's registry entry names. */
export const publishedRecipe = (league: League = NBA): PublishedRecipe =>
  PUBLISHED_RECIPES[recipeOf(league, 'published')]

/** The NBA recipe's version: bump a recipe's when its tables change, so the next refresh builds them. */
export const PUBLISHED_VERSION = NBA_PUBLISHED.version

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
      ),
      // A table built before it added rows reads NULL for who they are until it is built again.
      ...(t.addsRows
        ? Object.entries(ADDED_ROW_COLUMNS).map(
            ([c, type]) => `ALTER TABLE ${t.table} ADD COLUMN IF NOT EXISTS ${c} ${type}`
          )
        : [])
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
  // A number as published, but a NaN, which is no value: it reads NULL, as a value over nothing does,
  // so it never reaches a cell, a sort, a rank or a league's mean. The source keeps what it published.
  const number = (c: string): string => {
    const sql = column(have, r.source, 's', c, 'DOUBLE')
    return held?.has(c) ? `(CASE WHEN isnan(${sql}) THEN NULL ELSE ${sql} END)` : sql
  }
  // A bare name is the source's column; anything else is worked out from `{column}`s.
  const read = (sql: string | null | undefined): string =>
    !sql
      ? 'NULL::DOUBLE'
      : sql.includes('{')
        ? `(${sql.replace(SOURCE_TOKEN, (_, c: string, text?: string) =>
            text ? column(have, r.source, 's', c, 'VARCHAR') : number(c)
          )})`
        : number(sql)
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
function buildSql(t: PublishedTable, have: Have, recipe: PublishedRecipe = NBA_PUBLISHED): string {
  if (t.sql) return t.sql(have)
  const key = keyOf(t)
  // A team's id as its key in `team`, by the league's recipe; a player's id is the same in both.
  const keyed = (id: string, season: string): string =>
    t.entity === 'team' ? recipe.team(id, season) : id
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
    SELECT ${keyed(column(have, rows.source, 's', keyColumn, 'BIGINT'), rows.season)} AS ${key},
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

export async function publishedStale(db: StatsDb, league?: League): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'published'"
  )
  return (row?.version ?? 0) < publishedRecipe(league).version
}

/** A table as the league's recipe reads it: its sources under the league's own names. */
function inLeague(t: PublishedTable, recipe: PublishedRecipe): PublishedTable {
  const own = (source: string): string => recipe.sources[source] ?? source
  const reps = t.replacedBy ? [t.replacedBy].flat() : []
  if (own(t.source) === t.source && reps.every((r) => own(r.source) === r.source)) return t
  return {
    ...t,
    source: own(t.source),
    ...(t.replacedBy ? { replacedBy: reps.map((r) => ({ ...r, source: own(r.source) })) } : {})
  }
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
export async function buildPublished(db: StatsDb, league?: League): Promise<number> {
  const recipe = publishedRecipe(league)
  const have = await inspect(db)
  let rows = 0
  // First: the defenders' playoff matchups add it up.
  await db.exec(gameMatchupsSql(have))
  const matchups = await db.get<{ n: number }>(
    `SELECT count(*)::INTEGER AS n FROM ${GAME_MATCHUPS}`
  )
  rows += matchups?.n ?? 0
  for (const t of PUBLISHED_TABLES) {
    await db.exec(buildSql(inLeague(t, recipe), have, recipe))
    const row = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${t.table}`)
    rows += row?.n ?? 0
  }
  await db.exec(matchupPairsSql(have))
  const pairs = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${MATCHUP_PAIRS}`)
  rows += pairs?.n ?? 0
  if (recipe.lineups !== false) {
    await db.exec(lineupsSql(have, recipe.team, (league ?? NBA).lineupsFrom))
    const units = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${LINEUPS}`)
    rows += units?.n ?? 0
  }
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', ['published', recipe.version])
  return rows
}
