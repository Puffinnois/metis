import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import type {
  MetricInfo,
  StatsGame,
  StatsGameDetail,
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
  const [status, setStatus] = useState<StatsStatus | null>(null)
  const [catalogue, setCatalogue] = useState<MetricInfo[]>([])
  const [seasons, setSeasons] = useState<StatsSeason[]>([])
  const [error, setError] = useState<string | null>(null)
  const version = status?.builtAt ?? null

  useEffect(() => {
    const read = (): void => {
      void api.stats
        .status()
        .then(setStatus)
        .catch((err) => setError(errorMessage(err)))
    }
    read()
    return api.stats.onChanged(read)
  }, [])

  useEffect(() => {
    if (!version) return
    let alive = true
    void Promise.all([api.stats.catalogue(), api.stats.seasons()])
      .then(([c, s]) => {
        if (!alive) return
        setCatalogue(c)
        setSeasons(s)
      })
      .catch((err) => alive && setError(errorMessage(err)))
    return () => {
      alive = false
    }
  }, [version])

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
  const key = query ? `${version}|${JSON.stringify(query)}` : null
  const [done, setDone] = useState<{
    key: string
    result: StatsResult | null
    error: string | null
  } | null>(null)
  useEffect(() => {
    if (!key) return
    let cancelled = false
    api.stats
      .query(JSON.parse(key.slice(key.indexOf('|') + 1)) as StatsQuery)
      .then((result) => !cancelled && setDone({ key, result, error: null }))
      .catch((err) => !cancelled && setDone({ key, result: null, error: errorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [key])
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
  const key = queries ? `${version}|${JSON.stringify([...queries])}` : null
  const [done, setDone] = useState<{
    key: string
    results: ReadonlyMap<string, StatsResult> | null
    error: string | null
  } | null>(null)
  useEffect(() => {
    if (!key) return
    let cancelled = false
    const entries = JSON.parse(key.slice(key.indexOf('|') + 1)) as [string, StatsQuery][]
    Promise.all(entries.map(([, q]) => api.stats.query(q)))
      .then((answers) => {
        if (cancelled) return
        setDone({ key, results: new Map(entries.map(([k], i) => [k, answers[i]])), error: null })
      })
      .catch((err) => !cancelled && setDone({ key, results: null, error: errorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [key])
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

/** One read of the database, again when `key` changes (null: nothing to read). */
function useRead<T>(key: string | null, read: () => Promise<T>): ReadState<T> {
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
      .current()
      .then((value) => !cancelled && setDone({ key, value, error: null }))
      .catch((err) => !cancelled && setDone({ key, value: null, error: errorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [key])
  return done !== null && done.key === key
    ? { value: done.value, error: done.error, loading: false }
    : { value: null, error: null, loading: key !== null }
}

export const usePlayerInfo = (
  player: string | null,
  version: string | null
): ReadState<StatsPlayerInfo | null> =>
  useRead(player === null ? null : `${version}|${player}`, () => api.stats.player(player ?? ''))

export const useSeasonGames = (season: number, version: string | null): ReadState<StatsGame[]> =>
  useRead(`${version}|${season}`, () => api.stats.games(season))

export const useGameDetail = (
  game: string | null,
  version: string | null
): ReadState<StatsGameDetail | null> =>
  useRead(game === null ? null : `${version}|${game}`, () => api.stats.game(game ?? ''))

export const useStandings = (season: number, version: string | null): ReadState<StatsStanding[]> =>
  useRead(`${version}|${season}`, () => api.stats.standings(season))
