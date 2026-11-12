import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { readOfficialCareer, readOfficialsSeason } from '@main/stats/officialsReads'
import { addGame, addNbaLine, BOS, emptySources, LAL } from '../../fixtures/boxScores'
import { openTestDb } from '../../fixtures/stats'

let db: StatsDb

/**
 * Three 2025-26 games, Boston at home, each side one player with the fixture's line (3 fouls, 5
 * free-throw attempts, 26 points): Boston wins a and b, Los Angeles wins c. Official 10 works a and b
 * (listed twice in a), official 11 all three, official 12 game c. In 2002-03, one of two games has a
 * crew. A playoff game has official 10 alone.
 */
beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2003, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2003, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific')`)
  const game = (
    id: string,
    date: string,
    scores: [number, number],
    season = 2026,
    type = 'regular'
  ): Promise<void> => addGame(db, { id, date, home: BOS, away: LAL, scores, season, type })
  await game('a', '2025-11-01', [26, 20])
  await game('b', '2025-11-03', [26, 20])
  await game('c', '2025-11-05', [20, 26])
  await game('po', '2026-04-20', [26, 20], 2026, 'playoffs')
  await game('x1', '2002-11-01', [26, 20], 2003)
  await game('x2', '2002-11-03', [26, 20], 2003)
  for (const [g, season] of [
    ['a', 2026],
    ['b', 2026],
    ['c', 2026],
    ['po', 2026],
    ['x1', 2003],
    ['x2', 2003]
  ] as const) {
    await addNbaLine(db, g, 1, BOS, { season })
    await addNbaLine(db, g, 2, LAL, { season })
  }
  await buildDerived(db)
  await db.exec(`CREATE TABLE src_nba_officials (official_id BIGINT, first_name VARCHAR,
    last_name VARCHAR, jersey_num VARCHAR, season INTEGER, game_id VARCHAR, season_type_id VARCHAR)`)
  await db.exec(`INSERT INTO src_nba_officials VALUES
    (10, 'Ed', 'Malloy', '7   ', 2026, 'a', '2'),
    (10, 'Ed', 'Malloy', '7   ', 2026, 'a', '2'),
    (10, 'Ed', 'Malloy', '7   ', 2026, 'b', '2'),
    (11, 'Kevin', 'Scott', '24  ', 2026, 'a', '2'),
    (11, 'Kevin', 'Scott', '24  ', 2026, 'b', '2'),
    (11, 'Kevin', 'Scott', '24  ', 2026, 'c', '2'),
    (12, 'Aaron', 'Smith', '', 2026, 'c', '2'),
    (10, 'Ed', 'Malloy', '7   ', 2026, 'po', '4'),
    (10, 'Ed', 'Malloy', '7   ', 2003, 'x1', '2')`)
})

describe('a season’s officials', () => {
  it('adds up the box scores of the games each worked, once a game, beside the league', async () => {
    const s = await readOfficialsSeason(db, 2026, ['regular'])
    expect(s.reason).toBeNull()
    expect(s.coverage).toEqual({ games: 3, withCrew: 3, crewSizes: { 2: 3 } })
    expect(s.league).toEqual({
      games: 3,
      homeFouls: 9,
      awayFouls: 9,
      homeFta: 15,
      awayFta: 15,
      homePts: 78,
      awayPts: 78,
      homeWins: 2
    })
    // By games worked, then name; no rate orders the list.
    expect(s.officials.map((o) => [o.name, o.jersey, o.totals.games, o.totals.homeWins])).toEqual([
      ['Kevin Scott', '24', 3, 2],
      ['Ed Malloy', '7', 2, 2],
      ['Aaron Smith', null, 1, 0]
    ])
    expect(s.officials[1].totals.homeFouls).toBe(6)
  })

  it('reads the playoffs apart', async () => {
    const s = await readOfficialsSeason(db, 2026, ['playoffs'])
    expect(s.officials.map((o) => [o.id, o.totals.games])).toEqual([['10', 1]])
    expect(s.coverage.crewSizes).toEqual({ 1: 1 })
  })

  it('says why a season before 2003-04 reads no rates', async () => {
    const s = await readOfficialsSeason(db, 2003, ['regular'])
    expect(s.coverage).toEqual({ games: 2, withCrew: 1, crewSizes: { 1: 1 } })
    expect(s.reason).toBe('Crews are listed for 1 of 2 games in 2002-03; rates start in 2003-04.')
    expect(s.officials).toHaveLength(1)
  })

  it('is empty for a season type that is not one, or without the file', async () => {
    expect((await readOfficialsSeason(db, 2026, ['nope' as 'regular'])).officials).toEqual([])
    await db.exec('DROP TABLE src_nba_officials')
    expect((await readOfficialsSeason(db, 2026, ['regular'])).officials).toEqual([])
  })
})

describe('an official’s seasons', () => {
  it('lists each season newest first, beside the league’s line for it, with its reason', async () => {
    const c = await readOfficialCareer(db, '10', ['regular'])
    expect(c?.name).toBe('Ed Malloy')
    expect(c?.jersey).toBe('7')
    expect(c?.seasons.map((s) => [s.season, s.totals.games, s.league.games, s.reason])).toEqual([
      [2026, 2, 3, null],
      [2003, 1, 2, 'Crews are listed for 1 of 2 games in 2002-03; rates start in 2003-04.']
    ])
  })

  it('is null for an id the file lacks or that is not one', async () => {
    expect(await readOfficialCareer(db, '99', ['regular'])).toBeNull()
    expect(await readOfficialCareer(db, '1; DROP', ['regular'])).toBeNull()
  })
})
