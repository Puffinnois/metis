import type { LineupGroup } from '@shared/stats/lineups'
import type { StatsQuery } from '@shared/stats/types'

export type StatsStepStatus = 'ok' | 'error' | 'skipped' | 'running' | 'interrupted'

/** One row of `stats.duckdb`'s own `sync_log`. */
export interface StatsLogEntry {
  id: number
  source: string
  startedAt: string
  finishedAt: string | null
  status: StatsStepStatus
  message: string | null
  rowsWritten: number
}

export interface RefreshOptions {
  /** Checks recent seasons and files of all seasons even if tried within the day. */
  force?: boolean
}

export interface StatsSyncResult {
  steps: StatsLogEntry[]
  /** DuckDB invalidated the database, so the refresh stopped; reopening it recovers. */
  fatal?: string
}

/** How far a running refresh has got, in files. */
export interface StatsProgress {
  done: number
  total: number
}

/** What the stats worker is started with. */
export interface StatsWorkerInit {
  /** `stats.duckdb`. */
  path: string
  /** Downloads and DuckDB's spill files. */
  tempDir: string
  /** Overrides the default, for scripts measuring another setting. */
  memoryLimit?: string
}

export interface SelfTestResult {
  duckdb: string
  rows: number
  /** A Parquet round trip: the sources publish Parquet. */
  parquet: boolean
  /** `read_json`. */
  json: boolean
  /** ICU time zones: tip-off times are published in Eastern time. */
  icu: boolean
  /** The engine answers a query: the catalogue, the compiler and DuckDB's window functions. */
  query: boolean
}

/**
 * Requests to the worker. `selfTest`, `refresh` and `close` run one after another; reads run at once.
 * `read` runs one SQL statement, for `scripts/` measuring a real load: the app itself does not expose
 * it, and the worker stays the only thread that opens the file.
 */
export type StatsRequest =
  | { id: number; kind: 'selfTest' }
  | { id: number; kind: 'close' }
  | { id: number; kind: 'refresh'; options: RefreshOptions }
  | { id: number; kind: 'status' }
  | { id: number; kind: 'data' }
  | { id: number; kind: 'pause' }
  | { id: number; kind: 'resume' }
  | { id: number; kind: 'read'; sql: string }
  | { id: number; kind: 'query'; query: StatsQuery }
  | { id: number; kind: 'catalogue' }
  | { id: number; kind: 'seasons' }
  | { id: number; kind: 'player'; player: string }
  | { id: number; kind: 'games'; season: number }
  | { id: number; kind: 'game'; game: string }
  | { id: number; kind: 'standings'; season: number }
  | { id: number; kind: 'matchups'; player: string; season: number }
  | { id: number; kind: 'profile'; player: string }
  | {
      id: number
      kind: 'lineups'
      team: string
      season: number
      gameType: string
      group: LineupGroup
    }
  | { id: number; kind: 'availability'; players: string[] }
  | { id: number; kind: 'coaches'; team: string; season: number }

/**
 * The kinds that run at once, each on its own connection, instead of in turn. A pause cannot wait
 * behind the load it means to stop.
 */
export const AT_ONCE_REQUESTS: ReadonlySet<StatsRequest['kind']> = new Set([
  'status',
  'data',
  'pause',
  'resume',
  'read',
  'query',
  'catalogue',
  'seasons',
  'player',
  'games',
  'game',
  'standings',
  'matchups',
  'profile',
  'lineups',
  'availability',
  'coaches'
])

export type StatsReply =
  | { kind: 'reply'; id: number; ok: true; result: unknown }
  | { kind: 'reply'; id: number; ok: false; error: string }
  | { kind: 'step'; entry: StatsLogEntry }
  /** The database could not be opened; the worker exits after sending it. */
  | { kind: 'fatal'; error: string }
