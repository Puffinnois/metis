import { describe, expect, it } from 'vitest'
import {
  countOf,
  GAME_COUNTS,
  highOf,
  HIGHS,
  streakOf,
  STREAKS,
  tallyOf,
  THRESHOLDS,
  type Feat
} from '@shared/stats/highs'
import { CATALOGUE } from '@shared/stats/catalogue'
import type { GameCount, StatsPlayerGame } from '@shared/stats/types'

let n = 0
/** A game with the counts given, every other count 0. */
function game(counts: Partial<Record<GameCount, number | null>>): StatsPlayerGame {
  n++
  return {
    gameId: `g${n}`,
    date: `2026-01-${String(n).padStart(2, '0')}`,
    season: 2026,
    gameType: 'regular',
    team: 'LAL',
    opponentId: '1',
    opponent: 'BOS',
    home: true,
    won: true,
    counts: GAME_COUNTS.map((c) => (c in counts ? (counts[c] ?? null) : 0))
  }
}
const games = (pts: (number | null)[]): StatsPlayerGame[] => {
  n = 0
  return pts.map((p) => game({ pts: p }))
}
const feat = (list: readonly Feat[], id: string): Feat => list.find((f) => f.id === id)!
const twenty = feat(STREAKS, 'pts20')

describe('highs', () => {
  it('takes the best game, how many reached it and the latest of them', () => {
    const list = games([20, 31, 12, 31])
    expect(highOf(list, 'pts')).toEqual({ value: 31, times: 2, game: list[3], unknown: 0 })
  })

  it('keeps a high of zero, and a plus-minus that never was positive', () => {
    expect(highOf(games([0, 0]), 'pts')).toMatchObject({ value: 0, times: 2 })
    n = 0
    expect(highOf([game({ plus_minus: -12 }), game({ plus_minus: -3 })], 'plus_minus')?.value).toBe(
      -3
    )
  })

  it('leaves a missing count out, counts it apart, and has no high where every line lacks it', () => {
    expect(highOf(games([null, 8, null]), 'pts')).toMatchObject({ value: 8, unknown: 2 })
    expect(highOf(games([null, null]), 'pts')).toBeNull()
    expect(highOf([], 'pts')).toBeNull()
  })

  it('names each high by a catalogue metric the box score counts', () => {
    const ids = new Set(CATALOGUE.map((m) => m.id))
    for (const h of HIGHS) expect(ids.has(h.metric), h.metric).toBe(true)
    for (const f of [...THRESHOLDS, ...STREAKS])
      for (const m of f.metrics) expect(ids.has(m), m).toBe(true)
    expect(new Set(THRESHOLDS.map((f) => f.id)).size).toBe(THRESHOLDS.length)
    expect(new Set(STREAKS.map((f) => f.id)).size).toBe(STREAKS.length)
    n = 0
    expect(countOf(game({ blk: 4 }), 'blk')).toBe(4)
  })
})

describe('threshold games', () => {
  it('counts the games at or over the threshold, and those that cannot say apart', () => {
    expect(tallyOf(games([19, 20, 41, null]), feat(THRESHOLDS, 'pts20'))).toEqual({
      games: 2,
      unknown: 1,
      known: 3
    })
  })

  it('reads a double-double and a triple-double from any of the five counts', () => {
    n = 0
    const dd = feat(THRESHOLDS, 'dd2')
    const td = feat(THRESHOLDS, 'td3')
    const block = game({ pts: 9, reb: 12, blk: 10 })
    expect([dd.did(block), td.did(block)]).toEqual([true, false])
    const triple = game({ pts: 10, ast: 10, stl: 10 })
    expect([dd.did(triple), td.did(triple)]).toEqual([true, true])
  })

  it('does not know a double-double the missing count would decide, and knows one it would not', () => {
    n = 0
    const dd = feat(THRESHOLDS, 'dd2')
    expect(dd.did(game({ pts: 22, reb: null }))).toBeNull()
    expect(dd.did(game({ pts: 4, reb: null }))).toBe(false)
    expect(dd.did(game({ pts: 22, ast: 11, reb: null }))).toBe(true)
  })
})

describe('streaks', () => {
  it('finds the longest run and the run the last game stands in', () => {
    const list = games([25, 22, 20, 5, 30, 21])
    const s = streakOf(list, twenty)
    expect(s.longest).toEqual({ length: 3, from: list[0], to: list[2] })
    expect(s.last).toEqual({ length: 2, from: list[4], to: list[5] })
  })

  it('takes the latest of equal runs, and has no run where the last game missed', () => {
    const list = games([20, 20, 1, 20, 20, 1])
    const s = streakOf(list, twenty)
    expect(s.longest).toMatchObject({ length: 2, from: list[3] })
    expect(s.last).toBeNull()
  })

  it('ends a run on a game that cannot say, and counts it', () => {
    const s = streakOf(games([20, 20, null, 20]), twenty)
    expect(s.longest?.length).toBe(2)
    expect(s.last?.length).toBe(1)
    expect([s.unknown, s.known]).toEqual([1, 3])
  })

  it('has none where no game did it, nor over no games', () => {
    expect(streakOf(games([1, 2]), twenty)).toMatchObject({ longest: null, last: null })
    expect(streakOf([], twenty)).toMatchObject({ longest: null, last: null, known: 0 })
  })
})
