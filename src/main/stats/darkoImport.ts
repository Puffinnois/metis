import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { StatsImportedFile } from '@shared/stats/types'
import { sqlString, type StatsDb } from './db'
import { describe, replaceRows } from './load'

/**
 * DARKO imported by hand (D55): the boards the owner downloads from darko.app and drops in the folder
 * their private setting names (`privateSources.ts`). Nothing is ever requested from darko.app: these
 * are the owner's own files, read where they lie.
 *
 * - **Kept as published:** every column of every file, typed from every row, in `src_darko`, with the
 *   file's name (`source_file`), its snapshot's date (`snapshot_date`) and where that date came from
 *   (`date_from`). NBA ids as they come.
 * - **A snapshot per file,** never overwritten by the next. A file read again under the same name
 *   with other bytes replaces its own rows only; the same bytes under another name count once.
 * - **Its date:** a `date` (or `as_of`) column in the file, which makes a file of many dates many
 *   snapshots (a history); else a YYYY-MM-DD in its name; else its modified time. A file whose date
 *   cannot be told apart from another file's is refused with the reason, never guessed.
 *
 * What was imported, refused or counted once is kept in `darko_imports`, which the Data panel lists.
 */
export const DARKO_TABLE = 'src_darko'
export const DARKO_IMPORTS = 'darko_imports'
export const DARKO_STEP = 'stats:darko'
/** As the Data panel names the private source. */
export const DARKO_LABEL = 'DARKO, imported by hand (private to this copy)'

/** The columns a file's date is read from, in order. */
const DATE_COLUMNS = ['date', 'as_of'] as const

const IMPORTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ${DARKO_IMPORTS} (
  file VARCHAR PRIMARY KEY, hash VARCHAR, bytes BIGINT, snapshot_date VARCHAR, last_date VARCHAR,
  date_from VARCHAR, dates INTEGER, rows BIGINT, status VARCHAR, reason VARCHAR, imported_at VARCHAR)`

export interface DarkoImported {
  /** Rows written this time: 0 when nothing new came in. */
  rows: number
  files: StatsImportedFile[]
}

interface Record_ {
  file: string
  hash: string | null
  snapshot_date: string | null
  last_date: string | null
  date_from: StatsImportedFile['dateFrom']
  dates: number
  rows: number
  status: StatsImportedFile['status']
  reason: string | null
  imported_at: string
}

const toFile = (r: Record_): StatsImportedFile => ({
  file: r.file,
  date: r.snapshot_date,
  lastDate: r.last_date,
  dateFrom: r.date_from,
  dates: Number(r.dates ?? 0),
  rows: Number(r.rows ?? 0),
  status: r.status,
  reason: r.reason,
  importedAt: r.imported_at
})

/** The local day of a time, YYYY-MM-DD. */
const localDay = (ms: number): string => {
  const d = new Date(ms)
  const two = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** The files the folder holds, by name: CSVs only, hidden files left alone. */
export function darkoFiles(folder: string): string[] {
  if (!existsSync(folder)) return []
  return readdirSync(folder)
    .filter((f) => /\.csv$/i.test(f) && !f.startsWith('.'))
    .sort()
}

/** What the imports table holds, by file name. */
export async function readDarkoImports(db: StatsDb): Promise<StatsImportedFile[]> {
  const held = await db.get(
    "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
    [DARKO_IMPORTS]
  )
  if (!held) return []
  const rows = await db.all<Record_>(`SELECT * FROM ${DARKO_IMPORTS} ORDER BY file`)
  return rows.map(toFile)
}

async function save(db: StatsDb, r: Record_): Promise<void> {
  await db.exec(
    `INSERT OR REPLACE INTO ${DARKO_IMPORTS}
       (file, hash, bytes, snapshot_date, last_date, date_from, dates, rows, status, reason, imported_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.file,
      r.hash,
      r.snapshot_date,
      r.last_date,
      r.date_from,
      r.dates,
      r.rows,
      r.status,
      r.reason,
      r.imported_at
    ]
  )
}

/** The dates each kept file holds, from the snapshots themselves. */
async function keptDates(db: StatsDb): Promise<Map<string, string>> {
  const held = await db.get(
    "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
    [DARKO_TABLE]
  )
  if (!held) return new Map()
  const rows = await db.all<{ day: string; file: string }>(
    `SELECT DISTINCT strftime(snapshot_date, '%Y-%m-%d') AS day, source_file AS file FROM ${DARKO_TABLE}
     WHERE snapshot_date IS NOT NULL`
  )
  return new Map(rows.map((r) => [r.day, r.file]))
}

/**
 * Reads every new or changed file of the folder into `src_darko`. Never throws for a bad file: it is
 * recorded as refused with the reason, and the others are read.
 */
export async function importDarko(
  db: StatsDb,
  folder: string,
  now: Date = new Date()
): Promise<DarkoImported> {
  await db.exec(IMPORTS_TABLE_SQL)
  const present = darkoFiles(folder)
  // A refused or repeated file the owner has since removed or renamed is no longer listed; an imported
  // one stays, as its snapshot does.
  await db.exec(
    `DELETE FROM ${DARKO_IMPORTS} WHERE status <> 'imported'
       AND file NOT IN (${present.length > 0 ? present.map(sqlString).join(', ') : 'NULL'})`
  )
  const before = new Map((await readDarkoImports(db)).map((f) => [f.file, f]))
  const hashes = new Map(
    (
      await db.all<{ file: string; hash: string }>(
        `SELECT file, hash FROM ${DARKO_IMPORTS} WHERE status = 'imported'`
      )
    ).map((r) => [r.hash, r.file])
  )
  const dates = await keptDates(db)
  let written = 0
  for (const file of present) {
    const path = join(folder, file)
    const bytes = readFileSync(path)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const record = (r: Partial<Record_>): Record_ => ({
      file,
      hash,
      snapshot_date: null,
      last_date: null,
      date_from: null,
      dates: 0,
      rows: 0,
      status: 'refused',
      reason: null,
      imported_at: now.toISOString(),
      ...r
    })
    const known = hashes.get(hash)
    // Already read, these very bytes: nothing to do.
    if (known === file) continue
    if (known !== undefined) {
      const was = before.get(known)
      await save(
        db,
        record({
          status: 'same',
          snapshot_date: was?.date ?? null,
          last_date: was?.lastDate ?? null,
          date_from: was?.dateFrom ?? null,
          dates: was?.dates ?? 0,
          reason: `The same file as ${known}, counted once.`
        })
      )
      continue
    }
    const csv = `read_csv(${sqlString(path)}, header = true, sample_size = -1)`
    let columns: Map<string, string>
    try {
      columns = await describe(db, `SELECT * FROM ${csv}`)
    } catch (err) {
      await save(
        db,
        record({ reason: `Not read: ${err instanceof Error ? err.message : String(err)}` })
      )
      continue
    }
    if (!columns.has('nba_id')) {
      await save(
        db,
        record({ reason: 'No nba_id column: not a DARKO board as darko.app writes it.' })
      )
      continue
    }
    // The snapshot's date: a column, else the name, else the modified time.
    const dateColumn = DATE_COLUMNS.find((c) => columns.has(c))
    let from: NonNullable<StatsImportedFile['dateFrom']>
    let dateSql: string
    let fileDates: string[]
    if (dateColumn) {
      from = 'column'
      dateSql = `TRY_CAST(${dateColumn} AS DATE)`
      fileDates = (
        await db.all<{ day: string | null }>(
          `SELECT DISTINCT strftime(${dateSql}, '%Y-%m-%d') AS day FROM ${csv} ORDER BY 1`
        )
      )
        .map((r) => r.day)
        .filter((d): d is string => d !== null)
    } else {
      const named = /(\d{4}-\d{2}-\d{2})/.exec(file)?.[1]
      from = named ? 'name' : 'modified'
      const day = named ?? localDay(statSync(path).mtimeMs)
      dateSql = `DATE ${sqlString(day)}`
      fileDates = [day]
    }
    const words = {
      column: `its ${dateColumn} column`,
      name: 'its name',
      modified: 'its modified time'
    }[from]
    if (fileDates.length === 0) {
      await save(db, record({ date_from: from, reason: `No date could be read from ${words}.` }))
      continue
    }
    // Another file already holds one of its dates: which is the board of that day cannot be told.
    const clash = fileDates.find((d) => {
      const other = dates.get(d)
      return other !== undefined && other !== file
    })
    if (clash !== undefined) {
      await save(
        db,
        record({
          snapshot_date: fileDates[0],
          last_date: fileDates.at(-1) ?? null,
          date_from: from,
          dates: fileDates.length,
          reason: `Taken as ${clash} from ${words}, the date ${dates.get(clash)} already holds: put the board's own date in the file's name (darko-${clash}.csv) to tell them apart.`
        })
      )
      continue
    }
    const select = `SELECT *, 0::INTEGER AS file_season, ${sqlString(file)} AS source_file,
        ${dateSql} AS snapshot_date, ${sqlString(from)} AS date_from
      FROM ${csv}`
    const out = await replaceRows(db, DARKO_TABLE, { fileSeason: 0, sourceFile: file }, select)
    written += out.rows
    for (const d of fileDates) dates.set(d, file)
    hashes.set(hash, file)
    await save(
      db,
      record({
        status: 'imported',
        snapshot_date: fileDates[0],
        last_date: fileDates.at(-1) ?? null,
        date_from: from,
        dates: fileDates.length,
        rows: out.rows
      })
    )
  }
  return { rows: written, files: await readDarkoImports(db) }
}
