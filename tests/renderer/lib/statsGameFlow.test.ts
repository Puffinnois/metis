import { describe, expect, it } from 'vitest'
import { assistCount, playerAssistRows, teamAssistRows } from '@/lib/stats/assists'
import {
  clockText,
  flowFacts,
  flowGeometry,
  flowLength,
  marginScale,
  periodLabel,
  type FlowFrame
} from '@/lib/stats/gameFlow'
import { flowSummary } from '@shared/stats/playDetail'
import type { StatsAssistPair, StatsFlowPoint, StatsGameFlow } from '@shared/stats/types'

const FRAME: FlowFrame = { width: 300, height: 120, left: 0, right: 0, top: 10, bottom: 10 }

const point = (t: number, home: boolean, h: number, a: number): StatsFlowPoint => ({
  t,
  period: 1,
  clock: 720 - t,
  home,
  pts: 2,
  fg: true,
  homeScore: h,
  awayScore: a
})

const flow = (points: StatsFlowPoint[], periods = 4): StatsGameFlow => ({
  points,
  periods,
  homeTeam: 'BOS',
  awayTeam: 'LAL',
  summary: null,
  reason: null
})

describe('the game-flow chart', () => {
  it('scales the margin symmetrically to a multiple of five', () => {
    expect(marginScale([])).toBe(5)
    expect(marginScale([point(10, true, 12, 0)])).toBe(15)
    expect(marginScale([point(10, false, 0, 21)])).toBe(25)
  })

  it('draws the margin as steps held until the next score, to the end of the game', () => {
    const g = flowGeometry(flow([point(720, true, 5, 0), point(1440, false, 5, 10)]), FRAME)
    expect(g.scale).toBe(5)
    // 2,880 seconds over 300 pixels; zero at the middle of 100 pixels of height, 5 points at the top.
    expect(g.x(720)).toBe(75)
    expect(g.y(0)).toBe(60)
    expect(g.y(5)).toBe(10)
    expect(g.y(-5)).toBe(110)
    expect(g.path).toBe('M0,60 H75 V10 H150 V110 H300')
    expect(g.area).toBe('M0,60 H75 V10 H150 V110 H300 V60 H0 Z')
    expect(g.changes).toEqual([{ x: 150, y: 110 }])
  })

  it('marks each period and overtime at its start', () => {
    expect(flowLength(6)).toBe(3480)
    const g = flowGeometry(flow([], 6), FRAME)
    expect(g.periods.map((p) => p.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'OT', '2OT'])
    expect(g.periods[4].x).toBeCloseTo((2880 / 3480) * 300, 1)
    expect(periodLabel(7)).toBe('3OT')
  })

  it('writes the flow’s numbers in words and clock time', () => {
    const s = flowSummary(
      [
        { t: 60, home: true, pts: 2, fg: true, homeScore: 2, awayScore: 0 },
        { t: 120, home: false, pts: 3, fg: true, homeScore: 2, awayScore: 3 }
      ],
      2880
    )
    const f = flowFacts(s)
    expect(f.shared).toEqual(['1 lead change', 'tied 0 times', 'level for 1:00 (2%)'])
    expect(f.sides.find((x) => x.label === 'Best run')).toEqual({
      label: 'Best run',
      home: '2-0',
      away: '3-0'
    })
    expect(clockText(125.4)).toBe('2:05')
  })
})

const pair = (passer: string, scorer: string, makes: number, threes = 0): StatsAssistPair => ({
  passer,
  passerName: `P${passer}`,
  scorer,
  scorerName: `P${scorer}`,
  makes,
  threes,
  points: 2 * makes + threes
})

describe('the assist tables', () => {
  it('order a team’s pairs by makes, each with its share', () => {
    const rows = teamAssistRows([pair('1', '2', 1), pair('3', '2', 3, 1)])
    expect(rows.map((r) => [r.key, r.share])).toEqual([
      ['3-2', 0.75],
      ['1-2', 0.25]
    ])
  })

  it('split a player’s pairs into who they feed and who feeds them', () => {
    const { feeds, fedBy } = playerAssistRows(
      [pair('1', '2', 2), pair('3', '1', 4), pair('1', '4', 2, 2)],
      '1'
    )
    expect(feeds.map((r) => r.scorer)).toEqual(['4', '2'])
    expect(feeds.map((r) => r.share)).toEqual([0.5, 0.5])
    expect(fedBy.map((r) => [r.passer, r.share])).toEqual([['3', 1]])
    expect(assistCount(15, 40)).toBe('15 of 40 pairs')
    expect(assistCount(1, 1)).toBe('1 pair')
  })
})
