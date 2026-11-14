import { describe, expect, it } from 'vitest'
import {
  defaultBoard,
  familyColumns,
  leaderboardCsv,
  leaderboardQuery,
  rankWithinTab,
  shrunkPatch,
  tabOf
} from '@/lib/stats/leaderboard'
import {
  glossaryOrder,
  priorWords,
  rawLine,
  shrinkable,
  stabilityLevel,
  stabilityLines,
  stabilityTitle
} from '@/lib/stats/stability'
import type { StatsScope } from '@/lib/stats/scope'
import type { MetricInfo, MetricStability, StatsResult, StatsRow } from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const measured: MetricStability = {
  yearToYear: 0.7142,
  pairs: 3412,
  splitHalf: 0.881,
  halfPairs: 5322,
  prior: 186.6,
  reliability: 'high',
  firstSeason: 1994,
  lastSeason: 2026,
  reason: null
}
const info = (stability: MetricStability | null, o: Partial<MetricInfo> = {}): MetricInfo => ({
  ...catalogueFixture().find((m) => m.id === 'ts_pct')!,
  stability,
  ...o
})

describe('stability on screen (Plan T1006)', () => {
  it('writes the card lines short, the prior in the metric’s own unit', () => {
    expect(stabilityLines(info(measured))).toEqual([
      'Year to year 0.71 on 3,412 pairs',
      'Split half 0.88 on 5,322 seasons',
      'Prior 187 field-goal attempts',
      'Measured 1993-94 to 2025-26'
    ])
    expect(priorWords(info(measured))).toBe('187 field-goal attempts')
    expect(stabilityLevel(info(measured))).toBe('high')
    expect(stabilityTitle(info(measured)).split('\n')[0]).toBe('High stability')
  })

  it('says why a metric has no measure, and when none has been made yet', () => {
    const none: MetricStability = {
      ...measured,
      yearToYear: null,
      pairs: 4,
      splitHalf: null,
      prior: null,
      reliability: null,
      reason: 'Fewer than 50 pairs of qualified seasons.'
    }
    expect(stabilityLines(info(none))).toEqual([
      'Not measured: Fewer than 50 pairs of qualified seasons.'
    ])
    expect(stabilityLevel(info(none))).toBe('none')
    expect(stabilityLines(info(null))).toEqual(['Not measured yet: a refresh measures it.'])
    expect(stabilityTitle(info(null))).toMatch(/^Stability not measured/)
  })

  it('shrinks only a rate with a prior', () => {
    expect(shrinkable(info(measured))).toBe(true)
    expect(shrinkable(info({ ...measured, prior: null }))).toBe(false)
    expect(shrinkable(info(measured, { aggregation: 'sum' }))).toBe(false)
  })

  it('gives a shrunk cell its raw value on hover', () => {
    const v = { value: 0.58, raw: 0.7, sample: 12, qualified: false, percentile: 40, rank: 300 }
    expect(rawLine(v, info(measured))).toBe(
      'Raw 70.0% on 12 field-goal attempts, shrunk toward the league'
    )
    expect(rawLine({ ...v, raw: 0.58 }, info(measured))).toBeNull()
  })

  it('filters and sorts the Glossary by stability', () => {
    const list = [
      { label: 'B', stability: { ...measured, yearToYear: 0.4, reliability: 'medium' as const } },
      { label: 'A', stability: null },
      { label: 'C', stability: measured }
    ]
    expect(glossaryOrder(list, '', 'stability').map((m) => m.label)).toEqual(['C', 'B', 'A'])
    expect(glossaryOrder(list, '', 'name').map((m) => m.label)).toEqual(['A', 'B', 'C'])
    expect(glossaryOrder(list, 'none', 'name').map((m) => m.label)).toEqual(['A'])
    expect(glossaryOrder(list, 'medium', 'name').map((m) => m.label)).toEqual(['B'])
  })
})

describe('the shrunk toggle on the leaderboard (Plan T1006)', () => {
  const catalogue = new Map(
    catalogueFixture().map((m) => [m.id, { ...m, stability: m.id === 'ts_pct' ? measured : null }])
  )
  const scope: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

  it('asks the engine for shrunk rates and shows every row', () => {
    const board = { ...defaultBoard('player', 'ALL', catalogue), ...shrunkPatch(true) }
    expect(board.qualifiedOnly).toBe(false)
    expect(leaderboardQuery(board, scope, catalogue).shrunk).toBe(true)
    const off = { ...board, ...shrunkPatch(false) }
    expect(off.qualifiedOnly).toBe(true)
    expect('shrunk' in leaderboardQuery(off, scope, catalogue)).toBe(false)
  })

  it('ranks a shrunk column among every row with a sample, the others among the qualified', () => {
    const row = (id: string, minQualified: boolean, ts: number, sample: number): StatsRow => ({
      id,
      name: id,
      team: null,
      position: 'G',
      group: {},
      games: 10,
      values: {
        min: { value: 1, raw: 1, sample: 1, qualified: minQualified, percentile: null, rank: null },
        ts_pct: {
          value: ts,
          raw: ts,
          sample,
          qualified: minQualified,
          percentile: null,
          rank: null
        },
        fg_pct: {
          value: ts,
          raw: ts,
          sample,
          qualified: minQualified,
          percentile: null,
          rank: null
        }
      }
    })
    const column = (id: string, shrunk: boolean): StatsResult['columns'][number] => ({
      id,
      label: id,
      short: id,
      unit: 'pct',
      decimals: 1,
      direction: 'higher',
      seasons: [2026],
      reason: null,
      ...(shrunk ? { shrunk: true } : {})
    })
    const result: StatsResult = {
      grain: 'season',
      columns: [column('min', false), column('ts_pct', true), column('fg_pct', false)],
      rows: [row('a', true, 0.6, 900), row('b', false, 0.65, 20), row('c', true, 0.55, 800)],
      total: 3,
      notes: [],
      ms: 1
    }
    const ranked = rankWithinTab(result, tabOf('player', 'ALL'))
    const of = (id: string): StatsRow => ranked.rows.find((r) => r.id === id)!
    // The player below the minutes ranks first on the shrunk rate, and not at all on the raw one.
    expect([of('b'), of('a'), of('c')].map((r) => r.values.ts_pct.rank)).toEqual([1, 2, 3])
    expect(of('b').values.fg_pct.rank).toBeNull()
    expect([of('a'), of('c')].map((r) => r.values.fg_pct.rank)).toEqual([1, 2])
  })

  it('presets the League indexes in the catalogue’s order, the shooting ones first', () => {
    const player = familyColumns(catalogueFixture(), tabOf('player', 'ALL'), 'indexes')
    expect(player.slice(0, 6)).toEqual([
      'ts_pct_plus',
      'efg_pct_plus',
      'fg_pct_plus',
      'fg2_pct_plus',
      'fg3_pct_plus',
      'ft_pct_plus'
    ])
    const team = familyColumns(catalogueFixture(), tabOf('team', 'offense'), 'indexes')
    expect(team[0]).toBe('team_ts_pct_plus')
  })

  it('says which columns are shrunk in the CSV', () => {
    const board = { ...defaultBoard('player', 'ALL', catalogue), shrunk: true }
    const head = leaderboardCsv([], board, catalogue).split('\r\n')[0]
    expect(head).toContain('True shooting percentage shrunk (%)')
    expect(head).toContain('Effective field-goal percentage (%)')
  })
})
