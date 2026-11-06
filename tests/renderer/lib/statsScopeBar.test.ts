import { describe, expect, it } from 'vitest'
import {
  defaultScope,
  moveToSeason,
  queryScope,
  rangeLabel,
  scopeLabel,
  seasonOf,
  seasonTypes,
  typeLabel,
  type StatsScope
} from '@/lib/stats/scope'
import type { StatsSeason } from '@shared/stats/types'

const season = (
  n: number,
  types: StatsSeason['types'],
  firstDate = `${n - 1}-10-20`,
  lastDate = `${n}-06-15`
): StatsSeason => ({ season: n, firstDate, lastDate, types, teams: [] })

const LATEST = season(2026, [
  { type: 'regular', games: 1230 },
  { type: 'play-in', games: 6 },
  { type: 'playoffs', games: 85 },
  { type: 'cup-final', games: 1 }
])
const OLD = season(1995, [
  { type: 'regular', games: 1107 },
  { type: 'playoffs', games: 72 }
])
const STARS = season(2020, [
  { type: 'regular', games: 1059 },
  { type: 'all-star', games: 2 }
])
const EARLY = season(2027, [{ type: 'regular', games: 123 }])
const SEASONS = [LATEST, STARS, OLD]

const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

describe('the season types on offer', () => {
  it('are the ones with box scores, and every game that counts when there is more than one', () => {
    expect(seasonTypes(LATEST)).toEqual(['regular', 'play-in', 'playoffs', 'cup-final', 'counted'])
    expect(seasonTypes(OLD)).toEqual(['regular', 'playoffs', 'counted'])
  })

  it('leave out "and after" before there is an after', () => {
    expect(seasonTypes(EARLY)).toEqual(['regular'])
  })

  it('keep the All-Star Game apart from what counts', () => {
    expect(seasonTypes(STARS)).toEqual(['regular', 'all-star'])
  })

  it('offer the regular season before the seasons are read', () => {
    expect(seasonTypes(undefined)).toEqual(['regular'])
  })

  it('have names', () => {
    expect(typeLabel('counted')).toBe('Regular season and after')
    expect(typeLabel('cup-final')).toBe('NBA Cup final')
  })
})

describe('the first scope', () => {
  it('is the latest season’s whole regular season', () => {
    expect(defaultScope(SEASONS, null)).toEqual(SCOPE)
  })

  it('reads the status before the seasons arrive', () => {
    const status = {
      available: true,
      through: { season: 2027, date: '2026-11-04' },
      updatedAt: null,
      builtAt: null,
      busy: false,
      progress: null,
      paused: false,
      noRoom: null
    }
    expect(defaultScope([], status).season).toBe(2027)
  })

  it('finds a season', () => {
    expect(seasonOf(SEASONS, 1995)).toBe(OLD)
    expect(seasonOf(SEASONS, 1800)).toBeUndefined()
  })
})

describe('moving to another season', () => {
  it('keeps what still applies', () => {
    const scope: StatsScope = {
      ...SCOPE,
      seasonType: 'playoffs',
      range: { kind: 'last', n: 10, of: 'team' }
    }
    expect(moveToSeason(scope, 1995, SEASONS)).toEqual({ ...scope, season: 1995 })
  })

  it('drops a date range: its dates were the old season’s', () => {
    const scope: StatsScope = {
      ...SCOPE,
      range: { kind: 'dates', from: '2026-01-01', to: '2026-02-01' }
    }
    expect(moveToSeason(scope, 1995, SEASONS).range).toEqual({ kind: 'season' })
  })

  it('falls back to the regular season when the type is not there', () => {
    const scope: StatsScope = { ...SCOPE, seasonType: 'cup-final' }
    expect(moveToSeason(scope, 1995, SEASONS).seasonType).toBe('regular')
  })
})

describe('the query’s scope', () => {
  it('asks for one season and its type', () => {
    expect(queryScope(SCOPE, 'player')).toEqual({ seasons: [2026], gameTypes: ['regular'] })
  })

  it('reads every game that counts as four types, never All-Star or preseason', () => {
    expect(queryScope({ ...SCOPE, seasonType: 'counted' }, 'player').gameTypes).toEqual([
      'regular',
      'play-in',
      'playoffs',
      'cup-final'
    ])
  })

  it('carries a date range', () => {
    const range = { kind: 'dates', from: '2026-01-01', to: '2026-02-01' } as const
    expect(queryScope({ ...SCOPE, range }, 'player').dates).toEqual(['2026-01-01', '2026-02-01'])
  })

  it('carries a last N, and whose games only for a player', () => {
    const range = { kind: 'last', n: 5, of: 'team' } as const
    expect(queryScope({ ...SCOPE, range }, 'player')).toMatchObject({ lastN: 5, lastNOf: 'team' })
    expect(queryScope({ ...SCOPE, range }, 'team')).not.toHaveProperty('lastNOf')
  })
})

describe('the words for a scope', () => {
  it('says the range', () => {
    expect(rangeLabel(SCOPE)).toBe('Whole season')
    expect(
      rangeLabel({ ...SCOPE, range: { kind: 'dates', from: '2026-01-05', to: '2026-02-01' } })
    ).toBe('Jan 5 – Feb 1')
    expect(rangeLabel({ ...SCOPE, range: { kind: 'last', n: 10, of: 'appearances' } })).toBe(
      'Last 10 games'
    )
    const team = { ...SCOPE, range: { kind: 'last', n: 10, of: 'team' } } as const
    expect(rangeLabel(team)).toBe("Team's last 10 games")
    expect(rangeLabel(team, 'team')).toBe('Last 10 games')
  })

  it('writes the season as the screens do', () => {
    expect(scopeLabel(SCOPE)).toBe('2025-26 · Regular season · Whole season')
  })
})
