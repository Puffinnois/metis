import type { StatsDb } from './db'

/**
 * What every league's identity recipe shares (`identity.ts` holds the recipes). A recipe writes only
 * what differs between its league's sources; the matching of ESPN's players to the league's ids is
 * the same SQL for every league, over the league's own lines.
 */

/** Spellings of a name that compare equal: no accents, punctuation or suffixes. */
export const NAME_KEY = `CREATE OR REPLACE TEMP MACRO name_key(n) AS trim(regexp_replace(
  regexp_replace(strip_accents(lower(n)), '[^a-z ]', '', 'g'), ' (jr|sr|ii|iii|iv|v)$', ''))`

export async function hasTables(db: StatsDb, tables: readonly string[]): Promise<boolean> {
  const row = await db.get<{ n: number }>(
    `SELECT count(*) AS n FROM duckdb_tables()
     WHERE schema_name = 'main' AND table_name IN (${tables.map((t) => `'${t}'`).join(', ')})`
  )
  return row?.n === tables.length
}

/** Where a league's player ids come from, for `playerIdsSql`. */
export interface PlayerIdSources {
  /**
   * The crosswalk's pairs: a query with `espn_athlete_id BIGINT, player_id BIGINT`, one row per ESPN
   * id.
   */
  crosswalk: string
  /**
   * The league's player lines: a table or view with `game_id, season, person_id, points,
   * rebounds_total, assists, field_goals_attempted, fouls_personal`, keyed by the league's game id as
   * `game.nba_game_id` holds it.
   */
  lines: string
  /** The player's name on a line, as SQL over `lines`. */
  name: string
  /**
   * More of the league's names for the name step, beside its lines': a query with `player_id, season,
   * name` (the WNBA's rosters, which list players who never got a line).
   */
  moreNames?: string
}

/**
 * ESPN's athletes mapped to the league's ids, first hit wins:
 *
 * 1. the crosswalk, which matches on names and misses those spelled too differently (Yao Ming, Nene);
 * 2. the same box-score lines in the same games, whatever the names (Tyrone Bogues is Muggsy), with
 *    a clear winner and at least two lines that are not all zeros;
 * 3. the same name in the same season, when only one player has it.
 *
 * Whoever is left never played a game the league's data covers, so has no league id: they get the
 * negative of their ESPN id, which no league id can equal (D28).
 */
export const playerIdsSql = (s: PlayerIdSources): string => `CREATE OR REPLACE TABLE player_ids AS
  WITH crosswalk AS (
    ${s.crosswalk}
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
    JOIN ${s.lines} n ON n.game_id = g.nba_game_id
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
    SELECT DISTINCT person_id AS player_id, season, name_key(${s.name}) AS k
    FROM ${s.lines}${
      s.moreNames
        ? `
    UNION
    SELECT player_id, season, name_key(name) FROM (${s.moreNames})`
        : ''
    }
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
