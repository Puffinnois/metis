import { COURT, SHOT_CHART_LIMIT, SHOT_CHART_MIN, SHOT_ZONES } from '@shared/stats/shots'
import type { Entity, StatsShot, StatsShotChart, StatsShotRequest } from '@shared/stats/types'
import { queryScope, type StatsScope } from './scope'

/**
 * The shot chart's maths: a half court drawn to scale in the NBA's frame, the zones as shapes, and
 * the shading of each zone against the league. Coordinates are the NBA's, tenths of a foot from the
 * basket; the drawing puts the basket at the top, the half-court line at the bottom, and the shooter's
 * left (the NBA's negative x) on the left, as the NBA draws it.
 */

/** The drawing's frame: the half court, 50 by 47 feet, in tenths of a foot. */
export const VIEW = {
  width: COURT.halfWidth * 2,
  height: COURT.halfCourtY - COURT.baselineY
} as const

/** A court point in the drawing. */
export function toView(x: number, y: number): { cx: number; cy: number } {
  return { cx: x + COURT.halfWidth, cy: y - COURT.baselineY }
}

/** Whether a shot is drawn: beyond half court, or off the court, it is counted but not drawn. */
export const onChart = (s: Pick<StatsShot, 'x' | 'y'>): boolean =>
  Math.abs(s.x) <= COURT.halfWidth && s.y >= COURT.baselineY && s.y <= COURT.halfCourtY

const n = (v: number): string => `${Math.round(v * 100) / 100}`
const pt = (x: number, y: number): string => {
  const { cx, cy } = toView(x, y)
  return `${n(cx)} ${n(cy)}`
}

/** Where the three-point arc meets the corner lines: 89.5 tenths above the basket. */
export const ARC_Y = Math.sqrt(COURT.arcRadius ** 2 - COURT.cornerX ** 2)

/** The inside of the three-point line, as a closed path from the baseline round the arc. */
function insideArc(): string {
  const { cornerX: cx, arcRadius: r, baselineY: base } = COURT
  return `M ${pt(-cx, base)} L ${pt(-cx, ARC_Y)} A ${r} ${r} 0 0 0 ${pt(cx, ARC_Y)} L ${pt(cx, base)} Z`
}

const rect = (x0: number, y0: number, x1: number, y1: number): string =>
  `M ${pt(x0, y0)} L ${pt(x1, y0)} L ${pt(x1, y1)} L ${pt(x0, y1)} Z`

const circle = (x: number, y: number, r: number): string =>
  `M ${pt(x - r, y)} A ${r} ${r} 0 1 0 ${pt(x + r, y)} A ${r} ${r} 0 1 0 ${pt(x - r, y)} Z`

/**
 * Each zone's shape, filled with the even-odd rule where it has a hole. The corners end where the
 * zone rule ends them (14 feet from the baseline), so a sliver above the arc's end reads as the
 * corner, as the rule counts it.
 */
export function zonePaths(): Record<string, string> {
  const { halfWidth: w, baselineY: base, halfCourtY: half, cornerX, cornerTopY } = COURT
  const lane = rect(-COURT.laneHalfWidth, base, COURT.laneHalfWidth, COURT.laneTopY)
  const ra = circle(0, 0, COURT.restrictedRadius)
  return {
    ra,
    paint: `${lane} ${ra}`,
    mid: `${insideArc()} ${lane}`,
    c3l: rect(-w, base, -cornerX, cornerTopY),
    c3r: rect(cornerX, base, w, cornerTopY),
    atb3: `${rect(-w, cornerTopY, w, half)} ${insideArcAbove(cornerTopY)}`
  }
}

/** The part of the inside of the arc above a line, to cut out of the area above the break. */
function insideArcAbove(y: number): string {
  const r = COURT.arcRadius
  const x = Math.sqrt(r * r - y * y)
  return `M ${pt(-x, y)} A ${r} ${r} 0 0 0 ${pt(x, y)} Z`
}

/** Where a zone's figures are written. */
export const ZONE_LABELS: Record<string, { x: number; y: number }> = {
  ra: { x: 0, y: 12 },
  paint: { x: 0, y: 95 },
  mid: { x: 0, y: 185 },
  c3l: { x: -235, y: 30 },
  c3r: { x: 235, y: 30 },
  atb3: { x: 0, y: 300 }
}

/** The court's lines, as SVG paths in the drawing's frame. */
export function courtLines(): string[] {
  const { halfWidth: w, baselineY: base, halfCourtY: half, cornerX } = COURT
  const ft = COURT.freeThrowRadius
  const top = COURT.laneTopY
  const ra = COURT.restrictedRadius
  return [
    rect(-w, base, w, half),
    rect(-COURT.laneHalfWidth, base, COURT.laneHalfWidth, top),
    // The free-throw circle's top half, away from the basket.
    `M ${pt(-ft, top)} A ${ft} ${ft} 0 0 0 ${pt(ft, top)}`,
    `M ${pt(-ra, 0)} A ${ra} ${ra} 0 0 0 ${pt(ra, 0)}`,
    `M ${pt(-cornerX, base)} L ${pt(-cornerX, ARC_Y)} A ${COURT.arcRadius} ${COURT.arcRadius} 0 0 0 ${pt(cornerX, ARC_Y)} L ${pt(cornerX, base)}`,
    `M ${pt(-COURT.backboardHalfWidth, COURT.backboardY)} L ${pt(COURT.backboardHalfWidth, COURT.backboardY)}`,
    circle(0, 0, COURT.rimRadius),
    // The centre circle's half on this side of the court.
    `M ${pt(-60, half)} A 60 60 0 0 1 ${pt(60, half)}`
  ]
}

/** How far a zone's FG% sits from what the league's rate would give, as a step of the heat scale. */
export type ShadeLevel = -3 | -2 | -1 | 0 | 1 | 2 | 3

/** Points of FG% for each step: within 2 points is level. */
const STEPS = [2, 5, 9]

/** Attempts a zone needs before it is shaded at all; fewer reads plain. */
export const ZONE_MIN = 5

export interface ZoneShade {
  zone: string
  label: string
  fga: number
  fgm: number
  pct: number | null
  /** FG% above what the league's regular-season rate would give these attempts, as a fraction. */
  rel: number | null
  level: ShadeLevel | null
}

export function shadeLevel(rel: number | null): ShadeLevel | null {
  if (rel === null || !Number.isFinite(rel)) return null
  const points = Math.abs(rel * 100)
  const step = STEPS.filter((s) => points >= s).length as 0 | 1 | 2 | 3
  return (rel < 0 ? -step : step) as ShadeLevel
}

/** Each drawn zone with its figures and its shade. */
export function zoneShades(chart: StatsShotChart): ZoneShade[] {
  return SHOT_ZONES.filter((z) => z.key in ZONE_LABELS).map((z) => {
    const row = chart.zones.find((r) => r.zone === z.key)
    const fga = row?.fga ?? 0
    const fgm = row?.fgm ?? 0
    const rel = row && fga >= ZONE_MIN && row.expected !== null ? (fgm - row.expected) / fga : null
    return {
      zone: z.key,
      label: z.label,
      fga,
      fgm,
      pct: fga > 0 ? fgm / fga : null,
      rel,
      level: shadeLevel(rel)
    }
  })
}

/** The heat colour of a level: the app's scale, warm above the league, cool below. */
export function shadeFill(level: ShadeLevel | null): string {
  if (level === null || level === 0) return 'var(--panel-2)'
  return `var(--${level > 0 ? 'h' : 'l'}${Math.abs(level)})`
}

const COUNT = new Intl.NumberFormat('en-US')
const PCT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const pctText = (v: number | null): string => (v === null ? '—' : `${PCT.format(v * 100)}%`)

export function relText(v: number | null): string {
  if (v === null) return '—'
  const p = v * 100
  return `${p >= 0 ? '+' : '−'}${PCT.format(Math.abs(p))}`
}

/** The line above the chart: how many shots, how many made, and what is not drawn. */
export function chartSummary(chart: StatsShotChart): string {
  const parts = [
    `${COUNT.format(chart.total)} ${chart.total === 1 ? 'attempt' : 'attempts'}`,
    `${COUNT.format(chart.made)} made (${pctText(chart.total > 0 ? chart.made / chart.total : null)})`
  ]
  if (chart.capped) parts.push(`the newest ${COUNT.format(SHOT_CHART_LIMIT)} drawn`)
  const off = chart.shots.filter((s) => !onChart(s)).length
  if (off > 0) parts.push(`${COUNT.format(off)} from beyond half court not drawn`)
  return parts.join(' · ')
}

/** Why the chart is not drawn, or null when it is. */
export function chartGap(chart: StatsShotChart): string | null {
  if (chart.reason) return chart.reason
  if (chart.total === 0) return 'No shots in these games.'
  if (chart.total < SHOT_CHART_MIN) {
    return `Too few shots to chart: ${chart.total} in these games, ${SHOT_CHART_MIN} needed.`
  }
  return null
}

/** The read a dashboard asks for: its season, season types and range. */
export function shotRequest(
  entity: Entity,
  id: string,
  scope: StatsScope,
  side: 'offense' | 'defense' = 'offense'
): StatsShotRequest {
  const q = queryScope(scope, entity)
  return {
    entity,
    id,
    seasons: q.seasons,
    scope: {
      gameTypes: q.gameTypes ?? ['regular'],
      ...(q.dates ? { dates: q.dates } : {}),
      ...(q.lastN !== undefined ? { lastN: q.lastN } : {}),
      ...(q.lastNOf ? { lastNOf: q.lastNOf } : {})
    },
    ...(entity === 'team' ? { side } : {})
  }
}
