import type { League } from '@shared/leagues'
import type { GameType, StatsOfficialsSeason, StatsStatus } from '@shared/stats/types'
import type { StatsClient } from './client'
import { catalogueInfo } from './engine/registry'
import { noDataResult } from './engine/run'

/**
 * What a screen reads: a league's worker less what starts, checks or stops it. A league with no worker
 * has no officials' season to give, which the screen reads as none.
 */
export type StatsReads = Omit<StatsClient, 'refresh' | 'selfTest' | 'close' | 'officialsSeason'> & {
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
 * The answers for a league with no worker: one with no data yet (`League.hasData` false), where the
 * engine still checks a query and answers it with the reason, never an error; or one whose worker
 * could not start, where the app runs and says the stats are off. Nothing here opens a file.
 */
export function offlineStats(league: League): StatsReads {
  const noData = !league.hasData
  const off = (): Promise<never> =>
    Promise.reject(new Error(noData ? league.noData : STATS_ARE_OFF))
  return {
    status: () => Promise.resolve(noData ? { ...STATS_OFF, noData: league.noData } : STATS_OFF),
    data: off,
    pause: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    query: (query) =>
      noData
        ? Promise.resolve().then(() =>
            noDataResult(query, { league, currentSeason: league.currentSeason(new Date()) })
          )
        : off(),
    // The catalogue needs no file: in a league with no data every metric reads why.
    catalogue: () => Promise.resolve(noData ? catalogueInfo(league) : []),
    seasons: () => Promise.resolve([]),
    player: () => Promise.resolve(null),
    games: () => Promise.resolve([]),
    game: () => Promise.resolve(null),
    standings: () => Promise.resolve([]),
    matchups: () => Promise.resolve({ guarded: [], guardedBy: [], source: 'season' }),
    gameMatchups: () => Promise.resolve({ pairs: [], reason: noData ? league.noData : null }),
    officialsSeason: () => Promise.resolve(null),
    officialCareer: () => Promise.resolve(null),
    onCourtUnits: () => Promise.resolve({ units: [], reason: noData ? league.noData : null }),
    withOrWithout: () =>
      Promise.resolve({
        teamId: null,
        teammate: null,
        teammates: [],
        splits: null,
        reason: noData ? league.noData : null
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
    coaches: () => Promise.resolve([]),
    shots: () =>
      Promise.resolve({
        shots: [],
        total: 0,
        made: 0,
        capped: false,
        zones: [],
        reason: noData ? league.noData : null
      }),
    assists: () => Promise.resolve({ pairs: [], total: 0, reason: noData ? league.noData : null }),
    gameFlow: () =>
      Promise.resolve({
        points: [],
        periods: league.periods[league.periods.length - 1].periods,
        homeTeam: '',
        awayTeam: '',
        summary: null,
        reason: noData ? league.noData : null
      })
  }
}
