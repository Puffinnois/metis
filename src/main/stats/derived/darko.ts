import type { Have } from './sql'
import { column } from './sql'

/**
 * DARKO as its maker, Kostya Medvedovsky, publishes it on darko.app, read from the boards the owner
 * imports by hand (D55, `darkoImport.ts`): one row a player and season, the season's latest snapshot.
 * DARKO is a player's state on a date, so its metrics read one season at a time (`oneSeason`), never
 * added up over seasons; every snapshot stays in `src_darko`, and the rating history reads them all.
 *
 * A season is the file's own `season` column (its final year, as Metis labels seasons, measured on the
 * site's player page: 2027 on 2026-11-23), else the snapshot's date, a season's label turning in
 * August as the NBA's does. A column the board's chosen set leaves out reads NULL.
 */
export const DARKO_SOURCE = 'src_darko'
export const DARKO_DPM_TABLE = 'pub_player_darko_dpm'

/** Each component and the board's column it reads. */
export const DARKO_COLUMNS = {
  dk_dpm: 'dpm',
  dk_o_dpm: 'o_dpm',
  dk_d_dpm: 'd_dpm',
  dk_box_dpm: 'box_dpm',
  dk_on_off_dpm: 'on_off_dpm',
  dk_x_minutes: 'x_minutes',
  dk_x_pace: 'x_pace',
  dk_x_pts_100: 'x_pts_100',
  dk_x_ast_100: 'x_ast_100',
  dk_x_fg_pct: 'x_fg_pct',
  dk_x_fg3_pct: 'x_fg3_pct',
  dk_x_ft_pct: 'x_ft_pct'
} as const

/** The table's components: the row it stands for, then each column read. */
export const DARKO_DPM_COLUMNS = ['dk_rows', ...Object.keys(DARKO_COLUMNS)] as const

export const DARKO_NOT_LOADED =
  'Not loaded on this copy: DARKO is read only from boards its owner downloads by hand from darko.app (D55).'

export function darkoDpmSql(have: Have): string {
  const held = have.tables.has(DARKO_SOURCE)
  const c = (n: string, type = 'DOUBLE'): string => column(have, DARKO_SOURCE, 's', n, type)
  const season = `coalesce(${c('season', 'INTEGER')},
    year(s.snapshot_date)::INTEGER + CASE WHEN month(s.snapshot_date) >= 8 THEN 1 ELSE 0 END)`
  return `CREATE OR REPLACE TABLE ${DARKO_DPM_TABLE} AS
    SELECT ${c('nba_id', 'BIGINT')} AS player_id, ${held ? season : 'NULL::INTEGER'} AS season,
           'regular' AS game_type, NULL::DOUBLE AS games, NULL::DOUBLE AS minutes,
           NULL::DOUBLE AS possessions, 1.0 AS dk_rows,
           ${Object.entries(DARKO_COLUMNS)
             .map(([name, src]) => `${c(src)} AS ${name}`)
             .join(', ')},
           ${held ? 's.snapshot_date' : 'NULL::DATE'} AS snapshot_date
    FROM ${held ? DARKO_SOURCE : '(SELECT 1)'} s
    WHERE ${held ? `${c('nba_id', 'BIGINT')} IS NOT NULL` : 'false'}
    QUALIFY row_number() OVER (
      PARTITION BY ${c('nba_id', 'BIGINT')}, ${held ? season : 'NULL'}
      ORDER BY ${held ? 's.snapshot_date DESC, s.source_file DESC' : 'NULL'}
    ) = 1`
}
