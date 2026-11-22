import type { LeagueId } from '@shared/leagues'
import type { StatsStatus } from '@shared/stats/types'
import type { StatsClient } from './client'

/**
 * How long a league's worker stays open with nothing using it before it closes (D22's addition of
 * 2026-11-22). Long enough that a quick switch away and back finds it open; a worker reopens on the
 * next read in about 0.4 s.
 */
export const WORKER_IDLE_MS = 60_000

export interface WorkerPoolDeps {
  /** Starts a league's worker; throws when it cannot. */
  start: (league: LeagueId) => StatsClient
  /** Whether the league has a file to open (on, or off with its file kept). */
  canOpen: (league: LeagueId) => boolean
  idleMs?: number
  log?: (message: string, err?: unknown) => void
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

/**
 * The leagues' stats workers, opened on demand and closed when idle (D22's addition of 2026-11-22).
 * A finished load leaves memory in the process that only closing its worker gives back (0.89 GB a
 * minute after NCAA Men's load, 0.30 GB once closed), so a worker closes, once nothing uses it for the
 * idle delay, when its league is not on screen, or when it is but has refreshed with rows written
 * since it opened. A read, a refresh or a links step holds its league's worker open while it runs; the
 * next one after a close opens it again. A league never has two workers: an open waits until the
 * league's last worker has closed (rule 3). A closed league's status is the one it gave as it closed.
 */
export interface WorkerPool {
  running(league: LeagueId): StatsClient | null
  /** The league's worker, opened if it has none; null when it has no file or cannot start. */
  acquire(league: LeagueId): Promise<StatsClient | null>
  /** Holds the league's worker open until the returned release is called. */
  hold(league: LeagueId): () => void
  /** Runs `fn` on the league's worker, held open meanwhile; null when the league has no worker. */
  use<T>(league: LeagueId, fn: (client: StatsClient) => Promise<T>): Promise<T | null>
  /** The status a closed league gave as it closed; null while open or never closed. */
  cachedStatus(league: LeagueId): StatsStatus | null
  /** The league on screen, which keeps its worker open (unless it has refreshed since it opened). */
  setOnScreen(league: LeagueId | null): void
  /** A refresh of the league ended; `wrote` when it wrote rows. */
  refreshed(league: LeagueId, wrote: boolean): void
  /** Closes the league's worker now, whatever holds it (turning a league off, deleting its file). */
  stop(league: LeagueId): Promise<void>
  closeAll(): Promise<void>
}

export function createWorkerPool(deps: WorkerPoolDeps): WorkerPool {
  const idleMs = deps.idleMs ?? WORKER_IDLE_MS
  const log =
    deps.log ?? ((m, err) => (err === undefined ? console.info(m) : console.error(m, err)))
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>))
  const clients = new Map<LeagueId, StatsClient>()
  const closing = new Map<LeagueId, Promise<void>>()
  const holds = new Map<LeagueId, number>()
  const timers = new Map<LeagueId, unknown>()
  const statuses = new Map<LeagueId, StatsStatus>()
  /** Refreshed with rows written since its worker opened: closes when idle even on screen. */
  const dirty = new Set<LeagueId>()
  let onScreen: LeagueId | null = null
  let shuttingDown = false

  const held = (league: LeagueId): boolean => (holds.get(league) ?? 0) > 0
  const keepsOpen = (league: LeagueId): boolean => league === onScreen && !dirty.has(league)

  const cancel = (league: LeagueId): void => {
    const timer = timers.get(league)
    if (timer !== undefined) clearTimer(timer)
    timers.delete(league)
  }

  const shut = async (league: LeagueId, client: StatsClient): Promise<void> => {
    clients.delete(league)
    dirty.delete(league)
    cancel(league)
    const done = client
      .close()
      .catch((err) => log(`closing the ${league} stats worker failed`, err))
    closing.set(league, done)
    await done
    if (closing.get(league) === done) closing.delete(league)
  }

  const closeIfIdle = async (league: LeagueId): Promise<void> => {
    timers.delete(league)
    const client = clients.get(league)
    if (!client || held(league) || keepsOpen(league) || shuttingDown) return
    // Its status, kept for the window to read while it is closed; read before anything can change it.
    const status = await client.status().catch(() => null)
    // A read may have arrived meanwhile: it holds the worker, and the close waits for the next idle.
    if (clients.get(league) !== client || held(league) || keepsOpen(league)) return
    if (status) statuses.set(league, status)
    await shut(league, client)
  }

  const schedule = (league: LeagueId): void => {
    cancel(league)
    if (!clients.has(league) || held(league) || keepsOpen(league) || shuttingDown) return
    timers.set(
      league,
      setTimer(() => void closeIfIdle(league), idleMs)
    )
  }

  const pool: WorkerPool = {
    running: (league) => clients.get(league) ?? null,
    async acquire(league) {
      const pending = closing.get(league)
      if (pending) await pending
      const running = clients.get(league)
      if (running) return running
      if (shuttingDown || !deps.canOpen(league)) return null
      const client = deps.start(league)
      clients.set(league, client)
      statuses.delete(league)
      schedule(league)
      return client
    },
    hold(league) {
      holds.set(league, (holds.get(league) ?? 0) + 1)
      cancel(league)
      let released = false
      return () => {
        if (released) return
        released = true
        const left = (holds.get(league) ?? 1) - 1
        if (left > 0) holds.set(league, left)
        else holds.delete(league)
        schedule(league)
      }
    },
    async use(league, fn) {
      const release = pool.hold(league)
      try {
        const client = await pool.acquire(league)
        return client ? await fn(client) : null
      } finally {
        release()
      }
    },
    cachedStatus: (league) => (clients.has(league) ? null : (statuses.get(league) ?? null)),
    setOnScreen(league) {
      const before = onScreen
      onScreen = league
      if (before && before !== league) schedule(before)
      if (league) {
        if (keepsOpen(league)) cancel(league)
        else schedule(league)
      }
    },
    refreshed(league, wrote) {
      if (wrote && clients.has(league)) dirty.add(league)
      schedule(league)
    },
    async stop(league) {
      const client = clients.get(league)
      if (client) await shut(league, client)
      else await closing.get(league)
    },
    async closeAll() {
      shuttingDown = true
      for (const league of [...timers.keys()]) cancel(league)
      await Promise.allSettled([
        ...[...clients.entries()].map(([league, client]) => shut(league, client)),
        ...closing.values()
      ])
    }
  }
  return pool
}
