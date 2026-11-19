import { describe, expect, it } from 'vitest'
import {
  includedSources,
  isTableLeftOut,
  LEFT_OUT_REASON,
  leftOutGap,
  leftOutIn,
  leftOutProblem,
  leftOutSources,
  leftOutTables,
  requiredReleases
} from '@main/stats/leftOut'
import { LEFT_OUT_RELEASES, SOURCES, SOURCES_BY_LEAGUE } from '@main/stats/sources'
import { CATALOGUE, METRICS } from '@shared/stats/catalogue'
import { LEAGUES } from '@shared/leagues'

const metric = (id: string): NonNullable<ReturnType<typeof METRICS.get>> => {
  const m = METRICS.get(id)
  if (!m) throw new Error(`no metric ${id}`)
  return m
}

describe('the releases left out of this build', () => {
  it('are ESPN’s college play by play alone as committed (D42), and that list builds', () => {
    expect(LEFT_OUT_RELEASES).toEqual([
      'espn_mens_college_basketball_pbp',
      'espn_womens_college_basketball_pbp'
    ])
    for (const sources of Object.values(SOURCES_BY_LEAGUE)) {
      expect(leftOutProblem(leftOutIn(LEFT_OUT_RELEASES, sources), sources)).toBeNull()
    }
    // Every NBA and WNBA release loads.
    expect(leftOutIn(LEFT_OUT_RELEASES, SOURCES)).toEqual([])
    expect(leftOutIn(LEFT_OUT_RELEASES, SOURCES_BY_LEAGUE.wnba)).toEqual([])
    expect(includedSources()).toEqual(SOURCES)
  })

  it('can never include what the game, team and player tables are built from', () => {
    // Read from the identity and derived builds' needs: both schedules and box scores, the team
    // aliases and divisions, and the id crosswalks.
    expect(requiredReleases()).toEqual([
      'espn_nba_player_boxscores',
      'espn_nba_schedules',
      'nba_crosswalk',
      'nba_groups',
      'nba_stats_player_boxscores',
      'nba_stats_schedules'
    ])
    for (const tag of requiredReleases()) {
      expect(leftOutProblem([tag])).toBe(
        `LEFT_OUT_RELEASES names a release the game, team and player tables are built from, which cannot be left out: ${tag}.`
      )
    }
  })

  it('must name releases Metis loads, exactly', () => {
    expect(leftOutProblem(['nba_stats_'])).toBe(
      'LEFT_OUT_RELEASES names a release Metis does not load: nba_stats_.'
    )
    expect(leftOutProblem(['nba_stats_synergy', 'nba_player_impact'])).toBeNull()
  })

  it('leaves the other sources in, and names the tables to drop', () => {
    const list = ['nba_stats_synergy', 'nba_stats_hustle']
    const out = leftOutSources(list)
    expect(new Set(out.map((s) => s.release))).toEqual(new Set(list))
    expect(includedSources(list)).toHaveLength(SOURCES.length - out.length)
    expect(includedSources(list).some((s) => list.includes(s.release))).toBe(false)
    expect(leftOutTables(list)).toEqual([
      'src_nba_hustle_player',
      'src_nba_hustle_team',
      'src_nba_play_types'
    ])
    expect(isTableLeftOut('src_nba_player_box', list)).toBe(false)
  })

  it('gives a metric that read it the reason, and none to the rest', () => {
    const list = ['nba_player_impact', 'nba_stats_shots']
    expect(leftOutGap(metric('sdv_rapm'), false, list)).toBe(LEFT_OUT_REASON)
    expect(leftOutGap(metric('pts'), false, list)).toBeNull()
    expect(leftOutGap(metric('sdv_rapm'), false, [])).toBeNull()
  })

  it('reads the league’s own files: the WNBA’s shots and play by play, not the NBA’s', () => {
    const shot = CATALOGUE.find((d) => d.built === 'shot_player_game')!
    const wnbaShots = ['wnba_stats_shots']
    expect(leftOutGap(shot, false, wnbaShots, LEAGUES.wnba)).toBe(LEFT_OUT_REASON)
    expect(leftOutGap(shot, false, wnbaShots, LEAGUES.nba)).toBeNull()
    expect(leftOutGap(shot, false, ['nba_stats_shots'], LEAGUES.wnba)).toBeNull()
    // A split reads the league's play by play.
    expect(leftOutGap(metric('pts'), true, ['wnba_stats_pbp'], LEAGUES.wnba)).toBe(LEFT_OUT_REASON)
    expect(leftOutGap(metric('pts'), true, ['wnba_stats_pbp'], LEAGUES.nba)).toBeNull()
  })
})

describe('the credit', () => {
  it('stays true whatever is left out: ESPN and the NBA each keep a release that cannot go', () => {
    // The credit (`lib/stats/credit.ts`, its own test) names ESPN and NBA.com and reads no list.
    expect(requiredReleases().some((r) => r.startsWith('espn_nba_'))).toBe(true)
    expect(requiredReleases().some((r) => r.startsWith('nba_stats_'))).toBe(true)
  })
})
