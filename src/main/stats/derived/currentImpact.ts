import type { Have } from './sql'
import { column } from './sql'

/**
 * SportsDataverse's current impact (`nba_current_impact`, T1703.2): each player's expected offence and
 * defence per 100 possessions as of opening night and every 7 days after, from the games before the
 * date only. The source keeps every weekly row as published. Two tables read one row a player-season:
 *
 * - the season's last estimate (its latest as-of date, early April, before the playoffs);
 * - the opening-night estimate, made before the season's first game: a forecast of the season.
 *
 * Both are a state of knowledge on a date, so they read one season at a time (`oneSeason`) and never
 * add up over seasons. A row is stored with `ci_rows` = 1, the sample its value is read over.
 */
export const CURRENT_IMPACT_SOURCE = 'src_nba_current_impact'
export const CURRENT_IMPACT_TABLE = 'pub_player_current_impact'
export const EXPECTED_IMPACT_TABLE = 'pub_player_expected_impact'
export const CURRENT_IMPACT_FIRST_SEASON = 2007

/** The last estimate's columns: the impact, its parts, the box prior and the possessions behind it. */
export const CURRENT_IMPACT_COLUMNS = [
  'ci_rows',
  'ci_total',
  'ci_off',
  'ci_def',
  'ci_prior',
  'ci_o_prior',
  'ci_d_prior',
  'ci_poss'
] as const
/** The opening-night estimate's columns. */
export const EXPECTED_IMPACT_COLUMNS = ['ce_rows', 'ce_total', 'ce_off', 'ce_def'] as const

function pick(have: Have, table: string, order: 'ASC' | 'DESC', columns: string): string {
  const held = have.tables.has(CURRENT_IMPACT_SOURCE)
  const c = (n: string, type = 'DOUBLE'): string =>
    column(have, CURRENT_IMPACT_SOURCE, 's', n, type)
  return `CREATE OR REPLACE TABLE ${table} AS
    SELECT ${c('player_id', 'BIGINT')} AS player_id, ${c('season', 'INTEGER')} AS season,
           'regular' AS game_type, NULL::DOUBLE AS games, NULL::DOUBLE AS minutes,
           NULL::DOUBLE AS possessions, ${columns}
    FROM ${held ? CURRENT_IMPACT_SOURCE : '(SELECT 1)'} s
    WHERE ${c('player_id', 'BIGINT')} IS NOT NULL AND ${c('season', 'INTEGER')} >= ${CURRENT_IMPACT_FIRST_SEASON}
    QUALIFY row_number() OVER (
      PARTITION BY ${c('player_id', 'BIGINT')}, ${c('season', 'INTEGER')}
      ORDER BY ${c('as_of', 'DATE')} ${order}
    ) = 1`
}

/** The season's last estimate: the row of each player-season's latest as-of date. */
export function currentImpactSql(have: Have): string {
  const c = (n: string): string => column(have, CURRENT_IMPACT_SOURCE, 's', n, 'DOUBLE')
  return pick(
    have,
    CURRENT_IMPACT_TABLE,
    'DESC',
    `1.0 AS ci_rows, ${c('current_impact')} AS ci_total, ${c('o_current_impact')} AS ci_off,
     ${c('d_current_impact')} AS ci_def, ${c('o_prior')} + ${c('d_prior')} AS ci_prior,
     ${c('o_prior')} AS ci_o_prior, ${c('d_prior')} AS ci_d_prior,
     ${c('off_poss')} + ${c('def_poss')} AS ci_poss`
  )
}

/** The opening-night estimate: the row of each player-season's first as-of date. */
export function expectedImpactSql(have: Have): string {
  const c = (n: string): string => column(have, CURRENT_IMPACT_SOURCE, 's', n, 'DOUBLE')
  return pick(
    have,
    EXPECTED_IMPACT_TABLE,
    'ASC',
    `1.0 AS ce_rows, ${c('current_impact')} AS ce_total, ${c('o_current_impact')} AS ce_off,
     ${c('d_current_impact')} AS ce_def`
  )
}
