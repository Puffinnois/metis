import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import { useLeague } from '@/lib/stats/league'
import type { LeagueId } from '@shared/leagues'
import type { LineupGroup } from '@shared/stats/lineups'
import type {
  StatsAssistRequest,
  StatsAssistNetwork,
  StatsGameFlow,
  StatsShotRequest,
  StatsShotChart,
  MetricInfo,
  StatsGame,
  StatsGameDetail,
  StatsLineups,
  StatsMatchups,
  StatsMatchupScope,
  StatsGameMatchups,
  StatsOfficialCareer,
  StatsOnCourtScope,
  StatsOnCourtUnits,
  StatsWithOrWithout,
  StatsOfficialsSeason,
  GameType,
  StatsProfile,
  StatsAvailability,
  StatsCoach,
  StatsPlayerInfo,
  StatsQuery,
  StatsResult,
  StatsSeason,
  StatsStanding,
  StatsStatus
} from '@shared/stats/types'

/** What every stats screen reads once: the status, the catalogue, what each season holds. */
export interface StatsData {
  status: StatsStatus | null
  catalogue: MetricInfo[]
  byId: ReadonlyMap<string, MetricInfo>
  seasons: StatsSeason[]
  /** When the tables were last built: a new value means the numbers changed, so screens query again. */
  version: string | null
  error: string | null
}

/**
 * Loads the shared data and keeps it current. The status is read as a load progresses, which is every
 * file; the seasons and every query only when the tables have been built again.
 */
export function useStatsData(): StatsData {
  const league = useLeague().id
  const [status, setStatus] = useState<StatsStatus | null>(null)
  const [catalogue, setCatalogue] = useState<MetricInfo[]>([])
  const [seasons, setSeasons] = useState<StatsSeason[]>([])
  const [error, setError] = useState<string | null>(null)
  const version = status?.builtAt ?? null

  useEffect(() => {
    const read = (): void => {
      void api.stats
        .status(league)
        .then(setStatus)
        .catch((err) => setError(errorMessage(err)))
    }
    read()
    // Another league's refresh changes nothing on this one's screens.
    return api.stats.onChanged((changed) => changed === league && read())
  }, [league])

  useEffect(() => {
    if (!version) return
    let alive = true
    void Promise.all([api.stats.catalogue(league), api.stats.seasons(league)])
      .then(([c, s]) => {
        if (!alive) return
        setCatalogue(c)
        setSeasons(s)
      })
      .catch((err) => alive && setError(errorMessage(err)))
    return () => {
      alive = false
    }
  }, [version, league])

  const byId = useMemo(() => new Map(catalogue.map((m) => [m.id, m])), [catalogue])
  return { status, catalogue, byId, seasons, version, error }
}

export interface QueryState {
  /** The last answer: it stays on screen while the next one loads, unless `keepLast` is off. */
  result: StatsResult | null
  loading: boolean
  error: string | null
}

/**
 * Runs `query` (null: nothing to run), and again when it or `version` changes. An answer for a query
 * that has since changed is dropped. A dashboard turns `keepLast` off: it is about one player or team,
 * so another's numbers never stand in while its own load.
 */
export function useStatsQuery(
  query: StatsQuery | null,
  version: string | null,
  { keepLast = true }: { keepLast?: boolean } = {}
): QueryState {
  const league = useLeague().id
  const key = query ? `${league}|${version}|${JSON.stringify(query)}` : null
  const [done, setDone] = useState<{
    key: string
    result: StatsResult | null
    error: string | null
  } | null>(null)
  useEffect(() => {
    if (!key) return
    let cancelled = false
    const [asked, , ...text] = key.split('|')
    api.stats
      .query(asked as LeagueId, JSON.parse(text.join('|')) as StatsQuery)
      .then((result) => !cancelled && setDone({ key, result, error: null }))
      .catch((err) => !cancelled && setDone({ key, result: null, error: errorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [key, league])
  const current = done !== null && done.key === key
  return {
    result: keepLast || current ? (done?.result ?? null) : null,
    loading: key !== null && !current,
    error: current ? done.error : null
  }
}

export interface QueriesState {
  /** Every answer by its key, once all are in; null until then. */
  results: ReadonlyMap<string, StatsResult> | null
  error: string | null
}

/** Several queries answered together: a table of splits. Keyed on their text, like `useStatsQuery`. */
export function useStatsQueries(
  queries: ReadonlyMap<string, StatsQuery> | null,
  version: string | null
): QueriesState {
  const league = useLeague().id
  const key = queries ? `${league}|${version}|${JSON.stringify([...queries])}` : null
  const [done, setDone] = useState<{
    key: string
    results: ReadonlyMap<string, StatsResult> | null
    error: string | null
  } | null>(null)
  useEffect(() => {
    if (!key) return
    let cancelled = false
    const [asked, , ...text] = key.split('|')
    const entries = JSON.parse(text.join('|')) as [string, StatsQuery][]
    Promise.all(entries.map(([, q]) => api.stats.query(asked as LeagueId, q)))
      .then((answers) => {
        if (cancelled) return
        setDone({ key, results: new Map(entries.map(([k], i) => [k, answers[i]])), error: null })
      })
      .catch((err) => !cancelled && setDone({ key, results: null, error: errorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [key, league])
  return done !== null && done.key === key
    ? { results: done.results, error: done.error }
    : { results: null, error: null }
}

export interface ReadState<T> {
  /** Null until it is read; another key's value is never shown. */
  value: T | null
  error: string | null
  loading: boolean
}

/**
 * One read of the league on screen, again when `key` or the league changes (null: nothing to read).
 */
function useRead<T>(bare: string | null, read: (league: LeagueId) => Promise<T>): ReadState<T> {
  const league = useLeague().id
  const key = bare === null ? null : `${league}|${bare}`
  const [done, setDone] = useState<{ key: string; value: T | null; error: string | null } | null>(
    null
  )
  const latest = useRef(read)
  useEffect(() => {
    latest.current = read
  })
  useEffect(() => {
    if (key === null) return
    let cancelled = false
    latest
      .current(league)
      .then((value) => !cancelled && setDone({ key, value, error: null }))
      .catch((err) => !cancelled && setDone({ key, value: null, error: errorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [key, league])
  return done !== null && done.key === key
    ? { value: done.value, error: done.error, loading: false }
    : { value: null, error: null, loading: key !== null }
}

export const usePlayerInfo = (
  player: string | null,
  version: string | null
): ReadState<StatsPlayerInfo | null> =>
  useRead(player === null ? null : `${version}|${player}`, (league) =>
    api.stats.player(league, player ?? '')
  )

export const useSeasonGames = (season: number, version: string | null): ReadState<StatsGame[]> =>
  useRead(`${version}|${season}`, (league) => api.stats.games(league, season))

export const useGameDetail = (
  game: string | null,
  version: string | null
): ReadState<StatsGameDetail | null> =>
  useRead(game === null ? null : `${version}|${game}`, (league) =>
    api.stats.game(league, game ?? '')
  )

export const useStandings = (season: number, version: string | null): ReadState<StatsStanding[]> =>
  useRead(`${version}|${season}`, (league) => api.stats.standings(league, season))

/** A player's matchups in a season and scope; null as the key when there is nothing to read. */
export const useMatchups = (
  player: string | null,
  season: number,
  scope: StatsMatchupScope | undefined,
  version: string | null
): ReadState<StatsMatchups> =>
  useRead(
    player === null ? null : `${version}|${player}|${season}|${JSON.stringify(scope ?? null)}`,
    (league) => api.stats.matchups(league, player ?? '', season, scope)
  )

/** Who guarded whom in a game; null as the game when there is nothing to read. */
export const useGameMatchups = (
  game: string | null,
  version: string | null
): ReadState<StatsGameMatchups> =>
  useRead(game === null ? null : `${version}|${game}`, (league) =>
    api.stats.gameMatchups(league, game ?? '')
  )

/** Every official of a season; null as the season when there is nothing to read. */
export const useOfficialsSeason = (
  season: number | null,
  gameTypes: GameType[],
  version: string | null
): ReadState<StatsOfficialsSeason | null> =>
  useRead(season === null ? null : `${version}|${season}|${gameTypes.join(',')}`, (league) =>
    api.stats.officialsSeason(league, season ?? 0, gameTypes)
  )

/** One official's seasons; null as the official when there is nothing to read. */
export const useOfficialCareer = (
  official: string | null,
  gameTypes: GameType[],
  version: string | null
): ReadState<StatsOfficialCareer | null> =>
  useRead(official === null ? null : `${version}|${official}|${gameTypes.join(',')}`, (league) =>
    api.stats.officialCareer(league, official ?? '', gameTypes)
  )

/** A team's groups of one size on the floor; null as the team when there is nothing to read. */
export const useOnCourtUnits = (
  team: string | null,
  season: number,
  scope: StatsOnCourtScope,
  size: number,
  version: string | null
): ReadState<StatsOnCourtUnits> =>
  useRead(
    team === null ? null : `${version}|${team}|${season}|${size}|${JSON.stringify(scope)}`,
    (league) => api.stats.onCourtUnits(league, team ?? '', season, scope, size)
  )

/** A player's team with a teammate on and off; null as the player when there is nothing to read. */
export const useWithOrWithout = (
  player: string | null,
  teammate: string | null,
  season: number,
  scope: StatsOnCourtScope,
  version: string | null
): ReadState<StatsWithOrWithout> =>
  useRead(
    player === null ? null : `${version}|${player}|${teammate}|${season}|${JSON.stringify(scope)}`,
    (league) => api.stats.withOrWithout(league, player ?? '', teammate, season, scope)
  )

/** A team's five-man units with one dashboard's measures; null as the team when there is nothing to read. */
export const useLineups = (
  team: string | null,
  season: number,
  gameType: string,
  group: LineupGroup,
  version: string | null
): ReadState<StatsLineups> =>
  useRead(team === null ? null : `${version}|${team}|${season}|${gameType}|${group}`, (league) =>
    api.stats.lineups(league, team ?? '', season, gameType, group)
  )

/** The shots a chart draws; null as the request when there is nothing to read. */
export const useShots = (
  request: StatsShotRequest | null,
  version: string | null
): ReadState<StatsShotChart> =>
  useRead(request === null ? null : `${version}|${JSON.stringify(request)}`, (league) =>
    api.stats.shots(league, request as StatsShotRequest)
  )

/** Who assisted whom for a team or a player; null as the request when there is nothing to read. */
export const useAssists = (
  request: StatsAssistRequest | null,
  version: string | null
): ReadState<StatsAssistNetwork> =>
  useRead(request === null ? null : `${version}|${JSON.stringify(request)}`, (league) =>
    api.stats.assists(league, request as StatsAssistRequest)
  )

/** One game's scoring in order and its flow; null when no game is open. */
export const useGameFlow = (
  game: string | null,
  version: string | null
): ReadState<StatsGameFlow> =>
  useRead(game === null ? null : `${version}|flow|${game}`, (league) =>
    api.stats.gameFlow(league, game as string)
  )

/** Players' status on the latest injury report; none to read is a key of null. */
export const useAvailability = (
  players: string[],
  version: string | null
): ReadState<StatsAvailability[]> =>
  useRead(players.length === 0 ? null : `${version}|${players.join(',')}`, (league) =>
    api.stats.availability(league, players)
  )

/** A team's coaches for a season. */
export const useCoaches = (
  team: string,
  season: number,
  version: string | null
): ReadState<StatsCoach[]> =>
  useRead(`${version}|${team}|${season}`, (league) => api.stats.coaches(league, team, season))

/** A player's bio, draft and combines. */
export const useProfile = (player: string, version: string | null): ReadState<StatsProfile> =>
  useRead(`${version}|${player}`, (league) => api.stats.profile(league, player))
