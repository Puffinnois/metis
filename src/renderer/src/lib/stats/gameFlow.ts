import type { FlowSummary } from '@shared/stats/playDetail'
import type { StatsFlowPoint, StatsGameFlow } from '@shared/stats/types'

/**
 * A game's flow chart (Plan T905): the home side's margin over the game clock as a step line, the
 * margin holding from one scoring play to the next, with the period breaks and the lead changes
 * marked. The numbers beside it are `flowSummary`'s, from `src/shared/stats/playDetail.ts`.
 */

export interface FlowFrame {
  width: number
  height: number
  /** Inner padding: left for the margin labels, bottom for the periods. */
  left: number
  right: number
  top: number
  bottom: number
}

export const FLOW_FRAME: FlowFrame = {
  width: 760,
  height: 240,
  left: 36,
  right: 12,
  top: 12,
  bottom: 24
}

/** The game's length from its last period: 12-minute quarters, 5-minute overtimes. */
export const flowLength = (periods: number): number =>
  periods <= 4 ? 2880 : 2880 + (periods - 4) * 300

/** The largest margin either way, rounded up to a multiple of 5, at least 5: the y axis is symmetric. */
export function marginScale(points: readonly StatsFlowPoint[]): number {
  const most = points.reduce((m, p) => Math.max(m, Math.abs(p.homeScore - p.awayScore)), 0)
  return Math.max(5, Math.ceil(most / 5) * 5)
}

export interface FlowGeometry {
  x: (t: number) => number
  y: (margin: number) => number
  /** The step line: SVG path data. */
  path: string
  /** The same, closed to the zero line, for the shading of each side. */
  area: string
  /** Period breaks, with the label of the period after each start. */
  periods: { x: number; label: string }[]
  /** Margin ticks for the axis, home ahead positive. */
  ticks: { y: number; label: string }[]
  /** Where each lead change happened. */
  changes: { x: number; y: number }[]
  scale: number
}

const r1 = (v: number): number => Math.round(v * 10) / 10

export const periodLabel = (p: number): string => (p <= 4 ? `Q${p}` : p === 5 ? 'OT' : `${p - 4}OT`)

/** The chart's coordinates for a game, in the frame. */
export function flowGeometry(flow: StatsGameFlow, frame: FlowFrame = FLOW_FRAME): FlowGeometry {
  const length = flowLength(flow.periods)
  const scale = marginScale(flow.points)
  const w = frame.width - frame.left - frame.right
  const h = frame.height - frame.top - frame.bottom
  const x = (t: number): number => r1(frame.left + (Math.min(Math.max(t, 0), length) / length) * w)
  const y = (m: number): number => r1(frame.top + h / 2 - (m / scale) * (h / 2))
  const steps: string[] = [`M${x(0)},${y(0)}`]
  let leader = 0
  const changes: { x: number; y: number }[] = []
  for (const p of flow.points) {
    const next = p.homeScore - p.awayScore
    steps.push(`H${x(p.t)}`, `V${y(next)}`)
    const s = Math.sign(next)
    if (s !== 0) {
      if (leader !== 0 && s !== leader) changes.push({ x: x(p.t), y: y(next) })
      leader = s
    }
  }
  steps.push(`H${x(length)}`)
  const path = steps.join(' ')
  const area = `${path} V${y(0)} H${x(0)} Z`
  const periods = Array.from({ length: flow.periods }, (_, i) => {
    const p = i + 1
    const start = p <= 4 ? (p - 1) * 720 : 2880 + (p - 5) * 300
    return { x: x(start), label: periodLabel(p) }
  })
  const half = Math.round(scale / 2)
  const ticks = [scale, half, 0, -half, -scale].map((m) => ({
    y: y(m),
    label: m === 0 ? '0' : String(Math.abs(m))
  }))
  return { x, y, path, area, periods, ticks, changes, scale }
}

/** Seconds as m:ss. */
export function clockText(seconds: number): string {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export interface FlowFact {
  label: string
  home: string
  away: string
}

/** The numbers under the chart, one line each, the home side and the away side. */
export function flowFacts(summary: FlowSummary): { shared: string[]; sides: FlowFact[] } {
  const share = (seconds: number): string =>
    `${clockText(seconds)} (${Math.round((100 * seconds) / summary.length)}%)`
  return {
    shared: [
      `${summary.leadChanges} lead ${summary.leadChanges === 1 ? 'change' : 'changes'}`,
      `tied ${summary.timesTied} ${summary.timesTied === 1 ? 'time' : 'times'}`,
      `level for ${share(summary.timeTied)}`
    ],
    sides: [
      {
        label: 'Largest lead',
        home: String(summary.home.largestLead),
        away: String(summary.away.largestLead)
      },
      {
        label: 'Time leading',
        home: share(summary.home.timeLeading),
        away: share(summary.away.timeLeading)
      },
      { label: 'Best run', home: `${summary.home.bestRun}-0`, away: `${summary.away.bestRun}-0` },
      {
        label: 'Longest without a point',
        home: clockText(summary.home.drought),
        away: clockText(summary.away.drought)
      },
      {
        label: 'Longest without a field goal',
        home: clockText(summary.home.droughtFg),
        away: clockText(summary.away.droughtFg)
      }
    ]
  }
}
