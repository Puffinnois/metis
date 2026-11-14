import { describe, expect, it } from 'vitest'
import {
  conferenceTables,
  divisionTables,
  fmtGamesBack,
  fmtWinPct,
  fmtSigned,
  standingsNotes,
  standingsTables,
  STANDINGS_HEAD,
  STRENGTH_NOTE,
  strengthQuery,
  teamPlace
} from '@/lib/stats/standings'
import type { StatsStanding } from '@shared/stats/types'

const team = (over: Partial<StatsStanding>): StatsStanding => ({
  teamId: '1',
  code: 'BOS',
  name: 'Boston Celtics',
  conference: 'East',
  division: 'Atlantic',
  conferenceRank: 2,
  divisionRank: 1,
  wins: 56,
  losses: 26,
  winPct: 0.683,
  conferenceGamesBack: 4,
  divisionGamesBack: 0,
  home: '30-11',
  road: '26-15',
  conferenceRecord: '36-16',
  divisionRecord: '10-6',
  last10: '8-2',
  streak: 'W 2',
  pointsPerGame: 114.9,
  allowedPerGame: 107.2,
  differential: 7.7,
  ...over
})

const ROWS = [
  team({}),
  team({
    teamId: '2',
    name: 'Detroit Pistons',
    division: 'Central',
    conferenceRank: 1,
    conferenceGamesBack: 0
  }),
  team({
    teamId: '3',
    name: 'New York Knicks',
    conferenceRank: 3,
    divisionRank: 2,
    conferenceGamesBack: 7,
    divisionGamesBack: 3.5,
    differential: -0.25
  }),
  team({
    teamId: '4',
    name: 'Denver Nuggets',
    conference: 'West',
    division: 'Northwest',
    conferenceRank: 1,
    conferenceGamesBack: 0
  })
]

describe('the numbers', () => {
  it('writes a win percentage as standings do', () => {
    expect(fmtWinPct(0.683)).toBe('.683')
    expect(fmtWinPct(1)).toBe('1.000')
    expect(fmtWinPct(0)).toBe('.000')
    expect(fmtWinPct(null)).toBe('—')
  })

  it('writes the leader as a dash, and half a game when there is one', () => {
    expect(fmtGamesBack(0)).toBe('—')
    expect(fmtGamesBack(1.5)).toBe('1.5')
    expect(fmtGamesBack(4)).toBe('4')
    expect(fmtGamesBack(null)).toBe('—')
  })
})

describe('the tables', () => {
  it('lists each conference by its published rank, East first', () => {
    const tables = conferenceTables(ROWS)
    expect(tables.map((t) => t.title)).toEqual(['East', 'West'])
    expect(tables[0].rows.map((r) => [r.rank, r.name])).toEqual([
      ['1', 'Detroit Pistons'],
      ['2', 'Boston Celtics'],
      ['3', 'New York Knicks']
    ])
  })

  it('writes every column, games back by the conference', () => {
    const boston = conferenceTables(ROWS)[0].rows[1]
    expect(boston.cells).toHaveLength(STANDINGS_HEAD.length - 2)
    expect(boston.cells).toEqual([
      '56',
      '26',
      '.683',
      '4',
      '30-11',
      '26-15',
      '10-6',
      '36-16',
      '8-2',
      'W 2',
      '114.9',
      '107.2',
      '+7.7',
      '—',
      '—',
      '—',
      '—'
    ])
  })

  it('writes Metis’s strength columns when they have answered, signs shown', () => {
    const strength = new Map([['1', [57.4, 7.456, -0.1234, 1612.6]]])
    const boston = conferenceTables(ROWS, strength)[0].rows[1]
    expect(boston.cells.slice(-4)).toEqual(['57.4', '+7.46', '−0.12', '1,613'])
    expect(fmtSigned(0.001, 2)).toBe('0.00')
    expect(strengthQuery(2026)).toMatchObject({
      metrics: ['team_pyth_w', 'team_srs', 'team_sos', 'team_elo'],
      scope: { seasons: [2026], gameTypes: ['regular'] }
    })
  })

  it('lists each division that season by its rank, games back by the division', () => {
    const tables = divisionTables(ROWS)
    expect(tables.map((t) => t.title)).toEqual(['Atlantic', 'Central', 'Northwest'])
    const [atlantic] = tables
    expect(atlantic.rows.map((r) => [r.rank, r.name, r.cells[3]])).toEqual([
      ['1', 'Boston Celtics', '—'],
      ['2', 'New York Knicks', '3.5']
    ])
    expect(standingsTables(ROWS, 'division')).toEqual(tables)
    expect(standingsTables(ROWS, 'conference')).toEqual(conferenceTables(ROWS))
  })

  it('writes a real minus on a losing differential, and a dash for what is not published', () => {
    const [east] = conferenceTables(ROWS)
    expect(east.rows[2].cells.at(-5)).toBe('−0.3')
    const old = conferenceTables([team({ last10: null, streak: null, conferenceRecord: null })])
    expect(old[0].rows[0].cells.slice(7, 10)).toEqual(['—', '—', '—'])
  })

  it('keeps a team with no rank last', () => {
    const [east] = conferenceTables([
      team({ teamId: '9', name: 'Nobody', conferenceRank: null }),
      team({})
    ])
    expect(east.rows.map((r) => [r.rank, r.name])).toEqual([
      ['2', 'Boston Celtics'],
      ['', 'Nobody']
    ])
  })
})

describe('what they depend on', () => {
  it('says when the standings start', () => {
    expect(standingsNotes(1995, [])).toEqual(['Published standings start in 1995-96.'])
    expect(standingsNotes(2020, [])).toEqual([])
  })

  it('says when the last ten and the streak start', () => {
    expect(standingsNotes(2001, ROWS)).toEqual([
      'The last ten and the streak are published from 2001-02.',
      STRENGTH_NOTE
    ])
    expect(standingsNotes(2002, ROWS)).toEqual([STRENGTH_NOTE])
  })

  it('says when a season has no real conference or division records', () => {
    const rows = [team({ conferenceRecord: null, divisionRecord: null })]
    expect(standingsNotes(2004, rows)).toEqual([
      'The NBA’s file has no real conference or division records for 2003-04.',
      STRENGTH_NOTE
    ])
  })
})

describe('a team’s place', () => {
  it('reads its rank in the conference and the division', () => {
    expect(teamPlace(ROWS, '1')).toBe('2nd in the East · 1st in the Atlantic')
  })

  it('leaves out what it does not know', () => {
    expect(teamPlace(ROWS, '99')).toBeNull()
    expect(teamPlace(null, '1')).toBeNull()
    expect(teamPlace([team({ divisionRank: null })], '1')).toBe('2nd in the East')
    expect(teamPlace([team({ divisionRank: null, conferenceRank: null })], '1')).toBeNull()
  })
})
