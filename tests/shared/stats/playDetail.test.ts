import { describe, expect, it } from 'vitest'
import {
  elapsedAt,
  flowSummary,
  gameLength,
  isMapped,
  kindOf,
  TURNOVER_KINDS,
  type FlowPoint
} from '@shared/stats/playDetail'

/** Scoring plays from a list of [seconds since the tip, side, points, field goal]. */
function points(list: [number, 'h' | 'a', number, boolean?][]): FlowPoint[] {
  let h = 0
  let a = 0
  return list.map(([t, side, pts, fg = pts > 1]) => {
    if (side === 'h') h += pts
    else a += pts
    return { t, home: side === 'h', pts, fg, homeScore: h, awayScore: a }
  })
}

describe('the game-flow rules', () => {
  it('does not count 0-0 at the tip as a tie, though its time counts as level', () => {
    const s = flowSummary(points([[100, 'h', 2]]), 2880)
    expect(s.timesTied).toBe(0)
    expect(s.timeTied).toBe(100)
    expect(s.leadChanges).toBe(0)
    expect(s.home.timeLeading).toBe(2780)
  })

  it('counts a change when the other side led last, a tie between or not', () => {
    const s = flowSummary(
      points([
        [10, 'h', 2],
        [20, 'a', 2],
        [30, 'a', 2],
        [40, 'h', 2],
        [50, 'h', 2]
      ]),
      2880
    )
    // 2-0 home; 2-2 tie; 2-4 away (a change); 4-4 tie; 6-4 home (a change).
    expect(s.timesTied).toBe(2)
    expect(s.leadChanges).toBe(2)
  })

  it('does not count a lead regained by the side that led before the tie', () => {
    const s = flowSummary(
      points([
        [10, 'h', 2],
        [20, 'a', 2],
        [30, 'h', 3]
      ]),
      2880
    )
    expect(s.timesTied).toBe(1)
    expect(s.leadChanges).toBe(0)
  })

  it('ends a run at any point by the other side, a free throw included', () => {
    const s = flowSummary(
      points([
        [10, 'h', 3],
        [20, 'h', 2],
        [30, 'a', 1, false],
        [40, 'h', 2],
        [50, 'h', 2],
        [60, 'h', 2]
      ]),
      2880
    )
    expect(s.home.bestRun).toBe(6)
    expect(s.away.bestRun).toBe(1)
  })

  it('carries a run and a drought over the end of regulation into overtime', () => {
    const s = flowSummary(
      points([
        [elapsedAt(4, 10), 'a', 2],
        [elapsedAt(5, 280), 'a', 3]
      ]),
      gameLength(5)
    )
    expect(gameLength(5)).toBe(3180)
    expect(s.away.bestRun).toBe(5)
    // The home side never scored: the whole game is its drought.
    expect(s.home.drought).toBe(3180)
    expect(s.away.drought).toBe(elapsedAt(4, 10))
  })

  it('times a field-goal drought apart from free throws, to the end of the game', () => {
    const s = flowSummary(
      points([
        [100, 'h', 2, true],
        [1000, 'h', 1, false],
        [2000, 'h', 2, true]
      ]),
      2880
    )
    expect(s.home.drought).toBe(1000)
    expect(s.home.droughtFg).toBe(1900)
  })

  it('handles a game with no score', () => {
    const s = flowSummary([], 2880)
    expect(s).toMatchObject({ leadChanges: 0, timesTied: 0, timeTied: 2880 })
    expect(s.home).toMatchObject({ largestLead: 0, bestRun: 0, drought: 2880, droughtFg: 2880 })
  })
})

describe('the kinds', () => {
  it('reports a spelling no kind lists as other and unmapped', () => {
    expect(kindOf(TURNOVER_KINDS, 'Brand New Turnover')).toBe('other')
    expect(isMapped(TURNOVER_KINDS, 'Brand New Turnover')).toBe(false)
    expect(isMapped(TURNOVER_KINDS, '10 Second Violaton')).toBe(true)
    expect(kindOf(TURNOVER_KINDS, null)).toBe('other')
  })
})
