import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '@main/db/connection'
import { LEAGUES, leagueOf, pairOf, type LeagueId } from '@shared/leagues'
import type {
  LeagueDownload,
  LeagueDownloads,
  StatsOtherCareer,
  StatsOtherPlayer
} from '@shared/stats/types'
import type { StatsClient } from './client'
import { withPairedFamilies } from './families'
import { statsFilePath } from './files'
import { createLinksControl, linksTempDir, type LinksControl } from './links/control'
import type { LinksClient } from './links/protocol'
import { leagueDownloads, setLeagueDownloads } from './leagueDownloads'
import { offlineStats, type StatsReads } from './offline'
import { createWorkerPool, WORKER_IDLE_MS } from './workerPool'

export interface LeagueControlDeps {
  db: Db
  dataDir: string
  /** Starts a league's worker; throws when it cannot. */
  start: (league: LeagueId) => StatsClient
  /** Tells the window a league's data or downloads changed. */
  onChanged: (league: LeagueId) => void
  free?: (path: string) => number | null
  log?: (message: string, err?: unknown) => void
  /** Starts the links worker (D47); absent, leagues are not linked (tests of other behaviour). */
  startLinks?: () => LinksClient
  /** How long an unused worker stays open (`WORKER_IDLE_MS`); tests pass their own, and timers. */
  idleMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

/**
 * The stats workers, one per league with something to read (D36), and the user's choice of which
 * leagues download. A league that is on refreshes; one turned off keeps its file readable and
 * refreshes no more; one with no file and off answers that it has no data. Deleting a league's file
 * is its own action, for a league that is off. A league's worker opens when something reads or
 * refreshes the league and closes when idle (`workerPool.ts`, D22's addition of 2026-11-22).
 */
export interface LeagueControl {
  /** A league's worker; null when it has none open. */
  client(league: LeagueId): StatsClient | null
  /** The league on screen, whose worker stays open while it has not refreshed (D22's addition). */
  onScreen(league: LeagueId): void
  /** What answers a league's reads: its worker, or the answers of a league with none. */
  reads(league: LeagueId): StatsReads
  downloads(): LeagueDownloads
  /** At launch: a refresh of each league that is on, each opening its worker. */
  open(): void
  /** Refreshes a league if it is on; each file still decides if it is due. */
  refresh(league: LeagueId): void
  refreshAll(): void
  /** Saves the choice, starts what was turned on and stops refreshing what was turned off. */
  setDownloads(choice: Partial<Record<LeagueId, boolean>>): Promise<LeagueDownloads>
  /** Closes a league's worker and deletes its file; refused for a league that is on. */
  deleteFile(league: LeagueId): Promise<LeagueDownloads>
  /** A player's career in the other league of the pair, from the links file (T1304.2). */
  otherCareer(league: LeagueId, player: string): Promise<StatsOtherCareer>
  /** The paired league's linked players with no page in this league, from the links file (T1304.4). */
  otherPlayers(league: LeagueId): Promise<StatsOtherPlayer[]>
  /** The links worker's control, for scripts and tests; null when leagues are not linked. */
  links: LinksControl | null
  close(): Promise<unknown>
}

export function createLeagueControl(deps: LeagueControlDeps): LeagueControl {
  const log =
    deps.log ?? ((m, err) => (err === undefined ? console.info(m) : console.error(m, err)))
  /** Leagues whose worker could not start: their stats are off, and the app says so. */
  const failed = new Set<LeagueId>()
  const downloads = (): LeagueDownloads => leagueDownloads(deps.db, deps.dataDir, deps.free)
  const stateOf = (league: LeagueId): LeagueDownload =>
    downloads().leagues.find((l) => l.league === league)!
  // A league with something to read: on (its file is made by its load), or off with its file kept.
  const canOpen = (league: LeagueId): boolean => {
    const state = stateOf(league)
    return state.on || state.hasData
  }

  const pool = createWorkerPool({
    canOpen,
    start: (league) => {
      try {
        const client = deps.start(league)
        failed.delete(league)
        return client
      } catch (err) {
        failed.add(league)
        log(`could not start the ${leagueOf(league).name} stats worker; its stats are off`, err)
        throw err
      }
    },
    idleMs: deps.idleMs ?? WORKER_IDLE_MS,
    log,
    setTimer: deps.setTimer,
    clearTimer: deps.clearTimer
  })
  const acquire = (league: LeagueId): Promise<StatsClient | null> =>
    pool.acquire(league).catch(() => null)

  const links: LinksControl | null = deps.startLinks
    ? createLinksControl({
        tempDir: linksTempDir(deps.dataDir),
        start: deps.startLinks,
        // The paired league's worker opens for the step if it is closed; `linkAfter` holds it.
        client: (league) => (canOpen(league) ? acquire(league) : Promise.resolve(null)),
        idleMs: deps.idleMs ?? WORKER_IDLE_MS,
        setTimer: deps.setTimer,
        clearTimer: deps.clearTimer,
        log
      })
    : null

  // The links step follows the league's refresh and never fails it (D47): it logs its own errors.
  // Both leagues of the pair are held open while it runs.
  const linkAfter = async (league: LeagueId, client: StatsClient): Promise<void> => {
    if (!links) return
    const status = await client.status().catch(() => null)
    if (!status?.available || status.paused || status.noRoom) return
    const pair = pairOf(league)
    const releases = pair ? [pair.college, pair.pro].map((l) => pool.hold(l)) : []
    try {
      const done = await links.afterRefresh(league)
      if (done) deps.onChanged(league)
    } finally {
      for (const release of releases) release()
    }
  }

  const refresh = (league: LeagueId): void => {
    if (!stateOf(league).on) return
    const release = pool.hold(league)
    void (async () => {
      const client = await acquire(league)
      if (!client) return
      try {
        const result = await client.refresh()
        pool.refreshed(
          league,
          result.steps.some((s) => s.rowsWritten > 0)
        )
        deps.onChanged(league)
        await linkAfter(league, client)
      } catch (err) {
        log(`the ${league} stats refresh failed`, err)
      }
    })().finally(release)
  }

  // Every read of a league with a file goes through its worker, opened for it and held while it runs.
  // A closed league's status is the one it gave as it closed, so reading it does not open the worker.
  const throughPool = (id: LeagueId): StatsReads => {
    const league = leagueOf(id)
    const names = Object.keys(offlineStats(league, null)) as (keyof StatsReads)[]
    const reads = {} as Record<string, (...args: unknown[]) => Promise<unknown>>
    for (const name of names) {
      reads[name] = async (...args: unknown[]) => {
        if (name === 'status' && !pool.running(id)) {
          const cached = pool.cachedStatus(id)
          if (cached) return cached
        }
        const call = (target: StatsReads): Promise<unknown> =>
          (target[name] as (...a: unknown[]) => Promise<unknown>)(...args)
        const release = pool.hold(id)
        try {
          const client = await acquire(id)
          // No worker could open: the answers of a league with none, as before (stats off).
          if (!client) return call(offlineStats(league, failed.has(id) ? null : league.noData))
          return await call(client as unknown as StatsReads)
        } finally {
          release()
        }
      }
    }
    return reads as unknown as StatsReads
  }

  return {
    client: (league) => pool.running(league),
    onScreen: (league) => pool.setOnScreen(leagueOf(league).id),
    reads(id) {
      const league = leagueOf(id)
      const open = canOpen(league.id)
      const reads: StatsReads = open
        ? throughPool(league.id)
        : offlineStats(league, failed.has(league.id) ? null : league.noData)
      if (!links) return reads
      // The Data panel lists the paired files under the league that brings them (D48); asking for
      // them starts the links worker only for a league that has a worker.
      return {
        ...reads,
        data: async () => {
          const report = await reads.data()
          const paired = await links.pairedFamilies(league.id, open).catch((err) => {
            log(`could not read the ${league.name}'s paired files`, err)
            return []
          })
          return { ...report, families: withPairedFamilies(report.families, paired) }
        }
      }
    },
    downloads,
    open() {
      this.refreshAll()
    },
    refresh,
    refreshAll() {
      for (const state of downloads().leagues) if (state.on) refresh(state.league)
    },
    async setDownloads(choice) {
      const before = new Map(downloads().leagues.map((l) => [l.league, l.on]))
      setLeagueDownloads(deps.db, choice)
      for (const state of downloads().leagues) {
        const was = before.get(state.league)
        if (state.on && !was) {
          log(`stats: ${state.league} turned on`)
          refresh(state.league)
        } else if (!state.on && was) {
          log(`stats: ${state.league} turned off`)
          // Closing interrupts a running refresh, which resumes from where it was if turned on again.
          // The file stays readable until it is deleted: the next read opens it again.
          await pool.stop(state.league)
        }
        if (state.on !== was) deps.onChanged(state.league)
      }
      return downloads()
    },
    async deleteFile(league) {
      if (stateOf(league).on) throw new Error(`Turn the ${leagueOf(league).name} off first.`)
      await pool.stop(league)
      const entry = LEAGUES[league]
      const paths = [statsFilePath(deps.dataDir, entry)]
      if (entry.formerStatsFile) paths.push(join(deps.dataDir, entry.formerStatsFile))
      for (const path of paths)
        for (const file of [path, `${path}.wal`]) rmSync(file, { force: true })
      log(`stats: deleted ${LEAGUES[league].statsFile}`)
      deps.onChanged(league)
      return downloads()
    },
    otherCareer(league, player) {
      if (!links) return Promise.reject(new Error('players are not linked in this build'))
      return links.otherCareer(leagueOf(league).id, player)
    },
    otherPlayers(league) {
      if (!links) return Promise.reject(new Error('players are not linked in this build'))
      return links.otherPlayers(leagueOf(league).id)
    },
    links,
    close: () => {
      // Before any worker closes, so a links step it interrupts is not taken for a failure.
      links?.closing()
      return Promise.allSettled([pool.closeAll(), links?.close()])
    }
  }
}
