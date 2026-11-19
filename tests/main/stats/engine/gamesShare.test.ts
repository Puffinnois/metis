import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { compileQuery, type CompileContext } from '@main/stats/engine/compile'
import { runQuery } from '@main/stats/engine/run'
import { gamesToQualifyIn, LEAGUES, type League } from '@shared/leagues'
import type { StatsQuery, StatsResult } from '@shared/stats/types'
import {
  addGame,
  addNbaLine,
  BOS,
  emptySources,
  LAL,
  MIA,
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
  // The college leagues rank their Division I teams alone (D40): both teams here are.
  await db.exec('ALTER TABLE team ADD COLUMN division_i BOOLEAN DEFAULT true')
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
    // 0.75 of the row's own team games in scope (`team_games`), not of the scope's average.
    expect(college).toContain('>= ceil(round(0.75 * team_games, 3))')
    expect(college).not.toContain('61.5 * $factor')
    // The makes and the minutes stay D37's, scaled: 300 field goals, 1,000 minutes by 40 / 48.
    expect(college).toContain('round(300 * $factor)')
    expect(college).toContain(`round(1000 * $factor * ${(40 / 48).toFixed(6)})`)
    expect(college).not.toContain('round(58 * $factor)')
    // The NBA's and the WNBA's SQL is as it was.
    for (const league of [nba, { ...wnba, metricsByDefault: true }]) {
      const sql = compileQuery(q, ctx(league)).sql
      expect(sql).toContain('round(58 * $factor)')
      expect(sql).not.toContain('ceil(')
      expect(sql).not.toContain('team_games')
      expect(sql).not.toContain('division_i')
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

/**
 * D43 asks 75 % of the player's own team's games, and college teams play 25 to 40 a season: the rule
 * must read each row's team, never an average over the league. Seven games, worked by hand:
 *
 * - a BOS–LAL, b LAL–BOS, c BOS–MIA, d MIA–BOS, e LAL–MIA, f BOS–MIA, g BOS–LAL;
 * - Boston plays 6, Los Angeles 4, Miami 4. The average is 4.67, whose 75 % asks 4 games of anyone;
 *   the own-team rule asks 5 of Boston's players (75 % of 6 is 4.5) and 3 of the others' (of 4, 3).
 *
 * Ann plays 4 of Boston's 6 (a to d), Lu 3 of Los Angeles's 4 (a, b, e). Eve plays a for Los Angeles,
 * then d and f for Miami: two teams in one season, 3 games. Fay plays c for Miami. Gus, Hal and Ivy
 * fill the other sides so every team-game has a box score.
 */
describe('the share of the player’s own team’s games (D43)', () => {
  const ANN = 11
  const LU = 12
  const EVE = 13
  const FAY = 14
  let db2: StatsDb

  beforeEach(async () => {
    db2 = await openTestDb()
    await emptySources(db2)
    await db2.exec(`INSERT INTO team VALUES
      (2026, ${BOS}, 2, 'BOS', 'Boston', 'east', 'atlantic'),
      (2026, ${LAL}, 13, 'LAL', 'Los Angeles', 'west', 'pacific'),
      (2026, ${MIA}, 14, 'MIA', 'Miami', 'east', 'southeast')`)
    await db2.exec('ALTER TABLE team ADD COLUMN division_i BOOLEAN DEFAULT true')
    await db2.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
    await db2.exec(`INSERT INTO player VALUES (11, 'Ann'), (12, 'Lu'), (13, 'Eve'), (14, 'Fay'),
      (15, 'Gus'), (16, 'Hal'), (17, 'Ivy')`)
    const games: [string, string, number, number][] = [
      ['a', '2026-01-05', BOS, LAL],
      ['b', '2026-01-07', LAL, BOS],
      ['c', '2026-01-09', BOS, MIA],
      ['d', '2026-01-11', MIA, BOS],
      ['e', '2026-01-13', LAL, MIA],
      ['f', '2026-01-15', BOS, MIA],
      ['g', '2026-01-17', BOS, LAL]
    ]
    for (const [id, date, home, away] of games) await addGame(db2, { id, date, home, away })
    const lines: [string, number, number][] = [
      ...(['a', 'b', 'c', 'd'] as const).map((g): [string, number, number] => [g, ANN, BOS]),
      ...(['a', 'b', 'e'] as const).map((g): [string, number, number] => [g, LU, LAL]),
      ['a', EVE, LAL],
      ['d', EVE, MIA],
      ['f', EVE, MIA],
      ['c', FAY, MIA],
      ['e', 15, MIA],
      ['f', 16, BOS],
      ['g', 16, BOS],
      ['g', 17, LAL]
    ]
    for (const [game, player, team] of lines) {
      await addNbaLine(db2, game, player, team, { stats: scoring(10), minutes: '20:00' })
    }
    await buildDerived(db2)
  })

  const rows = async (league: League, q: Partial<StatsQuery> = {}): Promise<StatsResult['rows']> =>
    (
      await runQuery(
        db2,
        { ...perGame, ...q, scope: { ...perGame.scope, ...q.scope } },
        ctx(league)
      )
    ).rows

  const flags = async (
    league: League,
    q: Partial<StatsQuery> = {}
  ): Promise<Record<string, boolean>> =>
    Object.fromEntries(
      (await rows(league, q)).map((r) => [
        `${r.name}${r.group.team ? `@${r.group.team}` : ''}${r.group.opponent ? ` v ${r.group.opponent}` : ''}`,
        r.values.pts.qualified
      ])
    )

  it('asks 75 % of the row’s own team games, not of the league’s average', async () => {
    const f = await flags(ncaam)
    // Ann: 4 of Boston's 6 is short of 5, though 4 is the average's 75 %. Lu: 3 of 4 is enough,
    // though the average's would ask 4.
    expect([f.Ann, f.Lu, f.Fay]).toEqual([false, true, false])
    // The NBA's rule is as it was: 58 of 82 of the average 4.67 games is 3.3, so 3.
    expect(await flags(nba)).toMatchObject({ Ann: true, Lu: true, Fay: false })
  })

  it('takes the team with more games for a player of two teams in one season, not their sum', async () => {
    // Eve: 3 games, for Los Angeles (4 games) and Miami (4). The more of the two is 4, so 3 games
    // qualify; the sum, 8, would ask 6.
    expect((await flags(ncaaw)).Eve).toBe(true)
    // By team, each row reads its own team: 1 of Los Angeles's 4, 2 of Miami's 4, neither 3.
    const byTeam = await flags(ncaaw, { groupBy: ['team'] })
    expect(byTeam[`Eve@${LAL}`]).toBe(false)
    expect(byTeam[`Eve@${MIA}`]).toBe(false)
  })

  it('counts a team’s games against the opponent a row is grouped by', async () => {
    // Los Angeles met Miami once (e) and Boston three times (a, b, g): Lu played e and a, b.
    const f = await flags(ncaam, { groupBy: ['opponent'] })
    expect(f[`Lu v ${MIA}`]).toBe(true)
    expect(f[`Lu v ${BOS}`]).toBe(false)
  })

  it('ranks and lists Division I teams’ players alone, and reads the others when named', async () => {
    await db2.exec(`UPDATE team SET division_i = false WHERE team_id = ${MIA}`)
    const names = (await rows(ncaam)).map((r) => r.name).sort()
    // Fay and Gus played for Miami alone; Eve's season row is her last team's, Miami.
    expect(names).toEqual(['Ann', 'Hal', 'Ivy', 'Lu'])
    // The scope's average games, which the makes minimums scale by, are Division I teams' too.
    const compiled = compileQuery(perGame, ctx(ncaam))
    expect(compiled.gamesSql).toContain('dt.division_i')
    expect(compileQuery(perGame, ctx(nba)).gamesSql).not.toContain('division_i')
    // A query that names a player reads them, whatever their team.
    const fay = await rows(ncaam, { scope: { seasons: [2026], players: [String(FAY)] } })
    expect(fay.map((r) => r.name)).toEqual(['Fay'])
    // The NBA ranks every team's players.
    expect((await rows(nba)).map((r) => r.name)).toContain('Fay')
  })
})
