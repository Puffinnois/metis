import { describe, expect, it } from 'vitest'
import { pairCount, pairGap, pairRows, PAIR_HEAD, PAIR_LIMIT } from '@/lib/stats/matchups'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsMatchupPair } from '@shared/stats/types'

const SEASON: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

/** Nikola Jokić guarded by LeBron James in 2025-26, in round numbers. */
const PAIR: StatsMatchupPair = {
  id: '203999',
  name: 'Nikola Jokić',
  games: 3,
  minutes: 9 + 59.5 / 60,
  partialPoss: 54.6,
  pts: 12,
  fgm: 5,
  fga: 8,
  fg3m: 1,
  fg3a: 3,
  ftm: 1,
  fta: 2,
  ast: 4,
  tov: 2,
  blk: 0
}

describe('the matchup pairs', () => {
  it('answer a whole regular season from 2017-18 only, and say why not otherwise', () => {
    expect(pairGap(SEASON)).toBeNull()
    expect(pairGap({ ...SEASON, season: 2017 })).toBe('Tracked from 2017-18.')
    expect(pairGap({ ...SEASON, seasonType: 'playoffs' })).toBe(
      'The NBA publishes pairs for the regular season only.'
    )
    expect(pairGap({ ...SEASON, range: { kind: 'last', n: 10, of: 'appearances' } })).toBe(
      'Pairs are published for whole seasons only.'
    )
  })

  it('read a pair as the table shows it, one cell per column after the name', () => {
    const [row] = pairRows([PAIR])
    expect(row).toEqual({
      key: '203999',
      name: 'Nikola Jokić',
      cells: ['3', '10:00', '54.6', '12', '5-8', '62.5%', '1-3', '4', '2']
    })
    expect(row.cells).toHaveLength(PAIR_HEAD.length - 1)
  })

  it('leave a percentage blank with no attempts, and a missing number as a dash', () => {
    const [row] = pairRows([{ ...PAIR, fgm: 0, fga: 0, ast: null, fg3m: null }])
    expect(row.cells[5]).toBe('—')
    expect(row.cells[6]).toBe('—')
    expect(row.cells[7]).toBe('—')
  })

  it('show the longest first up to the limit, or all of them', () => {
    const many = Array.from({ length: PAIR_LIMIT + 3 }, (_, i) => ({ ...PAIR, id: String(i) }))
    expect(pairRows(many).map((r) => r.key)).toEqual(many.slice(0, PAIR_LIMIT).map((p) => p.id))
    expect(pairRows(many, null)).toHaveLength(PAIR_LIMIT + 3)
    expect(pairCount(PAIR_LIMIT, many.length)).toBe(`${PAIR_LIMIT} of ${many.length} players`)
    expect(pairCount(1, 1)).toBe('1 player')
  })
})
