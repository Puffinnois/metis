import { describe, expect, it } from 'vitest'
import { sectionMetrics, sectionViews, statLine } from '@/lib/stats/dashboard'
import {
  careerQuery,
  careerRows,
  careerTotal,
  defaultPlayer,
  gameFacts,
  gameSeries,
  LINE_METRICS,
  logDifferences,
  logQuery,
  logRows,
  logTotalCells,
  OVERVIEW_SECTION,
  playerFacts,
  poolSize,
  positionQuery,
  railMetrics,
  railQuery,
  railRows,
  rankedPool,
  splitDefs,
  splitName,
  splitNotes,
  splitQueries,
  splitTable,
  TAB_SECTIONS,
  tileViews,
  TILES
} from '@/lib/stats/player'
import type { StatsScope } from '@/lib/stats/scope'
import type {
  MetricValue,
  StatsGame,
  StatsResult,
  StatsRow,
  StatsSeason
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const byId = new Map(catalogueFixture().map((m) => [m.id, m]))

const value = (v: number | null, over: Partial<MetricValue> = {}): MetricValue => ({
  value: v,
  raw: v,
  sample: 100,
  qualified: true,
  percentile: null,
  rank: null,
  ...over
})

const row = (
  id: string,
  values: Record<string, MetricValue>,
  over: Partial<StatsRow> = {}
): StatsRow => ({
  id,
  name: `Player ${id}`,
  team: 'BOS',
  position: 'G',
  group: {},
  games: 10,
  values,
  ...over
})

const result = (rows: StatsRow[], reasons: Record<string, string> = {}): StatsResult => {
  const metrics = Object.keys(rows[0]?.values ?? {})
  return {
    grain: 'season',
    columns: metrics.map((id) => ({
      id,
      label: id,
      short: id,
      unit: 'count',
      decimals: 0,
      direction: byId.get(id)?.direction ?? 'higher',
      seasons: [2026],
      reason: reasons[id] ?? null
    })),
    rows,
    total: rows.length,
    notes: [],
    ms: 1
  }
}

const game = (over: Partial<StatsGame> = {}): StatsGame => ({
  id: 'g1',
  season: 2026,
  type: 'regular',
  date: '2026-01-05',
  home: { id: '1', code: 'BOS', name: 'Boston Celtics', score: 110 },
  away: { id: '2', code: 'LAL', name: 'Los Angeles Lakers', score: 102 },
  played: true,
  hasBox: true,
  overtimes: 0,
  ...over
})

const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

describe('the tabs', () => {
  it('names only metrics the catalogue has, within a query’s limit', () => {
    for (const sections of [...Object.values(TAB_SECTIONS), [OVERVIEW_SECTION]]) {
      const metrics = sectionMetrics(sections)
      expect(metrics.length).toBeLessThanOrEqual(39)
      for (const id of metrics) {
        expect(byId.get(id), id).toBeDefined()
        expect(byId.get(id)?.entity, id).toBe('player')
      }
    }
    for (const id of [...LINE_METRICS, ...TILES]) expect(byId.has(id), id).toBe(true)
  })

  it('puts the tiles in the Overview’s query, so one query answers both', () => {
    for (const id of TILES) expect(OVERVIEW_SECTION.metrics).toContain(id)
  })
})

describe('a stat line', () => {
  it('reads its value, percentile, rank and hover', () => {
    const r = result([row('1', { pts: value(30.25, { percentile: 92, rank: 3 }) })])
    const line = statLine('pts', r, r.rows[0], byId, 'perGame', 'G')
    expect(line).toMatchObject({ label: 'Points', value: '30.3', percentile: 92, rank: '3rd' })
    expect(line.title).toContain('92nd percentile among qualified guards')
  })

  it('says why a stat has no value', () => {
    const r = result([row('1', { plus_minus: value(null) })], {
      plus_minus: 'Recorded from 1996-97.'
    })
    expect(statLine('plus_minus', r, r.rows[0], byId, 'perGame', 'G')).toMatchObject({
      value: '—',
      percentile: null,
      missing: 'Recorded from 1996-97.'
    })
  })

  it('gives no rank to a metric with no better side', () => {
    const r = result([row('1', { usg_pct: value(0.3, { percentile: 80, rank: 5 }) })])
    expect(statLine('usg_pct', r, r.rows[0], byId, 'raw', 'G').rank).toBeNull()
  })

  it('reads dashes for a player with no row', () => {
    const r = result([row('2', { pts: value(1) })])
    const [view] = sectionViews(
      [{ title: 'Volume', metrics: ['pts'] }],
      r,
      '1',
      byId,
      'perGame',
      'G'
    )
    expect(view.lines[0].value).toBe('—')
  })
})

describe('the pool', () => {
  const pool = result([
    row('1', { pts: value(30), min: value(2000) }),
    row('2', { pts: value(20), min: value(1500) }),
    row('3', { pts: value(40), min: value(50, { qualified: false }) })
  ])

  it('ranks among those who qualify, and only them', () => {
    const ranked = rankedPool(pool, 'G')
    expect(ranked.rows[0].values.pts).toMatchObject({ rank: 1, percentile: 100 })
    expect(ranked.rows[1].values.pts).toMatchObject({ rank: 2, percentile: 0 })
    expect(ranked.rows[2].values.pts).toMatchObject({ rank: null, percentile: null })
    expect(poolSize(ranked, 'G')).toBe(2)
  })

  it('asks for the position, and for minutes so a row can qualify', () => {
    const q = positionQuery(['pts'], 'G', SCOPE, 'perGame')
    expect(q).toMatchObject({ metrics: ['pts', 'min'], transform: 'perGame' })
    expect(q.scope.positions).toEqual(['G'])
    expect(positionQuery(['min'], null, SCOPE, 'raw').scope.positions).toBeUndefined()
  })

  it('reads the tiles, with a percentile chip only when qualified', () => {
    const r = result([
      row('1', {
        pts: value(30, { percentile: 80 }),
        reb: value(5, { percentile: 20 }),
        ast: value(5, { percentile: 50 }),
        ts_pct: value(0.6)
      })
    ])
    const tiles = tileViews(r, '1', byId, 'perGame', 'G')
    expect(tiles.map((t) => [t.value, t.chip, t.tone])).toEqual([
      ['30.0', '80th', 'good'],
      ['5.0', '20th', 'bad'],
      ['5.0', '50th', 'mid'],
      ['60.0%', null, 'mid']
    ])
  })
})

describe('the rail', () => {
  const rail = result([
    row('1', { pts: value(30), min: value(2000) }, { name: 'Luka Dončić' }),
    row('3', { pts: value(25), min: value(50, { qualified: false }) }, { name: 'Below Sample' }),
    row('2', { pts: value(20), min: value(1500) }, { name: 'Jayson Tatum' })
  ])

  it('lists those who qualify, best first, numbered among them', () => {
    const rows = railRows(rail, 'pts', byId, 'perGame', '', null)
    expect(rows.map((r) => [r.name, r.rank, r.value])).toEqual([
      ['Luka Dončić', 1, '30.0'],
      ['Jayson Tatum', 2, '20.0']
    ])
  })

  it('keeps the player on screen, marked below the sample', () => {
    const rows = railRows(rail, 'pts', byId, 'perGame', '', '3')
    expect(rows.find((r) => r.id === '3')?.rank).toBeNull()
    expect(rows).toHaveLength(3)
  })

  it('finds anyone by name, accents or not', () => {
    expect(railRows(rail, 'pts', byId, 'perGame', 'doncic', null).map((r) => r.id)).toEqual(['1'])
    expect(railRows(rail, 'pts', byId, 'perGame', 'below', null).map((r) => r.id)).toEqual(['3'])
  })

  it('asks for a position and a team, ranked by the metric', () => {
    const q = railQuery('C', '77', 'tov', SCOPE, 'per36', byId)
    expect(q).toMatchObject({
      metrics: ['tov', 'min'],
      transform: 'per36',
      sort: { metric: 'tov', dir: 'asc' }
    })
    expect(q.scope).toMatchObject({ positions: ['C'], teams: ['77'] })
    const all = railQuery('ALL', null, 'min', SCOPE, 'perGame', byId)
    expect(all.metrics).toEqual(['min'])
    expect(all.scope.positions).toBeUndefined()
  })

  it('offers metrics the catalogue has', () => {
    const options = railMetrics(byId)
    expect(options[0]).toEqual({ value: 'pts', label: 'Points' })
    expect(railMetrics(new Map())).toEqual([])
  })

  it('opens on the first who qualifies, else whoever is there', () => {
    expect(defaultPlayer(null)).toBeNull()
    expect(defaultPlayer(rail)).toBe('1')
    const nobody = result([row('9', { pts: value(1), min: value(1, { qualified: false }) })])
    expect(defaultPlayer(nobody)).toBe('9')
    expect(defaultPlayer(result([]))).toBeNull()
  })
})

describe('the header', () => {
  it('splits a name, and keeps a single one whole', () => {
    expect(splitName('LeBron James')).toEqual({ first: 'LeBron', last: 'James' })
    expect(splitName('Metta World Peace')).toEqual({ first: 'Metta', last: 'World Peace' })
    expect(splitName('Nene')).toEqual({ first: '', last: 'Nene' })
  })

  it('writes the facts it has, and leaves out the rest', () => {
    expect(
      playerFacts({
        id: '1',
        name: 'A',
        position: 'F',
        team: null,
        seasons: [2004, 2005, 2027],
        number: '23',
        height: '6-9',
        weight: '250',
        birthDate: 'DEC 30, 1984',
        school: 'St. Vincent'
      })
    ).toEqual(['#23', '6-9, 250 lb', 'Born Dec 30, 1984', 'St. Vincent', '2003-04 to 2026-27'])
    expect(
      playerFacts({
        id: '1',
        name: 'A',
        position: null,
        team: null,
        seasons: [1995],
        number: null,
        height: null,
        weight: null,
        birthDate: null,
        school: null
      })
    ).toEqual(['1994-95'])
  })
})

describe('the career', () => {
  const season = (s: number, pm: number | null): StatsRow =>
    row('1', { pts: value(25), plus_minus: value(pm) }, { group: { season: s }, team: 'CHI' })

  it('asks for the scope’s game types over every season, and not its range', () => {
    const q = careerQuery('1', [2026, 2025], SCOPE, 'perGame', true)
    expect(q.scope).toEqual({ seasons: [2026, 2025], gameTypes: ['regular'], players: ['1'] })
    expect(q.groupBy).toEqual(['season'])
    expect(careerQuery('1', [2026], SCOPE, 'raw', false).groupBy).toBeUndefined()
  })

  it('reads oldest first, and marks a season inside the career with no games', () => {
    const rows = careerRows(
      result([season(1998, 7), season(1995, null), season(2002, 1)]),
      byId,
      'perGame'
    )
    expect(rows.map((r) => [r.label, r.gap])).toEqual([
      ['1994-95', false],
      ['1995-96', true],
      ['1996-97', true],
      ['1997-98', false],
      ['1998-99', true],
      ['1999-00', true],
      ['2000-01', true],
      ['2001-02', false]
    ])
    expect(rows[1].games).toBe('0')
  })

  it('says why a stat is empty in a season before it was recorded', () => {
    const [first] = careerRows(result([season(1995, null)]), byId, 'perGame')
    const at = LINE_METRICS.indexOf('plus_minus')
    expect(first.cells[at]).toEqual({ text: '—', title: 'Recorded from 1996-97.' })
  })

  it('reads nothing with no seasons', () => {
    expect(careerRows(null, byId, 'perGame')).toEqual([])
    expect(careerTotal(null, byId, 'perGame', null)).toBeNull()
  })

  it('leaves out an average of a stat that started after the career did', () => {
    const total = result([row('1', { plus_minus: value(3.6), pts: value(26.6) }, { games: 404 })])
    const at = LINE_METRICS.indexOf('plus_minus')
    const pts = LINE_METRICS.indexOf('pts')
    const early = careerTotal(total, byId, 'perGame', 1995)
    expect(early?.games).toBe('404')
    expect(early?.cells[at].text).toBe('—')
    expect(early?.cells[at].title).toContain('Recorded from 1996-97')
    expect(early?.cells[pts].text).toBe('26.6')
    expect(careerTotal(total, byId, 'raw', 1995)?.cells[at]).toEqual({
      text: '4',
      title: 'From 1996-97 only.'
    })
    expect(careerTotal(total, byId, 'perGame', 2004)?.cells[at].text).toBe('3.6')
  })
})

describe('the game log', () => {
  const line = (id: string, pts: number, over: Partial<StatsRow> = {}): StatsRow =>
    row(
      '1',
      {
        gs: value(1),
        min: value(36.2),
        pts: value(pts),
        fgm: value(4),
        fga: value(8),
        fg_pct: value(0.5)
      },
      { group: { game: id }, ...over }
    )

  it('asks for each game in scope, as recorded', () => {
    expect(logQuery('1', SCOPE)).toMatchObject({
      groupBy: ['game'],
      transform: 'raw',
      scope: { players: ['1'], seasons: [2026] }
    })
  })

  it('reads a game from the player’s side', () => {
    expect(gameFacts(game(), 'BOS')).toEqual({
      date: 'Jan 5',
      opponent: 'vs LAL',
      score: 'W 110–102',
      result: 'W',
      type: null
    })
    expect(gameFacts(game({ overtimes: 2, type: 'playoffs' }), 'LAL')).toEqual({
      date: 'Jan 5',
      opponent: '@ BOS',
      score: 'L 102–110 2OT',
      result: 'L',
      type: 'Playoffs'
    })
    expect(gameFacts(game({ played: false }), 'BOS').result).toBeNull()
  })

  it('sorts newest first, writes minutes as a clock and pairs as made-attempted', () => {
    const rows = logRows(
      result([line('old', 10), line('new', 20)]),
      [game({ id: 'old', date: '2026-01-01' }), game({ id: 'new', date: '2026-03-01' })],
      byId
    )
    expect(rows.map((r) => r.key)).toEqual(['new', 'old'])
    expect(rows[0]).toMatchObject({ date: 'Mar 1', started: true })
    expect(rows[0].cells[0]).toBe('36:12')
    expect(rows[0].cells[1]).toBe('20')
    expect(rows[0].cells[6]).toBe('4-8')
    expect(rows[0].cells[7]).toBe('50.0%')
  })

  it('keeps the numbers of a game the schedule does not hold', () => {
    const [r] = logRows(result([line('gone', 10)]), [], byId)
    expect(r).toMatchObject({ key: 'gone', date: '', score: null })
    expect(r.cells[1]).toBe('10')
    expect(logRows(null, [], byId)).toEqual([])
  })

  it('writes a total’s minutes whole', () => {
    expect(logTotalCells(line('t', 30), byId)[0]).toBe('36')
    expect(logTotalCells(undefined, byId)).toEqual([])
  })

  it('finds a log that does not add up to its total, and ignores rates', () => {
    const log = result([line('a', 10), line('b', 20)])
    const whole = row('1', { pts: value(30), min: value(72.4), fg_pct: value(0.9) })
    expect(logDifferences(log, whole)).toEqual([])
    expect(logDifferences(log, row('1', { pts: value(31) }))).toEqual(['pts'])
    expect(logDifferences(log, undefined)).toEqual(['every count'])
    expect(logDifferences(result([]), undefined)).toEqual([])
  })

  it('charts a metric by game, oldest first', () => {
    const series = gameSeries(
      result([line('new', 20), line('old', 10)]),
      [game({ id: 'old', date: '2026-01-01' }), game({ id: 'new', date: '2026-03-01' })],
      'pts',
      'Points'
    )
    expect(series.points.map((p) => [p.label, p.title, p.value])).toEqual([
      ['Jan 1', 'Jan 1 vs LAL', 10],
      ['Mar 1', 'Mar 1 vs LAL', 20]
    ])
    expect(gameSeries(null, null, 'pts', 'Points').points).toEqual([])
  })
})

describe('the splits', () => {
  const SEASON: StatsSeason = {
    season: 2004,
    firstDate: '2003-10-28',
    lastDate: '2004-04-14',
    types: [{ type: 'regular', games: 1189 }],
    teams: [
      { id: '1', code: 'BOS', name: 'Boston', conference: 'east', division: 'atlantic' },
      { id: '2', code: 'SAS', name: 'San Antonio', conference: 'west', division: 'midwest' }
    ]
  }

  it('takes conferences and divisions from the season: the Midwest had its years', () => {
    const defs = splitDefs(SEASON)
    expect(defs.filter((d) => d.group.startsWith('Against')).map((d) => d.label)).toEqual([
      'East',
      'West',
      'Atlantic',
      'Midwest'
    ])
    expect(splitDefs(undefined).some((d) => d.group.startsWith('Against'))).toBe(false)
  })

  it('asks the engine once per split, plus the months and the opponents', () => {
    const defs = splitDefs(SEASON)
    const q = splitQueries('7', defs, SCOPE, 'perGame')
    expect(q.size).toBe(defs.length + 3)
    expect(q.get('home')?.scope).toMatchObject({ home: true, players: ['7'], seasons: [2026] })
    expect(q.get('rest0')?.scope.restDays).toEqual([0, 0])
    expect(q.get('conf-east')?.scope.conferences).toEqual(['east'])
    expect(q.get('months')?.groupBy).toEqual(['month'])
    expect(q.get('opponents')?.groupBy).toEqual(['opponent'])
  })

  it('lays out the groups, leaves out a split with no games, and orders the season', () => {
    const defs = splitDefs(SEASON)
    const one = (over: Partial<StatsRow> = {}): StatsResult =>
      result([row('7', { pts: value(20) }, { games: 3, ...over })])
    const results = new Map<string, StatsResult>([
      ['all', one()],
      ['home', one()],
      ['road', result([])],
      [
        'months',
        result([
          row('7', { pts: value(1) }, { group: { month: 1 } }),
          row('7', { pts: value(2) }, { group: { month: 11 } })
        ])
      ],
      [
        'opponents',
        result([
          row('7', { pts: value(1) }, { group: { opponent: 2 } }),
          row('7', { pts: value(2) }, { group: { opponent: 1 } })
        ])
      ]
    ])
    const groups = splitTable(results, defs, SEASON, byId, 'perGame')
    expect(groups.map((g) => g.title)).toEqual(['Overall', 'Where', 'By month', 'By opponent'])
    expect(groups[1].rows.map((r) => r.label)).toEqual(['Home'])
    expect(groups[1].rows[0].games).toBe('3')
    expect(groups[2].rows.map((r) => r.label)).toEqual(['November', 'January'])
    expect(groups[3].rows.map((r) => r.label)).toEqual(['BOS', 'SAS'])
  })

  it('states what the answers depend on, once', () => {
    const a = { ...result([]), notes: ['Who started is unknown for some games.'] }
    const b = { ...result([]), notes: ['Who started is unknown for some games.'] }
    const results = new Map([
      ['a', a],
      ['b', b]
    ])
    expect(splitNotes(results, SCOPE)).toEqual(['Who started is unknown for some games.'])
    expect(
      splitNotes(results, { ...SCOPE, range: { kind: 'last', n: 10, of: 'appearances' } })
    ).toContain('Each split reads its own last 10 games.')
  })
})
