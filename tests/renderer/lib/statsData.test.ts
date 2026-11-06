import { describe, expect, it } from 'vitest'
import { byTier, fmtBytes, seasonLabel, seasonRange, totals } from '@/lib/stats/data'
import type { StatsFamily } from '@shared/stats/types'

const family = (over: Partial<StatsFamily>): StatsFamily => ({
  release: 'r',
  label: 'R',
  tier: 'core',
  state: 'loaded',
  filesLoaded: 1,
  filesExpected: 2,
  firstSeason: 2025,
  lastSeason: 2026,
  bytes: 1,
  rows: 1,
  fetchedAt: null,
  lastError: null,
  ...over
})

describe('fmtBytes', () => {
  it('picks a unit a person reads', () => {
    expect(fmtBytes(4.3 * 1024 ** 3)).toBe('4.3 GB')
    expect(fmtBytes(214 * 1024 ** 2)).toBe('214 MB')
    expect(fmtBytes(12 * 1024)).toBe('12 KB')
    expect(fmtBytes(10)).toBe('1 KB')
    expect(fmtBytes(0)).toBe('–')
  })
})

describe('season labels', () => {
  it('shows a final year as a season', () => {
    expect(seasonLabel(2026)).toBe('2025-26')
    expect(seasonLabel(2000)).toBe('1999-00')
  })

  it('shows a range, one season, or none', () => {
    expect(seasonRange(1994, 2027)).toBe('1993-94 to 2026-27')
    expect(seasonRange(2027, 2027)).toBe('2026-27')
    expect(seasonRange(null, null)).toBe('All seasons')
  })
})

describe('byTier', () => {
  it('keeps the load order and labels each tier', () => {
    const groups = byTier([
      family({ release: 'a', tier: 'core' }),
      family({ release: 'b', tier: 'core' }),
      family({ release: 'c', tier: 'plays' })
    ])
    expect(groups.map((g) => [g.tier, g.families.length])).toEqual([
      ['core', 2],
      ['plays', 1]
    ])
    expect(groups[1].label).toBe('Play by play')
  })
})

describe('totals', () => {
  it('adds up the files', () => {
    expect(totals([family({}), family({ filesLoaded: 3, filesExpected: 3 })])).toEqual({
      filesLoaded: 4,
      filesExpected: 5
    })
  })
})
