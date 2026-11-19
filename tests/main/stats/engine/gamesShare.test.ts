import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { compileQuery, type CompileContext } from '@main/stats/engine/compile'
import { runQuery } from '@main/stats/engine/run'
import { gamesToQualifyIn, LEAGUES, type League } from '@shared/leagues'
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
 * D43's games rule, a new kind of qualifier beside the scaled 82-game count: a per-game leader in a
 * college league needs 75 percent of the team's games, rounded up, where the NBA and the WNBA ask 58
 * of 82 scaled to the games in scope. Every expected number is worked out by hand.
 */
const nba = LEAGUES.nba
const wnba = LEAGUES.wnba
/** The college leagues' entries with every metric covered and the tables built, as T1302.5 leaves them. */
const read = (league: League): League => ({
  ...league,
  metricsByDefault: true,
  builds: ['identity', 'derived']
})
const ncaam = read(LEAGUES.ncaam)
const ncaaw = read(LEAGUES.ncaaw)
const ctx = (league: League): CompileContext => ({ league, currentSeason: 2026 })

const scoring = (pts: number): Stats => [0, 0, 0, 0, pts, pts, 0, 0, 0, 0, 0, 0, 0, pts]

let db: StatsDb
beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles', 'west', 'pacific')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana'), (2, 'Bea'), (3, 'Cat')`)
  await addGame(db, { id: 'a', date: '2026-01-05', home: BOS, away: LAL, scores: [100, 90] })
  await addGame(db, { id: 'b', date: '2026-01-07', home: LAL, away: BOS, scores: [95, 99] })
  // Ana and Bea play both of their team's games; Cat plays one of Boston's two.
  await addNbaLine(db, 'a', 1, BOS, { stats: scoring(30), minutes: '30:00' })
  await addNbaLine(db, 'b', 1, BOS, { stats: scoring(10), minutes: '20:00' })
  await addNbaLine(db, 'a', 2, LAL, { stats: scoring(9), minutes: '18:00' })
  await addNbaLine(db, 'b', 2, LAL, { stats: scoring(21), minutes: '42:00' })
  await addNbaLine(db, 'a', 3, BOS, { stats: scoring(40), minutes: '35:00' })
  await buildDerived(db)
})

const perGame: StatsQuery = {
  entity: 'player',
  metrics: ['pts'],
  scope: { seasons: [2026] },
  transform: 'perGame'
}

const qualified = async (league: League): Promise<Record<string, boolean>> =>
  Object.fromEntries(
    (await runQuery(db, perGame, ctx(league))).rows.map((r) => [r.name, r.values.pts.qualified])
  )

describe('the games rule as a share of the team’s games (D43)', () => {
  it('asks 75 % of the team games, rounded up, worked out by hand', () => {
    // 75 % of 31 is 23.25: 24 games. Of 32, exactly 24. Of 35 (BYU's 2025-26), 26.25: 27.
    expect(gamesToQualifyIn(LEAGUES.ncaam, 31, 58)).toBe(24)
    expect(gamesToQualifyIn(LEAGUES.ncaam, 32, 58)).toBe(24)
    expect(gamesToQualifyIn(LEAGUES.ncaaw, 33, 58)).toBe(25)
    expect(gamesToQualifyIn(LEAGUES.ncaaw, 35, 58)).toBe(27)
    expect(gamesToQualifyIn(LEAGUES.ncaam, 2, 58)).toBe(2)
    // The NBA's and the WNBA's are as they were: 58 of 82, 31 of 44, 24 of 34, 1 of 2.
    expect(gamesToQualifyIn(nba, 82, 58)).toBe(58)
    expect(gamesToQualifyIn(wnba, 44, 58)).toBe(31)
    expect(gamesToQualifyIn(wnba, 34, 58)).toBe(24)
    expect(gamesToQualifyIn(nba, 2, 58)).toBe(1)
  })

  it('writes the share into the engine’s SQL for the per-game leaders alone', () => {
    const q: StatsQuery = { ...perGame, metrics: ['pts', 'fg_pct', 'min'] }
    const college = compileQuery(q, ctx(ncaam)).sql
    // 0.75 × the 82 games the factor is stated over: 61.5.
    expect(college).toContain('>= ceil(round(61.5 * $factor, 3))')
    // The makes and the minutes stay D37's, scaled: 300 field goals, 1,000 minutes by 40 / 48.
    expect(college).toContain('round(300 * $factor)')
    expect(college).toContain(`round(1000 * $factor * ${(40 / 48).toFixed(6)})`)
    expect(college).not.toContain('round(58 * $factor)')
    // The NBA's and the WNBA's SQL is as it was.
    for (const league of [nba, { ...wnba, metricsByDefault: true }]) {
      const sql = compileQuery(q, ctx(league)).sql
      expect(sql).toContain('round(58 * $factor)')
      expect(sql).not.toContain('ceil(')
    }
  })

  it('reads the same count in SQL as by hand, across a season’s lengths', async () => {
    // The factor reaches the SQL as six decimals of the team games over 82, as `qualificationFactor`
    // writes it: 32 / 82 is 0.390244, and 61.5 × 0.390244 is 24.000006, which must stay 24.
    const rows: string[] = []
    for (let games = 1; games <= 45; games++) {
      rows.push(`ceil(round(61.5 * ${(games / 82).toFixed(6)}, 3)) AS g${games}`)
    }
    const row = (await db.get<Record<string, number>>(`SELECT ${rows.join(', ')}`)) ?? {}
    for (let games = 1; games <= 45; games++) {
      expect(Number(row[`g${games}`])).toBe(gamesToQualifyIn(LEAGUES.ncaam, games, 58))
      expect(Number(row[`g${games}`])).toBe(Math.ceil(games * 0.75 - 1e-9))
    }
  })

  it('qualifies a row on 75 % of its team’s games, where the NBA’s rule asks fewer', async () => {
    // Two team games. The NBA's 58 × 2 / 82 = 1.41, rounded to 1: Cat's one game qualifies. The
    // college rule asks 75 % of 2 = 1.5, rounded up to 2: Cat does not, Ana and Bea do.
    expect(await qualified(nba)).toEqual({ Cat: true, Ana: true, Bea: true })
    for (const league of [ncaam, ncaaw]) {
      expect(await qualified(league)).toEqual({ Cat: false, Ana: true, Bea: true })
    }
  })

  it('ranks Cat’s 40 points a game first in the NBA and drops it from the qualified college board', async () => {
    const board = async (league: League): Promise<string[]> =>
      (
        await runQuery(
          db,
          { ...perGame, scope: { ...perGame.scope, qualifiedOnly: true } },
          ctx(league)
        )
      ).rows.map((r) => r.name)
    expect(await board(nba)).toEqual(['Cat', 'Ana', 'Bea'])
    expect(await board(ncaam)).toEqual(['Ana', 'Bea'])
  })
})
