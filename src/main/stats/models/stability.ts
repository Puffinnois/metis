import type { MetricStability } from '@shared/stats/types'

/**
 * Metric stability, shrinkage and league indexes (Plan T1006): the maths, with no database. The
 * builder (`metricStability.ts`) reads the rows through the engine; the engine shrinks and indexes in
 * SQL by the same formulas as `shrink` and `leagueIndex`, which the tests hold it to.
 */

/** Pairs a correlation needs to be reported: two seasons' worth of teams at least. */
export const MIN_PAIRS = 50
/** Reliability from the year-to-year r, the template's thresholds. */
export const RELIABILITY = { high: 0.6, medium: 0.35 } as const

export const reliabilityOf = (r: number | null): MetricStability['reliability'] =>
  r === null ? null : r >= RELIABILITY.high ? 'high' : r >= RELIABILITY.medium ? 'medium' : 'low'

/** Pearson's r; NaN with fewer than two values or no spread on either side. */
export function pearson(x: readonly number[], y: readonly number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return NaN
  let mx = 0
  let my = 0
  for (let i = 0; i < n; i++) {
    mx += x[i]
    my += y[i]
  }
  mx /= n
  my /= n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN
}

/** A half's correlation stepped up to a whole (Spearman-Brown); a negative r is left as it is. */
export const spearmanBrown = (r: number): number => (r > 0 ? (2 * r) / (1 + r) : r)

/**
 * The sample at which a rate is half signal: with halves of median sample n correlating r, each
 * half's true variance over its noise is r / (1 − r), so signal equals noise at n × (1 − r) / r.
 * Null for r ≤ 0 (no signal to find) or r ≥ 1.
 */
export function priorOf(r: number, n: number): number | null {
  if (!(r > 0 && r < 1) || !(n > 0)) return null
  return (n * (1 - r)) / r
}

/** A rate pulled toward the league by its prior: (sample × value + prior × league) / (sample + prior). */
export const shrink = (value: number, sample: number, prior: number, league: number): number =>
  (sample * value + prior * league) / (sample + prior)

/**
 * A rate against the league, 100 the league: 100 × rate / league, mirrored where lower is better,
 * 100 × (2 − rate / league), so above 100 is better and a rate of zero stays finite.
 */
export const leagueIndex = (value: number, league: number, lowerIsBetter: boolean): number =>
  100 * (lowerIsBetter ? 2 - value / league : value / league)

const median = (xs: readonly number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b)
  if (sorted.length === 0) return NaN
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** A qualified row of a metric: one player's (team's) season, or one half of it. */
export interface StabilityRow {
  id: string
  season: number
  /** 1 for the odd games, 0 for the even; null for a whole season. */
  half: number | null
  value: number
  /** The metric's sample. */
  sample: number
}

/** Why a measured metric reads no stability. */
export const TOO_FEW_PAIRS = `Fewer than ${MIN_PAIRS} pairs of qualified seasons.`
export const NO_SPREAD = 'No spread from one season to the next to correlate.'

/**
 * One metric's stability from its qualified rows. Year to year: each row against the same id's next
 * season, pooled across positions. Split half: odd against even games of the same season, stepped up
 * to a season; and for a rate (`rate`), the prior from the halves' raw r at their median sample.
 * `halves` is null when the metric cannot be read by game.
 */
export function stabilityFrom(
  full: readonly StabilityRow[],
  halves: readonly StabilityRow[] | null,
  rate: boolean
): MetricStability {
  const byKey = new Map(full.map((r) => [`${r.id}|${r.season}`, r]))
  const x: number[] = []
  const y: number[] = []
  let first = Infinity
  let last = -Infinity
  for (const r of full) {
    const next = byKey.get(`${r.id}|${r.season + 1}`)
    if (!next) continue
    x.push(r.value)
    y.push(next.value)
    first = Math.min(first, r.season)
    last = Math.max(last, next.season)
  }
  const r = x.length >= MIN_PAIRS ? pearson(x, y) : NaN
  const yearToYear = Number.isFinite(r) ? r : null

  let splitHalf: number | null = null
  let halfPairs = 0
  let prior: number | null = null
  if (halves) {
    const even = new Map(
      halves.filter((h) => h.half === 0).map((h) => [`${h.id}|${h.season}`, h] as const)
    )
    const hx: number[] = []
    const hy: number[] = []
    const n: number[] = []
    for (const h of halves) {
      if (h.half !== 1) continue
      const e = even.get(`${h.id}|${h.season}`)
      if (!e) continue
      hx.push(h.value)
      hy.push(e.value)
      n.push((h.sample + e.sample) / 2)
    }
    halfPairs = hx.length
    const hr = halfPairs >= MIN_PAIRS ? pearson(hx, hy) : NaN
    if (Number.isFinite(hr)) {
      splitHalf = spearmanBrown(hr)
      if (rate) prior = priorOf(hr, median(n))
    }
  }
  // The label is the year-to-year r's, so a metric without one says why, split halves or not.
  const reason = yearToYear !== null ? null : x.length < MIN_PAIRS ? TOO_FEW_PAIRS : NO_SPREAD
  return {
    yearToYear,
    pairs: x.length,
    splitHalf,
    halfPairs,
    prior,
    reliability: reliabilityOf(yearToYear),
    firstSeason: x.length > 0 ? first : null,
    lastSeason: x.length > 0 ? last : null,
    reason
  }
}

/** A metric that is not measured at all, with the reason. */
export const unmeasured = (reason: string): MetricStability => ({
  yearToYear: null,
  pairs: 0,
  splitHalf: null,
  halfPairs: 0,
  prior: null,
  reliability: null,
  firstSeason: null,
  lastSeason: null,
  reason
})
