import { builds, seasonEnd, type BuiltTables, type League } from '@shared/leagues'
import type { StatsDb } from './db'
import { buildDerived, canDerive, derivedStale, markDerivedStale } from './derived/build'
import {
  buildPublished,
  canBuildPublished,
  markPublishedStale,
  PUBLISHED_LATE_SOURCES,
  publishedStale
} from './derived/published'
import type { Downloads, FetchedFile } from './download'
import { buildIdentity, canBuildIdentity, identityStale, markIdentityStale } from './identity'
import { buildPlays, canBuildPlays, markPlaySeason, playsDue } from './derived/playBuilders'
import { loadSourceFile } from './load'
import { buildModels, canBuildModels, markModelSeason, modelsDue } from './models/build'
import type {
  RefreshOptions,
  StatsLogEntry,
  StatsProgress,
  StatsStepStatus,
  StatsSyncResult
} from './protocol'
import { INTERRUPTED_MESSAGE } from './schema'
import { STATS_LOG_PREFIX, stepLogName, type PlannedStep } from './steps'
import {
  includedSources,
  leftOutIn,
  leftOutProblem,
  leftOutSources,
  leftOutTables
} from './leftOut'
import {
  fileUrl,
  LEFT_OUT_RELEASES,
  LOAD_TIERS,
  seasonsOf,
  SOURCES,
  type SourceFile
} from './sources'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** A step that finished is not tried again within a day. */
export const ATTEMPT_INTERVAL_MS = DAY
/** A failed one sooner: a network blip during the first load should not cost a day. */
export const ERROR_RETRY_MS = HOUR
/** The prior season, and the current one once its last month is over, are checked weekly. */
export const PRIOR_SEASON_FRESHNESS_MS = 7 * DAY
/**
 * A season that has ended is sealed once a file has not changed for this long: the producers rebuild
 * the files daily while games are played and correct them for some days after, then stop.
 */
export const SETTLED_MS = 14 * DAY
/** Files fetched ahead of the one being loaded; loading itself runs one file at a time. */
export const PARALLEL_DOWNLOADS = 4
export { STATS_LOG_PREFIX, stepLogName, type PlannedStep }
/** Builds `game`, `team`, `player_ids` and `player` from the core tier. */
export const STATS_IDENTITY_STEP = `${STATS_LOG_PREFIX}identity`
/** Builds `player_game`, `team_game`, `player_season` and `team_season` from the identity tables. */
export const STATS_DERIVED_STEP = `${STATS_LOG_PREFIX}derived`
export const STATS_PUBLISHED_STEP = `${STATS_LOG_PREFIX}published`
export const STATS_PLAYS_STEP = `${STATS_LOG_PREFIX}plays`
/** Computes the models (Plan Stage 10) from the game tables, last of all. */
export const STATS_MODELS_STEP = `${STATS_LOG_PREFIX}models`
/** Drops what a release left out of this build had loaded (`leftOut.ts`). */
export const STATS_LEFT_OUT_STEP = `${STATS_LOG_PREFIX}left-out`

/**
 * Drops the source tables of the releases left out of this build and forgets their files, then marks
 * every built table out of date, so the steps rebuild from what is left and an install that had
 * loaded them ends up as one that never did. Returns how many tables and file records went; 0 once
 * they are gone, so a later refresh rebuilds nothing.
 */
export async function dropLeftOut(
  db: StatsDb,
  leftOut: readonly string[],
  sources: readonly SourceFile[] = SOURCES
): Promise<number> {
  const have = new Set(
    (
      await db.all<{ table_name: string }>(
        "SELECT table_name FROM duckdb_tables() WHERE schema_name = 'main'"
      )
    ).map((r) => r.table_name)
  )
  const tables = leftOutTables(leftOut, sources).filter((t) => have.has(t))
  const ids = [...new Set(leftOutSources(leftOut, sources).map((s) => s.id))]
  const held =
    ids.length === 0
      ? 0
      : ((
          await db.get<{ n: number }>(
            `SELECT count(*)::INTEGER AS n FROM source_state WHERE source IN (${ids.map(() => '?').join(', ')})`,
            ids
          )
        )?.n ?? 0)
  if (tables.length === 0 && held === 0) return 0
  for (const table of tables) await db.exec(`DROP TABLE IF EXISTS ${table}`)
  if (held > 0) {
    await db.exec(
      `DELETE FROM source_state WHERE source IN (${ids.map(() => '?').join(', ')})`,
      ids
    )
  }
  await markIdentityStale(db)
  await markDerivedStale(db)
  if (canBuildPublished()) await markPublishedStale(db)
  await markPlaySeason(db, 0)
  await markModelSeason(db, 0)
  return tables.length + held
}

export interface StatsSyncDeps {
  db: StatsDb
  /** The league this file is: what season is current, and how the builders count a game. */
  league: League
  downloads: Downloads
  now?: () => Date
  onStep?: (entry: StatsLogEntry) => void
  onProgress?: (progress: StatsProgress | null) => void
  /** True once the worker is closing: no step starts after it, and the running one is `interrupted`. */
  cancelled?: () => boolean
}

/**
 * The load order (D21): tier by tier, and inside a tier the files of all seasons, then the newest
 * season back, so a load cut short leaves the seasons people look at most.
 */
export function planSteps(
  current: number,
  sources: readonly SourceFile[] = SOURCES
): PlannedStep[] {
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

export interface SourceState {
  version: number
  fetchedAt: string
  sealed: boolean
  rows: number
  etag: string | null
  /** The size of the file as downloaded. */
  bytes: number | null
  /** When the file last changed, ISO time (`isSealed`). */
  modifiedAt: string | null
}

export interface LastAttempt {
  startedAt: string
  status: StatsStepStatus
}

export interface DueInput {
  season: number
  current: number
  /** The season's last month is over (`seasonEnd`). */
  ended: boolean
  force: boolean
  now: number
  attempt: LastAttempt | null
  version: number
  state: SourceState | null
}

/**
 * Not again soon after the last attempt (unless forced, for recent seasons and files of all
 * seasons). A new version or no state is due; files of all seasons daily; a sealed season never; the
 * current season daily until its last month is over, then weekly, as is the prior season; older
 * seasons until sealed.
 */
export function isDue(input: DueInput): boolean {
  const { season, current, now, state, attempt } = input
  const recent = season === 0 || season >= current - 1
  const wait = attempt?.status === 'error' ? ERROR_RETRY_MS : ATTEMPT_INTERVAL_MS
  const attempted = attempt !== null && now - Date.parse(attempt.startedAt) < wait
  if (attempted && !(input.force && recent)) return false
  if (!state || state.version < input.version) return true
  if (season === 0) return true
  if (state.sealed) return false
  if (season === current && !input.ended) return true
  if (season >= current - 1) return now - Date.parse(state.fetchedAt) >= PRIOR_SEASON_FRESHNESS_MS
  return true
}

export interface SealInput {
  season: number
  current: number
  ended: boolean
  now: number
  /** When the file last changed, ISO time; null when not known. */
  modifiedAt: string | null
}

/**
 * Whether a file is never fetched again. Two seasons back and older: sealed when loaded, as always. A
 * season that has ended (the WNBA's in November, the NBA's in July): sealed once the file has not
 * changed for `SETTLED_MS`, by its Last-Modified as published, else by when Metis last saw its content
 * change. A season still being played, and a file of all seasons: never.
 */
export function isSealed(input: SealInput): boolean {
  const { season, current, ended, now, modifiedAt } = input
  if (season === 0) return false
  if (season <= current - 2) return true
  return ended && modifiedAt !== null && now - Date.parse(modifiedAt) >= SETTLED_MS
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
    modified_at: string | null
  }>(
    'SELECT source, season, version, fetched_at, sealed, rows_written, etag, bytes, modified_at FROM source_state'
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
        bytes: r.bytes,
        modifiedAt: r.modified_at
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

/** Why a league's refresh builds no game or season tables (`League.builds` lacks `derived`). */
export const notBuilt = (league: League): string =>
  builds(league, 'identity')
    ? `No ${league.name} game or season stat tables yet: its files are loaded, and only its game, team and player tables are built from them.`
    : `No ${league.name} game, team, player or season tables yet: its files are loaded, and nothing is built from them.`

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
  allSources: readonly SourceFile[] = SOURCES,
  everyLeague: readonly string[] = LEFT_OUT_RELEASES
): Promise<StatsSyncResult> {
  const { db, downloads } = deps
  const leftOut = leftOutIn(everyLeague, allSources)
  const log: StatsLogEntry[] = []
  // A list that names a core release, or one Metis does not load, is a build mistake: say so plainly
  // and load nothing, rather than build tables the rest cannot be keyed to.
  const problem = leftOutProblem(leftOut, allSources)
  if (problem !== null) {
    log.push(
      await runLogged(deps, STATS_LEFT_OUT_STEP, async () => {
        throw new Error(problem)
      })
    )
    return { steps: log }
  }
  if (leftOut.length > 0) {
    const dropped = await dropLeftOut(db, leftOut, allSources)
    if (dropped > 0) {
      log.push(
        await runLogged(deps, STATS_LEFT_OUT_STEP, async () => ({
          rows: 0,
          message: `${dropped} left out`
        }))
      )
    }
  }
  const sources = includedSources(leftOut, allSources)
  let fatal: string | undefined
  let coreWrote = false
  let built = false
  let publishedWrote = false
  let publishedBuilt = false
  // A later tier's file that a published table reads, written after the published step ran.
  let lateWrote = false
  const today = nowOf(deps)
  const current = deps.league.currentSeason(today)
  const ended = (season: number): boolean =>
    season !== 0 && today.getTime() >= seasonEnd(deps.league, season).getTime()
  const states = await readStates(db)
  const attempts = await readAttempts(db)
  const stateOf = (step: PlannedStep): SourceState | null =>
    states.get(`${step.source.id}:${step.season}`) ?? null
  const due = planSteps(current, sources).filter((step) =>
    isDue({
      season: step.season,
      current,
      ended: ended(step.season),
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
    bytes: number | null,
    modifiedAt: string | null
  ): Promise<void> => {
    const at = nowOf(deps)
    await db.exec(
      `INSERT OR REPLACE INTO source_state
         (source, season, version, rows_written, fetched_at, sealed, etag, bytes, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        step.source.id,
        step.season,
        step.source.version,
        rows,
        at.toISOString(),
        isSealed({
          season: step.season,
          current,
          ended: ended(step.season),
          now: at.getTime(),
          modifiedAt
        }),
        etag,
        bytes,
        modifiedAt
      ]
    )
  }

  // Each step runs only for a league whose registry entry lists its tables (`League.builds`): a later
  // builder reads tables the league may not have yet. The identity tables are built by the recipe the
  // entry names.
  const league = deps.league
  const runs = (tables: BuiltTables): boolean => builds(league, tables)

  // Built as soon as the core tier is in, so the app can use them long before the load ends. New
  // core files rebuild everything; otherwise only a table a new version made stale, and the game and
  // season tables after a rebuilt identity, since they join through its links (an ESPN id).
  const runBuilds = async (): Promise<void> => {
    built = true
    let identityBuilt = false
    if (
      runs('identity') &&
      (coreWrote || (await identityStale(db, league))) &&
      (await canBuildIdentity(db, league))
    ) {
      identityBuilt = true
      log.push(
        await runLogged(deps, STATS_IDENTITY_STEP, async () => ({
          rows: await buildIdentity(db, league),
          message: null
        }))
      )
    }
    if (!runs('derived')) return
    if (
      (coreWrote || identityBuilt || (await derivedStale(db, league))) &&
      (await canDerive(db, league))
    ) {
      log.push(
        await runLogged(deps, STATS_DERIVED_STEP, async () => ({
          rows: await buildDerived(db, league),
          message: null
        }))
      )
    }
  }

  // Built once the published tier is in, so its numbers can be read while the events and plays load.
  const runPublishedBuild = async (force = false): Promise<void> => {
    publishedBuilt = true
    if (!runs('published')) return
    if (canBuildPublished() && (force || publishedWrote || (await publishedStale(db)))) {
      log.push(
        await runLogged(deps, STATS_PUBLISHED_STEP, async () => ({
          rows: await buildPublished(db),
          message: null
        }))
      )
    }
  }

  // Built at the end, once the events and plays tiers are in: the plays are keyed to the game
  // tables, and they are the largest build, so nothing else waits behind it. Only the seasons whose
  // files wrote rows are rebuilt (`playBuilders.ts`).
  const runPlaysBuild = async (): Promise<void> => {
    if (!runs('plays')) return
    if ((await playsDue(db)) && (await canBuildPlays(db))) {
      log.push(
        await runLogged(deps, STATS_PLAYS_STEP, async () => ({
          rows: await buildPlays(db, deps.league),
          message: null
        }))
      )
    }
  }

  // Last, after the plays: a model reads the game tables, and later ones may read the plays. Only the
  // seasons whose files wrote rows are computed again (`models/build.ts`).
  const runModelsBuild = async (): Promise<void> => {
    if (!runs('models')) return
    if ((await modelsDue(db)) && (await canBuildModels(db))) {
      log.push(
        await runLogged(deps, STATS_MODELS_STEP, async () => ({
          rows: await buildModels(db, current, deps.league),
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
          await saveState(
            step,
            state?.rows ?? 0,
            state?.etag ?? null,
            state?.bytes ?? null,
            fetched.file.modified ?? state?.modifiedAt ?? null
          )
          return { rows: 0, message: 'unchanged' }
        }
        const file = fetched.file
        try {
          const loaded = await loadSourceFile(db, step.source, step.season, file.path)
          await saveState(
            step,
            loaded.rows,
            file.etag,
            file.bytes,
            file.modified ?? nowOf(deps).toISOString()
          )
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
    if (entry.status === 'ok' && entry.rowsWritten > 0 && step.source.tier !== 'published') {
      await markPlaySeason(db, step.season)
    }
    // A model may read any tier, the published tables included. A file of every season marks the
    // season in progress, not every season: the ESPN schedule files and the aliases change every few
    // days (Plan T1001 measured it), and what they add is this season's games and players. Every
    // season would recompute every model each time.
    if (entry.status === 'ok' && entry.rowsWritten > 0) {
      await markModelSeason(db, step.season === 0 ? current : step.season)
    }
    if (step.source.tier === 'published' && entry.status === 'ok' && entry.rowsWritten > 0) {
      if (!publishedWrote && canBuildPublished()) await markPublishedStale(db)
      publishedWrote = true
    }
    if (
      PUBLISHED_LATE_SOURCES.includes(step.source.table) &&
      entry.status === 'ok' &&
      entry.rowsWritten > 0 &&
      canBuildPublished()
    ) {
      await markPublishedStale(db)
      lateWrote = true
    }
    deps.onProgress?.({ done: i + 1, total: due.length })
  }
  deps.onProgress?.(null)
  if (fatal !== undefined) return { steps: log, fatal }
  if (!deps.cancelled?.()) {
    try {
      if (!built) await runBuilds()
      // Once, at the end, however many of the late files came in; then the plays.
      if (!publishedBuilt || lateWrote) await runPublishedBuild(lateWrote)
      await runPlaysBuild()
      await runModelsBuild()
      if (!runs('derived') && log.some((e) => e.status === 'ok' && e.rowsWritten > 0)) {
        log.push(
          await runLogged(deps, STATS_DERIVED_STEP, async () => {
            throw new SkipStep(notBuilt(deps.league))
          })
        )
      }
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
