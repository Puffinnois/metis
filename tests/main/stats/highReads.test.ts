import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { BUILT_AT_NEXT_REFRESH } from '@main/stats/engine/compile'
import { readPlayerGames } from '@main/stats/highReads'
import { countOf, GAME_COUNTS } from '@shared/stats/highs'
import { openTestDb } from '../../fixtures/stats'

/** A player's game lines (Plan T1703.3) on rows in the shape of `player_game`, out of order. */
let db: StatsDb

const COUNTS = GAME_COUNTS.map((c) => `${c} INTEGER`).join(', ')
const line = (over: Record<string, string> = {}): string =>
  GAME_COUNTS.map((c) => over[c] ?? '0').join(', ')

beforeEach(async () => {
  db = await openTestDb()
  await db.exec('DROP TABLE IF EXISTS player_game')
  await db.exec('DROP TABLE IF EXISTS team')
  await db.exec('CREATE TABLE team (team_id BIGINT, season INTEGER, code VARCHAR)')
  await db.exec("INSERT INTO team VALUES (10, 2025, 'SEA'), (10, 2026, 'OKC'), (20, 2026, 'BOS')")
})

const build = async (): Promise<void> => {
  await db.exec(`CREATE TABLE player_game (player_id BIGINT, game_id VARCHAR, team_id BIGINT,
    season INTEGER, game_type VARCHAR, game_date DATE, opponent_id BIGINT, home BOOLEAN,
    wins INTEGER, losses INTEGER, ${COUNTS})`)
  await db.exec(`INSERT INTO player_game VALUES
    (1, 'c', 10, 2026, 'playoffs', DATE '2026-04-20', 20, false, 0, 1, ${line({ pts: '31', plus_minus: 'NULL' })}),
    (1, 'a', 10, 2025, 'regular', DATE '2024-11-01', 99, true, 1, 0, ${line({ pts: '12' })}),
    (1, 'b2', 10, 2026, 'regular', DATE '2025-11-01', 20, true, 1, 0, ${line({ pts: '20' })}),
    (1, 'b1', 10, 2026, 'regular', DATE '2025-11-01', 20, true, 1, 0, ${line({ pts: '10' })}),
    (2, 'a', 20, 2025, 'regular', DATE '2024-11-01', 10, false, 0, 1, ${line()})`)
}

describe('a player’s game lines', () => {
  it('gives every line of every game type, oldest first, a day’s two games by id', async () => {
    await build()
    const { games, reason } = await readPlayerGames(db, '1')
    expect(reason).toBeNull()
    expect(games.map((g) => g.gameId)).toEqual(['a', 'b1', 'b2', 'c'])
    expect(games.map((g) => g.gameType)).toEqual(['regular', 'regular', 'regular', 'playoffs'])
    expect(games.map((g) => countOf(g, 'pts'))).toEqual([12, 10, 20, 31])
  })

  it('names each side by its code that season, and a team the season lacks by none', async () => {
    await build()
    const { games } = await readPlayerGames(db, '1')
    expect(games.map((g) => [g.team, g.opponent, g.opponentId])).toEqual([
      ['SEA', null, '99'],
      ['OKC', 'BOS', '20'],
      ['OKC', 'BOS', '20'],
      ['OKC', 'BOS', '20']
    ])
    expect(games[0]).toMatchObject({ date: '2024-11-01', season: 2025, home: true, won: true })
    expect(games[3].won).toBe(false)
  })

  it('keeps a zero as 0 and a missing count as null', async () => {
    await build()
    const { games } = await readPlayerGames(db, '1')
    expect(countOf(games[3], 'plus_minus')).toBeNull()
    expect(countOf(games[2], 'plus_minus')).toBe(0)
    expect(countOf(games[2], 'stl')).toBe(0)
  })

  it('reads a count the table lacks as null', async () => {
    await build()
    await db.exec('ALTER TABLE player_game DROP COLUMN plus_minus')
    const { games } = await readPlayerGames(db, '1')
    expect(games.map((g) => countOf(g, 'plus_minus'))).toEqual([null, null, null, null])
    expect(countOf(games[3], 'pts')).toBe(31)
  })

  it('gives the year the draft lists them in, and none in a file without the attributes', async () => {
    await build()
    expect((await readPlayerGames(db, '1')).draftYear).toBeNull()
    await db.exec('CREATE TABLE player_attributes (player_id BIGINT, draft_year INTEGER)')
    await db.exec('INSERT INTO player_attributes VALUES (1, 1984), (2, NULL)')
    expect((await readPlayerGames(db, '1')).draftYear).toBe(1984)
    expect((await readPlayerGames(db, '2')).draftYear).toBeNull()
  })

  it('answers no games for a player with no line, or an id that is no number', async () => {
    await build()
    expect(await readPlayerGames(db, '7')).toEqual({
      playerId: '7',
      games: [],
      draftYear: null,
      reason: null
    })
    expect((await readPlayerGames(db, 'x')).games).toEqual([])
  })

  it('says a file without the table is built at the next refresh', async () => {
    expect(await readPlayerGames(db, '1')).toEqual({
      playerId: '1',
      games: [],
      draftYear: null,
      reason: BUILT_AT_NEXT_REFRESH
    })
  })
})
