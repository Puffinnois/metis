import { afterEach, describe, expect, it } from 'vitest'
import { gamesToQualify, perGameQualifier } from '@/lib/stats/boards'
import { defaultDay, eloView, noBoxNote } from '@/lib/stats/games'
import { setLeague } from '@/lib/stats/league'
import { lineupGap, lineupHeading, lineupNotes } from '@/lib/stats/lineups'
import { DERIVED_NOTE, derivedNote, unitsNote } from '@/lib/stats/onCourt'
import { typeTag } from '@/lib/stats/player'
import { leaderboardQualifier, leaderRuleWords } from '@/lib/stats/qualifying'
import { inLeague } from '@/lib/stats/league'
import { splitDefs } from '@/lib/stats/player'
import { teamPoolQuery } from '@/lib/stats/team'
import { MOMENTS, momentsIn } from '@/lib/stats/splits'
import { METRICS, metricIn } from '@shared/stats/catalogue'
import {
  defaultScope,
  queryScope,
  seasonTypes,
  typeLabel,
  type StatsScope
} from '@/lib/stats/scope'
import { strengthNote, strengthQuery } from '@/lib/stats/standings'
import { LEAGUES } from '@shared/leagues'
import type { StatsGame, StatsSeason } from '@shared/stats/types'

/**
 * What the screens read differently in the college leagues before their data (Plan T1302.2): the
 * events as season types, every game by default, the NCAA tournament's name, the 75 % games rule, and
 * the NBA and the WNBA as they were.
 */
afterEach(() => setLeague('nba'))

describe('words a college screen must not take from the NBA (T1302.9)', () => {
  it('names the shot chart file and the leader stats’ rule by league', () => {
    expect(LEAGUES.nba.shotsFile).toBeUndefined()
    expect(LEAGUES.wnba.shotsFile).toBeUndefined()
    expect(LEAGUES.ncaam.shotsFile).toBe('stats.ncaa.org’s shot file')
    expect(LEAGUES.ncaaw.shotsFile).toBe('stats.ncaa.org’s shot file')
    expect(leaderRuleWords(LEAGUES.nba).note).toBe(
      'the NBA’s leader stats need only their own minimum'
    )
    expect(leaderRuleWords(LEAGUES.wnba).clause).toBe(
      'or the NBA’s own minimum alone for its leader stats'
    )
    for (const league of [LEAGUES.ncaam, LEAGUES.ncaaw]) {
      const words = leaderRuleWords(league)
      expect(`${words.note} ${words.clause}`).not.toContain('NBA')
    }
  })

  it('names stats.ncaa.org’s shot file in section notes and the catalogue', () => {
    const note = 'From the {league}’s shot chart file, {shotsFrom}'
    expect(inLeague(note, LEAGUES.ncaam)).toBe('From stats.ncaa.org’s shot file, 2021-22 on')
    expect(inLeague(note, LEAGUES.wnba)).toBe(
      'From the WNBA’s shot chart file, 1997 on, located from 2011'
    )
    const zone = [...METRICS.values()].find((m) => m.sources?.includes("The NBA's shot chart file"))
    expect(zone).toBeDefined()
    expect(metricIn(zone!, LEAGUES.ncaaw).sources).toEqual(["stats.ncaa.org's shot file"])
    expect(metricIn(zone!, LEAGUES.nba).sources).toEqual(["The NBA's shot chart file"])
  })

  it('offers the men no quarter among the Moments, and names the play by play’s source', () => {
    setLeague('ncaam')
    const men = momentsIn().map((m) => m.label)
    expect(men.some((l) => /quarter/.test(l))).toBe(false)
    expect(men).toContain('2nd half')
    setLeague('ncaaw')
    expect(momentsIn()).toEqual(MOMENTS)
    setLeague('nba')
    expect(momentsIn()).toEqual(MOMENTS)
    const play = [...METRICS.values()].find((m) => m.sources?.includes("The NBA's play by play"))
    expect(metricIn(play!, LEAGUES.ncaam).sources).toEqual(["stats.ncaa.org's play by play"])
  })

  it('leaves out the All-Star break, which the colleges never have', () => {
    setLeague('ncaam')
    expect(splitDefs(undefined).some((d) => d.group === 'All-Star break')).toBe(false)
    setLeague('nba')
    expect(splitDefs(undefined).filter((d) => d.group === 'All-Star break')).toHaveLength(2)
  })

  it('asks for every Division I team on a team page', () => {
    const scope: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }
    setLeague('ncaaw')
    expect(teamPoolQuery(['team_ortg'], scope, 'perGame').limit).toBe(500)
    setLeague('nba')
    expect(teamPoolQuery(['team_ortg'], scope, 'perGame').limit).toBe(40)
  })
})

const season = (types: StatsGame['type'][]): StatsSeason =>
  ({
    season: 2026,
    firstDate: '2025-11-03',
    lastDate: '2026-04-06',
    types: types.map((type) => ({ type, games: 10 })),
    teams: []
  }) as StatsSeason

const game = (type: StatsGame['type'], date: string, season = 2026): StatsGame => ({
  id: date,
  season,
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
    // November: a season with only its regular season so far still opens on every game (D45), so the
    // career by season counts every game of the past seasons, as the strip and the leaderboards do.
    expect(defaultScope([season(['regular'])], null).seasonType).toBe('counted')
    expect(seasonTypes(season(['regular']))).toEqual(['regular', 'counted'])
    expect(typeLabel('counted')).toBe('Every game')
    // Its numbers are the regular season's: every counted type, of which only that one has games.
    expect(queryScope(defaultScope([season(['regular'])], null), 'player').gameTypes).toEqual([
      ...LEAGUES.ncaam.countedTypes
    ])
    setLeague('ncaaw')
    expect(defaultScope([season(['regular'])], null).seasonType).toBe('counted')
    // The NBA and the WNBA stay as they were: no "after" to offer until there is one.
    setLeague('nba')
    expect(defaultScope(seasons, null).seasonType).toBe('regular')
    expect(defaultScope([season(['regular'])], null).seasonType).toBe('regular')
    expect(seasonTypes(season(['regular']))).toEqual(['regular'])
    setLeague('wnba')
    expect(seasonTypes(season(['regular']))).toEqual(['regular'])
    expect(defaultScope([season(['regular'])], null).seasonType).toBe('regular')
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

  it('says on screen what the source the screens read covers, in place of the NBA’s notes (policy 4)', () => {
    const scope: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }
    for (const id of ['ncaam', 'ncaaw'] as const) {
      setLeague(id)
      const note = LEAGUES[id].onCourtNote ?? ''
      // The play by play since T1302.7 (`COLLEGE_ON_COURT_FROM`), with its measured coverage.
      expect(note).toMatch(/stats\.ncaa\.org's play by play/)
      expect(note).toMatch(/every minute of a game is covered/)
      expect(note).not.toMatch(/97 %/)
      expect(derivedNote()).toBe(note)
      expect(unitsNote()).toBe(
        'Every unit of five distinct players the play by play names on the floor, from 2021-22.'
      )
      // The units are built, so the heading says from what, not that the league publishes them.
      expect(lineupHeading(5)).toBe('Five-man units, from stats.ncaa.org’s play by play')
      expect(lineupNotes(scope, null, 'raw')).toEqual([note])
      expect(lineupNotes(scope, null, 'per100')).toEqual([
        note,
        'Per 100 divides by the possessions the play by play counts.'
      ])
    }
    // The NBA's and the WNBA's notes as they were.
    for (const id of ['nba', 'wnba'] as const) {
      setLeague(id)
      expect(derivedNote()).toBe(DERIVED_NOTE)
      expect(unitsNote()).toBe(
        'Every unit of five distinct players the lineups know, in every season from 1996-97.'
      )
      expect(lineupNotes(scope, 11.9, 'raw')[0]).toMatch(/2,000 five-man units/)
      expect(lineupHeading(5)).toBe(`Five-man units, as the ${LEAGUES[id].name} publishes them`)
      expect(lineupHeading(2)).toBe(`Two-man groups, as the ${LEAGUES[id].name} publishes them`)
    }
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

  it('says the per-game leaders ask the share and the shooting leaders the NCAA’s makes per game', () => {
    setLeague('ncaaw')
    expect(leaderboardQualifier()).toBe(
      "Qualified: 833 minutes over 82 games, scaled to the games in range; per-game leaders by 75 % of the team's games, the league's own rule; shooting leaders and the assist-to-turnover ratio by made per game in 75 % of the team's games, the NCAA's minimums as its champions show them"
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

describe('the models (T1302.8)', () => {
  it('reads Elo from 2022-23 and says the standings’ columns rate Division I games alone', () => {
    setLeague('ncaam')
    expect(eloView(game('regular', '2022-01-10', 2022), null)).toEqual({
      rows: [],
      note: 'Elo is read from 2022-23: every team starts at 1500 in 2021-22, so 2021-22 settles the ratings.'
    })
    // Not loaded yet: nothing to say.
    expect(eloView(game('regular', '2026-01-10'), null)).toBeNull()
    // The standings' own columns cover every Division I team over every counted game; the NBA's stay
    // its 30 teams' regular season.
    expect(strengthQuery(2026, LEAGUES.ncaam)).toMatchObject({
      limit: 500,
      scope: { seasons: [2026], gameTypes: [...LEAGUES.ncaam.countedTypes] }
    })
    expect(strengthQuery(2026, LEAGUES.nba)).toMatchObject({
      limit: 40,
      scope: { seasons: [2026], gameTypes: ['regular'] }
    })
    expect(strengthNote(LEAGUES.ncaam)).toBe(
      'PYTH W, SRS, SOS and ELO are computed by Metis from the final scores: Pythagorean wins over every game with the exponent 8.6, SRS, the strength of schedule and Elo on games between Division I teams alone, after the last game. A game against a team outside Division I counts in the record, not in the ratings.'
    )
  })
})
