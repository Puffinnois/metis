import { describe, expect, it } from 'vitest'
import {
  simulateSeason,
  type EloModel,
  type GameLeft,
  type PlayedGame
} from '@main/stats/models/simulate'
import { makeLeague, rulesOf } from '@main/stats/models/standings'

// A league of thirty: teams 0 to 14 in the East, 15 to 29 in the West, divisions of five.
const league = makeLeague(
  Array.from({ length: 30 }, (_, t) => ({
    id: t,
    conference: t < 15 ? 'east' : 'west',
    division: `d${Math.floor(t / 5)}`
  }))
)

// The usual logistic Elo with 538's margin multiplier left out: enough to test the simulation.
const elo: EloModel = {
  homeCourt: 80,
  winProbability: (d) => 1 / (1 + Math.pow(10, -d / 400)),
  shift: (d, m) => 20 * ((m > 0 ? 1 : 0) - 1 / (1 + Math.pow(10, -d / 400))),
  perPoint: 28,
  marginSd: 12
}

// Every pair once, the lower index at home and winning by five: team 0 best, 29-0 against the rest.
const played: PlayedGame[] = []
for (let a = 0; a < 30; a++)
  for (let b = a + 1; b < 30; b++) played.push({ home: a, away: b, margin: 5 })
const flat = new Float64Array(30).fill(1500)

describe('simulateSeason', () => {
  it('reads a finished season as certain', () => {
    const f = simulateSeason({
      league,
      rules: rulesOf(2024),
      played,
      left: [],
      ratings: flat,
      elo,
      runs: 50,
      seed: 1
    })
    expect(f[0].wins).toBe(29)
    expect(f[29].losses).toBe(29)
    // The East's first six by record are teams 0 to 5; 6 to 9 play in; 10 to 14 are out.
    expect(f.slice(0, 6).every((x) => x.top6 === 1 && x.playoffs === 1)).toBe(true)
    expect(f.slice(6, 10).every((x) => x.playIn === 1)).toBe(true)
    expect(f.slice(10, 15).every((x) => x.playoffs === 0 && x.playIn === 0)).toBe(true)
    expect(f[0].seed).toBe(1)
    expect(f[14].seed).toBe(15)
  })

  it('adds up across the league in every run', () => {
    const left: GameLeft[] = []
    for (let a = 0; a < 30; a++)
      for (let b = a + 1; b < 30; b++) left.push({ home: b, away: a, neutral: false })
    const ratings = Float64Array.from({ length: 30 }, (_, t) => 1600 - 7 * t)
    const f = simulateSeason({
      league,
      rules: rulesOf(2024),
      played,
      left,
      ratings,
      elo,
      runs: 400,
      seed: 2
    })
    const total = (k: keyof (typeof f)[0]): number => f.reduce((s, x) => s + x[k], 0)
    expect(total('playoffs')).toBeCloseTo(16, 9)
    expect(total('top6')).toBeCloseTo(12, 9)
    expect(total('playIn')).toBeCloseTo(8, 9)
    expect(total('round2')).toBeCloseTo(8, 9)
    expect(total('conferenceFinals')).toBeCloseTo(4, 9)
    expect(total('finals')).toBeCloseTo(2, 9)
    expect(total('title')).toBeCloseTo(1, 9)
    expect(total('wins')).toBeCloseTo(total('losses'), 9)
    expect(total('wins')).toBeCloseTo(870, 9)
    // The best-rated team wins far more titles than the worst-rated (400 runs: not an exact order).
    expect(f[0].title).toBeGreaterThan(f[29].title + 0.05)
  })

  it('is reproducible from its seed', () => {
    const left: GameLeft[] = [{ home: 14, away: 13, neutral: false }]
    const input = {
      league,
      rules: rulesOf(2024),
      played,
      left,
      ratings: flat,
      elo,
      runs: 300,
      seed: 9
    }
    expect(simulateSeason(input)).toEqual(simulateSeason(input))
    expect(simulateSeason({ ...input, seed: 10 })).not.toEqual(simulateSeason(input))
  })

  it('wins a game with its Elo probability', () => {
    // One game left between two equal teams at a neutral site: each wins it half the time.
    const left: GameLeft[] = [{ home: 20, away: 21, neutral: true }]
    const f = simulateSeason({
      league,
      rules: rulesOf(2024),
      played,
      left,
      ratings: flat,
      elo,
      runs: 4000,
      seed: 3
    })
    expect(f[20].wins - 9).toBeCloseTo(0.5, 1)
    // With home court (80 points), the home side wins 61.3 % of the time.
    const home = simulateSeason({
      league,
      rules: rulesOf(2024),
      played,
      left: [{ home: 20, away: 21, neutral: false }],
      ratings: flat,
      elo,
      runs: 4000,
      seed: 3
    })
    expect(home[20].wins - 9).toBeCloseTo(elo.winProbability(80), 1)
  })

  it('counts games against an opponent not named yet in the record only', () => {
    const unnamed = new Array<number>(30).fill(0)
    unnamed[29] = 2
    const f = simulateSeason({
      league,
      rules: rulesOf(2024),
      played,
      left: [],
      unnamed,
      ratings: flat,
      elo,
      runs: 200,
      seed: 4
    })
    expect(f[29].wins + f[29].losses).toBeCloseTo(31, 9)
    expect(f[28].wins + f[28].losses).toBeCloseTo(29, 9)
  })

  it('plays no play-in before 2019-20', () => {
    const f = simulateSeason({
      league,
      rules: rulesOf(2010),
      played,
      left: [],
      ratings: flat,
      elo,
      runs: 20,
      seed: 5
    })
    expect(f.reduce((s, x) => s + x.playIn + x.top6, 0)).toBe(0)
    // 2009-10's rules: the division winners 0, 5 and 10 and the best other, 1, take the top four,
    // so 10 (fifth-worst by record in the East) is in and 7 is out.
    expect(f.slice(0, 15).map((x) => x.playoffs)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0
    ])
    expect(f[10].seed).toBe(4)
  })
})
