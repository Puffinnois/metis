import type { StatsDb } from '../db'
import { column, per, type Have } from './sql'

/** Every box-score count, as `player_game`, `team_game` and the season tables name them. */
export const BOX_COUNTS = [
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf',
  'pts'
] as const

/** The sources' names for each count. */
const NBA_NAMES: Record<(typeof BOX_COUNTS)[number], string> = {
  fgm: 'field_goals_made',
  fga: 'field_goals_attempted',
  fg3m: 'three_pointers_made',
  fg3a: 'three_pointers_attempted',
  ftm: 'free_throws_made',
  fta: 'free_throws_attempted',
  oreb: 'rebounds_offensive',
  dreb: 'rebounds_defensive',
  reb: 'rebounds_total',
  ast: 'assists',
  stl: 'steals',
  blk: 'blocks',
  tov: 'turnovers',
  pf: 'fouls_personal',
  pts: 'points'
}
const ESPN_NAMES: Record<(typeof BOX_COUNTS)[number], string> = {
  fgm: 'field_goals_made',
  fga: 'field_goals_attempted',
  fg3m: 'three_point_field_goals_made',
  fg3a: 'three_point_field_goals_attempted',
  ftm: 'free_throws_made',
  fta: 'free_throws_attempted',
  oreb: 'offensive_rebounds',
  dreb: 'defensive_rebounds',
  reb: 'rebounds',
  ast: 'assists',
  stl: 'steals',
  blk: 'blocks',
  tov: 'turnovers',
  pf: 'fouls',
  pts: 'points'
}

/**
 * The columns of `team_game` beyond its counts. Summed in `team_season` and by the query engine, so
 * each is a count or a sum of the same games, never a rate.
 */
export const TEAM_EXTRA_SUMS = [
  'games',
  'box_games',
  'starts_known',
  'wins',
  'losses',
  'points_for',
  'points_against',
  'seconds',
  'minutes',
  'poss',
  'opp_poss',
  'poss_sym',
  'poss_bref',
  'paint_pts',
  'fast_break_pts',
  'turnover_pts',
  'opp_paint_pts',
  'opp_fast_break_pts',
  'opp_turnover_pts',
  'starter_pts',
  'bench_pts',
  'pie_total'
] as const

/** Every summed column of `team_game` and `team_season`. */
export const TEAM_SUMS: readonly string[] = [
  ...BOX_COUNTS,
  ...BOX_COUNTS.map((c) => `opp_${c}`),
  ...TEAM_EXTRA_SUMS
]

/**
 * The team's and the opponent's game copied onto each player's line, so a player's share of them is
 * a ratio of sums over the games they played.
 */
const TEAM_CONTEXT: Record<string, string> = {
  ...Object.fromEntries(BOX_COUNTS.map((c) => [`tm_${c}`, `t.${c}`])),
  ...Object.fromEntries(BOX_COUNTS.map((c) => [`opp_${c}`, `t.opp_${c}`])),
  tm_seconds: 't.seconds',
  pie_total: 't.pie_total'
}

/**
 * Basketball-Reference's estimates divide by what the team did while a player was on the floor,
 * guessed from their share of the team's minutes. The guess is made game by game and summed, so any
 * group of games reads the same as the sum of its parts.
 */
const SHARE = per('5.0 * l.seconds', 't.seconds')
const ON_COURT: Record<string, string> = {
  x_ast_den: `${SHARE} * t.fgm - l.fgm`,
  x_orb_den: `${SHARE} * (t.oreb + t.opp_dreb)`,
  x_drb_den: `${SHARE} * (t.dreb + t.opp_oreb)`,
  x_trb_den: `${SHARE} * (t.reb + t.opp_reb)`,
  x_stl_den: `${SHARE} * t.poss_sym`,
  x_blk_den: `${SHARE} * (t.opp_fga - t.opp_fg3a)`,
  x_usg_den: `${SHARE} * (t.fga + 0.44 * t.fta + t.tov)`,
  on_poss: `${SHARE} * t.poss_sym`
}

/** Every summed column of `player_game` and `player_season`. */
export const PLAYER_SUMS: readonly string[] = [
  'games',
  'starts',
  'wins',
  'losses',
  'seconds',
  'minutes',
  ...BOX_COUNTS,
  'plus_minus',
  'dd2',
  'td3',
  'qd4',
  'five_by_five',
  ...Object.keys(TEAM_CONTEXT),
  ...Object.keys(ON_COURT)
]

/** "6:34", "240:00" or, on 88 old lines, "26" whole minutes. Anything else reads as NULL. */
const CLOCK_SECONDS = `CREATE OR REPLACE TEMP MACRO clock_seconds(m) AS CASE
    WHEN m LIKE '%:%' THEN TRY_CAST(split_part(m, ':', 1) AS INTEGER) * 60
                         + TRY_CAST(split_part(m, ':', 2) AS INTEGER)
    ELSE TRY_CAST(m AS INTEGER) * 60
  END`

/** `G-F` is a guard, `F-C` a forward and `C-F` a center: the first listed is the group (Plan T504). */
const POSITION_GROUP = `CREATE OR REPLACE TEMP MACRO position_group(p) AS CASE
    WHEN p IN ('PG', 'SG', 'G') OR p LIKE 'G-%' OR p = 'GF' THEN 'G'
    WHEN p IN ('SF', 'PF', 'F') OR p LIKE 'F-%' THEN 'F'
    WHEN p = 'C' OR p LIKE 'C-%' THEN 'C'
  END`

/**
 * The ESPN lines of players who appeared, read once per game: 1998-99 is in two files. A line with no
 * minutes is not an appearance, even with stats: 34 of them in 1994-95 are all zeros for a player who
 * did play, so counting them would give a real player empty games.
 */
function espnLines(have: Have): string {
  const t = 'src_espn_player_box'
  const counts = BOX_COUNTS.map((c) => `${column(have, t, 'b', ESPN_NAMES[c])} AS ${c}`)
  return `CREATE OR REPLACE TEMP TABLE espn_lines AS
    SELECT g.game_id, i.player_id,
           CASE b.home_away WHEN 'home' THEN g.home_team_id ELSE g.away_team_id END AS team_id,
           'espn' AS source, round(b.minutes * 60)::INTEGER AS seconds,
           ${counts.join(', ')},
           -- ESPN's column is zero before the NBA's data starts, and not tracked then.
           NULL::INTEGER AS plus_minus,
           ${column(have, t, 'b', 'starter', 'BOOLEAN')} AS starter
    FROM ${t} b
    JOIN game g ON g.espn_game_id = b.game_id AND g.played
    JOIN player_ids i ON i.espn_athlete_id = b.athlete_id
    WHERE b.season = b.file_season AND b.points IS NOT NULL AND b.minutes IS NOT NULL
      AND NOT coalesce(b.did_not_play, false)
    QUALIFY row_number() OVER (PARTITION BY g.game_id, i.player_id ORDER BY b.minutes DESC NULLS LAST) = 1`
}

/**
 * One line per player per game they appeared in. The NBA's box score wherever it has the game, else
 * ESPN's: before 1996-97, and for the All-Star games it has. An empty `minutes` means the player
 * did not play, and every such line is all zeros.
 *
 * Who started: from 2017-18 the NBA lists a position for starters only, agreeing with ESPN on all
 * but one of 248,487 lines. Before it the NBA gives everyone a position, so ESPN's flag decides. ESPN
 * flags nobody in some games (110 in 2005-06), which is not a game of bench players, so unless a team
 * has exactly five starters its game reads as unknown.
 */
function lines(have: Have): string {
  const t = 'src_nba_player_box'
  const counts = BOX_COUNTS.map((c) => `${column(have, t, 'n', NBA_NAMES[c])} AS ${c}`)
  return `CREATE OR REPLACE TEMP TABLE lines AS
    WITH nba AS (
      SELECT g.game_id, g.season, n.person_id AS player_id, n.team_id, 'nba' AS source,
             clock_seconds(n.minutes) AS seconds, ${counts.join(', ')},
             ${column(have, t, 'n', 'plus_minus_points')} AS plus_minus,
             ${column(have, t, 'n', 'position', 'VARCHAR')} AS listed
      FROM ${t} n JOIN game g ON g.nba_game_id = n.game_id AND g.played
      WHERE n.minutes <> '' AND n.team_id > 0
    ), together AS (
      SELECT n.* EXCLUDE (season, listed),
             coalesce(CASE WHEN n.season >= 2018 THEN n.listed <> '' END, e.starter) AS flagged
      FROM nba n
      LEFT JOIN espn_lines e ON e.game_id = n.game_id AND e.player_id = n.player_id
      UNION ALL BY NAME
      SELECT e.* EXCLUDE (starter), e.starter AS flagged FROM espn_lines e
      WHERE e.team_id IS NOT NULL AND e.game_id NOT IN (SELECT game_id FROM nba)
    )
    SELECT * EXCLUDE (flagged),
           CASE WHEN count(*) FILTER (WHERE flagged) OVER (PARTITION BY game_id, team_id) = 5
                THEN coalesce(flagged, false) END AS starter
    FROM together`
}

/**
 * A player's position group in a season: the NBA's roster, then what its box scores list most (before
 * 2017-18 they list everyone), then ESPN's.
 */
function positions(have: Have): string {
  const roster = have.tables.has('src_nba_rosters')
    ? `SELECT player_id, season, mode(position_group(position)) AS position
       FROM src_nba_rosters GROUP BY 1, 2`
    : 'SELECT NULL::BIGINT AS player_id, NULL::INTEGER AS season, NULL::VARCHAR AS position'
  const box = have.columns.get('src_nba_player_box')?.has('position')
    ? `SELECT person_id AS player_id, season, mode(nullif(position, '')) AS position
       FROM src_nba_player_box WHERE minutes <> '' GROUP BY 1, 2`
    : 'SELECT NULL::BIGINT AS player_id, NULL::INTEGER AS season, NULL::VARCHAR AS position'
  const espn = have.columns.get('src_espn_player_box')?.has('athlete_position_abbreviation')
    ? `SELECT i.player_id, b.season, mode(position_group(b.athlete_position_abbreviation)) AS position
       FROM src_espn_player_box b JOIN player_ids i ON i.espn_athlete_id = b.athlete_id
       WHERE b.season = b.file_season AND b.points IS NOT NULL GROUP BY 1, 2`
    : 'SELECT NULL::BIGINT AS player_id, NULL::INTEGER AS season, NULL::VARCHAR AS position'
  return `CREATE OR REPLACE TEMP TABLE player_position AS
    WITH roster AS (${roster}), box AS (${box}), espn AS (${espn}),
    seen AS (
      SELECT DISTINCT l.player_id, g.season FROM lines l JOIN game g USING (game_id)
    )
    SELECT s.player_id, s.season, coalesce(r.position, b.position, e.position) AS position
    FROM seen s
    LEFT JOIN roster r ON r.player_id = s.player_id AND r.season = s.season
    LEFT JOIN box b ON b.player_id = s.player_id AND b.season = s.season
    LEFT JOIN espn e ON e.player_id = s.player_id AND e.season = s.season`
}

/**
 * ESPN's points by kind, which the NBA's box score does not have. `-1` means not recorded, and a
 * column stays zero before its first real season, so neither reads as a value.
 */
function espnKinds(have: Have): string {
  const t = 'src_espn_team_box'
  if (!have.tables.has(t)) {
    return `SELECT NULL::INTEGER AS espn_game_id, NULL::BOOLEAN AS home, NULL::INTEGER AS paint_pts,
                   NULL::INTEGER AS fast_break_pts, NULL::INTEGER AS turnover_pts`
  }
  const kind = (name: string, first: number): string => {
    const value = column(have, t, 'b', name)
    return `CASE WHEN b.season >= ${first} AND ${value} >= 0 THEN ${value} END`
  }
  return `SELECT b.game_id AS espn_game_id, b.team_home_away = 'home' AS home,
                 ${kind('points_in_paint', 2009)} AS paint_pts,
                 ${kind('fast_break_points', 2002)} AS fast_break_pts,
                 ${kind('turnover_points', 1995)} AS turnover_pts
          FROM ${t} b WHERE b.season = b.file_season`
}

/** The game's contribution, as PIE counts it: `C` in reference section 14.1. */
const pieOf = (p: string): string =>
  `${p}pts + ${p}fgm + ${p}ftm - ${p}fga - ${p}fta + ${p}dreb + 0.5 * ${p}oreb + ${p}ast + ${p}stl
   + 0.5 * ${p}blk - ${p}pf - ${p}tov`

/** Reference section 5's simple estimate, for one side. */
const possOf = (p: string): string => `${p}fga + 0.44 * ${p}fta - ${p}oreb + ${p}tov`

/** One half of reference section 5's rebound-adjusted estimate: `us` shooting, `them` defending. */
const brefHalf = (us: string, them: string): string =>
  `${us}fga + 0.4 * ${us}fta
   - 1.07 * ${per(`${us}oreb`, `${us}oreb + ${them}dreb`)} * (${us}fga - ${us}fgm) + ${us}tov`

/**
 * One row per team per game played: the NBA's team box score, or its players summed where it has
 * none. ESPN's team rebound and turnover columns change meaning by era, so they are never read. The
 * score comes from the game, so a game with no box score still counts toward a record.
 *
 * `after_break`: the date of the All-Star Game that was played, or of one still to come this season.
 * The schedule lists others that were not: 1998-99's was cancelled, so that season reads NULL rather
 * than guessing. It has none before 1996-97, so those three are written here, each inside the gap
 * in that February's games.
 */
function teamGame(have: Have): string {
  const t = 'src_nba_team_box'
  const counts = BOX_COUNTS.map((c) => `${column(have, t, 'n', NBA_NAMES[c])} AS ${c}`)
  const nba = have.tables.has(t)
    ? `SELECT n.game_id AS nba_game_id, n.team_id,
              ${column(have, t, 'n', 'minutes', 'VARCHAR')} AS clock, ${counts.join(', ')}
       FROM ${t} n WHERE n.team_id > 0`
    : `SELECT NULL::VARCHAR AS nba_game_id, NULL::BIGINT AS team_id, NULL::VARCHAR AS clock,
              ${BOX_COUNTS.map((c) => `NULL::INTEGER AS ${c}`).join(', ')}`
  return `CREATE OR REPLACE TABLE team_game AS
    WITH last_played AS (
      SELECT season, max(game_date) AS game_date FROM game WHERE played GROUP BY 1
    ), breaks AS (
      SELECT g.season, max(g.game_date) AS break_date
      FROM game g LEFT JOIN last_played l USING (season)
      WHERE g.game_type = 'all-star' AND (g.played OR g.game_date > l.game_date)
      GROUP BY 1
      UNION ALL
      SELECT * FROM (VALUES (1994, DATE '1994-02-13'), (1995, DATE '1995-02-12'), (1996, DATE '1996-02-11'))
    ), sides AS (
      SELECT game_id, nba_game_id, espn_game_id, season, game_type, game_date,
             home_team_id AS team_id, away_team_id AS opponent_id, true AS home,
             home_score AS points_for, away_score AS points_against
      FROM game WHERE played AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
      UNION ALL
      SELECT game_id, nba_game_id, espn_game_id, season, game_type, game_date,
             away_team_id, home_team_id, false, away_score, home_score
      FROM game WHERE played AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
    ), nba AS (${nba}
    ), players AS (
      SELECT game_id, team_id, sum(seconds) AS seconds,
             ${BOX_COUNTS.map((c) => `sum(${c}) AS ${c}`).join(', ')},
             sum(pts) FILTER (starter) AS starter_pts, sum(pts) FILTER (NOT starter) AS bench_pts,
             count(starter) > 0 AS known_starters
      FROM lines GROUP BY 1, 2
    ), kinds AS (${espnKinds(have)}),
    one_side AS (
      SELECT s.*,
             CASE WHEN n.team_id IS NOT NULL THEN 'nba' WHEN p.team_id IS NOT NULL THEN 'espn' END AS source,
             coalesce(clock_seconds(n.clock), p.seconds) AS seconds,
             ${BOX_COUNTS.map((c) => `coalesce(n.${c}, p.${c}) AS ${c}`).join(', ')},
             p.starter_pts, p.bench_pts, p.known_starters, k.paint_pts, k.fast_break_pts, k.turnover_pts,
             date_diff('day',
               lag(s.game_date) OVER (
                 PARTITION BY s.season, s.team_id, s.game_type = 'preseason'
                 ORDER BY s.game_date, s.game_id),
               s.game_date) - 1 AS rest_days,
             CASE WHEN b.break_date IS NOT NULL THEN s.game_date > b.break_date END AS after_break
      FROM sides s
      LEFT JOIN nba n ON n.nba_game_id = s.nba_game_id AND n.team_id = s.team_id
      LEFT JOIN players p ON p.game_id = s.game_id AND p.team_id = s.team_id
      LEFT JOIN kinds k ON k.espn_game_id = s.espn_game_id AND k.home = s.home
      LEFT JOIN breaks b ON b.season = s.season
    )
    SELECT t.* EXCLUDE (nba_game_id, espn_game_id, known_starters),
           ot.conference AS opp_conference, ot.division AS opp_division,
           1 AS games, (t.source IS NOT NULL)::INTEGER AS box_games,
           coalesce(t.known_starters, false)::INTEGER AS starts_known,
           (t.points_for > t.points_against)::INTEGER AS wins,
           (t.points_for < t.points_against)::INTEGER AS losses,
           t.seconds / 60.0 AS minutes,
           ${BOX_COUNTS.map((c) => `o.${c} AS opp_${c}`).join(', ')},
           o.paint_pts AS opp_paint_pts, o.fast_break_pts AS opp_fast_break_pts,
           o.turnover_pts AS opp_turnover_pts,
           ${possOf('t.')} AS poss, ${possOf('o.')} AS opp_poss,
           0.5 * (${possOf('t.')} + ${possOf('o.')}) AS poss_sym,
           0.5 * (${brefHalf('t.', 'o.')} + ${brefHalf('o.', 't.')}) AS poss_bref,
           (${pieOf('t.')}) + (${pieOf('o.')}) AS pie_total
    FROM one_side t
    LEFT JOIN one_side o ON o.game_id = t.game_id AND o.team_id = t.opponent_id
    LEFT JOIN team ot ON ot.team_id = t.opponent_id AND ot.season = t.season`
}

/**
 * One row per player per game they appeared in. Rates are never stored: every column here is summed
 * and divided when read, so any date range or group of games is exact.
 */
const PLAYER_GAME = `CREATE OR REPLACE TABLE player_game AS
  WITH categories AS (
    SELECT *,
           (coalesce(pts, 0) >= 10)::INTEGER + (coalesce(reb, 0) >= 10)::INTEGER
             + (coalesce(ast, 0) >= 10)::INTEGER + (coalesce(stl, 0) >= 10)::INTEGER
             + (coalesce(blk, 0) >= 10)::INTEGER AS tens,
           coalesce(pts, 0) >= 5 AND coalesce(reb, 0) >= 5 AND coalesce(ast, 0) >= 5
             AND coalesce(stl, 0) >= 5 AND coalesce(blk, 0) >= 5 AS fives
    FROM lines
  )
  SELECT l.player_id, l.game_id, l.team_id, l.source, l.starter, t.season, t.game_type, t.game_date,
         t.opponent_id, t.home, t.rest_days, t.after_break, t.opp_conference, t.opp_division,
         p.position,
         1 AS games, (l.starter IS TRUE)::INTEGER AS starts, t.wins, t.losses,
         l.seconds, l.seconds / 60.0 AS minutes,
         ${BOX_COUNTS.map((c) => `l.${c}`).join(', ')}, l.plus_minus,
         (l.tens >= 2)::INTEGER AS dd2, (l.tens >= 3)::INTEGER AS td3, (l.tens >= 4)::INTEGER AS qd4,
         l.fives::INTEGER AS five_by_five,
         ${Object.entries(TEAM_CONTEXT)
           .map(([name, sql]) => `${sql} AS ${name}`)
           .join(', ')},
         ${Object.entries(ON_COURT)
           .map(([name, sql]) => `${sql} AS ${name}`)
           .join(', ')}
  FROM categories l
  JOIN team_game t ON t.game_id = l.game_id AND t.team_id = l.team_id
  LEFT JOIN player_position p ON p.player_id = l.player_id AND p.season = t.season`

/** Builds `team_game` and `player_game`, each in one statement. Returns how many player lines. */
export async function buildGameTables(db: StatsDb, have: Have): Promise<number> {
  await db.exec(CLOCK_SECONDS)
  await db.exec(POSITION_GROUP)
  await db.exec(espnLines(have))
  await db.exec(lines(have))
  await db.exec(positions(have))
  await db.exec(teamGame(have))
  await db.exec(PLAYER_GAME)
  for (const temp of ['espn_lines', 'lines', 'player_position']) {
    await db.exec(`DROP TABLE ${temp}`)
  }
  const row = await db.get<{ n: number }>('SELECT count(*) AS n FROM player_game')
  return row?.n ?? 0
}
