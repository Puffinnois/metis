import type { LeagueId } from '@shared/leagues'
import type { StatsFamily, StatsOtherCareer, StatsOtherPlayer } from '@shared/stats/types'
import type { RefreshOptions, StatsLogEntry } from '../protocol'

/** A league's side of its pair, handed over as Parquet by the league's worker (`side.ts`). */
export interface LinkSideFiles {
  league: LeagueId
  side: 'college' | 'pro'
  players: string
  /** The professional league's draft lines; null for a college side or a file without the table. */
  draft: string | null
}

/** Metis's own season lines of a league's linked players, and their teams. */
export interface LinkLinesFiles {
  league: LeagueId
  seasons: string
  teams: string
}

/** What the links worker is started with: it alone opens `LINKS_FILE` in the data folder (D47). */
export interface LinksWorkerInit {
  dataDir: string
  /** Its own temp folder: the paired downloads, DuckDB's spill files and the hand-over folder. */
  tempDir: string
  memoryLimit?: string
}

/** What one league's links step did, for the log and the measurements. */
export interface LinksStepResult {
  league: LeagueId
  /** The paired files' steps. */
  steps: StatsLogEntry[]
  /** Links of the league's pair after the step, by method. */
  links: Record<string, number>
}

/**
 * Requests to the links worker. Writes (`refreshPaired`, `ingestSide`, `ingestLines`, `close`) run in
 * turn; reads run at once, each on its own connection, so a player's read never waits behind a write.
 */
export type LinksRequest =
  | { id: number; kind: 'close' }
  | { id: number; kind: 'refreshPaired'; league: LeagueId; options: RefreshOptions }
  | { id: number; kind: 'ingestSide'; files: LinkSideFiles }
  | { id: number; kind: 'ingestLines'; files: LinkLinesFiles }
  | { id: number; kind: 'failed'; league: LeagueId; message: string }
  | { id: number; kind: 'linkedIds'; league: LeagueId }
  | { id: number; kind: 'counts'; league: LeagueId }
  | { id: number; kind: 'otherCareer'; league: LeagueId; player: string }
  | { id: number; kind: 'otherPlayers'; league: LeagueId }
  | { id: number; kind: 'pairedIds'; league: LeagueId; ids: string[] }
  | { id: number; kind: 'pairedFamilies'; league: LeagueId }
  | { id: number; kind: 'read'; sql: string }
  | { id: number; kind: 'ping' }

export const LINKS_AT_ONCE: ReadonlySet<LinksRequest['kind']> = new Set([
  'linkedIds',
  'counts',
  'otherCareer',
  'otherPlayers',
  'pairedIds',
  'pairedFamilies',
  'read',
  'ping'
])

export type LinksReply =
  | { kind: 'reply'; id: number; ok: true; result: unknown }
  | { kind: 'reply'; id: number; ok: false; error: string }
  | { kind: 'fatal'; error: string }

/** The links worker's answers, as the main process sees them. */
export interface LinksClient {
  refreshPaired(league: LeagueId, options?: RefreshOptions): Promise<StatsLogEntry[]>
  ingestSide(files: LinkSideFiles): Promise<Record<string, number>>
  ingestLines(files: LinkLinesFiles): Promise<number>
  /** Records a failed links step for the league, so its Data panel shows it until the next one. */
  failed(league: LeagueId, message: string): Promise<void>
  linkedIds(league: LeagueId): Promise<number[]>
  counts(league: LeagueId): Promise<Record<string, number>>
  otherCareer(league: LeagueId, player: string): Promise<StatsOtherCareer>
  /** The paired league's linked players with no page in this league, for its search (T1304.4). */
  otherPlayers(league: LeagueId): Promise<StatsOtherPlayer[]>
  /**
   * Which of a league's players are linked, and their ids in the paired league, as `[here, there]`
   * pairs: how a favourite follows the person (D49).
   */
  pairedIds(league: LeagueId, ids: string[]): Promise<[string, string][]>
  pairedFamilies(league: LeagueId): Promise<StatsFamily[]>
  read(sql: string): Promise<Record<string, unknown>[]>
  ping(): Promise<void>
  close(): Promise<void>
}
