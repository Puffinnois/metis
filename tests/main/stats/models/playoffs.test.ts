import { describe, expect, it } from 'vitest'
import {
  homeCourt,
  PATTERNS,
  playBracket,
  playIn,
  playSeries,
  type PlayGame
} from '@main/stats/models/playoffs'
import { rng } from '@main/stats/models/random'
import { makeLeague, Records, rulesOf, TieBreaker } from '@main/stats/models/standings'

/** A game log: who hosted whom, in order. */
function logged(play: PlayGame): { play: PlayGame; games: [number, number][] } {
  const games: [number, number][] = []
  return {
    games,
    play: (h, a, n) => {
      games.push([h, a])
      return play(h, a, n)
    }
  }
}

describe('playSeries', () => {
  // The home side always wins: the series goes the distance and the side with more home games wins.
  const home: PlayGame = () => true

  it('plays 2-2-1-1-1 to seven games', () => {
    const { play, games } = logged(home)
    expect(playSeries(1, 2, PATTERNS['2-2-1-1-1'], false, play)).toBe(1)
    expect(games.map(([h]) => h)).toEqual([1, 1, 2, 2, 1, 2, 1])
  })

  it('plays the Finals 2-3-2', () => {
    const { play, games } = logged(home)
    expect(playSeries(1, 2, PATTERNS['2-3-2'], false, play)).toBe(1)
    expect(games.map(([h]) => h)).toEqual([1, 1, 2, 2, 2, 1, 1])
  })

  it('plays a best-of-five first round 2-2-1', () => {
    const { play, games } = logged(home)
    expect(playSeries(1, 2, PATTERNS['2-2-1'], false, play)).toBe(1)
    expect(games).toHaveLength(5)
  })

  it('stops at four wins', () => {
    // Team 2 wins every game, home or away: a sweep by the side without home court.
    const { play, games } = logged((h) => h === 2)
    expect(playSeries(1, 2, PATTERNS['2-2-1-1-1'], false, play)).toBe(2)
    expect(games).toHaveLength(4)
    // The home side wins: 1 hosts games 1, 2, 5 and 7, 2 hosts 3, 4 and 6, so 1 wins in seven.
    const { play: split, games: seven } = logged(() => true)
    expect(playSeries(1, 2, PATTERNS['2-2-1-1-1'], false, split)).toBe(1)
    expect(seven).toHaveLength(7)
  })
})

describe('playIn', () => {
  const order = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

  it('plays seventh to tenth for the last two seeds from 2020-21', () => {
    // Eighth wins at seventh; tenth wins at ninth; seventh then beats tenth at home.
    const winners = new Set(['16-17:17', '18-19:19', '16-19:16'])
    const { play, games } = logged((h, a) => winners.has(`${h}-${a}:${h}`))
    const result = playIn(order, rulesOf(2024), new Records(30), play)
    expect(games).toEqual([
      [16, 17],
      [18, 19],
      [16, 19]
    ])
    expect(result.bracket).toEqual([10, 11, 12, 13, 14, 15, 17, 16])
    expect(result.played).toEqual([16, 17, 18, 19])
    expect(result.out).toEqual([19, 18])
  })

  it('makes the ninth beat the eighth twice in 2019-20, when within four games', () => {
    const rec = new Records(30)
    for (let k = 0; k < 4; k++) rec.addExtra(17, 1)
    // Eighth 4-0, ninth 0-0: four games behind, so they play.
    const { play, games } = logged((h) => h !== 17)
    const result = playIn(order, rulesOf(2020), rec, play)
    expect(games).toHaveLength(2)
    expect(result.bracket[7]).toBe(18)
    // Five games behind: no play-in.
    rec.addExtra(17, 1)
    rec.addExtra(17, 1)
    rec.addExtra(18, -1)
    rec.addExtra(18, -1)
    rec.addExtra(18, -1)
    rec.addExtra(18, -1)
    expect(playIn(order, rulesOf(2020), rec, () => false).bracket[7]).toBe(17)
  })

  it('takes the first eight before 2019-20', () => {
    expect(playIn(order, rulesOf(2010), new Records(30), () => true).bracket).toEqual(
      order.slice(0, 8)
    )
  })
})

describe('playBracket', () => {
  // Sixteen teams, team 0 best: each team's record falls with its index, and the better team wins.
  const league = makeLeague(
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      conference: i < 8 ? 'east' : 'west',
      division: i < 8 ? 'a' : 'p'
    }))
  )
  const rec = new Records(16)
  for (let t = 0; t < 16; t++) for (let k = 0; k < 16 - t; k++) rec.addExtra(t, 1)
  const tb = new TieBreaker(league, rec, rng(1), 8)
  const better: PlayGame = (h, a) => h < a

  it('pairs one with eight, four with five, three with six, two with seven, and plays to the title', () => {
    const reached = new Map<number, number>()
    const { play, games } = logged(better)
    const champion = playBracket(
      [
        [0, 1, 2, 3, 4, 5, 6, 7],
        [8, 9, 10, 11, 12, 13, 14, 15]
      ],
      rulesOf(2024),
      tb,
      play,
      (team, round) => reached.set(team, Math.max(reached.get(team) ?? 0, round))
    )
    expect(champion).toBe(0)
    expect(games.slice(0, 4).map(([h, a]) => [h, a].sort((x, y) => x - y))).toEqual([
      [0, 7],
      [0, 7],
      [0, 7],
      [0, 7]
    ])
    expect(Object.fromEntries(reached)).toEqual({
      0: 4,
      1: 2,
      2: 1,
      3: 1,
      8: 3,
      9: 2,
      10: 1,
      11: 1
    })
  })

  it('gives home court by seed before 2004-05 and by record after', () => {
    // A fourth seed with a worse record than the fifth.
    const r = new Records(16)
    r.addExtra(3, 1)
    r.addExtra(3, -1)
    r.addExtra(4, 1)
    r.addExtra(4, 1)
    const t = new TieBreaker(league, r, rng(1), 8)
    const four = { team: 3, seed: 4 }
    const five = { team: 4, seed: 5 }
    expect(homeCourt(four, five, false, rulesOf(2003), t)[0].team).toBe(3)
    expect(homeCourt(four, five, false, rulesOf(2010), t)[0].team).toBe(4)
    expect(homeCourt(four, five, true, rulesOf(2003), t)[0].team).toBe(4)
  })
})
