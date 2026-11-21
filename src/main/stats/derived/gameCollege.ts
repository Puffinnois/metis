import type { League } from '@shared/leagues'
import { BOX_COUNTS, espnLines, type DerivedRecipe } from './game'
import { isNcaaWhole, NCAA_PLAYER_COLUMNS, NCAA_PLAYER_SUMS, NCAA_TEAM_OWN } from './ncaaSplits'
import { bestPlayerSql, column, modeSql, type Have } from './sql'

/**
 * NCAA Division I's recipe for `player_game` and `team_game`, one for the men and the women (D38),
 * from what `docs/reference/ncaa-data-sources.md` measured:
 *
 * - the counts are ESPN's box scores (D40): its `athlete_id` is the key, and it has the starters and
 *   who did not play. A team-game ESPN has no line for reads stats.ncaa.org's instead: the women's 334
 *   games of 2024-25 ESPN lacks, and a handful of others a season (1 to 6). The two are never added
 *   together in one count: a team-game's lines are all one source's (`source`);
 * - stats.ncaa.org's shot zones, putbacks, blocks by zone, transition and assisted splits and
 *   possessions sit beside ESPN's counts under their own names (`ncaa_*`, `ncaaSplits.ts`), on the
 *   player's line wherever stats.ncaa.org has one for the same player (`ncaa_player_ids`), and on the
 *   team's game summed over every line of the team's;
 * - the team's counts are ESPN's team box, which equals its players' sums on the shots, assists,
 *   steals, blocks and points (99.8 to 100 % of team-games, 2021-22 on) and adds the team rebounds and
 *   the team's own turnovers, as stats.ncaa.org's team box does; where ESPN has none, stats.ncaa.org's
 *   team box, and where neither has a count (stats.ncaa.org's has no steals or fouls), the players';
 * - a forfeit (ESPN's 2-0 row, `forfeit_winner_id`) counts in the record as the `game` table has it
 *   and has no box score: no line of either source is read for it;
 * - an exhibition (`preseason`) keeps stats.ncaa.org's box score, typed so that no counted total reads
 *   it (D45, added 2026-11-18).
 *
 * With the `ncaa_*` releases left out (D41) the tables build from ESPN's alone: the games only
 * stats.ncaa.org has have their score and no box score, and the `ncaa_*` columns read NULL.
 */

/** Bump when these tables change, so the next refresh builds them with nothing downloaded. */
// 2: the tables' 128-bit counts narrowed to BIGINT (`narrowCounts`, T1302.9). 3: every pick by a
// total order, so the same files always give the same rows (T1302.9).
const VERSION = 3

const NCAA_BOX = 'src_ncaa_player_box'
const NCAA_TEAM_BOX = 'src_ncaa_team_box'
const ESPN_TEAM_BOX = 'src_espn_team_box'

/** stats.ncaa.org's name for each count of its player box (`orb`, `tpm`, …). */
const NCAA_COUNTS: Record<(typeof BOX_COUNTS)[number], string> = {
  fgm: 'b.fgm',
  fga: 'b.fga',
  fg3m: 'b.tpm',
  fg3a: 'b.tpa',
  ftm: 'b.ftm',
  fta: 'b.fta',
  oreb: 'b.orb',
  dreb: 'b.drb',
  reb: 'b.orb + b.drb',
  ast: 'b.ast',
  stl: 'b.stl',
  blk: 'b.blk',
  tov: 'b.tov',
  pf: 'b.pf',
  pts: 'b.pts'
}

/** Its team box's names: no steals and no fouls, which then read the players' sums. */
const NCAA_TEAM_COUNTS: Partial<Record<(typeof BOX_COUNTS)[number], string>> = {
  fgm: 'n.fgm',
  fga: 'n.fga',
  fg3m: 'n.tpm',
  fg3a: 'n.tpa',
  ftm: 'n.ftm',
  fta: 'n.fta',
  oreb: 'n.orb',
  dreb: 'n.drb',
  reb: 'n.orb + n.drb',
  ast: 'n.ast',
  blk: 'n.blk',
  tov: 'n."to"',
  pts: 'n.pts'
}

/** ESPN's team box's names. `turnovers` counts the team's own, as `total_turnovers` does. */
const ESPN_TEAM_COUNTS: Record<(typeof BOX_COUNTS)[number], string> = {
  fgm: 'field_goals_made',
  fga: 'field_goals_attempted',
  fg3m: 'three_point_field_goals_made',
  fg3a: 'three_point_field_goals_attempted',
  ftm: 'free_throws_made',
  fta: 'free_throws_attempted',
  oreb: 'offensive_rebounds',
  dreb: 'defensive_rebounds',
  reb: 'total_rebounds',
  ast: 'assists',
  stl: 'steals',
  blk: 'blocks',
  tov: 'turnovers',
  pf: 'fouls',
  pts: 'team_score'
}

/**
 * The team of a stats.ncaa.org row among the game's two: the ESPN id it gives when that is one of
 * them, else the team its player maps to (`fallback`), else by the name it prints for the home or away
 * side, which is the game's own for a game only stats.ncaa.org has.
 */
const sideOf = (given: string, fallback: string | null, row: string): string => `CASE
    WHEN ${given} IN (g.home_team_id, g.away_team_id) THEN ${given}
    ${fallback ? `WHEN ${fallback} IN (g.home_team_id, g.away_team_id) THEN ${fallback}` : ''}
    WHEN ${row}.team = ${row}.home THEN g.home_team_id
    WHEN ${row}.team = ${row}.away THEN g.away_team_id
  END`

/**
 * Every stats.ncaa.org player line of a played game that is not a forfeit, with its player's key and
 * team (`ncaa_player_ids`, by its id within the season, or by the name it prints on the team when it
 * has none), the counts under the box score's names, and the `ncaa_*` columns. A contest the `game`
 * table left out (a repeat) has no game row, so its lines are never read.
 */
function ncaaLines(have: Have): string {
  const cols = Object.entries(NCAA_PLAYER_COLUMNS).map(
    ([name, sql]) =>
      `${sql === '1' ? '1' : `TRY_CAST(${sql} AS ${isNcaaWhole(name) ? 'INTEGER' : 'DOUBLE'})`} AS ${name}`
  )
  const counts = BOX_COUNTS.map((c) => `TRY_CAST(${NCAA_COUNTS[c]} AS INTEGER) AS ${c}`)
  if (!have.tables.has(NCAA_BOX) || !have.tables.has('ncaa_player_ids')) {
    return `CREATE OR REPLACE TEMP TABLE ncaa_lines AS
      SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS player_id, NULL::INTEGER AS team_id,
             NULL::BOOLEAN AS appeared, ${BOX_COUNTS.map((c) => `NULL::INTEGER AS ${c}`).join(', ')},
             ${NCAA_PLAYER_SUMS.map((c) => `NULL::${isNcaaWhole(c) ? 'INTEGER' : 'DOUBLE'} AS ${c}`).join(', ')}
      WHERE false`
  }
  const any = BOX_COUNTS.filter((c) => c !== 'reb')
    .map((c) => `coalesce(${NCAA_COUNTS[c]}, 0)`)
    .join(' + ')
  return `CREATE OR REPLACE TEMP TABLE ncaa_lines AS
    WITH by_id AS (
      SELECT season, ncaa_player_id, ${bestPlayerSql()} AS player_id,
             ${bestPlayerSql('', 'team_id')} AS team_id
      FROM ncaa_player_ids WHERE ncaa_player_id IS NOT NULL GROUP BY 1, 2
    ), by_name AS (
      SELECT season, ncaa_team, player, ${bestPlayerSql()} AS player_id,
             ${bestPlayerSql('', 'team_id')} AS team_id
      FROM ncaa_player_ids WHERE ncaa_player_id IS NULL GROUP BY 1, 2, 3
    ), box AS (
      SELECT b.*, nullif(trim(b.player_id::VARCHAR), '') AS pid,
             TRY_CAST(b.team_espn_team_id AS INTEGER) AS given_team
      FROM ${NCAA_BOX} b
    )
    SELECT g.game_id, coalesce(i.player_id, n.player_id) AS player_id,
           ${sideOf('b.given_team', 'coalesce(i.team_id, n.team_id)', 'b')} AS team_id,
           -- A line of no minutes and no count lists a player who did not play.
           (coalesce(b.mins, 0) > 0 OR ${any} > 0) AS appeared,
           ${[...counts, ...cols].join(', ')}
    FROM box b
    JOIN game g ON g.ncaa_game_id = b.contest_id AND g.played AND g.forfeit_winner_id IS NULL
    LEFT JOIN by_id i ON i.season = b.season AND i.ncaa_player_id = b.pid
    LEFT JOIN by_name n ON b.pid IS NULL AND n.season = b.season AND n.ncaa_team = b.team AND n.player = b.player`
}

/**
 * One line per player per game they appeared in: ESPN's (`espnLines`), and stats.ncaa.org's for a
 * team-game ESPN has no line for. Who started is ESPN's flag; unless a team has exactly five, its
 * game reads as unknown, as for the NBA, and stats.ncaa.org's lines have none. Each line carries
 * stats.ncaa.org's splits for the same player in the same game.
 */
const LINES = `CREATE OR REPLACE TEMP TABLE lines AS
  WITH espn AS (
    SELECT * FROM espn_lines WHERE team_id IS NOT NULL
  ), espn_sides AS (
    SELECT DISTINCT game_id, team_id FROM espn
  ), ncaa AS (
    SELECT l.game_id, l.player_id, l.team_id, 'ncaa' AS source, l.ncaa_seconds AS seconds,
           ${BOX_COUNTS.map((c) => `l.${c}`).join(', ')}, NULL::INTEGER AS plus_minus,
           NULL::BOOLEAN AS starter
    FROM ncaa_lines l
    ANTI JOIN espn_sides e ON e.game_id = l.game_id AND e.team_id = l.team_id
    WHERE l.appeared AND l.player_id IS NOT NULL AND l.team_id IS NOT NULL
    QUALIFY row_number() OVER (PARTITION BY l.game_id, l.player_id ORDER BY l.ncaa_seconds DESC NULLS LAST, l::VARCHAR) = 1
  ), together AS (
    SELECT * FROM espn UNION ALL BY NAME SELECT * FROM ncaa
  ), splits AS (
    SELECT game_id, player_id,
           ${NCAA_PLAYER_SUMS.map((c) => (c === 'ncaa_games' ? '1 AS ncaa_games' : `sum(${c}) AS ${c}`)).join(', ')}
    FROM ncaa_lines WHERE player_id IS NOT NULL GROUP BY 1, 2
  )
  SELECT t.* EXCLUDE (starter),
         CASE WHEN count(*) FILTER (WHERE t.starter) OVER (PARTITION BY t.game_id, t.team_id) = 5
              THEN coalesce(t.starter, false) END AS starter,
         ${NCAA_PLAYER_SUMS.map((c) => `s.${c}`).join(', ')}
  FROM together t
  LEFT JOIN splits s ON s.game_id = t.game_id AND s.player_id = t.player_id`

/**
 * A player's position group in a season: what ESPN's box scores list most (`G`, `F`, `C`), else the
 * `player` table's, which also holds a stats.ncaa.org player matched to no ESPN athlete.
 */
function positions(have: Have): string {
  const espn = have.columns.get('src_espn_player_box')?.has('athlete_position_abbreviation')
    ? `SELECT i.player_id, b.season, ${modeSql('position_group(b.athlete_position_abbreviation)')} AS position
       FROM src_espn_player_box b JOIN player_ids i ON i.espn_athlete_id = b.athlete_id
       WHERE b.season = b.file_season AND b.points IS NOT NULL GROUP BY 1, 2`
    : 'SELECT NULL::BIGINT AS player_id, NULL::INTEGER AS season, NULL::VARCHAR AS position'
  const people = have.columns.get('player')?.has('position')
    ? 'SELECT player_id, position_group(position) AS position FROM player'
    : 'SELECT NULL::BIGINT AS player_id, NULL::VARCHAR AS position'
  return `CREATE OR REPLACE TEMP TABLE player_position AS
    WITH espn AS (${espn}), people AS (${people}),
    seen AS (
      SELECT DISTINCT l.player_id, g.season FROM lines l JOIN game g USING (game_id)
    )
    SELECT s.player_id, s.season, coalesce(e.position, p.position) AS position
    FROM seen s
    LEFT JOIN espn e ON e.player_id = s.player_id AND e.season = s.season
    LEFT JOIN people p ON p.player_id = s.player_id`
}

/**
 * The team box, keyed by the game: ESPN's for a team-game whose lines are ESPN's (or that has none),
 * stats.ncaa.org's for one whose lines are its own (or that has none and no ESPN team box). The
 * seconds are the game's, its regulation and overtimes, where the game knows them; else NULL and the
 * players' are summed. A forfeit has no box score.
 */
function teamBox(have: Have, league: League): string {
  const regulation = league.gameMinutes * 5 * 60
  const overtime = league.overtimeMinutes * 5 * 60
  const seconds = `CASE WHEN g.overtimes IS NOT NULL THEN ${regulation} + ${overtime} * g.overtimes END`
  const espn = have.tables.has(ESPN_TEAM_BOX)
    ? `SELECT g.game_id, t.team_id, ${seconds} AS seconds, 'espn' AS source,
              ${BOX_COUNTS.map((c) => `${column(have, ESPN_TEAM_BOX, 't', ESPN_TEAM_COUNTS[c])} AS ${c}`).join(', ')}
       FROM ${ESPN_TEAM_BOX} t
       JOIN game g ON g.espn_game_id = t.game_id AND g.played AND g.forfeit_winner_id IS NULL
       WHERE t.season = t.file_season AND t.team_id IN (g.home_team_id, g.away_team_id)`
    : `SELECT NULL::VARCHAR AS game_id, NULL::INTEGER AS team_id, NULL::INTEGER AS seconds,
              NULL::VARCHAR AS source, ${BOX_COUNTS.map((c) => `NULL::INTEGER AS ${c}`).join(', ')} WHERE false`
  const ncaa = have.tables.has(NCAA_TEAM_BOX)
    ? `SELECT g.game_id, ${sideOf('TRY_CAST(n.team_espn_team_id AS INTEGER)', null, 'n')} AS team_id,
              ${seconds} AS seconds, 'ncaa' AS source,
              ${BOX_COUNTS.map((c) => `${NCAA_TEAM_COUNTS[c] ? `TRY_CAST(${NCAA_TEAM_COUNTS[c]} AS INTEGER)` : 'NULL::INTEGER'} AS ${c}`).join(', ')}
       FROM ${NCAA_TEAM_BOX} n
       JOIN game g ON g.ncaa_game_id = n.contest_id AND g.played AND g.forfeit_winner_id IS NULL`
    : `SELECT NULL::VARCHAR AS game_id, NULL::INTEGER AS team_id, NULL::INTEGER AS seconds,
              NULL::VARCHAR AS source, ${BOX_COUNTS.map((c) => `NULL::INTEGER AS ${c}`).join(', ')} WHERE false`
  return `WITH line_sources AS (
      SELECT game_id, team_id, ${modeSql('source')} AS source FROM lines GROUP BY 1, 2
    ), espn_box AS (
      SELECT * FROM (${espn}) e QUALIFY row_number() OVER (PARTITION BY game_id, team_id ORDER BY e::VARCHAR) = 1
    ), ncaa_box AS (
      SELECT * FROM (${ncaa}) n WHERE team_id IS NOT NULL
      QUALIFY row_number() OVER (PARTITION BY game_id, team_id ORDER BY n::VARCHAR) = 1
    )
    SELECT e.* FROM espn_box e LEFT JOIN line_sources s USING (game_id, team_id)
    WHERE coalesce(s.source, 'espn') = 'espn'
    UNION ALL BY NAME
    SELECT n.* FROM ncaa_box n LEFT JOIN line_sources s USING (game_id, team_id)
    WHERE s.source = 'ncaa'
       OR (s.source IS NULL AND NOT EXISTS (
             SELECT 1 FROM espn_box e WHERE e.game_id = n.game_id AND e.team_id = n.team_id))`
}

/**
 * The team's stats.ncaa.org columns for each game: its lines summed, every line of the team's,
 * linked to an ESPN athlete or not, and the team box's possessions.
 */
function teamSplits(have: Have): string {
  const possessions = have.tables.has(NCAA_TEAM_BOX)
    ? `SELECT g.game_id, ${sideOf('TRY_CAST(n.team_espn_team_id AS INTEGER)', null, 'n')} AS team_id,
              min(n.o_poss) AS ncaa_poss
       FROM ${NCAA_TEAM_BOX} n
       JOIN game g ON g.ncaa_game_id = n.contest_id AND g.played AND g.forfeit_winner_id IS NULL
       GROUP BY 1, 2`
    : 'SELECT NULL::VARCHAR AS game_id, NULL::INTEGER AS team_id, NULL::DOUBLE AS ncaa_poss WHERE false'
  const own = NCAA_TEAM_OWN.filter((c) => c !== 'ncaa_poss').map((c) =>
    c === 'ncaa_games' ? '1 AS ncaa_games' : `sum(${c}) AS ${c}`
  )
  return `WITH own AS (
      SELECT game_id, team_id, ${own.join(', ')}
      FROM ncaa_lines WHERE team_id IS NOT NULL GROUP BY 1, 2
    ), possessions AS (${possessions})
    SELECT o.*, p.ncaa_poss FROM own o LEFT JOIN possessions p USING (game_id, team_id)`
}

export const COLLEGE_DERIVED: DerivedRecipe = {
  version: VERSION,
  needs: ['game', 'team', 'player_ids', 'src_espn_player_box'],
  lines: (have) => [espnLines(have, undefined, true), ncaaLines(have), LINES, positions(have)],
  temps: ['espn_lines', 'ncaa_lines'],
  teamBox,
  teamBoxKey: 'game_id',
  boxSource: 'espn',
  boxSourceSql: 'n.source',
  summedSource: 'p.source',
  // ESPN's and stats.ncaa.org's team boxes count the team's own turnovers.
  teamTurnovers: 'own',
  // ESPN publishes points in the paint, on the fast break and off turnovers from 2023-24 in both
  // leagues; before, every value is blank.
  espnKinds: { paint: 2024, fastBreak: 2024, turnover: 2024 },
  // No All-Star game.
  breaks: [],
  extras: {
    player: NCAA_PLAYER_SUMS,
    team: NCAA_TEAM_OWN,
    teamSql: teamSplits
  },
  narrowCounts: true,
  totalOrder: true
}
