import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import type { Favourite } from '@shared/favourites'
import type { LeagueId } from '@shared/leagues'
import type { GameType, StatsGame, StatsResult, StatsSeason } from '@shared/stats/types'
import {
  counts,
  favouriteDays,
  gameLines,
  OUT_METRICS,
  sectionQueries,
  teamGameOn,
  topScorerQuery,
  type GameLine
} from './favouritesPage'

/**
 * One league's section of the Favourites page, read on its own (D50): its status, latest season,
 * schedule and catalogue, then the favourite players' and teams' games of that season by game. Every
 * read names the league (the API takes it first), so reading another league's section never switches
 * the app's league or touches its screens' state; the main process opens that league's worker for the
 * read and closes it once idle (D22's addition). A slow or failed league never blocks another: each
 * section has its own loading and error. Nothing refreshes on its own (D31); a league's refresh read
 * again only when the app tells it changed.
 */
export interface SectionData {
  league: LeagueId
  status: 'loading' | 'error' | 'ready'
  error: string | null
  season: StatsSeason | null
  through: string | null
  games: StatsGame[]
  byGame: Map<string, StatsGame>
  players: Map<string, GameLine[]>
  teams: Map<string, GameLine[]>
  /** The days its favourites had a game, in order. */
  days: string[]
  /** The metrics the league has, for a blank cell's reason. */
  known: Set<string>
  /** How long the section's reads took, for the measurement. */
  ms: number | null
}

const empty = (league: LeagueId): SectionData => ({
  league,
  status: 'loading',
  error: null,
  season: null,
  through: null,
  games: [],
  byGame: new Map(),
  players: new Map(),
  teams: new Map(),
  days: [],
  known: new Set(),
  ms: null
})

const merge = (results: StatsResult[]): StatsResult | null =>
  results.length
    ? {
        ...results[0],
        rows: results.flatMap((r) => r.rows),
        total: results.reduce((t, r) => t + r.total, 0)
      }
    : null

export function useFavouritesSection(
  league: LeagueId,
  favourites: readonly Favourite[],
  enabled: boolean,
  version: number
): SectionData {
  const [held, setHeld] = useState<{ key: string; data: SectionData } | null>(null)
  const players = useMemo(
    () => favourites.filter((f) => f.kind === 'player').map((f) => f.id),
    [favourites]
  )
  const teams = useMemo(
    () => favourites.filter((f) => f.kind === 'team').map((f) => f.id),
    [favourites]
  )
  const key = `${league}|${players.join(',')}|${teams.join(',')}|${version}`
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const started = performance.now()
    void (async () => {
      try {
        const [status, seasons, catalogue] = await Promise.all([
          api.stats.status(league),
          api.stats.seasons(league),
          api.stats.catalogue(league)
        ])
        const season = seasons[0] ?? null
        if (!season) {
          if (alive)
            setHeld({
              key,
              data: { ...empty(league), status: 'ready', through: status.through?.date ?? null }
            })
          return
        }
        const games = await api.stats.games(league, season.season)
        const byGame = new Map(games.map((g) => [g.id, g]))
        const types = [...new Set(games.filter(counts).map((g) => g.type))] as GameType[]
        const known = new Set(catalogue.map((m) => m.id))
        const withOut = OUT_METRICS.every((m) => known.has(m))
        const q = sectionQueries(
          season.season,
          types.length ? types : ['regular'],
          players,
          teams,
          withOut
        )
        const [p, t] = await Promise.all([
          Promise.all(q.players.map((x) => api.stats.query(league, x))),
          Promise.all(q.teams.map((x) => api.stats.query(league, x)))
        ])
        const playerLogs = gameLines(merge(p), byGame, 'player')
        const teamLogs = gameLines(merge(t), byGame, 'team')
        if (!alive) return
        setHeld({
          key,
          data: {
            league,
            status: 'ready',
            error: null,
            season,
            through: status.through?.date ?? null,
            games,
            byGame,
            players: playerLogs,
            teams: teamLogs,
            days: favouriteDays(playerLogs, teams, games),
            known,
            ms: Math.round(performance.now() - started)
          }
        })
      } catch (err) {
        if (alive) {
          setHeld({ key, data: { ...empty(league), status: 'error', error: errorMessage(err) } })
        }
      }
    })()
    return () => {
      alive = false
    }
    // `key` holds the league, the ids and the version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])
  // A read for other ids or another league shows as loading until it answers.
  return held && held.key === key ? held.data : empty(league)
}

/** The top scorer of each favourite team's game on the day, read once the day is known. */
export function useTopScorers(
  section: SectionData,
  teamIds: readonly string[],
  day: string | null
): StatsResult | null {
  const games = useMemo(() => {
    if (section.status !== 'ready' || day === null) return []
    return [
      ...new Set(
        teamIds.flatMap((t) => {
          const g = teamGameOn(t, day, section.games)
          return g && g.played ? [g.id] : []
        })
      )
    ]
  }, [section, teamIds, day])
  const [result, setResult] = useState<{ key: string; value: StatsResult | null } | null>(null)
  const key = `${section.league}|${games.join(',')}`
  useEffect(() => {
    const q = section.season
      ? topScorerQuery(section.season.season, games, [
          ...new Set(games.map((id) => section.byGame.get(id)?.type).filter(Boolean))
        ] as GameType[])
      : null
    if (!q) return
    let alive = true
    void api.stats
      .query(section.league, q)
      .then((value) => alive && setResult({ key, value }))
      .catch(() => alive && setResult({ key, value: null }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return result && result.key === key ? result.value : null
}
