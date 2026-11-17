import type { SourceFile } from './sources'

/**
 * How the stats steps are named in `sync_log`. Apart from `sync.ts`, so what reads the log's names
 * (the Data panel's summary, the answers of a league with no worker) does not load DuckDB with it.
 */

/** Prefix of every stats step in `sync_log`. */
export const STATS_LOG_PREFIX = 'stats:'

export interface PlannedStep {
  source: SourceFile
  season: number
}

export function stepLogName(step: PlannedStep): string {
  return step.source.allSeasons
    ? `${STATS_LOG_PREFIX}${step.source.id}`
    : `${STATS_LOG_PREFIX}${step.source.id}:${step.season}`
}
