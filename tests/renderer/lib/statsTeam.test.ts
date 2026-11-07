import { describe, expect, it } from 'vitest'
import { sectionMetrics } from '@/lib/stats/dashboard'
import type { StatsScope } from '@/lib/stats/scope'
import {
  defaultTeam,
  defaultTeamQuery,
  gamesInScope,
  HISTORY_METRICS,
  historyQuery,
  historyRows,
  marginSeries,
  nextGame,
  noGamesNote,
  RATINGS_SECTION,
  resultCards,
  ROSTER_METRICS,
  rosterQuery,
  rosterRows,
  scheduleRows,
  SCORER_METRICS,
  scorerRows,
  scorersQuery,
  scoreText,
  TEAM_SECTIONS,
  teamGames,
  teamIn,
  teamPoolQuery,
  teamRecord,
  type TeamGame
} from '@/lib/stats/team'
import type {
  MetricValue,
  StatsGame,
  StatsResult,
  StatsRow,
  StatsSeason
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const byId = new Map(catalogueFixture().map((m) => [m.id, m]))
const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

const value = (v: number | null): MetricValue => ({
  value: v,
  raw: v,
  sample: 1,
  qualified: true,
  percentile: null,
  rank: null
})

const game = (id: string, date: string, over: Partial<StatsGame> = {}): StatsGame => ({
  id,
  season: 2026,
  type: 'regular',
  date,
  home: { id: 'A', code: 'AAA', name: 'Team A', score: 100 },
  away: { id: 'B', code: 'BBB', name: 'Team B', score: 90 },
  played: true,
  hasBox: true,
  overtimes: 0,
  ...over
})

const GAMES: StatsGame[] = [
  game('g1', '2026-01-01'),
  game('g2', '2026-01-03', {
    home: { id: 'B', code: 'BBB', name: 'Team B', score: 120 },
    away: { id: 'A', code: 'AAA', name: 'Team A', score: 110 },
    overtimes: 2
  }),
  game('other', '2026-01-04', {
    home: { id: 'C', code: 'CCC', name: 'Team C', score: 1 },
    away: { id: 'B', code: 'BBB', name: 'Team B', score: 2 }
  }),
  game('po', '2026-04-20', { type: 'playoffs' }),
  game('off', '2026-01-10', {
    played: false,
    home: { id: 'A', code: 'AAA', name: 'Team A', score: null },
    away: { id: 'B', code: 'BBB', name: 'Team B', score: null },
    overtimes: null
  }),
  game('next', '2026-05-01', {
    played: false,
    home: { id: 'A', code: 'AAA', name: 'Team A', score: null },
    away: { id: 'C', code: 'CCC', name: 'Team C', score: null },
    overtimes: null
  })
]

const of = (id: string): TeamGame[] => teamGames(GAMES, id)

const SEASONS: StatsSeason[] = [
  {
    season: 2009,
    firstDate: '2008-10-28',
    lastDate: '2009-06-14',
    types: [{ type: 'regular', games: 1230 }],
    teams: [
      {
        id: '60',
        code: 'OKC',
        name: 'Oklahoma City Thunder',
        conference: 'west',
        division: 'northwest'
      }
    ]
  },
  {
    season: 2008,
    firstDate: '2007-10-30',
    lastDate: '2008-06-17',
    types: [{ type: 'regular', games: 1230 }],
    teams: [
      { id: '60', code: 'SEA', name: 'Seattle SuperSonics', conference: 'west', division: 'nw' }
    ]
  },
  {
    season: 1995,
    firstDate: '1994-11-04',
    lastDate: '1995-06-14',
    types: [{ type: 'regular', games: 1107 }],
    teams: []
  }
]

const row = (
  id: string,
  values: Record<string, number | null>,
  over: Partial<StatsRow> = {}
): StatsRow => ({
  id,
  name: `Player ${id}`,
  team: 'AAA',
  position: 'G',
  group: {},
  games: 10,
  values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, value(v)])),
  ...over
})

const result = (rows: StatsRow[]): StatsResult => ({
  grain: 'season',
  columns: [],
  rows,
  total: rows.length,
  notes: [],
  ms: 1
})

describe('the tabs', () => {
  it('names only team metrics the catalogue has, within a query’s limit', () => {
    for (const sections of [...Object.values(TEAM_SECTIONS), [RATINGS_SECTION]]) {
      const metrics = sectionMetrics(sections)
      expect(metrics.length).toBeLessThanOrEqual(40)
      for (const id of metrics) {
        expect(byId.get(id), id).toBeDefined()
        expect(byId.get(id)?.entity, id).toBe('team')
      }
    }
    for (const id of HISTORY_METRICS) expect(byId.get(id)?.entity, id).toBe('team')
    for (const id of [...ROSTER_METRICS, ...SCORER_METRICS]) {
      expect(byId.get(id)?.entity, id).toBe('player')
    }
  })

  it('asks the engine for every team, so ranks are among them', () => {
    const q = teamPoolQuery(['team_ortg'], SCOPE, 'perGame')
    expect(q).toMatchObject({ entity: 'team', transform: 'perGame', limit: 40 })
    expect(q.scope.teams).toBeUndefined()
  })
})

describe('which team', () => {
  it('opens on the best record, else the season’s first team', () => {
    expect(defaultTeamQuery(SCOPE).sort).toEqual({ metric: 'team_win_pct', dir: 'desc' })
    expect(defaultTeam(result([row('7', {})]), SEASONS[0])).toBe('7')
    expect(defaultTeam(result([]), SEASONS[0])).toBe('60')
    expect(defaultTeam(null, undefined)).toBeNull()
  })

  it('names a franchise as each season did', () => {
    expect(teamIn(SEASONS, 2009, '60')).toEqual({
      code: 'OKC',
      name: 'Oklahoma City Thunder',
      exists: true
    })
    expect(teamIn(SEASONS, 2008, '60')).toEqual({
      code: 'SEA',
      name: 'Seattle SuperSonics',
      exists: true
    })
  })

  it('knows a franchise with no team that season, by its nearest name', () => {
    expect(teamIn(SEASONS, 1995, '60')).toEqual({
      code: 'SEA',
      name: 'Seattle SuperSonics',
      exists: false
    })
    expect(teamIn(SEASONS, 1995, 'nope')).toEqual({ code: 'nope', name: 'nope', exists: false })
    expect(noGamesNote('Seattle SuperSonics', false, { ...SCOPE, season: 1995 })).toBe(
      'This franchise did not play in 1994-95.'
    )
    expect(noGamesNote('Boston Celtics', true, { ...SCOPE, seasonType: 'playoffs' })).toBe(
      'Boston Celtics played no games in 2025-26 · Playoffs · Whole season.'
    )
  })
})

describe('a team’s games', () => {
  it('reads each from its own side, and leaves out the others’', () => {
    const games = of('A')
    expect(games.map((g) => g.id)).toEqual(['g1', 'g2', 'po', 'off', 'next'])
    expect(games[0]).toMatchObject({
      home: true,
      opponent: { code: 'BBB' },
      pointsFor: 100,
      pointsAgainst: 90,
      result: 'W'
    })
    expect(games[1]).toMatchObject({
      home: false,
      pointsFor: 110,
      pointsAgainst: 120,
      result: 'L',
      overtimes: 2
    })
    expect(games[3]).toMatchObject({ played: false, result: null, pointsFor: null })
  })

  it('takes the scope’s type, dates and last games', () => {
    const games = of('A')
    expect(gamesInScope(games, SCOPE).map((g) => g.id)).toEqual(['g1', 'g2', 'off', 'next'])
    expect(gamesInScope(games, { ...SCOPE, seasonType: 'playoffs' }).map((g) => g.id)).toEqual([
      'po'
    ])
    expect(gamesInScope(games, { ...SCOPE, seasonType: 'counted' })).toHaveLength(5)
    expect(
      gamesInScope(games, {
        ...SCOPE,
        range: { kind: 'dates', from: '2026-01-02', to: '2026-01-05' }
      }).map((g) => g.id)
    ).toEqual(['g2'])
    expect(
      gamesInScope(games, { ...SCOPE, range: { kind: 'last', n: 1, of: 'appearances' } }).map(
        (g) => g.id
      )
    ).toEqual(['g2'])
  })

  it('adds up the record from the final scores', () => {
    expect(teamRecord(gamesInScope(of('A'), SCOPE))).toEqual({
      record: '1-1',
      pointsPerGame: '105.0',
      allowedPerGame: '105.0',
      margin: '0.0',
      tone: null
    })
    expect(teamRecord(of('A').slice(0, 1))).toMatchObject({ margin: '+10.0', tone: 'good' })
    expect(teamRecord(of('A').slice(1, 2))).toMatchObject({ margin: '−10.0', tone: 'bad' })
    expect(teamRecord([])).toMatchObject({ record: '0-0', pointsPerGame: '—', tone: null })
  })

  it('writes a score from this side, with overtime', () => {
    const [won, lost] = of('A')
    expect(scoreText(won)).toBe('W 100–90')
    expect(scoreText(lost)).toBe('L 110–120 2OT')
    expect(scoreText(of('A')[3])).toBeNull()
    expect(scoreText({ ...won, overtimes: 1 })).toBe('W 100–90 OT')
  })

  it('finds the next game past a game that was never played', () => {
    expect(nextGame(of('A'), '2026-04-30')?.id).toBe('next')
    expect(nextGame(of('A'), '2026-06-01')).toBeNull()
    expect(nextGame(of('A'), null)?.id).toBe('off')
  })

  it('strips the latest games played, then the next', () => {
    const cards = resultCards(gamesInScope(of('A'), SCOPE))
    expect(cards.map((c) => [c.key, c.date, c.opponent, c.score])).toEqual([
      ['g1', 'Jan 1', 'vs BBB', 'W 100–90'],
      ['g2', 'Jan 3', '@ BBB', 'L 110–120 2OT'],
      ['off', 'Jan 10', 'vs BBB', null],
      ['next', 'May 1', 'vs CCC', null]
    ])
  })

  it('keeps only the last fifteen played in the strip', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      game(`m${i}`, `2026-01-${String(i + 1).padStart(2, '0')}`)
    )
    const cards = resultCards(teamGames(many, 'A'))
    expect(cards).toHaveLength(15)
    expect(cards[0].key).toBe('m5')
  })

  it('runs the record down the schedule, and marks a game past its day as not played', () => {
    const rows = scheduleRows(gamesInScope(of('A'), SCOPE), '2026-02-01')
    expect(rows.map((r) => [r.key, r.record, r.status])).toEqual([
      ['g1', '1-0', null],
      ['g2', '1-1', null],
      ['off', '', 'Not played'],
      ['next', '', null]
    ])
    expect(scheduleRows(of('A'), '2026-02-01').find((r) => r.key === 'po')?.type).toBe('Playoffs')
  })

  it('charts the margin of each game played', () => {
    const series = marginSeries(gamesInScope(of('A'), SCOPE))
    expect(series.points.map((p) => [p.label, p.title, p.value])).toEqual([
      ['Jan 1', 'Jan 1 vs BBB', 10],
      ['Jan 3', 'Jan 3 @ BBB', -10]
    ])
  })
})

describe('the players', () => {
  it('reads their games for this team, most minutes first', () => {
    expect(rosterQuery('A', SCOPE, 'per36')).toMatchObject({
      entity: 'player',
      transform: 'per36',
      sort: { metric: 'min', dir: 'desc' },
      scope: { teams: ['A'] }
    })
    const [r] = rosterRows(result([row('1', { pts: 20, fg_pct: 0.5 })]), byId, 'perGame')
    expect(r).toMatchObject({ id: '1', games: '10', position: 'G' })
    expect(r.cells[ROSTER_METRICS.indexOf('pts')]).toBe('20.0')
    expect(r.cells[ROSTER_METRICS.indexOf('fg_pct')]).toBe('50.0%')
    expect(rosterRows(null, byId, 'raw')).toEqual([])
  })

  it('orders who scores by total points, so one big night does not lead the team', () => {
    expect(scorersQuery('A', SCOPE)).toMatchObject({
      transform: 'perGame',
      scope: { teams: ['A'] }
    })
    const rows = scorerRows(
      result([
        row('call-up', { pts: 40, share_pts: 0.2, reb: 1, ast: 1 }, { games: 1 }),
        row('star', { pts: 25, share_pts: 0.25, reb: 8, ast: 6 }, { games: 70 }),
        row('role', { pts: 10, share_pts: 0.1, reb: 2, ast: 2 }, { games: 70 })
      ]),
      byId
    )
    expect(rows.map((r) => [r.id, r.points, r.shareText, r.bar])).toEqual([
      ['star', '25.0', '25.0%', 1],
      ['role', '10.0', '10.0%', 0.4],
      ['call-up', '40.0', '20.0%', 0.8]
    ])
    expect(scorerRows(null, byId)).toEqual([])
  })

  it('shows at most eight', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(String(i), { pts: i, share_pts: 0.1 }))
    expect(scorerRows(result(many), byId)).toHaveLength(8)
  })
})

describe('the franchise by season', () => {
  it('asks for one id over every season, in the scope’s game types', () => {
    expect(historyQuery('60', [2009, 2008], SCOPE)).toMatchObject({
      entity: 'team',
      groupBy: ['season'],
      scope: { seasons: [2009, 2008], gameTypes: ['regular'], teams: ['60'] }
    })
  })

  it('reads newest first, under each season’s own name', () => {
    const rows = historyRows(
      result([
        row(
          '60',
          { team_w: 20 },
          { name: 'Seattle SuperSonics', team: 'SEA', group: { season: 2008 } }
        ),
        row(
          '60',
          { team_w: 23 },
          { name: 'Oklahoma City Thunder', team: 'OKC', group: { season: 2009 } }
        )
      ]),
      byId
    )
    expect(rows.map((r) => [r.label, r.code, r.name, r.cells[0]])).toEqual([
      ['2008-09', 'OKC', 'Oklahoma City Thunder', '23'],
      ['2007-08', 'SEA', 'Seattle SuperSonics', '20']
    ])
    expect(historyRows(null, byId)).toEqual([])
  })
})
