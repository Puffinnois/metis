import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { StatsStatus } from '@shared/stats/types'
import { sqlString, StatsDb, type Row } from './db'
import { createDownloads } from './download'
import type {
  RefreshOptions,
  SelfTestResult,
  StatsLogEntry,
  StatsProgress,
  StatsSyncResult,
  StatsWorkerInit
} from './protocol'
import { bootstrapStatsDb } from './schema'
import { refreshStats } from './sync'

/** The table the status line reads the latest game from. */
const LATEST_GAMES_TABLE = 'src_espn_team_box'

/** The worker's state: the open database and what a refresh needs. Runnable in-process for tests. */
export interface StatsService {
  refresh(options: RefreshOptions): Promise<StatsSyncResult>
  selfTest(): Promise<SelfTestResult>
  status(): Promise<StatsStatus>
  /** One SQL statement on its own connection, for scripts measuring a real load. */
  read(sql: string): Promise<Row[]>
  /**
   * Stops a refresh now: aborts its downloads, interrupts its statement and starts no other step. A
   * process must not exit while DuckDB runs a statement (Electron aborts), so closing cancels first.
   */
  cancel(): void
  close(): Promise<void>
}

export async function openStatsService(
  init: StatsWorkerInit,
  onStep: (entry: StatsLogEntry) => void = () => {}
): Promise<StatsService> {
  // Files a closed app left mid-step are never read again.
  rmSync(init.tempDir, { recursive: true, force: true })
  mkdirSync(init.tempDir, { recursive: true })
  const db = await StatsDb.open(init.path, {
    tempDirectory: join(init.tempDir, 'duckdb'),
    memoryLimit: init.memoryLimit
  })
  await bootstrapStatsDb(db, new Date())
  // Each read gets its own connection, so it runs while a refresh writes, never waits behind another
  // read, and its timeout interrupts only itself.
  const reading = new Set<StatsDb>()
  const inFlight = new Set<Promise<unknown>>()
  let closing = false
  const read = async <T>(fn: (conn: StatsDb) => Promise<T>): Promise<T> => {
    if (closing) throw new Error('the stats database is closing')
    const conn = await db.connect()
    reading.add(conn)
    const run = fn(conn).finally(() => {
      reading.delete(conn)
      conn.close()
    })
    inFlight.add(run)
    void run.then(
      () => inFlight.delete(run),
      () => inFlight.delete(run)
    )
    return run
  }
  const abort = new AbortController()
  let cancelled = false
  let busy = false
  let progress: StatsProgress | null = null
  /** Set once DuckDB invalidates the database: nothing more can be read until the next launch. */
  let invalidated = false
  const downloads = createDownloads({ dir: init.tempDir, signal: abort.signal })
  return {
    async refresh(options) {
      busy = true
      try {
        const result = await refreshStats(
          {
            db,
            downloads,
            onStep,
            onProgress: (p) => {
              progress = p
            },
            cancelled: () => cancelled
          },
          options
        )
        if (result.fatal !== undefined) invalidated = true
        return result
      } finally {
        busy = false
        progress = null
      }
    },
    status: async () => {
      if (invalidated) {
        return { available: false, through: null, updatedAt: null, busy: false, progress: null }
      }
      return read(async (reader) => {
        const updated = await reader.get<{ at: string | null }>(
          "SELECT max(finished_at) AS at FROM sync_log WHERE status = 'ok' AND rows_written > 0"
        )
        const exists = await reader.get(
          "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
          [LATEST_GAMES_TABLE]
        )
        const latest = exists
          ? await reader.get<{ season: number; date: string | null }>(
              `SELECT season, max(game_date)::VARCHAR AS date FROM ${LATEST_GAMES_TABLE}
               GROUP BY season ORDER BY season DESC LIMIT 1`
            )
          : null
        return {
          available: true,
          through: latest?.date ? { season: latest.season, date: latest.date } : null,
          updatedAt: updated?.at ?? null,
          busy,
          progress
        }
      })
    },
    read: (sql) => read((reader) => reader.all(sql)),
    /** Write, read, a Parquet round trip, `read_json` and an ICU time zone, through the real file. */
    async selfTest() {
      await db.exec('CREATE OR REPLACE TABLE self_test AS SELECT range AS x FROM range(1000)')
      const parquetPath = join(init.tempDir, 'self-test.parquet')
      await db.exec(`COPY self_test TO ${sqlString(parquetPath)} (FORMAT parquet)`)
      const back = await db.get<{ n: number }>(
        `SELECT count(*) AS n FROM read_parquet(${sqlString(parquetPath)})`
      )
      const jsonPath = join(init.tempDir, 'self-test.json')
      await db.exec(`COPY (SELECT 1 AS x) TO ${sqlString(jsonPath)} (FORMAT json)`)
      const json = await db.get<{ x: number }>(`SELECT x FROM read_json(${sqlString(jsonPath)})`)
      const icu = await db.get<{ hour: number }>(
        "SELECT hour(timezone('UTC', timezone('America/New_York', TIMESTAMP '2026-01-10 16:30'))) AS hour"
      )
      const version = await db.get<{ v: string }>('SELECT version() AS v')
      await db.exec('DROP TABLE self_test')
      return {
        duckdb: version?.v ?? '?',
        rows: back?.n ?? 0,
        parquet: back?.n === 1000,
        json: json?.x === 1,
        icu: icu?.hour === 21
      }
    },
    cancel() {
      cancelled = true
      abort.abort()
      db.interrupt()
      for (const conn of reading) conn.interrupt()
    },
    /** Refuses new reads, waits for the running ones (interrupted by `cancel`), then closes. */
    async close() {
      closing = true
      await Promise.allSettled([...inFlight])
      db.close()
    }
  }
}
