import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { readAttributeValues } from '@main/stats/attributeReads'
import { buildAttributes } from '@main/stats/derived/attributes'
import { LEAGUES } from '@shared/leagues'
import { seedProLeague } from '../../fixtures/attributes'
import { openTestDb } from '../../fixtures/stats'

let db: StatsDb
const nba = LEAGUES.nba

beforeEach(async () => {
  db = await openTestDb()
  await seedProLeague(db)
  await db.exec(`CREATE TABLE team_season (team_id BIGINT, season INTEGER)`)
  await db.exec(`INSERT INTO team_season VALUES (10, 2026), (20, 2026), (10, 2025)`)
  await buildAttributes(db, nba)
})

describe('the values an attribute holds in scope (T1701.2)', () => {
  it('counts the players with a counted game in the seasons, most held first', async () => {
    // 2025-26: players 1 (France), 2 (none), 3 (Canada) and 4 (none) played.
    expect(await readAttributeValues(db, 'birthCountry', [2026], nba)).toEqual([
      { value: 'Canada', rows: 1 },
      { value: 'France', rows: 1 }
    ])
    // 2024-25: only players 1 and 2.
    expect(await readAttributeValues(db, 'birthCountry', [2025], nba)).toEqual([
      { value: 'France', rows: 1 }
    ])
  })

  it('reads an attribute that changes by season in each season’s rows', async () => {
    const jerseys = await readAttributeValues(db, 'jersey', [2025, 2026], nba)
    expect(jerseys).toEqual([
      { value: '00', rows: 1 },
      { value: '3', rows: 1 },
      { value: '7', rows: 1 },
      { value: '9', rows: 1 }
    ])
  })

  it('reads a team’s in its team-seasons', async () => {
    expect(await readAttributeValues(db, 'arena', [2026], nba)).toEqual([
      { value: 'Home Hall', rows: 1 }
    ])
  })

  it('reads nothing for an attribute that is not text, or not known', async () => {
    expect(await readAttributeValues(db, 'height', [2026], nba)).toEqual([])
    expect(await readAttributeValues(db, 'shoeSize', [2026], nba)).toEqual([])
    expect(await readAttributeValues(db, 'birthCountry', [], nba)).toEqual([])
  })

  it('reads nothing before the tables are built', async () => {
    const empty = await openTestDb()
    expect(await readAttributeValues(empty, 'birthCountry', [2026], nba)).toEqual([])
  })
})
