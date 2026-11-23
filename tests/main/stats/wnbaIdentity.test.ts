import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import {
  buildIdentity,
  canBuildIdentity,
  IDENTITY_NEEDS,
  IDENTITY_RECIPES,
  identityStale
} from '@main/stats/identity'
import { LEAGUES } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'
import { slow } from '../../fixtures/timeouts'

/**
 * The WNBA's identity recipe on fixtures cut from the real load of 2026-11-17 (the tables as loaded
 * from `~/.cache/metis-dev/wnba-raw`, every column kept): 17 games of the league's schedule and game
 * logs chosen for a trap each (1997's first games, Utah, San Antonio and Las Vegas at home, Portland
 * in 2002 and 2026, an overtime in halves and one in quarters, the two games the schedule lacks, the
 * 2018 forfeit with every 2018 game of its two teams, a Cup group game, Han Xu's first two scoring
 * games of 2023, Marie Gülich's first game, a game of each Cup finalist of 2021 and 2022, a 2026 game
 * with box-score lines only); ESPN's rows for them, its All-Star Games of 2001 and 2025, its Cup
 * finals of 2021 and 2022, a postponed row and a row never played; the crosswalk's rows for them,
 * ESPN's 2018 standings of the forfeit's two teams, every team alias, the groups and the rosters.
 */
const FIXTURES = join(__dirname, '../../fixtures/wnba-identity')
const TABLES: Record<string, string> = {
  src_wnba_schedule: 'schedule',
  src_wnba_game_logs: 'game_logs',
  src_wnba_player_box: 'player_box',
  src_espn_schedule: 'espn_schedule',
  src_espn_player_box: 'espn_player_box',
  src_xwalk_game: 'xwalk_game',
  src_xwalk_player: 'xwalk_player',
  src_team_aliases: 'team_aliases',
  src_team_groups: 'team_groups',
  src_espn_standings: 'espn_standings',
  src_wnba_rosters: 'rosters'
}

const wnba = LEAGUES.wnba
const UTAH_SA_LV = 1611661319
const PORTLAND = 1611661327
const WASHINGTON = 1611661322
const CONNECTICUT = 1611661323
const NEW_YORK = 1611661313
const LOS_ANGELES = 1611661320
const SEATTLE = 1611661328

async function loadFixtures(db: StatsDb): Promise<void> {
  for (const [table, file] of Object.entries(TABLES)) {
    const path = join(FIXTURES, `${file}.parquet`)
    await db.exec(`CREATE TABLE ${table} AS SELECT * FROM read_parquet(${sqlString(path)})`)
  }
}

let db: StatsDb

beforeAll(async () => {
  db = await openTestDb()
  await loadFixtures(db)
  await buildIdentity(db, wnba)
}, slow(30_000))

const game = (id: string): Promise<Record<string, unknown> | null> =>
  db.get<Record<string, unknown>>(`SELECT * FROM game WHERE game_id = ?`, [id])

describe('the recipe', () => {
  it('is the one the registry names, with its own needs and version', async () => {
    const recipe = IDENTITY_RECIPES[wnba.identity]
    expect(recipe.needs).toContain('src_wnba_game_logs')
    expect(recipe.needs).not.toContain('src_nba_schedule')
    expect(IDENTITY_NEEDS).toEqual(expect.arrayContaining([...recipe.needs]))
    expect(await canBuildIdentity(db, wnba)).toBe(true)
    // Built at the WNBA recipe's version: not stale for the WNBA, and nothing to do with the NBA's.
    expect(await identityStale(db, wnba)).toBe(false)
  })

  it('waits for every table it reads', async () => {
    const other = await openTestDb()
    await loadFixtures(other)
    await other.exec('DROP TABLE src_wnba_game_logs')
    expect(await canBuildIdentity(other, wnba)).toBe(false)
  })

  it('builds the same tables with the same columns as the NBA, plus its own', async () => {
    const columns = async (table: string): Promise<string[]> =>
      (
        await db.all<{ name: string }>(
          `SELECT column_name AS name FROM duckdb_columns() WHERE table_name = ? ORDER BY column_index`,
          [table]
        )
      ).map((r) => r.name)
    expect(await columns('game')).toEqual([
      'game_id',
      'nba_game_id',
      'espn_game_id',
      'season',
      'game_type',
      'game_date',
      'home_team_id',
      'away_team_id',
      'home_score',
      'away_score',
      'played',
      'source',
      'neutral',
      'periods',
      'overtimes',
      'forfeit_winner_id'
    ])
    expect(await columns('team')).toEqual([
      'season',
      'team_id',
      'espn_team_id',
      'code',
      'name',
      'conference',
      'division'
    ])
    expect((await columns('player')).slice(0, 6)).toEqual([
      'player_id',
      'name',
      'espn_athlete_id',
      'method',
      'first_season',
      'last_season'
    ])
    expect(await columns('player_ids')).toEqual(['espn_athlete_id', 'player_id', 'method'])
  })
})

describe('games', () => {
  it("take the type from the league's id: regular season and playoffs, and no preseason", async () => {
    expect((await game('1029700001'))?.game_type).toBe('regular')
    expect((await game('1049700001'))?.game_type).toBe('playoffs')
    expect(
      await db.get(
        `SELECT count(*)::INTEGER AS n FROM game WHERE game_type IN ('preseason', 'play-in')`
      )
    ).toEqual({ n: 0 })
  })

  it('carry both ids where both sources have the game', async () => {
    const g = await game('1022600006')
    expect(g).toMatchObject({ nba_game_id: '1022600006', source: 'wnba' })
    expect(g?.espn_game_id).not.toBeNull()
    const unlinked = await db.get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM game WHERE season >= 2002 AND espn_game_id IS NULL`
    )
    // 2018's games of Washington and Las Vegas beyond the forfeit are in the fixture's schedule only,
    // without ESPN's rows: those are the only unlinked ones.
    const extra = await db.get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM src_wnba_schedule
       WHERE season = 2018 AND game_id NOT IN ('1021800001', '1021800022', '1021800162')`
    )
    expect(unlinked).toEqual(extra)
  })

  it('include the two games the schedule lacks, from the game logs', async () => {
    expect(await game('1020700070')).toMatchObject({
      season: 2007,
      game_type: 'regular',
      home_team_id: CONNECTICUT,
      away_team_id: NEW_YORK,
      home_score: 73,
      away_score: 76,
      played: true,
      source: 'game logs',
      espn_game_id: 270620018
    })
    expect(await game('1020900070')).toMatchObject({
      season: 2009,
      home_team_id: NEW_YORK,
      away_team_id: LOS_ANGELES,
      home_score: 60,
      away_score: 69,
      source: 'game logs',
      espn_game_id: 290709009
    })
  })

  it("keep the 2018 forfeit as a played 0-0 game, won by the side ESPN's standings give it", async () => {
    expect(await game('1021800162')).toMatchObject({
      home_team_id: WASHINGTON,
      away_team_id: UTAH_SA_LV,
      home_score: 0,
      away_score: 0,
      played: true,
      overtimes: null,
      forfeit_winner_id: WASHINGTON
    })
    expect(
      await db.get(
        `SELECT count(*)::INTEGER AS n FROM game WHERE forfeit_winner_id IS NOT NULL AND game_id <> '1021800162'`
      )
    ).toEqual({ n: 0 })
  })

  it("take the Commissioner's Cup final from ESPN alone: by its date in 2021, its headline from 2022", async () => {
    expect(await game('espn:401353913')).toMatchObject({
      season: 2021,
      game_type: 'cup-final',
      nba_game_id: null,
      home_team_id: SEATTLE,
      away_team_id: CONNECTICUT,
      home_score: 79,
      away_score: 57,
      played: true,
      source: 'espn',
      neutral: true
    })
    expect(await game('espn:401430112')).toMatchObject({ season: 2022, game_type: 'cup-final' })
    // A Cup group game is an ordinary regular-season game.
    const group = await db.get<{ game_type: string }>(
      `SELECT g.game_type FROM game g JOIN src_espn_schedule e ON e.game_id = g.espn_game_id
       WHERE e.notes_headline = 'WNBA Commissioner''s Cup' AND g.season = 2021`
    )
    expect(group?.game_type).toBe('regular')
  })

  it('take the All-Star Game from ESPN alone, with no league teams', async () => {
    for (const [id, season] of [
      ['espn:210716098', 2001],
      ['espn:401781604', 2025]
    ] as const) {
      expect(await game(id)).toMatchObject({
        season,
        game_type: 'all-star',
        home_team_id: null,
        away_team_id: null,
        played: true
      })
    }
  })

  it("leave out ESPN's postponed rows and a game never played", async () => {
    const left = await db.all(
      `SELECT espn_game_id FROM game WHERE espn_game_id IN (401507167, 401918311)`
    )
    expect(left).toEqual([])
  })

  it("link ESPN's 2002 Portland home games, filed under its id 12, through the crosswalk", async () => {
    expect(await game('1020200006')).toMatchObject({
      espn_game_id: 220529012,
      home_team_id: PORTLAND,
      away_team_id: NEW_YORK
    })
  })

  it('say how many periods regulation had and how many overtimes were played', async () => {
    expect(await game('1020500029')).toMatchObject({ periods: 2, overtimes: 1 })
    expect(await game('1020600019')).toMatchObject({ periods: 4, overtimes: 1 })
    expect(await game('1022600203')).toMatchObject({ periods: 4, overtimes: 0 })
    // The game logs' team minutes are 0 before 2004, and ESPN's rows of 1997 are not final: unknown.
    expect(await game('1029700001')).toMatchObject({ periods: 2, overtimes: null })
  })
})

describe('teams', () => {
  it("follow a franchise by the league's id across a move, with each season's code and ESPN's id", async () => {
    expect(
      await db.all(
        `SELECT season, code, name, espn_team_id FROM team WHERE team_id = ${UTAH_SA_LV}
         AND season IN (2002, 2003, 2018) ORDER BY season`
      )
    ).toEqual([
      { season: 2002, code: 'UTA', name: 'Utah Starzz', espn_team_id: 15 },
      { season: 2003, code: 'SAN', name: 'San Antonio Silver Stars', espn_team_id: 17 },
      { season: 2018, code: 'LVA', name: 'Las Vegas Aces', espn_team_id: 17 }
    ])
  })

  it('keep the 2026 Portland Fire apart from the 2000-2002 club, though both share both ids', async () => {
    expect(
      await db.all(
        `SELECT season, team_id, code, espn_team_id FROM team WHERE abs(team_id) = ${PORTLAND} ORDER BY season`
      )
    ).toEqual([
      { season: 2002, team_id: PORTLAND, code: 'POR', espn_team_id: 132052 },
      { season: 2026, team_id: -PORTLAND, code: 'PDX', espn_team_id: 132052 }
    ])
    expect((await game('1022600006'))?.home_team_id).toBe(-PORTLAND)
    expect((await game('1020200006'))?.home_team_id).toBe(PORTLAND)
  })

  it('have conferences and no divisions', async () => {
    expect(
      await db.get(
        `SELECT count(*)::INTEGER AS n, count(conference)::INTEGER AS conferences,
                count(division)::INTEGER AS divisions FROM team`
      )
    ).toMatchObject({ divisions: 0 })
    const t = await db.get<{ n: number; conferences: number }>(
      `SELECT count(*)::INTEGER AS n, count(conference)::INTEGER AS conferences FROM team`
    )
    expect(t?.conferences).toBe(t?.n)
  })
})

describe('players', () => {
  it("are keyed by the league's id, the players before 2002 by it alone", async () => {
    const early = await db.all<{
      player_id: number
      espn_athlete_id: number | null
      method: string
    }>(
      `SELECT p.player_id, p.espn_athlete_id, p.method FROM player p
       WHERE p.player_id IN (SELECT player_id FROM src_wnba_game_logs WHERE game_id = '1029700001')
         AND p.last_season < 2002`
    )
    expect(early.length).toBeGreaterThan(0)
    for (const p of early) expect(p).toMatchObject({ espn_athlete_id: null, method: 'wnba only' })
    const everyone = await db.get<{ missing: number }>(
      `SELECT count(*)::INTEGER AS missing FROM (
         SELECT DISTINCT player_id FROM src_wnba_game_logs WHERE player_id IS NOT NULL
         EXCEPT SELECT player_id FROM player)`
    )
    expect(everyone).toEqual({ missing: 0 })
  })

  it('match a crosswalk miss by the same box-score lines', async () => {
    expect(
      await db.get(`SELECT player_id, method FROM player_ids WHERE espn_athlete_id = 4337216`)
    ).toEqual({ player_id: 1629566, method: 'box score' })
  })

  it('give an ESPN id the crosswalk puts on two league ids the one it gives most', async () => {
    expect(await db.get(`SELECT player_id FROM player_ids WHERE espn_athlete_id = 1001`)).toEqual({
      player_id: 202657
    })
  })

  it('take the 2026 lines the game logs lack from the box scores', async () => {
    const missing = await db.get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM (
         SELECT DISTINCT person_id FROM src_wnba_player_box WHERE game_id = '1022600203'
         EXCEPT SELECT player_id FROM player)`
    )
    expect(missing).toEqual({ n: 0 })
  })

  it('keep names as published, accents and all', async () => {
    expect(await db.get(`SELECT name FROM player WHERE player_id = 1628895`)).toEqual({
      name: 'Marie Gülich'
    })
  })

  it("carry the roster's position, NULL where no source has one", async () => {
    const p = await db.get<{ position: string | null }>(
      `SELECT position FROM player WHERE player_id = 1628895`
    )
    expect(p?.position).toBe('C')
    expect(await db.get(`SELECT count(*)::INTEGER AS n FROM player WHERE position = ''`)).toEqual({
      n: 0
    })
  })

  it('have one row per player and one league id per ESPN id', async () => {
    expect(
      await db.get(
        `SELECT count(*)::INTEGER AS n, count(DISTINCT player_id)::INTEGER AS ids FROM player`
      )
    ).toMatchObject({})
    const p = await db.get<{ n: number; ids: number }>(
      `SELECT count(*)::INTEGER AS n, count(DISTINCT player_id)::INTEGER AS ids FROM player`
    )
    expect(p?.ids).toBe(p?.n)
    const e = await db.get<{ n: number; ids: number }>(
      `SELECT count(*)::INTEGER AS n, count(DISTINCT espn_athlete_id)::INTEGER AS ids FROM player_ids`
    )
    expect(e?.ids).toBe(e?.n)
  })
})
