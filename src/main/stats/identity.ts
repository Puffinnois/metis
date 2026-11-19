import {
  DEFAULT_LEAGUE,
  type IdentityRecipeName,
  type League,
  leagueOf,
  recipeOf
} from '@shared/leagues'
import type { StatsDb } from './db'
import { hasTables, NAME_KEY, playerIdsSql } from './identityShared'
import { COLLEGE_IDENTITY } from './identityCollege'
import { WNBA_IDENTITY } from './identityWnba'

/**
 * The game, team and player tables, built per league by the recipe its registry entry names
 * (`League.identity`). Every recipe writes the same tables with the same columns and meaning, so the
 * builders, the engine and the screens after it read them unchanged; what a recipe shares with the
 * others is in `identityShared.ts`. `docs/reference/stats-database.md`, "Identity" and "Leagues".
 */
export interface IdentityRecipe {
  /** Bump when the recipe's tables change, so the next refresh builds them with nothing downloaded. */
  version: number
  /**
   * The source tables it cannot build without. All in the core tier, so the app can use the tables
   * as soon as that tier has loaded. Their releases can never be left out of a build (`leftOut.ts`).
   */
  needs: readonly string[]
  /** Builds `team`, `game`, `player_ids` and `player`, each replacing the old one in one statement. */
  build(db: StatsDb, league: League): Promise<void>
}

/** The NBA recipe's version; each recipe keeps its own, so changing one never rebuilds another. */
export const IDENTITY_VERSION = 5

/** What the NBA's identity tables read. */
const NBA_NEEDS = [
  'src_nba_schedule',
  'src_espn_schedule',
  'src_nba_player_box',
  'src_espn_player_box',
  'src_team_aliases',
  'src_team_groups',
  'src_xwalk_game',
  'src_xwalk_player'
]

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
 * read once per game, its own season file first: the 1998-99 games are in two files. Where two ESPN
 * rows fit one game, the one with a score wins, then the lower id, so every build links the same:
 * ESPN's schedule lists 46 games of 1998-99 and 74 of 1999-00 twice, the second an empty row (0-0,
 * no box score) under a 4002… id.
 *
 * Before 1996-97 only ESPN has games. Its season type is enough there, once games against touring
 * teams are told apart by a team that is not in the league. Rows it files as games but never played
 * (postponed ones have their own row) do not count, and ESPN rows the NBA's schedule has no game for
 * are left out from 1996-97.
 *
 * ESPN's schedule also lists some games twice: the game with its box score, and a copy on the same day
 * with the same score and one side the same, no box score, and the other side swapped for the team
 * whose ESPN number ends the copy's id. 1995's Finals Game 3, Houston 106 Orlando 103, has a copy
 * `150611014` with Miami at home (14 is Miami), which put Miami in the Finals. A copy is left out:
 * a row with no box score when a row that has one matches it. It matters before 1996-97 only, where
 * ESPN's rows are the games; 8 copies in all to 2001-02 (`nba-data-sources.md`, the traps).
 */
const GAME = `CREATE OR REPLACE TABLE game AS
  WITH espn AS (
    SELECT DISTINCT ON (game_id) game_id AS espn_game_id, season, season_type, game_date::DATE AS game_date,
           home_id, away_id, home_score, away_score
    FROM src_espn_schedule
    WHERE coalesce(status_type_completed, true)
    ORDER BY game_id, (season = file_season) DESC, file_season DESC
  ), espn_box AS (
    SELECT DISTINCT game_id FROM src_espn_player_box
  ), espn_copies AS (
    SELECT b.espn_game_id
    FROM espn a JOIN espn b ON a.game_date = b.game_date AND a.espn_game_id <> b.espn_game_id
      AND a.home_score = b.home_score AND a.away_score = b.away_score
      AND (a.home_id IN (b.home_id, b.away_id) OR a.away_id IN (b.home_id, b.away_id))
    WHERE a.espn_game_id IN (SELECT game_id FROM espn_box)
      AND b.espn_game_id NOT IN (SELECT game_id FROM espn_box)
      AND coalesce(b.home_score, 0) + coalesce(b.away_score, 0) > 0
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
    ORDER BY nba_game_id, match_confidence DESC NULLS LAST, TRY_CAST(espn_game_id AS BIGINT)
  ), unlinked AS (
    SELECT n.* FROM nba n ANTI JOIN crosswalked c USING (nba_game_id)
  ), by_teams AS (
    SELECT DISTINCT ON (u.nba_game_id) u.nba_game_id, e.espn_game_id
    FROM unlinked u
    JOIN espn_teams e ON e.home_team_id = u.home_team_id AND e.away_team_id = u.away_team_id
      AND abs(date_diff('day', e.game_date, u.game_date)) <= 1
    WHERE e.espn_game_id NOT IN (SELECT espn_game_id FROM crosswalked)
    ORDER BY u.nba_game_id, abs(date_diff('day', e.game_date, u.game_date)),
             coalesce(e.home_score, 0) + coalesce(e.away_score, 0) > 0 DESC, e.espn_game_id
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
  WHERE e.season < (SELECT season FROM first_nba_season)
    AND e.espn_game_id NOT IN (SELECT espn_game_id FROM espn_copies)`

/** ESPN's athletes mapped to NBA ids (`playerIdsSql`), over the NBA's box scores. */
const PLAYER_IDS = playerIdsSql({
  crosswalk: `SELECT DISTINCT TRY_CAST(espn_athlete_id AS BIGINT) AS espn_athlete_id,
           TRY_CAST(nba_player_id AS BIGINT) AS player_id
    FROM src_xwalk_player WHERE nba_player_id IS NOT NULL AND espn_athlete_id IS NOT NULL`,
  lines: 'src_nba_player_box',
  name: "first_name || ' ' || family_name"
})

/**
 * One row per person. The name is the NBA's latest spelling, else ESPN's. A player the NBA's data has
 * and ESPN's does not has no ESPN id; ESPN keeps two ids for a few players, of which this holds one.
 *
 * The box scores split a name into first and family, which gets a few wrong: `Ming Yao`, `Nene Hilario`.
 * The rosters have `Yao Ming` and `Nene`, but they garble others (`Ha Ha` for Seung-Jin Ha, `Sun Sun` for
 * Yue Sun), so a roster's name wins only when it repeats no word and every word is in the box score's.
 * That changes four names of 2,913, all of them right.
 */
const playerTable = (rosters: boolean): string => `CREATE OR REPLACE TABLE player AS
  WITH roster AS (
    ${
      rosters
        ? `SELECT player_id, string_split(arg_max(player, season), ' ') AS words
           FROM src_nba_rosters WHERE player IS NOT NULL GROUP BY 1`
        : 'SELECT NULL::BIGINT AS player_id, NULL::VARCHAR[] AS words'
    }
  ), nba AS (
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
  SELECT coalesce(n.player_id, e.player_id) AS player_id,
         CASE WHEN list_has_all(string_split(coalesce(n.name, e.name), ' '), r.words)
                AND len(list_distinct(r.words)) = len(r.words)
              THEN array_to_string(r.words, ' ')
              ELSE coalesce(n.name, e.name) END AS name,
         e.espn_athlete_id, coalesce(e.method, 'nba only') AS method,
         least(n.first_season, e.first_season) AS first_season,
         greatest(n.last_season, e.last_season) AS last_season
  FROM nba n FULL JOIN espn e USING (player_id)
  LEFT JOIN roster r ON r.player_id = coalesce(n.player_id, e.player_id)`

/** The NBA's recipe: its schedule from 1996-97, ESPN's before, players from its box scores. */
const NBA_IDENTITY: IdentityRecipe = {
  version: IDENTITY_VERSION,
  needs: NBA_NEEDS,
  async build(db) {
    await db.exec(TEAM)
    await db.exec(GAME)
    await db.exec(PLAYER_IDS)
    await db.exec(playerTable(await hasTables(db, ['src_nba_rosters'])))
  }
}

/** Every recipe, by the name a league's registry entry gives (`League.identity`). */
export const IDENTITY_RECIPES: Readonly<Record<IdentityRecipeName, IdentityRecipe>> = {
  nba: NBA_IDENTITY,
  wnba: WNBA_IDENTITY,
  college: COLLEGE_IDENTITY
}

/** Every table any recipe reads: whatever the league, their releases cannot be left out. */
export const IDENTITY_NEEDS = [
  ...new Set(Object.values(IDENTITY_RECIPES).flatMap((r) => r.needs))
].sort()

// A script or test that names no league builds the NBA's, the league every file was before leagues.
const NBA = leagueOf(DEFAULT_LEAGUE)

/** The recipe a league's registry entry names. */
export const identityRecipe = (league: League): IdentityRecipe =>
  IDENTITY_RECIPES[recipeOf(league, 'identity')]

export const canBuildIdentity = (db: StatsDb, league: League = NBA): Promise<boolean> =>
  hasTables(db, identityRecipe(league).needs)

export async function identityStale(db: StatsDb, league: League = NBA): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'identity'"
  )
  return (row?.version ?? 0) < identityRecipe(league).version
}

/** Marks the tables out of date, so a build the app never got to still happens on the next refresh. */
export async function markIdentityStale(db: StatsDb): Promise<void> {
  await db.exec("INSERT OR REPLACE INTO derived_state VALUES ('identity', 0)")
}

/**
 * Rebuilds the tables with the league's recipe; each replaces the old one in its own statement.
 * Returns how many games.
 */
export async function buildIdentity(db: StatsDb, league: League = NBA): Promise<number> {
  const recipe = identityRecipe(league)
  await db.exec(NAME_KEY)
  await recipe.build(db, league)
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', ['identity', recipe.version])
  const games = await db.get<{ n: number }>('SELECT count(*) AS n FROM game')
  return games?.n ?? 0
}
