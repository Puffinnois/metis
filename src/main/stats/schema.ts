import type { StatsDb } from './db'
import { playsBootstrap } from './derived/plays'
import { publishedBootstrap } from './derived/published'
import { playDetailBootstrap } from './derived/playDetail'
import { shotsBootstrap } from './derived/shots'
import { splitsBootstrap } from './derived/splits'

/**
 * Created on every open, so a new version replaces them. The tables keep their rows across
 * versions: `sync_log` is the stats steps' own log (status adds `interrupted`), `source_state`
 * what each source holds per season (season 0 = an all-seasons file), `derived_state` and
 * `stats_settings` the derived layer's version and settings.
 */
const BOOTSTRAP = [
  'CREATE SEQUENCE IF NOT EXISTS sync_log_id',
  `CREATE TABLE IF NOT EXISTS sync_log (
     id BIGINT PRIMARY KEY DEFAULT nextval('sync_log_id'),
     source VARCHAR NOT NULL,
     started_at VARCHAR NOT NULL,
     finished_at VARCHAR,
     status VARCHAR NOT NULL,
     message VARCHAR,
     rows_written BIGINT NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS source_state (
     source VARCHAR NOT NULL,
     season INTEGER NOT NULL,
     version INTEGER NOT NULL,
     rows_written BIGINT NOT NULL,
     fetched_at VARCHAR NOT NULL,
     sealed BOOLEAN NOT NULL,
     PRIMARY KEY (source, season)
   )`,
  'ALTER TABLE source_state ADD COLUMN IF NOT EXISTS etag VARCHAR',
  'ALTER TABLE source_state ADD COLUMN IF NOT EXISTS bytes BIGINT',
  'CREATE TABLE IF NOT EXISTS derived_state (name VARCHAR PRIMARY KEY, version INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS stats_settings (key VARCHAR PRIMARY KEY, value VARCHAR)'
]

export const INTERRUPTED_MESSAGE = 'The app closed during this step'

/**
 * Creates the bookkeeping tables, then marks steps a closed app left `running` as `interrupted`.
 * Returns how many rows it marked.
 */
export async function bootstrapStatsDb(db: StatsDb, now: Date): Promise<number> {
  for (const sql of [
    ...BOOTSTRAP,
    ...publishedBootstrap(),
    ...playsBootstrap(),
    ...shotsBootstrap(),
    ...splitsBootstrap(),
    ...playDetailBootstrap()
  ]) {
    await db.exec(sql)
  }
  const stale = await db.get<{ n: number }>(
    "SELECT count(*) AS n FROM sync_log WHERE status = 'running'"
  )
  await db.exec(
    "UPDATE sync_log SET status = 'interrupted', finished_at = ?, message = ? WHERE status = 'running'",
    [now.toISOString(), INTERRUPTED_MESSAGE]
  )
  return stale?.n ?? 0
}
