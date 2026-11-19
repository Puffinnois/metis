import { afterEach, describe, expect, it } from 'vitest'
import { gamesToQualify, perGameQualifier } from '@/lib/stats/boards'
import { defaultDay, eloView, noBoxNote } from '@/lib/stats/games'
import { setLeague } from '@/lib/stats/league'
import { lineupGap } from '@/lib/stats/lineups'
import { typeTag } from '@/lib/stats/player'
import { leaderboardQualifier } from '@/lib/stats/qualifying'
import { defaultScope, seasonTypes, typeLabel, type StatsScope } from '@/lib/stats/scope'
import { strengthNote } from '@/lib/stats/standings'
import { LEAGUES } from '@shared/leagues'
import type { StatsGame, StatsSeason } from '@shared/stats/types'

/**
 * What the screens read differently in the college leagues before their data (Plan T1302.2): the
 * events as season types, every game by default, the NCAA tournament's name, the 75 % games rule, and
 * the NBA and the WNBA as they were.
 */
afterEach(() => setLeague('nba'))

const season = (types: StatsGame['type'][]): StatsSeason =>
  ({
    season: 2026,
    firstDate: '2025-11-03',
    lastDate: '2026-04-06',
    types: types.map((type) => ({ type, games: 10 })),
    teams: []
  }) as StatsSeason

const game = (type: StatsGame['type'], date: string): StatsGame => ({
  id: date,
  season: 2026,
  type,
  date,
  played: true,
  hasBox: true,
  overtimes: null,
  home: { id: '1', code: 'DUKE', name: 'Duke', score: 70 },
  away: { id: '2', code: 'UNC', name: 'North Carolina', score: 68 }
})

describe('season types in the college leagues (D45)', () => {
  it('names the NCAA tournament, every game together and each event', () => {
    setLeague('ncaam')
    expect(typeLabel('playoffs')).toBe('NCAA tournament')
    expect(typeLabel('counted')).toBe('Every game')
    expect(typeLabel('nit')).toBe('NIT')
    expect(typeLabel('crown')).toBe('College Basketball Crown')
    expect(typeTag('playoffs')).toBe('NCAA tournament')
    expect(typeTag('cbi')).toBe('CBI')
    setLeague('ncaaw')
    expect(typeLabel('wbit')).toBe('WBIT')
    expect(typeTag('wnit')).toBe('WNIT')
  })

  it('call exhibitions so, never offer them as a scope, and say why their box score is not shown', () => {
    setLeague('ncaam')
    expect(typeTag('preseason')).toBe('Exhibition')
    expect(seasonTypes(season(['regular', 'playoffs', 'preseason']))).toEqual([
      'regular',
      'playoffs',
      'counted'
    ])
    expect(noBoxNote(game('preseason', '2025-11-01'), null)).toBe(
      'Exhibitions do not count, and their box scores are not shown.'
    )
    setLeague('nba')
    expect(typeTag('preseason')).toBe('Preseason')
    expect(noBoxNote(game('preseason', '2025-10-02'), null)).toBe(
      'Preseason games have no box score in either source.'
    )
  })

  it('keeps the NBA’s and the WNBA’s names as they were', () => {
    expect(typeLabel('playoffs')).toBe('Playoffs')
    expect(typeLabel('counted')).toBe('Regular season and after')
    expect(typeLabel('cup-final')).toBe('NBA Cup final')
    expect(typeTag('playoffs')).toBe('Playoffs')
    expect(typeTag('cup-final')).toBe('Cup final')
    setLeague('wnba')
    expect(typeLabel('cup-final')).toBe("Commissioner's Cup final")
    expect(typeTag('cup-final')).toBe('Cup final')
  })

  it('offers every event a season has, and every game, in the registry’s order', () => {
    setLeague('ncaam')
    expect(seasonTypes(season(['regular', 'nit', 'playoffs']))).toEqual([
      'regular',
      'playoffs',
      'nit',
      'counted'
    ])
  })

  it('starts a college scope on every game, the NBA’s on the regular season', () => {
    const seasons = [season(['regular', 'playoffs', 'nit'])]
    setLeague('ncaam')
    expect(defaultScope(seasons, null).seasonType).toBe('counted')
    // A season with only its regular season so far has no "every game" to offer.
    expect(defaultScope([season(['regular'])], null).seasonType).toBe('regular')
    setLeague('nba')
    expect(defaultScope(seasons, null).seasonType).toBe('regular')
  })

  it('opens a college day on the latest game of any event', () => {
    setLeague('ncaaw')
    const games = [game('regular', '2026-03-01'), game('wbit', '2026-03-20')]
    expect(defaultDay(games)).toBe('2026-03-20')
    // The NBA counts the same types as before: an All-Star Game is not the day it opens on.
    setLeague('nba')
    expect(defaultDay([game('regular', '2026-02-10'), game('all-star', '2026-02-15')])).toBe(
      '2026-02-10'
    )
  })

  it('names the NCAA tournament where the lineups say what is published', () => {
    const scope: StatsScope = { season: 2026, seasonType: 'counted', range: { kind: 'season' } }
    setLeague('ncaam')
    expect(lineupGap(scope)).toBe(
      'The NCAA Men publishes the regular season and the NCAA tournament apart: pick one.'
    )
    setLeague('nba')
    expect(lineupGap(scope)).toBe(
      'The NBA publishes the regular season and the playoffs apart: pick one.'
    )
  })
})

describe('the 75 % games rule on screen (D43)', () => {
  it('asks 75 % of the team’s games on the home and its cards, rounded up', () => {
    setLeague('ncaam')
    expect(gamesToQualify(31)).toBe(24)
    expect(gamesToQualify(32)).toBe(24)
    expect(gamesToQualify(35)).toBe(27)
    expect(perGameQualifier(2026)).toBe(
      "Per game: 75 % of the team's games to qualify, the league's own rule"
    )
  })

  it('says the per-game leaders ask the share and the shooting leaders the NBA’s makes', () => {
    setLeague('ncaaw')
    expect(leaderboardQualifier()).toBe(
      "Qualified: 833 minutes over 82 games, scaled to the games in range; per-game leaders by 75 % of the team's games, the league's own rule; shooting leaders by the NBA's makes, scaled, until the NCAA's own are read"
    )
  })

  it('leaves the NBA’s and the WNBA’s words and counts as they were', () => {
    expect(gamesToQualify(82)).toBe(58)
    expect(perGameQualifier(2026)).toBe('Per game: 58 games of 82 to qualify')
    expect(leaderboardQualifier()).toBe(
      "Qualified: 1,000 minutes over 82 games, scaled to the games in range; the NBA's leader stats by their own minimum"
    )
    setLeague('wnba')
    expect(gamesToQualify(44)).toBe(31)
    expect(perGameQualifier(2026)).toBe(
      "Per game: 31 games of 44 to qualify, the NBA's minimum scaled, until the WNBA's own are read"
    )
  })
})

describe('no models yet', () => {
  it('rates no college game and says the standings’ own columns are not computed yet', () => {
    setLeague('ncaam')
    expect(eloView(game('regular', '2026-01-10'), null)).toBeNull()
    expect(strengthNote(LEAGUES.ncaam)).toBe(
      "PYTH W, SRS, SOS and ELO are Metis's own, not computed for the NCAA Men yet."
    )
  })
})
