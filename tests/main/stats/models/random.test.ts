import { describe, expect, it } from 'vitest'
import { normalCdf, normalQuantile, rng, seedOf, sideMargin } from '@main/stats/models/random'

describe('rng', () => {
  it('repeats for a seed and differs between seeds', () => {
    const a = rng(42)
    const b = rng(42)
    const xs = Array.from({ length: 5 }, a)
    expect(Array.from({ length: 5 }, b)).toEqual(xs)
    expect(rng(43)()).not.toBe(xs[0])
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })

  it('is uniform enough: mean 1/2, variance 1/12 over 100,000 draws', () => {
    const r = rng(1)
    let s = 0
    let s2 = 0
    const n = 100_000
    for (let i = 0; i < n; i++) {
      const x = r()
      s += x
      s2 += x * x
    }
    expect(s / n).toBeCloseTo(0.5, 2)
    expect(s2 / n - (s / n) ** 2).toBeCloseTo(1 / 12, 3)
  })

  it('mixes seeds', () => {
    expect(seedOf(2026, 1)).not.toBe(seedOf(2026, 2))
    expect(seedOf(2026, 1)).toBe(seedOf(2026, 1))
  })
})

describe('the normal distribution', () => {
  it('has the textbook values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7)
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6)
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5)
    expect(normalQuantile(0.01)).toBeCloseTo(-2.326348, 5)
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9)
  })
})

describe('sideMargin', () => {
  it('lands on the winner’s side, at least a point', () => {
    for (const u of [0, 0.3, 0.999]) {
      expect(sideMargin(5, 12, true, u)).toBeGreaterThanOrEqual(1)
      expect(sideMargin(5, 12, false, u)).toBeLessThanOrEqual(-1)
    }
  })

  it('keeps the expected margin when the side is drawn with the normal’s own probability', () => {
    // mean 6, sd 12: the win's probability under the normal is Φ(0.5).
    const r = rng(3)
    const p = normalCdf(0.5)
    let s = 0
    const n = 200_000
    for (let i = 0; i < n; i++) s += sideMargin(6, 12, r() < p, r())
    expect(s / n).toBeCloseTo(6, 1)
  })
})
