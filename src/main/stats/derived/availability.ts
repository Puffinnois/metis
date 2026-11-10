import { AVAILABILITY_FIRST_SEASON, NOT_INJURY } from '@shared/stats/availability'
import { column, type Have } from './sql'

/**
 * Games a player was listed Out, per player, season and season type, from the official injury
 * reports. It is shaped like the published tables (the engine reads it as one), but built from the
 * reports and the `game` table, since a count of games needs the games.
 *
 * Counted by game, not by report: a game has dozens of reports (a version every few hours for each
 * team), so each player's rows for a game are cut to the last one published, and only that one counts.
 * A player the last report lists as Questionable or Available, after an Out earlier, is not out. A
 * game that was not played, a report row with no game or no player (the "NOT YET SUBMITTED" rows), a
 * preseason, play-in or Cup final game, and any season before the reports are complete do not count.
 */
export const AVAILABILITY_TABLE = 'pub_player_availability'

const SOURCE = 'src_nba_injury_report'

/** What the table counts, as its columns. */
export const AVAILABILITY_COUNTS = ['games_out_injury', 'games_out_other'] as const

/** The table, from the reports. A source or a column that is missing builds an empty table. */
export function availabilitySql(have: Have): string {
  const held = have.columns.get(SOURCE)
  const ready =
    have.tables.has('game') &&
    ['game_id', 'person_id', 'report_datetime', 'current_status'].every((c) => held?.has(c))
  const read = (name: string, type = 'VARCHAR'): string => column(have, SOURCE, 's', name, type)
  // The category decides when there is one; otherwise the reason does (`isInjuryReason`).
  const injury = `CASE WHEN l.category IS NOT NULL THEN l.category = 'Injury/Illness'
       ELSE NOT regexp_matches(coalesce(nullif(trim(l.reason), ''), '-'), '${NOT_INJURY.source}', 'i') END`
  return `CREATE OR REPLACE TABLE ${AVAILABILITY_TABLE} AS
    WITH listed AS (
      SELECT ${read('game_id')} AS game_id, ${read('person_id', 'BIGINT')} AS player_id,
             ${read('team_id', 'BIGINT')} AS team_id,
             ${read('report_datetime', 'TIMESTAMP')} AS reported, ${read('current_status')} AS status,
             ${read('category')} AS category, ${read('reason')} AS reason
      FROM ${held ? SOURCE : '(SELECT 1)'} s
    ), last AS (
      SELECT * FROM listed
      WHERE game_id IS NOT NULL AND player_id IS NOT NULL AND reported IS NOT NULL
      QUALIFY row_number() OVER (PARTITION BY game_id, player_id ORDER BY reported DESC, team_id) = 1
    )
    SELECT l.player_id, g.season, g.game_type,
           NULL::DOUBLE AS games, NULL::DOUBLE AS minutes, NULL::DOUBLE AS possessions,
           (count(*) FILTER (WHERE l.status = 'Out' AND (${injury})))::DOUBLE AS games_out_injury,
           (count(*) FILTER (WHERE l.status = 'Out' AND NOT (${injury})))::DOUBLE AS games_out_other
    FROM last l ${ready ? 'JOIN game g ON g.game_id = l.game_id' : 'JOIN (SELECT NULL::VARCHAR AS game_id, NULL::INTEGER AS season, NULL::VARCHAR AS game_type, NULL::BOOLEAN AS played) g ON false'}
    WHERE g.played AND g.game_type IN ('regular', 'playoffs')
      AND g.season >= ${AVAILABILITY_FIRST_SEASON}
    GROUP BY l.player_id, g.season, g.game_type`
}
