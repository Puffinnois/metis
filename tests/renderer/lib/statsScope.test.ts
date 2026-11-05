import { describe, expect, it } from 'vitest'
import { freshness } from '@/lib/stats/scope'

const base = { available: true, through: null, updatedAt: null, busy: false, progress: null }
const NOW = Date.parse('2026-11-05T12:00:00Z')
const through = { season: 2027, date: '2026-11-04' }

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

  it('counts the files of a running load', () => {
    const progress = { done: 412, total: 3107 }
    expect(freshness({ ...base, busy: true, progress })).toBe(
      'Loading the stats · 412 of 3,107 files'
    )
    expect(freshness({ ...base, through, busy: true, progress }, NOW)).toBe(
      'Data through Nov 4, 2026 · updating 412 of 3,107 files'
    )
  })
})
