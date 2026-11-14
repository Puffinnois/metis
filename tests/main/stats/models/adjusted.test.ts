import { describe, expect, it } from 'vitest'
import {
  adjustedByDay,
  fitAdjusted,
  ratingOf,
  RIDGE_POSSESSIONS,
  type EfficiencyGame
} from '@main/stats/models/adjusted'

const game = (
  date: string,
  home: string,
  away: string,
  homePts: number,
  awayPts: number,
  poss = 100,
  neutral = false
): EfficiencyGame<string> => ({ date, home, away, homePts, awayPts, poss, neutral })

describe('adjusted ratings, solved by hand', () => {
  /**
   * One neutral game, 100 possessions, A 110, B 100. The prior keeps the effects summing to 0, so
   * A's offense is +a, B's −a, A's defense effect −a', B's +a'. The mean is 105 (both observations
   * share it), and each team equation reads 100·(5 − a − a') = λ·a with a = a' by symmetry, so
   * a = 500 / (λ + 200): A rates 105 + a on offense and 105 − a on defense.
   */
  it.each([
    [200, 1.25],
    [800, 0.5]
  ])('one game with a prior of %i possessions moves each side by %f', (lambda, a) => {
    const fit = fitAdjusted([game('2025-11-01', 'A', 'B', 110, 100, 100, true)], lambda)
    expect(fit.league).toBeCloseTo(105, 12)
    expect(fit.mean).toBeCloseTo(105, 12)
    expect(fit.home).toBe(0)
    const r = ratingOf(fit, 'A')!
    expect(r.ortg).toBeCloseTo(105 + a, 12)
    expect(r.drtg).toBeCloseTo(105 - a, 12)
    expect(r.net).toBeCloseTo(2 * a, 12)
    expect(ratingOf(fit, 'B')!.net).toBeCloseTo(-2 * a, 12)
    expect(r.poss).toBe(100)
  })
})

/** Every pair home and away, 100 possessions a game: scores chosen so no team is average. */
const ROUND_ROBIN: EfficiencyGame<string>[] = [
  game('2025-11-01', 'A', 'B', 112, 101),
  game('2025-11-01', 'C', 'D', 99, 104),
  game('2025-11-02', 'A', 'C', 108, 97),
  game('2025-11-02', 'B', 'D', 111, 110),
  game('2025-11-03', 'A', 'D', 115, 100),
  game('2025-11-03', 'B', 'C', 102, 106),
  game('2025-11-04', 'B', 'A', 100, 109),
  game('2025-11-04', 'D', 'C', 107, 98),
  game('2025-11-05', 'C', 'A', 101, 103),
  game('2025-11-05', 'D', 'B', 96, 105),
  game('2025-11-06', 'D', 'A', 99, 118),
  game('2025-11-06', 'C', 'B', 104, 104)
]

function plain(games: EfficiencyGame<string>[], team: string): { ortg: number; drtg: number } {
  let pts = 0
  let opp = 0
  let poss = 0
  for (const g of games) {
    if (g.home === team) [pts, opp, poss] = [pts + g.homePts, opp + g.awayPts, poss + g.poss]
    if (g.away === team) [pts, opp, poss] = [pts + g.awayPts, opp + g.homePts, poss + g.poss]
  }
  return { ortg: (100 * pts) / poss, drtg: (100 * opp) / poss }
}

describe('a balanced schedule with no prior', () => {
  it('gives the plain net ratings, times (T − 1) / T as SRS gives the margin', () => {
    // A team never plays itself, so its opponents average −(its own effect) / (T − 1), not 0: the same
    // factor makes SRS = MOV × (T − 1) / T over a round robin.
    const fit = fitAdjusted(ROUND_ROBIN, 0)
    const league =
      (100 * ROUND_ROBIN.reduce((s, g) => s + g.homePts + g.awayPts, 0)) /
      ROUND_ROBIN.reduce((s, g) => s + 2 * g.poss, 0)
    expect(fit.league).toBeCloseTo(league, 12)
    expect(fit.mean).toBeCloseTo(league, 12)
    let mean = 0
    for (const t of ['A', 'B', 'C', 'D']) {
      const p = plain(ROUND_ROBIN, t)
      const r = ratingOf(fit, t)!
      expect(r.net).toBeCloseTo(((p.ortg - p.drtg) * 3) / 4, 12)
      mean += r.ortg / 4
    }
    expect(mean).toBeCloseTo(league, 12)
  })
})

describe('a schedule of known strengths', () => {
  const OFF: Record<string, number> = { A: 4, B: 1.5, C: -0.5, D: -2, E: 0.25, F: -3.25 }
  const DEF: Record<string, number> = { A: -1, B: 2, C: -3, D: 0.5, E: 1.75, F: -0.25 }
  const MEAN = 110
  const HOME = 1.4
  const teams = Object.keys(OFF)
  // An uneven schedule: some pairs twice, some never, one neutral game, possessions varying.
  const pairs: Array<[string, string, boolean]> = []
  teams.forEach((h, i) =>
    teams.forEach((a, j) => {
      if (i !== j && (i + 2 * j) % 3 !== 0) pairs.push([h, a, false])
    })
  )
  pairs.push(['A', 'F', true], ['C', 'B', false])
  const games = pairs.map(([h, a, neutral], i) => {
    const poss = 92 + ((i * 7) % 15)
    const x = neutral ? 0 : 1
    return game(
      `2025-11-${String(1 + (i % 28)).padStart(2, '0')}`,
      h,
      a,
      ((MEAN + OFF[h] + DEF[a] + HOME * x) * poss) / 100,
      ((MEAN + OFF[a] + DEF[h] - HOME * x) * poss) / 100,
      poss,
      neutral
    )
  })

  it('recovers the effects and home court exactly with no prior', () => {
    const fit = fitAdjusted(games, 0)
    expect(fit.home).toBeCloseTo(HOME, 9)
    expect(fit.mean).toBeCloseTo(MEAN, 9)
    for (const t of teams) {
      expect(fit.off.get(t)!).toBeCloseTo(OFF[t], 9)
      expect(fit.def.get(t)!).toBeCloseTo(DEF[t], 9)
    }
    expect(ratingOf(fit, 'A')!.homeCourt).toBeCloseTo(2 * HOME, 9)
  })

  it('pulls the effects toward 0 with a prior, keeping each side summing to 0', () => {
    const exact = fitAdjusted(games, 0)
    const fit = fitAdjusted(games, RIDGE_POSSESSIONS)
    let off = 0
    let def = 0
    for (const t of teams) {
      off += fit.off.get(t)!
      def += fit.def.get(t)!
      expect(Math.abs(fit.off.get(t)!)).toBeLessThan(Math.abs(exact.off.get(t)!))
    }
    expect(off).toBeCloseTo(0, 9)
    expect(def).toBeCloseTo(0, 9)
  })
})

describe('as of every game day', () => {
  it('rates the teams that played each day on the games through that day', () => {
    const rows = adjustedByDay(ROUND_ROBIN, 300)
    expect(rows).toHaveLength(24)
    const day3 = rows.filter((r) => r.date === '2025-11-03')
    expect(day3.map((r) => r.team).sort()).toEqual(['A', 'B', 'C', 'D'])
    const through3 = fitAdjusted(
      ROUND_ROBIN.filter((g) => g.date <= '2025-11-03'),
      300
    )
    for (const r of day3) expect(r).toMatchObject({ ...ratingOf(through3, r.team)!, date: r.date })
    const last = rows.find((r) => r.date === '2025-11-06' && r.team === 'A')!
    expect(last.net).toBeCloseTo(ratingOf(fitAdjusted(ROUND_ROBIN, 300), 'A')!.net, 12)
  })

  it('skips a game with no possessions, and holds home court at 0 with only neutral games', () => {
    const rows = adjustedByDay(
      [game('2025-11-01', 'A', 'B', 0, 0, 0), game('2025-11-02', 'A', 'B', 110, 100, 100, true)],
      200
    )
    expect(rows.map((r) => r.date)).toEqual(['2025-11-02', '2025-11-02'])
    expect(rows[0].homeCourt).toBe(0)
    expect(rows.find((r) => r.team === 'A')!.net).toBeCloseTo(2.5, 12)
  })
})
