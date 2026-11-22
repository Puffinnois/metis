import { describe, expect, it, vi } from 'vitest'
import { downloadOf, leagueHolds, menuNote } from '@/lib/stats/downloads'
import { freshness } from '@/lib/stats/scope'
import { LEAGUES } from '@shared/leagues'
import type { LeagueDownload, LeagueDownloads } from '@shared/stats/types'

// The hook's module reads the bridge; these are its pure parts.
vi.mock('@/lib/api', () => ({ api: {} }))

const download = (over: Partial<LeagueDownload>): LeagueDownload => ({
  league: 'wnba',
  on: false,
  hasFile: false,
  fileBytes: 0,
  hasData: false,
  roomNeeded: 0,
  ...over
})

describe('what a league holds', () => {
  it('is off without data, whatever the registry says about its tables', () => {
    expect(leagueHolds(LEAGUES.wnba, download({}))).toBe('off')
    expect(leagueHolds(LEAGUES.nba, download({ league: 'nba' }))).toBe('off')
    expect(leagueHolds(LEAGUES.wnba, undefined)).toBe('off')
  })

  it('has no tables yet when on and loaded in a league whose tables are not built', () => {
    // An entry listing its identity alone, as the WNBA's did before T1301.6.
    const identityOnly = { ...LEAGUES.wnba, builds: ['identity'] as const }
    expect(leagueHolds(identityOnly, download({ on: true, hasFile: true, hasData: true }))).toBe(
      'notBuilt'
    )
    // The WNBA's game and season tables are built (T1301.6): ready once loaded.
    expect(leagueHolds(LEAGUES.wnba, download({ on: true, hasFile: true, hasData: true }))).toBe(
      'ready'
    )
  })

  it('is ready when it has data and its tables are built, a file kept from before included', () => {
    expect(leagueHolds(LEAGUES.nba, download({ league: 'nba', on: true, hasData: true }))).toBe(
      'ready'
    )
    expect(
      leagueHolds(LEAGUES.nba, download({ league: 'nba', hasFile: true, hasData: true }))
    ).toBe('ready')
  })

  it('has no tables yet while a league turned on downloads or builds them (T1304.5)', () => {
    // Turned on with nothing loaded yet, then loaded with its tables still to build.
    const ncaam = (over: Partial<LeagueDownload>): LeagueDownload =>
      download({ league: 'ncaam', on: true, hasData: true, ...over })
    expect(leagueHolds(LEAGUES.ncaam, ncaam({ built: false }))).toBe('notBuilt')
    expect(leagueHolds(LEAGUES.ncaam, ncaam({ hasFile: true, built: false }))).toBe('notBuilt')
    expect(leagueHolds(LEAGUES.ncaam, ncaam({ hasFile: true, built: true }))).toBe('ready')
    // A file kept from before, its league off: built, so its pages open.
    expect(leagueHolds(LEAGUES.ncaam, ncaam({ on: false, hasFile: true, built: true }))).toBe(
      'ready'
    )
    // Off with nothing: off, whatever its status said.
    expect(leagueHolds(LEAGUES.ncaam, download({ league: 'ncaam', built: false }))).toBe('off')
  })

  it('gives the menu its note', () => {
    expect(menuNote('off')).toBe('No stats yet')
    expect(menuNote('notBuilt')).toBe('No tables yet')
    expect(menuNote('ready')).toBeNull()
  })

  it('finds a league in the downloads', () => {
    const all: LeagueDownloads = {
      decided: true,
      leagues: [download({ league: 'nba', hasData: true }), download({})],
      freeBytes: null
    }
    expect(downloadOf(all, 'nba')?.hasData).toBe(true)
    expect(downloadOf(null, 'nba')).toBeUndefined()
  })
})

describe('the status line of a league with no tables yet', () => {
  const base = {
    available: true,
    through: null,
    updatedAt: null,
    builtAt: null,
    busy: false,
    progress: null,
    paused: false,
    noRoom: null,
    noData: LEAGUES.wnba.notBuilt
  }

  it('says what its load is doing, then that its files are loaded', () => {
    expect(
      freshness({ ...base, busy: true, progress: { done: 40, total: 1496 } }, 0, LEAGUES.wnba)
    ).toBe('Loading the stats · 40 of 1,496 files')
    expect(freshness({ ...base, paused: true }, 0, LEAGUES.wnba)).toBe('Loading paused')
    expect(freshness(base, 0, LEAGUES.wnba)).toBe('WNBA files loaded · no tables yet')
  })

  it('says a league that is off has no stats yet', () => {
    expect(
      freshness({ ...base, available: false, noData: LEAGUES.wnba.noData }, 0, LEAGUES.wnba)
    ).toBe('No WNBA stats yet')
  })
})
