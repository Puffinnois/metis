import { describe, expect, it } from 'vitest'
import { rankWithinTab, tabOf } from '@/lib/stats/leaderboard'
import type { MetricValue, StatsResult, StatsRow } from '@shared/stats/types'

/**
 * The board's own rank rule (`rankWithinTab`) on the values of the engine's test of `rankAmong`
 * (`tests/main/stats/engine/rankAmong.test.ts`): six guards, three with enough minutes. Both tests
 * hold the same figures, so the engine's pool and the board's are one rule (the college boards' fix).
 */
const v = (value: number, qualified: boolean): MetricValue => ({
  value,
  raw: value,
  sample: 4,
  qualified,
  percentile: null,
  rank: null
})
const row = (id: string, ftm: number, minutes: number): StatsRow => ({
  id,
  name: id,
  team: 'BOS',
  position: 'G',
  group: {},
  games: 4,
  values: { ftm: v(ftm, true), min: v(minutes, minutes >= 30) }
})
const result = {
  grain: 'season',
  columns: [
    { id: 'ftm', direction: 'higher' },
    { id: 'min', direction: 'higher' }
  ],
  rows: [
    row('1', 10, 30),
    row('2', 12, 6),
    row('3', 4, 30),
    row('4', 2, 6),
    row('5', 7, 30),
    row('6', 9, 6)
  ],
  total: 6,
  notes: []
} as unknown as StatsResult

describe('the board’s rank pool, by its own rule', () => {
  it('gives the figures the engine gives with rankAmong', () => {
    const ranked = rankWithinTab(result, tabOf('player', 'ALL'))
    const cell = (id: string, m: string): [number | null, number | null] => {
      const x = ranked.rows.find((r) => r.id === id)!.values[m]
      return [x.percentile, x.rank]
    }
    expect(cell('1', 'ftm')).toEqual([100, 1])
    expect(cell('5', 'ftm')).toEqual([50, 2])
    expect(cell('3', 'ftm')).toEqual([0, 3])
    for (const id of ['2', '4', '6']) expect(cell(id, 'ftm')).toEqual([null, null])
    for (const id of ['1', '3', '5']) expect(cell(id, 'min')).toEqual([0, 1])
  })
})
