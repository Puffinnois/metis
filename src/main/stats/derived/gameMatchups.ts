import { MATCHUPS_FIRST_SEASON } from './publishedTables'
import { column, type Have } from './sql'

/**
 * Who guarded whom in each game: one row per game, offensive player and defender, from the NBA's game
 * matchups (2017-18 on, every season type). Keyed to the `game` table's id, its season, season type
 * and date (D27), and to the NBA's player and team ids, which are the players' and teams' keys.
 *
 * It holds counts only, so any group of games adds up exactly and a rate is divided when read. The
 * defenders' matchup metrics read it under a filter that splits a season (`publishedGames` in the
 * catalogue), and a game's page lists its pairs.
 */
export const GAME_MATCHUPS = 'game_matchups'

const SOURCE = 'src_nba_game_matchups'

/**
 * The counts, each named as the season table names it, so one formula reads either, and the file's
 * column it comes from. The help columns, the switches and the potential assists are zeros on every
 * row of every season (measured), and are kept as published.
 */
export const GAME_MATCHUP_COUNTS = [
  ['possessions', 'partial_possessions'],
  ['player_pts', 'player_points'],
  ['team_pts', 'team_points'],
  ['matchup_fgm', 'matchup_field_goals_made'],
  ['matchup_fga', 'matchup_field_goals_attempted'],
  ['matchup_fg3_m', 'matchup_three_pointers_made'],
  ['matchup_fg3_a', 'matchup_three_pointers_attempted'],
  ['matchup_ftm', 'matchup_free_throws_made'],
  ['matchup_fta', 'matchup_free_throws_attempted'],
  ['matchup_ast', 'matchup_assists'],
  ['matchup_tov', 'matchup_turnovers'],
  ['matchup_blk', 'matchup_blocks'],
  ['sfl', 'shooting_fouls'],
  ['matchup_potential_ast', 'matchup_potential_assists'],
  ['switches_on', 'switches_on'],
  ['help_blk', 'help_blocks'],
  ['help_fgm', 'help_field_goals_made'],
  ['help_fga', 'help_field_goals_attempted']
] as const

/**
 * What the engine can sum from the table, per defender: the counts, the time, and `games`, which it
 * counts as the games with a matchup rather than summing.
 */
export const GAME_MATCHUP_COMPONENTS: readonly string[] = [
  'games',
  'matchup_minutes',
  ...GAME_MATCHUP_COUNTS.map(([name]) => name)
]

/** The column holding the defender: the engine's player key for this table. */
export const GAME_MATCHUP_KEY = 'def_player_id'

export function gameMatchupsBootstrap(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS ${GAME_MATCHUPS} (
       game_id VARCHAR, season INTEGER, game_type VARCHAR, game_date DATE,
       off_team_id BIGINT, def_team_id BIGINT, off_player_id BIGINT, def_player_id BIGINT,
       off_position VARCHAR, matchup_seconds DOUBLE, matchup_minutes DOUBLE,
       ${GAME_MATCHUP_COUNTS.map(([name]) => `${name} DOUBLE`).join(', ')})`
  ]
}

/**
 * A clock as either spelling the NBA uses, in seconds: `9:41` (a clock printed to the second, which
 * can round up to `9:60`, read as ten minutes) or `8.3` (decimal minutes).
 */
export const clockSeconds = (text: string): string =>
  `CASE WHEN ${text} LIKE '%:%'
        THEN TRY_CAST(split_part(${text}, ':', 1) AS DOUBLE) * 60
             + TRY_CAST(split_part(${text}, ':', 2) AS DOUBLE)
        ELSE TRY_CAST(${text} AS DOUBLE) * 60 END`

/**
 * The table, from the file's rows. Time is `matchup_minutes_sort`, seconds to a tenth, which is what
 * agrees with the pair file's `matchup_time_sec`; where it is missing, the printed clock. A row whose
 * game the `game` table does not know is left out (none are, measured). What is missing reads NULL.
 */
export function gameMatchupsSql(have: Have): string {
  const held = have.columns.get(SOURCE)
  const ready = have.tables.has('game') && held?.has('game_id')
  const num = (name: string, type = 'DOUBLE'): string => column(have, SOURCE, 's', name, type)
  const printed = clockSeconds(column(have, SOURCE, 's', 'matchup_minutes', 'VARCHAR'))
  const seconds = `coalesce(${num('matchup_minutes_sort')}, ${printed})`
  return `CREATE OR REPLACE TABLE ${GAME_MATCHUPS} AS
    SELECT g.game_id, g.season, g.game_type, g.game_date,
           ${num('off_team_id', 'BIGINT')} AS off_team_id, ${num('def_team_id', 'BIGINT')} AS def_team_id,
           ${num('off_person_id', 'BIGINT')} AS off_player_id,
           ${num('def_person_id', 'BIGINT')} AS def_player_id,
           nullif(trim(${column(have, SOURCE, 's', 'off_position', 'VARCHAR')}), '') AS off_position,
           ${seconds} AS matchup_seconds, ${seconds} / 60 AS matchup_minutes,
           ${GAME_MATCHUP_COUNTS.map(([name, from]) => `${num(from)} AS ${name}`).join(', ')}
    FROM ${ready ? `${SOURCE} s JOIN game g ON g.nba_game_id = TRY_CAST(s.game_id AS VARCHAR)` : '(SELECT 1) s, (SELECT NULL::VARCHAR AS game_id, NULL::INTEGER AS season, NULL::VARCHAR AS game_type, NULL::DATE AS game_date) g'}
    WHERE ${ready ? `g.season >= ${MATCHUPS_FIRST_SEASON}` : 'false'}`
}
