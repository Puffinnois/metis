import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  ATTRIBUTES_VERSION,
  attributesStale,
  buildAttributes,
  canBuildAttributes
} from '@main/stats/derived/attributes'
import { readPlayer, readProfile } from '@main/stats/reads'
import { LEAGUES } from '@shared/leagues'
import { ageReferenceDay, ATTRIBUTES } from '@shared/stats/attributes'
import { seedCollegeLeague, seedProLeague } from '../../../fixtures/attributes'
import { openTestDb } from '../../../fixtures/stats'

let db: StatsDb

type Row = Record<string, unknown>

const player = async (id: number): Promise<Row> =>
  (await db.get<Row>(
    `SELECT * REPLACE (birth_date::VARCHAR AS birth_date, birth_date_roster::VARCHAR AS birth_date_roster,
                       birth_date_espn::VARCHAR AS birth_date_espn)
     FROM player_attributes WHERE player_id = ?`,
    [id]
  )) ?? {}

const season = async (id: number, s: number): Promise<Row> =>
  (await db.get<Row>('SELECT * FROM player_season_attributes WHERE player_id = ? AND season = ?', [
    id,
    s
  ])) ?? {}

/** A date as the table holds it, read as text so no time zone moves it. */
const day = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))

describe('the attribute tables of a professional league', () => {
  beforeEach(async () => {
    db = await openTestDb()
    await seedProLeague(db)
    await buildAttributes(db, LEAGUES.nba)
  })

  it('types what the roster publishes and keeps each source beside the other', async () => {
    const a = await player(1)
    // The latest roster: 6-11 and 220 of the season's last team, not 215 of the first.
    expect(a).toMatchObject({ height_in: 83, weight_lb: 220, school: 'Duke' })
    expect(day(a.birth_date)).toBe('2003-03-30')
    expect(day(a.birth_date_roster)).toBe('2003-03-30')
    // ESPN's date differs by a day: kept beside it, not read over it.
    expect(day(a.birth_date_espn)).toBe('2003-03-29')
    expect(a).toMatchObject({ height_in_espn: 83, weight_lb_espn: 222 })
    expect(a).toMatchObject({ birth_city: 'Paris', birth_country: 'France', country: 'France' })
  })

  it('reads ESPN where the league publishes nothing, and its roster’s text typed', async () => {
    const c = await player(3)
    expect(day(c.birth_date)).toBe('1999-09-02')
    expect(c).toMatchObject({
      birth_city: 'Toronto',
      birth_state: 'ON',
      height_in: 77,
      weight_lb: 205
    })
    expect(c.height_in_roster).toBeNull()
    expect(await season(3, 2026)).toMatchObject({ height_in: 77, weight_lb: 205, jersey: '3' })
  })

  it('reads the draft by the draft’s own year, and ESPN’s where the league’s draft has none', async () => {
    expect(await player(1)).toMatchObject({
      draft_year: 2023,
      draft_round: 1,
      draft_round_pick: 5,
      draft_overall_pick: 5,
      draft_team_code: 'AAA',
      draft_team_name: 'Alpha City',
      draft_organization_type: 'College/University',
      undrafted: false
    })
    // ESPN's athlete file, whose pick is the overall pick; 0 is none.
    expect(await player(3)).toMatchObject({
      draft_year: 2021,
      draft_round: 2,
      draft_overall_pick: 40,
      draft_round_pick: null,
      undrafted: false
    })
    expect(await player(4)).toMatchObject({ draft_year: null, draft_year_espn: null })
  })

  it('reads a pick listed twice as one, with the team only where its rows agree', async () => {
    // Player 1's second row has no team: the team of the row that has one.
    expect((await player(1)).draft_team_code).toBe('AAA')
    // Player 5's pick is listed under two teams: which drafted them is not known.
    expect(await player(5)).toMatchObject({
      draft_year: 2025,
      draft_round: 2,
      draft_round_pick: 3,
      draft_overall_pick: 33,
      draft_team_id: null,
      draft_team_code: null,
      undrafted: false
    })
  })

  it('calls a player undrafted only where it is known', async () => {
    // The bio says so.
    expect((await player(2)).undrafted).toBe(true)
    // Played from 1993-94, before the draft file's first draft (1996): unknown, not undrafted.
    expect((await player(4)).undrafted).toBeNull()
  })

  it('takes the latest combine a player went to, from the tables the profile reads', async () => {
    expect(await player(1)).toMatchObject({
      combine_year: 2023,
      combine_position: 'PG',
      combine_height_wo_shoes: 82,
      combine_weight_lb: 212,
      combine_wingspan: 87,
      combine_max_vertical_leap: 38.5,
      combine_bench_press: 12
    })
    expect((await player(2)).combine_year).toBeNull()
  })

  it('counts the seasons with a counted game, and numbers them where the first is known', async () => {
    expect(await player(1)).toMatchObject({
      first_season: 2024,
      last_season: 2026,
      seasons_played: 3
    })
    expect((await season(1, 2026)).season_number).toBe(3)
    // Player 4 played in the league's first loaded season: they may have played before it.
    expect((await season(4, 2026)).season_number).toBeNull()
  })

  it('holds the season’s line: last team, jersey, experience, how acquired, the roster as published', async () => {
    expect(await season(1, 2026)).toMatchObject({
      team_id: 20,
      team_code: 'BBB',
      jersey: '00',
      position: 'G-F',
      experience: 1,
      experience_espn: 2,
      how_acquired: 'Traded from AAA on 01/02/26',
      roster_height: '6-11',
      roster_birth_date: 'MAR 30, 2003',
      roster_experience: '1'
    })
    // "R" is a rookie: no seasons before; an empty text is NULL.
    expect(await season(1, 2025)).toMatchObject({ experience: 0, jersey: '7' })
    expect(await season(2, 2026)).toMatchObject({ experience: 0, jersey: null })
    expect((await player(2)).school).toBe('Iowa')
  })

  it('gives each team its arena of most home games, its head coaches and its city', async () => {
    const t = await db.get<Row>(
      'SELECT * FROM team_attributes WHERE team_id = 10 AND season = 2026'
    )
    expect(t).toMatchObject({
      code: 'AAA',
      conference: 'east',
      division: 'atlantic',
      city: 'Alpha City',
      // Neutral sites are not home: the three abroad do not outweigh two at home.
      arena: 'Home Hall',
      arena_city: 'Alphaville',
      arena_state: 'AA',
      arena_capacity: 18000,
      head_coach: 'First Head / Second Head',
      first_season: 2025
    })
    const b = await db.get<Row>(
      'SELECT * FROM team_attributes WHERE team_id = 20 AND season = 2026'
    )
    // An interim head coach is the season's head coach.
    expect(b).toMatchObject({ arena: null, head_coach: 'Stand In', city: null })
  })

  it('is what the player page’s header and profile read, not the roster again', async () => {
    await db.exec(`ALTER TABLE player_season ADD COLUMN position VARCHAR DEFAULT 'G'`)
    // A roster changed after the build is not read: the page shows the table's line.
    await db.exec(`UPDATE src_nba_rosters SET num = '99', height = '7-7' WHERE player_id = 1`)
    expect(await readPlayer(db, '1')).toMatchObject({
      number: '00',
      height: '6-11',
      weight: '220',
      birthDate: 'MAR 30, 2003',
      school: 'Duke'
    })
    const profile = await readProfile(db, '1', LEAGUES.nba)
    expect(profile.bio).toMatchObject({
      season: 2026,
      number: '00',
      height: '6-11',
      experience: '1'
    })
    expect(profile.draft).toMatchObject({ year: 2023, roundPick: 5, overallPick: 5 })
    // ESPN's draft where the league's has none, as the filter reads it.
    expect((await readProfile(db, '3', LEAGUES.nba)).draft).toMatchObject({
      year: 2021,
      round: 2,
      roundPick: null,
      overallPick: 40,
      team: null
    })
  })

  it('records its version, so the next refresh builds it only when the rules change', async () => {
    expect(await attributesStale(db)).toBe(false)
    const v = await db.get<{ version: number }>(
      "SELECT version FROM derived_state WHERE name = 'attributes'"
    )
    expect(v?.version).toBe(ATTRIBUTES_VERSION)
  })
})

describe('the attribute tables of a college league', () => {
  beforeEach(async () => {
    db = await openTestDb()
    await seedCollegeLeague(db)
    await buildAttributes(db, LEAGUES.ncaam)
  })

  it('reads stats.ncaa.org’s roster through its ids, and ESPN’s class in the same words', async () => {
    expect(await player(7)).toMatchObject({
      hometown: 'Newport, ME',
      high_school: 'Montverde Academy',
      height_in: 81,
      draft_year: null,
      undrafted: null
    })
    expect(day((await player(7)).birth_date)).toBe('2006-12-21')
    expect(await season(7, 2026)).toMatchObject({
      class: 'Fr.',
      jersey: '2',
      team_code: 'DUKE',
      experience: null,
      experience_espn: null
    })
    expect((await season(8, 2026)).class).toBe('So.')
    expect(await season(8, 2026)).toMatchObject({ height_in: 74, weight_lb: 190, jersey: '11' })
  })

  it('reads "---" as no class', async () => {
    expect((await season(9, 2026)).class).toBeNull()
  })

  it('gives a college no city, only its arena’s, and its Division I flag', async () => {
    const t = await db.get<Row>('SELECT * FROM team_attributes WHERE team_id = 150')
    expect(t).toMatchObject({ code: 'DUKE', conference: 'ACC', city: null, division_i: true })
  })
})

describe('a league with little loaded', () => {
  it('builds with every missing source read as NULL', async () => {
    db = await openTestDb()
    await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR, first_season INTEGER,
      last_season INTEGER)`)
    await db.exec(`INSERT INTO player VALUES (1, 'Only Name', 2026, 2026)`)
    await db.exec(`CREATE TABLE team (season INTEGER, team_id BIGINT, espn_team_id INTEGER,
      code VARCHAR, name VARCHAR, conference VARCHAR, division VARCHAR)`)
    expect(await buildAttributes(db, LEAGUES.wnba)).toBe(1)
    const only = await db.get<Row>('SELECT * FROM player_attributes')
    expect(only).toMatchObject({ name: 'Only Name', birth_date: null, seasons_played: 0 })
  })

  it('builds nothing before the identity tables are there', async () => {
    db = await openTestDb()
    expect(await canBuildAttributes(db)).toBe(false)
    expect(await buildAttributes(db, LEAGUES.nba)).toBe(0)
  })
})

describe('the registry', () => {
  it('names a column of the built tables for every attribute', async () => {
    db = await openTestDb()
    await seedProLeague(db)
    await buildAttributes(db, LEAGUES.nba)
    const tables = {
      player: 'player_attributes',
      playerSeason: 'player_season_attributes',
      team: 'team_attributes'
    }
    for (const a of ATTRIBUTES) {
      const row = await db.get<{ n: number }>(
        `SELECT count(*) AS n FROM duckdb_columns() WHERE table_name = ? AND column_name = ?`,
        [tables[a.table], a.column]
      )
      expect(Number(row?.n), `${a.id}: ${tables[a.table]}.${a.column}`).toBe(1)
    }
  })

  it('counts age on January 31, and on July 1 in the WNBA, of the season’s final year', () => {
    expect(ageReferenceDay('nba', 2026)).toBe('2026-01-31')
    expect(ageReferenceDay('ncaaw', 2026)).toBe('2026-01-31')
    expect(ageReferenceDay('wnba', 2020)).toBe('2020-07-01')
  })

  it('tells apart the attributes it holds from two sources or times, by label and byline', () => {
    const of = (id: string) => ATTRIBUTES.find((a) => a.id === id)
    const pairs = [
      ['country', 'birthCountry'],
      ['height', 'seasonHeight'],
      ['height', 'heightNoShoes'],
      ['weight', 'seasonWeight'],
      ['weight', 'combineWeight'],
      ['city', 'arenaCity']
    ]
    for (const [a, b] of pairs) {
      expect(of(a)?.label, a).not.toBe(of(b)?.label)
      expect(of(a)?.byline, a).toBeTruthy()
      expect(of(b)?.byline, b).toBeTruthy()
      expect(of(a)?.byline).not.toBe(of(b)?.byline)
    }
  })

  it('has unique ids, a description and a coverage in every league', () => {
    expect(new Set(ATTRIBUTES.map((a) => a.id)).size).toBe(ATTRIBUTES.length)
    for (const a of ATTRIBUTES) {
      expect(a.description.length).toBeGreaterThan(10)
      expect(Object.keys(a.leagues).sort()).toEqual(['nba', 'ncaam', 'ncaaw', 'wnba'])
      if (a.type === 'enum') expect(a.values?.length).toBeGreaterThan(0)
    }
  })
})
