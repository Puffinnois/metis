import { afterEach, describe, expect, it } from 'vitest'
import { gamesToQualify } from '@/lib/stats/boards'
import { periodTable } from '@/lib/stats/games'
import { setLeague } from '@/lib/stats/league'
import { leaderboardQualifier, rowMinutes, rowQualifier } from '@/lib/stats/qualifying'
import { hasDivisions, standingsTables, standingsViews } from '@/lib/stats/standings'
import { LEAGUES } from '@shared/leagues'
import type { StatsGame, StatsGameDetail, StatsStanding } from '@shared/stats/types'

/** What the screens' logic reads differently on the WNBA's real shapes (Plan T1301.6). */
afterEach(() => setLeague('nba'))

const game = (season: number): StatsGame => ({
  id: 'g',
  season,
  type: 'regular',
  date: `${season}-07-01`,
  played: true,
  hasBox: true,
  overtimes: null,
  home: { id: '1', code: 'NYL', name: 'New York Liberty', score: 70 },
  away: { id: '2', code: 'LAS', name: 'Los Angeles Sparks', score: 68 }
})

const detail = (home: number[], away: number[]): StatsGameDetail => ({
  id: 'g',
  venue: null,
  city: null,
  attendance: null,
  note: null,
  periods: { home, away },
  officials: [],
  elo: null
})

describe('the score by period, by the season’s format', () => {
  it('names two halves and an overtime before 2006', () => {
    setLeague('wnba')
    // 2005: 31 + 32 in the halves, 7 in overtime.
    const t = periodTable(game(2005), detail([31, 32, 7], [30, 33, 5]))
    expect(t?.head).toEqual(['1', '2', 'OT', 'T'])
  })

  it('names four quarters and the overtimes from 2006, as the NBA’s', () => {
    setLeague('wnba')
    const t = periodTable(game(2026), detail([20, 20, 15, 10, 3, 2], [18, 22, 15, 10, 3, 0]))
    expect(t?.head).toEqual(['1', '2', '3', '4', 'OT', '2OT', 'T'])
  })
})

const team = (over: Partial<StatsStanding>): StatsStanding => ({
  teamId: '1611661322',
  code: 'WAS',
  name: 'Washington Mystics',
  conference: 'East',
  division: null,
  conferenceRank: 3,
  divisionRank: null,
  wins: 22,
  losses: 12,
  winPct: 0.647,
  conferenceGamesBack: 1,
  divisionGamesBack: null,
  home: '12-5',
  road: '10-7',
  conferenceRecord: null,
  divisionRecord: null,
  last10: '8-2',
  streak: 'L 1',
  pointsPerGame: 84.5,
  allowedPerGame: 81.9,
  differential: 2.6,
  ...over
})

describe('standings with conferences and no divisions', () => {
  // 2018, as the dashboards publish it: the forfeit counted in Washington's 22-12.
  const rows = [
    team({}),
    team({ teamId: '1611661330', code: 'ATL', name: 'Atlanta Dream', conferenceRank: 2 }),
    team({
      teamId: '1611661319',
      code: 'LVA',
      name: 'Las Vegas Aces',
      conference: 'West',
      conferenceRank: 9,
      wins: 14,
      losses: 20
    })
  ]

  it('offers the conference view alone, and reads a division view as it', () => {
    expect(hasDivisions(rows)).toBe(false)
    expect(standingsViews(rows)).toEqual(['conference'])
    const tables = standingsTables(rows, 'division')
    expect(tables.map((t) => t.title)).toEqual(['East', 'West'])
    expect(tables[0].rows.map((r) => r.code)).toEqual(['ATL', 'WAS'])
    // Before rows arrive, both are offered, as before.
    expect(standingsViews(null)).toEqual(['conference', 'division'])
    expect(standingsViews([team({ division: 'Atlantic' })])).toEqual(['conference', 'division'])
  })
})

describe('the qualifier, as the league states it', () => {
  it('asks 58 games of 82, scaled: 24 of a 34-game season, 31 of a 44-game one', () => {
    setLeague('wnba')
    expect(gamesToQualify(34)).toBe(24)
    expect(gamesToQualify(44)).toBe(31)
    setLeague('nba')
    expect(gamesToQualify(82)).toBe(58)
  })

  it('states the row minimum in the league’s game length, and the WNBA’s as provisional', () => {
    expect(rowMinutes(LEAGUES.nba)).toBe(1000)
    expect(rowMinutes(LEAGUES.wnba)).toBe(833)
    expect(rowQualifier(LEAGUES.nba)).toBe('1,000 minutes over 82 games')
    expect(rowQualifier(LEAGUES.wnba)).toBe('833 minutes over 82 games')
    expect(leaderboardQualifier(LEAGUES.nba)).toBe(
      "Qualified: 1,000 minutes over 82 games, scaled to the games in range; the NBA's leader stats by their own minimum"
    )
    expect(leaderboardQualifier(LEAGUES.wnba)).toBe(
      "Qualified: 833 minutes over 82 games, scaled to the games in range; the NBA's leader stats by their own minimum, scaled, until the WNBA's own are read"
    )
  })
})
