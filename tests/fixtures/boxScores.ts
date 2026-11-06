import type { StatsDb } from '@main/stats/db'

export const BOS = 1610612738
export const LAL = 1610612747
export const MIA = 1610612748

/** What the derived tables read, empty, in the shape of the real files. */
export async function emptySources(db: StatsDb): Promise<void> {
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

export interface NbaGame {
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

export async function addGame(db: StatsDb, g: NbaGame): Promise<void> {
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
export type Stats = [
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

export const LINE: Stats = [10, 20, 2, 6, 4, 5, 1, 4, 3, 1, 1, 2, 3, 26]

export async function addNbaLine(
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

export async function addNbaTeam(
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

export async function addEspnLine(
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
