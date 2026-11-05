import { StatsDb } from '@main/stats/db'
import { bootstrapStatsDb } from '@main/stats/schema'

/** An in-memory stats database with the bookkeeping tables. */
export async function openTestDb(): Promise<StatsDb> {
  const db = await StatsDb.open(':memory:')
  await bootstrapStatsDb(db, new Date())
  return db
}
