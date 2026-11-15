import { describe, expect, it } from 'vitest'
import {
  includedSources,
  isTableLeftOut,
  LEFT_OUT_REASON,
  leftOutGap,
  leftOutProblem,
  leftOutSources,
  leftOutTables,
  requiredReleases
} from '@main/stats/leftOut'
import { LEFT_OUT_RELEASES, SOURCES } from '@main/stats/sources'
import { METRICS } from '@shared/stats/catalogue'

const metric = (id: string): NonNullable<ReturnType<typeof METRICS.get>> => {
  const m = METRICS.get(id)
  if (!m) throw new Error(`no metric ${id}`)
  return m
}

describe('the releases left out of this build', () => {
  it('are none as committed, and that list builds', () => {
    expect(LEFT_OUT_RELEASES).toEqual([])
    expect(leftOutProblem()).toBeNull()
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
})

describe('the credit', () => {
  it('stays true whatever is left out: ESPN and the NBA each keep a release that cannot go', () => {
    // The credit (`lib/stats/credit.ts`, its own test) names ESPN and NBA.com and reads no list.
    expect(requiredReleases().some((r) => r.startsWith('espn_nba_'))).toBe(true)
    expect(requiredReleases().some((r) => r.startsWith('nba_stats_'))).toBe(true)
  })
})
