import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import type {
  MetricInfo,
  StatsQuery,
  StatsResult,
  StatsSeason,
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
  /** The last answer: it stays on screen while the next one loads. */
  result: StatsResult | null
  loading: boolean
  error: string | null
}

/**
 * Runs `query` (null: nothing to run), and again when it or `version` changes. An answer for a query
 * that has since changed is dropped.
 */
export function useStatsQuery(query: StatsQuery | null, version: string | null): QueryState {
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
    result: done?.result ?? null,
    loading: key !== null && !current,
    error: current ? done.error : null
  }
}
