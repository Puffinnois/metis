import type { StatsDb } from './db'

/** Bump when these tables change, so the next refresh builds them without downloading anything. */
export const IDENTITY_VERSION = 2

/**
 * What the identity tables read. They are all in the core tier, so the app can use them as soon as
 * that tier has loaded.
 */
const NEEDS = [
  'src_nba_schedule',
  'src_espn_schedule',
  'src_nba_player_box',
  'src_espn_player_box',
  'src_team_aliases',
  'src_team_groups',
  'src_xwalk_game',
  'src_xwalk_player'
]

/** Spellings of a name that compare equal: no accents, punctuation or suffixes. */
const NAME_KEY = `CREATE OR REPLACE TEMP MACRO name_key(n) AS trim(regexp_replace(
  regexp_replace(strip_accents(lower(n)), '[^a-z ]', '', 'g'), ' (jr|sr|ii|iii|iv|v)$', ''))`

/**
 * One row per team per season, on NBA team ids. `src_team_aliases` maps ESPN's ids to the NBA's. Its
 * first row for a team starts in 1996-97, when the NBA's data starts, and holds for the seasons
 * before it too: no team moved between 1993-94 and then. A season's code is the NBA's when it has
 * one, else the team's earliest, since ESPN spells some differently (`GS`, `NY`).
 */
const TEAM = `CREATE OR REPLACE TABLE team AS
  WITH alias AS (
    SELECT TRY_CAST(team_id AS INTEGER) AS espn_team_id, TRY_CAST(source_id AS BIGINT) AS team_id,
           valid_from, valid_to,
           valid_from = min(valid_from) OVER (PARTITION BY team_id) AS earliest
    FROM src_team_aliases WHERE source = 'nba_stats'
  ), codes AS (
    SELECT home_team_id AS team_id, season, any_value(home_team_abbreviation) AS code
    FROM src_nba_schedule WHERE home_team_id > 0 GROUP BY 1, 2
  ), first_code AS (
    SELECT team_id, arg_min(code, season) AS code FROM codes GROUP BY 1
  )
  SELECT g.season, a.team_id, a.espn_team_id,
         coalesce(c.code, f.code) AS code, g.team_name AS name,
         replace(g.conference_id, 'nba:', '') AS conference,
         replace(g.division_id, 'nba:', '') AS division
  FROM src_team_groups g
  JOIN alias a ON a.espn_team_id = TRY_CAST(g.team_id AS INTEGER)
    AND g.season <= a.valid_to AND (g.season >= a.valid_from OR a.earliest)
  LEFT JOIN codes c ON c.team_id = a.team_id AND c.season = g.season
  LEFT JOIN first_code f ON f.team_id = a.team_id
  WHERE g.season >= (SELECT min(season) FROM src_espn_schedule)`

/**
 * One row per game of the league, in the one set of types D12 names, with both sources' ids.
 *
 * From 1996-97 the NBA's schedule says what is a game: its id's prefix is the game's type, and its
 * regular seasons match their real lengths. ESPN's id comes from the crosswalk, then from the same
 * teams within a day, since the crosswalk starts in 2001-02 and misses a few after it. ESPN's rows are
 * read once per game, its own season file first: the 1998-99 games are in two files.
 *
 * Before 1996-97 only ESPN has games. Its season type is enough there, once games against touring
 * teams are told apart by a team that is not in the league. Rows it files as games but never played
 * (postponed ones have their own row) do not count, and ESPN rows the NBA's schedule has no game for
 * are left out from 1996-97.
 */
const GAME = `CREATE OR REPLACE TABLE game AS
  WITH espn AS (
    SELECT DISTINCT ON (game_id) game_id AS espn_game_id, season, season_type, game_date::DATE AS game_date,
           home_id, away_id, home_score, away_score
    FROM src_espn_schedule
    WHERE coalesce(status_type_completed, true)
    ORDER BY game_id, (season = file_season) DESC, file_season DESC
  ), espn_teams AS (
    SELECT e.*, h.team_id AS home_team_id, a.team_id AS away_team_id
    FROM espn e
    LEFT JOIN team h ON h.espn_team_id = e.home_id AND h.season = year(e.game_date) + (month(e.game_date) >= 8)::INTEGER
    LEFT JOIN team a ON a.espn_team_id = e.away_id AND a.season = h.season
  ), nba AS (
    SELECT game_id AS nba_game_id, season,
           CASE substr(game_id, 1, 3)
             WHEN '001' THEN 'preseason' WHEN '002' THEN 'regular' WHEN '003' THEN 'all-star'
             WHEN '004' THEN 'playoffs' WHEN '005' THEN 'play-in' WHEN '006' THEN 'cup-final'
           END AS game_type,
           TRY_CAST(game_date AS DATE) AS game_date,
           nullif(home_team_id, 0) AS home_team_id, nullif(away_team_id, 0) AS away_team_id,
           home_pts AS home_score, away_pts AS away_score
    FROM src_nba_schedule
  ), crosswalked AS (
    SELECT DISTINCT ON (nba_game_id) nba_game_id, TRY_CAST(espn_game_id AS BIGINT) AS espn_game_id
    FROM src_xwalk_game WHERE nba_game_id IS NOT NULL AND espn_game_id IS NOT NULL
    ORDER BY nba_game_id, match_confidence DESC NULLS LAST
  ), unlinked AS (
    SELECT n.* FROM nba n ANTI JOIN crosswalked c USING (nba_game_id)
  ), by_teams AS (
    SELECT DISTINCT ON (u.nba_game_id) u.nba_game_id, e.espn_game_id
    FROM unlinked u
    JOIN espn_teams e ON e.home_team_id = u.home_team_id AND e.away_team_id = u.away_team_id
      AND abs(date_diff('day', e.game_date, u.game_date)) <= 1
    WHERE e.espn_game_id NOT IN (SELECT espn_game_id FROM crosswalked)
    ORDER BY u.nba_game_id, abs(date_diff('day', e.game_date, u.game_date))
  ), link AS (
    SELECT * FROM crosswalked UNION ALL SELECT * FROM by_teams
  ), first_nba_season AS (
    SELECT min(season) AS season FROM src_nba_schedule
  )
  SELECT n.nba_game_id AS game_id, n.nba_game_id, l.espn_game_id, n.season, n.game_type, n.game_date,
         n.home_team_id, n.away_team_id, n.home_score, n.away_score,
         coalesce(n.home_score, 0) + coalesce(n.away_score, 0) > 0 AS played, 'nba' AS source
  FROM nba n LEFT JOIN link l USING (nba_game_id)
  UNION ALL
  SELECT 'espn:' || e.espn_game_id AS game_id, NULL AS nba_game_id, e.espn_game_id, e.season,
         CASE
           WHEN e.home_team_id IS NULL OR e.away_team_id IS NULL THEN 'preseason'
           WHEN e.season_type = 3 THEN 'playoffs'
           ELSE 'regular'
         END AS game_type,
         e.game_date, e.home_team_id, e.away_team_id, e.home_score, e.away_score,
         coalesce(e.home_score, 0) + coalesce(e.away_score, 0) > 0 AS played, 'espn' AS source
  FROM espn_teams e
  WHERE e.season < (SELECT season FROM first_nba_season)`

/**
 * ESPN's athletes mapped to NBA ids, first hit wins:
 *
 * 1. the crosswalk, which matches on names and misses those spelled too differently (Yao Ming, Nene);
 * 2. the same box-score lines in the same games, whatever the names (Tyrone Bogues is Muggsy), with
 *    a clear winner and at least two lines that are not all zeros;
 * 3. the same name in the same season, when only one player has it.
 *
 * Whoever is left never played a game the NBA's data covers, so has no NBA id: they get the negative
 * of their ESPN id, which no NBA id can equal.
 */
const PLAYER_IDS = `CREATE OR REPLACE TABLE player_ids AS
  WITH crosswalk AS (
    SELECT DISTINCT TRY_CAST(espn_athlete_id AS BIGINT) AS espn_athlete_id,
           TRY_CAST(nba_player_id AS BIGINT) AS player_id
    FROM src_xwalk_player WHERE nba_player_id IS NOT NULL AND espn_athlete_id IS NOT NULL
  ), espn_players AS (
    SELECT athlete_id AS espn_athlete_id, any_value(athlete_display_name) AS name
    FROM src_espn_player_box WHERE athlete_id IS NOT NULL GROUP BY 1
  ), open_players AS (
    SELECT p.* FROM espn_players p ANTI JOIN crosswalk c USING (espn_athlete_id)
  ), lines AS (
    SELECT e.athlete_id AS espn_athlete_id, n.person_id AS player_id, count(*) AS same
    FROM src_espn_player_box e
    JOIN open_players o ON o.espn_athlete_id = e.athlete_id
    JOIN game g ON g.espn_game_id = e.game_id AND g.nba_game_id IS NOT NULL
    JOIN src_nba_player_box n ON n.game_id = g.nba_game_id
      AND n.points = e.points AND n.rebounds_total = e.rebounds AND n.assists = e.assists
      AND n.field_goals_attempted = e.field_goals_attempted AND n.fouls_personal = e.fouls
    WHERE e.season = e.file_season
      AND coalesce(e.points, 0) + coalesce(e.rebounds, 0) + coalesce(e.assists, 0)
        + coalesce(e.field_goals_attempted, 0) > 0
    GROUP BY 1, 2
  ), ranked AS (
    SELECT *, row_number() OVER (PARTITION BY espn_athlete_id ORDER BY same DESC) AS place,
           lead(same) OVER (PARTITION BY espn_athlete_id ORDER BY same DESC) AS next_same
    FROM lines
  ), by_lines AS (
    SELECT espn_athlete_id, player_id FROM ranked
    WHERE place = 1 AND same >= 2 AND same > 2 * coalesce(next_same, 0)
  ), after_lines AS (
    SELECT o.* FROM open_players o ANTI JOIN by_lines b USING (espn_athlete_id)
  ), espn_names AS (
    SELECT DISTINCT athlete_id AS espn_athlete_id, season, name_key(athlete_display_name) AS k
    FROM src_espn_player_box
    WHERE athlete_id IN (SELECT espn_athlete_id FROM after_lines) AND season = file_season
  ), nba_names AS (
    SELECT DISTINCT person_id AS player_id, season, name_key(first_name || ' ' || family_name) AS k
    FROM src_nba_player_box
  ), unique_names AS (
    SELECT season, k, any_value(player_id) AS player_id FROM nba_names
    GROUP BY 1, 2 HAVING count(*) = 1
  ), by_name AS (
    SELECT e.espn_athlete_id, any_value(u.player_id) AS player_id
    FROM espn_names e JOIN unique_names u USING (season, k)
    GROUP BY 1 HAVING count(DISTINCT u.player_id) = 1
  )
  SELECT espn_athlete_id, player_id, 'crosswalk' AS method FROM crosswalk
  UNION ALL SELECT espn_athlete_id, player_id, 'box score' FROM by_lines
  UNION ALL SELECT espn_athlete_id, player_id, 'name' FROM by_name
  UNION ALL
  SELECT a.espn_athlete_id, -a.espn_athlete_id, 'espn only'
  FROM after_lines a ANTI JOIN by_name b USING (espn_athlete_id)`

/**
 * One row per person. The name is the NBA's latest spelling, else ESPN's. A player the NBA's data has
 * and ESPN's does not has no ESPN id; ESPN keeps two ids for a few players, of which this holds one.
 */
const PLAYER = `CREATE OR REPLACE TABLE player AS
  WITH nba AS (
    SELECT person_id AS player_id, arg_max(first_name || ' ' || family_name, season) AS name,
           min(season) AS first_season, max(season) AS last_season
    FROM src_nba_player_box WHERE person_id IS NOT NULL GROUP BY 1
  ), espn AS (
    SELECT i.player_id, min(i.espn_athlete_id) AS espn_athlete_id, any_value(i.method) AS method,
           arg_max(b.athlete_display_name, b.season) AS name,
           min(b.season) AS first_season, max(b.season) AS last_season
    FROM player_ids i LEFT JOIN src_espn_player_box b ON b.athlete_id = i.espn_athlete_id
    GROUP BY 1
  )
  SELECT coalesce(n.player_id, e.player_id) AS player_id, coalesce(n.name, e.name) AS name,
         e.espn_athlete_id, coalesce(e.method, 'nba only') AS method,
         least(n.first_season, e.first_season) AS first_season,
         greatest(n.last_season, e.last_season) AS last_season
  FROM nba n FULL JOIN espn e USING (player_id)`

async function hasTables(db: StatsDb, tables: string[]): Promise<boolean> {
  const row = await db.get<{ n: number }>(
    `SELECT count(*) AS n FROM duckdb_tables()
     WHERE schema_name = 'main' AND table_name IN (${tables.map((t) => `'${t}'`).join(', ')})`
  )
  return row?.n === tables.length
}

export const canBuildIdentity = (db: StatsDb): Promise<boolean> => hasTables(db, NEEDS)

export async function identityStale(db: StatsDb): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'identity'"
  )
  return (row?.version ?? 0) < IDENTITY_VERSION
}

/** Marks the tables out of date, so a build the app never got to still happens on the next refresh. */
export async function markIdentityStale(db: StatsDb): Promise<void> {
  await db.exec("INSERT OR REPLACE INTO derived_state VALUES ('identity', 0)")
}

/** Rebuilds the tables; each replaces the old one in its own statement. Returns how many games. */
export async function buildIdentity(db: StatsDb): Promise<number> {
  await db.exec(NAME_KEY)
  await db.exec(TEAM)
  await db.exec(GAME)
  await db.exec(PLAYER_IDS)
  await db.exec(PLAYER)
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', [
    'identity',
    IDENTITY_VERSION
  ])
  const games = await db.get<{ n: number }>('SELECT count(*) AS n FROM game')
  return games?.n ?? 0
}
