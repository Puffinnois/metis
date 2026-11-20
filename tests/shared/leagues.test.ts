import { describe, expect, it } from 'vitest'
import {
  BUILT_TABLES,
  builds,
  buildsPlayTables,
  DEFAULT_LEAGUE,
  elapsedSeconds,
  gameSeconds,
  inSeason,
  isLeagueId,
  laneHalfWidthOf,
  LEAGUE_IDS,
  LEAGUES,
  leagueOf,
  PER_MINUTE,
  periodsIn,
  periodStartSeconds,
  playoffsWords,
  regulationPeriodsSql,
  seasonEnd,
  seasonLabel,
  threePointLineIn
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

  it('says which built tables each league has, both every step since T1301.8', () => {
    expect(nba.builds).toEqual(BUILT_TABLES)
    expect(wnba.builds).toEqual(BUILT_TABLES)
    expect(builds(wnba, 'identity')).toBe(true)
    expect(builds(wnba, 'derived')).toBe(true)
    expect(builds(wnba, 'published')).toBe(true)
    expect(builds(wnba, 'plays')).toBe(true)
    expect(builds(wnba, 'models')).toBe(true)
    expect(nba.published).toBe('nba')
    expect(wnba.published).toBe('wnba')
    expect(nba.plays).toBe('nba')
    expect(wnba.plays).toBe('wnba')
    expect(nba.identity).toBe('nba')
    expect(wnba.identity).toBe('wnba')
    expect(nba.derived).toBe('nba')
    expect(wnba.derived).toBe('wnba')
    expect(wnba.noData).toMatch(/WNBA/)
    expect(wnba.notBuilt).toMatch(/WNBA/)
  })

  it('writes the periods of regulation per season as SQL', () => {
    expect(regulationPeriodsSql(nba, 'season')).toBe('4')
    expect(regulationPeriodsSql(wnba, 'season')).toBe(
      '(CASE WHEN season >= 2006 THEN 4 ELSE 2 END)'
    )
  })
})

describe('the college leagues (D38)', () => {
  const men = LEAGUES.ncaam
  const women = LEAGUES.ncaaw

  it('share one college shape: 2021-22 on, labelled as the NBA, 40 minutes and per 40', () => {
    for (const league of [men, women]) {
      expect(league.firstSeason).toBe(2022)
      expect(seasonLabel(league, 2026)).toBe('2025-26')
      expect(league.gameMinutes).toBe(40)
      expect(league.perMinute).toEqual(['per36', 'per40'])
      expect(league.overtimeMinutes).toBe(5)
      expect(league.statsFile).toBe(`stats-${league.id}.duckdb`)
      // 6.75 metres at the arc for both (D38).
      expect(threePointLineIn(league, 2026).arc).toBe(221.5)
      expect(league.threePointLines).toHaveLength(1)
    }
    expect(men.name).toBe('NCAA Men')
    expect(women.name).toBe('NCAA Women')
  })

  it('run November to April, the label turning in August', () => {
    for (const league of [men, women]) {
      expect(league.seasonMonths).toEqual({ first: 11, last: 4 })
      expect(inSeason(league, new Date('2026-11-18T00:00:00Z'))).toBe(true)
      expect(inSeason(league, new Date('2026-04-06T00:00:00Z'))).toBe(true)
      expect(inSeason(league, new Date('2026-05-01T00:00:00Z'))).toBe(false)
      expect(inSeason(league, new Date('2026-10-31T00:00:00Z'))).toBe(false)
      // 2025-26 is over at the start of May 2026.
      expect(seasonEnd(league, 2026).toISOString()).toBe('2026-05-01T00:00:00.000Z')
      expect(league.currentSeason(new Date('2026-07-31T12:00:00Z'))).toBe(2026)
      expect(league.currentSeason(new Date('2026-11-18T12:00:00Z'))).toBe(2027)
    }
  })

  it('play two halves for the men and four quarters for the women', () => {
    expect(periodsIn(men, 2026)).toMatchObject({ periods: 2, minutes: 20, name: 'half' })
    expect(periodsIn(women, 2026)).toMatchObject({ periods: 4, minutes: 10, name: 'quarter' })
    expect(gameSeconds(men, 2026, 3)).toBe(2400 + 300)
    expect(gameSeconds(women, 2026, 5)).toBe(2400 + 300)
    expect(elapsedSeconds(men, 2026, 2, 0)).toBe(2400)
    expect(regulationPeriodsSql(men, 'season')).toBe('2')
    expect(regulationPeriodsSql(women, 'season')).toBe('4')
  })

  it('have the events as season types, all of them counted, every game by default (D45)', () => {
    expect(men.seasonTypes).toEqual([
      'regular',
      'playoffs',
      'nit',
      'cbi',
      'cit',
      'tbc',
      'crown',
      'preseason'
    ])
    expect(women.seasonTypes).toEqual(['regular', 'playoffs', 'wnit', 'wbi', 'wbit', 'preseason'])
    for (const league of [men, women]) {
      // Exhibitions are a type, named so, and never counted.
      expect(league.countedTypes).toEqual(league.seasonTypes.filter((t) => t !== 'preseason'))
      expect(league.typeNames.preseason).toBe('Exhibition')
      expect(league.typeNames.playoffs).toBe('NCAA tournament')
      expect(playoffsWords(league)).toBe('the NCAA tournament')
      expect(league.countedName).toBe('Every game')
      expect(league.defaultType).toBe('counted')
    }
    // The NBA and the WNBA as they were.
    expect(playoffsWords(nba)).toBe('the playoffs')
    expect(nba.defaultType).toBe('regular')
    expect(wnba.defaultType).toBe('regular')
    expect(nba.seasonTypes).toEqual([
      'regular',
      'play-in',
      'playoffs',
      'cup-final',
      'all-star',
      'preseason'
    ])
  })

  it('qualify by the NCAA’s 75 % games rule and its makes per game as its champions show them (D43)', () => {
    // 5 field goals, 2.5 free throws, 3 assists a game played; threes 2.5 for the men, 2.0 for the women.
    expect(men.madePerGame?.minimums).toEqual({
      fg_pct: { count: 'fgm', perGame: 5 },
      fg3_pct: { count: 'fg3m', perGame: 2.5 },
      ft_pct: { count: 'ftm', perGame: 2.5 },
      ast_tov: { count: 'ast', perGame: 3 }
    })
    expect(women.madePerGame?.minimums.fg3_pct).toEqual({ count: 'fg3m', perGame: 2 })
    expect(men.madePerGame?.note).toBe("the NCAA's minimums as its champions show them")
    expect(nba.madePerGame).toBeUndefined()
    expect(wnba.madePerGame).toBeUndefined()
    for (const league of [men, women]) {
      expect(league.gamesRule).toEqual({
        kind: 'share',
        share: 0.75,
        perGame: ['pts', 'reb', 'ast', 'stl', 'blk', 'fg3m']
      })
      expect(league.minimumsGames).toBe(82)
      expect(league.minimumsMinutes).toBe(48)
      expect(league.minimumsNote).toBe('scaled to the games in range')
      expect(league.seasonShape).toEqual({ opponents: 24, months: 5 })
    }
    expect(nba.gamesRule).toEqual({ kind: 'scaled' })
    expect(wnba.gamesRule).toEqual({ kind: 'scaled' })
  })

  it('build every table but the models and the play by play’s, and give their own reasons and sizes', () => {
    for (const league of [men, women]) {
      expect(league.builds).toEqual(['identity', 'derived', 'published', 'plays'])
      expect(builds(league, 'identity')).toBe(true)
      expect([league.identity, league.derived, league.published, league.plays]).toEqual([
        'college',
        'college',
        'college',
        'college'
      ])
      // The shots, lineups and officials of the plays step (T1302.6); the play by play's own tables
      // wait for T1302.7, and the lane is the college's 12 feet.
      expect(buildsPlayTables(league)).toBe(false)
      expect(laneHalfWidthOf(league)).toBe(60)
      // The families no source publishes, each with its reason (D44).
      expect(Object.keys(league.unpublished).sort()).toEqual(
        [
          'availability',
          'combine',
          'hustle',
          'matchups',
          'net',
          'play_types',
          'polls',
          'quadrants',
          'seeds',
          'tracking'
        ].sort()
      )
      expect(league.models).toBeNull()
      expect(league.metricsByDefault).toBe(false)
      expect(builds(league, 'derived')).toBe(true)
      expect(builds(league, 'published')).toBe(true)
      expect(builds(league, 'models')).toBe(false)
      // Nothing before 2021-22 is loaded (D39); Division I teams alone are ranked (D40).
      expect([league.loadedWindow, league.divisionIOnly]).toEqual([true, true])
      expect(league.noData).toMatch(/^No NCAA (men|women)'s stats yet: turn NCAA (Men|Women) on/)
      expect(league.size.roomBytes).toBe(6 * 1024 ** 3)
    }
    // The first loads of T1302.3: 767 and 718 MiB downloaded, 3.38 and 3.17 GiB on disk.
    expect(men.size.downloadBytes).toBe(803_921_971)
    expect(women.size.downloadBytes).toBe(752_895_003)
    expect(men.size.fileBytes).toBe(3_632_803_840)
    expect(men.size.fileBytes).toBeGreaterThan(women.size.fileBytes)
  })
})
