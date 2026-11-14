import { seasonLabel } from '@shared/stats/seasons'
import type { MetricInfo, MetricValue } from '@shared/stats/types'
import { fmtStat } from './format'

/**
 * A metric's stability as the screens show it (Plan T1006): the mark on a column head, its lines in
 * the head's card, and the Glossary's sort and filter. It rides with the catalogue, so none of this
 * costs a query.
 */

export type StabilityLevel = 'high' | 'medium' | 'low' | 'none'

export const STABILITY_LEVELS: StabilityLevel[] = ['high', 'medium', 'low', 'none']

export const STABILITY_WORDS: Record<StabilityLevel, string> = {
  high: 'High stability',
  medium: 'Medium stability',
  low: 'Low stability',
  none: 'Stability not measured'
}

/** The filled bars of the mark: three for high, none for not measured. */
export const STABILITY_BARS: Record<StabilityLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0
}

export function stabilityLevel(info: Pick<MetricInfo, 'stability'>): StabilityLevel {
  return info.stability?.reliability ?? 'none'
}

const count = (n: number): string => Math.round(n).toLocaleString('en-US')
const r2 = (r: number): string => fmtStat(r, { unit: 'number', decimals: 2 })

/** The prior in the metric's own unit: "187 field-goal attempts". */
export function priorWords(info: Pick<MetricInfo, 'stability' | 'sampleLabel'>): string | null {
  const k = info.stability?.prior
  if (k === null || k === undefined) return null
  return `${count(Math.max(1, k))} ${info.sampleLabel}`
}

/**
 * The card's lines, short: "Year to year 0.71 on 3,412 pairs", "Split half 0.88", "Prior 187
 * field-goal attempts", "Measured 1996-97 to 2025-26". A metric not measured says why.
 */
export function stabilityLines(info: Pick<MetricInfo, 'stability' | 'sampleLabel'>): string[] {
  const s = info.stability
  if (!s) return ['Not measured yet: a refresh measures it.']
  const lines: string[] = []
  if (s.yearToYear !== null) {
    lines.push(`Year to year ${r2(s.yearToYear)} on ${count(s.pairs)} pairs`)
  } else {
    lines.push(`Not measured: ${s.reason ?? 'no qualified seasons to pair.'}`)
  }
  if (s.splitHalf !== null) {
    lines.push(`Split half ${r2(s.splitHalf)} on ${count(s.halfPairs)} seasons`)
  }
  const prior = priorWords(info)
  if (prior) lines.push(`Prior ${prior}`)
  if (s.firstSeason !== null && s.lastSeason !== null && s.yearToYear !== null) {
    lines.push(`Measured ${seasonLabel(s.firstSeason)} to ${seasonLabel(s.lastSeason)}`)
  }
  return lines
}

/** The mark's own hover: the level, then the lines. */
export function stabilityTitle(info: Pick<MetricInfo, 'stability' | 'sampleLabel'>): string {
  return [STABILITY_WORDS[stabilityLevel(info)], ...stabilityLines(info)].join('\n')
}

/** Whether `shrunk` can pull this metric: a rate with a measured prior. */
export function shrinkable(info: Pick<MetricInfo, 'stability' | 'aggregation'>): boolean {
  return info.aggregation === 'ratio' && (info.stability?.prior ?? null) !== null
}

/** A shrunk cell's hover adds its own value before shrinking. */
export function rawLine(
  v: MetricValue,
  info: Pick<MetricInfo, 'unit' | 'decimals' | 'sampleLabel'>
): string | null {
  if (v.raw === null || v.raw === v.value) return null
  const on = v.sample !== null ? ` on ${count(v.sample)} ${info.sampleLabel}` : ''
  return `Raw ${fmtStat(v.raw, info)}${on}, shrunk toward the league`
}

/** The Glossary's order by stability: most stable first, not measured last, then by name. */
export function byStability(
  a: Pick<MetricInfo, 'stability' | 'label'>,
  b: Pick<MetricInfo, 'stability' | 'label'>
): number {
  const r = (m: Pick<MetricInfo, 'stability'>): number => m.stability?.yearToYear ?? -Infinity
  return r(b) - r(a) || a.label.localeCompare(b.label)
}

export type GlossaryOrder = 'name' | 'stability'

/** The Glossary's metrics: by stability level when one is picked, in the order asked. */
export function glossaryOrder<M extends Pick<MetricInfo, 'stability' | 'label'>>(
  metrics: readonly M[],
  level: StabilityLevel | '',
  order: GlossaryOrder
): M[] {
  return metrics
    .filter((m) => !level || stabilityLevel(m) === level)
    .sort(order === 'stability' ? byStability : (a, b) => a.label.localeCompare(b.label))
}
