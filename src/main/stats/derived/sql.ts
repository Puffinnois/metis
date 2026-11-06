import type { StatsDb } from '../db'

/**
 * What the database holds when a rebuild starts. Sources load independently and a source can drop a
 * column: what is missing reads as NULL instead of failing the rebuild.
 */
export interface Have {
  tables: Set<string>
  columns: Map<string, Set<string>>
}

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
