import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  buildDerived,
  canDerive,
  DERIVED_VERSION,
  derivedStale,
  markDerivedStale
} from '@main/stats/derived/build'
import { openTestDb } from '../../fixtures/stats'

const BOS = 1610612738
const LAL = 1610612747
const MIA = 1610612748

/** What the derived tables read, empty, in the shape of the real files. */
async function emptySources(db: StatsDb): Promise<void> {
  await db.exec(`CREATE TABLE game (game_id VARCHAR, nba_game_id VARCHAR, espn_game_id BIGINT,
    season INTEGER, game_type VARCHAR, game_date DATE, home_team_id BIGINT, away_team_id BIGINT,
    home_score BIGINT, away_score BIGINT, played BOOLEAN, source VARCHAR)`)
  await db.exec(`CREATE TABLE team (season INTEGER, team_id BIGINT, espn_team_id INTEGER, code VARCHAR,
    name VARCHAR, conference VARCHAR, division VARCHAR)`)
  await db.exec(
    `CREATE TABLE player_ids (espn_athlete_id BIGINT, player_id BIGINT, method VARCHAR)`
  )
  await db.exec(`CREATE TABLE src_nba_player_box (game_id VARCHAR, season INTEGER, person_id BIGINT,
    team_id BIGINT, position VARCHAR, minutes VARCHAR, field_goals_made BIGINT,
    field_goals_attempted BIGINT, three_pointers_made BIGINT, three_pointers_attempted BIGINT,
    free_throws_made BIGINT, free_throws_attempted BIGINT, rebounds_offensive BIGINT,
    rebounds_defensive BIGINT, rebounds_total BIGINT, assists BIGINT, steals BIGINT, blocks BIGINT,
    turnovers BIGINT, fouls_personal BIGINT, points BIGINT, plus_minus_points DOUBLE)`)
  await db.exec(`CREATE TABLE src_nba_team_box (game_id VARCHAR, season INTEGER, team_id BIGINT,
    minutes VARCHAR, field_goals_made BIGINT, field_goals_attempted BIGINT,
    three_pointers_made BIGINT, three_pointers_attempted BIGINT, free_throws_made BIGINT,
    free_throws_attempted BIGINT, rebounds_offensive BIGINT, rebounds_defensive BIGINT,
    rebounds_total BIGINT, assists BIGINT, steals BIGINT, blocks BIGINT, turnovers BIGINT,
    fouls_personal BIGINT, points BIGINT)`)
  await db.exec(`CREATE TABLE src_espn_player_box (game_id INTEGER, season INTEGER, file_season INTEGER,
    athlete_id INTEGER, home_away VARCHAR, minutes DOUBLE, did_not_play BOOLEAN, starter BOOLEAN,
    athlete_position_abbreviation VARCHAR, field_goals_made INTEGER, field_goals_attempted INTEGER,
    three_point_field_goals_made INTEGER, three_point_field_goals_attempted INTEGER,
    free_throws_made INTEGER, free_throws_attempted INTEGER, offensive_rebounds INTEGER,
    defensive_rebounds INTEGER, rebounds INTEGER, assists INTEGER, steals INTEGER, blocks INTEGER,
    turnovers INTEGER, fouls INTEGER, points INTEGER, plus_minus VARCHAR)`)
  await db.exec(`CREATE TABLE src_espn_team_box (game_id INTEGER, season INTEGER, file_season INTEGER,
    team_home_away VARCHAR, points_in_paint VARCHAR, fast_break_points VARCHAR, turnover_points VARCHAR,
    total_rebounds INTEGER, turnovers INTEGER)`)
  await db.exec(`CREATE TABLE src_nba_rosters (player_id BIGINT, season INTEGER, position VARCHAR)`)
}

interface NbaGame {
  id: string
  espnId?: number
  season?: number
  type?: string
  date?: string
  home?: number
  away?: number
  scores?: [number, number]
  played?: boolean
}

async function addGame(db: StatsDb, g: NbaGame): Promise<void> {
  const [home, away] = g.scores ?? [100, 90]
  await db.exec(`INSERT INTO game VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nba')`, [
    g.id,
    g.id.startsWith('espn:') ? null : g.id,
    g.espnId ?? null,
    g.season ?? 2026,
    g.type ?? 'regular',
    g.date ?? '2026-01-10',
    g.home ?? BOS,
    g.away ?? LAL,
    home,
    away,
    g.played ?? true
  ])
}

/** A line of the NBA's box score: FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, AST, STL, BLK, TOV, PF, PTS. */
type Stats = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
]

const LINE: Stats = [10, 20, 2, 6, 4, 5, 1, 4, 3, 1, 1, 2, 3, 26]

async function addNbaLine(
  db: StatsDb,
  game: string,
  player: number,
  team: number,
  o: {
    minutes?: string
    position?: string
    stats?: Stats
    plusMinus?: number
    season?: number
  } = {}
): Promise<void> {
  const s = o.stats ?? LINE
  await db.exec(
    `INSERT INTO src_nba_player_box VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      game,
      o.season ?? 2026,
      player,
      team,
      o.position ?? '',
      o.minutes ?? '30:00',
      s[0],
      s[1],
      s[2],
      s[3],
      s[4],
      s[5],
      s[6],
      s[7],
      s[6] + s[7],
      s[8],
      s[9],
      s[10],
      s[11],
      s[12],
      s[13],
      o.plusMinus ?? 5
    ]
  )
}

async function addNbaTeam(
  db: StatsDb,
  game: string,
  team: number,
  s: Stats,
  minutes = '240:00'
): Promise<void> {
  await db.exec(
    `INSERT INTO src_nba_team_box VALUES (?, 2026, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      game,
      team,
      minutes,
      s[0],
      s[1],
      s[2],
      s[3],
      s[4],
      s[5],
      s[6],
      s[7],
      s[6] + s[7],
      s[8],
      s[9],
      s[10],
      s[11],
      s[12],
      s[13]
    ]
  )
}

async function addEspnLine(
  db: StatsDb,
  game: number,
  athlete: number,
  o: {
    side?: 'home' | 'away'
    season?: number
    fileSeason?: number
    minutes?: number | null
    dnp?: boolean
    starter?: boolean
    position?: string
    stats?: Stats | null
  } = {}
): Promise<void> {
  const s = o.stats === undefined ? LINE : o.stats
  const season = o.season ?? 1995
  await db.exec(
    `INSERT INTO src_espn_player_box VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0')`,
    [
      game,
      season,
      o.fileSeason ?? season,
      athlete,
      o.side ?? 'home',
      o.minutes === undefined ? 30 : o.minutes,
      o.dnp ?? false,
      o.starter ?? false,
      o.position ?? 'G',
      s?.[0] ?? null,
      s?.[1] ?? null,
      s?.[2] ?? null,
      s?.[3] ?? null,
      s?.[4] ?? null,
      s?.[5] ?? null,
      s?.[6] ?? null,
      s?.[7] ?? null,
      s ? s[6] + s[7] : null,
      s?.[8] ?? null,
      s?.[9] ?? null,
      s?.[10] ?? null,
      s?.[11] ?? null,
      s?.[12] ?? null,
      s?.[13] ?? null
    ]
  )
}

const playerRow = async (
  db: StatsDb,
  player: number,
  game = 'g1'
): Promise<Record<string, unknown>> =>
  (await db.get('SELECT * FROM player_game WHERE player_id = ? AND game_id = ?', [player, game])) ??
  {}

const teamRow = async (db: StatsDb, team: number, game = 'g1'): Promise<Record<string, unknown>> =>
  (await db.get('SELECT * FROM team_game WHERE team_id = ? AND game_id = ?', [team, game])) ?? {}

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
})

describe('whether the derived tables can be built', () => {
  it('waits for the identity tables and a box score', async () => {
    expect(await canDerive(db)).toBe(true)
    await db.exec('DROP TABLE player_ids')
    expect(await canDerive(db)).toBe(false)
  })

  it('is stale until built at the current version, and after being marked', async () => {
    expect(await derivedStale(db)).toBe(true)
    await buildDerived(db)
    expect(await derivedStale(db)).toBe(false)
    await markDerivedStale(db)
    expect(await derivedStale(db)).toBe(true)
    await db.exec('UPDATE derived_state SET version = ? WHERE name = ?', [
      DERIVED_VERSION,
      'derived'
    ])
    expect(await derivedStale(db)).toBe(false)
  })
})

describe('player_game', () => {
  it('reads both spellings of minutes and leaves out a player who did not play', async () => {
    await addGame(db, { id: 'g1' })
    await addNbaLine(db, 'g1', 1, BOS, { minutes: '6:34' })
    await addNbaLine(db, 'g1', 2, BOS, { minutes: '26' })
    await addNbaLine(db, 'g1', 3, BOS, { minutes: '' })
    await addNbaLine(db, 'g1', 4, BOS, { minutes: '0:00' })
    expect(await buildDerived(db)).toBe(3)
    expect((await playerRow(db, 1)).seconds).toBe(394)
    expect((await playerRow(db, 1)).minutes).toBeCloseTo(6.5667, 3)
    expect((await playerRow(db, 2)).seconds).toBe(1560)
    expect(await playerRow(db, 3)).toEqual({})
    // On the floor for no measurable time is still an appearance.
    expect((await playerRow(db, 4)).games).toBe(1)
    expect((await playerRow(db, 4)).seconds).toBe(0)
  })

  it('leaves out a game not played', async () => {
    await addGame(db, { id: 'g1', played: false, scores: [0, 0] })
    await addNbaLine(db, 'g1', 1, BOS)
    expect(await buildDerived(db)).toBe(0)
    expect(await teamRow(db, BOS)).toEqual({})
  })

  it('takes the game and the result from the schedule', async () => {
    await addGame(db, { id: 'g1', scores: [100, 90] })
    await addNbaLine(db, 'g1', 1, BOS)
    await addNbaLine(db, 'g1', 2, LAL)
    await buildDerived(db)
    expect(await playerRow(db, 1)).toMatchObject({
      season: 2026,
      game_type: 'regular',
      team_id: BOS,
      opponent_id: LAL,
      home: true,
      wins: 1,
      losses: 0,
      source: 'nba',
      pts: 26,
      reb: 5,
      plus_minus: 5
    })
    expect(await playerRow(db, 2)).toMatchObject({
      team_id: LAL,
      opponent_id: BOS,
      home: false,
      wins: 0,
      losses: 1
    })
  })

  it('counts double-doubles and up over the five categories', async () => {
    await addGame(db, { id: 'g1' })
    const stats = (pts: number, oreb: number, ast: number, stl: number, blk: number): Stats => [
      0,
      0,
      0,
      0,
      0,
      0,
      oreb,
      0,
      ast,
      stl,
      blk,
      0,
      0,
      pts
    ]
    await addNbaLine(db, 'g1', 1, BOS, { stats: stats(9, 10, 10, 0, 0) })
    await addNbaLine(db, 'g1', 2, BOS, { stats: stats(10, 10, 10, 0, 0) })
    await addNbaLine(db, 'g1', 3, BOS, { stats: stats(10, 10, 10, 10, 0) })
    await addNbaLine(db, 'g1', 4, BOS, { stats: stats(5, 5, 5, 5, 5) })
    await addNbaLine(db, 'g1', 5, BOS, { stats: stats(10, 9, 9, 0, 0) })
    await buildDerived(db)
    const flags = async (p: number): Promise<unknown[]> => {
      const r = await playerRow(db, p)
      return [r.dd2, r.td3, r.qd4, r.five_by_five]
    }
    expect(await flags(1)).toEqual([1, 0, 0, 0])
    expect(await flags(2)).toEqual([1, 1, 0, 0])
    expect(await flags(3)).toEqual([1, 1, 1, 0])
    expect(await flags(4)).toEqual([0, 0, 0, 1])
    expect(await flags(5)).toEqual([0, 0, 0, 0])
  })

  it('reads a starter from the position from 2017-18 and from ESPN before it', async () => {
    await addGame(db, { id: 'new', season: 2018, espnId: 11 })
    await addGame(db, { id: 'old', season: 2017, espnId: 12 })
    await addGame(db, { id: 'none', season: 2017 })
    await db.exec(`INSERT INTO player_ids SELECT 900 + i, i, 'crosswalk' FROM range(1, 7) t(i)`)
    for (const p of [1, 2, 3, 4, 5, 6]) {
      await addNbaLine(db, 'new', p, BOS, { season: 2018, position: p < 6 ? 'G' : '' })
      // Before 2017-18 the NBA lists a position for everyone: only ESPN says who started.
      await addNbaLine(db, 'old', p, BOS, { season: 2017, position: 'G' })
      await addEspnLine(db, 12, 900 + p, { season: 2017, starter: p < 6 })
    }
    await addNbaLine(db, 'none', 1, BOS, { season: 2017, position: 'G' })
    await buildDerived(db)
    expect((await playerRow(db, 1, 'new')).starter).toBe(true)
    expect((await playerRow(db, 6, 'new')).starter).toBe(false)
    expect((await playerRow(db, 1, 'new')).starts).toBe(1)
    expect((await playerRow(db, 1, 'old')).starter).toBe(true)
    expect((await playerRow(db, 6, 'old')).starter).toBe(false)
    // ESPN lacks this game, so nobody can say: not a bench player, unknown.
    expect((await playerRow(db, 1, 'none')).starter).toBeNull()
    expect((await playerRow(db, 1, 'none')).starts).toBe(0)
  })

  it('reads a game where ESPN flagged nobody as unknown, not as all bench', async () => {
    await addGame(db, { id: 'none', season: 2006, espnId: 11 })
    await addGame(db, { id: 'five', season: 2006, espnId: 12 })
    await db.exec(`INSERT INTO player_ids SELECT 900 + i, i, 'crosswalk' FROM range(1, 7) t(i)`)
    for (const player of [1, 2, 3, 4, 5, 6]) {
      await addNbaLine(db, 'none', player, BOS, { season: 2006 })
      await addNbaLine(db, 'five', player, BOS, { season: 2006 })
      await addEspnLine(db, 11, 900 + player, { season: 2006, starter: false })
      // Player 6 is missing from ESPN's game: with five starters known, they came off the bench.
      if (player < 6) await addEspnLine(db, 12, 900 + player, { season: 2006, starter: true })
    }
    await buildDerived(db)
    expect((await playerRow(db, 1, 'none')).starter).toBeNull()
    expect((await playerRow(db, 1, 'five')).starter).toBe(true)
    expect((await playerRow(db, 6, 'five')).starter).toBe(false)
    expect(await teamRow(db, BOS, 'none')).toMatchObject({
      starts_known: 0,
      starter_pts: null,
      bench_pts: null
    })
    expect(await teamRow(db, BOS, 'five')).toMatchObject({
      starts_known: 1,
      starter_pts: 130,
      bench_pts: 26
    })
  })

  it('maps hybrid positions to the first listed, from the roster first', async () => {
    await addGame(db, { id: 'g1' })
    const roster: [number, string][] = [
      [1, 'G-F'],
      [2, 'F-G'],
      [3, 'F-C'],
      [4, 'C-F'],
      [5, 'C']
    ]
    for (const [player, position] of roster) {
      await addNbaLine(db, 'g1', player, BOS, { position: 'G' })
      await db.exec('INSERT INTO src_nba_rosters VALUES (?, 2026, ?)', [player, position])
    }
    await buildDerived(db)
    const groups = await db.all<{ position: string }>(
      'SELECT position FROM player_game ORDER BY player_id'
    )
    expect(groups.map((r) => r.position)).toEqual(['G', 'F', 'F', 'C', 'C'])
  })

  it('falls back from the roster to the box score, then to ESPN', async () => {
    await addGame(db, { id: 'g1', espnId: 11 })
    await db.exec(`INSERT INTO player_ids VALUES (902, 2, 'crosswalk')`)
    await addNbaLine(db, 'g1', 1, BOS, { position: 'C' })
    await addNbaLine(db, 'g1', 2, BOS, { position: '' })
    await addEspnLine(db, 11, 902, { season: 2026, position: 'SF' })
    await buildDerived(db)
    expect((await playerRow(db, 1)).position).toBe('C')
    expect((await playerRow(db, 2)).position).toBe('F')
  })

  it('reads ESPN before the NBA has the game, once per game, and never its plus-minus', async () => {
    await addGame(db, { id: 'espn:7', espnId: 7, season: 1995, date: '1995-01-10' })
    await db.exec(`INSERT INTO player_ids VALUES (901, -901, 'espn only'), (902, 2, 'crosswalk')`)
    await addEspnLine(db, 7, 901, { side: 'home', starter: true, minutes: 31 })
    await addEspnLine(db, 7, 902, { side: 'away', minutes: 12 })
    // The 1998-99 lockout season is in two files; this row belongs to the other one.
    await addEspnLine(db, 7, 901, { side: 'home', season: 1995, fileSeason: 1996, minutes: 99 })
    await buildDerived(db)
    expect(await playerRow(db, -901, 'espn:7')).toMatchObject({
      team_id: BOS,
      opponent_id: LAL,
      source: 'espn',
      seconds: 1860,
      plus_minus: null
    })
    expect((await playerRow(db, 2, 'espn:7')).team_id).toBe(LAL)
    const n = await db.get<{ n: number }>('SELECT count(*) AS n FROM player_game')
    expect(n?.n).toBe(2)
  })

  it('prefers the NBA to ESPN for a game both have', async () => {
    await addGame(db, { id: 'g1', espnId: 11 })
    await db.exec(`INSERT INTO player_ids VALUES (901, 1, 'crosswalk')`)
    await addNbaLine(db, 'g1', 1, BOS)
    await addEspnLine(db, 11, 901, { season: 2026, stats: [...LINE.slice(0, 13), 99] as Stats })
    await buildDerived(db)
    const lines = await db.all('SELECT source, pts FROM player_game')
    expect(lines).toEqual([{ source: 'nba', pts: 26 }])
  })

  it('leaves out an ESPN line with no stats or marked as not played', async () => {
    await addGame(db, { id: 'espn:7', espnId: 7, season: 1995 })
    await db.exec(
      `INSERT INTO player_ids VALUES (901, 1, 'name'), (902, 2, 'name'), (903, 3, 'name')`
    )
    await addEspnLine(db, 7, 901, { minutes: null, stats: null, dnp: true })
    await addEspnLine(db, 7, 902, { dnp: true })
    // The real 1994-95 case: a player who did play, listed with no minutes and all zeros.
    await addEspnLine(db, 7, 903, {
      minutes: null,
      stats: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    })
    await buildDerived(db)
    expect(await db.all('SELECT player_id FROM player_game')).toEqual([])
  })
})

describe('team_game', () => {
  const home: Stats = [40, 80, 10, 30, 10, 20, 10, 30, 25, 8, 5, 12, 20, 100]
  const away: Stats = [35, 85, 8, 28, 12, 15, 12, 28, 20, 6, 4, 14, 18, 90]

  it("takes the NBA's team box score and copies the opponent's beside it", async () => {
    await addGame(db, { id: 'g1' })
    await addNbaTeam(db, 'g1', BOS, home)
    await addNbaTeam(db, 'g1', LAL, away)
    await buildDerived(db)
    expect(await teamRow(db, BOS)).toMatchObject({
      games: 1,
      box_games: 1,
      wins: 1,
      losses: 0,
      points_for: 100,
      points_against: 90,
      seconds: 14400,
      source: 'nba',
      fga: 80,
      tov: 12,
      opp_fga: 85,
      opp_tov: 14,
      opp_pts: 90
    })
  })

  it('estimates possessions three ways, named as estimates', async () => {
    await addGame(db, { id: 'g1' })
    await addNbaTeam(db, 'g1', BOS, home)
    await addNbaTeam(db, 'g1', LAL, away)
    await buildDerived(db)
    const r = await teamRow(db, BOS)
    // FGA + 0.44 FTA - OREB + TOV
    const us = 80 + 0.44 * 20 - 10 + 12
    const them = 85 + 0.44 * 15 - 12 + 14
    expect(r.poss).toBeCloseTo(us, 6)
    expect(r.opp_poss).toBeCloseTo(them, 6)
    expect(r.poss_sym).toBeCloseTo(0.5 * (us + them), 6)
    const half = (
      fga: number,
      fta: number,
      orb: number,
      oppDrb: number,
      fgm: number,
      tov: number
    ): number => fga + 0.4 * fta - 1.07 * (orb / (orb + oppDrb)) * (fga - fgm) + tov
    expect(r.poss_bref).toBeCloseTo(
      0.5 * (half(80, 20, 10, 28, 40, 12) + half(85, 15, 12, 30, 35, 14)),
      6
    )
  })

  it("sums the players where the NBA has no box score, and never reads ESPN's team columns", async () => {
    await addGame(db, { id: 'espn:7', espnId: 7, season: 1995 })
    await db.exec(`INSERT INTO player_ids SELECT 900 + i, i, 'name' FROM range(1, 7) t(i)`)
    for (const p of [1, 2, 3, 4, 5]) {
      await addEspnLine(db, 7, 900 + p, { side: 'home', starter: true, minutes: 30 })
    }
    await addEspnLine(db, 7, 906, { side: 'home', minutes: 20 })
    await db.exec(
      `INSERT INTO src_espn_team_box VALUES (7, 1995, 1995, 'home', '-1', '0', '0', 999, 999)`
    )
    await buildDerived(db)
    expect(await teamRow(db, BOS, 'espn:7')).toMatchObject({
      source: 'espn',
      box_games: 1,
      seconds: 10200,
      pts: 156,
      reb: 30,
      tov: 12,
      starts_known: 1,
      starter_pts: 130,
      bench_pts: 26
    })
  })

  it('counts a game with no box score toward the record only', async () => {
    await addGame(db, { id: 'espn:8', espnId: 8, season: 1995, scores: [90, 95] })
    await buildDerived(db)
    expect(await teamRow(db, BOS, 'espn:8')).toMatchObject({
      games: 1,
      box_games: 0,
      wins: 0,
      losses: 1,
      points_for: 90,
      source: null,
      pts: null,
      poss: null
    })
  })

  it("reads ESPN's points by kind, with -1 and a column's early zeros as not recorded", async () => {
    await addGame(db, { id: 'a', espnId: 1, season: 2026 })
    await addGame(db, { id: 'b', espnId: 2, season: 2003 })
    await addGame(db, { id: 'c', espnId: 3, season: 1994, date: '1994-01-10' })
    await db.exec(`INSERT INTO src_espn_team_box VALUES
      (1, 2026, 2026, 'home', '48', '15', '20', 0, 0),
      (1, 2026, 2026, 'away', '40', '10', '12', 0, 0),
      (2, 2003, 2003, 'home', '-1', '5', '18', 0, 0),
      (3, 1994, 1994, 'home', '-1', '0', '0', 0, 0)`)
    await buildDerived(db)
    expect(await teamRow(db, BOS, 'a')).toMatchObject({
      paint_pts: 48,
      fast_break_pts: 15,
      turnover_pts: 20,
      opp_paint_pts: 40,
      opp_fast_break_pts: 10,
      opp_turnover_pts: 12
    })
    expect(await teamRow(db, BOS, 'b')).toMatchObject({
      paint_pts: null,
      fast_break_pts: 5,
      turnover_pts: 18
    })
    expect(await teamRow(db, BOS, 'c')).toMatchObject({
      paint_pts: null,
      fast_break_pts: null,
      turnover_pts: null
    })
  })

  it('counts rest in full days off and separates the preseason', async () => {
    await addGame(db, { id: 'p', type: 'preseason', date: '2025-10-15' })
    await addGame(db, { id: 'a', date: '2025-10-22' })
    await addGame(db, { id: 'b', date: '2025-10-23' })
    await addGame(db, { id: 'c', date: '2025-10-26' })
    await buildDerived(db)
    expect((await teamRow(db, BOS, 'p')).rest_days).toBeNull()
    expect((await teamRow(db, BOS, 'a')).rest_days).toBeNull()
    expect((await teamRow(db, BOS, 'b')).rest_days).toBe(0)
    expect((await teamRow(db, BOS, 'c')).rest_days).toBe(2)
  })

  it('reads the break from the All-Star game, the constants before 1996-97, or not at all', async () => {
    await addGame(db, { id: 'asg1', type: 'all-star', date: '2026-02-13' })
    await addGame(db, { id: 'asg2', type: 'all-star', date: '2026-02-15' })
    // A stray row the schedule never played, like 1997-98's.
    await addGame(db, { id: 'asg3', type: 'all-star', date: '2026-04-19', played: false })
    await addGame(db, { id: 'z', date: '2026-05-01' })
    await addGame(db, { id: 'a', date: '2026-02-12' })
    await addGame(db, { id: 'b', date: '2026-02-19' })
    await addGame(db, { id: 'c', season: 1994, date: '1994-02-10' })
    await addGame(db, { id: 'd', season: 1994, date: '1994-02-15' })
    // The schedule lists 1998-99's, which was cancelled.
    await addGame(db, {
      id: 'x',
      type: 'all-star',
      season: 1999,
      date: '1999-02-14',
      played: false
    })
    await addGame(db, { id: 'e', season: 1999, date: '1999-03-01' })
    // One still to come this season counts.
    await addGame(db, {
      id: 'y',
      type: 'all-star',
      season: 2027,
      date: '2027-02-14',
      played: false
    })
    await addGame(db, { id: 'f', season: 2027, date: '2026-11-01' })
    await buildDerived(db)
    expect((await teamRow(db, BOS, 'f')).after_break).toBe(false)
    expect((await teamRow(db, BOS, 'a')).after_break).toBe(false)
    expect((await teamRow(db, BOS, 'b')).after_break).toBe(true)
    expect((await teamRow(db, BOS, 'c')).after_break).toBe(false)
    expect((await teamRow(db, BOS, 'd')).after_break).toBe(true)
    expect((await teamRow(db, BOS, 'e')).after_break).toBeNull()
  })

  it("carries the opponent's conference and division for that season", async () => {
    await db.exec(`INSERT INTO team VALUES
      (2026, ${LAL}, 13, 'LAL', 'Lakers', 'west', 'pacific'),
      (2026, ${BOS}, 2, 'BOS', 'Celtics', 'east', 'atlantic')`)
    await addGame(db, { id: 'g1' })
    await addNbaLine(db, 'g1', 1, BOS)
    await buildDerived(db)
    expect(await teamRow(db, BOS)).toMatchObject({
      opp_conference: 'west',
      opp_division: 'pacific'
    })
    expect(await playerRow(db, 1)).toMatchObject({
      opp_conference: 'west',
      opp_division: 'pacific'
    })
  })

  it('leaves a placeholder team out', async () => {
    await addGame(db, { id: 'g1' })
    await addNbaTeam(db, 'g1', 0, home)
    await addNbaLine(db, 'g1', 1, 0)
    expect(await buildDerived(db)).toBe(0)
  })
})

describe('what a player line knows about the game', () => {
  const us: Stats = [40, 80, 10, 30, 10, 20, 10, 30, 25, 8, 5, 12, 20, 100]
  const them: Stats = [35, 85, 8, 28, 12, 15, 12, 28, 20, 6, 4, 14, 18, 90]

  beforeEach(async () => {
    await addGame(db, { id: 'g1' })
    await addNbaTeam(db, 'g1', BOS, us)
    await addNbaTeam(db, 'g1', LAL, them)
    await addNbaLine(db, 'g1', 1, BOS, { minutes: '24:00' })
  })

  it("copies the team's and the opponent's totals", async () => {
    await buildDerived(db)
    expect(await playerRow(db, 1)).toMatchObject({
      tm_seconds: 14400,
      tm_fga: 80,
      tm_pts: 100,
      opp_fga: 85,
      opp_oreb: 12
    })
  })

  it('estimates what the team did while they played from their share of its minutes', async () => {
    await buildDerived(db)
    const r = await playerRow(db, 1)
    // 24 of the 48 minutes a side plays: half of the game.
    const share = 0.5
    const poss = 0.5 * (80 + 0.44 * 20 - 10 + 12 + (85 + 0.44 * 15 - 12 + 14))
    expect(r.x_ast_den).toBeCloseTo(share * 40 - 10, 6)
    expect(r.x_orb_den).toBeCloseTo(share * (10 + 28), 6)
    expect(r.x_drb_den).toBeCloseTo(share * (30 + 12), 6)
    expect(r.x_trb_den).toBeCloseTo(share * (40 + 40), 6)
    expect(r.x_stl_den).toBeCloseTo(share * poss, 6)
    expect(r.x_blk_den).toBeCloseTo(share * (85 - 28), 6)
    expect(r.x_usg_den).toBeCloseTo(share * (80 + 0.44 * 20 + 12), 6)
    expect(r.on_poss).toBeCloseTo(share * poss, 6)
  })

  it('sums what PIE divides by over both teams', async () => {
    await buildDerived(db)
    const c = (s: Stats): number =>
      s[13] +
      s[0] +
      s[4] -
      s[1] -
      s[5] +
      s[7] +
      0.5 * s[6] +
      s[8] +
      s[9] +
      0.5 * s[10] -
      s[12] -
      s[11]
    expect((await playerRow(db, 1)).pie_total).toBeCloseTo(c(us) + c(them), 6)
  })

  it('leaves the estimates empty rather than dividing by zero', async () => {
    await db.exec(`UPDATE src_nba_team_box SET minutes = '0:00' WHERE team_id = ${BOS}`)
    await buildDerived(db)
    expect((await playerRow(db, 1)).x_usg_den).toBeNull()
  })
})

describe('player_season', () => {
  beforeEach(async () => {
    await addGame(db, { id: 'a', date: '2025-11-01', home: BOS, away: LAL })
    await addGame(db, { id: 'b', date: '2026-01-05', home: MIA, away: LAL })
    await addGame(db, { id: 'c', date: '2026-02-01', home: MIA, away: BOS })
    await addGame(db, { id: 'd', date: '2026-04-20', type: 'playoffs', home: MIA, away: BOS })
    await addNbaLine(db, 'a', 1, BOS)
    await addNbaLine(db, 'b', 1, MIA)
    await addNbaLine(db, 'c', 1, MIA)
    await addNbaLine(db, 'd', 1, MIA)
    await buildDerived(db)
  })

  const rows = (): Promise<Record<string, unknown>[]> =>
    db.all(
      `SELECT team_id, game_type, games, pts, last_team_id FROM player_season
       WHERE player_id = 1 ORDER BY game_type, team_id NULLS LAST`
    )

  it('gives a traded player a row per team and one total, and the two are separate', async () => {
    expect(await rows()).toEqual([
      { team_id: MIA, game_type: 'playoffs', games: 1, pts: 26, last_team_id: MIA },
      { team_id: null, game_type: 'playoffs', games: 1, pts: 26, last_team_id: MIA },
      { team_id: BOS, game_type: 'regular', games: 1, pts: 26, last_team_id: BOS },
      { team_id: MIA, game_type: 'regular', games: 2, pts: 52, last_team_id: MIA },
      { team_id: null, game_type: 'regular', games: 3, pts: 78, last_team_id: MIA }
    ])
  })

  it('agrees with the game table', async () => {
    const summed = await db.get<{ pts: number; seconds: number }>(
      `SELECT sum(pts) AS pts, sum(seconds) AS seconds FROM player_game WHERE player_id = 1`
    )
    const total = await db.get<{ pts: number; seconds: number }>(
      `SELECT sum(pts) AS pts, sum(seconds) AS seconds FROM player_season
       WHERE player_id = 1 AND team_id IS NULL`
    )
    expect(total).toEqual(summed)
  })
})

describe('team_season', () => {
  it('sums a team by season and game type', async () => {
    await addGame(db, { id: 'a', date: '2025-11-01', scores: [100, 90] })
    await addGame(db, { id: 'b', date: '2026-01-05', scores: [80, 90] })
    await addGame(db, { id: 'c', date: '2026-04-20', type: 'playoffs', scores: [100, 90] })
    await buildDerived(db)
    expect(
      await db.all(
        `SELECT game_type, games, wins, losses, points_for FROM team_season
         WHERE team_id = ${BOS} ORDER BY game_type`
      )
    ).toEqual([
      { game_type: 'playoffs', games: 1, wins: 1, losses: 0, points_for: 100 },
      { game_type: 'regular', games: 2, wins: 1, losses: 1, points_for: 180 }
    ])
  })
})

describe('a source that is missing', () => {
  it('reads as NULL and does not fail the rebuild', async () => {
    await db.exec('DROP TABLE src_nba_rosters')
    await db.exec('DROP TABLE src_espn_team_box')
    await db.exec('DROP TABLE src_nba_team_box')
    await db.exec('ALTER TABLE src_nba_player_box DROP COLUMN plus_minus_points')
    await db.exec('ALTER TABLE src_nba_player_box DROP COLUMN steals')
    await addGame(db, { id: 'g1' })
    await addNbaLine2(db)
    await buildDerived(db)
    expect(await playerRow(db, 1)).toMatchObject({ plus_minus: null, stl: null, pts: 26 })
    expect(await teamRow(db, BOS)).toMatchObject({ paint_pts: null, pts: 26, stl: null })
  })
})

/** A line for a table that has lost two columns. */
async function addNbaLine2(d: StatsDb): Promise<void> {
  await d.exec(`INSERT INTO src_nba_player_box BY NAME
    SELECT 'g1' AS game_id, 2026 AS season, 1 AS person_id, ${BOS} AS team_id, 'G' AS position,
           '30:00' AS minutes, 26 AS points`)
}
