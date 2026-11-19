import type { League } from '@shared/leagues'
import type { StatsDb } from '../db'
import { NCAA_PLAYER_SUMS, NCAA_TEAM_SUMS } from './ncaaSplits'
import { column, per, type Have } from './sql'

/**
 * How one league's box scores become `player_game` and `team_game` (`League.derived`). Every recipe
 * writes the same tables with the same columns and meaning; the shared SQL below (the team's game
 * beside its opponent's, the possessions, the estimates, the player's line with the team's context)
 * is one for every league, and only what the league's sources say differently is written per recipe.
 * `docs/reference/stats-database.md`, "How each league's tables are built".
 */
export interface DerivedRecipe {
  /** Bump when the recipe's tables change, so the next refresh builds them with nothing downloaded. */
  version: number
  /** The tables it cannot build without; their releases can never be left out (`leftOut.ts`). */
  needs: readonly string[]
  /**
   * Statements leaving the temp tables `lines` (one row per player per game they appeared in:
   * `game_id`, `player_id`, `team_id`, `source`, `seconds`, the counts, `plus_minus`, `starter`) and
   * `player_position` (`player_id`, `season`, `position`), and any of their own listed in `temps`.
   */
  lines(have: Have, league: League): string[]
  /** Temp tables the statements above leave beside those two, dropped after the build. */
  temps: readonly string[]
  /**
   * The league's team box score: `nba_game_id`, `team_id` (the `team` table's key), `seconds` (NULL
   * where it has none, so the players' are summed), and the counts.
   */
  teamBox(have: Have, league: League): string
  /** `team_game.source` for a team's own box score, and the SQL for one summed from its players (`p`). */
  boxSource: string
  summedSource: string
  /**
   * SQL for `team_game.source` over the team box (`n`) where one recipe's team box comes from more
   * than one source (the college leagues' ESPN and stats.ncaa.org); `boxSource` when not set.
   */
  boxSourceSql?: string
  /**
   * What `team_game.tov` counts. `players`: its players' sum, which leaves out the team's own (a
   * shot-clock violation charged to no player), so the composites add them from the play by play.
   * `own`: the team's row, which holds them where the league's rows count them, so the composites add
   * only what a row lacks of the play by play's (T1301.8).
   */
  teamTurnovers: 'players' | 'own'
  /** The first season of each of ESPN's points by kind holding values in this league. */
  espnKinds: { paint: number; fastBreak: number; turnover: number }
  /** All-Star dates the schedule does not hold, as SQL rows `(season, DATE '…')`. */
  breaks: readonly string[]
  /**
   * What `teamBox` is keyed by: the league's own game id (`nba_game_id`, the default), or the game's
   * key itself where the league has no other id (the college leagues, whose key is ESPN's).
   */
  teamBoxKey?: 'nba_game_id' | 'game_id'
  /**
   * Columns of its own a recipe carries beside the shared ones: on `lines`, which `player_game` keeps,
   * and from `sql` (`game_id`, `team_id` and the columns), which `team_game` keeps for both sides
   * (`opp_`). Summed in the season tables where present (`EXTRA_PLAYER_SUMS`, `EXTRA_TEAM_SUMS`).
   * None for the NBA and the WNBA, whose tables are as they were.
   */
  extras?: {
    player: readonly string[]
    team: readonly string[]
    teamSql(have: Have): string
  }
}

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
export const NBA_NAMES: Record<(typeof BOX_COUNTS)[number], string> = {
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
  on_poss: `${SHARE} * t.poss_sym`,
  // The NBA's published PIE divides by the game's total scaled the same way (reference 14.1). A side
  // plays five slots, so the share is the player's minutes over one slot's, overtime included.
  x_pie_den: `${SHARE} * t.pie_total`
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

/**
 * The columns only some recipes write (`DerivedRecipe.extras`): the college leagues' stats.ncaa.org
 * splits. The season tables sum them where the game tables hold them, and the engine reads them as
 * components, so a metric over them answers in the leagues that have them and nowhere else.
 */
export const EXTRA_PLAYER_SUMS: readonly string[] = NCAA_PLAYER_SUMS
export const EXTRA_TEAM_SUMS: readonly string[] = NCAA_TEAM_SUMS

/** "6:34", "240:00" or, on 88 old lines, "26" whole minutes. Anything else reads as NULL. */
const CLOCK_SECONDS = `CREATE OR REPLACE TEMP MACRO clock_seconds(m) AS CASE
    WHEN m LIKE '%:%' THEN TRY_CAST(split_part(m, ':', 1) AS INTEGER) * 60
                         + TRY_CAST(split_part(m, ':', 2) AS INTEGER)
    ELSE TRY_CAST(m AS INTEGER) * 60
  END`

/** `G-F` is a guard, `F-C` a forward and `C-F` a center: the first listed is the group (Plan T504). */
export const positionGroup = (p: string): string => `CASE
    WHEN ${p} IN ('PG', 'SG', 'G') OR ${p} LIKE 'G-%' OR ${p} = 'GF' THEN 'G'
    WHEN ${p} IN ('SF', 'PF', 'F') OR ${p} LIKE 'F-%' THEN 'F'
    WHEN ${p} = 'C' OR ${p} LIKE 'C-%' THEN 'C'
  END`

const POSITION_GROUP = `CREATE OR REPLACE TEMP MACRO position_group(p) AS ${positionGroup('p')}`

/**
 * The ESPN lines of players who appeared, read once per game: 1998-99 is in two files. A line with no
 * minutes is not an appearance, even with stats: 34 of them in 1994-95 are all zeros for a player who
 * did play, so counting them would give a real player empty games. `from` leaves out seasons whose
 * lines the league's ESPN files hold as zeros (the WNBA's 2002).
 */
export function espnLines(have: Have, from?: number): string {
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
      AND NOT coalesce(b.did_not_play, false)${from === undefined ? '' : ` AND b.season >= ${from}`}
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
function espnKinds(have: Have, first: DerivedRecipe['espnKinds']): string {
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
                 ${kind('points_in_paint', first.paint)} AS paint_pts,
                 ${kind('fast_break_points', first.fastBreak)} AS fast_break_pts,
                 ${kind('turnover_points', first.turnover)} AS turnover_pts
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
 * One row per team per game played: the league's team box score (the recipe's), or its players
 * summed where it has none. ESPN's team rebound and turnover columns change meaning by era, so they
 * are never read. The score comes from the game, so a game with no box score still counts toward a
 * record, and a forfeit (the WNBA's 2018 game, 0-0) is a win for the side `game.forfeit_winner_id`
 * names and a loss for the other, with no box score.
 *
 * `after_break`: the date of the All-Star Game that was played, or of one still to come this season.
 * The schedule lists others that were not: 1998-99's was cancelled, so that season reads NULL rather
 * than guessing. The NBA's has none before 1996-97, so its recipe names those three, each inside the
 * gap in that February's games.
 */
function teamGame(have: Have, recipe: DerivedRecipe, league: League): string {
  const forfeits = have.columns.get('game')?.has('forfeit_winner_id') ?? false
  const key = recipe.teamBoxKey ?? 'nba_game_id'
  const extras = recipe.extras
  const won =(op: '>' | '<', winner: string): string =>
    forfeits
      ? `CASE WHEN t.forfeit_winner_id IS NOT NULL THEN t.team_id ${winner} t.forfeit_winner_id
              ELSE t.points_for ${op} t.points_against END`
      : `t.points_for ${op} t.points_against`
  const breaks = recipe.breaks.length
    ? `SELECT * FROM (VALUES ${recipe.breaks.join(', ')})`
    : 'SELECT NULL::INTEGER, NULL::DATE WHERE false'
  return `CREATE OR REPLACE TABLE team_game AS
    WITH last_played AS (
      SELECT season, max(game_date) AS game_date FROM game WHERE played GROUP BY 1
    ), breaks AS (
      SELECT g.season, max(g.game_date) AS break_date
      FROM game g LEFT JOIN last_played l USING (season)
      WHERE g.game_type = 'all-star' AND (g.played OR g.game_date > l.game_date)
      GROUP BY 1
      UNION ALL
      ${breaks}
    ), sides AS (
      SELECT game_id, nba_game_id, espn_game_id, season, game_type, game_date,
             home_team_id AS team_id, away_team_id AS opponent_id, true AS home,
             home_score AS points_for, away_score AS points_against${forfeits ? ', forfeit_winner_id' : ''}
      FROM game WHERE played AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
      UNION ALL
      SELECT game_id, nba_game_id, espn_game_id, season, game_type, game_date,
             away_team_id, home_team_id, false, away_score, home_score${forfeits ? ', forfeit_winner_id' : ''}
      FROM game WHERE played AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
    ), nba AS (${recipe.teamBox(have, league)}
    ),${extras ? ` extras AS (${extras.teamSql(have)}),` : ''} players AS (
      SELECT game_id, team_id, mode(source) AS source, sum(seconds) AS seconds,
             ${BOX_COUNTS.map((c) => `sum(${c}) AS ${c}`).join(', ')},
             sum(pts) FILTER (starter) AS starter_pts, sum(pts) FILTER (NOT starter) AS bench_pts,
             count(starter) > 0 AS known_starters
      FROM lines GROUP BY 1, 2
    ), kinds AS (${espnKinds(have, recipe.espnKinds)}),
    one_side AS (
      SELECT s.*,
             CASE WHEN n.team_id IS NOT NULL THEN ${recipe.boxSourceSql ?? `'${recipe.boxSource}'`}
                  WHEN p.team_id IS NOT NULL THEN ${recipe.summedSource} END AS source,
             coalesce(n.seconds, p.seconds) AS seconds,
             ${BOX_COUNTS.map((c) => `coalesce(n.${c}, p.${c}) AS ${c}`).join(', ')},
             p.starter_pts, p.bench_pts, p.known_starters, k.paint_pts, k.fast_break_pts, k.turnover_pts,${
               extras ? extras.team.map((c) => ` x.${c},`).join('') : ''
             }
             date_diff('day',
               lag(s.game_date) OVER (
                 PARTITION BY s.season, s.team_id, s.game_type = 'preseason'
                 ORDER BY s.game_date, s.game_id),
               s.game_date) - 1 AS rest_days,
             CASE WHEN b.break_date IS NOT NULL THEN s.game_date > b.break_date END AS after_break
      FROM sides s
      LEFT JOIN nba n ON n.${key} = s.${key} AND n.team_id = s.team_id
      LEFT JOIN players p ON p.game_id = s.game_id AND p.team_id = s.team_id${
        extras ? '\n      LEFT JOIN extras x ON x.game_id = s.game_id AND x.team_id = s.team_id' : ''
      }
      LEFT JOIN kinds k ON k.espn_game_id = s.espn_game_id AND k.home = s.home
      LEFT JOIN breaks b ON b.season = s.season
    )
    SELECT t.* EXCLUDE (nba_game_id, espn_game_id, known_starters${forfeits ? ', forfeit_winner_id' : ''}),
           ot.conference AS opp_conference, ot.division AS opp_division,
           1 AS games, (t.source IS NOT NULL)::INTEGER AS box_games,
           coalesce(t.known_starters, false)::INTEGER AS starts_known,
           (${won('>', '=')})::INTEGER AS wins,
           (${won('<', '<>')})::INTEGER AS losses,
           t.seconds / 60.0 AS minutes,
           ${BOX_COUNTS.map((c) => `o.${c} AS opp_${c}`).join(', ')},
           o.paint_pts AS opp_paint_pts, o.fast_break_pts AS opp_fast_break_pts,
           o.turnover_pts AS opp_turnover_pts,${
             extras ? extras.team.map((c) => ` o.${c} AS opp_${c},`).join('') : ''
           }
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
const playerGame = (extras: readonly string[]): string => `CREATE OR REPLACE TABLE player_game AS
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
           .join(', ')}${extras.map((c) => `, l.${c}`).join('')}
  FROM categories l
  JOIN team_game t ON t.game_id = l.game_id AND t.team_id = l.team_id
  LEFT JOIN player_position p ON p.player_id = l.player_id AND p.season = t.season`

/** The NBA's team box score, its `minutes` read as seconds. */
function nbaTeamBox(have: Have): string {
  const t = 'src_nba_team_box'
  const counts = BOX_COUNTS.map((c) => `${column(have, t, 'n', NBA_NAMES[c])} AS ${c}`)
  return have.tables.has(t)
    ? `SELECT n.game_id AS nba_game_id, n.team_id,
              clock_seconds(${column(have, t, 'n', 'minutes', 'VARCHAR')}) AS seconds, ${counts.join(', ')}
       FROM ${t} n WHERE n.team_id > 0`
    : `SELECT NULL::VARCHAR AS nba_game_id, NULL::BIGINT AS team_id, NULL::INTEGER AS seconds,
              ${BOX_COUNTS.map((c) => `NULL::INTEGER AS ${c}`).join(', ')}`
}

/**
 * The NBA's recipe: its box scores wherever they have the game (everything counted from 1996-97),
 * ESPN's before them and for the All-Star games it has.
 */
export const NBA_DERIVED: DerivedRecipe = {
  version: 2,
  needs: ['game', 'team', 'player_ids', 'src_espn_player_box', 'src_nba_player_box'],
  lines: (have) => [espnLines(have), lines(have), positions(have)],
  temps: ['espn_lines'],
  teamBox: nbaTeamBox,
  boxSource: 'nba',
  summedSource: "'espn'",
  teamTurnovers: 'players',
  espnKinds: { paint: 2009, fastBreak: 2002, turnover: 1995 },
  breaks: ["(1994, DATE '1994-02-13')", "(1995, DATE '1995-02-12')", "(1996, DATE '1996-02-11')"]
}

/**
 * Builds `team_game` and `player_game` with the league's recipe, each in one statement. Returns how
 * many player lines.
 */
export async function buildGameTables(
  db: StatsDb,
  have: Have,
  recipe: DerivedRecipe,
  league: League
): Promise<number> {
  await db.exec(CLOCK_SECONDS)
  await db.exec(POSITION_GROUP)
  for (const sql of recipe.lines(have, league)) await db.exec(sql)
  await db.exec(teamGame(have, recipe, league))
  await db.exec(playerGame(recipe.extras?.player ?? []))
  for (const temp of [...recipe.temps, 'lines', 'player_position']) {
    await db.exec(`DROP TABLE ${temp}`)
  }
  const row = await db.get<{ n: number }>('SELECT count(*) AS n FROM player_game')
  return row?.n ?? 0
}
