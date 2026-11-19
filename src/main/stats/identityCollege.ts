import { regulationPeriodsSql, type League } from '@shared/leagues'
import type { StatsDb } from './db'
import type { IdentityRecipe } from './identity'
import { hasTables } from './identityShared'

/**
 * NCAA Division I's identity recipe, one for the men and the women (D38): the same `game`, `team`,
 * `player_ids` and `player` tables as the NBA's and the WNBA's, keyed by ESPN's ids (D40), and
 * `ncaa_player_ids`, which maps stats.ncaa.org's players to them. What the college sources need, each
 * measured in `docs/reference/ncaa-data-sources.md` ("Traps") on the first load of T1302.3:
 *
 * - ESPN's ids are the keys: `game_id`, `team_id` and `athlete_id` hold across seasons and transfers.
 *   stats.ncaa.org's ids change every season, so they are never keys; its games join through the
 *   ESPN id it or the schedule crosswalk gives, or the same teams and score (`LINK`), and its players
 *   through the player crosswalk, the same box-score lines, or the same name on the same team.
 * - ESPN lacks some games stats.ncaa.org has (334 of the women's 2024-25, of which 16 postseason):
 *   they are games all the same, filled from stats.ncaa.org. stats.ncaa.org also lists a few
 *   exhibitions, which ESPN does not, and which are left out (`FILLED`).
 * - Season types are the events (D45), from ESPN's headlines: the NCAA tournament (`playoffs`), the
 *   NIT and WNIT, and the smaller postseason events. Conference tournaments and early-season events are
 *   regular season, flagged by their `tournament_id` and named in `event`.
 * - Every opponent is a team, Division I or not; `division_i` is the groups file's list of the season.
 *
 * Only ESPN's schedule and player box scores and the groups file are needed: with the `ncaa_*`
 * releases left out (D41) the tables build from ESPN's alone, `ncaa_player_ids` empty.
 *
 * The column `nba_game_id` is NULL: the league's own game id is ESPN's, in `game_id`, and the NBA's
 * name is kept so the columns every recipe writes stay the same. Beyond them, `game` gives
 * stats.ncaa.org's contest id (`ncaa_game_id`), the event's `tournament_id` and name, and whether ESPN
 * calls it a conference game; `team` gives the conference and division by name and by the groups'
 * id, the Division I flag and stats.ncaa.org's team and school ids of the season; `player` gives the
 * bio ESPN and stats.ncaa.org publish.
 */

/** Bump when these tables change, so the next refresh builds them with nothing downloaded. */
const VERSION = 1

/** ESPN's schedule, its player box scores and the groups file: the keys (D40) and conferences. */
const NEEDS = ['src_espn_schedule', 'src_espn_player_box', 'src_team_groups']

/** stats.ncaa.org's tables the recipe reads when they are loaded (D41). */
const NCAA_GAMES = ['src_ncaa_schedule', 'src_ncaa_team_box']
const NCAA_LINES = ['src_ncaa_player_box']

/** A word in lower-cased text, as SQL: `nit` is in "NIT - First Round", not in "Unity". */
const word = (text: string, w: string): string =>
  `regexp_matches(${text}, '(^|[^a-z])${w}([^a-z]|$)')`

/**
 * The event of an ESPN postseason game (type 3), from its headline as D45 has it. ESPN spells the
 * NCAA tournament four ways in the window ("Men's Basketball Championship", "NCAA Men's Basketball
 * Championship", "NCAA Women's Championship pres. by Capital One", "NCAA Women's Basketball
 * Championship"), so the rule reads "championship" with "NCAA" or "basketball", after the smaller
 * events, whose own finals are "… Championship" too. A headline it does not know falls back to ESPN's
 * `tournament_id` for the event, which agrees with the headline on every game of the window
 * (`ncaa-data-sources.md`, "Traps"), and to the regular season past that.
 */
export const POSTSEASON_EVENT_SQL = (h: string, tournament: string): string => `CASE
    WHEN ${word(h, 'wbit')} THEN 'wbit'
    WHEN ${word(h, 'wbi')} THEN 'wbi'
    WHEN ${word(h, 'wnit')} OR ${h} LIKE '%women''s nit%' THEN 'wnit'
    WHEN ${word(h, 'nit')} THEN 'nit'
    WHEN ${word(h, 'cbi')} THEN 'cbi'
    WHEN ${word(h, 'cit')} THEN 'cit'
    WHEN ${h} LIKE '%basketball classic%' THEN 'tbc'
    WHEN ${h} LIKE '%basketball crown%' THEN 'crown'
    WHEN ${h} LIKE '%championship%' AND (${word(h, 'ncaa')} OR ${h} LIKE '%basketball championship%')
      THEN 'playoffs'
    ELSE CASE ${tournament}
      WHEN 22 THEN 'playoffs' WHEN 21 THEN 'nit' WHEN 37 THEN 'wnit' WHEN 11 THEN 'cbi'
      WHEN 35 THEN 'cit' WHEN 42 THEN 'tbc' WHEN 161 THEN 'crown' WHEN 38 THEN 'wbi'
      WHEN 62 THEN 'wbit' ELSE 'regular' END
  END`

/**
 * ESPN's games, one row per `game_id`, from its season files. Its schedule master holds the same games
 * to 2025-26 (every one of the window's, row for row, on the load of T1302.3), and differs on a few
 * flags and team names, so the season files win and the master is not read. A postponed, cancelled or
 * suspended row is not a game: the game played later has its own row. Games not yet played are kept
 * for the current season only, the one whose file still holds them. Its type is the event (D45).
 */
const espnGamesSql = (league: League): string => `CREATE OR REPLACE TEMP TABLE college_espn AS
  WITH rows_ AS (
    SELECT game_id, season, season_type, game_date::DATE AS game_date, home_id, away_id,
           home_score, away_score, neutral_site, notes_headline, tournament_id,
           conference_competition, status_type_name, coalesce(status_type_completed, false) AS completed,
           status_period, format_regulation_periods, home_display_name, home_abbreviation,
           away_display_name, away_abbreviation
    FROM src_espn_schedule
    WHERE game_id IS NOT NULL
  ), typed AS (
    SELECT DISTINCT ON (game_id) *,
           CASE WHEN season_type = 3
                THEN ${POSTSEASON_EVENT_SQL("lower(coalesce(notes_headline, ''))", 'tournament_id')}
                ELSE 'regular' END AS event_type
    FROM rows_
    WHERE completed
       OR (status_type_name = 'STATUS_SCHEDULED' AND season = (SELECT max(season) FROM rows_))
    ORDER BY game_id, completed DESC, season DESC
  )
  -- A type the league does not have (another league's event: none in the window) reads as the
  -- regular season rather than a type its screens do not offer.
  SELECT * EXCLUDE (event_type),
         CASE WHEN event_type IN (${league.seasonTypes.map((t) => `'${t}'`).join(', ')})
              THEN event_type ELSE 'regular' END AS game_type
  FROM typed`

/**
 * stats.ncaa.org's games, one row per contest, from its schedule, with the ESPN ids it publishes for
 * the game and both teams, the crosswalk's where it publishes none (its `espn_game_id` starts in
 * 2022-23 for the men and 2023-24 for the women), and the team crosswalk's by its own team ids after
 * that. The team box's minutes tell the overtimes.
 */
/**
 * D28's key for an opponent no source gives an ESPN id: a school outside Division I that ESPN does not
 * list, in a contest only stats.ncaa.org has (11 in the window, men and women). The negative of a
 * number from the name stats.ncaa.org prints, so no ESPN id equals it: the link reads such a side as
 * unknown, and `FILLED` leaves the contest out as an exhibition, as the comment there says.
 */
const OUTSIDE_KEY = (name: string): string =>
  `CASE WHEN nullif(trim(${name}), '') IS NOT NULL
        THEN -(1 + hash(lower(trim(${name}))) % 999999999)::INTEGER END`

const ncaaGamesSql = (have: boolean, xwalkGame: boolean, xwalkTeams: boolean): string =>
  have
    ? `CREATE OR REPLACE TEMP TABLE college_ncaa AS
  WITH box AS (
    SELECT contest_id,
           TRY_CAST(nullif(any_value(espn_game_id)::VARCHAR, '') AS BIGINT) AS own_espn,
           TRY_CAST(any_value(home_espn_team_id) AS INTEGER) AS home_espn,
           TRY_CAST(any_value(away_espn_team_id) AS INTEGER) AS away_espn,
           TRY_CAST(any_value(home_ncaa_team_id) AS BIGINT) AS home_ncaa,
           TRY_CAST(any_value(away_ncaa_team_id) AS BIGINT) AS away_ncaa,
           max(mins) AS minutes
    FROM src_ncaa_team_box GROUP BY 1
  ), xg AS (
    ${
      xwalkGame
        ? `SELECT ncaa_contest_id AS contest_id,
                  arg_max(TRY_CAST(espn_game_id AS BIGINT), (coalesce(match_confidence, 0), -TRY_CAST(espn_game_id AS BIGINT))) AS espn,
                  arg_max(home_espn_team_id, (coalesce(match_confidence, 0), -TRY_CAST(espn_game_id AS BIGINT))) AS home_espn,
                  arg_max(away_espn_team_id, (coalesce(match_confidence, 0), -TRY_CAST(espn_game_id AS BIGINT))) AS away_espn
           FROM src_xwalk_game
           WHERE nullif(ncaa_contest_id, '') IS NOT NULL AND TRY_CAST(espn_game_id AS BIGINT) IS NOT NULL
           GROUP BY 1`
        : 'SELECT NULL::VARCHAR AS contest_id, NULL::BIGINT AS espn, NULL::INTEGER AS home_espn, NULL::INTEGER AS away_espn WHERE false'
    }
  ), xt AS (
    ${
      xwalkTeams
        ? `SELECT season, ncaa_team_id, min(TRY_CAST(espn_team_id AS INTEGER)) AS espn
           FROM src_xwalk_ncaa_teams WHERE TRY_CAST(espn_team_id AS INTEGER) IS NOT NULL GROUP BY 1, 2`
        : 'SELECT NULL::INTEGER AS season, NULL::BIGINT AS ncaa_team_id, NULL::INTEGER AS espn WHERE false'
    }
  )
  SELECT s.contest_id, s.season, TRY_STRPTIME(s.game_date, '%m/%d/%Y')::DATE AS game_date,
         s.home AS home_name, s.away AS away_name, s.home_score, s.away_score, b.minutes,
         b.own_espn, x.espn AS xwalk_espn,
         coalesce(b.home_espn, x.home_espn, th.espn, ${OUTSIDE_KEY('s.home')}) AS home_id,
         coalesce(b.away_espn, x.away_espn, ta.espn, ${OUTSIDE_KEY('s.away')}) AS away_id
  FROM (SELECT DISTINCT ON (contest_id) * FROM src_ncaa_schedule ORDER BY contest_id, file_season DESC) s
  LEFT JOIN box b USING (contest_id)
  LEFT JOIN xg x USING (contest_id)
  LEFT JOIN xt th ON th.season = s.season AND th.ncaa_team_id = b.home_ncaa
  LEFT JOIN xt ta ON ta.season = s.season AND ta.ncaa_team_id = b.away_ncaa`
    : `CREATE OR REPLACE TEMP TABLE college_ncaa AS
  SELECT NULL::VARCHAR AS contest_id, NULL::INTEGER AS season, NULL::DATE AS game_date,
         NULL::VARCHAR AS home_name, NULL::VARCHAR AS away_name, NULL::BIGINT AS home_score,
         NULL::BIGINT AS away_score, NULL::DOUBLE AS minutes, NULL::BIGINT AS own_espn,
         NULL::BIGINT AS xwalk_espn, NULL::INTEGER AS home_id, NULL::INTEGER AS away_id
  WHERE false`

const SAME_TEAMS = (e: string, n: string): string =>
  `((${e}.home_id = ${n}.home_id AND ${e}.away_id = ${n}.away_id)
     OR (${e}.home_id = ${n}.away_id AND ${e}.away_id = ${n}.home_id))`
const SAME_SCORE = (e: string, n: string): string =>
  `((${e}.home_score = ${n}.home_score AND ${e}.away_score = ${n}.away_score)
     OR (${e}.home_score = ${n}.away_score AND ${e}.away_score = ${n}.home_score))`
const DAYS = (e: string, n: string): string =>
  `abs(date_diff('day', ${e}.game_date, ${n}.game_date))`

/** One round of `LINK`: the pairs each side ranks first, of those whose two sides are still free. */
const linkRound = (from: string, taken: readonly string[]): string => {
  const free = taken
    .map(
      (t) =>
        `contest_id NOT IN (SELECT contest_id FROM ${t}) AND game_id NOT IN (SELECT game_id FROM ${t})`
    )
    .join(' AND ')
  return `SELECT * FROM ${from} ${free ? `WHERE ${free}` : ''}
    QUALIFY row_number() OVER (PARTITION BY contest_id ORDER BY rank DESC, days, game_id) = 1
        AND row_number() OVER (PARTITION BY game_id ORDER BY rank DESC, days, contest_id) = 1`
}

/**
 * Each stats.ncaa.org game linked to ESPN's, each row of either side once. The ids the source gives
 * (its own `espn_game_id`, else the crosswalk's) are mostly right, but not always: the crosswalk gives
 * Hawaii's game with Hawaii Hilo of 2021-11-11 the id of Hawaii's game with Northern Colorado that
 * day, and stats.ncaa.org's team box gives Hawaii Hilo Northern Colorado's ESPN id. So every candidate
 * pair is ranked, and the pairs both sides rank first are linked, in rounds:
 *
 * 5. the given id, with the same score either way round;
 * 4. the same two teams, either way round (neutral sites), and the same score, within a day;
 * 3. one team in common and the same score, within a day (a side's id given wrong);
 * 2. the same two teams and the same score on another day of the season: a postponed game, which
 *    stats.ncaa.org can keep on the day first set (Towson against Delaware, 69-57, on 2022-01-27 there
 *    and 2022-02-28 in ESPN's);
 * 1. the given id, with one team in common or a side with no ESPN id (the two sources' scores differ
 *    by a point or two on about one game in a thousand);
 * 0. the same two teams within a day.
 *
 * A game left over is one ESPN lacks (`FILLED`).
 */
const LINK = `CREATE OR REPLACE TEMP TABLE college_link AS
  WITH pairs AS (
    SELECT n.contest_id, e.game_id, true AS by_id, n.home_id AS nh, n.away_id AS na, e.home_id AS eh,
           e.away_id AS ea, ${SAME_TEAMS('e', 'n')} AS same_teams, ${SAME_SCORE('e', 'n')} AS same_score,
           ${DAYS('e', 'n')} AS days
    FROM college_ncaa n JOIN college_espn e ON e.game_id IN (n.own_espn, n.xwalk_espn)
    UNION ALL
    SELECT n.contest_id, e.game_id, false, n.home_id, n.away_id, e.home_id, e.away_id,
           ${SAME_TEAMS('e', 'n')}, ${SAME_SCORE('e', 'n')}, ${DAYS('e', 'n')}
    FROM college_ncaa n JOIN college_espn e ON e.season = n.season AND e.home_id IN (n.home_id, n.away_id)
    UNION ALL
    SELECT n.contest_id, e.game_id, false, n.home_id, n.away_id, e.home_id, e.away_id,
           ${SAME_TEAMS('e', 'n')}, ${SAME_SCORE('e', 'n')}, ${DAYS('e', 'n')}
    FROM college_ncaa n JOIN college_espn e ON e.season = n.season AND e.away_id IN (n.home_id, n.away_id)
  ), ranked AS (
    SELECT contest_id, game_id, max(rank) AS rank, min(days) AS days FROM (
      SELECT contest_id, game_id, days,
             CASE WHEN by_id AND same_score THEN 5
                  WHEN same_teams AND same_score AND days <= 1 THEN 4
                  WHEN NOT by_id AND same_score AND days <= 1 THEN 3
                  WHEN same_teams AND same_score THEN 2
                  WHEN by_id AND (nh IN (eh, ea) OR na IN (eh, ea) OR nh < 0 OR na < 0) THEN 1
                  WHEN same_teams AND days <= 1 THEN 0
             END AS rank
      FROM pairs
    ) WHERE rank IS NOT NULL GROUP BY 1, 2
  ), round1 AS (${linkRound('ranked', [])}
  ), round2 AS (${linkRound('ranked', ['round1'])}
  ), round3 AS (${linkRound('ranked', ['round1', 'round2'])}
  )
  SELECT contest_id, game_id AS espn_game_id,
         CASE WHEN rank IN (5, 1) THEN 'espn id' WHEN rank IN (4, 0) THEN 'teams and date'
              WHEN rank = 3 THEN 'one team, score and date' ELSE 'teams and score' END AS method
  FROM (SELECT * FROM round1 UNION ALL SELECT * FROM round2 UNION ALL SELECT * FROM round3)`

/**
 * The games ESPN lacks, from stats.ncaa.org, keyed as `LINK` says. Only games with a score. A contest
 * with the two teams of an ESPN game within a day, or with the same score as one no contest is linked
 * to, is that game listed twice, not another game: stats.ncaa.org has Iowa against Virginia Tech of
 * 88-93 and 89-93.
 *
 * A contest against a team no source gives an ESPN id is left out: ESPN lists every opponent a
 * Division I team plays, so such a game is one only stats.ncaa.org lists, against a school outside
 * Division I, and Sports Reference's records leave out 10 of the 11 in the window (most before
 * opening day, as Clemson against Georgia Southwestern on 2021-11-01): exhibitions, which the NCAA
 * does not count. The eleventh, Alabama State against Tuskegee on 2021-11-22, is lost with them.
 */
const FILLED = `CREATE OR REPLACE TEMP TABLE college_filled AS
  SELECT n.*,
         CASE WHEN coalesce(n.own_espn, n.xwalk_espn) IS NOT NULL
                AND coalesce(n.own_espn, n.xwalk_espn) NOT IN (SELECT game_id FROM college_espn)
              THEN coalesce(n.own_espn, n.xwalk_espn) END AS espn_game_id
  FROM college_ncaa n
  WHERE n.contest_id NOT IN (SELECT contest_id FROM college_link)
    AND n.home_score IS NOT NULL AND n.away_score IS NOT NULL
    AND n.home_score + n.away_score > 0
    AND n.home_id > 0 AND n.away_id > 0
    AND NOT EXISTS (
      SELECT 1 FROM college_espn e
      WHERE e.season = n.season AND ${SAME_TEAMS('e', 'n')}
        AND (abs(date_diff('day', e.game_date, n.game_date)) <= 1
             OR (${SAME_SCORE('e', 'n')} AND e.game_id NOT IN (SELECT espn_game_id FROM college_link))))
  QUALIFY coalesce(espn_game_id, 0) = 0
       OR row_number() OVER (PARTITION BY espn_game_id ORDER BY n.contest_id) = 1`

/**
 * One row per team per season: every team in the season's games, Division I or not, and every team
 * the groups file lists that season. The name and code are ESPN's latest of the season, else the
 * groups' and the crosswalks'. The conference and division are the groups file's for the season,
 * by short name ("ACC", "Big Ten") with the groups' ids beside them; `division_i` says the team is in
 * the season's list (D40). stats.ncaa.org's team id of the season and its school id are the team
 * crosswalk's.
 */
const teamSql = (
  xwalkTeams: boolean,
  xwalkTeam: boolean
): string => `CREATE OR REPLACE TABLE team AS
  WITH sides AS (
    SELECT season, home_id AS team_id, home_display_name AS name, home_abbreviation AS code, game_date
    FROM college_espn
    UNION ALL
    SELECT season, away_id, away_display_name, away_abbreviation, game_date FROM college_espn
    UNION ALL
    SELECT season, home_id, CASE WHEN home_id < 0 THEN home_name END, NULL, game_date FROM college_filled
    UNION ALL
    SELECT season, away_id, CASE WHEN away_id < 0 THEN away_name END, NULL, game_date FROM college_filled
  ), named AS (
    SELECT season, team_id,
           arg_max(name, game_date) FILTER (WHERE nullif(name, '') IS NOT NULL) AS name,
           arg_max(code, game_date) FILTER (WHERE nullif(code, '') IS NOT NULL) AS code
    FROM sides WHERE team_id IS NOT NULL GROUP BY 1, 2
  ), d1 AS (
    SELECT season, TRY_CAST(team_id AS INTEGER) AS team_id, any_value(team_name) AS name,
           any_value(conference_id) AS conference_id, any_value(division_id) AS division_id
    FROM src_team_groups WHERE TRY_CAST(team_id AS INTEGER) IS NOT NULL GROUP BY 1, 2
  ), teams AS (
    SELECT season, team_id FROM named UNION SELECT season, team_id FROM d1
  ), groups AS (
    ${
      // The groups' seasons file names each conference and division of a season.
      `SELECT season, group_id, any_value(short_name) AS short_name FROM src_group_seasons GROUP BY 1, 2`
    }
  ), ncaa AS (
    ${
      xwalkTeams
        ? `SELECT season, TRY_CAST(espn_team_id AS INTEGER) AS team_id, min(ncaa_team_id) AS ncaa_team_id,
                  min(ncaa_org_id) AS ncaa_org_id,
                  any_value(espn_display_name) AS name, any_value(espn_abbreviation) AS code
           FROM src_xwalk_ncaa_teams WHERE TRY_CAST(espn_team_id AS INTEGER) IS NOT NULL GROUP BY 1, 2`
        : 'SELECT NULL::INTEGER AS season, NULL::INTEGER AS team_id, NULL::BIGINT AS ncaa_team_id, NULL::BIGINT AS ncaa_org_id, NULL::VARCHAR AS name, NULL::VARCHAR AS code WHERE false'
    }
  ), xwalk AS (
    ${
      xwalkTeam
        ? `SELECT season, espn_team_id AS team_id, any_value(espn_display_name) AS name,
                  any_value(espn_abbreviation) AS code
           FROM src_xwalk_team WHERE espn_team_id IS NOT NULL GROUP BY 1, 2`
        : 'SELECT NULL::INTEGER AS season, NULL::INTEGER AS team_id, NULL::VARCHAR AS name, NULL::VARCHAR AS code WHERE false'
    }
  )
  SELECT t.season, t.team_id, t.team_id AS espn_team_id,
         coalesce(n.code, c.code, x.code) AS code, coalesce(n.name, d.name, c.name, x.name) AS name,
         cg.short_name AS conference, dg.short_name AS division,
         d.conference_id, d.division_id, d.team_id IS NOT NULL AS division_i,
         c.ncaa_team_id, c.ncaa_org_id
  FROM teams t
  LEFT JOIN named n USING (season, team_id)
  LEFT JOIN d1 d USING (season, team_id)
  LEFT JOIN ncaa c USING (season, team_id)
  LEFT JOIN xwalk x USING (season, team_id)
  LEFT JOIN groups cg ON cg.season = t.season AND cg.group_id = d.conference_id
  LEFT JOIN groups dg ON dg.season = t.season AND dg.group_id = d.division_id`

/**
 * One row per game: ESPN's, then the games ESPN lacks from stats.ncaa.org. A forfeit is ESPN's 2-0
 * row: played, with the winner named, its score kept as published. Overtimes are ESPN's last period
 * past regulation, or for a game ESPN lacks the team box's minutes past 40, five a period.
 *
 * A filled game played on or after the season's first postseason game takes the event one of its
 * teams played in that season, the home team's first (each team plays at most one postseason event
 * a season); before it, or when neither team played one, it is the regular season.
 */
const gameSql = (league: League): string => {
  const regulation = league.gameMinutes
  const overtime = league.overtimeMinutes
  return `CREATE OR REPLACE TABLE game AS
  WITH event_teams AS (
    SELECT DISTINCT season, game_type, home_id AS team_id FROM college_espn WHERE game_type <> 'regular'
    UNION
    SELECT DISTINCT season, game_type, away_id FROM college_espn WHERE game_type <> 'regular'
  ), postseason AS (
    SELECT season, min(game_date) AS first FROM college_espn WHERE season_type = 3 GROUP BY 1
  ), filled AS (
    SELECT f.*,
           CASE WHEN f.game_date >= p.first THEN coalesce(
             (SELECT any_value(e.game_type) FROM event_teams e WHERE e.season = f.season AND e.team_id = f.home_id),
             (SELECT any_value(e.game_type) FROM event_teams e WHERE e.season = f.season AND e.team_id = f.away_id),
             'regular') ELSE 'regular' END AS game_type
    FROM college_filled f LEFT JOIN postseason p USING (season)
  )
  SELECT e.game_id::VARCHAR AS game_id, NULL::VARCHAR AS nba_game_id, e.game_id::BIGINT AS espn_game_id,
         l.contest_id AS ncaa_game_id, e.season, e.game_type, e.game_date,
         e.home_id AS home_team_id, e.away_id AS away_team_id,
         e.home_score::BIGINT AS home_score, e.away_score::BIGINT AS away_score,
         e.completed AS played, 'espn' AS source, e.neutral_site AS neutral,
         ${regulationPeriodsSql(league, 'e.season')} AS periods,
         CASE WHEN e.completed AND e.status_type_name <> 'STATUS_FORFEIT'
                AND e.status_period >= e.format_regulation_periods
              THEN (e.status_period - e.format_regulation_periods)::INTEGER END AS overtimes,
         CASE WHEN e.status_type_name = 'STATUS_FORFEIT' THEN
           CASE WHEN e.home_score > e.away_score THEN e.home_id ELSE e.away_id END
         END AS forfeit_winner_id,
         e.tournament_id,
         CASE WHEN e.tournament_id IS NOT NULL THEN nullif(regexp_replace(e.notes_headline, ' - .*$', ''), '') END
           AS event,
         e.conference_competition AS conference_game
  FROM college_espn e
  LEFT JOIN college_link l ON l.espn_game_id = e.game_id
  UNION ALL
  SELECT coalesce(f.espn_game_id::VARCHAR, 'ncaa:' || f.contest_id) AS game_id, NULL::VARCHAR AS nba_game_id,
         f.espn_game_id, f.contest_id, f.season, f.game_type, f.game_date, f.home_id, f.away_id,
         f.home_score::BIGINT, f.away_score::BIGINT, true AS played, 'ncaa' AS source,
         NULL::BOOLEAN AS neutral, ${regulationPeriodsSql(league, 'f.season')} AS periods,
         CASE WHEN f.minutes >= ${regulation} - 0.5
              THEN greatest(0, round((f.minutes - ${regulation}) / ${overtime}))::INTEGER END AS overtimes,
         NULL::INTEGER AS forfeit_winner_id, NULL::INTEGER AS tournament_id, NULL::VARCHAR AS event,
         NULL::BOOLEAN AS conference_game
  FROM filled f`
}

/** ESPN's athletes are the players' keys (D40): `player_ids` maps each to itself. */
const PLAYER_IDS = `CREATE OR REPLACE TABLE player_ids AS
  SELECT DISTINCT TRY_CAST(athlete_id AS BIGINT) AS espn_athlete_id,
         TRY_CAST(athlete_id AS BIGINT) AS player_id, 'espn' AS method
  FROM src_espn_player_box WHERE TRY_CAST(athlete_id AS BIGINT) IS NOT NULL`

/**
 * stats.ncaa.org's players mapped to ESPN's athletes, one row per player, team and season (its ids
 * last a season, D40). A player is its `player_id` within the season, or, on a line that has none
 * (about 7,000 a season), its printed name on that team. First hit wins:
 *
 * 1. the player crosswalk, by the season's id;
 * 2. the same box-score lines in the same games for the same team (points, rebounds, assists,
 *    attempts and fouls), with a clear winner and at least two lines that are not all zeros, as for
 *    the NBA's players (`identityShared.ts`);
 * 3. the same name on the same team in the same season, when only one player on either side has it.
 *
 * Whoever is left gets D28's key: the negative of their stats.ncaa.org id, which no ESPN id equals,
 * or for a line with no id, the negative of a number from the season, team and name above every
 * stats.ncaa.org id. Each miss stays in the table with its method, so the misses are counted.
 */
const ncaaPlayerIdsSql = (have: boolean, xwalkPlayer: boolean): string =>
  have
    ? `CREATE OR REPLACE TABLE ncaa_player_ids AS
  WITH lines AS (
    SELECT b.season, b.contest_id, l.espn_game_id, nullif(trim(b.player_id::VARCHAR), '') AS ncaa_player_id,
           b.player, nullif(trim(b.clean_name), '') AS clean_name,
           coalesce(TRY_CAST(b.team_espn_team_id AS INTEGER),
                    CASE WHEN b.team = b.home THEN n.home_id WHEN b.team = b.away THEN n.away_id END) AS team_id,
           b.team AS ncaa_team, b.pts, coalesce(b.orb, 0) + coalesce(b.drb, 0) AS reb, b.ast, b.fga, b.pf
    FROM src_ncaa_player_box b
    LEFT JOIN college_ncaa n USING (contest_id)
    LEFT JOIN college_link l USING (contest_id)
  ), keyed AS (
    SELECT *, coalesce('id:' || ncaa_player_id, 'name:' || coalesce(team_id::VARCHAR, ncaa_team) || ':' || player) AS who
    FROM lines
  ), players AS (
    SELECT season, who, any_value(ncaa_player_id) AS ncaa_player_id, arg_max(team_id, contest_id) AS team_id,
           arg_max(ncaa_team, contest_id) AS ncaa_team, any_value(player) AS player,
           coalesce(arg_max(clean_name, contest_id) FILTER (WHERE clean_name IS NOT NULL),
                    -- A line with no id prints the name alone, as \`MAXIMO.ORTEGA\`.
                    array_to_string(list_transform(
                      string_split(lower(trim(replace(any_value(player), '.', ' '))), ' '),
                      w -> upper(w[1]) || w[2:]), ' ')) AS name,
           count(*) AS lines
    FROM keyed GROUP BY 1, 2
  ), crosswalk AS (
    ${
      xwalkPlayer
        ? `SELECT season, ncaa_player_id,
                  arg_max(TRY_CAST(espn_athlete_id AS BIGINT), (coalesce(match_confidence, 0), -TRY_CAST(espn_athlete_id AS BIGINT))) AS espn_athlete_id
           FROM src_xwalk_player
           WHERE nullif(ncaa_player_id, '') IS NOT NULL AND TRY_CAST(espn_athlete_id AS BIGINT) IS NOT NULL
           GROUP BY 1, 2`
        : 'SELECT NULL::INTEGER AS season, NULL::VARCHAR AS ncaa_player_id, NULL::BIGINT AS espn_athlete_id WHERE false'
    }
  ), by_crosswalk AS (
    SELECT p.season, p.who, c.espn_athlete_id
    FROM players p JOIN crosswalk c ON c.season = p.season AND c.ncaa_player_id = p.ncaa_player_id
  ), open_lines AS (
    SELECT k.* FROM keyed k ANTI JOIN by_crosswalk c USING (season, who)
  ), same_lines AS (
    SELECT o.season, o.who, TRY_CAST(e.athlete_id AS BIGINT) AS espn_athlete_id, count(*) AS same
    FROM open_lines o
    JOIN src_espn_player_box e ON e.game_id = o.espn_game_id AND e.team_id = o.team_id
      AND e.points = o.pts AND e.rebounds = o.reb AND e.assists = o.ast
      AND e.field_goals_attempted = o.fga AND e.fouls = o.pf
    WHERE coalesce(o.pts, 0) + o.reb + coalesce(o.ast, 0) + coalesce(o.fga, 0) > 0
    GROUP BY 1, 2, 3
  ), ranked AS (
    SELECT *, row_number() OVER (PARTITION BY season, who ORDER BY same DESC, espn_athlete_id) AS place,
           lead(same) OVER (PARTITION BY season, who ORDER BY same DESC, espn_athlete_id) AS next_same
    FROM same_lines
  ), by_lines AS (
    SELECT season, who, espn_athlete_id FROM ranked
    WHERE place = 1 AND same >= 2 AND same > 2 * coalesce(next_same, 0)
  ), open_players AS (
    SELECT p.* FROM players p
    ANTI JOIN by_crosswalk c USING (season, who)
    ANTI JOIN by_lines b USING (season, who)
  ), ncaa_names AS (
    SELECT season, team_id, name_key(coalesce(name, replace(player, '.', ' '))) AS k, who FROM open_players
    WHERE team_id IS NOT NULL
  ), espn_names AS (
    SELECT DISTINCT season, team_id, name_key(athlete_display_name) AS k, TRY_CAST(athlete_id AS BIGINT) AS espn_athlete_id
    FROM src_espn_player_box WHERE athlete_id IS NOT NULL
  ), unique_espn AS (
    SELECT season, team_id, k, any_value(espn_athlete_id) AS espn_athlete_id FROM espn_names
    GROUP BY 1, 2, 3 HAVING count(DISTINCT espn_athlete_id) = 1
  ), by_name AS (
    SELECT n.season, n.who, u.espn_athlete_id
    FROM ncaa_names n JOIN unique_espn u USING (season, team_id, k)
    QUALIFY count(*) OVER (PARTITION BY n.season, n.team_id, n.k) = 1
  ), found AS (
    SELECT *, 'crosswalk' AS method FROM by_crosswalk
    UNION ALL SELECT *, 'box score' FROM by_lines
    UNION ALL SELECT *, 'name' FROM by_name
  )
  SELECT p.season, p.ncaa_player_id, p.team_id, p.ncaa_team, p.player, p.name,
         coalesce(f.espn_athlete_id,
                  -TRY_CAST(p.ncaa_player_id AS BIGINT),
                  -(1000000000000 + hash(p.season, p.who) % 1000000000000)::BIGINT) AS player_id,
         coalesce(f.method, 'ncaa only') AS method, p.lines
  FROM players p LEFT JOIN found f USING (season, who)`
    : `CREATE OR REPLACE TABLE ncaa_player_ids AS
  SELECT NULL::INTEGER AS season, NULL::VARCHAR AS ncaa_player_id, NULL::INTEGER AS team_id,
         NULL::VARCHAR AS ncaa_team, NULL::VARCHAR AS player, NULL::VARCHAR AS name,
         NULL::BIGINT AS player_id, NULL::VARCHAR AS method, NULL::BIGINT AS lines
  WHERE false`

/**
 * One row per person: every ESPN athlete with a box-score line, by ESPN's latest name, and every
 * stats.ncaa.org player matched to none, by its clean name. Position, height, weight and birth date
 * are ESPN's athlete file's latest with a value, else ESPN's rosters'; class, hometown and high school
 * are stats.ncaa.org's team rosters' latest, through `ncaa_player_ids`. Anything none holds is NULL.
 */
const playerSql = (
  core: boolean,
  rosters: boolean,
  ncaaRosters: boolean
): string => `CREATE OR REPLACE TABLE player AS
  WITH espn AS (
    SELECT TRY_CAST(athlete_id AS BIGINT) AS player_id,
           arg_max(athlete_display_name, game_date) FILTER (WHERE nullif(athlete_display_name, '') IS NOT NULL) AS name,
           min(season) AS first_season, max(season) AS last_season
    FROM src_espn_player_box WHERE TRY_CAST(athlete_id AS BIGINT) IS NOT NULL GROUP BY 1
  ), ncaa AS (
    SELECT player_id, arg_max(name, season) AS name, min(season) AS first_season, max(season) AS last_season,
           bool_and(method = 'ncaa only') AS ncaa_only
    FROM ncaa_player_ids GROUP BY 1
  ), core AS (
    ${
      core
        ? `SELECT TRY_CAST(athlete_id AS BIGINT) AS player_id,
                  arg_max(position_abbreviation, season) FILTER (WHERE nullif(trim(position_abbreviation), '') IS NOT NULL) AS position,
                  arg_max(display_height, season) FILTER (WHERE nullif(trim(display_height), '') IS NOT NULL) AS height,
                  arg_max(display_weight, season) FILTER (WHERE nullif(trim(display_weight), '') IS NOT NULL) AS weight,
                  arg_max(date_of_birth, season) FILTER (WHERE nullif(trim(date_of_birth), '') IS NOT NULL) AS birth_date
           FROM src_espn_player_core GROUP BY 1`
        : 'SELECT NULL::BIGINT AS player_id, NULL::VARCHAR AS position, NULL::VARCHAR AS height, NULL::VARCHAR AS weight, NULL::VARCHAR AS birth_date WHERE false'
    }
  ), roster AS (
    ${
      rosters
        ? `SELECT TRY_CAST(athlete_id AS BIGINT) AS player_id,
                  arg_max(position_abbreviation, season) FILTER (WHERE nullif(trim(position_abbreviation), '') IS NOT NULL) AS position,
                  arg_max(height, season) FILTER (WHERE nullif(trim(height), '') IS NOT NULL) AS height,
                  arg_max(weight, season) FILTER (WHERE nullif(trim(weight), '') IS NOT NULL) AS weight,
                  arg_max(date_of_birth, season) FILTER (WHERE nullif(trim(date_of_birth), '') IS NOT NULL) AS birth_date
           FROM src_espn_rosters GROUP BY 1`
        : 'SELECT NULL::BIGINT AS player_id, NULL::VARCHAR AS position, NULL::VARCHAR AS height, NULL::VARCHAR AS weight, NULL::VARCHAR AS birth_date WHERE false'
    }
  ), school AS (
    ${
      ncaaRosters
        ? `SELECT i.player_id,
                  arg_max(r.class, r.season) FILTER (WHERE nullif(trim(r.class), '') IS NOT NULL) AS class,
                  arg_max(r.hometown, r.season) FILTER (WHERE nullif(trim(r.hometown), '') IS NOT NULL) AS hometown,
                  arg_max(r.high_school, r.season) FILTER (WHERE nullif(trim(r.high_school), '') IS NOT NULL) AS high_school
           FROM ncaa_player_ids i
           JOIN src_ncaa_team_rosters r ON r.season = i.season AND r.player_id::VARCHAR = i.ncaa_player_id
           GROUP BY 1`
        : 'SELECT NULL::BIGINT AS player_id, NULL::VARCHAR AS class, NULL::VARCHAR AS hometown, NULL::VARCHAR AS high_school WHERE false'
    }
  ), people AS (
    SELECT player_id, name, first_season, last_season, 'espn' AS method FROM espn
    UNION ALL
    SELECT player_id, name, first_season, last_season, 'ncaa only' FROM ncaa
    WHERE ncaa_only AND player_id NOT IN (SELECT player_id FROM espn)
  )
  SELECT p.player_id, p.name, CASE WHEN p.method = 'espn' THEN p.player_id END AS espn_athlete_id,
         p.method, least(p.first_season, n.first_season) AS first_season,
         greatest(p.last_season, n.last_season) AS last_season,
         coalesce(c.position, r.position) AS position, coalesce(c.height, r.height) AS height,
         coalesce(c.weight, r.weight) AS weight, coalesce(c.birth_date, r.birth_date) AS birth_date,
         s.class, s.hometown, s.high_school
  FROM people p
  LEFT JOIN ncaa n ON n.player_id = p.player_id AND p.method = 'espn'
  LEFT JOIN core c ON c.player_id = p.player_id
  LEFT JOIN roster r ON r.player_id = p.player_id
  LEFT JOIN school s ON s.player_id = p.player_id`

export const COLLEGE_IDENTITY: IdentityRecipe = {
  version: VERSION,
  needs: NEEDS,
  async build(db: StatsDb, league: League) {
    const has = (tables: readonly string[]): Promise<boolean> => hasTables(db, tables)
    const xwalkTeams = await has(['src_xwalk_ncaa_teams'])
    await db.exec(espnGamesSql(league))
    await db.exec(ncaaGamesSql(await has(NCAA_GAMES), await has(['src_xwalk_game']), xwalkTeams))
    await db.exec(LINK)
    await db.exec(FILLED)
    await db.exec(teamSql(xwalkTeams, await has(['src_xwalk_team'])))
    await db.exec(gameSql(league))
    await db.exec(PLAYER_IDS)
    await db.exec(
      ncaaPlayerIdsSql(
        (await has(NCAA_LINES)) && (await has(NCAA_GAMES)),
        await has(['src_xwalk_player'])
      )
    )
    await db.exec(
      playerSql(
        await has(['src_espn_player_core']),
        await has(['src_espn_rosters']),
        await has(['src_ncaa_team_rosters'])
      )
    )
  }
}
