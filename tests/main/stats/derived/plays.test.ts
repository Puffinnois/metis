import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  buildPlays,
  markPlaySeason,
  PLAYS_VERSION,
  playsStale
} from '@main/stats/derived/playBuilders'
import { espnPlaysSql, PLAY_COLUMNS, PLAY_FLAGS, PLAY_TABLES } from '@main/stats/derived/plays'
import { inspect } from '@main/stats/derived/sql'

const VIEW_KIND = "SELECT table_type FROM information_schema.tables WHERE table_name = 'play_espn'"
import { POSSESSION_COLUMNS, SHOT_COLUMNS } from '@main/stats/derived/events'
import { openTestDb } from '../../../fixtures/stats'
import {
  createEspnPbp,
  createIdentity,
  createNbaPbp,
  DORT,
  DURANT,
  GAME,
  HOLMGREN,
  HOU,
  OKC,
  SENGUN,
  SMITH,
  THOMPSON,
  WALLACE
} from '../../../fixtures/plays'

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
})

type Line = Record<(typeof PLAY_FLAGS)[number], number>

/** A player's line from the flags: the actor's counts, and the credits by their own ids. */
async function line(table: string, player: number): Promise<Partial<Line>> {
  const row = await db.get<Line>(
    `SELECT ${PLAY_FLAGS.filter((f) => !['ast', 'stl', 'blk'].includes(f))
      .map((f) => `coalesce(sum(${f}) FILTER (WHERE player_id = ${player}), 0)::INTEGER AS ${f}`)
      .join(', ')},
       count(*) FILTER (WHERE assist_id = ${player})::INTEGER AS ast,
       count(*) FILTER (WHERE steal_id = ${player})::INTEGER AS stl,
       count(*) FILTER (WHERE block_id = ${player})::INTEGER AS blk
     FROM ${table}`
  )
  // Only what is not zero, so each expectation reads as the player's box-score line.
  return Object.fromEntries(Object.entries(row ?? {}).filter(([, v]) => v !== 0))
}

describe('the NBA play table', () => {
  beforeEach(async () => {
    await createIdentity(db)
    await createNbaPbp(db)
    await buildPlays(db)
  })

  it('rebuilds each player’s box-score line from the flags', async () => {
    const t = PLAY_TABLES.nba
    expect(await line(t, HOLMGREN)).toEqual({ fga: 1, fgm: 1, fta: 1, ftm: 1, pts: 3 })
    // The assist is in the shot's description, the steal and the block are rows of their own.
    expect(await line(t, DORT)).toEqual({ fga: 1, tov: 1, ast: 1 })
    // A heave is not a field-goal attempt.
    expect(await line(t, SENGUN)).toEqual({ fga: 1, fg3a: 1, dreb: 1, stl: 1, blk: 1 })
    // Two rebounds out of order are both offensive, as the running counts say.
    expect(await line(t, WALLACE)).toEqual({ oreb: 2, dreb: 1 })
    // A technical is no personal foul; two rebounds written with the same counts share the jump;
    // the description names "Smith" where the feed now says "Smith Jr.".
    expect(await line(t, SMITH)).toEqual({ oreb: 2, pf: 1, ast: 1 })
    expect(await line(t, DURANT)).toEqual({
      fga: 2,
      fgm: 2,
      fg3a: 1,
      fg3m: 1,
      fta: 2,
      ftm: 1,
      pts: 6
    })
    // "Thompson" in the description is "Thómpson" in the feed.
    expect(await line(t, THOMPSON)).toEqual({ fga: 1, fg3a: 1, ast: 1 })
  })

  it('keeps a team’s own rows: a rebound after its own miss is offensive', async () => {
    expect(
      await db.all(
        `SELECT kind, team_id, opponent_id, oreb::INTEGER AS oreb, dreb::INTEGER AS dreb,
                tov::INTEGER AS tov
         FROM ${PLAY_TABLES.nba} WHERE player_id IS NULL AND kind IN ('rebound', 'turnover')
         ORDER BY seq`
      )
    ).toEqual([
      { kind: 'rebound', team_id: HOU, opponent_id: OKC, oreb: 1, dreb: 0, tov: 0 },
      { kind: 'turnover', team_id: HOU, opponent_id: OKC, oreb: 0, dreb: 0, tov: 1 }
    ])
  })

  it('carries the score forward, keys the plays to the game and times them', async () => {
    const rows = await db.all<{ seq: number; home_after: number; away_after: number }>(
      `SELECT seq, home_after, away_after FROM ${PLAY_TABLES.nba} ORDER BY seq`
    )
    expect(rows.at(-1)).toMatchObject({ home_after: 3, away_after: 6 })
    expect(rows[5]).toMatchObject({ home_after: 2, away_after: 0 })
    expect(
      await db.get(
        `SELECT game_id, season, game_type, period, clock, elapsed, home_before, away_before, home
         FROM plays WHERE source = 'nba' AND seq = 6`
      )
    ).toEqual({
      game_id: GAME,
      season: 2026,
      game_type: 'regular',
      period: 1,
      clock: 540,
      elapsed: 180,
      home_before: 2,
      away_before: 0,
      home: true
    })
  })

  it('reads the old feed’s 0-0 as no score, on rows that score nothing and on one that scores', async () => {
    const scores = (): Promise<unknown[]> =>
      db.all(`SELECT seq, home_after, away_after FROM ${PLAY_TABLES.nba} ORDER BY seq`)
    const before = await scores()
    // Before 2017-18 the feed writes "0" and "0" where it has no score, and on a few scoring rows.
    await db.exec(`UPDATE src_nba_pbp SET score_home = '0', score_away = '0' WHERE score_home = ''`)
    const last = await db.get<{ o: number }>(
      `SELECT max(order_index)::INTEGER AS o FROM src_nba_pbp WHERE score_home NOT IN ('', '0')`
    )
    await db.exec(`UPDATE src_nba_pbp SET score_home = '0', score_away = '0'
                   WHERE order_index = ${last?.o}`)
    await db.exec(`DELETE FROM derived_state WHERE name = 'plays'`)
    await buildPlays(db)
    expect(await scores()).toEqual(before)
    // No row's score goes below the one before it, nor back to 0-0 once a point is scored.
    expect(
      await db.get(
        `SELECT count(*)::INTEGER AS n FROM (
           SELECT home_after, away_after,
                  lag(home_after) OVER w AS h0, lag(away_after) OVER w AS a0,
                  sum(pts) OVER w AS scored
           FROM ${PLAY_TABLES.nba} WINDOW w AS (PARTITION BY game_id ORDER BY seq))
         WHERE home_after < h0 OR away_after < a0 OR (scored > 0 AND home_after + away_after = 0)`
      )
    ).toEqual({ n: 0 })
  })

  it('marks the steal and the block rows apart, with no flag of their own', async () => {
    expect(
      await db.all(
        `SELECT kind, player_id, (${PLAY_FLAGS.join(' + ')})::INTEGER AS flags
         FROM ${PLAY_TABLES.nba} WHERE kind IN ('steal', 'block') ORDER BY seq`
      )
    ).toEqual([
      { kind: 'steal', player_id: SENGUN, flags: 0 },
      { kind: 'block', player_id: SENGUN, flags: 0 }
    ])
  })

  it('records its version, so the next refresh does not build it again', async () => {
    expect(await playsStale(db)).toBe(false)
    expect(await db.get("SELECT version FROM derived_state WHERE name = 'plays'")).toEqual({
      version: PLAYS_VERSION
    })
  })
})

describe('the ESPN play table', () => {
  beforeEach(async () => {
    await createIdentity(db)
    await createEspnPbp(db)
    await buildPlays(db)
  })

  it('rebuilds each player’s box-score line from the flags', async () => {
    const t = PLAY_TABLES.espn
    // A made free throw reads 1 point though `score_value` says 0.
    expect(await line(t, HOLMGREN)).toEqual({ fga: 1, fgm: 1, fta: 1, ftm: 1, pts: 3 })
    expect(await line(t, DORT)).toEqual({ fga: 1, tov: 1, ast: 1 })
    // A three from the description.
    expect(await line(t, SENGUN)).toEqual({ fga: 1, fg3a: 1, stl: 1, blk: 1 })
    expect(await line(t, WALLACE)).toEqual({ dreb: 1 })
    expect(await line(t, SMITH)).toEqual({ pf: 1 })
    // A heave is not a field-goal attempt; travelling is a turnover.
    expect(await line(t, DURANT)).toEqual({ fga: 1, fgm: 1, fg3a: 1, fg3m: 1, pts: 3, tov: 1 })
    // A three from the coordinates: in the corner, 23 feet to the side.
    expect(await line(t, THOMPSON)).toEqual({ fga: 1, fg3a: 1, ast: 1 })
  })

  it('keeps a team rebound with no athlete as the team’s', async () => {
    expect(
      await db.all(
        `SELECT team_id, oreb::INTEGER AS oreb FROM ${PLAY_TABLES.espn}
         WHERE player_id IS NULL AND kind = 'rebound'`
      )
    ).toEqual([{ team_id: HOU, oreb: 1 }])
  })

  it('swaps the score when ESPN’s home side is the game’s away side', async () => {
    const swapped = await openTestDb()
    await createIdentity(swapped, true)
    await createEspnPbp(swapped)
    await buildPlays(swapped)
    expect(
      await swapped.get(
        `SELECT max(home_after) AS home, max(away_after) AS away,
                any_value(team_id) FILTER (WHERE player_id = ${HOLMGREN}) AS holmgren,
                bool_and(NOT home) FILTER (WHERE player_id = ${HOLMGREN}) AS away_side
         FROM ${PLAY_TABLES.espn}`
      )
    ).toEqual({ home: 3, away: 3, holmgren: OKC, away_side: true })
  })
})

describe('building with something missing', () => {
  it('builds empty tables and views when neither feed is loaded', async () => {
    await createIdentity(db)
    expect(await buildPlays(db)).toBe(0)
    for (const t of [
      ...Object.values(PLAY_TABLES),
      'plays',
      'shot_nba',
      'shot_espn',
      'possession'
    ]) {
      expect(await db.get(`SELECT count(*)::INTEGER AS n FROM ${t}`)).toEqual({ n: 0 })
    }
  })

  it('builds one feed when the other is missing', async () => {
    await createIdentity(db)
    await createEspnPbp(db)
    // ESPN's plays are a view (Plan T907): read, not written.
    expect(await buildPlays(db)).toBe(0)
    expect(await db.get(`SELECT count(*)::INTEGER AS n FROM ${PLAY_TABLES.espn}`)).toEqual({
      n: 15
    })
    expect(await db.get(`SELECT count(*)::INTEGER AS n FROM ${PLAY_TABLES.nba}`)).toEqual({ n: 0 })
  })

  it('reads ESPN’s plays as a view, the rows a season’s build gives, and none without the file', async () => {
    await createIdentity(db)
    await buildPlays(db)
    // No file: an empty view, not an error.
    expect(await db.get(`SELECT count(*)::INTEGER AS n FROM ${PLAY_TABLES.espn}`)).toEqual({ n: 0 })
    await createEspnPbp(db)
    await markPlaySeason(db, 2026)
    await buildPlays(db)
    const have = await inspect(db)
    const season = `SELECT * FROM (${espnPlaysSql(have, 2026)})`
    const view = `SELECT * FROM ${PLAY_TABLES.espn} WHERE season = 2026`
    const missing = await db.all(
      `(${view} EXCEPT ALL ${season}) UNION ALL (${season} EXCEPT ALL ${view})`
    )
    expect(missing).toEqual([])
    expect(await db.get(`SELECT count(*)::INTEGER AS n FROM ${PLAY_TABLES.espn}`)).toEqual({
      n: 15
    })
    expect(await db.get(VIEW_KIND)).toEqual({ table_type: 'VIEW' })
  })

  it('drops the table a database built before held, and makes the view in its place', async () => {
    await createIdentity(db)
    await createEspnPbp(db)
    await db.exec(`DROP VIEW ${PLAY_TABLES.espn}`)
    await db.exec(`CREATE TABLE ${PLAY_TABLES.espn} AS SELECT 1 AS stale`)
    await buildPlays(db)
    expect(await db.get(VIEW_KIND)).toEqual({ table_type: 'VIEW' })
    expect(await db.get(`SELECT count(*)::INTEGER AS n FROM ${PLAY_TABLES.espn}`)).toEqual({
      n: 15
    })
  })

  it('reads a missing column as NULL and still builds', async () => {
    await createIdentity(db)
    // Without the short names an assist is still matched by `player_name`; without the possession
    // number the column is empty; without `seconds_remaining` the clock is read from `clock`.
    await createNbaPbp(db, ['player_name_i', 'possession_number', 'seconds_remaining'])
    await createEspnPbp(db, ['coordinate_x_raw', 'coordinate_y_raw'])
    await buildPlays(db)
    expect(await line(PLAY_TABLES.nba, DORT)).toEqual({ fga: 1, tov: 1, ast: 1 })
    expect(
      await db.get(
        `SELECT count(possession)::INTEGER AS possessions, min(clock) AS clock
         FROM ${PLAY_TABLES.nba}`
      )
    ).toEqual({ possessions: 0, clock: 180 })
    // Thompson's corner three is known only from the coordinates.
    expect(await line(PLAY_TABLES.espn, THOMPSON)).toEqual({ fga: 1, ast: 1 })
  })

  it('creates the tables and views on open, so a read never meets a missing one', async () => {
    const columns = await db.all<{ table_name: string; n: number }>(
      `SELECT table_name, count(*)::INTEGER AS n FROM duckdb_columns()
       WHERE table_name IN ('play_nba', 'play_espn', 'shot_nba', 'possession')
       GROUP BY 1 ORDER BY 1`
    )
    expect(columns).toEqual([
      { table_name: 'play_espn', n: PLAY_COLUMNS.length },
      { table_name: 'play_nba', n: PLAY_COLUMNS.length },
      { table_name: 'possession', n: POSSESSION_COLUMNS.length },
      { table_name: 'shot_nba', n: SHOT_COLUMNS.length }
    ])
  })
})

describe('shots and possessions', () => {
  it('keys both shot feeds and the possessions to the game, each source apart', async () => {
    await createIdentity(db)
    await db.exec(`CREATE TABLE src_nba_shots (game_id VARCHAR, season INTEGER, period BIGINT,
      clock VARCHAR, team_id BIGINT, person_id BIGINT, action_type VARCHAR, sub_type VARCHAR,
      shot_result VARCHAR, shot_value BIGINT, shot_distance BIGINT, x_legacy BIGINT, y_legacy BIGINT,
      file_season INTEGER)`)
    await db.exec(`INSERT INTO src_nba_shots VALUES ('${GAME}', 2026, 1, 'PT11M36.00S', ${HOU},
      ${SENGUN}, 'Missed Shot', 'Jump Shot', 'Missed', 3, 25, -179, 179, 2026)`)
    await db.exec(`CREATE TABLE src_espn_shots (game_id INTEGER, season INTEGER, period_number INTEGER,
      clock_display_value VARCHAR, team_id INTEGER, athlete_id_1 INTEGER, athlete_id_2 INTEGER,
      type_text VARCHAR, scoring_play BOOLEAN, score_value INTEGER, coordinate_x DOUBLE,
      coordinate_y DOUBLE, file_season INTEGER)`)
    await db.exec(`INSERT INTO src_espn_shots VALUES (401809234, 2026, 1, '11:26', 25, 4433255,
      4397020, 'Layup Shot', true, 2, 40.75, 2, 2026)`)
    await db.exec(`CREATE TABLE src_nba_possessions (game_id VARCHAR, period BIGINT,
      possession_number BIGINT, offense_team_id BIGINT, points BIGINT, count_as_possession BOOLEAN,
      off_player_1 BIGINT, def_player_1 BIGINT, lineup_source VARCHAR, season INTEGER)`)
    await db.exec(`INSERT INTO src_nba_possessions VALUES ('${GAME}', 1, 2, ${OKC}, 3, true,
      ${HOLMGREN}, ${SENGUN}, 'quarter_box', 2026)`)
    await buildPlays(db)
    expect(
      await db.get(
        'SELECT game_id, team_id, opponent_id, home, player_id, made, value, distance, x, y, clock FROM shot_nba'
      )
    ).toEqual({
      game_id: GAME,
      team_id: HOU,
      opponent_id: OKC,
      home: false,
      player_id: SENGUN,
      made: false,
      value: 3,
      distance: 25,
      x: -179,
      y: 179,
      clock: 696
    })
    expect(
      await db.get(
        'SELECT team_id, home, player_id, player2_id, made, value, x, clock FROM shot_espn'
      )
    ).toEqual({
      team_id: OKC,
      home: true,
      player_id: HOLMGREN,
      player2_id: DORT,
      made: true,
      value: 2,
      x: 40.75,
      clock: 686
    })
    expect(
      await db.get(
        'SELECT game_id, team_id, opponent_id, points, counted, off_1, def_1, fg2a FROM possession'
      )
    ).toEqual({
      game_id: GAME,
      team_id: OKC,
      opponent_id: HOU,
      points: 3,
      counted: true,
      off_1: HOLMGREN,
      def_1: SENGUN,
      fg2a: null
    })
  })
})
