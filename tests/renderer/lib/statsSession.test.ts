// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { currentLeague, perMinuteModes, savedLeague, setLeague } from '@/lib/stats/league'
import { defaultScope, seasonTypes } from '@/lib/stats/scope'
import {
  createSessionStore,
  freshSession,
  keepSession,
  locationAfterSwitch,
  locationOf,
  SessionContext,
  sessionOf,
  showScreen,
  useScreenState,
  type SessionStore
} from '@/lib/stats/session'
import type { StatsScreen } from '@/lib/stats/screens'
import type { StatsSeason } from '@shared/stats/types'

afterEach(() => {
  setLeague('nba')
  localStorage.clear()
})

const nbaSeason: StatsSeason = {
  season: 2026,
  firstDate: '2025-10-21',
  lastDate: '2026-06-18',
  types: [
    { type: 'regular', games: 1230 },
    { type: 'play-in', games: 6 },
    { type: 'playoffs', games: 80 }
  ],
  teams: []
}

describe('each league keeps its own session', () => {
  it('starts a league from its own defaults, not the other league’s choices', () => {
    const store = createSessionStore()
    keepSession(store, 'nba', {
      ...freshSession(),
      chosen: { season: 2016, seasonType: 'play-in', range: { kind: 'last', n: 10, of: 'team' } },
      player: '2544',
      team: '1610612747',
      games: { date: '2016-06-19', game: '0041500407' },
      exploreTab: 'compare'
    })
    expect(sessionOf(store, 'wnba')).toBeNull()
    // The shell opens a league it has not shown on a fresh session: nothing chosen, nobody picked.
    expect(freshSession()).toMatchObject({
      chosen: null,
      player: null,
      team: null,
      games: { date: null, game: null },
      exploreTab: 'chart',
      open: null
    })
    expect(sessionOf(store, 'nba')?.chosen?.season).toBe(2016)
  })

  it('gives each league back the scope it was left on', () => {
    const store = createSessionStore()
    const scope = {
      season: 2016,
      seasonType: 'playoffs' as const,
      range: { kind: 'dates' as const, from: '2016-05-01', to: '2016-06-01' }
    }
    keepSession(store, 'nba', { ...freshSession(), chosen: scope, playerTab: 'shooting' })
    keepSession(store, 'wnba', freshSession())
    expect(sessionOf(store, 'nba')).toMatchObject({ chosen: scope, playerTab: 'shooting' })
    expect(sessionOf(store, 'wnba')?.chosen).toBeNull()
  })

  it('reads a fresh league’s scope and modes from its own registry entry', () => {
    // No WNBA season loaded: its default scope is its own current season, not 2025-26.
    setLeague('wnba')
    expect(defaultScope([], null)).toEqual({
      season: new Date().getUTCFullYear(),
      seasonType: 'regular',
      range: { kind: 'season' }
    })
    expect(perMinuteModes().map((m) => m.value)).toEqual(['per36', 'per40'])
    // The play-in is the NBA's: the WNBA offers none, even for a season that had one.
    expect(seasonTypes(nbaSeason)).toEqual(['regular', 'playoffs', 'counted'])
    setLeague('nba')
    expect(perMinuteModes().map((m) => m.value)).toEqual(['per36', 'per48'])
    expect(seasonTypes(nbaSeason)).toEqual(['regular', 'play-in', 'playoffs', 'counted'])
  })

  it('keeps Compare’s picks and mode to their league', () => {
    const store = createSessionStore()
    keepSession(store, 'nba', {
      ...freshSession(),
      compare: { ...freshSession().compare, mode: 'per48' }
    })
    // Per 48 is the NBA's: the WNBA's Compare starts from its own default.
    expect(sessionOf(store, 'wnba')).toBeNull()
    expect(freshSession().compare.mode).toBe('perGame')
    expect(sessionOf(store, 'nba')?.compare.mode).toBe('per48')
  })
})

describe('the switch rule', () => {
  const nbaLeft = {
    ...freshSession(),
    player: '2544',
    team: '1610612747',
    games: { date: '2026-06-18', game: '0042500405' }
  }

  it('keeps every list screen as it is', () => {
    const lists: StatsScreen[] = [
      'home',
      'players',
      'teams',
      'standings',
      'explore',
      'glossary',
      'data'
    ]
    for (const screen of lists) {
      expect(locationAfterSwitch(screen, 'wnba', nbaLeft)).toEqual({
        league: 'wnba',
        screen,
        team: null,
        player: null
      })
    }
  })

  it('opens a dashboard on the new league’s own subject, or its default, never the old one’s', () => {
    expect(locationAfterSwitch('player', 'wnba', null).player).toBeNull()
    expect(locationAfterSwitch('team', 'wnba', null).team).toBeNull()
    const wnbaLeft = { ...freshSession(), player: '1628932', team: '1611661319' }
    expect(locationAfterSwitch('player', 'wnba', wnbaLeft)).toEqual({
      league: 'wnba',
      screen: 'player',
      team: null,
      player: { id: '1628932', position: null }
    })
    expect(locationAfterSwitch('team', 'wnba', wnbaLeft).team).toBe('1611661319')
    // Back in the NBA: the player and team it was left on.
    expect(locationAfterSwitch('player', 'nba', nbaLeft).player?.id).toBe('2544')
    expect(locationAfterSwitch('team', 'nba', nbaLeft).team).toBe('1610612747')
  })

  it('opens Games on the new league’s own game, or its day list', () => {
    expect(locationAfterSwitch('games', 'wnba', null)).toEqual({
      league: 'wnba',
      screen: 'games',
      team: null,
      player: null
    })
    expect(locationAfterSwitch('games', 'nba', nbaLeft).game).toBe('0042500405')
  })

  it('names the subject only on its own screen', () => {
    const subject = { player: '2544', team: 'LAL', game: 'g1' }
    expect(locationOf('nba', 'home', subject)).toEqual({
      league: 'nba',
      screen: 'home',
      team: null,
      player: null
    })
    expect(locationOf('nba', 'games', subject).game).toBe('g1')
  })
})

describe('a screen’s own state', () => {
  function within(store: SessionStore): (props: { children: ReactNode }) => ReactNode {
    return function Shell({ children }: { children: ReactNode }) {
      return createElement(SessionContext.Provider, { value: store }, children)
    }
  }

  it('keeps each league’s while the screen stays on show, and drops it when another opens', () => {
    const store = createSessionStore()
    const wrapper = within(store)
    showScreen(store, 'glossary')
    const first = renderHook(() => useScreenState('glossary', 'search', ''), { wrapper })
    act(() => first.result.current[1]('usage'))
    first.unmount()
    // The switch: the WNBA's Glossary starts from its own default.
    setLeague('wnba')
    const wnba = renderHook(() => useScreenState('glossary', 'search', ''), { wrapper })
    expect(wnba.result.current[0]).toBe('')
    wnba.unmount()
    // And back: the NBA's search as it was left.
    setLeague('nba')
    const back = renderHook(() => useScreenState('glossary', 'search', ''), { wrapper })
    expect(back.result.current[0]).toBe('usage')
    back.unmount()
    // Another screen opens: the Glossary's state goes, as a screen's own state always has.
    showScreen(store, 'home')
    showScreen(store, 'glossary')
    const again = renderHook(() => useScreenState('glossary', 'search', ''), { wrapper })
    expect(again.result.current[0]).toBe('')
    expect(store.screen).toBe('glossary')
  })

  it('keeps what the screen being opened set, whichever runs first', () => {
    const store = createSessionStore()
    const wrapper = within(store)
    // The leaderboard keeps its board before the shell says the screen changed.
    const board = renderHook(() => useScreenState('players', 'board', 'default'), { wrapper })
    act(() => board.result.current[1]('sorted by usage'))
    board.unmount()
    showScreen(store, 'players')
    const after = renderHook(() => useScreenState('players', 'board', 'default'), { wrapper })
    expect(after.result.current[0]).toBe('sorted by usage')
  })

  it('is plain state outside a shell', () => {
    const alone = renderHook(() => useScreenState('glossary', 'search', 'x'))
    act(() => alone.result.current[1]('y'))
    expect(alone.result.current[0]).toBe('y')
  })
})

describe('the league on screen', () => {
  it('is remembered for the next launch', () => {
    expect(savedLeague()).toBe('nba')
    setLeague('wnba')
    expect(currentLeague().id).toBe('wnba')
    expect(savedLeague()).toBe('wnba')
  })

  it('opens on the NBA when nothing, or a league it does not know, is saved', () => {
    localStorage.setItem('metis.league', 'euroleague')
    expect(savedLeague()).toBe('nba')
    localStorage.removeItem('metis.league')
    expect(savedLeague()).toBe('nba')
  })
})
