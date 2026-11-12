import { describe, expect, it } from 'vitest'
import {
  gamePairCount,
  gamePairSides,
  GAME_PAIR_HEAD,
  matchupScope,
  pairCount,
  pairGap,
  pairRows,
  pairsNote,
  PAIR_HEAD,
  PAIR_LIMIT
} from '@/lib/stats/matchups'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsGameMatchup, StatsMatchupPair } from '@shared/stats/types'

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
  it('answer any scope from 2017-18, and say why not before it', () => {
    expect(pairGap(SEASON)).toBeNull()
    expect(pairGap({ ...SEASON, season: 2017 })).toBe('Tracked from 2017-18.')
    expect(pairGap({ ...SEASON, seasonType: 'playoffs' })).toBeNull()
    expect(pairGap({ ...SEASON, range: { kind: 'last', n: 10, of: 'appearances' } })).toBeNull()
  })

  it('pass the scope bar’s games to the read', () => {
    expect(matchupScope(SEASON)).toEqual({ gameTypes: ['regular'] })
    expect(
      matchupScope({ ...SEASON, range: { kind: 'dates', from: '2026-01-01', to: '2026-01-31' } })
    ).toEqual({ gameTypes: ['regular'], dates: ['2026-01-01', '2026-01-31'] })
    expect(matchupScope({ ...SEASON, range: { kind: 'last', n: 10, of: 'team' } })).toEqual({
      gameTypes: ['regular'],
      lastN: 10,
      lastNOf: 'team'
    })
    expect(matchupScope({ ...SEASON, seasonType: 'counted' }).gameTypes).toEqual([
      'regular',
      'play-in',
      'playoffs',
      'cup-final'
    ])
  })

  it('say where the pairs come from', () => {
    expect(pairsNote('season')).toMatch(/^From the NBA’s pair file for the whole regular season\./)
    expect(pairsNote('games')).toMatch(/^Added up from the NBA’s game matchups/)
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

  it('count a game’s pairs', () => {
    expect(gamePairCount(15, 87)).toBe('15 of 87 pairs')
    expect(gamePairCount(1, 1)).toBe('1 pair')
  })
})

const game = (
  defTeamId: string,
  defId: string,
  offId: string,
  minutes: number,
  o: Partial<StatsGameMatchup> = {}
): StatsGameMatchup => ({
  offId,
  offName: `Player ${offId}`,
  offTeamId: defTeamId === 'A' ? 'H' : 'A',
  offPosition: 'F',
  defId,
  defName: `Player ${defId}`,
  defTeamId,
  minutes,
  partialPoss: 10.5,
  pts: 4,
  fgm: 2,
  fga: 5,
  fg3m: 0,
  fg3a: 2,
  ftm: 0,
  fta: 0,
  ast: 1,
  tov: 0,
  blk: 1,
  sfl: 0,
  ...o
})

describe('a game’s pairs', () => {
  const pairs = [
    game('H', '1', '9', 6),
    game('A', '2', '8', 5.5),
    game('H', '3', '7', 4),
    game('A', '4', '6', 1, { fga: null, fgm: null })
  ]

  it('split by the side defending, away first, each in the order read', () => {
    const [away, home] = gamePairSides(pairs, { id: 'A', code: 'AWY' }, { id: 'H', code: 'HOM' })
    expect(away.code).toBe('AWY')
    expect(away.rows.map((r) => r.key)).toEqual(['2-8', '4-6'])
    expect(home.rows.map((r) => r.key)).toEqual(['1-9', '3-7'])
    expect(home.total).toBe(2)
  })

  it('read one cell per column after the two names, a missing count as a dash', () => {
    const [away] = gamePairSides(pairs, { id: 'A', code: 'AWY' }, { id: 'H', code: 'HOM' })
    expect(away.rows[0].cells).toEqual(['5:30', '10.5', '4', '2-5', '0-2', '0-0', '1', '0', '1'])
    expect(away.rows[0].cells).toHaveLength(GAME_PAIR_HEAD.length - 2)
    expect(away.rows[1].cells[3]).toBe('—')
  })

  it('cut each side to the limit, and show all with none', () => {
    const [, home] = gamePairSides(pairs, { id: 'A', code: 'AWY' }, { id: 'H', code: 'HOM' }, 1)
    expect(home.rows).toHaveLength(1)
    expect(home.total).toBe(2)
    const [, all] = gamePairSides(pairs, { id: 'A', code: 'AWY' }, { id: 'H', code: 'HOM' }, null)
    expect(all.rows).toHaveLength(2)
  })
})
