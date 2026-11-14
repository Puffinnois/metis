import { describe, expect, it } from 'vitest'
import {
  brier,
  ELO,
  FIVETHIRTYEIGHT,
  eloShift,
  expectedMargin,
  logLoss,
  movMultiplier,
  regress,
  runSeason,
  seasonStart,
  winProbability,
  type EloGame
} from '@main/stats/models/elo'

const game = (
  o: Partial<EloGame<string>> & Pick<EloGame<string>, 'game_id' | 'home' | 'away'>
): EloGame<string> => ({ date: '2025-11-01', neutral: false, margin: null, ...o })

describe('Elo, as FiveThirtyEight publishes it for the NBA, home court and carry fitted', () => {
  it('turns a rating edge into a win probability and an expected margin', () => {
    expect(winProbability(0)).toBe(0.5)
    // 400 points: ten to one. Home court alone, 100 points: 64 %.
    expect(winProbability(400)).toBeCloseTo(10 / 11, 12)
    expect(winProbability(100)).toBeCloseTo(0.6400649998, 9)
    expect(winProbability(-75) + winProbability(75)).toBeCloseTo(1, 12)
    // 28 Elo points a point: home court is worth 3.6 points.
    expect(expectedMargin(100)).toBeCloseTo(100 / 28, 12)
  })

  it('moves one game by hand: equal teams, the home side wins by 10', () => {
    // Edge 100 (home court), p = 1 / (1 + 10^-0.25) = 0.640065.
    // Multiplier (10 + 3)^0.8 / (7.5 + 0.006 × 100) = 7.78314 / 8.1 = 0.960881.
    // Shift 20 × 0.960881 × (1 − 0.640065) = 6.917095.
    expect(movMultiplier(10, 100)).toBeCloseTo(0.9608811262, 9)
    expect(eloShift(100, 10)).toBeCloseTo(6.9170949668, 9)
    // The same teams, the away side wins by 5: the winner's edge is −100, so the multiplier grows.
    // (5 + 3)^0.8 / (7.5 − 0.6) = 0.764932; 20 × 0.764932 × (0 − 0.640065) = −9.792126.
    expect(eloShift(100, -5)).toBeCloseTo(-9.7921255727, 9)
    // A favourite's win counts less than an underdog's by the same margin.
    expect(movMultiplier(10, 200)).toBeLessThan(movMultiplier(10, -200))
  })

  it('applies no home court at a neutral site', () => {
    const { rows } = runSeason(
      [game({ game_id: 'v', home: 'MIL', away: 'OKC', neutral: true, margin: 10 })],
      new Map([
        ['MIL', 1500],
        ['OKC', 1500]
      ])
    )
    expect(rows[0].homeCourt).toBe(0)
    expect(rows[0].homeWin).toBe(0.5)
    expect(rows[0].homeMargin).toBe(0)
    // (13)^0.8 / 7.5 × 20 × 0.5 = 10.377516.
    expect(rows[0].homePost).toBeCloseTo(1510.3775161627, 9)
    expect(rows[0].awayPost).toBeCloseTo(1489.6224838373, 9)
  })

  it('runs the played games in date order, then rates the games to come with the latest ratings', () => {
    const { rows, ratings } = runSeason(
      [
        game({ game_id: 'z', date: '2025-11-01', home: 'B', away: 'A' }),
        game({ game_id: 'b', date: '2025-11-03', home: 'B', away: 'A', margin: 3 }),
        game({ game_id: 'a', date: '2025-11-02', home: 'A', away: 'B', margin: 10 })
      ],
      new Map([
        ['A', 1500],
        ['B', 1500]
      ]),
      FIVETHIRTYEIGHT
    )
    expect(rows.map((r) => r.game_id)).toEqual(['a', 'b', 'z'])
    const [a, b, z] = rows
    expect(a.homePost).toBeCloseTo(1506.9170949668, 9)
    // B at home: edge 1493.08 + 100 − 1506.92 = 86.17, p 0.621521; B by 3 gains 3.958958.
    expect(b.homePre).toBeCloseTo(1493.0829050332, 9)
    expect(b.homeWin).toBeCloseTo(0.6215212738, 9)
    expect(b.homePost).toBeCloseTo(1497.0418627575, 9)
    expect(b.awayPost).toBeCloseTo(1502.9581372425, 9)
    // The postponed game listed on Nov 1 is still to come, rated with the ratings after Nov 3.
    expect(z.played).toBe(false)
    expect(z.homePost).toBeNull()
    expect(z.homePre).toBeCloseTo(1497.0418627575, 9)
    expect(z.homeWin).toBeCloseTo(winProbability(1497.0418627575 + 100 - 1502.9581372425), 12)
    // A game moves no points in or out: the ratings still sum to 3000.
    expect(ratings.get('A')! + ratings.get('B')!).toBeCloseTo(3000, 9)
  })

  it('applies home court of 80 unless told otherwise', () => {
    const { rows } = runSeason(
      [game({ game_id: 'h', home: 'A', away: 'B', margin: 1 })],
      new Map([
        ['A', 1500],
        ['B', 1500]
      ])
    )
    expect(rows[0].homeCourt).toBe(80)
    expect(rows[0].homeWin).toBeCloseTo(winProbability(80), 12)
  })

  it('enters a new franchise at 1300', () => {
    const { rows } = runSeason(
      [game({ game_id: 'x', home: 'TOR', away: 'NYK', margin: -12 })],
      new Map([['NYK', 1600]]),
      FIVETHIRTYEIGHT
    )
    expect(rows[0].homePre).toBe(ELO.newTeam)
    expect(rows[0].homeWin).toBeCloseTo(winProbability(1300 + 100 - 1600), 12)
  })

  it('carries a season: 35 % of the way back to 1505, a moved franchise keeps its rating', () => {
    expect(regress(1600)).toBeCloseTo(1566.75, 12)
    // FiveThirtyEight's: a quarter of the way.
    expect(regress(1600, FIVETHIRTYEIGHT.carry)).toBe(1576.25)
    expect(regress(1400)).toBeCloseTo(1436.75, 12)
    expect(regress(ELO.mean)).toBe(ELO.mean)
    // Charlotte's Hornets moved to New Orleans in 2002 under a new id: the one team gone and the one
    // team new are linked. Toronto arrives with nobody gone: it enters at 1300.
    const last = new Map([
      ['CHH', 1560],
      ['BOS', 1450]
    ])
    expect(seasonStart(last, ['NOH', 'BOS'])).toEqual(
      new Map([
        ['BOS', 1469.25],
        ['NOH', 1540.75]
      ])
    )
    expect(seasonStart(last, ['CHH', 'BOS', 'TOR'])).toEqual(
      new Map([
        ['CHH', 1540.75],
        ['BOS', 1469.25]
      ])
    )
    // Two teams new and one gone cannot be told apart: both enter as new.
    expect(seasonStart(new Map([['SEA', 1500]]), ['OKC', 'NOK']).size).toBe(0)
  })

  it('scores probabilities by the Brier score and the log loss', () => {
    const pairs = [
      { p: 0.5, won: true },
      { p: 0.8, won: false }
    ]
    expect(brier(pairs)).toBeCloseTo((0.25 + 0.64) / 2, 12)
    expect(logLoss(pairs)).toBeCloseTo(-(Math.log(0.5) + Math.log(0.2)) / 2, 12)
    expect(brier([])).toBeNaN()
  })
})
