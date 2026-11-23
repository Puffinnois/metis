import { createContext, useContext, useEffect, useState } from 'react'
import { useLeague } from '@/lib/stats/league'
import type { NavLocation } from '@/lib/navHistory'
import { DEFAULT_CHART, type ChartState } from './chart'
import { DEFAULT_COMPARE, type CompareState } from './compare'
import { DEFAULT_EXPLORE_TAB, type ExploreSubject, type ExploreTab } from './explore'
import { DEFAULT_GAMES, type GamesState } from './games'
import type { LeaderboardOpen } from './leaderboard'
import type { PlayerTab } from './player'
import type { StatsScope } from './scope'
import type { StatsScreen } from './screens'
import type { TeamTab } from './team'
import { DEFAULT_TRENDS, type TrendsState } from './trends'
import type { LeagueId } from '@shared/leagues'

/**
 * What each league keeps for the session (D35: each league comes back as it was left). The shell holds
 * one of these for the league on screen; a switch keeps it and opens the other league's, or a fresh one
 * from that league's own defaults, so a value one league lacks (per 48 in a 40-minute league, the
 * play-in in the WNBA, an NBA season) never crosses over. Nothing here outlives the app.
 */
export interface LeagueSession {
  /** The scope chosen on screen; null until one is, so the league's latest season is the default. */
  chosen: StatsScope | null
  /** The player dashboard's player; null until one is shown, so the league's leading scorer is. */
  player: string | null
  playerTab: PlayerTab
  /** The team dashboard's team; null until one is shown, so the best record in scope is. */
  team: string | null
  teamTab: TeamTab
  games: GamesState
  exploreTab: ExploreTab
  chart: ChartState
  compare: CompareState
  trends: TrendsState
  /** The player or team a dashboard showed last, which Trends opens on. */
  lastShown: ExploreSubject | null
  /** What opened a leaderboard last (a board's "All →", a saved view). */
  open: LeaderboardOpen | null
}

/** A league's session before anything is chosen in it: every value its screens' own default. */
export function freshSession(): LeagueSession {
  return {
    chosen: null,
    player: null,
    playerTab: 'overview',
    team: null,
    teamTab: 'overview',
    games: DEFAULT_GAMES,
    exploreTab: DEFAULT_EXPLORE_TAB,
    chart: DEFAULT_CHART,
    compare: DEFAULT_COMPARE,
    trends: DEFAULT_TRENDS,
    lastShown: null,
    open: null
  }
}

/**
 * Where the sessions live: one store for the app, above the shell, which is built again for each
 * league (App provides it). A shell rendered alone, as in a test, makes its own.
 */
export interface SessionStore {
  sessions: Map<LeagueId, LeagueSession>
  /** The screen on show is the app's, not a league's: a switch keeps it. */
  screen: StatsScreen
  /** What each screen keeps while it is on show, by league (`useScreenState`). */
  onScreen: Map<string, unknown>
  /**
   * The Favourites page's day, chosen this session (D50): the app's, not a league's, so a move into
   * another league's section and Back find the page on the day it was left. Null: the latest.
   */
  favouritesDay?: string | null
}

export const createSessionStore = (): SessionStore => ({
  sessions: new Map(),
  screen: 'home',
  onScreen: new Map()
})

export const SessionContext = createContext<SessionStore | null>(null)

/** The session a league was left with, or null when it has not been on screen yet. */
export const sessionOf = (store: SessionStore, league: LeagueId): LeagueSession | null =>
  store.sessions.get(league) ?? null

/** Keeps the Favourites page's day for the session (D50), whichever league is on screen. */
export function keepFavouritesDay(store: SessionStore | null, day: string | null): void {
  if (store) store.favouritesDay = day
}

/** Keeps a league's session as it stands on screen. */
export function keepSession(store: SessionStore, league: LeagueId, session: LeagueSession): void {
  store.sessions.set(league, session)
}

/**
 * The switch rule (D35, `docs/reference/stats-screens.md`, "League menu"): a switch keeps the screen.
 * A screen about one subject (a player's or team's dashboard, a game, Compare's picks) shows the new
 * league's own subject as it was left there, or the screen's default when it has none yet (the leading
 * scorer, the best record, the latest day's games, nobody picked). It never carries the old league's
 * subject over, since a player, team or game id belongs to one league.
 */
export function locationAfterSwitch(
  screen: StatsScreen,
  to: LeagueId,
  kept: LeagueSession | null
): NavLocation {
  return locationOf(to, screen, {
    player: kept?.player ?? null,
    team: kept?.team ?? null,
    game: kept?.games.game ?? null
  })
}

/** The page on screen, for Back: the league, the screen and, on a dashboard or a game, its subject. */
export function locationOf(
  league: LeagueId,
  screen: StatsScreen,
  subject: { player: string | null; team: string | null; game: string | null }
): NavLocation {
  const player = screen === 'player' ? subject.player : null
  const game = screen === 'games' ? subject.game : null
  return {
    league,
    screen,
    team: screen === 'team' ? subject.team : null,
    player: player === null ? null : { id: player, position: null },
    ...(game === null ? {} : { game })
  }
}

const onScreenKey = (screen: StatsScreen, league: LeagueId, name: string): string =>
  `${screen}|${league}|${name}`

/**
 * Another screen is on show: what the others kept goes, in every league. A screen's own state lasts
 * while it is on show, as it always has, and a league switch on the same screen keeps each league's.
 */
export function showScreen(store: SessionStore, screen: StatsScreen): void {
  store.screen = screen
  for (const key of [...store.onScreen.keys()]) {
    if (!key.startsWith(`${screen}|`)) store.onScreen.delete(key)
  }
}

/**
 * A screen's own state (a leaderboard's board, the home's per-game switch, the Glossary's filters),
 * kept by league while that screen stays on show. Outside a shell, a screen rendered alone, it is
 * plain state.
 */
export function useScreenState<T>(
  screen: StatsScreen,
  name: string,
  initial: T
): [T, (value: T) => void] {
  const store = useContext(SessionContext)
  const league = useLeague().id
  const key = onScreenKey(screen, league, name)
  const [value, setValue] = useState<T>(() =>
    store?.onScreen.has(key) ? (store.onScreen.get(key) as T) : initial
  )
  useEffect(() => {
    store?.onScreen.set(key, value)
  }, [store, key, value])
  return [value, setValue]
}
