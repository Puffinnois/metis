import { describe, expect, it } from 'vitest'
import { solve } from '@main/stats/models/linear'
import { srs, srsByDay, type MarginGame } from '@main/stats/models/srs'

const G = (date: string, home: string, away: string, margin: number): MarginGame<string> => ({
  date,
  home,
  away,
  margin
})

// The fixture league of `tests/fixtures/models.ts`, solved by hand there.
const LEAGUE = [
  G('11-01', 'BOS', 'LAL', 10),
  G('11-02', 'LAL', 'MIA', 4),
  G('11-03', 'MIA', 'BOS', 2)
]

describe('solve', () => {
  it('solves a small system with pivoting', () => {
    // 0x + 2y = 4, 3x + y = 5: x = 1, y = 2 (the first pivot is zero).
    const x = solve(Float64Array.from([0, 2, 3, 1]), Float64Array.from([4, 5]), 2)
    expect([...x].map((v) => +v.toFixed(12))).toEqual([1, 2])
  })

  it('refuses a singular system', () => {
    expect(() => solve(Float64Array.from([1, 1, 1, 1]), Float64Array.from([1, 2]), 2)).toThrow(
      'singular'
    )
  })
})

describe('srs', () => {
  it('solves a three-team league by hand', () => {
    const r = srs(LEAGUE)
    expect(r.get('BOS')!.srs).toBeCloseTo(8 / 3, 12)
    expect(r.get('LAL')!.srs).toBeCloseTo(-2, 12)
    expect(r.get('MIA')!.srs).toBeCloseTo(-2 / 3, 12)
    expect(r.get('BOS')).toMatchObject({ games: 2, mov: 4 })
    expect(r.get('BOS')!.sos).toBeCloseTo(-4 / 3, 12)
    expect(r.get('LAL')!.sos).toBeCloseTo(1, 12)
    expect(r.get('MIA')!.sos).toBeCloseTo(1 / 3, 12)
  })

  it('keeps SRS = MOV + SOS and a zero mean exactly', () => {
    // An uneven schedule: some pairs meet twice, one team plays once.
    const games = [
      G('1', 'A', 'B', 7),
      G('1', 'C', 'D', -3),
      G('2', 'A', 'C', 12),
      G('2', 'B', 'D', 1),
      G('3', 'B', 'A', 5),
      G('3', 'D', 'E', 9),
      G('4', 'C', 'B', -4)
    ]
    const r = srs(games)
    let total = 0
    for (const v of r.values()) {
      expect(v.srs).toBeCloseTo(v.mov + v.sos, 12)
      total += v.srs
    }
    expect(total).toBeCloseTo(0, 12)
  })

  it('centres each group of teams that have not met on zero', () => {
    const r = srs([G('1', 'A', 'B', 6), G('1', 'C', 'D', 2)])
    expect(r.get('A')!.srs).toBeCloseTo(3, 12)
    expect(r.get('B')!.srs).toBeCloseTo(-3, 12)
    expect(r.get('C')!.srs).toBeCloseTo(1, 12)
    expect(r.get('D')!.srs).toBeCloseTo(-1, 12)
  })

  it('has no teams without games', () => {
    expect(srs([]).size).toBe(0)
  })
})

describe('srsByDay', () => {
  it('gives the schedule strength of the games left after each day', () => {
    const fixtures = [...LEAGUE, { date: '12-31', home: 'BOS', away: 'MIA' }]
    const rows = srsByDay(LEAGUE, fixtures)
    const at = (date: string, team: string): [number, number | null] => {
      const r = rows.find((x) => x.date === date && x.team === team)!
      return [r.gamesLeft, r.sosLeft]
    }
    expect(at('11-01', 'BOS')).toEqual([2, 0])
    expect(at('11-01', 'LAL')).toEqual([1, 0])
    expect(at('11-02', 'LAL')).toEqual([0, null])
    expect(at('11-02', 'MIA')[0]).toBe(2)
    expect(at('11-02', 'MIA')[1]).toBeCloseTo(8, 12)
    expect(at('11-03', 'MIA')[1]).toBeCloseTo(8 / 3, 12)
    expect(at('11-03', 'BOS')[1]).toBeCloseTo(-2 / 3, 12)
    // Without a schedule, nothing is left.
    expect(srsByDay(LEAGUE).every((r) => r.gamesLeft === 0 && r.sosLeft === null)).toBe(true)
  })

  it('gives each team that played a day its rating after that day', () => {
    const rows = srsByDay([...LEAGUE].reverse())
    const at = (date: string, team: string): number =>
      rows.find((r) => r.date === date && r.team === team)!.srs
    expect(rows.map((r) => `${r.date} ${r.team}`)).toEqual([
      '11-01 BOS',
      '11-01 LAL',
      '11-02 LAL',
      '11-02 MIA',
      '11-03 MIA',
      '11-03 BOS'
    ])
    expect(at('11-01', 'BOS')).toBeCloseTo(5, 12)
    expect(at('11-01', 'LAL')).toBeCloseTo(-5, 12)
    expect(at('11-02', 'LAL')).toBeCloseTo(-2, 12)
    expect(at('11-02', 'MIA')).toBeCloseTo(-6, 12)
    expect(at('11-03', 'MIA')).toBeCloseTo(-2 / 3, 12)
    expect(at('11-03', 'BOS')).toBeCloseTo(8 / 3, 12)
  })
})
