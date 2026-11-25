import { describe, expect, it } from 'vitest'
import { rankWithinTab, tabOf } from '@/lib/stats/leaderboard'
import { fmtZ, zScored, zTitle } from '@/lib/stats/zScores'
import type { MetricValue, StatsResult, StatsResultColumn, StatsRow } from '@shared/stats/types'

const value = (v: number | null, over: Partial<MetricValue> = {}): MetricValue => ({
  value: v,
  raw: v,
  sample: 100,
  qualified: true,
  percentile: 50,
  rank: 1,
  ...over
})

const row = (id: string, position: string | null, values: Record<string, MetricValue>): StatsRow =>
  ({ id, name: id, position, team: null, games: 10, group: {}, values }) as unknown as StatsRow

const column = (id: string): StatsResultColumn =>
  ({
    id,
    label: id,
    short: id,
    unit: 'number',
    decimals: 1,
    direction: 'higher',
    seasons: [],
    reason: null
  }) as unknown as StatsResultColumn

const result = (rows: StatsRow[], columns: string[]): StatsResult =>
  ({
    grain: 'season',
    columns: columns.map(column),
    rows,
    total: rows.length,
    notes: [],
    ms: 0
  }) as unknown as StatsResult

const z = (r: StatsResult, id: string, metric: string): MetricValue['z'] =>
  r.rows.find((x) => x.id === id)!.values[metric].z

describe('z-scores on a board', () => {
  it('reads each value in the pool of its position, worked by hand', () => {
    const r = zScored(
      result(
        [
          row('a', 'G', { pts: value(10) }),
          row('b', 'G', { pts: value(20) }),
          row('c', 'G', { pts: value(30) }),
          row('d', 'C', { pts: value(5) }),
          row('e', 'C', { pts: value(15) })
        ],
        ['pts']
      )
    )
    // Guards: 10, 20, 30, mean 20 and sample standard deviation 10.
    expect(z(r, 'a', 'pts')).toEqual({ score: -1, mean: 20, sd: 10, n: 3 })
    expect(z(r, 'b', 'pts')?.score).toBe(0)
    expect(z(r, 'c', 'pts')?.score).toBe(1)
    // Centers are their own pool: 5 and 15, mean 10 and sample standard deviation 7.07.
    expect(z(r, 'd', 'pts')?.mean).toBe(10)
    expect(z(r, 'd', 'pts')?.score).toBeCloseTo(-0.7071, 4)
  })

  it('leaves out of the pool a row that has no percentile, and gives it no score', () => {
    const r = zScored(
      result(
        [
          row('a', 'G', { pts: value(10) }),
          row('b', 'G', { pts: value(20) }),
          row('x', 'G', { pts: value(900, { percentile: null }) })
        ],
        ['pts']
      )
    )
    expect(z(r, 'x', 'pts')).toBeUndefined()
    expect(z(r, 'a', 'pts')).toMatchObject({ mean: 15, n: 2 })
  })

  it('has no score where the pool has one row or no spread', () => {
    const r = zScored(
      result(
        [
          row('a', 'G', { pts: value(10), ast: value(4) }),
          row('b', 'G', { pts: value(10), ast: value(4) })
        ],
        ['pts', 'ast']
      )
    )
    expect(z(r, 'a', 'pts')).toMatchObject({ score: null, mean: 10 })
    expect(
      z(zScored(result([row('a', 'G', { pts: value(10) })], ['pts'])), 'a', 'pts')
    ).toBeUndefined()
  })

  it('keeps a score the engine gave, as the colleges’ boards do', () => {
    const given = { score: 1.5, mean: 8, sd: 2, n: 400 }
    const r = zScored(
      result(
        [
          row('a', 'G', { pts: value(11, { z: given }) }),
          row('b', 'G', { pts: value(12, { z: given }) })
        ],
        ['pts']
      )
    )
    expect(z(r, 'a', 'pts')).toBe(given)
  })

  it('is read in the pool the tab’s percentile uses', () => {
    const tab = tabOf('player', 'ALL')
    const ranked = rankWithinTab(
      result(
        [
          row('a', 'G', { min: value(30), pts: value(10) }),
          row('b', 'G', { min: value(30), pts: value(20) }),
          row('c', 'G', { min: value(1, { qualified: false }), pts: value(99) })
        ],
        ['min', 'pts']
      ),
      tab
    )
    const r = zScored(ranked)
    // c is short of the tab's minutes: no percentile, so no score, and it does not move the mean.
    expect(z(r, 'c', 'pts')).toBeUndefined()
    expect(z(r, 'a', 'pts')).toMatchObject({ mean: 15, n: 2 })
  })

  it('writes a score signed with two decimals, and says its pool on hover', () => {
    expect([fmtZ(1.234), fmtZ(-0.5), fmtZ(0), fmtZ(null), fmtZ(undefined)]).toEqual([
      '+1.23',
      '−0.50',
      '0.00',
      '—',
      '—'
    ])
    const fmt = (v: number): string => v.toFixed(1)
    expect(zTitle({ score: 1.5, mean: 14.2, sd: 6, n: 1838 }, 'guards', fmt)).toBe(
      'Z-score +1.50: mean 14.2, standard deviation 6.0, among 1,838 qualified guards'
    )
    expect(zTitle({ score: null, mean: 1, sd: 0, n: 4 }, 'guards', fmt)).toMatch(/reads the same/)
    expect(zTitle(undefined, 'guards', fmt)).toMatch(/not among the rows/)
  })
})
