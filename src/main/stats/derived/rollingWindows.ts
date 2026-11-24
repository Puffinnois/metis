import type { Have } from './sql'
import { column } from './sql'

/**
 * SportsDataverse's rolling windows (`nba_stats_rolling_windows`, the WNBA's of the same shape; T1703.2,
 * reference entry 285): a player's FG% and 3P% over their last 50 and last 200 attempts, as of the
 * season's last shot (`as_of_date`), beside the window before it, the season's first window and the
 * career baseline, and the three changes. One row a player, season, metric and window in the file
 * (no repeat on any season); here pivoted to one row a player-season.
 *
 * A window the player has not filled is published as unqualified (`qualified` false, `n` below the
 * window). Each value is stored times that flag, so an unfilled window reads no value, not a rate
 * over a few shots. A rate here is SportsDataverse's ready-made figure over a fixed count of
 * attempts, read one season at a time (`oneSeason`): it is a state at the season's end, never added
 * up over seasons.
 */
export const ROLLING_TABLE = 'pub_player_rolling'
export const ROLLING_FIRST_SEASON = 1997

/** The file's metric and window, as the components name them. */
export const ROLLING_WINDOWS = [
  { metric: 'fg_pct', window: 50, key: 'fg50' },
  { metric: 'fg_pct', window: 200, key: 'fg200' },
  { metric: 'fg3_pct', window: 50, key: 'fg3_50' },
  { metric: 'fg3_pct', window: 200, key: 'fg3_200' }
] as const

/** Each value of a window and the file's column it reads. */
export const ROLLING_VALUES = {
  cur: 'cur',
  prev: 'prev',
  start: 'season_start',
  career: 'career_baseline',
  dprev: 'delta_prev',
  dseason: 'delta_season',
  dcareer: 'delta_career'
} as const

export type RollingValue = keyof typeof ROLLING_VALUES

/** A window's component: `rw_fg50_cur`, its flag `rw_fg50_q`. */
export const rollingComponent = (key: string, value: RollingValue | 'q'): string =>
  `rw_${key}_${value}`

export const ROLLING_COLUMNS: readonly string[] = ROLLING_WINDOWS.flatMap((w) => [
  rollingComponent(w.key, 'q'),
  ...(Object.keys(ROLLING_VALUES) as RollingValue[]).map((v) => rollingComponent(w.key, v))
])

/** The league's file: the NBA's or the WNBA's, whichever the open file holds. */
const SOURCES = ['src_nba_rolling_windows', 'src_wnba_rolling_windows']

export function rollingSql(have: Have): string {
  const t = SOURCES.find((s) => have.tables.has(s)) ?? SOURCES[0]
  const held = have.tables.has(t)
  const c = (n: string, type = 'DOUBLE'): string => column(have, t, 's', n, type)
  const q = `CASE WHEN ${c('qualified', 'BOOLEAN')} THEN 1.0 ELSE 0.0 END`
  const pick = (w: (typeof ROLLING_WINDOWS)[number], sql: string): string =>
    `max(CASE WHEN ${c('metric', 'VARCHAR')} = '${w.metric}' AND ${c('window_n', 'INTEGER')} = ${w.window}
          THEN ${sql} END)`
  const columns = ROLLING_WINDOWS.flatMap((w) => [
    `${pick(w, q)} AS ${rollingComponent(w.key, 'q')}`,
    ...(Object.entries(ROLLING_VALUES) as [RollingValue, string][]).map(
      ([v, src]) => `${pick(w, `${c(src)} * ${q}`)} AS ${rollingComponent(w.key, v)}`
    )
  ])
  return `CREATE OR REPLACE TABLE ${ROLLING_TABLE} AS
    SELECT ${c('entity_id', 'BIGINT')} AS player_id, ${c('season', 'INTEGER')} AS season,
           'regular' AS game_type, NULL::DOUBLE AS games, NULL::DOUBLE AS minutes,
           NULL::DOUBLE AS possessions, ${columns.join(',\n           ')}
    FROM ${held ? t : '(SELECT 1)'} s
    WHERE ${held ? `${c('entity_type', 'VARCHAR')} = 'player' AND ${c('entity_id', 'BIGINT')} IS NOT NULL` : 'false'}
    GROUP BY 1, 2`
}
