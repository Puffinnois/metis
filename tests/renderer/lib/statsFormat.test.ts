import { describe, expect, it } from 'vitest'
import {
  cellTitle,
  familyLabel,
  fmtStat,
  heatOf,
  isRescaled,
  kindLabel,
  ordinal
} from '@/lib/stats/format'

describe('fmtStat', () => {
  const count = { unit: 'count', decimals: 0, aggregation: 'sum' } as const
  const pct = { unit: 'pct', decimals: 1, aggregation: 'ratio' } as const

  it('writes a fraction as a percentage, and a total whole', () => {
    expect(fmtStat(0.5123, pct)).toBe('51.2%')
    expect(fmtStat(2143, count)).toBe('2,143')
  })

  it('writes a rescaled total to one decimal at least', () => {
    expect(fmtStat(33.48, count, 'perGame')).toBe('33.5')
    expect(fmtStat(0.5123, pct, 'perGame')).toBe('51.2%')
  })

  it('keeps a total that is not rescaled whole in any mode', () => {
    expect(fmtStat(64, { ...count, totalOnly: true }, 'perGame')).toBe('64')
  })

  it('writes a real minus sign, and no sign on a rounded zero', () => {
    expect(fmtStat(-5.2, { unit: 'rating', decimals: 1 })).toBe('−5.2')
    expect(fmtStat(-0.04, { unit: 'rating', decimals: 1 })).toBe('0.0')
  })

  it('writes a dash for nothing', () => {
    expect(fmtStat(null, count)).toBe('—')
    expect(fmtStat(Infinity, count)).toBe('—')
  })

  it('knows what a mode rescales', () => {
    expect(isRescaled(count, 'raw')).toBe(false)
    expect(isRescaled(count, 'per36')).toBe(true)
    expect(isRescaled(pct, 'per36')).toBe(false)
    expect(isRescaled({ ...count, totalOnly: true }, 'per36')).toBe(false)
    expect(isRescaled({ ...count, perGameOnly: true }, 'perGame')).toBe(true)
    expect(isRescaled({ ...count, perGameOnly: true }, 'per36')).toBe(false)
  })
})

describe('heatOf', () => {
  it('shades by percentile, and never a metric with no better side', () => {
    expect([95, 80, 65, 50, 35, 20, 5].map((p) => heatOf(p, 'higher'))).toEqual([
      'h3',
      'h2',
      'h1',
      'n',
      'l1',
      'l2',
      'l3'
    ])
    expect(heatOf(95, 'neutral')).toBe('n')
    expect(heatOf(null, 'higher')).toBe('n')
  })
})

describe('ordinal', () => {
  it('writes 1st, 2nd, 3rd, 11th, 22nd', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 22, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '22nd',
      '101st'
    ])
  })
})

describe('cellTitle', () => {
  const info = { sampleLabel: 'field-goal attempts', direction: 'higher' } as const
  const v = { value: 0.5, raw: 0.5, sample: 1234, qualified: true, percentile: 87, rank: 12 }

  it('says the percentile, rank and sample among the position', () => {
    expect(cellTitle(v, info, 'G')).toBe(
      '87th percentile among qualified guards\nRank 12 among guards\n1,234 field-goal attempts'
    )
  })

  it('says teams for a team', () => {
    expect(cellTitle(v, info, null)).toContain('among qualified teams')
    expect(cellTitle(v, info, null)).toContain('Rank 12\n')
  })

  it('leaves out a percentile with no better side, and says when it does not qualify', () => {
    expect(cellTitle(v, { ...info, direction: 'neutral' }, 'F')).not.toContain('percentile')
    const low = { ...v, qualified: false, percentile: null, rank: null }
    expect(cellTitle(low, info, 'C')).toBe('1,234 field-goal attempts\nBelow the qualifying sample')
  })
})

describe('labels', () => {
  it('names families and kinds', () => {
    expect(familyLabel('possessions')).toBe('Possessions')
    expect(kindLabel('estimated')).toBe('Estimated')
  })
})
