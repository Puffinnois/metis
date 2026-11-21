import type { StatsDb } from '../db'

/**
 * What the database holds when a rebuild starts. Sources load independently and a source can drop a
 * column: what is missing reads as NULL instead of failing the rebuild.
 */
export interface Have {
  tables: Set<string>
  columns: Map<string, Set<string>>
}

/**
 * The most common non-NULL value of a group, the smallest on a tie, as SQL. DuckDB's `mode()` keeps
 * whichever tied value it meets first, so two builds of the same rows could differ (T1302.9).
 */
export const modeSql = (x: string): string =>
  `(list_sort(list_transform(map_entries(histogram(${x})), e -> {'n': -e.value, 'k': e.key}))[1]).k`

/**
 * Of several `ncaa_player_ids` rows for one stats.ncaa.org player or name, the player: an ESPN athlete
 * before D28's negative key, then the row with more lines, then the larger id, so the same rows always
 * give the same player (T1302.9). `p` is the table's alias with its dot; `of` the column taken.
 */
export const bestPlayerSql = (p = '', of = 'player_id'): string =>
  `arg_max(${p}${of}, (${p}player_id > 0, ${p}lines, ${p}player_id${of === 'player_id' ? '' : `, ${p}${of}`}))`

/** The tables and their columns. */
export async function inspect(db: StatsDb): Promise<Have> {
  const rows = await db.all<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM duckdb_columns() WHERE schema_name = 'main'"
  )
  const columns = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = columns.get(r.table_name) ?? new Set<string>()
    set.add(r.column_name)
    columns.set(r.table_name, set)
  }
  return { tables: new Set(columns.keys()), columns }
}

/** `alias.column` as `type`, or a typed NULL when the table or the column is not there. */
export function column(
  have: Have,
  table: string,
  alias: string,
  name: string,
  type = 'INTEGER'
): string {
  return have.columns.get(table)?.has(name)
    ? `TRY_CAST(${alias}.${name} AS ${type})`
    : `NULL::${type}`
}

/** `{a} / {b}` in SQL, NULL when the denominator is 0: DuckDB would divide to Infinity. */
export const per = (a: string, b: string): string => `(${a}) / nullif(${b}, 0)`

/** A season type, as either spelling the sources use, in the one set (D12). */
export const gameType = (seasonType: string): string =>
  `CASE lower(replace(${seasonType}, ' ', '-'))
     WHEN 'regular-season' THEN 'regular' WHEN 'playoffs' THEN 'playoffs' END`
