import { describe, expect, it } from 'vitest'
import { freshness } from '@/lib/stats/scope'

const base = { available: true, through: null, updatedAt: null, busy: false }
const NOW = Date.parse('2026-11-05T12:00:00Z')
const through = { season: 2027, seasonType: 'REG' as const, date: '2026-11-04' }

describe('freshness', () => {
  it('says nothing before the status is read, and when the stats are off', () => {
    expect(freshness(null)).toBe('')
    expect(freshness({ ...base, available: false })).toBe('Stats unavailable')
  })

  it('tells an empty database from one being loaded', () => {
    expect(freshness(base)).toBe('No stats yet')
    expect(freshness({ ...base, busy: true })).toBe('Loading the stats…')
  })

  it('names the latest game day and when it was updated', () => {
    expect(freshness({ ...base, through, updatedAt: '2026-11-05T10:00:00Z' }, NOW)).toBe(
      'Data through Nov 4, 2026 · updated 2 h ago'
    )
    expect(freshness({ ...base, through, busy: true }, NOW)).toBe(
      'Data through Nov 4, 2026 · updating…'
    )
  })
})
