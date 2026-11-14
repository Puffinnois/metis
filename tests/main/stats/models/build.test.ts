import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import {
  buildModels,
  canBuildModels,
  markModelSeason,
  MODELS_VERSION,
  modelsDue,
  planModels
} from '@main/stats/models/build'
import { TEAM_STRENGTH_TABLE } from '@main/stats/models/teamStrength'
import { BOS, emptySources, LAL, MIA } from '../../../fixtures/boxScores'
import { addLeague } from '../../../fixtures/models'
import { openTestDb } from '../../../fixtures/stats'

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await addLeague(db)
  await buildDerived(db)
})

const seasonsPlanned = async (): Promise<number[]> => (await planModels(db))[0].seasons

const final = async (team: number, season = 2026): Promise<Record<string, unknown>> =>
  (await db.get(
    `SELECT srs_games, mov, sos, srs, games_left, sos_left FROM ${TEAM_STRENGTH_TABLE}
     WHERE team_id = ? AND season = ? ORDER BY game_date DESC LIMIT 1`,
    [team, season]
  ))!

describe('the models step', () => {
  it('waits for the game tables, and its tables exist empty before the first build', async () => {
    expect(await canBuildModels(db)).toBe(true)
    const empty = await openTestDb()
    expect(await canBuildModels(empty)).toBe(false)
    expect(await empty.get(`SELECT count(*)::INTEGER AS n FROM ${TEAM_STRENGTH_TABLE}`)).toEqual({
      n: 0
    })
  })

  it('computes every season played on a database never built', async () => {
    expect(await modelsDue(db)).toBe(true)
    expect(await planModels(db)).toMatchObject([{ all: true, seasons: [2025, 2026] }])
    // Six team-days in 2025-26 and two in 2024-25; the playoff, All-Star and Cup final games are not solved.
    expect(await buildModels(db, 2026)).toBe(8)
    expect(await modelsDue(db)).toBe(false)
    const bos = await final(BOS)
    expect(bos.srs).toBeCloseTo(8 / 3, 10)
    expect(bos).toMatchObject({ srs_games: 2, mov: 4 })
    expect((await final(LAL)).srs).toBeCloseTo(-2, 10)
    expect((await final(MIA)).srs).toBeCloseTo(-2 / 3, 10)
    expect((await final(BOS, 2025)).srs).toBeCloseTo(3, 10)
    // The game still to come is left after Boston's and Miami's last games.
    expect(bos.games_left).toBe(1)
    expect(bos.sos_left).toBeCloseTo(-2 / 3, 10)
    expect((await final(MIA)).sos_left).toBeCloseTo(8 / 3, 10)
    expect(await final(LAL)).toMatchObject({ games_left: 0, sos_left: null })
    expect(await db.get("SELECT version FROM derived_state WHERE name = 'models'")).toEqual({
      version: MODELS_VERSION
    })
  })

  it('computes only the seasons whose files wrote rows, leaving the others as they are', async () => {
    await buildModels(db, 2026)
    // A row only 2024-25 holds: recomputing 2025-26 must not touch it.
    await db.exec(`INSERT INTO ${TEAM_STRENGTH_TABLE} (season, game_type, team_id, game_id, srs)
      VALUES (2025, 'regular', 1, 'x', 99)`)
    await markModelSeason(db, 2026)
    expect(await modelsDue(db)).toBe(true)
    expect(await seasonsPlanned()).toEqual([2026])
    expect(await buildModels(db, 2026)).toBe(6)
    expect(await db.get(`SELECT srs FROM ${TEAM_STRENGTH_TABLE} WHERE game_id = 'x'`)).toEqual({
      srs: 99
    })
    expect(await modelsDue(db)).toBe(false)
  })

  it('computes every season after a file of every season, a new version or a new shape', async () => {
    await buildModels(db, 2026)
    await markModelSeason(db, 0)
    expect(await seasonsPlanned()).toEqual([2025, 2026])
    await buildModels(db, 2026)
    await db.exec("UPDATE derived_state SET version = 0 WHERE name = 'model:team_strength'")
    expect(await modelsDue(db)).toBe(true)
    expect(await seasonsPlanned()).toEqual([2025, 2026])
    await buildModels(db, 2026)
    await db.exec(`ALTER TABLE ${TEAM_STRENGTH_TABLE} DROP COLUMN sos`)
    expect(await modelsDue(db)).toBe(true)
    expect(await buildModels(db, 2026)).toBe(8)
    expect((await final(BOS)).sos).toBeCloseTo(-4 / 3, 10)
  })

  it('drops a season no longer played when it computes them all', async () => {
    await buildModels(db, 2026)
    await db.exec('DELETE FROM game WHERE season = 2025')
    await markModelSeason(db, 0)
    await buildModels(db, 2026)
    expect(
      await db.get(`SELECT count(*)::INTEGER AS n FROM ${TEAM_STRENGTH_TABLE} WHERE season = 2025`)
    ).toEqual({ n: 0 })
  })

  it('leaves a game never played out of a past season’s schedule: it was cancelled', async () => {
    await buildModels(db, 2027)
    expect(await final(BOS)).toMatchObject({ games_left: 0, sos_left: null })
  })

  it('stays due after a failed run, and its rows stand until a run succeeds', async () => {
    await buildModels(db, 2026)
    await markModelSeason(db, 2026)
    await db.exec('ALTER TABLE game RENAME COLUMN home_score TO hs')
    await expect(buildModels(db, 2026)).rejects.toThrow()
    expect(await modelsDue(db)).toBe(true)
    expect((await final(BOS)).srs).toBeCloseTo(8 / 3, 10)
  })
})
