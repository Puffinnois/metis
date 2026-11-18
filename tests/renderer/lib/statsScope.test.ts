import { describe, expect, it } from 'vitest'
import { freshness, lastPlayedSeason, seasonComplete } from '@/lib/stats/scope'
import { LEAGUES } from '@shared/leagues'

const base = {
  available: true,
  through: null,
  updatedAt: null,
  builtAt: null,
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}
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

  it('says when loading is paused or has no room', () => {
    expect(freshness({ ...base, paused: true })).toBe('Loading paused')
    expect(freshness({ ...base, through, paused: true }, NOW)).toBe(
      'Data through Nov 4, 2026 · paused'
    )
    expect(freshness({ ...base, noRoom: { neededBytes: 1, freeBytes: 0 } })).toBe(
      'Not enough disk space'
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

describe('a league between seasons', () => {
  const { nba, wnba } = LEAGUES
  const at = (iso: string): number => Date.parse(`${iso}T12:00:00Z`)
  const nbaDone = {
    ...base,
    through: { season: 2026, date: '2026-06-18' },
    updatedAt: '2026-06-19T10:00:00Z'
  }
  const wnbaDone = {
    ...base,
    through: { season: 2026, date: '2026-10-18' },
    updatedAt: '2026-10-19T10:00:00Z'
  }

  it('names the season it played last, in either league', () => {
    expect(lastPlayedSeason(nba, new Date(at('2026-07-01')))).toBe(2026)
    expect(lastPlayedSeason(nba, new Date(at('2026-09-30')))).toBe(2026)
    expect(lastPlayedSeason(nba, new Date(at('2026-10-01')))).toBe(2027)
    expect(lastPlayedSeason(wnba, new Date(at('2026-11-01')))).toBe(2026)
    expect(lastPlayedSeason(wnba, new Date(at('2027-04-30')))).toBe(2026)
    expect(lastPlayedSeason(wnba, new Date(at('2027-05-01')))).toBe(2027)
  })

  it('reads the WNBA’s season as complete from November to April, not stale', () => {
    expect(freshness(wnbaDone, at('2026-10-31'), wnba)).toMatch(
      /^Data through Oct 18, 2026 · updated/
    )
    expect(freshness(wnbaDone, at('2026-11-01'), wnba)).toBe(
      '2026 season complete · data through Oct 18, 2026'
    )
    expect(freshness(wnbaDone, at('2027-04-30'), wnba)).toBe(
      '2026 season complete · data through Oct 18, 2026'
    )
    // The new season's months: as in season, until its games come in.
    expect(freshness(wnbaDone, at('2027-05-01'), wnba)).toMatch(
      /^Data through Oct 18, 2026 · updated/
    )
  })

  it('gives the NBA’s off-season the same rule, July to September', () => {
    expect(freshness(nbaDone, at('2026-06-30'), nba)).toMatch(
      /^Data through Jun 18, 2026 · updated/
    )
    expect(freshness(nbaDone, at('2026-07-01'), nba)).toBe(
      '2025-26 season complete · data through Jun 18, 2026'
    )
    expect(freshness(nbaDone, at('2026-09-30'), nba)).toBe(
      '2025-26 season complete · data through Jun 18, 2026'
    )
    expect(freshness(nbaDone, at('2026-10-01'), nba)).toMatch(
      /^Data through Jun 18, 2026 · updated/
    )
  })

  it('still says what a refresh is doing, or that it is paused', () => {
    expect(freshness({ ...nbaDone, busy: true }, at('2026-08-01'), nba)).toBe(
      '2025-26 season complete · data through Jun 18, 2026 · updating…'
    )
    expect(freshness({ ...nbaDone, paused: true }, at('2026-08-01'), nba)).toBe(
      '2025-26 season complete · data through Jun 18, 2026 · paused'
    )
  })

  it('does not call a season complete when the data stops short of it', () => {
    const old = { ...nbaDone, through: { season: 2025, date: '2025-06-22' } }
    expect(seasonComplete(nba, old, new Date(at('2026-08-01')))).toBe(false)
    expect(freshness(old, at('2026-08-01'), nba)).toMatch(/^Data through Jun 22, 2025 · updated/)
  })

  it('says a league with no data has none, not that the stats are off', () => {
    const none = { ...base, available: false, noData: 'No WNBA stats yet: they come later.' }
    expect(freshness(none, NOW, wnba)).toBe('No WNBA stats yet')
  })
})
