import type { MetricValue, MetricZ, StatsResult } from '@shared/stats/types'

/*
 * Z-scores (audit entry 420, Plan T1703.3): how many standard deviations a value is above or below the
 * mean of its pool, as a display mode beside the percentile. The pool is the percentile's own: a row in
 * it has a percentile, a row outside it none, so a z-score exists exactly where a percentile does. A
 * positive score is above the mean whichever way is better, and the shading still reads the percentile.
 */

/** A sample's standard deviation is read from at least this many rows. */
const FEWEST = 2

/** Nothing in a pool is spread, so nothing has a score: a guard against rounding in equal values. */
const spread = (sd: number, mean: number): boolean => sd > 1e-9 * Math.max(1, Math.abs(mean))

const key = (position: string | null, metric: string): string => `${position ?? ''}|${metric}`

/**
 * The result with each ranked value's z-score in its pool, as ranked: a row with a percentile is in the
 * pool of its position (players) and metric, and no other is. Where the engine's answer already carries
 * the scores (the colleges, whose boards fetch fewer rows than the pool has), it is left as it is.
 */
export function zScored(result: StatsResult): StatsResult {
  const pools = new Map<string, number[]>()
  for (const r of result.rows) {
    for (const [id, v] of Object.entries(r.values)) {
      if (v.percentile === null || v.value === null || v.z) continue
      const k = key(r.position, id)
      pools.set(k, [...(pools.get(k) ?? []), v.value])
    }
  }
  const stats = new Map<string, { mean: number; sd: number; n: number }>()
  for (const [k, xs] of pools) {
    if (xs.length < FEWEST) continue
    const mean = xs.reduce((a, x) => a + x, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1))
    stats.set(k, { mean, sd, n: xs.length })
  }
  const zOf = (v: MetricValue, k: string): MetricZ | undefined => {
    const s = stats.get(k)
    if (!s || v.percentile === null || v.value === null) return undefined
    return {
      score: spread(s.sd, s.mean) ? (v.value - s.mean) / s.sd : null,
      mean: s.mean,
      sd: s.sd,
      n: s.n
    }
  }
  return {
    ...result,
    rows: result.rows.map((r) => ({
      ...r,
      values: Object.fromEntries(
        Object.entries(r.values).map(([id, v]) => {
          const z = v.z ?? zOf(v, key(r.position, id))
          return [id, z ? { ...v, z } : v]
        })
      )
    }))
  }
}

/** A score as a board writes it: signed, two decimals, a real minus sign. */
export function fmtZ(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—'
  const r = Math.round(score * 100) / 100
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(2)}`
}

/** What a cell's hover says of its score: the pool's mean and spread, and who is in it. */
export function zTitle(z: MetricZ | undefined, among: string, fmt: (v: number) => string): string {
  if (!z) return 'No z-score: not among the rows its percentile is read against'
  if (z.score === null) return 'No z-score: every row of the pool reads the same'
  return `Z-score ${fmtZ(z.score)}: mean ${fmt(z.mean)}, standard deviation ${fmt(z.sd)}, among ${z.n.toLocaleString('en-US')} qualified ${among}`
}

/** What the Z-scores toggle says on hover: the pool, and which way is up. */
export const Z_SCORE_HELP =
  'Each value as its z-score: how many standard deviations it is above (+) or below (−) the mean of the rows its percentile is read among, the qualified rows of the same position (a team: every team). The shading is still the percentile, so a metric with no better side stays unshaded. Hover a value for its mean and standard deviation.'
