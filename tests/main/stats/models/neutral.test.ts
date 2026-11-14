import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { inspect } from '@main/stats/derived/sql'
import { buildModels } from '@main/stats/models/build'
import { neutralSitesSql } from '@main/stats/models/neutral'
import { ELO_GAME_TABLE } from '@main/stats/models/teamElo'
import { emptySources } from '../../../fixtures/boxScores'
import { addLeague } from '../../../fixtures/models'
import { openTestDb } from '../../../fixtures/stats'

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await addLeague(db)
  await buildDerived(db)
})

/** ESPN's schedule for the fixture league: Boston is ESPN team 2, the Lakers 13, Miami 14. */
async function addEspn(): Promise<void> {
  await db.exec(`CREATE OR REPLACE TABLE src_espn_schedule (game_id BIGINT, season INTEGER,
    file_season INTEGER, game_date VARCHAR, home_id INTEGER, away_id INTEGER, neutral_site BOOLEAN,
    notes_headline VARCHAR, venue_address_city VARCHAR)`)
  await db.exec(`INSERT INTO src_espn_schedule VALUES
    (1, 2026, 2026, '2025-11-01', 2, 13, true, 'NBA Paris Game', 'Paris'),
    (2, 2026, 2026, '2025-11-02', 13, 14, false, 'NBA In-Season Tournament - Semifinals', 'Las Vegas'),
    (3, 2026, 2026, '2025-11-03', 14, 2, false, NULL, 'Lake Buena Vista'),
    (4, 2026, 2026, '2026-03-01', 2, 14, true, 'NBA Mexico City Game', 'Mexico City'),
    (5, 2026, 2026, '2026-04-20', 13, 14, false, 'East Semifinals - Game 1', 'Los Angeles')`)
  await db.exec(`UPDATE game SET espn_game_id = CASE game_id
    WHEN 'a' THEN 1 WHEN 'b' THEN 2 WHEN 'c' THEN 3 WHEN 'po' THEN 5 END`)
}

const neutral = async (seasons?: { from: number; to: number }): Promise<Record<string, boolean>> =>
  Object.fromEntries(
    (
      await db.all<{ game_id: string; neutral: boolean }>(
        neutralSitesSql(await inspect(db), seasons)
      )
    ).map((r) => [r.game_id, r.neutral])
  )

describe('the neutral sites', () => {
  it('reads ESPN’s mark, the Cup’s semifinals and final, and the 2020 bubble', async () => {
    await addEspn()
    expect(await neutral()).toEqual({
      a: true, // ESPN's mark (a game abroad)
      b: true, // a Cup semifinal, unmarked, by its note
      c: true, // the bubble, unmarked, by its city
      later: true, // not linked to ESPN: matched by its sides and date
      cup: true, // the Cup final, by its type
      star: false,
      po: false, // a playoff "semifinal" is not the Cup's
      old: false
    })
    expect(Object.keys(await neutral({ from: 2025, to: 2025 }))).toEqual(['old'])
  })

  it('keeps only the Cup final without ESPN’s schedule', async () => {
    await db.exec('DROP TABLE IF EXISTS src_espn_schedule')
    const all = await neutral()
    expect(Object.entries(all).filter(([, n]) => n)).toEqual([['cup', true]])
  })

  it('takes home court away in Elo', async () => {
    await addEspn()
    await buildModels(db, 2026)
    const rows = await db.all<{ game_id: string; home_court: number }>(
      `SELECT game_id, home_court FROM ${ELO_GAME_TABLE} WHERE home ORDER BY game_id`
    )
    expect(Object.fromEntries(rows.map((r) => [r.game_id, r.home_court]))).toMatchObject({
      a: 0,
      b: 0,
      c: 0,
      cup: 0,
      later: 0,
      po: 80,
      old: 80
    })
  })
})
