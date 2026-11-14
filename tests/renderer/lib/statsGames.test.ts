import { describe, expect, it } from 'vitest'
import {
  BOX_HEAD,
  BOX_METRICS,
  boxQueries,
  boxSides,
  COMPARE_METRICS,
  compareRows,
  defaultDay,
  eloView,
  gameDays,
  gameHeader,
  gameStatus,
  noBoxNote,
  periodTable,
  railGames,
  stepDay
} from '@/lib/stats/games'
import type {
  StatsGame,
  StatsGameDetail,
  StatsGameElo,
  StatsResult,
  StatsRow
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const byId = new Map(catalogueFixture().map((m) => [m.id, m]))

const game = (id: string, date: string, over: Partial<StatsGame> = {}): StatsGame => ({
  id,
  season: 2026,
  type: 'regular',
  date,
  home: { id: '1', code: 'BOS', name: 'Boston Celtics', score: 110 },
  away: { id: '2', code: 'LAL', name: 'Los Angeles Lakers', score: 102 },
  played: true,
  hasBox: true,
  overtimes: 0,
  ...over
})

const unplayed = (id: string, date: string): StatsGame =>
  game(id, date, {
    played: false,
    hasBox: false,
    overtimes: null,
    home: { id: '1', code: 'BOS', name: 'Boston Celtics', score: null },
    away: { id: '2', code: 'LAL', name: 'Los Angeles Lakers', score: null }
  })

const row = (id: string, values: Record<string, number | null>, team: string | null): StatsRow => ({
  id,
  name: `Player ${id}`,
  team: null,
  position: 'G',
  group: team === null ? {} : { team: Number(team) },
  games: 1,
  values: Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      { value: v, raw: v, sample: 1, qualified: true, percentile: null, rank: null }
    ])
  )
})

const result = (rows: StatsRow[], reasons: Record<string, string> = {}): StatsResult => ({
  grain: 'game',
  columns: Object.entries(reasons).map(([id, reason]) => ({
    id,
    label: id,
    short: id,
    unit: 'count',
    decimals: 0,
    direction: 'higher',
    seasons: [],
    reason
  })),
  rows,
  total: rows.length,
  notes: [],
  ms: 1
})

describe('the date rail', () => {
  const games = [
    game('pre', '2025-10-02', { type: 'preseason', hasBox: false }),
    game('a', '2026-01-05'),
    game('b', '2026-01-05'),
    game('c', '2026-01-07'),
    unplayed('next', '2026-03-01')
  ]

  it('lists each day with a game once, in order', () => {
    expect(gameDays(games)).toEqual(['2025-10-02', '2026-01-05', '2026-01-07', '2026-03-01'])
  })

  it('opens on the latest day a game that counts was played', () => {
    expect(defaultDay(games)).toBe('2026-01-07')
    expect(defaultDay(games.slice(0, 1))).toBe('2025-10-02')
    expect(defaultDay([unplayed('x', '2026-03-01')])).toBe('2026-03-01')
    expect(defaultDay([])).toBeNull()
  })

  it('steps among days with a game, and stops at the ends', () => {
    const days = gameDays(games)
    expect(stepDay(days, '2026-01-05', 1)).toBe('2026-01-07')
    expect(stepDay(days, '2026-01-05', -1)).toBe('2025-10-02')
    expect(stepDay(days, '2025-10-02', -1)).toBeNull()
    expect(stepDay(days, '2026-03-01', 1)).toBeNull()
    expect(stepDay(days, null, 1)).toBeNull()
  })

  it('reads a day’s games: the winner, overtime, the type, one not played', () => {
    const day = [
      game('a', '2026-01-05', { overtimes: 2 }),
      game('b', '2026-01-05', { type: 'playoffs' }),
      unplayed('c', '2026-01-05')
    ]
    const rail = railGames(day, '2026-01-05', '2026-02-01')
    expect(rail[0]).toMatchObject({
      away: 'LAL',
      home: 'BOS',
      awayScore: '102',
      homeScore: '110',
      homeWon: true,
      awayWon: false,
      note: '2OT',
      tag: null
    })
    expect(rail[1]).toMatchObject({ tag: 'Playoffs', note: null })
    expect(rail[2]).toMatchObject({ played: false, awayScore: '', note: 'Not played' })
    expect(railGames(day, '2030-01-01', null)).toEqual([])
  })
})

describe('a game’s status', () => {
  it('reads final with overtime, not played, or scheduled', () => {
    expect(gameStatus(game('a', '2026-01-05'), null)).toBe('Final')
    expect(gameStatus(game('a', '2026-01-05', { overtimes: 1 }), null)).toBe('Final/OT')
    expect(gameStatus(game('a', '2026-01-05', { overtimes: 3 }), null)).toBe('Final/3OT')
    expect(gameStatus(unplayed('b', '2013-04-16'), '2026-11-05')).toBe('Not played')
    expect(gameStatus(unplayed('c', '2027-01-01'), '2026-11-05')).toBe('Scheduled')
  })

  it('says why a game has no box score', () => {
    expect(noBoxNote(unplayed('a', '2013-04-16'), '2026-11-05')).toBe('This game was not played.')
    expect(noBoxNote(unplayed('a', '2027-01-01'), '2026-11-05')).toBe(
      'This game has not been played yet.'
    )
    expect(noBoxNote(game('a', '2026-01-01', { type: 'preseason' }), null)).toContain('Preseason')
    expect(noBoxNote(game('a', '2026-01-01', { type: 'all-star' }), null)).toContain('All-Star')
    expect(noBoxNote(game('a', '2026-01-01'), null)).toContain('only the final score')
  })
})

describe('the header', () => {
  const games = [
    game('w', '2026-01-01'),
    game('l', '2026-01-03', {
      home: { id: '1', code: 'BOS', name: 'Boston Celtics', score: 90 },
      away: { id: '2', code: 'LAL', name: 'Los Angeles Lakers', score: 100 }
    }),
    game('po', '2026-04-20', { type: 'playoffs' }),
    game('this', '2026-01-05')
  ]

  it('reads each side, its record and form before this game, in the same kind of game', () => {
    const v = gameHeader(games[3], games, null, null)
    expect(v.home).toMatchObject({ code: 'BOS', score: '110', lost: false, record: '1-1' })
    expect(v.away).toMatchObject({ code: 'LAL', score: '102', lost: true, record: '1-1' })
    expect(v.home.form.map((f) => f.result)).toEqual(['W', 'L'])
    expect(v.home.form[1].title).toBe('Jan 3: L 90–100 vs LAL')
    const playoffs = gameHeader(games[2], games, null, null)
    expect(playoffs.home.record).toBeNull()
    expect(playoffs.line).toBe('Apr 20, 2026 · Playoffs')
  })

  it('writes where and how many, what it knows of them', () => {
    const detail = {
      id: 'this',
      venue: 'TD Garden',
      city: 'Boston',
      attendance: 18984,
      note: 'NBA Cup',
      periods: null,
      officials: [],
      elo: null
    }
    const v = gameHeader(games[3], games, detail, null)
    expect(v.line).toBe('Jan 5, 2026 · NBA Cup')
    expect(v.place).toBe('TD Garden, Boston · 18,984')
    expect(gameHeader(games[3], games, { ...detail, venue: null, city: null }, null).place).toBe(
      '18,984'
    )
    expect(gameHeader(games[3], games, null, null).place).toBeNull()
  })

  it('leaves the score blank before a game, and copes with a side not named yet', () => {
    const next = unplayed('next', '2026-02-01')
    next.home = { id: null, code: 'TBD', name: 'To be decided', score: null }
    const v = gameHeader(next, games, null, '2026-01-10')
    expect(v.status).toBe('Scheduled')
    expect(v.home).toMatchObject({ id: null, score: '', record: null, form: [] })
    expect(v.away.score).toBe('')
  })
})

describe('the score by period', () => {
  const periods = (home: number[], away: number[]): Parameters<typeof periodTable>[1] => ({
    id: 'a',
    venue: null,
    city: null,
    attendance: null,
    note: null,
    periods: { home, away },
    officials: [],
    elo: null
  })

  it('names the periods and ends on the final', () => {
    const t = periodTable(
      game('a', '2026-01-05'),
      periods([30, 30, 20, 20, 5, 5], [25, 25, 25, 17, 5, 5])
    )
    expect(t?.head).toEqual(['1', '2', '3', '4', 'OT', '2OT', 'T'])
    expect(t?.home.at(-1)).toBe('110')
    expect(t?.away.at(-1)).toBe('102')
  })

  it('has none when the source has none', () => {
    expect(periodTable(game('a', '2026-01-05'), null)).toBeNull()
    expect(
      periodTable(game('a', '2026-01-05'), {
        id: 'a',
        venue: null,
        city: null,
        attendance: null,
        note: null,
        periods: null,
        officials: [],
        elo: null
      })
    ).toBeNull()
  })
})

describe('the box score', () => {
  const g = game('a', '2026-01-05')

  const player = (
    id: string,
    team: string,
    pts: number,
    gs: number,
    over: Record<string, number | null> = {}
  ): StatsRow =>
    row(
      id,
      {
        gs,
        min: 36.2,
        pts,
        fgm: 4,
        fga: 8,
        fg3m: 1,
        fg3a: 3,
        ftm: 2,
        fta: 2,
        reb: 5,
        plus_minus: -3,
        ...over
      },
      team
    )

  const team = (id: string, pts: number): StatsRow =>
    row(id, { team_pts: pts, team_fgm: 40, team_fga: 80, team_reb: 44 }, null)

  it('asks for one game by its id, with its type', () => {
    const q = boxQueries(g)
    expect(q.get('players')).toMatchObject({
      entity: 'player',
      groupBy: ['team'],
      transform: 'raw',
      scope: { seasons: [2026], gameTypes: ['regular'], games: ['a'] }
    })
    expect(q.get('teams')?.entity).toBe('team')
    const metrics = q.get('teams')?.metrics ?? []
    expect(new Set(metrics).size).toBe(metrics.length)
    expect(metrics.length).toBeLessThanOrEqual(40)
    for (const id of [...metrics, ...COMPARE_METRICS]) expect(byId.get(id)?.entity, id).toBe('team')
    for (const id of BOX_METRICS) expect(byId.get(id)?.entity, id).toBe('player')
  })

  it('splits each side into starters and bench, and totals it from the team’s box', () => {
    const players = result([
      player('s', '1', 100, 1),
      player('b', '1', 10, 0),
      player('other', '2', 102, 1)
    ])
    const [away, home] = boxSides(g, players, result([team('1', 110), team('2', 102)]), byId)
    expect(home.starters.map((r) => r.id)).toEqual(['s'])
    expect(home.bench.map((r) => r.id)).toEqual(['b'])
    expect(home.startersKnown).toBe(true)
    expect(away.starters.map((r) => r.id)).toEqual(['other'])
    const line = home.starters[0].cells
    expect(line).toHaveLength(BOX_HEAD.length)
    expect(line[0]).toBe('36:12')
    expect(line[1]).toBe('4-8')
    expect(line[BOX_HEAD.indexOf('+/-')]).toBe('−3')
    expect(line[BOX_HEAD.indexOf('PTS')]).toBe('100')
    expect(home.totals[1]).toBe('40-80')
    expect(home.totals[BOX_HEAD.indexOf('REB')]).toBe('44')
    expect(home.totals[BOX_HEAD.indexOf('PTS')]).toBe('110')
    expect(home.totals[0]).toBe('72:24')
    expect(home.shortfall).toBeNull()
  })

  it('lists everyone together when nobody is flagged as starting', () => {
    const [, home] = boxSides(
      g,
      result([player('a', '1', 60, 0), player('b', '1', 50, 0)]),
      result([team('1', 110)]),
      byId
    )
    expect(home.startersKnown).toBe(false)
    expect(home.starters).toHaveLength(2)
    expect(home.bench).toHaveLength(0)
  })

  it('says so when the lines do not add up to the final score', () => {
    const [, home] = boxSides(g, result([player('a', '1', 104, 1)]), result([team('1', 110)]), byId)
    expect(home.shortfall).toBe('The players’ lines add to 104; the final score is 110.')
  })

  it('reads a stat not recorded then as a dash', () => {
    const [, home] = boxSides(
      g,
      result([player('a', '1', 110, 1, { plus_minus: null })]),
      result([team('1', 110)]),
      byId
    )
    expect(home.starters[0].cells[BOX_HEAD.indexOf('+/-')]).toBe('—')
  })

  it('compares the teams, marks the better side, and says why a row is empty', () => {
    const rows = compareRows(
      g,
      result(
        [
          row('1', { team_fg_pct: 0.5, team_tov: 12, team_reb: 40, team_paint_pts: null }, null),
          row('2', { team_fg_pct: 0.4, team_tov: 10, team_reb: 40, team_paint_pts: null }, null)
        ],
        { team_paint_pts: 'Recorded from 2008-09.' }
      ),
      byId
    )
    const of = (id: string): (typeof rows)[number] | undefined => rows.find((r) => r.metric === id)
    expect(of('team_fg_pct')).toMatchObject({ away: '40.0%', home: '50.0%', edge: 'home' })
    // Fewer turnovers is better.
    expect(of('team_tov')).toMatchObject({ away: '10', home: '12', edge: 'away' })
    expect(of('team_reb')?.edge).toBeNull()
    expect(of('team_paint_pts')).toMatchObject({
      away: '—',
      edge: null,
      missing: 'Recorded from 2008-09.'
    })
  })
})

describe('a game’s Elo', () => {
  const detail = (elo: StatsGameElo | null): StatsGameDetail => ({
    id: 'g',
    venue: null,
    city: null,
    attendance: null,
    note: null,
    periods: null,
    officials: [],
    elo
  })
  const elo: StatsGameElo = {
    neutral: false,
    homeCourt: 80,
    homeWin: 0.6405,
    homeMargin: 3.57,
    home: { pre: 1520.4, post: 1526.6 },
    away: { pre: 1540.2, post: 1534.0 }
  }

  it('reads the ratings before and after, and the win probability before the game', () => {
    expect(eloView(game('g', '2026-01-02'), detail(elo))).toEqual({
      rows: [
        { label: 'Before', away: '1,540', home: '1,520' },
        { label: 'After', away: '1,534', home: '1,527' },
        { label: 'Win probability', away: '36%', home: '64%' }
      ],
      note: 'Home court: 80 Elo points. Expected: BOS by 3.6.'
    })
  })

  it('reads a game to come from the latest ratings, and a neutral site without home court', () => {
    const toCome = { ...elo, neutral: true, homeCourt: 0, homeWin: 0.47, homeMargin: -0.7 }
    const view = eloView(
      unplayed('g', '2027-03-01'),
      detail({ ...toCome, home: { pre: 1520, post: null }, away: { pre: 1540, post: null } })
    )
    expect(view?.rows.map((r) => r.label)).toEqual(['Before', 'Win probability'])
    expect(view?.note).toBe('Neutral site: no home court. Expected: LAL by 0.7.')
  })

  it('has a note alone in the burn-in seasons, and nothing for a game it does not rate', () => {
    expect(eloView(game('g', '1995-01-02', { season: 1995 }), detail(null))).toEqual({
      rows: [],
      note: 'Elo is read from 1995-96: every team starts at 1500 in 1993-94, so the first two seasons settle the ratings.'
    })
    expect(eloView(game('g', '2026-02-15', { type: 'all-star' }), detail(elo))).toBeNull()
    expect(eloView(game('g', '2026-01-02'), detail(null))).toBeNull()
  })
})
