import { describe, expect, it } from 'vitest'
import {
  byTier,
  defaultChoice,
  firstRunRows,
  fmtBytes,
  leagueState,
  roomProblem,
  seasonLabel,
  seasonRange,
  STATE_LABELS,
  totals
} from '@/lib/stats/data'
import { LEAGUES } from '@shared/leagues'
import type { LeagueDownload, LeagueDownloads, StatsFamily, StatsStatus } from '@shared/stats/types'

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

  it('counts nothing for a release left out of the build, which says so', () => {
    const out = family({ state: 'left-out', filesLoaded: 0, filesExpected: 0 })
    expect(totals([family({}), out])).toEqual({ filesLoaded: 1, filesExpected: 2 })
    expect(STATE_LABELS[out.state]).toBe('Not in this version')
  })
})

describe('which leagues download', () => {
  const GB = 1024 ** 3
  const dl = (league: 'nba' | 'wnba', over: Partial<LeagueDownload> = {}): LeagueDownload => ({
    league,
    on: false,
    hasFile: false,
    fileBytes: 0,
    hasData: false,
    roomNeeded: league === 'nba' ? 6 * GB : 2 * GB,
    ...over
  })
  const clean: LeagueDownloads = {
    decided: false,
    leagues: [dl('nba'), dl('wnba')],
    freeBytes: 7 * GB
  }

  it('offers the default league ticked and the others not', () => {
    expect(defaultChoice()).toEqual({ nba: true, wnba: false })
  })

  it('states each league’s measured size and whether the free space covers it', () => {
    const rows = firstRunRows({ ...clean, freeBytes: 3 * GB })
    expect(rows.map((r) => [r.league.id, r.fits])).toEqual([
      ['nba', false],
      ['wnba', true]
    ])
    expect(rows[1].downloadBytes).toBe(LEAGUES.wnba.size.downloadBytes)
    expect(firstRunRows({ ...clean, freeBytes: null }).every((r) => r.fits)).toBe(true)
  })

  it('refuses a choice whose loads together need more room than is free', () => {
    expect(roomProblem({ nba: true }, clean)).toBeNull()
    expect(roomProblem({ nba: true, wnba: true }, clean)).toBe(
      'Not enough disk space: this needs 8.0 GB, and 7.0 GB is free.'
    )
    expect(roomProblem({ nba: true, wnba: true }, { ...clean, freeBytes: null })).toBeNull()
  })

  it('says whether a league downloads and what it is doing', () => {
    const status: StatsStatus = {
      available: true,
      through: null,
      updatedAt: null,
      builtAt: null,
      busy: false,
      progress: null,
      paused: false,
      noRoom: null
    }
    expect(leagueState(dl('wnba'), null)).toBe('Off')
    expect(leagueState(dl('wnba', { hasFile: true }), status)).toBe('Off: kept, not refreshed')
    expect(leagueState(dl('nba', { on: true }), status)).toBe('On')
    expect(leagueState(dl('nba', { on: true }), { ...status, paused: true })).toBe('Paused')
    expect(
      leagueState(dl('nba', { on: true }), {
        ...status,
        busy: true,
        progress: { done: 1200, total: 3025 }
      })
    ).toBe('Loading: 1,200 of 3,025 files')
  })

  it('writes a range of seasons as the league named writes them', () => {
    expect(seasonRange(1997, 2026, LEAGUES.wnba)).toBe('1997 to 2026')
    expect(seasonRange(1997, 2026, LEAGUES.nba)).toBe('1996-97 to 2025-26')
  })
})
