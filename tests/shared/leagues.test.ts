import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LEAGUE,
  elapsedSeconds,
  gameSeconds,
  inSeason,
  isLeagueId,
  LEAGUE_IDS,
  LEAGUES,
  leagueOf,
  PER_MINUTE,
  periodsIn,
  periodStartSeconds,
  seasonLabel
} from '@shared/leagues'
import { GAME_TYPES } from '@shared/stats/types'

const nba = LEAGUES.nba
const wnba = LEAGUES.wnba

describe('the league registry', () => {
  it('has an entry for every id, each naming its own file', () => {
    for (const id of LEAGUE_IDS) {
      expect(leagueOf(id).id).toBe(id)
      expect(leagueOf(id).statsFile).toBe(`stats-${id}.duckdb`)
    }
    expect(DEFAULT_LEAGUE).toBe('nba')
    expect(isLeagueId('wnba')).toBe(true)
    expect(isLeagueId('nfl')).toBe(false)
    expect(() => leagueOf('nfl' as never)).toThrow('unknown league')
  })

  it('labels a season as each league does', () => {
    expect(seasonLabel(nba, 2026)).toBe('2025-26')
    expect(seasonLabel(nba, 2000)).toBe('1999-00')
    expect(seasonLabel(wnba, 2026)).toBe('2026')
  })

  it('turns the season as each league does', () => {
    // The NBA's label turns in August; the WNBA's is the calendar year.
    expect(nba.currentSeason(new Date('2026-07-31T12:00:00Z'))).toBe(2026)
    expect(nba.currentSeason(new Date('2026-08-01T12:00:00Z'))).toBe(2027)
    expect(wnba.currentSeason(new Date('2026-11-17T12:00:00Z'))).toBe(2026)
    expect(wnba.currentSeason(new Date('2027-01-02T12:00:00Z'))).toBe(2027)
  })

  it('knows when each league is in season', () => {
    expect(inSeason(nba, new Date('2026-11-17T00:00:00Z'))).toBe(true)
    expect(inSeason(nba, new Date('2026-08-17T00:00:00Z'))).toBe(false)
    expect(inSeason(wnba, new Date('2026-11-17T00:00:00Z'))).toBe(false)
    expect(inSeason(wnba, new Date('2026-07-01T00:00:00Z'))).toBe(true)
  })

  it('gives each a game length and per-minute modes ending at it', () => {
    expect(nba.gameMinutes).toBe(48)
    expect(wnba.gameMinutes).toBe(40)
    for (const league of Object.values(LEAGUES)) {
      expect(PER_MINUTE[league.perMinute[league.perMinute.length - 1]]).toBe(league.gameMinutes)
    }
  })

  it('lists only game types of the one set, the counted ones among them', () => {
    for (const league of Object.values(LEAGUES)) {
      for (const t of league.seasonTypes) expect(GAME_TYPES).toContain(t)
      for (const t of league.countedTypes) expect(league.seasonTypes).toContain(t)
    }
    expect(wnba.seasonTypes).not.toContain('play-in')
    expect(wnba.seasonTypes).not.toContain('preseason')
  })

  it('gives every era the game length, and the WNBA halves to 2005', () => {
    for (const league of Object.values(LEAGUES)) {
      expect(league.periods[0].from).toBe(league.firstSeason)
      for (const e of league.periods) expect(e.periods * e.minutes).toBe(league.gameMinutes)
    }
    expect(periodsIn(wnba, 2005)).toMatchObject({ periods: 2, minutes: 20, name: 'half' })
    expect(periodsIn(wnba, 2006)).toMatchObject({ periods: 4, minutes: 10, name: 'quarter' })
    expect(periodsIn(nba, 2026)).toMatchObject({ periods: 4, minutes: 12 })
  })

  it('counts seconds from the tip-off by the season’s periods', () => {
    // The NBA: the end of the third quarter, and two minutes into the first overtime.
    expect(elapsedSeconds(nba, 2026, 3, 0)).toBe(2160)
    expect(elapsedSeconds(nba, 2026, 5, 180)).toBe(2880 + 120)
    expect(periodStartSeconds(nba, 2026, 5)).toBe(2880)
    expect(gameSeconds(nba, 2026, 6)).toBe(2880 + 600)
    // The WNBA in halves: the second half starts at 1,200 s; overtime is period 3.
    expect(periodStartSeconds(wnba, 2004, 2)).toBe(1200)
    expect(elapsedSeconds(wnba, 2004, 3, 0)).toBe(2400 + 300)
    expect(gameSeconds(wnba, 2004, 2)).toBe(2400)
    // And in quarters.
    expect(periodStartSeconds(wnba, 2006, 4)).toBe(1800)
    expect(gameSeconds(wnba, 2026, 5)).toBe(2700)
  })

  it('builds no WNBA tables yet, and says so', () => {
    expect(nba.derived).toBe(true)
    expect(wnba.derived).toBe(false)
    expect(wnba.noData).toMatch(/WNBA/)
    expect(wnba.notBuilt).toMatch(/WNBA/)
  })
})
