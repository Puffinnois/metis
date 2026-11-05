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

/** What the stats worker is started with. */
export interface StatsWorkerInit {
  /** `stats.duckdb`. */
  path: string
  /** Downloads and DuckDB's spill files. */
  tempDir: string
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
}

/** Requests to the worker. `selfTest` and `close` run one after another; reads run at once. */
export type StatsRequest =
  { id: number; kind: 'selfTest' } | { id: number; kind: 'close' } | { id: number; kind: 'status' }

/** The kinds that run at once, each on its own connection, instead of in turn. */
export const READ_REQUESTS: ReadonlySet<StatsRequest['kind']> = new Set(['status'])

export type StatsReply =
  | { kind: 'reply'; id: number; ok: true; result: unknown }
  | { kind: 'reply'; id: number; ok: false; error: string }
  | { kind: 'step'; entry: StatsLogEntry }
  /** The database could not be opened; the worker exits after sending it. */
  | { kind: 'fatal'; error: string }
