import { describe, expect, it } from 'vitest'
import {
  leagueIndex,
  MIN_PAIRS,
  pearson,
  priorOf,
  reliabilityOf,
  shrink,
  spearmanBrown,
  stabilityFrom,
  TOO_FEW_PAIRS,
  type StabilityRow
} from '@main/stats/models/stability'

/** A seeded generator, so the simulated players are the same on every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/**
 * 200 players over two seasons: a true rate each, seen through binomial noise of `sample` attempts a
 * half, two halves a season.
 */
function players(
  sd: number,
  sample: number,
  seed = 1
): { full: StabilityRow[]; halves: StabilityRow[] } {
  const random = rng(seed)
  const normal = (): number =>
    Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random())
  const full: StabilityRow[] = []
  const halves: StabilityRow[] = []
  for (let i = 0; i < 200; i++) {
    const p = Math.min(0.95, Math.max(0.05, 0.5 + sd * normal()))
    for (const season of [2025, 2026]) {
      const h = [0, 1].map(() => {
        let made = 0
        for (let k = 0; k < sample; k++) made += random() < p ? 1 : 0
        return made / sample
      })
      const id = `p${i}`
      full.push({ id, season, half: null, value: (h[0] + h[1]) / 2, sample: 2 * sample })
      h.forEach((value, half) => halves.push({ id, season, half, value, sample }))
    }
  }
  return { full, halves }
}

describe('the stability maths (Plan T1006)', () => {
  it('correlates by hand', () => {
    // Means 2.5 and 5; Σdxdy 11, Σdx² 5, Σdy² 26: r = 11 / √130.
    expect(pearson([1, 2, 3, 4], [2, 4, 5, 9])).toBeCloseTo(11 / Math.sqrt(130), 12)
    expect(pearson([1, 2, 3, 4], [2, 4, 5, 9])).toBeCloseTo(0.964764, 6)
    // No spread on one side, or a single pair: nothing to correlate.
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNaN()
    expect(pearson([1], [2])).toBeNaN()
  })

  it('steps a half up to a season by Spearman-Brown', () => {
    expect(spearmanBrown(0.5)).toBeCloseTo(2 / 3, 12)
    expect(spearmanBrown(0.8)).toBeCloseTo(1.6 / 1.8, 12)
    // A negative r is not stepped up.
    expect(spearmanBrown(-0.2)).toBe(-0.2)
  })

  it('finds the sample at which a rate is half signal', () => {
    // Halves of 100 attempts correlating 0.25: k = 100 × 0.75 / 0.25 = 300.
    expect(priorOf(0.25, 100)).toBeCloseTo(300, 12)
    expect(priorOf(0.8, 20)).toBeCloseTo(5, 12)
    expect([priorOf(0, 100), priorOf(-0.1, 100), priorOf(1, 100), priorOf(0.5, 0)]).toEqual([
      null,
      null,
      null,
      null
    ])
  })

  it('shrinks a rate toward the league by its prior', () => {
    // 18 of 20 free throws, prior 30, league 75 %: (20 × 0.9 + 30 × 0.75) / 50 = 0.81.
    expect(shrink(0.9, 20, 30, 0.75)).toBeCloseTo(0.81, 12)
    // A large sample keeps most of its own rate; none at all reads the league.
    expect(shrink(0.9, 3000, 30, 0.75)).toBeCloseTo((2700 + 22.5) / 3030, 12)
    expect(shrink(0.9, 0, 30, 0.75)).toBeCloseTo(0.75, 12)
  })

  it('indexes a rate against the league, mirrored where lower is better', () => {
    // TS 60 % against a league 55 %: 100 × 0.60 / 0.55.
    expect(leagueIndex(0.6, 0.55, false)).toBeCloseTo(109.0909, 4)
    expect(leagueIndex(0.55, 0.55, false)).toBeCloseTo(100, 12)
    // Turnovers on 15 % of plays against a league 12.5 %: 20 % worse reads 80.
    expect(leagueIndex(0.15, 0.125, true)).toBeCloseTo(80, 12)
    expect(leagueIndex(0.1, 0.125, true)).toBeCloseTo(120, 12)
    // No turnovers at all stays finite.
    expect(leagueIndex(0, 0.125, true)).toBe(200)
  })

  it('grades reliability from the year-to-year r', () => {
    expect([0.7, 0.6, 0.4, 0.35, 0.1, null].map(reliabilityOf)).toEqual([
      'high',
      'high',
      'medium',
      'medium',
      'low',
      null
    ])
  })

  it('finds a sticky rate sticky and a noisy one noisy', () => {
    const sticky = players(0.15, 100)
    const noisy = players(0.01, 20)
    const a = stabilityFrom(sticky.full, sticky.halves, true)
    const b = stabilityFrom(noisy.full, noisy.halves, true)
    expect(a).toMatchObject({ pairs: 200, halfPairs: 400, reliability: 'high', reason: null })
    expect(a.yearToYear!).toBeGreaterThan(0.75)
    expect(b.yearToYear!).toBeLessThan(0.2)
    expect(b.reliability).toBe('low')
    expect(a.splitHalf!).toBeGreaterThan(b.splitHalf!)
    expect([a.firstSeason, a.lastSeason]).toEqual([2025, 2026])
  })

  it('pairs only consecutive seasons of the same id, and reads the correlation of those pairs', () => {
    const rows: StabilityRow[] = []
    for (let i = 0; i < 60; i++) {
      rows.push({ id: `p${i}`, season: 2024, half: null, value: i, sample: 1 })
      rows.push({ id: `p${i}`, season: 2025, half: null, value: i + (i % 7), sample: 1 })
      // Two seasons apart is not a pair.
      rows.push({ id: `q${i}`, season: 2022, half: null, value: i, sample: 1 })
    }
    rows.push({ id: 'q0', season: 2024, half: null, value: 99, sample: 1 })
    const s = stabilityFrom(rows, null, false)
    const x = Array.from({ length: 60 }, (_, i) => i)
    expect(s.pairs).toBe(60)
    expect(s.yearToYear).toBeCloseTo(
      pearson(
        x,
        x.map((i) => i + (i % 7))
      ),
      12
    )
    // A count has no prior, and a metric with no halves no split-half figure.
    expect(s).toMatchObject({ splitHalf: null, prior: null, halfPairs: 0 })
  })

  it('sets the prior where half of a rate is signal', () => {
    // True spread 0.05 and binomial noise √(0.25 / n): half signal at n = 0.25 / 0.0025 = 100.
    const { full, halves } = players(0.05, 100, 3)
    const s = stabilityFrom(full, halves, true)
    expect(s.prior!).toBeGreaterThan(60)
    expect(s.prior!).toBeLessThan(160)
    expect(stabilityFrom(full, halves, false).prior).toBeNull()
  })

  it(`reports nothing under ${MIN_PAIRS} pairs, and says why`, () => {
    const { full, halves } = players(0.15, 100)
    const few = stabilityFrom(full.slice(0, 80), halves.slice(0, 80), true)
    expect(few).toMatchObject({
      yearToYear: null,
      pairs: 40,
      reliability: null,
      splitHalf: null,
      reason: TOO_FEW_PAIRS
    })
  })
})
