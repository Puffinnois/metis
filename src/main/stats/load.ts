import { sqlIdent, sqlString, type StatsDb } from './db'
import type { SourceFile } from './sources'

/** A file's (or select's) columns and their DuckDB types, in order. */
export type Columns = Map<string, string>

export async function describe(db: StatsDb, select: string): Promise<Columns> {
  const rows = await db.all<{ column_name: string; column_type: string }>(`DESCRIBE ${select}`)
  return new Map(rows.map((r) => [r.column_name, r.column_type]))
}

/**
 * `SELECT *` over `from` with the standard columns: an expression replaces the file's column of that
 * name when it has one, and is added otherwise, so a file without a column still gives one.
 */
export function standardSelect(
  from: string,
  have: Columns,
  standard: Record<string, string>
): string {
  const replaced = Object.entries(standard).filter(([c]) => have.has(c))
  const added = Object.entries(standard).filter(([c]) => !have.has(c))
  const star =
    replaced.length > 0
      ? `SELECT * REPLACE (${replaced.map(([c, e]) => `${e} AS ${sqlIdent(c)}`).join(', ')})`
      : 'SELECT *'
  return `${star}${added.map(([c, e]) => `, ${e} AS ${sqlIdent(c)}`).join('')} FROM ${from}`
}

const INTEGER = /^(TINYINT|SMALLINT|INTEGER|BIGINT|UTINYINT|USMALLINT|UINTEGER)$/
const NUMERIC =
  /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|FLOAT|DOUBLE|DECIMAL\(\d+,\d+\))$/

/**
 * The type a column takes when two seasons disagree: BIGINT for two integer types (an id stays
 * whole), DOUBLE for other numbers, else text.
 */
export function widerType(a: string, b: string): string {
  if (INTEGER.test(a) && INTEGER.test(b)) return 'BIGINT'
  return NUMERIC.test(a) && NUMERIC.test(b) ? 'DOUBLE' : 'VARCHAR'
}

async function tableColumns(db: StatsDb, table: string): Promise<Columns | null> {
  const rows = await db.all<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM duckdb_columns()
     WHERE table_name = ? AND schema_name = 'main' AND NOT internal ORDER BY column_index`,
    [table]
  )
  return rows.length === 0 ? null : new Map(rows.map((r) => [r.column_name, r.data_type]))
}

/** A type DuckDB can store: an all-NULL column has type "NULL", stored as text. */
const storable = (type: string): string => (type === '"NULL"' || type === 'NULL' ? 'VARCHAR' : type)

/**
 * Brings `table`'s columns up to `incoming`: creates the table, adds missing columns, and widens a
 * column whose type changed between seasons. Returns the widenings, for the step's message.
 */
export async function evolveTable(
  db: StatsDb,
  table: string,
  incoming: Columns
): Promise<string[]> {
  const current = await tableColumns(db, table)
  if (current === null) {
    const cols = [...incoming].map(([c, t]) => `${sqlIdent(c)} ${storable(t)}`)
    await db.exec(`CREATE TABLE ${sqlIdent(table)} (${cols.join(', ')})`)
    return []
  }
  const widened: string[] = []
  for (const [column, type] of incoming) {
    const have = current.get(column)
    if (have === undefined) {
      await db.exec(
        `ALTER TABLE ${sqlIdent(table)} ADD COLUMN ${sqlIdent(column)} ${storable(type)}`
      )
    } else if (have !== type && storable(type) === type) {
      // An all-NULL column fits any column; anything else may need a wider one.
      const wider = widerType(have, type)
      if (wider === have) continue
      await db.exec(`ALTER TABLE ${sqlIdent(table)} ALTER ${sqlIdent(column)} TYPE ${wider}`)
      widened.push(`${column} ${have} → ${wider}`)
    }
  }
  return widened
}

/** Which rows of a table one file holds. A null `fileSeason`: the file holds the whole table. */
export interface RowScope {
  fileSeason: number | null
  sourceFile?: string
}

function scopeSql({ fileSeason, sourceFile }: RowScope): string {
  if (fileSeason === null) return ''
  const file = sourceFile === undefined ? '' : ` AND source_file = ${sqlString(sourceFile)}`
  return ` WHERE file_season = ${fileSeason}${file}`
}

export interface Replaced {
  rows: number
  /** Columns whose type was widened to fit this load. */
  widened: string[]
}

/** Replaces the scope's rows with those of `select`, in one transaction: a failed load keeps the old ones. */
export async function replaceRows(
  db: StatsDb,
  table: string,
  scope: RowScope,
  select: string
): Promise<Replaced> {
  const widened = await evolveTable(db, table, await describe(db, select))
  const where = scopeSql(scope)
  await db.transaction(async () => {
    await db.exec(`DELETE FROM ${sqlIdent(table)}${where}`)
    await db.exec(`INSERT INTO ${sqlIdent(table)} BY NAME ${select}`)
  })
  const counted = await db.get<{ n: number }>(
    `SELECT count(*) AS n FROM ${sqlIdent(table)}${where}`
  )
  return { rows: counted?.n ?? 0, widened }
}

export interface LoadedFile {
  rows: number
  notes: string[]
}

/**
 * Loads one downloaded file: every column as published and typed (data policy), and `season` as an
 * INTEGER. A season file's rows also carry `file_season`, the label in its name, which is what a
 * reload replaces. `season` is not overwritten by it: ESPN's 2000 files hold 450 games of 1998-99,
 * rightly marked 1999. Rows of a shared table carry `source_file`. Season types and team codes stay
 * as published; they are mapped in the `game` and `team` tables, so a correction to a mapping never
 * means downloading the files again (D27).
 */
export async function loadSourceFile(
  db: StatsDb,
  source: SourceFile,
  season: number,
  path: string
): Promise<LoadedFile> {
  const from = `read_parquet(${sqlString(path)})`
  const columns = await describe(db, `SELECT * FROM ${from}`)
  const notes: string[] = []
  const standard: Record<string, string> = {}
  const published = columns.get('season')
  if (published !== undefined && published !== 'INTEGER') {
    standard.season = 'TRY_CAST(season AS INTEGER)'
  }
  if (!source.allSeasons) {
    standard.file_season = `${season}::INTEGER`
    if (published === undefined) {
      standard.season = `${season}::INTEGER`
    } else {
      const off = await db.get<{ n: number }>(
        `SELECT count(*) AS n FROM ${from}
         WHERE season IS NOT NULL AND TRY_CAST(season AS INTEGER) IS DISTINCT FROM ${season}`
      )
      if (off && off.n > 0) notes.push(`season differs from the file's label on ${off.n} rows`)
    }
  }
  if (source.shared) standard.source_file = sqlString(source.stem)
  const scope: RowScope = source.allSeasons
    ? { fileSeason: null }
    : { fileSeason: season, sourceFile: source.shared ? source.stem : undefined }
  const select = standardSelect(from, columns, standard)
  const main = await replaceRows(db, source.table, scope, select)
  return { rows: main.rows, notes: [...notes, ...main.widened.map((w) => `widened ${w}`)] }
}
