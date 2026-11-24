import type { League } from '@shared/leagues'
import type { GameType, StatsOfficialsSeason, StatsStatus } from '@shared/stats/types'
import type { StatsClient } from './client'
import { catalogueInfo } from './engine/registry'
import { noDataResult } from './engine/run'
import { summariseFamilies } from './families'
import { LEFT_OUT_RELEASES, SOURCES_BY_LEAGUE } from './sources'

/**
 * What a screen reads: a league's worker less what starts, checks or stops it. A league with no worker
 * has no officials' season to give, which the screen reads as none.
 */
export type StatsReads = Omit<
  StatsClient,
  'refresh' | 'selfTest' | 'close' | 'officialsSeason' | 'linkSide' | 'linkLines'
> & {
  officialsSeason(season: number, gameTypes: GameType[]): Promise<StatsOfficialsSeason | null>
}

/** What the nav shows when the stats worker is off. */
export const STATS_OFF: StatsStatus = {
  available: false,
  through: null,
  updatedAt: null,
  builtAt: null,
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

export const STATS_ARE_OFF = 'The stats are off on this computer.'

/**
 * The answers for a league with nothing to read, given the reason: one that is off with no file
 * (`League.noData`), or with its tables not built (`League.notBuilt`), where the engine still checks a
 * query and answers it with the reason, never an error. With no reason, the league's worker could not
 * start: the app runs and says the stats are off. Either way the Data panel lists the league's
 * releases, none loaded. Nothing here opens a file.
 */
export function offlineStats(league: League, reason: string | null = league.noData): StatsReads {
  const noData = reason !== null
  const off = (): Promise<never> => Promise.reject(new Error(reason ?? STATS_ARE_OFF))
  return {
    status: () => Promise.resolve(noData ? { ...STATS_OFF, noData: reason } : STATS_OFF),
    data: () =>
      Promise.resolve({
        families: summariseFamilies(
          SOURCES_BY_LEAGUE[league.id],
          league.currentSeason(new Date()),
          new Map(),
          new Map(),
          LEFT_OUT_RELEASES
        ),
        databaseBytes: 0,
        freeBytes: null
      }),
    pause: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    query: (query) =>
      noData
        ? Promise.resolve().then(() =>
            noDataResult(
              query,
              { league, currentSeason: league.currentSeason(new Date()) },
              reason ?? undefined
            )
          )
        : off(),
    // The catalogue needs no file: in a league with no data it is the league's own, its coverage and
    // reasons as stated, so the Glossary reads it; every query answers why there is nothing.
    catalogue: () => Promise.resolve(noData ? catalogueInfo(league) : []),
    seasons: () => Promise.resolve([]),
    player: () => Promise.resolve(null),
    playerIndex: () => Promise.resolve([]),
    games: () => Promise.resolve([]),
    game: () => Promise.resolve(null),
    standings: () => Promise.resolve([]),
    matchups: () => Promise.resolve({ guarded: [], guardedBy: [], source: 'season' }),
    gameMatchups: () => Promise.resolve({ pairs: [], reason: reason }),
    officialsSeason: () => Promise.resolve(null),
    officialCareer: () => Promise.resolve(null),
    onCourtUnits: () => Promise.resolve({ units: [], reason: reason }),
    withOrWithout: () =>
      Promise.resolve({
        teamId: null,
        teammate: null,
        teammates: [],
        splits: null,
        reason: reason
      }),
    lineups: () => Promise.resolve({ units: [], floorMinutes: null }),
    profile: () =>
      Promise.resolve({
        bio: null,
        draft: null,
        draftYears: null,
        combines: [],
        combineYears: null
      }),
    availability: () => Promise.resolve([]),
    ratingHistory: (player) =>
      Promise.resolve({ playerId: player, series: [], reason: reason ?? STATS_ARE_OFF }),
    gameListings: () => Promise.resolve([]),
    attributeValues: () => Promise.resolve([]),
    coaches: () => Promise.resolve([]),
    shots: () =>
      Promise.resolve({
        shots: [],
        total: 0,
        made: 0,
        capped: false,
        zones: [],
        reason: reason
      }),
    assists: () => Promise.resolve({ pairs: [], total: 0, reason: reason }),
    gameFlow: () =>
      Promise.resolve({
        points: [],
        periods: league.periods[league.periods.length - 1].periods,
        homeTeam: '',
        awayTeam: '',
        summary: null,
        reason: reason
      })
  }
}
