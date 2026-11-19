import { readdirSync } from 'node:fs'
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
import { POSTSEASON_EVENT_SQL } from '@main/stats/identityCollege'
import { LEAGUES, type League } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'

/**
 * The college identity recipe on fixtures cut from the first loads of T1302.3 (every column kept),
 * one game or contest for each trap the real build met:
 *
 * - men: Hawaii's games of 2021-11-09 to 14, where the crosswalk gives the Hawaii Hilo game the id of
 *   the Northern Colorado one and stats.ncaa.org gives Hawaii Hilo Northern Colorado's team id;
 *   Towson against Delaware, postponed from 2022-01-27 (stats.ncaa.org's date) to 2022-02-28 (ESPN's);
 *   Iowa against Virginia Tech of 2026-11-10, which stats.ncaa.org lists twice; an exhibition
 *   (Clemson against Georgia Southwestern, 2021-11-01) and the one real game the exhibition rule loses
 *   (Alabama State against Tuskegee); a game of each event, a conference tournament game, an early
 *   season event, a forfeit, a double overtime, a cancelled and a scheduled row; links by each method;
 *   Alex Karaban's 2026 lines, which the player crosswalk lacks; Nick Boyd's transfer;
 * - women: the 2024-25 WNIT final and a WBIT game ESPN lacks, a regular-season game it lacks, Virginia
 *   Tech's exhibition of 2024-10-22, the NCAA tournament's two spellings, the WNIT, WBI and WBIT, and
 *   a forfeit.
 */
const FIXTURES = join(__dirname, '../../fixtures/college-identity')

async function load(db: StatsDb, league: League, without: string[] = []): Promise<void> {
  for (const file of readdirSync(join(FIXTURES, league.id))) {
    const table = `src_${file.replace(/\.parquet$/, '')}`
    if (without.some((prefix) => table.startsWith(prefix))) continue
    const path = join(FIXTURES, league.id, file)
    await db.exec(`CREATE TABLE ${table} AS SELECT * FROM read_parquet(${sqlString(path)})`)
  }
}

const men = LEAGUES.ncaam
const women = LEAGUES.ncaaw
const HAWAII = 62
const NORTHERN_COLORADO = 2458
const TOWSON = 119
const DELAWARE = 48
const KARABAN = 4917149
const BOYD = 4702654

let m: StatsDb
let w: StatsDb

beforeAll(async () => {
  m = await openTestDb()
  await load(m, men)
  await buildIdentity(m, men)
  w = await openTestDb()
  await load(w, women)
  await buildIdentity(w, women)
}, 60_000)

type Row = Record<string, unknown>
const game = (db: StatsDb, id: string): Promise<Row | null> =>
  db.get<Row>('SELECT * FROM game WHERE game_id = ?', [id])
const byContest = (db: StatsDb, contest: string): Promise<Row | null> =>
  db.get<Row>('SELECT * FROM game WHERE ncaa_game_id = ?', [contest])
const count = async (db: StatsDb, sql: string): Promise<number> =>
  (await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM (${sql})`))?.n ?? -1

describe('the recipe', () => {
  it('is one for both leagues, named for what it is, and needs only ESPN and the groups', async () => {
    expect(men.identity).toBe('college')
    expect(women.identity).toBe('college')
    const recipe = IDENTITY_RECIPES.college
    expect([...recipe.needs].sort()).toEqual([
      'src_espn_player_box',
      'src_espn_schedule',
      'src_team_groups'
    ])
    expect(IDENTITY_NEEDS).toEqual(expect.arrayContaining([...recipe.needs]))
    expect(recipe.needs.some((t) => t.startsWith('src_ncaa_'))).toBe(false)
    expect(await canBuildIdentity(m, men)).toBe(true)
    expect(await identityStale(m, men)).toBe(false)
  })

  it('writes the columns every recipe writes, then its own', async () => {
    const columns = async (table: string): Promise<string[]> =>
      (
        await m.all<{ name: string }>(
          `SELECT column_name AS name FROM duckdb_columns() WHERE table_name = ? ORDER BY column_index`,
          [table]
        )
      ).map((r) => r.name)
    expect(await columns('game')).toEqual([
      'game_id',
      'nba_game_id',
      'espn_game_id',
      'ncaa_game_id',
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
      'forfeit_winner_id',
      'tournament_id',
      'event',
      'conference_game'
    ])
    expect((await columns('team')).slice(0, 7)).toEqual([
      'season',
      'team_id',
      'espn_team_id',
      'code',
      'name',
      'conference',
      'division'
    ])
    expect(await columns('team')).toEqual(
      expect.arrayContaining(['division_i', 'conference_id', 'ncaa_team_id', 'ncaa_org_id'])
    )
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
  it("are ESPN's, one row per game_id, keyed by its id; no cancelled row, and the current season's unplayed", async () => {
    expect(await count(m, 'SELECT game_id FROM game GROUP BY 1 HAVING count(*) > 1')).toBe(0)
    expect(await game(m, '401469848')).toBeNull()
    expect(await game(m, '401922015')).toMatchObject({ season: 2027, played: false })
    expect(await game(m, '401370836')).toMatchObject({
      nba_game_id: null,
      espn_game_id: 401370836,
      source: 'espn'
    })
  })

  it('take their type from the event, by its headline (D45)', async () => {
    const type = async (id: string): Promise<unknown> => (await game(m, id))?.game_type
    // "Men's Basketball Championship" in 2021-22, "NCAA Men's Basketball Championship" in 2025-26.
    expect(await type('401408570')).toBe('playoffs')
    expect(await type('401856434')).toBe('playoffs')
    expect(await type('401411696')).toBe('nit')
    expect(await type('401411720')).toBe('cbi')
    expect(await type('401421315')).toBe('tbc')
    expect(await type('401648804')).toBe('cit')
    expect(await type('401758614')).toBe('crown')
    const wtype = async (id: string): Promise<unknown> => (await game(w, id))?.game_type
    // "NCAA Women's Championship pres. by Capital One", then "NCAA Women's Basketball Championship".
    expect(await wtype('401412964')).toBe('playoffs')
    expect(await wtype('401856467')).toBe('playoffs')
    expect(await wtype('401415936')).toBe('wnit')
    expect(await wtype('401415939')).toBe('wbi')
    expect(await wtype('401641599')).toBe('wbit')
  })

  it('keep conference tournaments and early-season events in the regular season, flagged', async () => {
    expect(await game(m, '401403310')).toMatchObject({
      game_type: 'regular',
      conference_game: true
    })
    const conference = await game(m, '401403310')
    expect(conference?.tournament_id).not.toBeNull()
    expect(conference?.event).toEqual(expect.any(String))
    const early = await m.get<Row>(
      `SELECT g.* FROM game g JOIN src_espn_schedule s ON s.game_id = g.espn_game_id
       WHERE s.season_type = 2 AND s.tournament_id IS NOT NULL AND NOT coalesce(s.conference_competition, false)`
    )
    expect(early).toMatchObject({ game_type: 'regular', conference_game: false })
    expect(early?.tournament_id).not.toBeNull()
  })

  it('keep a forfeit as played, its 2-0 as published and its winner named', async () => {
    const g = await game(m, '401370817')
    expect(g).toMatchObject({ played: true, overtimes: null })
    expect(g?.forfeit_winner_id).toBe(
      (g?.home_score as number) > (g?.away_score as number) ? g?.home_team_id : g?.away_team_id
    )
    expect((g?.home_score as number) + (g?.away_score as number)).toBe(2)
  })

  it('count the periods by league and the overtimes past them', async () => {
    expect(await game(m, '401364376')).toMatchObject({ periods: 2, overtimes: 2 })
    expect(await count(w, 'SELECT * FROM game WHERE periods <> 4')).toBe(0)
  })
})

describe("stats.ncaa.org's games", () => {
  it('link through its id, the crosswalk, or the same two teams', async () => {
    expect((await byContest(m, '6457578'))?.game_id).toBe('401806478')
    expect((await byContest(m, '2152901'))?.game_id).toBe('401370836')
    expect((await byContest(m, '2148660'))?.game_id).toBe('401373677')
  })

  it("rank an exact match above an id the source gives wrong (Hawaii's games of 2021-11-11)", async () => {
    // The crosswalk gives Hawaii Hilo's game the id of Northern Colorado's.
    expect((await byContest(m, '2140211'))?.game_id).toBe('401372586')
    expect(await game(m, '401372586')).toMatchObject({
      home_team_id: HAWAII,
      away_team_id: NORTHERN_COLORADO
    })
    expect((await byContest(m, '2140135'))?.game_id).toBe('401373624')
  })

  it('link a postponed game whatever the dates, by its teams and score', async () => {
    expect(await byContest(m, '2150554')).toMatchObject({
      game_id: '401418130',
      home_team_id: TOWSON,
      away_team_id: DELAWARE,
      home_score: 69,
      away_score: 57
    })
    expect(
      await count(
        m,
        `SELECT * FROM game WHERE season = 2022 AND ${TOWSON} IN (home_team_id, away_team_id)
           AND ${DELAWARE} IN (home_team_id, away_team_id)`
      )
    ).toBe(3)
  })

  it('make no game of a contest listed twice, nor of an exhibition', async () => {
    expect(await byContest(m, '6638547')).toBeNull()
    expect(await byContest(m, '6670672')).toMatchObject({ game_id: '401920378' })
    expect(await byContest(m, '2139618')).toBeNull()
    // The rule's one real loss: Alabama State against Tuskegee, a team no source gives an ESPN id.
    expect(await byContest(m, '2142614')).toBeNull()
    expect(await count(m, "SELECT * FROM game WHERE source = 'ncaa'")).toBe(0)
  })

  it("fill the games ESPN lacks, keyed by ESPN's id, typed by the event their teams played", async () => {
    expect(await game(w, '401762436')).toMatchObject({
      ncaa_game_id: '6366953',
      espn_game_id: 401762436,
      source: 'ncaa',
      game_type: 'wnit',
      season: 2025,
      home_score: 88,
      away_score: 84,
      played: true,
      neutral: null,
      periods: 4
    })
    expect(await game(w, '401757018')).toMatchObject({ source: 'ncaa', game_type: 'wbit' })
    expect(await game(w, '401715020')).toMatchObject({ source: 'ncaa', game_type: 'regular' })
    // Virginia Tech's exhibition with Limestone, 2024-10-22.
    expect(await count(w, "SELECT * FROM game WHERE game_date = DATE '2024-10-22'")).toBe(0)
  })
})

describe('teams', () => {
  it('are every team of the season, with the Division I flag and conference from the groups', async () => {
    expect(
      await m.get<Row>('SELECT * FROM team WHERE season = 2022 AND team_id = ?', [HAWAII])
    ).toMatchObject({
      espn_team_id: HAWAII,
      division_i: true,
      conference: 'Big West',
      conference_id: 'mbb:big-west'
    })
    const outside = await m.get<Row>(
      "SELECT * FROM team WHERE season = 2022 AND name LIKE 'Hawaii-Hilo%'"
    )
    expect(outside).toMatchObject({ division_i: false, conference: null })
    expect(
      await count(
        m,
        `SELECT * FROM (SELECT season, home_team_id t FROM game UNION ALL SELECT season, away_team_id FROM game) g
         WHERE NOT EXISTS (SELECT 1 FROM team x WHERE x.season = g.season AND x.team_id = g.t)`
      )
    ).toBe(0)
    expect(await count(m, 'SELECT * FROM team WHERE division_i AND ncaa_team_id IS NULL')).toBe(0)
  })
})

describe('players', () => {
  it("are ESPN's athletes, keyed by their id across a transfer", async () => {
    expect(await m.get<Row>('SELECT * FROM player WHERE player_id = ?', [BOYD])).toMatchObject({
      name: 'Nick Boyd',
      espn_athlete_id: BOYD,
      method: 'espn',
      first_season: 2025,
      last_season: 2026
    })
    expect(
      await count(m, `SELECT DISTINCT team_id FROM src_espn_player_box WHERE athlete_id = ${BOYD}`)
    ).toBe(2)
    expect(await count(m, 'SELECT * FROM player_ids WHERE player_id <> espn_athlete_id')).toBe(0)
  })

  it("map stats.ncaa.org's players by the crosswalk, else their box-score lines, else their name", async () => {
    // The 2025-26 crosswalk lacks Alex Karaban; two equal lines find him.
    expect(
      await m.get<Row>(
        "SELECT player_id, method FROM ncaa_player_ids WHERE season = 2026 AND player = 'ALEX.KARABAN'"
      )
    ).toEqual({ player_id: KARABAN, method: 'box score' })
    const methods = await m.all<{ method: string }>(
      'SELECT DISTINCT method FROM ncaa_player_ids ORDER BY 1'
    )
    expect(methods.map((r) => r.method)).toEqual(
      expect.arrayContaining(['box score', 'crosswalk', 'name'])
    )
    // A line with no player id is a player of its team by name.
    expect(
      await count(
        m,
        "SELECT * FROM ncaa_player_ids WHERE ncaa_player_id IS NULL AND method = 'name'"
      )
    ).toBeGreaterThan(0)
  })

  it("give whoever is left D28's key, negative, and a name", async () => {
    const left = await m.all<{ player_id: number; ncaa_player_id: string | null; name: string }>(
      "SELECT player_id, ncaa_player_id, name FROM ncaa_player_ids WHERE method = 'ncaa only'"
    )
    for (const r of left) {
      expect(r.player_id).toBeLessThan(0)
      if (r.ncaa_player_id !== null) expect(r.player_id).toBe(-Number(r.ncaa_player_id))
      expect(r.name).toMatch(/^[A-Z]/)
    }
    expect(
      await count(
        m,
        `SELECT * FROM ncaa_player_ids i WHERE i.method = 'ncaa only'
           AND NOT EXISTS (SELECT 1 FROM player p WHERE p.player_id = i.player_id AND p.method = 'ncaa only')`
      )
    ).toBe(0)
  })
})

describe('without the ncaa_* releases (D41)', () => {
  it("build from ESPN's tables alone, with no stats.ncaa.org link and an empty mapping", async () => {
    for (const league of [men, women]) {
      const db = await openTestDb()
      await load(db, league, ['src_ncaa_'])
      expect(await canBuildIdentity(db, league)).toBe(true)
      const games = await buildIdentity(db, league)
      expect(games).toBe(
        await count(
          db,
          'SELECT * FROM src_espn_schedule WHERE status_type_completed OR season = 2027'
        )
      )
      expect(await count(db, 'SELECT * FROM game WHERE ncaa_game_id IS NOT NULL')).toBe(0)
      expect(await count(db, 'SELECT * FROM ncaa_player_ids')).toBe(0)
      expect(await count(db, "SELECT * FROM player WHERE method <> 'espn'")).toBe(0)
      expect(await count(db, 'SELECT * FROM team WHERE division_i')).toBeGreaterThan(0)
    }
  })
})

describe('the event rule', () => {
  it('reads every spelling of the window, and the smaller events before the NCAA tournament', async () => {
    const events = (
      await m.all<{ h: string; e: string }>(
        `SELECT h, ${POSTSEASON_EVENT_SQL('lower(h)', 'NULL::INTEGER')} AS e FROM (VALUES
           ('Men''s Basketball Championship - East Region - 1st Round'),
           ('NCAA Men''s Basketball Championship - Final Four'),
           ('NCAA Women''s Championship pres. by Capital One - Final Four'),
           ('NCAA Women''s Basketball Championship - 2nd Round'),
           ('NIT - First Round'),
           ('Women''s NIT - Championship'),
           ('Roman CBI Championship'),
           ('CIT Championship Game'),
           ('The Basketball Classic - Semifinal'),
           ('College Basketball Crown Championship Game'),
           ('WBI Championship Game'),
           ('WBIT Championship Game'),
           ('Something new')) t(h) ORDER BY h`
      )
    ).map((r) => [r.h, r.e])
    expect(Object.fromEntries(events)).toEqual({
      "Men's Basketball Championship - East Region - 1st Round": 'playoffs',
      "NCAA Men's Basketball Championship - Final Four": 'playoffs',
      "NCAA Women's Championship pres. by Capital One - Final Four": 'playoffs',
      "NCAA Women's Basketball Championship - 2nd Round": 'playoffs',
      'NIT - First Round': 'nit',
      "Women's NIT - Championship": 'wnit',
      'Roman CBI Championship': 'cbi',
      'CIT Championship Game': 'cit',
      'The Basketball Classic - Semifinal': 'tbc',
      'College Basketball Crown Championship Game': 'crown',
      'WBI Championship Game': 'wbi',
      'WBIT Championship Game': 'wbit',
      'Something new': 'regular'
    })
  })
})
