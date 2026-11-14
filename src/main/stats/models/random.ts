/**
 * A seeded random number generator, so a simulation run with the same seed gives the same numbers on
 * every machine and every refresh. Math.random cannot be seeded.
 */

/** Mulberry32: 32 bits of state, uniform on [0, 1), fast and good enough for a simulation. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seed from a few integers (a season, a date as a number), mixed so near values differ widely. */
export function seedOf(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193) >>> 0
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0
  }
  return h >>> 0
}

/** The standard normal's distribution function (Abramowitz and Stegun 7.1.26, error under 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

/** The standard normal's quantile (Acklam's rational approximation, relative error under 1.2e-9). */
export function normalQuantile(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.928510446969, 138.357751867269]
  const a4 = -30.66479806614716
  const a5 = 2.506628277459239
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972]
  const b4 = -13.28068155288572
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734]
  const c4 = 4.374664141464968
  const c5 = 2.938163982698783
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p < lo || p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(p < lo ? p : 1 - p))
    const x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c4) * q + c5) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    return p < lo ? x : -x
  }
  const q = p - 0.5
  const r = q * q
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a4) * r + a5) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b4) * r + 1)
  )
}

/**
 * A margin with this mean and spread, on the side the game's winner is already drawn on: the normal
 * cut at zero, by inverting its distribution function, then rounded to a whole point, at least one.
 * So the winner keeps exactly the Elo probability and the margin still centres on the Elo spread.
 */
export function sideMargin(mean: number, sd: number, won: boolean, u: number): number {
  // P(margin <= 0) under the normal; the drawn margin's quantile lies above it for a win, below for a loss.
  const zero = normalCdf(-mean / sd)
  const p = won ? zero + u * (1 - zero) : u * zero
  const clipped = Math.min(Math.max(p, 1e-12), 1 - 1e-12)
  const m = Math.round(mean + sd * normalQuantile(clipped))
  return won ? Math.max(1, m) : Math.min(-1, m)
}
