import { describe, expect, it } from 'vitest'
import {
  axisLabel,
  categoryColour,
  CHART_ROWS,
  chartAxes,
  chartExtras,
  chartMetrics,
  chartQuery,
  chartRows,
  chartSubtitle,
  chartTab,
  chartTitle,
  chartValue,
  chartView,
  compareSubjects,
  CONFERENCE_COLOUR,
  corners,
  DEFAULT_CHART,
  dotRadius,
  fewNote,
  isCategory,
  labelItems,
  MIN_DOTS,
  missingAxis,
  pearson,
  placeLabels,
  PLOT,
  POSITION_COLOUR,
  PRESETS,
  resetChart,
  scaled,
  scales,
  shortName,
  ticks,
  whoWords,
  type ChartDot,
  type ChartState
} from '@/lib/stats/chart'
import type { StatsScope } from '@/lib/stats/scope'
import type { MetricInfo, MetricValue, StatsResult, StatsRow, StatsTeam } from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const catalogue = catalogueFixture()
const byId = new Map(catalogue.map((m) => [m.id, m]))
const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

const v = (
  value: number | null,
  qualified = true,
  percentile: number | null = null
): MetricValue => ({
  value,
  raw: value,
  sample: value === null ? null : 100,
  qualified,
  percentile,
  rank: null
})

/** A player row: usage, true shooting and minutes; `min` qualifies them unless `nq`. */
function player(
  id: string,
  usg: number | null,
  ts: number | null,
  over: { position?: string; team?: string; nq?: boolean; name?: string } = {}
): StatsRow {
  return {
    id,
    name: over.name ?? `Player ${id}`,
    team: over.team ?? 'BOS',
    position: over.position ?? 'G',
    group: {},
    games: 40,
    values: {
      usg_pct: v(usg),
      ts_pct: v(ts),
      ast: v(Number(id) % 7),
      min: v(30, !over.nq)
    }
  }
}

function result(
  rows: StatsRow[],
  reasons: Record<string, string> = {},
  total = rows.length
): StatsResult {
  const ids = Object.keys(rows[0]?.values ?? { usg_pct: 0, ts_pct: 0 })
  return {
    grain: 'season',
    columns: ids.map((id) => ({
      id,
      label: byId.get(id)?.label ?? id,
      short: id,
      unit: byId.get(id)?.unit ?? 'number',
      decimals: 1,
      direction: byId.get(id)?.direction ?? 'higher',
      seasons: reasons[id] ? [] : [2026],
      reason: reasons[id] ?? null
    })),
    rows,
    total,
    notes: [],
    ms: 1
  } satisfies StatsResult
}

/** Twelve qualified guards spread along both axes, and two below the minutes. */
const ROWS = [
  ...Array.from({ length: 12 }, (_, i) => player(String(i + 1), 0.15 + i * 0.01, 0.5 + i * 0.01)),
  player('20', 0.4, 0.7, { nq: true }),
  player('21', 0.1, null)
]

const TEAMS: StatsTeam[] = [
  {
    id: '1610612738',
    code: 'BOS',
    name: 'Boston Celtics',
    conference: 'east',
    division: 'atlantic'
  },
  {
    id: '1610612747',
    code: 'LAL',
    name: 'Los Angeles Lakers',
    conference: 'west',
    division: 'pacific'
  }
]

describe('presets and axes', () => {
  it('name metrics the catalogue has, for the right entity', () => {
    for (const entity of ['player', 'team'] as const) {
      expect(PRESETS[entity].length).toBeGreaterThan(1)
      for (const p of PRESETS[entity]) {
        expect(byId.get(p.x)?.entity, p.x).toBe(entity)
        expect(byId.get(p.y)?.entity, p.y).toBe(entity)
        expect(byId.get(p.x)?.tier, p.x).not.toBe('stored')
        expect(byId.get(p.y)?.tier, p.y).not.toBe('stored')
      }
    }
  })

  it('include a season-grain pair, so a preset shows what tracking can and cannot answer', () => {
    expect(PRESETS.player.some((p) => byId.get(p.x)?.published && byId.get(p.y)?.published)).toBe(
      true
    )
  })

  it('open on the first preset, and the state wins once chosen', () => {
    expect(chartAxes(DEFAULT_CHART)).toEqual({ x: 'usg_pct', y: 'ts_pct' })
    expect(chartAxes({ ...DEFAULT_CHART, entity: 'team' })).toEqual({
      x: 'team_ortg',
      y: 'team_drtg'
    })
    expect(chartAxes({ ...DEFAULT_CHART, x: 'pts', y: 'drives' })).toEqual({
      x: 'pts',
      y: 'drives'
    })
  })

  it('add size and a metric colour once, never a category or an axis again', () => {
    const axes = { x: 'usg_pct', y: 'ts_pct' }
    expect(chartExtras({ ...DEFAULT_CHART, size: 'ast', colour: 'ast' }, axes)).toEqual(['ast'])
    expect(
      chartExtras({ ...DEFAULT_CHART, size: 'ts_pct', colour: POSITION_COLOUR }, axes)
    ).toEqual([])
    expect(chartExtras({ ...DEFAULT_CHART, size: 'reb', colour: 'stl' }, axes)).toEqual([
      'reb',
      'stl'
    ])
  })

  it('a reset keeps the entity asked for and drops axes, picks and filters', () => {
    const busy: ChartState = {
      ...DEFAULT_CHART,
      x: 'pts',
      y: 'ast',
      size: 'reb',
      colour: 'stl',
      team: 'BOS',
      search: 'tat',
      picks: ['1'],
      sort: { by: 'name', dir: -1 }
    }
    const next = resetChart(busy, { entity: 'team' })
    expect(next).toMatchObject({ entity: 'team', x: null, y: null, size: null, colour: null })
    expect(next).toMatchObject({ team: null, search: '', picks: [], sort: DEFAULT_CHART.sort })
    expect(next.mode).toBe(busy.mode)
  })

  it('offers the leaderboard picker’s metrics by family, and only those with a better side to scale', () => {
    const groups = chartMetrics(catalogue, 'player')
    const all = groups.flatMap((g) => g.metrics)
    expect(all.every((m) => m.entity === 'player' && m.tier !== 'stored')).toBe(true)
    expect(all.some((m) => m.id === 'drives')).toBe(true)
    expect(groups[0].label).toBeTruthy()
    expect(
      chartMetrics(catalogue, 'team')
        .flatMap((g) => g.metrics)
        .every((m) => m.entity === 'team')
    ).toBe(true)
    expect(scaled([byId.get('usg_pct')!, byId.get('ts_pct')!]).map((m) => m.id)).toEqual(['ts_pct'])
  })

  it('tells a colour category from a metric', () => {
    expect(isCategory(POSITION_COLOUR)).toBe(true)
    expect(isCategory(CONFERENCE_COLOUR)).toBe(true)
    expect(isCategory('ts_pct')).toBe(false)
    expect(isCategory(null)).toBe(false)
  })
})

describe('the query', () => {
  it('asks for every player of the position, with the leaderboard’s qualifier, in the mode', () => {
    const q = chartQuery(
      { entity: 'player', position: 'C', mode: 'per36' },
      ['usg_pct', 'ts_pct'],
      SCOPE
    )
    expect(q).toMatchObject({
      entity: 'player',
      metrics: ['usg_pct', 'ts_pct', 'min'],
      scope: { seasons: [2026], gameTypes: ['regular'], positions: ['C'] },
      transform: 'per36',
      limit: CHART_ROWS
    })
    expect(
      chartQuery({ entity: 'player', position: 'ALL', mode: 'perGame' }, ['min', 'pts'], SCOPE)
        .metrics
    ).toEqual(['min', 'pts'])
  })

  it('asks for every team with no qualifier, and passes a date range through', () => {
    const scope: StatsScope = {
      ...SCOPE,
      range: { kind: 'dates', from: '2025-11-01', to: '2025-12-01' }
    }
    const q = chartQuery(
      { entity: 'team', position: 'ALL', mode: 'raw' },
      ['team_ortg', 'team_drtg'],
      scope
    )
    expect(q.metrics).toEqual(['team_ortg', 'team_drtg'])
    expect(q.scope.dates).toEqual(['2025-11-01', '2025-12-01'])
    expect(q.scope.positions).toBeUndefined()
  })

  it('qualifies as the leaderboards do: the position tab’s minutes for players, none for teams', () => {
    expect(chartTab({ entity: 'player', position: 'G' }).qualifier).toBe('min')
    expect(chartTab({ entity: 'player', position: 'G' }).positions).toEqual(['G'])
    expect(chartTab({ entity: 'team', position: 'G' }).qualifier).toBeUndefined()
  })
})

describe('the view', () => {
  it('plots qualified rows with both values, with means, domains and r', () => {
    const view = chartView(result(ROWS), DEFAULT_CHART, byId)
    if (view.kind !== 'ready') throw new Error(view.kind)
    expect(view.dots).toHaveLength(12)
    expect(view.qualified).toBe(12)
    expect(view.domain.x[0]).toBeCloseTo(0.15)
    expect(view.domain.x[1]).toBeCloseTo(0.26)
    expect(view.mean.y).toBeCloseTo(0.555)
    expect(view.r).toBeCloseTo(1)
    expect(view.truncated).toBeNull()
    // Percentiles are re-ranked among the qualified, as on the leaderboards.
    expect(view.dots.find((d) => d.id === '12')?.percentiles.ts_pct).toBe(100)
  })

  it('shows rows below the minutes when asked, greyed as not qualified', () => {
    const view = chartView(result(ROWS), { ...DEFAULT_CHART, qualifiedOnly: false }, byId)
    if (view.kind !== 'ready') throw new Error(view.kind)
    expect(view.dots).toHaveLength(13)
    expect(view.dots.find((d) => d.id === '20')).toMatchObject({ qualified: false })
    expect(view.dots.find((d) => d.id === '20')?.percentiles.ts_pct).toBeNull()
    expect(view.qualified).toBe(12)
  })

  it('says too few qualify below ten dots, with how many qualify and how many have values', () => {
    const few = [...ROWS.slice(0, 6), player('30', 0.2, 0.6, { nq: true })]
    expect(chartView(result(few), DEFAULT_CHART, byId)).toEqual({
      kind: 'few',
      qualified: 6,
      all: 7
    })
    expect(MIN_DOTS).toBe(10)
  })

  it('says why an axis is empty, in the engine’s words, before anything else', () => {
    const rows = ROWS.map((r) => ({ ...r, values: { ...r.values, ts_pct: v(null) } }))
    const view = chartView(
      result(rows, { ts_pct: 'Published for whole seasons only.' }),
      DEFAULT_CHART,
      byId
    )
    expect(view).toEqual({
      kind: 'missing',
      text: 'True shooting percentage: Published for whole seasons only.'
    })
    expect(
      missingAxis(result(ROWS, { usg_pct: 'Recorded from 2013-14.' }), ['usg_pct'], byId)
    ).toBe('Usage percentage: Recorded from 2013-14.')
    expect(missingAxis(result(ROWS), ['usg_pct', 'ts_pct'], byId)).toBeNull()
  })

  it('says when the engine stopped at its row limit', () => {
    const view = chartView(result(ROWS, {}, 9000), DEFAULT_CHART, byId)
    if (view.kind !== 'ready') throw new Error(view.kind)
    expect(view.truncated).toEqual({ shown: 14, total: 9000 })
  })

  it('keeps one team’s dots but the pool’s axes, finds a name, and puts picks last', () => {
    const rows = ROWS.map((r, i) => (i < 3 ? { ...r, team: 'LAL' } : r))
    const state = { ...DEFAULT_CHART, team: 'LAL', search: 'player 2', picks: ['3', '99'] }
    const view = chartView(result(rows), state, byId)
    if (view.kind !== 'ready') throw new Error(view.kind)
    expect(view.dots.map((d) => d.id).sort()).toEqual(['1', '2', '3'])
    expect(view.domain.x[1]).toBeCloseTo(0.26)
    expect(view.dots.slice(-2).map((d) => d.id)).toEqual(['2', '3'])
    expect(view.dots.find((d) => d.id === '3')?.pick).toBe(0)
    expect(view.picks).toEqual([{ id: '3', name: 'Player 3' }])
  })

  it('colours by the roster’s position for players, and the conference for teams', () => {
    const rows = ROWS.map((r, i) => ({ ...r, position: i % 2 ? 'C' : null }))
    const view = chartView(result(rows), { ...DEFAULT_CHART, colour: POSITION_COLOUR }, byId)
    if (view.kind !== 'ready') throw new Error(view.kind)
    expect(new Set(view.dots.map((d) => d.category))).toEqual(new Set(['C', null]))

    const teamRows = Array.from({ length: 12 }, (_, i) => ({
      id: i % 2 ? '1610612747' : '1610612738',
      name: 'Team',
      team: null,
      position: null,
      group: {},
      games: 82,
      values: { team_ortg: v(110 + i), team_drtg: v(112 - i) }
    })).map((r, i) => ({ ...r, id: i < 2 ? r.id : `t${i}` }))
    const teams = chartView(
      result(teamRows),
      { ...DEFAULT_CHART, entity: 'team', colour: CONFERENCE_COLOUR },
      byId,
      TEAMS
    )
    if (teams.kind !== 'ready') throw new Error(teams.kind)
    expect(teams.dots.find((d) => d.id === '1610612738')).toMatchObject({
      category: 'East',
      team: 'BOS'
    })
    expect(teams.dots.find((d) => d.id === '1610612747')?.category).toBe('West')
    expect(teams.dots.find((d) => d.id === 't5')?.category).toBeNull()
  })

  it('gives each category value a series colour, and grey to the unlisted', () => {
    expect(categoryColour(POSITION_COLOUR, 'G')).toBe('var(--s1)')
    expect(categoryColour(POSITION_COLOUR, 'C')).toBe('var(--s3)')
    expect(categoryColour(CONFERENCE_COLOUR, 'West')).toBe('var(--s2)')
    expect(categoryColour(POSITION_COLOUR, null)).toBe('var(--fg-3)')
  })
})

describe('words', () => {
  const info = (id: string): MetricInfo | undefined => byId.get(id)

  it('title, axes and corners read up and right as better', () => {
    expect(chartTitle(info('usg_pct'), 'usg_pct', info('ts_pct'), 'ts_pct')).toBe(
      'True shooting percentage vs usage percentage'
    )
    expect(axisLabel(info('tov_pct'), 'tov_pct')).toBe('Turnover percentage ↓')
    expect(axisLabel(undefined, 'xyz')).toBe('xyz')
    expect(corners(info('team_ortg'), 'team_ortg', info('team_drtg'), 'team_drtg')).toEqual({
      tr: 'Good offense, good defense',
      tl: 'Poor offense, good defense',
      br: 'Good offense, poor defense',
      bl: 'Poor offense, poor defense'
    })
    expect(corners(info('reb'), 'reb', info('stl'), 'stl').tr).toBe('High rebounds, high steals')
  })

  it('names who the dots are', () => {
    expect(whoWords({ entity: 'player', position: 'ALL' })).toBe('players')
    expect(whoWords({ entity: 'player', position: 'C' })).toBe('centers')
    expect(whoWords({ entity: 'team', position: 'C' })).toBe('teams')
  })

  it('states the too-few case with the count, the scope and the reason', () => {
    expect(
      fewNote(4, { entity: 'player', position: 'C' }, { ...SCOPE, seasonType: 'play-in' })
    ).toBe(
      '4 centers qualify on both axes in the 2025-26 play-in. A scatter needs at least 10: a player qualifies with enough minutes for the games in scope, and enough of each axis’s own sample.'
    )
    expect(
      fewNote(
        1,
        { entity: 'player', position: 'G' },
        { ...SCOPE, range: { kind: 'last', n: 5, of: 'appearances' } }
      )
    ).toMatch(/^1 guard qualifies on both axes in last 5 games\./)
    expect(
      fewNote(
        3,
        { entity: 'team', position: 'ALL' },
        { ...SCOPE, range: { kind: 'dates', from: '2025-11-01', to: '2025-11-03' } }
      )
    ).toMatch(/^3 teams qualify on both axes in Nov 1 – Nov 3 \(2025-26\)\. .*a team qualifies/)
  })

  it('writes the subtitle with the season as 2025-26, and values in the mode', () => {
    expect(chartSubtitle({ entity: 'player', position: 'F', mode: 'per36' }, SCOPE)).toBe(
      'Forwards · 2025-26 · Regular season · Whole season · per 36 minutes'
    )
    expect(chartValue(info('ts_pct'), 0.5877, 'perGame')).toBe('58.8%')
    expect(chartValue(info('pts'), 31, 'perGame')).toBe('31.0')
    expect(chartValue(info('pts'), 2484, 'raw')).toBe('2,484')
    expect(chartValue(info('pts'), null, 'raw')).toBe('—')
  })

  it('shortens a player’s first name, and writes a team by its code', () => {
    expect(shortName('player', { id: '1', name: 'Luka Dončić' })).toBe('L. Dončić')
    expect(shortName('team', { id: '1610612738', name: 'Boston Celtics', team: 'BOS' })).toBe('BOS')
  })

  it('sends the picks to Compare as subjects', () => {
    expect(compareSubjects('team', ['1', '2'])).toEqual([
      { entity: 'team', id: '1' },
      { entity: 'team', id: '2' }
    ])
  })
})

describe('the drawing', () => {
  it('ticks on round steps inside the range', () => {
    expect(ticks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10])
    expect(ticks(0.43, 0.71, 6)).toEqual([0.45, 0.5, 0.55, 0.6, 0.65, 0.7])
    expect(ticks(-3, 3, 6)).toEqual([-3, -2, -1, 0, 1, 2, 3])
  })

  it('scales into the plot box, reversed for a lower-is-better axis', () => {
    const s = scales({ x: [0, 10], y: [100, 120] }, { x: false, y: true })
    expect(s.x(0)).toBeGreaterThan(PLOT.left)
    expect(s.x(10)).toBeLessThan(PLOT.width - PLOT.right)
    expect(s.x(10)).toBeGreaterThan(s.x(0))
    // A lower defensive rating sits higher.
    expect(s.y(100)).toBeLessThan(s.y(120))
    expect(s.xTicks.every((t) => t >= -0.7 && t <= 10.7)).toBe(true)
    const flat = scales({ x: [3, 3], y: [0, 0] }, { x: false, y: false })
    expect(Number.isFinite(flat.x(3)) && Number.isFinite(flat.y(0))).toBe(true)
  })

  it('computes Pearson r, and none under three points or with no spread', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1)
    expect(pearson([1, 2], [1, 2])).toBeNull()
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull()
  })

  const dot = (id: string, over: Partial<ChartDot> = {}): ChartDot => ({
    id,
    name: `First Last${id}`,
    team: 'BOS',
    position: 'G',
    x: 0,
    y: 0,
    qualified: true,
    values: {},
    percentiles: { ast: 80, reb: null },
    category: null,
    matched: false,
    pick: -1,
    games: 10,
    sample: null,
    ...over
  })

  it('sizes a dot by its percentile, else a fixed radius', () => {
    expect(dotRadius('player', dot('1'), null)).toBe(4.5)
    expect(dotRadius('team', dot('1'), null)).toBe(6.5)
    expect(dotRadius('player', dot('1'), 'ast')).toBeCloseTo(3.5 + 6.5 * 0.8)
    expect(dotRadius('player', dot('1'), 'reb')).toBeCloseTo(3.5 + 6.5 * 0.5)
  })

  it('labels picks and searches first, then the farthest players, or every team', () => {
    const dots = Array.from({ length: 20 }, (_, i) => dot(String(i), { x: i, y: i % 3 }))
    dots[5] = { ...dots[5], matched: true }
    const at = (d: ChartDot): { cx: number; cy: number; r: number } => ({
      cx: 100 + d.x * 30,
      cy: 100 + d.y * 30,
      r: 4
    })
    const items = labelItems('player', dots, at)
    expect(items[0]).toMatchObject({ id: '5', kind: 'strong' })
    expect(items).toHaveLength(1 + 8)
    expect(labelItems('team', dots, at)).toHaveLength(20)
  })

  it('places labels without overlaps, inside the plot', () => {
    const items = [
      { id: 'a', text: 'L. Dončić', cx: 300, cy: 200, r: 5, kind: 'strong' as const },
      { id: 'b', text: 'L. Dončić', cx: 300, cy: 200, r: 5, kind: 'muted' as const },
      { id: 'c', text: 'Edge', cx: PLOT.width - 5, cy: 5, r: 5, kind: 'muted' as const }
    ]
    const placed = placeLabels(items, 6.3)
    expect(placed.map((p) => p.id)).toEqual(['a', 'b'])
    const [a, b] = placed
    expect(a.left !== b.left || a.top !== b.top).toBe(true)
  })

  it('sorts the table by percentile best first, unranked last, or by name', () => {
    const dots = [
      dot('1', { name: 'Bo', percentiles: { ts_pct: 40 } }),
      dot('2', { name: 'Al', percentiles: { ts_pct: null } }),
      dot('3', { name: 'Cy', percentiles: { ts_pct: 90 } })
    ]
    const axes = { x: 'usg_pct', y: 'ts_pct' }
    expect(chartRows(dots, { by: 'y', dir: 1 }, axes).map((d) => d.id)).toEqual(['3', '1', '2'])
    expect(chartRows(dots, { by: 'y', dir: -1 }, axes).map((d) => d.id)).toEqual(['1', '3', '2'])
    expect(chartRows(dots, { by: 'name', dir: 1 }, axes).map((d) => d.name)).toEqual([
      'Al',
      'Bo',
      'Cy'
    ])
  })
})
