import type { StatsDb } from './db'
import { buildDerived, canDerive, derivedStale, markDerivedStale } from './derived/build'
import {
  buildPublished,
  canBuildPublished,
  markPublishedStale,
  publishedStale
} from './derived/published'
import type { Downloads, FetchedFile } from './download'
import { buildIdentity, canBuildIdentity, identityStale, markIdentityStale } from './identity'
import { buildPlays, canBuildPlays, markPlaysStale, playsStale } from './derived/plays'
import { loadSourceFile } from './load'
import type {
  RefreshOptions,
  StatsLogEntry,
  StatsProgress,
  StatsStepStatus,
  StatsSyncResult
} from './protocol'
import { INTERRUPTED_MESSAGE } from './schema'
import { currentSeason, fileUrl, LOAD_TIERS, seasonsOf, SOURCES, type SourceFile } from './sources'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** A step that finished is not tried again within a day. */
export const ATTEMPT_INTERVAL_MS = DAY
/** A failed one sooner: a network blip during the first load should not cost a day. */
export const ERROR_RETRY_MS = HOUR
/** The prior season is checked weekly. */
export const PRIOR_SEASON_FRESHNESS_MS = 7 * DAY
/** Files fetched ahead of the one being loaded; loading itself runs one file at a time. */
export const PARALLEL_DOWNLOADS = 4
/** Prefix of every stats step in `sync_log`. */
export const STATS_LOG_PREFIX = 'stats:'
/** Builds `game`, `team`, `player_ids` and `player` from the core tier. */
export const STATS_IDENTITY_STEP = `${STATS_LOG_PREFIX}identity`
/** Builds `player_game`, `team_game`, `player_season` and `team_season` from the identity tables. */
export const STATS_DERIVED_STEP = `${STATS_LOG_PREFIX}derived`
export const STATS_PUBLISHED_STEP = `${STATS_LOG_PREFIX}published`
export const STATS_PLAYS_STEP = `${STATS_LOG_PREFIX}plays`

export interface StatsSyncDeps {
  db: StatsDb
  downloads: Downloads
  now?: () => Date
  onStep?: (entry: StatsLogEntry) => void
  onProgress?: (progress: StatsProgress | null) => void
  /** True once the worker is closing: no step starts after it, and the running one is `interrupted`. */
  cancelled?: () => boolean
}

export interface PlannedStep {
  source: SourceFile
  season: number
}

/**
 * The load order (D21): tier by tier, and inside a tier the files of all seasons, then the newest
 * season back, so a load cut short leaves the seasons people look at most.
 */
export function planSteps(current: number, sources: SourceFile[] = SOURCES): PlannedStep[] {
  const rank = (season: number): number => (season === 0 ? Infinity : season)
  const steps = sources.flatMap((source) =>
    seasonsOf(source, current).map((season) => ({ source, season }))
  )
  return steps
    .map((step, order) => ({ step, order }))
    .sort(
      (a, b) =>
        LOAD_TIERS.indexOf(a.step.source.tier) - LOAD_TIERS.indexOf(b.step.source.tier) ||
        rank(b.step.season) - rank(a.step.season) ||
        a.order - b.order
    )
    .map(({ step }) => step)
}

export function stepLogName(step: PlannedStep): string {
  return step.source.allSeasons
    ? `${STATS_LOG_PREFIX}${step.source.id}`
    : `${STATS_LOG_PREFIX}${step.source.id}:${step.season}`
}

export interface SourceState {
  version: number
  fetchedAt: string
  sealed: boolean
  rows: number
  etag: string | null
  /** The size of the file as downloaded. */
  bytes: number | null
}

export interface LastAttempt {
  startedAt: string
  status: StatsStepStatus
}

export interface DueInput {
  season: number
  current: number
  force: boolean
  now: number
  attempt: LastAttempt | null
  version: number
  state: SourceState | null
}

/**
 * Not again soon after the last attempt (unless forced, for recent seasons and files of all
 * seasons). A new version or no state is due; the current season and files of all seasons daily, the
 * prior season weekly, older seasons until sealed.
 */
export function isDue(input: DueInput): boolean {
  const { season, current, now, state, attempt } = input
  const recent = season === 0 || season >= current - 1
  const wait = attempt?.status === 'error' ? ERROR_RETRY_MS : ATTEMPT_INTERVAL_MS
  const attempted = attempt !== null && now - Date.parse(attempt.startedAt) < wait
  if (attempted && !(input.force && recent)) return false
  if (!state || state.version < input.version) return true
  if (season === 0 || season === current) return true
  if (season === current - 1) return now - Date.parse(state.fetchedAt) >= PRIOR_SEASON_FRESHNESS_MS
  return !state.sealed
}

/** Every source's state at once: a first load asks about 3,107 files. */
async function readStates(db: StatsDb): Promise<Map<string, SourceState>> {
  const rows = await db.all<{
    source: string
    season: number
    version: number
    fetched_at: string
    sealed: boolean
    rows_written: number
    etag: string | null
    bytes: number | null
  }>(
    'SELECT source, season, version, fetched_at, sealed, rows_written, etag, bytes FROM source_state'
  )
  return new Map(
    rows.map((r) => [
      `${r.source}:${r.season}`,
      {
        version: r.version,
        fetchedAt: r.fetched_at,
        sealed: r.sealed,
        rows: r.rows_written,
        etag: r.etag,
        bytes: r.bytes
      }
    ])
  )
}

/** An interrupted step is not an attempt: the next run tries it again. */
async function readAttempts(db: StatsDb): Promise<Map<string, LastAttempt>> {
  const rows = await db.all<{ source: string; started_at: string; status: StatsStepStatus }>(
    `SELECT source, arg_max(started_at, id) AS started_at, arg_max(status, id) AS status
     FROM sync_log WHERE status NOT IN ('running', 'interrupted') GROUP BY source`
  )
  return new Map(rows.map((r) => [r.source, { startedAt: r.started_at, status: r.status }]))
}

const nowOf = (deps: StatsSyncDeps): Date => (deps.now ?? (() => new Date()))()

function toEntry(row: Record<string, unknown>): StatsLogEntry {
  return {
    id: row.id as number,
    source: row.source as string,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    status: row.status as StatsStepStatus,
    message: (row.message as string | null) ?? null,
    rowsWritten: row.rows_written as number
  }
}

/** Thrown by a step body to log `skipped` instead of `error`. */
class SkipStep extends Error {}

/** Runs one step under a `sync_log` row; never throws (errors are logged). */
async function runLogged(
  deps: StatsSyncDeps,
  name: string,
  body: () => Promise<{ rows: number; message: string | null }>
): Promise<StatsLogEntry> {
  const db = deps.db
  const started = await db.get<{ id: number }>(
    "INSERT INTO sync_log (source, started_at, status) VALUES (?, ?, 'running') RETURNING id",
    [name, nowOf(deps).toISOString()]
  )
  let status: StatsStepStatus = 'ok'
  let message: string | null = null
  let rows = 0
  try {
    const out = await body()
    rows = out.rows
    message = out.message
  } catch (err) {
    if (deps.cancelled?.()) {
      status = 'interrupted'
      message = INTERRUPTED_MESSAGE
    } else {
      status = err instanceof SkipStep ? 'skipped' : 'error'
      message = err instanceof Error ? err.message : String(err)
    }
  }
  const row = await db.get(
    `UPDATE sync_log SET finished_at = ?, status = ?, message = ?, rows_written = ?
     WHERE id = ? RETURNING *`,
    [nowOf(deps).toISOString(), status, message, rows, started?.id ?? 0]
  )
  const entry = toEntry(row ?? {})
  try {
    deps.onStep?.(entry)
  } catch {
    // progress reporting never affects the sync
  }
  return entry
}

type Settled = { ok: true; file: FetchedFile } | { ok: false; error: unknown }

/**
 * Every due step, in load order. Files download a few at a time ahead of the one being loaded, and
 * each load commits on its own, so a quit mid-load resumes on the next run. Never throws.
 */
export async function refreshStats(
  deps: StatsSyncDeps,
  options: RefreshOptions = {},
  sources: SourceFile[] = SOURCES
): Promise<StatsSyncResult> {
  const { db, downloads } = deps
  const log: StatsLogEntry[] = []
  let fatal: string | undefined
  let coreWrote = false
  let built = false
  let publishedWrote = false
  let publishedBuilt = false
  let eventsWrote = false
  const today = nowOf(deps)
  const current = currentSeason(today)
  const states = await readStates(db)
  const attempts = await readAttempts(db)
  const stateOf = (step: PlannedStep): SourceState | null =>
    states.get(`${step.source.id}:${step.season}`) ?? null
  const due = planSteps(current, sources).filter((step) =>
    isDue({
      season: step.season,
      current,
      force: options.force ?? false,
      now: today.getTime(),
      attempt: attempts.get(stepLogName(step)) ?? null,
      version: step.source.version,
      state: stateOf(step)
    })
  )

  const fetches: Promise<Settled>[] = []
  const fetchUpTo = (limit: number): void => {
    while (fetches.length < Math.min(limit, due.length)) {
      const step = due[fetches.length]
      const state = stateOf(step)
      // A new version loads the file again even when the file itself has not changed.
      const etag = state?.version === step.source.version ? state.etag : null
      fetches.push(
        downloads.fetchFile(fileUrl(step.source, step.season), etag).then(
          (file): Settled => ({ ok: true, file }),
          (error): Settled => ({ ok: false, error })
        )
      )
    }
  }
  const saveState = async (
    step: PlannedStep,
    rows: number,
    etag: string | null,
    bytes: number | null
  ): Promise<void> => {
    await db.exec(
      `INSERT OR REPLACE INTO source_state
         (source, season, version, rows_written, fetched_at, sealed, etag, bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        step.source.id,
        step.season,
        step.source.version,
        rows,
        nowOf(deps).toISOString(),
        step.season !== 0 && step.season <= current - 2,
        etag,
        bytes
      ]
    )
  }

  // Built as soon as the core tier is in, so the app can use them long before the load ends. New
  // core files rebuild everything; otherwise only a table a new version made stale.
  const runBuilds = async (): Promise<void> => {
    built = true
    if ((coreWrote || (await identityStale(db))) && (await canBuildIdentity(db))) {
      log.push(
        await runLogged(deps, STATS_IDENTITY_STEP, async () => ({
          rows: await buildIdentity(db),
          message: null
        }))
      )
    }
    if ((coreWrote || (await derivedStale(db))) && (await canDerive(db))) {
      log.push(
        await runLogged(deps, STATS_DERIVED_STEP, async () => ({
          rows: await buildDerived(db),
          message: null
        }))
      )
    }
  }

  // Built once the published tier is in, so its numbers can be read while the events and plays load.
  const runPublishedBuild = async (): Promise<void> => {
    publishedBuilt = true
    if (canBuildPublished() && (publishedWrote || (await publishedStale(db)))) {
      log.push(
        await runLogged(deps, STATS_PUBLISHED_STEP, async () => ({
          rows: await buildPublished(db),
          message: null
        }))
      )
    }
  }

  // Built at the end, once the events and plays tiers are in: the plays are keyed to the game
  // tables, and they are the largest build, so nothing else waits behind it.
  const runPlaysBuild = async (): Promise<void> => {
    if ((eventsWrote || coreWrote || (await playsStale(db))) && (await canBuildPlays(db))) {
      log.push(
        await runLogged(deps, STATS_PLAYS_STEP, async () => ({
          rows: await buildPlays(db),
          message: null
        }))
      )
    }
  }

  deps.onProgress?.(due.length > 0 ? { done: 0, total: due.length } : null)
  for (let i = 0; i < due.length; i++) {
    if (deps.cancelled?.()) break
    fetchUpTo(i + PARALLEL_DOWNLOADS)
    const step = due[i]
    let entry: StatsLogEntry
    try {
      if (coreWrote && !built && step.source.tier !== 'core') await runBuilds()
      if (publishedWrote && !publishedBuilt && step.source.tier !== 'published') {
        await runPublishedBuild()
      }
      entry = await runLogged(deps, stepLogName(step), async () => {
        const fetched = await fetches[i]
        if (!fetched.ok) throw fetched.error
        if (fetched.file.kind === 'missing') throw new SkipStep('not published yet')
        if (fetched.file.kind === 'unchanged') {
          const state = stateOf(step)
          await saveState(step, state?.rows ?? 0, state?.etag ?? null, state?.bytes ?? null)
          return { rows: 0, message: 'unchanged' }
        }
        const file = fetched.file
        try {
          const loaded = await loadSourceFile(db, step.source, step.season, file.path)
          await saveState(step, loaded.rows, file.etag, file.bytes)
          return { rows: loaded.rows, message: loaded.notes.join('; ') || null }
        } finally {
          await downloads.removeFile(file.path)
        }
      })
    } catch (err) {
      // The log itself cannot be written, so DuckDB has invalidated the database: every further
      // step would fail too, and only reopening it recovers.
      fatal = err instanceof Error ? err.message : String(err)
      break
    }
    log.push(entry)
    if (step.source.tier === 'core' && entry.status === 'ok' && entry.rowsWritten > 0) {
      if (!coreWrote) {
        await markIdentityStale(db)
        await markDerivedStale(db)
      }
      coreWrote = true
    }
    if (
      (step.source.tier === 'events' || step.source.tier === 'plays') &&
      entry.status === 'ok' &&
      entry.rowsWritten > 0
    ) {
      if (!eventsWrote) await markPlaysStale(db)
      eventsWrote = true
    }
    if (step.source.tier === 'published' && entry.status === 'ok' && entry.rowsWritten > 0) {
      if (!publishedWrote && canBuildPublished()) await markPublishedStale(db)
      publishedWrote = true
    }
    deps.onProgress?.({ done: i + 1, total: due.length })
  }
  deps.onProgress?.(null)
  if (fatal !== undefined) return { steps: log, fatal }
  if (!deps.cancelled?.()) {
    try {
      if (!built) await runBuilds()
      if (!publishedBuilt) await runPublishedBuild()
      await runPlaysBuild()
    } catch (err) {
      return { steps: log, fatal: err instanceof Error ? err.message : String(err) }
    }
  }
  if (log.some((e) => e.status === 'ok' && e.rowsWritten > 0) && !deps.cancelled?.()) {
    try {
      await db.exec('CHECKPOINT')
    } catch {
      // A read still running can refuse it; DuckDB checkpoints on its own later.
    }
  }
  return { steps: log }
}
