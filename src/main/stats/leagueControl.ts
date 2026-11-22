import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '@main/db/connection'
import { LEAGUES, leagueOf, type LeagueId } from '@shared/leagues'
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
}

/**
 * The stats workers, one per league with something to read (D36), and the user's choice of which
 * leagues download. A league that is on has a worker and refreshes; one turned off keeps a worker to
 * read the file it has, and refreshes no more; one with no file and off has none, and answers that it
 * has no data. Deleting a league's file is its own action, for a league that is off.
 */
export interface LeagueControl {
  /** A league's worker; null when it has none. */
  client(league: LeagueId): StatsClient | null
  /** What answers a league's reads: its worker, or the answers of a league with none. */
  reads(league: LeagueId): StatsReads
  downloads(): LeagueDownloads
  /** At launch: a worker for each league with data, and a refresh of each that is on. */
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
  const clients = new Map<LeagueId, StatsClient>()
  /** Leagues whose worker could not start: their stats are off, and the app says so. */
  const failed = new Set<LeagueId>()
  const downloads = (): LeagueDownloads => leagueDownloads(deps.db, deps.dataDir, deps.free)
  const stateOf = (league: LeagueId): LeagueDownload =>
    downloads().leagues.find((l) => l.league === league)!

  const startWorker = (league: LeagueId): StatsClient | null => {
    const running = clients.get(league)
    if (running) return running
    try {
      const client = deps.start(league)
      clients.set(league, client)
      failed.delete(league)
      return client
    } catch (err) {
      failed.add(league)
      log(`could not start the ${leagueOf(league).name} stats worker; its stats are off`, err)
      return null
    }
  }

  const stopWorker = async (league: LeagueId): Promise<void> => {
    const client = clients.get(league)
    if (!client) return
    clients.delete(league)
    // Closing interrupts a running refresh, which resumes from where it was if turned on again.
    await client.close().catch((err) => log(`closing the ${league} stats worker failed`, err))
  }

  const links: LinksControl | null = deps.startLinks
    ? createLinksControl({
        tempDir: linksTempDir(deps.dataDir),
        start: deps.startLinks,
        client: (league) => clients.get(league) ?? null,
        log
      })
    : null

  // The links step follows the league's refresh and never fails it (D47): it logs its own errors.
  const linkAfter = async (league: LeagueId, client: StatsClient): Promise<void> => {
    if (!links) return
    const status = await client.status().catch(() => null)
    if (!status?.available || status.paused || status.noRoom) return
    const done = await links.afterRefresh(league)
    if (done) deps.onChanged(league)
  }

  const refresh = (league: LeagueId): void => {
    if (!stateOf(league).on) return
    const client = clients.get(league) ?? startWorker(league)
    client?.refresh().then(
      () => {
        deps.onChanged(league)
        void linkAfter(league, client)
      },
      (err) => log(`the ${league} stats refresh failed`, err)
    )
  }

  return {
    client: (league) => clients.get(league) ?? null,
    reads(id) {
      const league = leagueOf(id)
      const client = clients.get(league.id)
      const reads: StatsReads =
        client ?? offlineStats(league, failed.has(league.id) ? null : league.noData)
      if (!links) return reads
      // The Data panel lists the paired files under the league that brings them (D48); asking for
      // them starts the links worker only for a league that has a worker.
      return {
        ...reads,
        data: async () => {
          const report = await reads.data()
          const paired = await links
            .pairedFamilies(league.id, client !== undefined)
            .catch((err) => {
              log(`could not read the ${league.name}'s paired files`, err)
              return []
            })
          return { ...report, families: withPairedFamilies(report.families, paired) }
        }
      }
    },
    downloads,
    open() {
      for (const state of downloads().leagues) {
        if (state.hasData) startWorker(state.league)
      }
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
          await stopWorker(state.league)
          // The file stays readable until it is deleted.
          if (state.hasFile) startWorker(state.league)
        }
        if (state.on !== was) deps.onChanged(state.league)
      }
      return downloads()
    },
    async deleteFile(league) {
      if (stateOf(league).on) throw new Error(`Turn the ${leagueOf(league).name} off first.`)
      await stopWorker(league)
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
      return Promise.allSettled([
        ...[...clients.keys()].map((league) => stopWorker(league)),
        links?.close()
      ])
    }
  }
}
