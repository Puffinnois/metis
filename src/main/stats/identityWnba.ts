import { regulationPeriodsSql, type League } from '@shared/leagues'
import type { StatsDb } from './db'
import type { IdentityRecipe } from './identity'
import { hasTables, playerIdsSql } from './identityShared'

/**
 * The WNBA's identity recipe: the same `game`, `team`, `player_ids` and `player` tables as the NBA's,
 * built from the WNBA's own files. What differs from the NBA's sources, each measured in
 * `docs/reference/wnba-data-sources.md` ("Traps"):
 *
 * - the league's schedule lacks one game in 2007 and one in 2009, which its game logs hold, so the
 *   games are the schedule's and the game logs' together;
 * - the All-Star Game and the Commissioner's Cup final are in ESPN's schedule only, filed as regular
 *   season, and the crosswalk links neither;
 * - the 2018 forfeit is a 0-0 row with no box score that counts in the standings;
 * - the league keeps one team id across a move, and gives the 2026 Portland Fire the id of the
 *   2000-2002 club;
 * - the game logs hold the players of 1997 to 2001, when ESPN has no box score and there is no
 *   crosswalk, and the 2026 player lines are in the 2026 box scores.
 *
 * The column `nba_game_id` holds the league's own game id (`1022600001`): the name is the NBA's, kept
 * so the builders after this read the WNBA's tables unchanged. Beyond the NBA's columns, `game` says
 * whether a game was at a neutral site, how many periods its regulation had and how many overtimes
 * were played, and which side won a forfeit; `player` carries the roster's position, height, weight,
 * birth date and school.
 */

/** Bump when these tables change, so the next refresh builds them with nothing downloaded. */
const VERSION = 1

const NEEDS = [
  'src_wnba_schedule',
  'src_wnba_game_logs',
  'src_espn_schedule',
  'src_espn_player_box',
  'src_team_aliases',
  'src_team_groups',
  'src_xwalk_game',
  'src_xwalk_player'
]

/**
 * The 2021 Commissioner's Cup final, Seattle against Connecticut in Phoenix: ESPN files it under the
 * Cup's group-game headline, so only its date tells it apart. From 2022 ESPN's headline names the final.
 */
export const CUP_FINAL_DATES = ['2021-08-12']

/** ESPN's headline for the Cup final from 2022. */
const CUP_FINAL_HEADLINE = "WNBA Commissioner's Cup Championship"

/**
 * One row per team per season, on the league's team ids, from the teams its schedule and game logs
 * list that season: the code and name the league's schedule gives that season (its latest, should one
 * change), ESPN's id from the alias table, and the conference from the groups table. The WNBA has no
 * divisions: the column is NULL.
 *
 * A team id that comes back after seasons with no games is a new club, as the 2026 Portland Fire are
 * after the 2000-2002 one (D28's way: one key per club, no collision): the later club's rows take the
 * negative of the id, which no league id equals. A source row reaches it as `abs(team_id)` in its
 * season.
 */
const TEAM = `CREATE OR REPLACE TABLE team AS
  WITH listed AS (
    SELECT season, home_team_id AS team_id, home_team_abbreviation AS code, home_team_name AS name,
           game_date
    FROM src_wnba_schedule
    UNION ALL
    SELECT season, away_team_id, away_team_abbreviation, away_team_name, game_date
    FROM src_wnba_schedule
  ), logged AS (
    SELECT l.season, l.team_id, l.team_abbreviation AS code, l.team_name AS name, l.game_date
    FROM src_wnba_game_logs l
    WHERE NOT EXISTS (SELECT 1 FROM listed s WHERE s.season = l.season AND s.team_id = l.team_id)
  ), seasons AS (
    SELECT season, team_id, arg_max(code, game_date) AS code, arg_max(name, game_date) AS name
    FROM (SELECT * FROM listed UNION ALL SELECT * FROM logged)
    WHERE team_id > 0
    GROUP BY 1, 2
  ), runs AS (
    SELECT *, season - dense_rank() OVER (PARTITION BY team_id ORDER BY season) AS run FROM seasons
  ), clubs AS (
    SELECT *, dense_rank() OVER (PARTITION BY team_id ORDER BY run) AS club FROM runs
  ), alias AS (
    SELECT TRY_CAST(team_id AS INTEGER) AS espn_team_id, TRY_CAST(source_id AS BIGINT) AS team_id,
           valid_from, valid_to
    FROM src_team_aliases WHERE source = 'wnba_stats'
  ), espn AS (
    SELECT c.season, c.team_id, min(a.espn_team_id) AS espn_team_id
    FROM clubs c JOIN alias a ON a.team_id = c.team_id AND c.season BETWEEN a.valid_from AND a.valid_to
    GROUP BY 1, 2
  ), groups AS (
    SELECT season, TRY_CAST(team_id AS INTEGER) AS espn_team_id,
           any_value(nullif(replace(conference_id, 'wnba:', ''), '')) AS conference,
           any_value(nullif(replace(division_id, 'wnba:', ''), '')) AS division
    FROM src_team_groups GROUP BY 1, 2
  )
  SELECT c.season, CASE WHEN c.club = 1 THEN c.team_id ELSE -c.team_id END AS team_id,
         e.espn_team_id, c.code, c.name, g.conference, g.division
  FROM clubs c
  LEFT JOIN espn e USING (season, team_id)
  LEFT JOIN groups g ON g.season = c.season AND g.espn_team_id = e.espn_team_id`

/**
 * One row per game of the league, in D12's one set of types, with both sources' ids.
 *
 * The league's schedule says what is a game, with the two games it lacks taken from the game logs'
 * team rows (the side whose matchup reads `vs.` is at home). Its id's third digit is the game's type,
 * as in the NBA's ids: `2` regular season, `4` playoffs, and nothing else is published. ESPN's id
 * comes from the crosswalk, then from the same teams within a day (the crosswalk starts in 2002 and
 * misses 7 games of 2002-2004), each ESPN row linked once. ESPN's postponed and cancelled rows link to
 * nothing.
 *
 * Two kinds of game are ESPN's only, both filed as regular season and linked to no league game: the
 * All-Star Game, whose two sides are not league teams that season (`EAST`, `Team WNBA`, `Team USA`),
 * and the Commissioner's Cup final, by its headline from 2022 and its date in 2021. A Cup final has
 * league teams; an All-Star Game has none, so its team ids are NULL. ESPN rows of a single league
 * team against a team it does not list are copies (2002's Portland rows under ESPN id 12), not games.
 *
 * A 0-0 row that ESPN marks a forfeit is played: it counts in the standings with no box score, and
 * `forfeit_winner_id` names the side ESPN's standings give the win (the one with a win more than its
 * scored games). Overtimes come from the game logs' team minutes (200 in regulation, 25 more for each
 * overtime), and from ESPN's last period for a game the game logs do not have.
 */
const gameSql = (league: League, standings: boolean): string => {
  const regulation = league.gameMinutes * 5
  const overtime = league.overtimeMinutes * 5
  const cupDates = CUP_FINAL_DATES.map((d) => `DATE '${d}'`).join(', ')
  return `CREATE OR REPLACE TABLE game AS
  WITH listed AS (
    SELECT game_id, season, TRY_CAST(game_date AS DATE) AS game_date, home_team_id, away_team_id,
           home_pts AS home_score, away_pts AS away_score, 'wnba' AS source
    FROM src_wnba_schedule
  ), logged AS (
    SELECT game_id, any_value(season) AS season, TRY_CAST(any_value(game_date) AS DATE) AS game_date,
           any_value(team_id) FILTER (WHERE matchup LIKE '% vs. %') AS home_team_id,
           any_value(team_id) FILTER (WHERE matchup LIKE '% @ %') AS away_team_id,
           coalesce(any_value(pts) FILTER (WHERE player_id IS NULL AND matchup LIKE '% vs. %'),
                    sum(pts) FILTER (WHERE player_id IS NOT NULL AND matchup LIKE '% vs. %'))::BIGINT
             AS home_score,
           coalesce(any_value(pts) FILTER (WHERE player_id IS NULL AND matchup LIKE '% @ %'),
                    sum(pts) FILTER (WHERE player_id IS NOT NULL AND matchup LIKE '% @ %'))::BIGINT
             AS away_score,
           'game logs' AS source
    FROM src_wnba_game_logs
    WHERE game_id NOT IN (SELECT game_id FROM src_wnba_schedule)
    GROUP BY 1
  ), league_games AS (
    SELECT l.*, h.team_id AS home_key, a.team_id AS away_key
    FROM (SELECT * FROM listed UNION ALL SELECT * FROM logged) l
    LEFT JOIN team h ON abs(h.team_id) = l.home_team_id AND h.season = l.season
    LEFT JOIN team a ON abs(a.team_id) = l.away_team_id AND a.season = l.season
  ), team_minutes AS (
    SELECT game_id, max(min) AS minutes FROM src_wnba_game_logs WHERE player_id IS NULL GROUP BY 1
  ), espn AS (
    SELECT DISTINCT ON (game_id) game_id AS espn_game_id, year(game_date::DATE) AS season,
           game_date::DATE AS game_date, home_id, away_id, home_score, away_score, neutral_site,
           notes_headline, status_type_name, status_period, format_regulation_periods
    FROM src_espn_schedule
    WHERE coalesce(status_type_name, '') NOT IN ('STATUS_POSTPONED', 'STATUS_CANCELED')
    ORDER BY game_id, (season = file_season) DESC, file_season DESC
  ), espn_teams AS (
    SELECT e.*, h.team_id AS home_key, a.team_id AS away_key
    FROM espn e
    LEFT JOIN team h ON h.espn_team_id = e.home_id AND h.season = e.season
    LEFT JOIN team a ON a.espn_team_id = e.away_id AND a.season = e.season
  ), crosswalked AS (
    SELECT DISTINCT ON (wnba_game_id) wnba_game_id AS game_id,
           TRY_CAST(espn_game_id AS BIGINT) AS espn_game_id
    FROM src_xwalk_game
    WHERE nullif(wnba_game_id, '') IS NOT NULL AND nullif(espn_game_id, '') IS NOT NULL
    ORDER BY wnba_game_id, match_confidence DESC NULLS LAST, TRY_CAST(espn_game_id AS BIGINT)
  ), by_teams AS (
    SELECT u.game_id, e.espn_game_id
    FROM league_games u
    JOIN espn_teams e ON e.home_key = u.home_key AND e.away_key = u.away_key
      AND abs(date_diff('day', e.game_date, u.game_date)) <= 1
    WHERE u.game_id NOT IN (SELECT game_id FROM crosswalked)
      AND e.espn_game_id NOT IN (SELECT espn_game_id FROM crosswalked)
    QUALIFY row_number() OVER (PARTITION BY u.game_id
              ORDER BY abs(date_diff('day', e.game_date, u.game_date)),
                       coalesce(e.home_score, 0) + coalesce(e.away_score, 0) > 0 DESC,
                       e.espn_game_id) = 1
      AND row_number() OVER (PARTITION BY e.espn_game_id
              ORDER BY abs(date_diff('day', e.game_date, u.game_date)), u.game_id) = 1
  ), link AS (
    SELECT * FROM crosswalked UNION ALL SELECT * FROM by_teams
  ), espn_only AS (
    SELECT e.*,
           CASE
             WHEN e.home_key IS NULL AND e.away_key IS NULL THEN 'all-star'
             WHEN e.home_key IS NOT NULL AND e.away_key IS NOT NULL
               AND (coalesce(e.notes_headline, '') = '${CUP_FINAL_HEADLINE.replace(/'/g, "''")}'
                    OR e.game_date IN (${cupDates})) THEN 'cup-final'
           END AS game_type
    FROM espn_teams e
    WHERE e.espn_game_id NOT IN (SELECT espn_game_id FROM link)
      AND coalesce(e.home_score, 0) + coalesce(e.away_score, 0) > 0
  ), standing_wins AS (
    ${
      standings
        ? `SELECT season, team_id AS espn_team_id, max(value) AS wins
           FROM src_espn_standings WHERE stat_name = 'wins' GROUP BY 1, 2`
        : 'SELECT NULL::INTEGER AS season, NULL::INTEGER AS espn_team_id, NULL::DOUBLE AS wins'
    }
  ), scored_wins AS (
    SELECT season, team_id, count(*) AS wins FROM (
      SELECT season, home_key AS team_id FROM league_games
      WHERE substr(game_id, 3, 1) = '2' AND home_score > away_score
      UNION ALL
      SELECT season, away_key FROM league_games
      WHERE substr(game_id, 3, 1) = '2' AND away_score > home_score
    ) GROUP BY 1, 2
  ), surplus AS (
    SELECT t.season, t.team_id, s.wins - coalesce(w.wins, 0) AS extra
    FROM team t
    JOIN standing_wins s ON s.season = t.season AND s.espn_team_id = t.espn_team_id
    LEFT JOIN scored_wins w ON w.season = t.season AND w.team_id = t.team_id
  ), league_rows AS (
    SELECT g.game_id, g.game_id AS nba_game_id, l.espn_game_id, g.season,
           CASE substr(g.game_id, 3, 1)
             WHEN '1' THEN 'preseason' WHEN '2' THEN 'regular' WHEN '3' THEN 'all-star'
             WHEN '4' THEN 'playoffs' WHEN '5' THEN 'play-in' WHEN '6' THEN 'cup-final'
           END AS game_type,
           g.game_date, g.home_key AS home_team_id, g.away_key AS away_team_id,
           g.home_score, g.away_score,
           coalesce(coalesce(g.home_score, 0) + coalesce(g.away_score, 0) = 0
             AND e.status_type_name = 'STATUS_FORFEIT', false) AS forfeit,
           g.source, e.neutral_site AS neutral,
           CASE WHEN m.minutes IS NOT NULL THEN round((m.minutes - ${regulation}) / ${overtime})::INTEGER
                WHEN e.status_period >= e.format_regulation_periods
                THEN (e.status_period - e.format_regulation_periods)::INTEGER END AS overtimes
    FROM league_games g
    LEFT JOIN link l USING (game_id)
    LEFT JOIN espn e ON e.espn_game_id = l.espn_game_id
    LEFT JOIN team_minutes m USING (game_id)
  )
  SELECT r.game_id, r.nba_game_id, r.espn_game_id, r.season, r.game_type, r.game_date,
         r.home_team_id, r.away_team_id, r.home_score, r.away_score,
         coalesce(r.home_score, 0) + coalesce(r.away_score, 0) > 0 OR r.forfeit AS played, r.source,
         r.neutral, ${regulationPeriodsSql(league, 'r.season')} AS periods,
         CASE WHEN NOT r.forfeit THEN r.overtimes END AS overtimes,
         CASE WHEN r.forfeit THEN (
           SELECT s.team_id FROM surplus s
           WHERE s.season = r.season AND s.team_id IN (r.home_team_id, r.away_team_id) AND s.extra > 0
           ORDER BY s.extra DESC, s.team_id LIMIT 1
         ) END AS forfeit_winner_id
  FROM league_rows r
  UNION ALL
  SELECT 'espn:' || o.espn_game_id AS game_id, NULL AS nba_game_id, o.espn_game_id, o.season,
         o.game_type, o.game_date, o.home_key, o.away_key, o.home_score, o.away_score,
         true AS played, 'espn' AS source, o.neutral_site,
         ${regulationPeriodsSql(league, 'o.season')} AS periods,
         CASE WHEN o.status_period >= o.format_regulation_periods
              THEN (o.status_period - o.format_regulation_periods)::INTEGER END AS overtimes,
         NULL::BIGINT AS forfeit_winner_id
  FROM espn_only o
  WHERE o.game_type IS NOT NULL`
}

/**
 * The league's player lines, as the shared player matching reads them: the game logs' player rows
 * (every season to 2025, 202 of 2026's games), and the 2026 box scores' rows for the lines the game
 * logs lack, listed whether or not the player played, as the NBA's box scores list them. The game logs
 * print the whole name; the box scores split it.
 */
const linesSql = (box: boolean): string => `CREATE OR REPLACE TEMP VIEW wnba_lines AS
  SELECT game_id, season, player_id AS person_id, player_name AS name, pts AS points,
         reb AS rebounds_total, ast AS assists, fga AS field_goals_attempted, pf AS fouls_personal
  FROM src_wnba_game_logs WHERE player_id IS NOT NULL
  ${
    box
      ? `UNION ALL
  SELECT b.game_id, b.season, b.person_id,
         concat_ws(' ', nullif(trim(b.first_name), ''), nullif(trim(b.family_name), '')) AS name,
         b.points, b.rebounds_total, b.assists, b.field_goals_attempted, b.fouls_personal
  FROM src_wnba_player_box b
  WHERE b.person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM src_wnba_game_logs l WHERE l.game_id = b.game_id AND l.player_id = b.person_id)`
      : ''
  }`

/**
 * ESPN's athletes mapped to the league's ids. The crosswalk matches by name and has one ESPN id on
 * two league ids once (Angel Robinson, 202270 in 2014 and 202657 in 2017-18, both ESPN's 1001): an
 * ESPN id takes the league id the crosswalk gives it in the most seasons, then the latest. The name
 * step also reads the league's rosters, which list players who dressed and never got a line.
 */
const CROSSWALK = `SELECT espn_athlete_id, player_id FROM (
      SELECT TRY_CAST(espn_athlete_id AS BIGINT) AS espn_athlete_id,
             TRY_CAST(wnba_player_id AS BIGINT) AS player_id,
             count(DISTINCT season) AS seasons, max(season) AS last
      FROM src_xwalk_player
      WHERE nullif(wnba_player_id, '') IS NOT NULL AND nullif(espn_athlete_id, '') IS NOT NULL
      GROUP BY 1, 2
    )
    WHERE espn_athlete_id IS NOT NULL AND player_id IS NOT NULL
    QUALIFY row_number() OVER (PARTITION BY espn_athlete_id
                               ORDER BY seasons DESC, last DESC, player_id) = 1`

const playerIdsWnba = (rosters: boolean): string =>
  playerIdsSql({
    crosswalk: CROSSWALK,
    lines: 'wnba_lines',
    name: 'name',
    moreNames: rosters
      ? 'SELECT player_id, season, player AS name FROM src_wnba_rosters WHERE player_id IS NOT NULL'
      : undefined
  })

/**
 * One row per person. The name is the league's latest spelling, as published (accents kept), else
 * ESPN's; the game logs print a name whole, so the NBA's roster correction is not needed. Position,
 * height, weight, birth date and school are the league's roster's latest with a value; the position
 * falls back to ESPN's athlete file, and anything neither holds is NULL.
 */
const playerSql = (rosters: boolean, core: boolean): string => `CREATE OR REPLACE TABLE player AS
  WITH league AS (
    SELECT person_id AS player_id, arg_max(name, season::VARCHAR || game_id) AS name,
           min(season) AS first_season, max(season) AS last_season
    FROM wnba_lines WHERE name IS NOT NULL AND name <> '' GROUP BY 1
  ), espn AS (
    SELECT i.player_id, min(i.espn_athlete_id) AS espn_athlete_id, any_value(i.method) AS method,
           arg_max(b.athlete_display_name, b.season) AS name,
           min(b.season) AS first_season, max(b.season) AS last_season
    FROM player_ids i LEFT JOIN src_espn_player_box b ON b.athlete_id = i.espn_athlete_id
    GROUP BY 1
  ), roster AS (
    ${
      rosters
        ? `SELECT player_id,
                  arg_max(position, season) FILTER (WHERE nullif(trim(position), '') IS NOT NULL) AS position,
                  arg_max(height, season) FILTER (WHERE nullif(trim(height), '') IS NOT NULL) AS height,
                  arg_max(weight, season) FILTER (WHERE nullif(trim(weight), '') IS NOT NULL) AS weight,
                  arg_max(birth_date, season) FILTER (WHERE nullif(trim(birth_date), '') IS NOT NULL) AS birth_date,
                  arg_max(school, season) FILTER (WHERE nullif(trim(school), '') IS NOT NULL) AS school
           FROM src_wnba_rosters WHERE player_id IS NOT NULL GROUP BY 1`
        : `SELECT NULL::BIGINT AS player_id, NULL::VARCHAR AS position, NULL::VARCHAR AS height,
                  NULL::VARCHAR AS weight, NULL::VARCHAR AS birth_date, NULL::VARCHAR AS school`
    }
  ), core AS (
    ${
      core
        ? `SELECT athlete_id AS espn_athlete_id,
                  arg_max(position_abbreviation, season)
                    FILTER (WHERE nullif(trim(position_abbreviation), '') IS NOT NULL) AS position
           FROM src_espn_player_core GROUP BY 1`
        : 'SELECT NULL::BIGINT AS espn_athlete_id, NULL::VARCHAR AS position'
    }
  )
  SELECT coalesce(n.player_id, e.player_id) AS player_id, coalesce(n.name, e.name) AS name,
         e.espn_athlete_id, coalesce(e.method, 'wnba only') AS method,
         least(n.first_season, e.first_season) AS first_season,
         greatest(n.last_season, e.last_season) AS last_season,
         coalesce(r.position, c.position) AS position, r.height, r.weight, r.birth_date, r.school
  FROM league n FULL JOIN espn e USING (player_id)
  LEFT JOIN roster r ON r.player_id = coalesce(n.player_id, e.player_id)
  LEFT JOIN core c ON c.espn_athlete_id = e.espn_athlete_id`

export const WNBA_IDENTITY: IdentityRecipe = {
  version: VERSION,
  needs: NEEDS,
  async build(db: StatsDb, league: League) {
    await db.exec(TEAM)
    await db.exec(gameSql(league, await hasTables(db, ['src_espn_standings'])))
    await db.exec(linesSql(await hasTables(db, ['src_wnba_player_box'])))
    const rosters = await hasTables(db, ['src_wnba_rosters'])
    await db.exec(playerIdsWnba(rosters))
    await db.exec(playerSql(rosters, await hasTables(db, ['src_espn_player_core'])))
  }
}
