import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { compileQuery, StatsQueryError, type CompileContext } from '@main/stats/engine/compile'
import { catalogueInfo } from '@main/stats/engine/registry'
import { noDataResult, qualificationFactor, runQuery } from '@main/stats/engine/run'
import { LEAGUES, type League } from '@shared/leagues'
import type { StatsQuery } from '@shared/stats/types'
import {
  addGame,
  addNbaLine,
  BOS,
  emptySources,
  LAL,
  type Stats
} from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

/**
 * The engine reads what differs by league from the registry entry in its context. The same fixture
 * is asked as each league; every expected number is worked out by hand from the registry's values.
 */
const nba = LEAGUES.nba
const wnba = LEAGUES.wnba
/**
 * The WNBA's entry as T1301.6 will leave it, every metric covered: the registry's entry states no
 * metric yet, so a query of it reads each as not recorded. Its game length, modes and minimums are the
 * registry's own.
 */
const wnbaRead: League = { ...wnba, metricsByDefault: true }
const ctx = (league: League): CompileContext => ({ league, currentSeason: 2026 })

/** Only free throws, so points read at a glance. */
const scoring = (pts: number): Stats => [0, 0, 0, 0, pts, pts, 0, 0, 0, 0, 0, 0, 0, pts]

let db: StatsDb
beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles', 'west', 'pacific')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana'), (2, 'Bea')`)
  await addGame(db, { id: 'a', date: '2026-01-05', home: BOS, away: LAL, scores: [100, 90] })
  await addGame(db, { id: 'b', date: '2026-01-07', home: LAL, away: BOS, scores: [95, 99] })
  // Ana: 30 points in 30 minutes, then 10 in 20. Bea: 9 in 18, then 21 in 42.
  await addNbaLine(db, 'a', 1, BOS, { stats: scoring(30), minutes: '30:00' })
  await addNbaLine(db, 'b', 1, BOS, { stats: scoring(10), minutes: '20:00' })
  await addNbaLine(db, 'a', 2, LAL, { stats: scoring(9), minutes: '18:00' })
  await addNbaLine(db, 'b', 2, LAL, { stats: scoring(21), minutes: '42:00' })
  await buildDerived(db)
})

const pts = (q: Partial<StatsQuery>): StatsQuery => ({
  entity: 'player',
  metrics: ['pts'],
  scope: { seasons: [2026] },
  ...q
})

const valueOf = async (league: League, q: StatsQuery, id: string): Promise<number | null> =>
  (await runQuery(db, q, ctx(league))).rows.find((r) => r.id === id)?.values.pts.value ?? null

describe('the engine in each league', () => {
  it('reads per 36 the same in both, per 48 in the NBA and per 40 in the WNBA', async () => {
    // Ana: 40 points in 50 minutes. Per 36: 40 / (50 / 36) = 28.8.
    expect(await valueOf(nba, pts({ transform: 'per36' }), '1')).toBeCloseTo((40 * 36) / 50, 6)
    expect(await valueOf(wnbaRead, pts({ transform: 'per36' }), '1')).toBeCloseTo((40 * 36) / 50, 6)
    // The NBA's game: 40 / (50 / 48) = 38.4. A 40-minute game: 40 / (50 / 40) = 32.
    expect(await valueOf(nba, pts({ transform: 'per48' }), '1')).toBeCloseTo((40 * 48) / 50, 6)
    expect(await valueOf(wnbaRead, pts({ transform: 'per40' }), '1')).toBeCloseTo((40 * 40) / 50, 6)
    // Bea: 30 in 60 minutes, per 40: 20.
    expect(await valueOf(wnbaRead, pts({ transform: 'per40' }), '2')).toBeCloseTo(20, 6)
    // The registry's entry as it is: the metric is not recorded there yet, never an error.
    const asIs = await runQuery(db, pts({ transform: 'per40' }), ctx(wnba))
    expect(asIs.columns[0].reason).toBe('Not recorded for the WNBA.')
    expect(asIs.rows.every((r) => r.values.pts.value === null)).toBe(true)
  })

  it('offers each league only its own per-minute modes', () => {
    expect(() => compileQuery(pts({ transform: 'per40' }), ctx(nba))).toThrow(
      'the NBA reads per minute as per36 or per48, not per40'
    )
    expect(() => compileQuery(pts({ transform: 'per48' }), ctx(wnba))).toThrow(StatsQueryError)
    expect(() => compileQuery(pts({ transform: 'percentile', shrunk: true }), ctx(wnba))).toThrow(
      'shrunk works with totals, per game, per 36, per 40 and per 100'
    )
  })

  it('scales a minimum by the team games in scope over the registry’s base', async () => {
    const q = pts({ metrics: ['pts', 'min'] })
    // Each team played 2 games: the factor is 2 over the base the minimums are stated for.
    for (const league of [nba, wnbaRead]) {
      const compiled = compileQuery(q, ctx(league))
      expect(compiled.fullSeason).toBe(league.minimumsGames)
      expect(Number(await qualificationFactor(db, compiled, q))).toBeCloseTo(2 / 82, 6)
    }
    // A league whose minimums were stated over 40 games scales by 2 / 40.
    const forty: League = { ...wnbaRead, minimumsGames: 40 }
    const compiled = compileQuery(q, ctx(forty))
    expect(Number(await qualificationFactor(db, compiled, q))).toBeCloseTo(2 / 40, 6)
  })

  it('scales a minimum counted in minutes by the game length, and leaves the NBA’s as it was', () => {
    // `min` qualifies on 1,000 minutes, stated in 48-minute games: 40 / 48 of it in the WNBA.
    const q = pts({ metrics: ['min', 'pts'] })
    const nbaSql = compileQuery(q, ctx(nba)).sql
    const wnbaSql = compileQuery(q, ctx(wnbaRead)).sql
    expect(nbaSql).toContain('>= round(1000 * $factor)')
    expect(wnbaSql).toContain(`>= round(1000 * $factor * ${(40 / 48).toFixed(6)})`)
    // A minimum counted in games is the same in both: 58 games of 82 (D33).
    expect(nbaSql).toContain('round(58 * $factor)')
    expect(wnbaSql).toContain('round(58 * $factor)')
  })

  it('qualifies rows on the scaled minimum, worked out by hand', async () => {
    // 2 team games: 1,000 × 2 / 82 = 24.39 minutes, rounded to 24 in the NBA; × 40 / 48 = 20.33,
    // rounded to 20, in the WNBA. Ana played 50 and Bea 60 over the two, so both qualify; a league
    // stated over 4 games asks 500 and 417, and neither does.
    const q = pts({ metrics: ['min'], scope: { seasons: [2026] } })
    const qualified = async (league: League): Promise<boolean[]> =>
      (await runQuery(db, q, ctx(league))).rows.map((r) => r.values.min.qualified)
    expect(await qualified(nba)).toEqual([true, true])
    expect(await qualified(wnbaRead)).toEqual([true, true])
    expect(await qualified({ ...wnbaRead, minimumsGames: 4 })).toEqual([false, false])
  })

  it('reads seasons and game types as the league has them', () => {
    expect(() => compileQuery(pts({ scope: { seasons: [1996] } }), ctx(wnba))).toThrow(
      'scope.seasons must be whole numbers from 1997 to 2026'
    )
    expect(() => compileQuery(pts({ scope: { seasons: [1994] } }), ctx(nba))).not.toThrow()
    expect(() =>
      compileQuery(pts({ scope: { seasons: [2026], gameTypes: ['play-in'] } }), ctx(wnba))
    ).toThrow('unknown game type "play-in"; use regular, playoffs, cup-final, all-star')
  })

  it('answers a league with no data with the reason, and still refuses a bad query', () => {
    const result = noDataResult(pts({ metrics: ['pts', 'reb'] }), ctx(wnba))
    expect(result.rows).toEqual([])
    expect(result.notes).toEqual([wnba.noData])
    expect(result.columns.map((c) => c.reason)).toEqual([wnba.noData, wnba.noData])
    expect(() => noDataResult(pts({ metrics: ['nope'] }), ctx(wnba))).toThrow('unknown metric')
  })

  it('gives the WNBA’s catalogue no coverage until a metric states it, the NBA’s as it was', () => {
    const inNba = catalogueInfo(nba)
    const inWnba = catalogueInfo(wnba)
    expect(inNba.length).toBe(inWnba.length)
    const ptsNba = inNba.find((m) => m.id === 'pts')!
    expect(ptsNba.firstSeason).toBe(1994)
    expect(ptsNba.unavailable).toBeUndefined()
    expect(inWnba.find((m) => m.id === 'pts')!.unavailable).toBe('Not recorded for the WNBA.')
    expect(inNba.some((m) => 'leagues' in m)).toBe(false)
  })
})
