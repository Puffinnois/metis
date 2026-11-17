import { describe, expect, it, vi } from 'vitest'
import { compileQuery } from '@main/stats/engine/compile'
import { LEFT_OUT_REASON } from '@main/stats/leftOut'
import type { StatsQuery } from '@shared/stats/types'
import { LEAGUES } from '@shared/leagues'

// A build that leaves out the league dashboards, the on-court lineups and the NBA's play by play.
vi.mock('@main/stats/sources', async (actual) => ({
  ...(await actual<typeof import('@main/stats/sources')>()),
  LEFT_OUT_RELEASES: ['nba_stats_leaguedash', 'nba_stats_game_lineups', 'nba_stats_pbp']
}))

const CTX = { league: LEAGUES.nba, currentSeason: 2027 }
const query = (metrics: string[], scope: Partial<StatsQuery['scope']> = {}): StatsQuery => ({
  entity: 'player',
  metrics,
  scope: { seasons: [2026], ...scope }
})

describe('a metric whose source is left out of the build', () => {
  it('reads null with the reason, in every season, while the box scores still answer', () => {
    const c = compileQuery(query(['pts', 'drives', 'onc_min']), CTX)
    expect(c.gaps).toEqual([null, LEFT_OUT_REASON, LEFT_OUT_REASON])
    // The reason comes before coverage: no change of season would answer it.
    expect(compileQuery(query(['drives'], { seasons: [2005] }), CTX).gaps).toEqual([
      LEFT_OUT_REASON
    ])
  })

  it('reads the reason under a split, which is counted from the play by play left out', () => {
    expect(compileQuery(query(['pts'], { split: 'clutch' }), CTX).gaps).toEqual([LEFT_OUT_REASON])
  })
})
