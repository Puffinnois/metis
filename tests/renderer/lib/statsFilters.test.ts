import { describe, expect, it } from 'vitest'
import {
  attributeItems,
  conditionText,
  engineFilters,
  filteredQuery,
  filterGroups,
  filterNote,
  fromShown,
  isComplete,
  itemsByKey,
  metricItems,
  newCondition,
  rankFiltered,
  toShown,
  valuesShown,
  type FilterItem
} from '@/lib/stats/filters'
import { tabOf } from '@/lib/stats/leaderboard'
import { LEAGUES } from '@shared/leagues'
import type {
  MetricValue,
  StatsFilter,
  StatsQuery,
  StatsResult,
  StatsRow
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const catalogue = catalogueFixture()
const byId = new Map(catalogue.map((m) => [m.id, m]))
const allPlayers = tabOf('player', 'ALL')
const nbaItems = [...attributeItems(LEAGUES.nba, 'player'), ...metricItems(catalogue, allPlayers)]
const items = itemsByKey(nbaItems)
const item = (key: string): FilterItem => items.get(key) as FilterItem

describe('what a board can be filtered on', () => {
  it('lists a league’s attributes, those it lacks with their reason', () => {
    expect(item('attribute:age').reason).toBeNull()
    expect(item('attribute:hometown').reason).toMatch(/college rosters/)
    const college = itemsByKey(attributeItems(LEAGUES.ncaam, 'player'))
    expect(college.get('attribute:hometown')?.reason).toBeNull()
    expect(college.get('attribute:draftYear')?.reason).toMatch(/professional league/)
  })

  it('keeps a team board to team attributes', () => {
    const team = attributeItems(LEAGUES.nba, 'team').map((i) => i.id)
    expect(team).toContain('arena')
    expect(team).not.toContain('age')
  })

  it('lists metrics as the column picker does, under each category and sub-group', () => {
    const pts = catalogue.find((m) => m.id === 'pts')!
    const headings = nbaItems
      .filter((i) => i.kind === 'metric' && i.id === 'pts')
      .map((i) => i.group)
    // Every placement of points, each its own heading, in the registry's order.
    expect(headings).toHaveLength(pts.categories!.length)
    expect(headings.every((h) => h.includes(' › '))).toBe(true)
    expect(item('metric:ts_pct').unit).toBe('pct')
  })

  it('lists attributes first, in their groups, and searches labels and descriptions', () => {
    const groups = filterGroups(nbaItems, '')
    expect(groups[0].group).toBe('Personal')
    expect(groups.findIndex((g) => g.group === 'Combine')).toBeLessThan(
      groups.findIndex((g) => g.items[0].kind === 'metric')
    )
    const found = filterGroups(nbaItems, 'wingspan').flatMap((g) => g.items.map((i) => i.id))
    expect(found).toContain('wingspan')
    expect(filterGroups(nbaItems, 'zzzz')).toEqual([])
  })
})

describe('a condition', () => {
  it('starts with its type’s first operator and no value, unfinished', () => {
    const age = newCondition(item('attribute:age'))
    expect(age).toEqual({ attribute: 'age', op: 'atLeast' })
    expect(isComplete(age)).toBe(false)
    expect(newCondition(item('attribute:undrafted'))).toEqual({ attribute: 'undrafted', op: 'is' })
    expect(isComplete({ attribute: 'undrafted', op: 'is' })).toBe(true)
    expect(newCondition(item('metric:pts'))).toEqual({ metric: 'pts', op: 'atLeast' })
  })

  it('is finished only with what its operator needs', () => {
    expect(isComplete({ attribute: 'height', op: 'between', value: [78, 82] })).toBe(true)
    expect(isComplete({ attribute: 'height', op: 'between', value: [82, 78] })).toBe(false)
    expect(isComplete({ attribute: 'birthDate', op: 'atMost', value: '2000-01-01' })).toBe(true)
    expect(isComplete({ attribute: 'birthCountry', op: 'anyOf', value: [] })).toBe(false)
    expect(isComplete({ attribute: 'school', op: 'contains', value: ' ' })).toBe(false)
  })

  it('reads a percentage in the board’s units and keeps the engine’s fraction', () => {
    const ts = item('metric:ts_pct')
    expect(fromShown(55, ts)).toBe(0.55)
    expect(toShown(0.55, ts)).toBe(55)
    expect(fromShown(80, item('attribute:height'))).toBe(80)
  })

  it('reads as a chip, with the metric’s mode where it rescales', () => {
    const text = (f: StatsFilter, mode: 'raw' | 'perGame' = 'raw'): string =>
      conditionText(
        f,
        items.get(f.attribute ? `attribute:${f.attribute}` : `metric:${f.metric}`),
        f.metric ? byId.get(f.metric) : undefined,
        mode
      )
    expect(text({ attribute: 'age', op: 'atMost', value: 25 })).toBe('Age at most 25')
    expect(text({ attribute: 'height', op: 'between', value: [78, 82] })).toBe('Height 78 to 82 in')
    expect(text({ attribute: 'birthCountry', op: 'noneOf', value: ['USA'] })).toBe(
      'Birth country is none of USA'
    )
    expect(text({ attribute: 'undrafted', op: 'is' })).toBe('Undrafted: yes')
    expect(text({ attribute: 'school', op: 'contains', value: 'duke' })).toBe(
      'School contains “duke”'
    )
    expect(text({ attribute: 'birthDate', op: 'hasNone' })).toBe('Birth date is not known')
    expect(text({ metric: 'pts', op: 'atLeast', value: 20 }, 'perGame')).toBe(
      'Points at least 20 (per game)'
    )
    // A rate reads the same in every mode, so no mode is named.
    expect(text({ metric: 'ts_pct', op: 'atLeast', value: 0.55 }, 'perGame')).toBe(
      'True shooting percentage at least 55%'
    )
    expect(text({ attribute: 'age', op: 'atLeast' })).toBe('Age: choose a value')
  })
})

describe('the query and the rows of a filtered board', () => {
  const query: StatsQuery = { entity: 'player', metrics: ['pts'], scope: { seasons: [2026] } }

  it('asks the engine only for finished conditions on what the league has', () => {
    const filters: StatsFilter[] = [
      { attribute: 'age', op: 'atMost', value: 25 },
      { attribute: 'height', op: 'atLeast' },
      { attribute: 'hometown', op: 'contains', value: 'x' }
    ]
    expect(engineFilters(filters, items)).toEqual([{ attribute: 'age', op: 'atMost', value: 25 }])
    expect(filteredQuery(query, { filters }, items)).toEqual({
      ...query,
      filters: [{ attribute: 'age', op: 'atMost', value: 25 }]
    })
    // No finished condition: nothing more is read.
    expect(
      filteredQuery(query, { filters: [{ attribute: 'height', op: 'atLeast' }] }, items)
    ).toBeNull()
    expect(filteredQuery(query, {}, items)).toBeNull()
  })

  const v = (value: number, qualified = true): MetricValue => ({
    value,
    raw: value,
    sample: 1000,
    qualified,
    percentile: null,
    rank: null
  })
  const row = (id: string, pts: number): StatsRow => ({
    id,
    name: id,
    team: null,
    position: 'G',
    group: {},
    games: 10,
    values: { pts: v(pts), min: v(2000) }
  })
  const result = (rows: StatsRow[]): StatsResult =>
    ({
      grain: 'season',
      columns: [
        {
          id: 'pts',
          label: 'Points',
          short: 'PTS',
          unit: 'count',
          decimals: 1,
          direction: 'higher',
          seasons: [2026],
          reason: null
        },
        {
          id: 'min',
          label: 'Minutes',
          short: 'MIN',
          unit: 'minutes',
          decimals: 0,
          direction: 'higher',
          seasons: [2026],
          reason: null
        }
      ],
      rows,
      total: rows.length,
      notes: []
    }) as unknown as StatsResult

  it('shades filtered rows against the whole board, not among themselves', () => {
    const board = result([row('a', 30), row('b', 20), row('c', 10), row('d', 5)])
    const filtered = result([row('c', 10), row('d', 5)])
    const ranked = rankFiltered(filtered, board, allPlayers)
    expect(ranked.rows.map((r) => r.id)).toEqual(['c', 'd'])
    // Among the four, c is above one of three; among the two alone it would be the best.
    expect(ranked.rows[0].values.pts.percentile).toBeCloseTo(100 / 3)
    expect(ranked.rows[0].values.pts.rank).toBe(3)
    expect(ranked.rows[1].values.pts.percentile).toBe(0)
  })

  it('shades a filtered row the board did not fetch by the engine’s own percentile', () => {
    const board = result([row('a', 30), row('b', 20)])
    // The engine ranked z among every qualified row before the filter: kept as it came.
    const z = {
      ...row('z', 4),
      values: { pts: { ...v(4), percentile: 12.5, rank: 1201 }, min: v(2000) }
    }
    const ranked = rankFiltered(result([z]), board, allPlayers)
    expect(ranked.rows[0].values.pts.percentile).toBe(12.5)
    expect(ranked.rows[0].values.pts.rank).toBe(1201)
  })

  it('says how many rows were left out for no value, and why none could answer', () => {
    const filters: StatsFilter[] = [
      { attribute: 'experience', op: 'atMost', value: 0 },
      { attribute: 'height', op: 'atLeast', value: 80 },
      { attribute: 'undrafted', op: 'hasNone' }
    ]
    const left = { ...result([]), filtered: { noValue: 92, reason: null } }
    expect(filterNote(left, filters, items, 'player')).toBe(
      '92 players in scope left out: no value for Experience or Height. Experience is the season’s roster’s: a player it does not list has none.'
    )
    const none = { ...result([]), filtered: { noValue: 0, reason: 'Hometown: not here.' } }
    expect(filterNote(none, filters, items, 'player')).toBe('Hometown: not here.')
    expect(
      filterNote(
        { ...result([]), filtered: { noValue: 0, reason: null } },
        filters,
        items,
        'player'
      )
    ).toBeNull()
    expect(
      filterNote(
        { ...result([]), filtered: { noValue: 1, reason: null } },
        [filters[1]],
        items,
        'team'
      )
    ).toBe('1 team in scope left out: no value for Height.')
  })
})

describe('the values a picker lists', () => {
  const values = [
    { value: 'USA', rows: 400 },
    { value: 'Canada', rows: 20 },
    { value: 'Côte d’Ivoire', rows: 2 },
    { value: 'France', rows: 12 }
  ]

  it('lists the chosen first, then the rest most held first', () => {
    expect(valuesShown(values, ['France'], '').map((x) => [x.value, x.chosen])).toEqual([
      ['France', true],
      ['USA', false],
      ['Canada', false],
      ['Côte d’Ivoire', false]
    ])
  })

  it('searches without letter case or accents, and keeps a chosen value it no longer holds', () => {
    expect(valuesShown(values, [], 'cote').map((x) => x.value)).toEqual(['Côte d’Ivoire'])
    expect(valuesShown(values, ['Gone'], 'usa')).toEqual([
      { value: 'Gone', rows: null, chosen: true },
      { value: 'USA', rows: 400, chosen: false }
    ])
  })
})
