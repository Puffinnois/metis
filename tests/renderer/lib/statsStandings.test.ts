import { describe, expect, it } from 'vitest'
import {
  conferenceTables,
  divisionTables,
  fmtGamesBack,
  fmtOdds,
  fmtProjected,
  forecastCells,
  forecastNote,
  forecastQuery,
  standingsHead,
  fmtWinPct,
  fmtSigned,
  standingsNotes,
  standingsTables,
  STANDINGS_HEAD,
  standingsColumns,
  strengthNote,
  strengthQuery,
  teamPlace
} from '@/lib/stats/standings'
import { LEAGUES } from '@shared/leagues'
import type { MetricValue, StatsStanding } from '@shared/stats/types'

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
  const STRENGTH_NOTE = strengthNote(LEAGUES.nba)

  it('says when the standings start, and when a season has none', () => {
    expect(standingsNotes(1995, [])).toEqual(['Published standings start in 1995-96.'])
    expect(standingsNotes(2020, [])).toEqual(['No standings are published for 2019-20.'])
  })

  it('says when the file has no last ten and streak, from the rows', () => {
    // The NBA's files hold none before 2001-02.
    const before = ROWS.map((r) => ({ ...r, last10: null, streak: null }))
    expect(standingsNotes(2001, before)).toEqual([
      'The last ten and the streak are not published for 2000-01.',
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

  it('states the league’s own exponent and file on the WNBA', () => {
    expect(STRENGTH_NOTE).toContain('the exponent 14,')
    const wnba = [team({ division: null, divisionRecord: null, conferenceRecord: null })]
    expect(standingsNotes(1997, wnba, LEAGUES.wnba)).toEqual([
      'The WNBA’s file has no real conference records for 1997.',
      strengthNote(LEAGUES.wnba)
    ])
    expect(strengthNote(LEAGUES.wnba)).toContain('the exponent 10.5,')
    // The WNBA's file publishes the last ten and the streak from 1997: nothing said of them.
    expect(standingsNotes(1997, [team({ division: null })], LEAGUES.wnba)).toEqual([
      strengthNote(LEAGUES.wnba)
    ])
    expect(standingsNotes(1996, [], LEAGUES.wnba)).toEqual(['Published standings start in 1997.'])
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

describe('the season forecast columns (Plan T1003)', () => {
  const v = (x: number | null): MetricValue => ({
    value: x,
    raw: x,
    sample: 1,
    qualified: true,
    percentile: null,
    rank: null
  })
  const result = {
    grain: 'season' as const,
    columns: [],
    total: 1,
    notes: [],
    ms: 1,
    rows: [
      {
        id: '1',
        name: 'Boston Celtics',
        group: {},
        games: 12,
        values: {
          team_proj_w: v(50.6),
          team_proj_l: v(31.4),
          team_playoff_pct: v(0.8712),
          team_title_pct: v(0.0042),
          team_forecast_runs: v(10000)
        }
      }
    ]
  }

  it('reads the season in progress’s forecast, regular season', () => {
    expect(forecastQuery(2027)).toMatchObject({
      metrics: [
        'team_proj_w',
        'team_proj_l',
        'team_playoff_pct',
        'team_title_pct',
        'team_forecast_runs'
      ],
      scope: { seasons: [2027], gameTypes: ['regular'] }
    })
  })

  it('writes a projected record that adds up and odds to the point', () => {
    expect(fmtProjected(50.6, 31.4)).toBe('51-31')
    expect(fmtProjected(50.5, 31.5)).toBe('51-31')
    expect(fmtProjected(null, 3)).toBe('—')
    expect([0, 0.004, 0.5, 0.996, 1, null].map(fmtOdds)).toEqual([
      '0%',
      '<1%',
      '50%',
      '>99%',
      '100%',
      '—'
    ])
  })

  it('adds three columns after the published ones and a note, only with a forecast', () => {
    const f = forecastCells(result as never)!
    expect(f.cells.get('1')).toEqual(['51-31', '87%', '<1%'])
    expect(f.runs).toBe(10000)
    expect(standingsHead(null)).toEqual(STANDINGS_HEAD)
    expect(standingsHead(f).slice(-3)).toEqual(['PROJ', 'PLAYOFF%', 'TITLE%'])
    const [east] = conferenceTables(ROWS, null, f)
    expect(east.rows.find((r) => r.teamId === '1')!.cells.slice(-3)).toEqual([
      '51-31',
      '87%',
      '<1%'
    ])
    expect(east.rows.find((r) => r.teamId === '2')!.cells.slice(-3)).toEqual(['—', '—', '—'])
    expect(conferenceTables(ROWS)[0].rows[0].cells).toHaveLength(STANDINGS_HEAD.length - 2)
    expect(forecastNote(10000, 2026)).toContain('10,000 times from its Elo ratings')
    expect(forecastCells(null)).toBeNull()
  })

  it('names the play-in only where the season’s format has one', () => {
    expect(forecastNote(10, 2026, LEAGUES.nba)).toMatch(/then the play-in and the playoffs\.$/)
    expect(forecastNote(10, 2019, LEAGUES.nba)).toMatch(/Elo ratings, then the playoffs\.$/)
    expect(forecastNote(10, 2026, LEAGUES.wnba)).toMatch(/Elo ratings, then the playoffs\.$/)
  })

  it('drops DIV, head, cells and widths together, where the teams are in no division', () => {
    const wnba = ROWS.map((r) => ({ ...r, division: null, divisionRecord: null }))
    const head = standingsHead(null, wnba)
    expect(head).not.toContain('DIV')
    expect(head).toHaveLength(STANDINGS_HEAD.length - 1)
    expect(conferenceTables(wnba)[0].rows[0].cells).toHaveLength(head.length - 2)
    expect(standingsColumns(null, wnba).split(' ')).toHaveLength(head.length)
    expect(standingsColumns(null, ROWS).split(' ')).toHaveLength(STANDINGS_HEAD.length)
    const f = forecastCells(result as never)!
    expect(standingsColumns(f, wnba).split(' ')).toHaveLength(standingsHead(f, wnba).length)
    expect(standingsHead(null, ROWS)).toEqual(STANDINGS_HEAD)
  })
})
