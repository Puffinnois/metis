import { describe, expect, it } from 'vitest'
import { rng } from '@main/stats/models/random'
import {
  gamesBehind,
  makeLeague,
  Records,
  rulesOf,
  seedConferences,
  TieBreaker,
  type League,
  type SeasonRules
} from '@main/stats/models/standings'

/**
 * A small league: in the East A and B (division a) and C and D (division c), and J, a third team of
 * division a used by one case; in the West four teams that only fill records. Indexes in this order.
 */
const NAMES = ['A', 'B', 'C', 'D', 'J', 'E', 'F', 'G', 'H'] as const
type Name = (typeof NAMES)[number]
const I = Object.fromEntries(NAMES.map((n, i) => [n, i])) as Record<Name, number>
const LEAGUE: League = makeLeague([
  { id: 1, conference: 'east', division: 'a' },
  { id: 2, conference: 'east', division: 'a' },
  { id: 3, conference: 'east', division: 'c' },
  { id: 4, conference: 'east', division: 'c' },
  { id: 5, conference: 'east', division: 'a' },
  { id: 6, conference: 'west', division: 'p' },
  { id: 7, conference: 'west', division: 'p' },
  { id: 8, conference: 'west', division: 's' },
  { id: 9, conference: 'west', division: 's' }
])

/** Records from games written `winner loser` (the winner at home, by ten), repeated `n` times. */
function records(games: [Name, Name, number?][]): Records {
  const rec = new Records(NAMES.length)
  for (const [w, l, n = 1] of games) for (let k = 0; k < n; k++) rec.add(I[w], I[l], 10)
  return rec
}

const names = (teams: number[]): string[] => teams.map((t) => NAMES[t])
const rules = (over: Partial<SeasonRules>): SeasonRules => ({ ...rulesOf(2024), ...over })

describe('rulesOf', () => {
  it('sets each era', () => {
    expect(rulesOf(1994)).toMatchObject({
      divisionSeeds: 2,
      playIn: 'none',
      firstRound: 5,
      finals: '2-3-2',
      homeByRecord: false,
      earlyTiebreak: true,
      eligibleTop: 8
    })
    expect(rulesOf(2003)).toMatchObject({ divisionSeeds: 2, firstRound: 7, earlyTiebreak: true })
    expect(rulesOf(2006)).toMatchObject({
      divisionSeeds: 3,
      homeByRecord: true,
      earlyTiebreak: false
    })
    expect(rulesOf(2010)).toMatchObject({ divisionSeeds: 'top4', finals: '2-3-2' })
    expect(rulesOf(2014)).toMatchObject({ divisionSeeds: 'top4', finals: '2-2-1-1-1' })
    expect(rulesOf(2016)).toMatchObject({ divisionSeeds: 0, playIn: 'none' })
    expect(rulesOf(2020)).toMatchObject({ playIn: 'bubble', neutralPlayoffs: true, eligibleTop: 8 })
    expect(rulesOf(2021)).toMatchObject({
      playIn: 'modern',
      neutralPlayoffs: false,
      eligibleTop: 10
    })
  })
})

describe('Records', () => {
  it('counts wins, losses, percentages, point differential and games behind', () => {
    const rec = records([
      ['A', 'B', 3],
      ['B', 'A']
    ])
    rec.addExtra(I.B, -4)
    expect([rec.won(I.A), rec.lost(I.A)]).toEqual([3, 1])
    expect([rec.won(I.B), rec.lost(I.B)]).toEqual([1, 4])
    expect(rec.pct(I.B)).toBeCloseTo(0.2, 12)
    expect(rec.points[I.A]).toBe(20)
    expect(rec.points[I.B]).toBe(-24)
    expect(rec.versus(I.A, (o) => o === I.B)).toEqual({ w: 3, g: 4 })
    // (3 - 1 + 4 - 1) / 2
    expect(gamesBehind(rec, I.A, I.B)).toBe(2.5)
  })
})

describe('TieBreaker, two teams', () => {
  it('takes the games between them first', () => {
    // A and B both 2-1; A won the game between them.
    const rec = records([
      ['A', 'B'],
      ['A', 'E'],
      ['E', 'A'],
      ['B', 'F', 2]
    ])
    const tb = new TieBreaker(LEAGUE, rec, rng(1), 8)
    expect(names(tb.rank([I.B, I.A]))).toEqual(['A', 'B'])
  })

  it('puts a division winner ahead of a team that is not, in different divisions', () => {
    // A and C both 3-3 and 1-1 between them. B wins division a (A lost to it twice), C wins c.
    const rec = records([
      ['A', 'C'],
      ['C', 'A'],
      ['B', 'A', 2],
      ['A', 'E', 2],
      ['C', 'D', 2],
      ['F', 'C', 2]
    ])
    const { tb, conferences } = seedConferences(LEAGUE, rec, rules({ divisionSeeds: 0 }), rng(1))
    expect(conferences[0].winners.map((t) => NAMES[t]).sort()).toEqual(['B', 'C'])
    expect(names(tb.breakTie([I.A, I.C]))).toEqual(['C', 'A'])
  })

  it('reads division record before conference record today, the reverse before 2004-05', () => {
    // A and B of division a, 5-3 each, 1-1 between them. A is 3-1 in the division and 3-3 in the
    // conference; B is 2-2 and 4-2 (2002-03's Midwest, where San Antonio won on conference record).
    const rec = records([
      ['A', 'B'],
      ['B', 'A'],
      ['A', 'J', 2],
      ['B', 'J'],
      ['J', 'B'],
      ['C', 'A', 2],
      ['B', 'C', 2],
      ['A', 'E', 2],
      ['B', 'F'],
      ['F', 'B']
    ])
    expect([rec.won(I.A), rec.lost(I.A), rec.won(I.B), rec.lost(I.B)]).toEqual([5, 3, 5, 3])
    const today = seedConferences(LEAGUE, rec, rules({ divisionSeeds: 0 }), rng(1))
    expect(today.conferences[0].winners.map((t) => NAMES[t])).toContain('A')
    const early = seedConferences(
      LEAGUE,
      rec,
      rules({ divisionSeeds: 0, earlyTiebreak: true }),
      rng(1)
    )
    expect(early.conferences[0].winners.map((t) => NAMES[t])).toContain('B')
  })

  it('falls to point differential, then a seeded drawing', () => {
    const tb = new TieBreaker(LEAGUE, new Records(NAMES.length), rng(7), 8)
    const draws = Array.from({ length: 4 }, () => tb.breakTie([I.E, I.F]).join())
    const again = new TieBreaker(LEAGUE, new Records(NAMES.length), rng(7), 8)
    expect(Array.from({ length: 4 }, () => again.breakTie([I.E, I.F]).join())).toEqual(draws)
    const rec = new Records(NAMES.length)
    rec.addExtra(I.E, 1)
    rec.addExtra(I.F, 3)
    expect(names(new TieBreaker(LEAGUE, rec, rng(7), 8).breakTie([I.E, I.F]))).toEqual(['F', 'E'])
  })
})

describe('TieBreaker, three teams', () => {
  it('takes a division winner first, then the other two start again as a pair', () => {
    // A, C and D all 4-3. C won division c on its games with D (2-1); B (5-0) won division a.
    // C goes first as the only division winner; A then beat D in their one game.
    const rec = records([
      ['C', 'D', 2],
      ['D', 'C'],
      ['A', 'D'],
      ['A', 'E', 3],
      ['F', 'A', 3],
      ['C', 'G', 2],
      ['H', 'C', 2],
      ['D', 'E', 3],
      ['B', 'F', 5]
    ])
    for (const t of [I.A, I.C, I.D]) expect([rec.won(t), rec.lost(t)]).toEqual([4, 3])
    const { conferences } = seedConferences(LEAGUE, rec, rules({ divisionSeeds: 0 }), rng(1))
    expect(names(conferences[0].order.slice(0, 4))).toEqual(['B', 'C', 'A', 'D'])
  })
})

describe('seedConferences', () => {
  // A 5-0, B 4-1, C 2-2 (winner of division c), D 1-2, J 0-5: the division winners are A and C.
  const rec = records([
    ['A', 'E', 5],
    ['B', 'F', 4],
    ['G', 'B'],
    ['C', 'D', 2],
    ['E', 'C', 2],
    ['D', 'H'],
    ['F', 'J', 5]
  ])

  it('seeds by record alone from 2015-16', () => {
    const { conferences } = seedConferences(LEAGUE, rec, rules({ divisionSeeds: 0 }), rng(1))
    expect(names(conferences[0].order)).toEqual(['A', 'B', 'C', 'D', 'J'])
  })

  it('seeds the division winners first before 2004-05', () => {
    const { conferences } = seedConferences(LEAGUE, rec, rules({ divisionSeeds: 2 }), rng(1))
    expect(names(conferences[0].order)).toEqual(['A', 'C', 'B', 'D', 'J'])
  })

  it('gives the division winners and the best other team the top four, by record, 2006-07 to 2014-15', () => {
    const { conferences } = seedConferences(LEAGUE, rec, rules({ divisionSeeds: 'top4' }), rng(1))
    // Two divisions here: the top group is A, C and the best other, B, ordered by record.
    expect(names(conferences[0].order)).toEqual(['A', 'B', 'C', 'D', 'J'])
  })

  it('marks the teams eligible for the postseason, ties for the last place included', () => {
    const { tb } = seedConferences(LEAGUE, rec, rules({ divisionSeeds: 0, eligibleTop: 2 }), rng(1))
    expect(names([0, 1, 2, 3, 4].filter((t) => tb.eligible[t] === 1))).toEqual(['A', 'B'])
  })
})
