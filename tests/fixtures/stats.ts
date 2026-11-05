import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sqlString, StatsDb } from '@main/stats/db'
import { bootstrapStatsDb } from '@main/stats/schema'

/** An in-memory stats database with the bookkeeping tables. */
export async function openTestDb(): Promise<StatsDb> {
  const db = await StatsDb.open(':memory:')
  await bootstrapStatsDb(db, new Date())
  return db
}

export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'metis-stats-'))
}

/** Writes the rows of `select` to a Parquet file, in a source file's shape; returns its path. */
export async function writeFixture(
  db: StatsDb,
  dir: string,
  name: string,
  select: string
): Promise<string> {
  const path = join(dir, name)
  await db.exec(`COPY (${select}) TO ${sqlString(path)} (FORMAT parquet)`)
  return path
}
