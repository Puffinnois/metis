import { join } from 'node:path'
import { LEAGUES, pairedLeague, pairOf, type LeagueId } from '@shared/leagues'
import type { StatsFamily, StatsOtherCareer, StatsOtherPlayer } from '@shared/stats/types'
import type { StatsClient } from '../client'
import { summarisePairedFamilies } from '../families'
import { PAIRED_SOURCES_BY_LEAGUE } from '../sources'
import type { LinksClient, LinksStepResult } from './protocol'
import { handoverDir } from './service'

export interface LinksControlDeps {
  /** The links worker's own temp folder, under the data folder: `stats-tmp/links`. */
  tempDir: string
  /** Starts the links worker; throws when it cannot. */
  start: () => LinksClient
  /** A league's worker, when it has one. */
  client: (league: LeagueId) => StatsClient | null
  log?: (message: string, err?: unknown) => void
  /** Names each hand-over; tests pass their own. */
  now?: () => number
}

/**
 * The links worker and the steps that feed it (D47): it starts only when there is something to do (a
 * league of a pair refreshed, or a read for such a league), and a league's links step never fails its
 * refresh, which has already finished: an error is logged, recorded for the Data panel, and the next
 * refresh tries again. Steps run one at a time, whichever league asks.
 */
export interface LinksControl {
  /**
   * After a league's refresh: the paired files it brings, its side of the pair, then Metis's own lines
   * of the linked players of each league of the pair that has a worker. Null for a league in no pair.
   */
  afterRefresh(league: LeagueId): Promise<LinksStepResult | null>
  otherCareer(league: LeagueId, player: string): Promise<StatsOtherCareer>
  /** The paired league's linked players with no page in this league, for its search (T1304.4). */
  otherPlayers(league: LeagueId): Promise<StatsOtherPlayer[]>
  /** The paired files a league brings, for its Data panel; started only if `start` is true. */
  pairedFamilies(league: LeagueId, start: boolean): Promise<StatsFamily[]>
  /** The running worker, for scripts; null when it has not started. */
  running(): LinksClient | null
  close(): Promise<void>
}

export function createLinksControl(deps: LinksControlDeps): LinksControl {
  const log =
    deps.log ?? ((m, err) => (err === undefined ? console.info(m) : console.error(m, err)))
  const now = deps.now ?? Date.now
  let links: LinksClient | null = null
  let ready: Promise<LinksClient> | null = null
  let chain: Promise<unknown> = Promise.resolve()
  let count = 0

  // The worker empties its temp folder when it opens, so nothing is handed over before it answers.
  const ensure = (): Promise<LinksClient> => {
    ready ??= (async () => {
      const client = deps.start()
      try {
        await client.ping()
      } catch (err) {
        ready = null
        throw err
      }
      links = client
      return client
    })()
    return ready
  }

  const step = async (league: LeagueId): Promise<LinksStepResult | null> => {
    const pair = pairOf(league)
    const own = deps.client(league)
    if (!pair || !own) return null
    const client = await ensure()
    const dir = handoverDir(deps.tempDir)
    const tag = `${now()}-${++count}`
    try {
      const steps = await client.refreshPaired(league)
      const side = await own.linkSide(dir, tag)
      if (side) await client.ingestSide(side)
      for (const each of [pair.college, pair.pro]) {
        const worker = deps.client(each)
        if (!worker) continue
        const ids = await client.linkedIds(each)
        const lines = await worker.linkLines(ids, dir, `${tag}-lines`)
        if (lines) await client.ingestLines(lines)
      }
      return { league, steps, links: await client.counts(league) }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(`the ${LEAGUES[league].name}'s links step failed; the next refresh tries again`, err)
      await client.failed(league, message).catch(() => undefined)
      return null
    }
  }

  return {
    afterRefresh(league) {
      const run = chain.then(() => step(league))
      chain = run.catch(() => undefined)
      return run.catch((err) => {
        log(`the links worker could not start`, err)
        return null
      })
    },
    async otherCareer(league, player) {
      return (await ensure()).otherCareer(league, player)
    },
    async otherPlayers(league) {
      return (await ensure()).otherPlayers(league)
    },
    async pairedFamilies(league, start) {
      const other = pairedLeague(league)
      if (!other) return []
      if (!start && !links) {
        return summarisePairedFamilies(
          PAIRED_SOURCES_BY_LEAGUE[league],
          LEAGUES[other].currentSeason(new Date()),
          new Map(),
          new Map()
        )
      }
      return (await ensure()).pairedFamilies(league)
    },
    running: () => links,
    async close() {
      const client = ready ? await ready.catch(() => null) : null
      ready = null
      links = null
      await client?.close()
    }
  }
}

/** The links worker's temp folder in the data folder, beside the leagues' own. */
export const linksTempDir = (dataDir: string): string => join(dataDir, 'stats-tmp', 'links')
