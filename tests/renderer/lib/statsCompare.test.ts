import { describe, expect, it } from 'vitest'
import {
  addFamily,
  addSubjects,
  blankReason,
  candidatesQuery,
  compareColumns,
  compareQuery,
  compareScopeLabel,
  compareView,
  compareWith,
  DEFAULT_COMPARE,
  defaultColumns,
  fillSlots,
  leaders,
  NO_SLOTS,
  playerCandidates,
  poolNote,
  rangeNote,
  rankedResult,
  searchCandidates,
  setColumns,
  setEntity,
  setSlot,
  slotCard,
  spanOptions,
  spanSeasons,
  teamCandidates,
  type CompareRow,
  type CompareState,
  type Slots
} from '@/lib/stats/compare'
import type { StatsScope } from '@/lib/stats/scope'
import type {
  MetricValue,
  StatsResult,
  StatsResultColumn,
  StatsRow,
  StatsSeason
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const catalogue = catalogueFixture()
const byId = new Map(catalogue.map((m) => [m.id, m]))

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
  games: 60,
  values,
  ...over
})

const column = (id: string, reason: string | null = null): StatsResultColumn => {
  const info = byId.get(id)!
  return {
    id,
    label: info.label,
    short: info.short,
    unit: info.unit,
    decimals: info.decimals,
    direction: info.direction,
    seasons: reason ? [] : [2026],
    reason
  }
}

const result = (rows: StatsRow[], columns: StatsResultColumn[]): StatsResult => ({
  grain: 'season',
  columns,
  rows,
  total: rows.length,
  notes: [],
  ms: 3
})

const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

const season = (s: number, teams: StatsSeason['teams'] = []): StatsSeason => ({
  season: s,
  firstDate: `${s - 1}-10-20`,
  lastDate: `${s}-04-12`,
  types: [{ type: 'regular', games: 1230 }],
  teams
})

const SEASONS = [2026, 2025, 2024, 2023, 2022, 2021].map((s) => season(s))

describe('slots', () => {
  it('clears the slots when the kind changes, and keeps them when it does not', () => {
    const s: CompareState = { ...DEFAULT_COMPARE, slots: ['a', 'b', null] }
    expect(setEntity(s, 'player')).toBe(s)
    const t = setEntity(s, 'team')
    expect(t.entity).toBe('team')
    expect(t.slots).toEqual(NO_SLOTS)
    expect(t.autofill).toBe(false)
  })

  it('puts someone in a slot, moves them rather than doubling, and empties a slot', () => {
    const s: CompareState = { ...DEFAULT_COMPARE, slots: ['a', 'b', null] }
    expect(setSlot(s, 2, 'c').slots).toEqual(['a', 'b', 'c'])
    expect(setSlot(s, 2, 'a').slots).toEqual([null, 'b', 'a'])
    expect(setSlot(s, 1, null).slots).toEqual(['a', null, null])
    expect(setSlot(s, 1, null).autofill).toBe(false)
  })

  it('adds a dashboard subject to the first open slot, or the last when all are taken', () => {
    const s: CompareState = { ...DEFAULT_COMPARE, slots: ['a', null, 'c'] }
    expect(addSubjects(s, 'player', ['x']).slots).toEqual(['a', 'x', 'c'])
    expect(addSubjects(s, 'player', ['a']).slots).toEqual(['a', null, 'c'])
    const full: CompareState = { ...s, slots: ['a', 'b', 'c'] }
    expect(addSubjects(full, 'player', ['x']).slots).toEqual(['a', 'b', 'x'])
  })

  it('starts over with a subject of the other kind', () => {
    const s: CompareState = { ...DEFAULT_COMPARE, slots: ['a', 'b', 'c'] }
    const t = addSubjects(s, 'team', ['1610612738'])
    expect(t.entity).toBe('team')
    expect(t.slots).toEqual(['1610612738', null, null])
  })

  it("takes a dashboard's subjects through compareWith, the first one's kind deciding", () => {
    const s: CompareState = { ...DEFAULT_COMPARE, slots: ['a', null, null] }
    expect(compareWith(s, [{ entity: 'player', id: 'x' }]).slots).toEqual(['a', 'x', null])
    const t = compareWith(s, [
      { entity: 'team', id: '1' },
      { entity: 'player', id: 'y' }
    ])
    expect(t).toMatchObject({ entity: 'team', slots: ['1', null, null] })
    expect(compareWith(s, [])).toBe(s)
  })

  it('fills open slots from the candidates, skipping anyone already there', () => {
    const slots: Slots = ['b', null, null]
    expect(fillSlots(slots, ['a', 'b', 'c', 'd'])).toEqual(['b', 'a', 'c'])
    expect(fillSlots(slots, ['b'])).toEqual(['b', null, null])
  })
})

describe('rows', () => {
  it('opens on the core of the box score, shooting and composites for players, minutes kept', () => {
    const cols = defaultColumns('player', catalogue)
    expect(cols[0]).toBe('min')
    expect(cols).toContain('pts')
    expect(cols).toContain('ts_pct')
    expect(cols).toContain('gmsc')
    expect(cols).not.toContain('gp')
    expect(cols.every((id) => byId.get(id)?.entity === 'player')).toBe(true)
  })

  it('opens on the box score, shooting and ratings for teams, at most 40', () => {
    const cols = defaultColumns('team', catalogue)
    expect(cols).toContain('team_ortg')
    expect(cols).toContain('opp_tov')
    expect(cols.length).toBeLessThanOrEqual(40)
    expect(cols.every((id) => byId.get(id)?.entity === 'team')).toBe(true)
  })

  it("keeps each kind's own rows, the minutes always first for players", () => {
    const s = setColumns(DEFAULT_COMPARE, ['pts', 'ast'])
    expect(compareColumns(s, catalogue)).toEqual(['min', 'pts', 'ast'])
    const t = setEntity(s, 'team')
    expect(compareColumns(t, catalogue)).toEqual(defaultColumns('team', catalogue))
  })

  it('adds a family at the end, without repeats, up to 40', () => {
    const cols = addFamily(['min', 'pts'], 'tracking', 'player', catalogue)
    expect(cols.slice(0, 2)).toEqual(['min', 'pts'])
    expect(cols.length).toBeGreaterThan(2)
    expect(cols.slice(2).every((id) => byId.get(id)?.family === 'tracking')).toBe(true)
    const many = Array.from({ length: 39 }, (_, i) => `x${i}`)
    expect(addFamily(many, 'tracking', 'player', catalogue)).toHaveLength(40)
  })
})

describe('seasons', () => {
  it("reads a span back from the scope bar's season", () => {
    expect(spanSeasons(1, SCOPE, SEASONS)).toEqual([2026])
    expect(spanSeasons(3, SCOPE, SEASONS)).toEqual([2026, 2025, 2024])
    expect(spanSeasons('all', { ...SCOPE, season: 2024 }, SEASONS)).toEqual([
      2024, 2023, 2022, 2021
    ])
  })

  it('offers a span only when it reaches further back', () => {
    expect(spanOptions(SCOPE, SEASONS).map((o) => o.value)).toEqual([1, 3, 5, 'all'])
    expect(spanOptions(SCOPE, SEASONS).at(-1)?.label).toBe('Every season (2020-21 to 2025-26)')
  })

  it('labels one season with its range and several as whole seasons', () => {
    expect(compareScopeLabel(SCOPE, [2026], 'player')).toBe(
      '2025-26 · Regular season · Whole season'
    )
    expect(compareScopeLabel(SCOPE, [2026, 2025, 2024], 'player')).toBe(
      '2023-24 to 2025-26 · Regular season · Whole seasons'
    )
    const dates: StatsScope = {
      ...SCOPE,
      range: { kind: 'dates', from: '2026-01-01', to: '2026-02-01' }
    }
    expect(rangeNote(dates, [2026])).toBeNull()
    expect(rangeNote(dates, [2026, 2025])).toMatch(/read whole/)
  })
})

describe('compareQuery', () => {
  it('asks for every player in one season, so ranks match the dashboards', () => {
    const s: CompareState = { ...DEFAULT_COMPARE, slots: ['a', 'b', null] }
    const q = compareQuery(s, ['pts', 'tov'], SCOPE, [2026])!
    expect(q.entity).toBe('player')
    expect(q.metrics).toEqual(['min', 'pts', 'tov'])
    expect(q.scope).toEqual({ seasons: [2026], gameTypes: ['regular'] })
    expect(q.transform).toBe('perGame')
    expect(q.sort).toEqual({ metric: 'pts', dir: 'desc' })
    expect(q.limit).toBe(1000)
  })

  it('carries a date range for one season', () => {
    const dates: StatsScope = {
      ...SCOPE,
      range: { kind: 'dates', from: '2026-01-01', to: '2026-02-01' }
    }
    const q = compareQuery(DEFAULT_COMPARE, ['pts'], dates, [2026])!
    expect(q.scope.dates).toEqual(['2026-01-01', '2026-02-01'])
  })

  it('asks for the slots alone over several seasons, whole, and nothing with no slot', () => {
    const s: CompareState = { ...DEFAULT_COMPARE, slots: ['a', null, 'c'], mode: 'raw' }
    const dates: StatsScope = { ...SCOPE, range: { kind: 'last', n: 10, of: 'appearances' } }
    const q = compareQuery(s, ['pts'], dates, [2026, 2025])!
    expect(q.scope).toEqual({ seasons: [2026, 2025], gameTypes: ['regular'], players: ['a', 'c'] })
    expect(q.limit).toBe(3)
    expect(compareQuery({ ...s, slots: NO_SLOTS }, ['pts'], SCOPE, [2026, 2025])).toBeNull()
  })

  it('filters teams by team, sorted by net rating when shown', () => {
    const s: CompareState = { ...DEFAULT_COMPARE, entity: 'team', slots: ['1', '2', null] }
    const one = compareQuery(s, ['team_pts', 'team_nrtg'], SCOPE, [2026])!
    expect(one.metrics).toEqual(['team_pts', 'team_nrtg'])
    expect(one.sort?.metric).toBe('team_nrtg')
    expect(one.limit).toBe(40)
    const many = compareQuery(s, ['team_pts'], SCOPE, [2026, 2025])!
    expect(many.scope.teams).toEqual(['1', '2'])
    expect(many.sort?.metric).toBe('team_pts')
  })

  it('searches every player of the seasons by minutes', () => {
    const q = candidatesQuery(SCOPE, [2026, 2025])
    expect(q.metrics).toEqual(['min'])
    expect(q.scope.seasons).toEqual([2026, 2025])
    expect(q.limit).toBe(5000)
  })
})

describe('ranks', () => {
  const minutes = (n: number): MetricValue => value(n, { qualified: n >= 500 })
  const res = result(
    [
      row('a', { min: minutes(2000), pts: value(25) }, { position: 'G' }),
      row('b', { min: minutes(1800), pts: value(20) }, { position: 'G' }),
      row('c', { min: minutes(1500), pts: value(30) }, { position: 'C' }),
      row('d', { min: minutes(100), pts: value(40) }, { position: 'G' })
    ],
    [column('min'), column('pts')]
  )

  it('ranks a player among the qualified players of their position', () => {
    const r = rankedResult(res, 'player', false)
    const pts = (id: string): MetricValue => r.rows.find((x) => x.id === id)!.values.pts
    expect(pts('a').rank).toBe(1)
    expect(pts('b').rank).toBe(2)
    expect(pts('c').rank).toBe(1)
    expect(pts('d').rank).toBeNull()
  })

  it('drops ranks over several seasons', () => {
    const r = rankedResult(
      result([row('a', { pts: value(25, { rank: 1, percentile: 100 }) })], [column('pts')]),
      'player',
      true
    )
    expect(r.rows[0].values.pts).toMatchObject({ rank: null, percentile: null, value: 25 })
  })

  it('takes the leaders from the qualified rows in order', () => {
    expect(leaders(res, 'player')).toEqual(['a', 'b', 'c'])
  })
})

describe('compareView', () => {
  const res = result(
    [
      row('a', { pts: value(25.04), tov: value(3.1), usg_pct: value(0.3), fg3_pct: value(0.4) }),
      row('b', { pts: value(25.01), tov: value(2.0), usg_pct: value(0.2), fg3_pct: value(null) }),
      row('c', { pts: value(20), tov: value(2.0), usg_pct: value(0.25), fg3_pct: value(0.35) })
    ],
    [
      column('pts'),
      column('tov'),
      column('usg_pct'),
      column('fg3_pct'),
      column('dist_miles', 'Recorded from 2013-14.')
    ]
  )
  const cols = ['pts', 'tov', 'usg_pct', 'fg3_pct', 'dist_miles']
  const view = compareView(res, ['a', 'b', 'c'], cols, byId, 'perGame', 'player')
  const line = (id: string): CompareRow =>
    view.groups.flatMap((g) => g.rows).find((r) => r.metric === id)!

  it('groups the rows by family in the leaderboard order', () => {
    expect(view.groups.map((g) => g.label)).toEqual(['Traditional', 'Shooting', 'Tracking'])
  })

  it('marks the best value the metric’s way, both of a tie for best', () => {
    // 25.04 and 25.01 both read 25.0: a tie at the shown precision.
    expect(line('pts').cells.map((c) => c?.lead)).toEqual([true, true, false])
    // Fewer turnovers are better.
    expect(line('tov').cells.map((c) => c?.lead)).toEqual([false, true, true])
  })

  it('marks nothing on a metric with no better side', () => {
    expect(byId.get('usg_pct')?.direction).toBe('neutral')
    expect(line('usg_pct').cells.every((c) => !c?.lead)).toBe(true)
  })

  it('marks nothing when every value ties', () => {
    const tied = compareView(
      result([row('a', { tov: value(2) }), row('b', { tov: value(2) })], [column('tov')]),
      ['a', 'b', null],
      ['tov'],
      byId,
      'raw',
      'player'
    )
    expect(tied.groups[0].rows[0].cells.map((c) => c?.lead ?? null)).toEqual([false, false, null])
    expect(tied.counted).toBe(1)
  })

  it('shows a blank with its reason, never a zero', () => {
    const b = line('fg3_pct').cells[1]!
    expect(b.text).toBe('—')
    expect(b.title).toBe('No 3-point attempts in scope.')
    expect(line('fg3_pct').cells.map((c) => c?.lead)).toEqual([true, false, false])
  })

  it('says why a metric has no value in scope across the row', () => {
    expect(line('dist_miles').missing).toBe('Recorded from 2013-14.')
    expect(line('dist_miles').cells.every((c) => c?.text === '—' && !c.lead)).toBe(true)
  })

  it('counts the leads of each slot over the rows that can be led', () => {
    expect(view.leads).toEqual([2, 2, 1])
    expect(view.counted).toBe(3)
  })

  it('names the mode for a rescaled count only', () => {
    expect(line('pts').sub).toBe('per game')
    expect(line('fg3_pct').sub).toBe('')
  })

  it('leaves an open slot empty', () => {
    const v = compareView(res, ['a', null, 'c'], ['pts'], byId, 'perGame', 'player')
    expect(v.groups[0].rows[0].cells[1]).toBeNull()
  })

  it('blanks a slot whose seasons all predate a metric, with the coverage reason', () => {
    const old = result(
      [row('a', { dist_miles: value(null) }), row('b', { dist_miles: value(2.1) })],
      [column('dist_miles')]
    )
    const v = compareView(old, ['a', 'b', null], ['dist_miles'], byId, 'perGame', 'player', [
      [2010, 2011, 2012],
      [2013, 2014]
    ])
    const [a, b] = v.groups[0].rows[0].cells
    expect(a).toMatchObject({ text: '—', title: 'Recorded from 2013-14.', lead: false })
    expect(b!.text).toBe('2.10')
    expect(b!.title).toMatch(/^Recorded from 2013-14 only\./)
  })

  it('blanks a rate over seasons a game-level count was not recorded in, and keeps its total', () => {
    const r = result(
      [row('a', { plus_minus: value(4.2) }), row('b', { plus_minus: value(1) })],
      [column('plus_minus')]
    )
    const seasons = [[1996, 1997, 1998], [2000]]
    const rate = compareView(
      r,
      ['a', 'b', null],
      ['plus_minus'],
      byId,
      'perGame',
      'player',
      seasons
    )
    expect(rate.groups[0].rows[0].cells[0]).toMatchObject({
      text: '—',
      title: 'Recorded from 1996-97, so an average over these seasons would not be exact.'
    })
    expect(rate.counted).toBe(0)
    const total = compareView(r, ['a', 'b', null], ['plus_minus'], byId, 'raw', 'player', seasons)
    expect(total.groups[0].rows[0].cells[0]!.text).toBe('4')
    expect(total.groups[0].rows[0].cells[0]!.title).toMatch(/^Recorded from 1996-97 only\./)
  })

  it('gives a rank and the dashboards’ hover when ranked', () => {
    const r = result([row('a', { pts: value(25, { percentile: 90, rank: 4 }) })], [column('pts')])
    const c = compareView(r, ['a', null, null], ['pts'], byId, 'perGame', 'player').groups[0]
      .rows[0].cells[0]!
    expect(c.rank).toBe('4th')
    expect(c.percentile).toBe(90)
    expect(c.title).toMatch(/90th percentile among qualified guards/)
  })
})

describe('blankReason', () => {
  const info = byId.get('fg3_pct')!
  it('says when there were no games, or no sample', () => {
    expect(blankReason(info, undefined, null)).toBe('No games in scope.')
    expect(blankReason(info, row('a', {}), null)).toBe('No 3-point attempts in scope.')
  })
})

describe('cards and search', () => {
  const res = result(
    [
      row('a', { min: value(900, { raw: 900 }) }, { name: 'Luka Dončić', team: 'LAL' }),
      row(
        'b',
        { min: value(1200, { raw: 1200, qualified: false }) },
        { name: 'Jalen Brunson', team: 'NYK' }
      )
    ],
    [column('min')]
  )

  it('reads a slot card from its row, or the id while it loads', () => {
    expect(slotCard(res, 'a', 'player')).toMatchObject({
      name: 'Luka Dončić',
      team: 'LAL',
      games: 60,
      qualified: true
    })
    expect(slotCard(res, 'b', 'player').qualified).toBe(false)
    expect(slotCard(null, 'z', 'player', 'Zed')).toMatchObject({ name: 'Zed', games: 0 })
  })

  it('lists players by minutes and finds them without accents', () => {
    const list = playerCandidates(res)
    expect(list.map((c) => c.id)).toEqual(['b', 'a'])
    expect(list[1].detail).toBe('LAL · G')
    expect(searchCandidates(list, 'doncic', []).map((c) => c.id)).toEqual(['a'])
    expect(searchCandidates(list, '', ['b']).map((c) => c.id)).toEqual(['a'])
  })

  it('lists the teams of the seasons once, by their latest name', () => {
    const team = (id: string, code: string, name: string): StatsSeason['teams'][number] => ({
      id,
      code,
      name,
      conference: null,
      division: null
    })
    const seasons = [
      season(2026, [team('1', 'OKC', 'Oklahoma City Thunder'), team('2', 'BOS', 'Boston Celtics')]),
      season(2008, [team('1', 'SEA', 'Seattle SuperSonics')])
    ]
    const list = teamCandidates(seasons, [2026, 2008])
    expect(list.map((c) => c.name)).toEqual(['Boston Celtics', 'Oklahoma City Thunder'])
    expect(searchCandidates(list, 'okc', []).map((c) => c.id)).toEqual(['1'])
  })
})

describe('poolNote', () => {
  it('says what the ranks are among', () => {
    expect(poolNote('player', [2026], null)).toMatch(/same position/)
    expect(poolNote('team', [2026], result([], []))).toMatch(/among the 0 teams/)
    expect(poolNote('player', [2026, 2025], null)).toMatch(/none are shown/)
  })
})
