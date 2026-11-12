import { column, type Have } from './sql'

/**
 * Shots and possessions, keyed to the `game` and `team` tables like the plays. They are views over
 * the source tables, not built tables: a season's scan reads as fast through the view, and a copy
 * would add to a file already near D22's limit (measured in `nba-data-sources.md`, "Plays").
 *
 * The NBA's shot coordinates and ESPN's are different frames and are never mixed: the NBA's
 * `x_legacy` and `y_legacy` are tenths of a foot from the basket, ESPN's are its own court units.
 */

export const SHOT_VIEWS = { nba: 'shot_nba', espn: 'shot_espn' } as const
export const POSSESSIONS_VIEW = 'possession'

type Columns = ReadonlyArray<readonly [string, string]>

export const SHOT_COLUMNS: Columns = [
  ['game_id', 'VARCHAR'],
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['game_date', 'DATE'],
  ['period', 'INTEGER'],
  // Seconds left in the period.
  ['clock', 'DOUBLE'],
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ['home', 'BOOLEAN'],
  ['player_id', 'BIGINT'],
  // ESPN's second athlete: the assist on a make, the blocker on a miss. The NBA's file has none.
  ['player2_id', 'BIGINT'],
  ['free_throw', 'BOOLEAN'],
  ['made', 'BOOLEAN'],
  // 2 or 3 (1 for a free throw). ESPN gives the value of a make only.
  ['value', 'INTEGER'],
  // Feet, as the NBA publishes it. ESPN has none.
  ['distance', 'INTEGER'],
  ['x', 'DOUBLE'],
  ['y', 'DOUBLE'],
  ['action', 'VARCHAR'],
  ['subtype', 'VARCHAR']
]

const PLAYERS = [1, 2, 3, 4, 5]

export const POSSESSION_COLUMNS: Columns = [
  ['game_id', 'VARCHAR'],
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['game_date', 'DATE'],
  ['period', 'INTEGER'],
  ['possession', 'INTEGER'],
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ['home', 'BOOLEAN'],
  // The plays it spans, as `seq` in `play_nba`.
  ['start_seq', 'INTEGER'],
  ['end_seq', 'INTEGER'],
  ['start_clock', 'DOUBLE'],
  ['end_clock', 'DOUBLE'],
  ['start_type', 'VARCHAR'],
  // The dataset's own mark: a possession that ends a period with no shot can be left out.
  ['counted', 'BOOLEAN'],
  ['second_chance', 'BOOLEAN'],
  ['transition', 'BOOLEAN'],
  ['garbage_time', 'BOOLEAN'],
  ['seconds_to_first_shot', 'DOUBLE'],
  ['points', 'INTEGER'],
  ['fg2a', 'INTEGER'],
  ['fg2m', 'INTEGER'],
  ['fg3a', 'INTEGER'],
  ['fg3m', 'INTEGER'],
  ['fta', 'INTEGER'],
  ['ftm', 'INTEGER'],
  ['oreb', 'INTEGER'],
  ['dreb', 'INTEGER'],
  ['tov', 'INTEGER'],
  ...PLAYERS.map((i) => [`off_${i}`, 'BIGINT'] as const),
  ...PLAYERS.map((i) => [`def_${i}`, 'BIGINT'] as const),
  ['lineup_source', 'VARCHAR']
]

/** A view with the columns and no rows, for a database the identity tables have not reached. */
const emptyView = (name: string, columns: Columns): string =>
  `CREATE VIEW IF NOT EXISTS ${name} AS SELECT ${columns
    .map(([n, t]) => `NULL::${t} AS ${n}`)
    .join(', ')} WHERE false`

export const eventsBootstrap = (): string[] => [
  ...Object.values(SHOT_VIEWS).map((v) => emptyView(v, SHOT_COLUMNS)),
  emptyView(POSSESSIONS_VIEW, POSSESSION_COLUMNS)
]

const select = (columns: Columns, values: Record<string, string>): string =>
  columns.map(([n, t]) => `(${values[n] ?? 'NULL'})::${t} AS ${n}`).join(',\n           ')

const SIDES = {
  opponent_id: `CASE team WHEN g.home_team_id THEN g.away_team_id WHEN g.away_team_id THEN g.home_team_id END`,
  home: 'team = g.home_team_id'
}

const isoClock = (c: string): string =>
  `TRY_CAST(regexp_extract(${c}, 'PT(\\d+)M', 1) AS DOUBLE) * 60
   + TRY_CAST(regexp_extract(${c}, 'M([\\d.]+)S', 1) AS DOUBLE)`

export const nbaShotsSql = (have: Have): string =>
  `CREATE OR REPLACE VIEW ${SHOT_VIEWS.nba} AS ${nbaShotsSelect(have)}`

/**
 * The NBA's shots keyed to the game, every season or one: the shot tables read a season straight from
 * here, since the view is only created after they are built.
 */
export function nbaShotsSelect(have: Have, season?: number): string {
  const t = 'src_nba_shots'
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 's', name, type)
  const bySource = have.columns.get(t)?.has('season') ? ` AND s.season = ${season}` : ''
  const one = season === undefined ? '' : `WHERE g.season = ${season}${bySource}`
  return `SELECT ${select(SHOT_COLUMNS, {
    game_id: 'g.game_id',
    season: 'g.season',
    game_type: 'g.game_type',
    game_date: 'g.game_date',
    period: c('period'),
    clock: isoClock(c('clock', 'VARCHAR')),
    team_id: 'team',
    ...SIDES,
    player_id: `nullif(${c('person_id')}, 0)`,
    free_throw: 'false',
    made: `${c('shot_result', 'VARCHAR')} = 'Made'`,
    value: c('shot_value'),
    distance: c('shot_distance'),
    x: c('x_legacy', 'DOUBLE'),
    y: c('y_legacy', 'DOUBLE'),
    action: c('action_type', 'VARCHAR'),
    subtype: `nullif(${c('sub_type', 'VARCHAR')}, '')`
  })}
    FROM (SELECT s.*, ${c('team_id')} AS team FROM ${have.tables.has(t) ? t : '(SELECT 1)'} s) s
    JOIN game g ON g.nba_game_id = ${c('game_id', 'VARCHAR')} ${one}`
}

/** ESPN's shots name the team by ESPN id, matched through `team` for the game's season. */
export function espnShotsSql(have: Have): string {
  const t = 'src_espn_shots'
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 's', name, type)
  return `CREATE OR REPLACE VIEW ${SHOT_VIEWS.espn} AS
    SELECT ${select(SHOT_COLUMNS, {
      game_id: 'g.game_id',
      season: 'g.season',
      game_type: 'g.game_type',
      game_date: 'g.game_date',
      period: c('period_number'),
      clock: `TRY_CAST(split_part(${c('clock_display_value', 'VARCHAR')}, ':', 1) AS DOUBLE) * 60
              + TRY_CAST(split_part(${c('clock_display_value', 'VARCHAR')}, ':', 2) AS DOUBLE)`,
      team_id: 'team',
      ...SIDES,
      player_id: 'p1.player_id',
      player2_id: 'p2.player_id',
      free_throw: `${c('type_text', 'VARCHAR')} ILIKE 'Free Throw%'`,
      made: `coalesce(${c('scoring_play', 'BOOLEAN')}, false)`,
      value: `CASE WHEN ${c('type_text', 'VARCHAR')} ILIKE 'Free Throw%' THEN 1
                   WHEN ${c('scoring_play', 'BOOLEAN')} AND ${c('score_value')} IN (2, 3) THEN ${c('score_value')} END`,
      x: c('coordinate_x', 'DOUBLE'),
      y: c('coordinate_y', 'DOUBLE'),
      action: c('type_text', 'VARCHAR')
    })}
    FROM (SELECT s.*, tm.team_id AS team
          FROM ${have.tables.has(t) ? t : '(SELECT 1)'} s
          JOIN game g0 ON g0.espn_game_id = ${c('game_id')}
          LEFT JOIN team tm ON tm.espn_team_id = ${c('team_id')} AND tm.season = g0.season
          WHERE ${c('season')} = ${c('file_season')}) s
    JOIN game g ON g.espn_game_id = ${c('game_id')}
    LEFT JOIN player_ids p1 ON p1.espn_athlete_id = ${c('athlete_id_1')}
    LEFT JOIN player_ids p2 ON p2.espn_athlete_id = ${c('athlete_id_2')}`
}

/**
 * The dataset's possessions: derived by SportsDataverse from the NBA's play by play, not published
 * by the NBA. The players are the NBA's person ids, which are the app's player ids.
 */
export function possessionsSql(have: Have): string {
  const t = 'src_nba_possessions'
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 's', name, type)
  const counts = ['points', 'fg2a', 'fg2m', 'fg3a', 'fg3m', 'fta', 'ftm', 'oreb', 'dreb', 'tov']
  return `CREATE OR REPLACE VIEW ${POSSESSIONS_VIEW} AS
    SELECT ${select(POSSESSION_COLUMNS, {
      game_id: 'g.game_id',
      season: 'g.season',
      game_type: 'g.game_type',
      game_date: 'g.game_date',
      period: c('period'),
      possession: c('possession_number'),
      team_id: 'team',
      ...SIDES,
      start_seq: c('start_order_index'),
      end_seq: c('end_order_index'),
      start_clock: c('start_seconds_remaining', 'DOUBLE'),
      end_clock: c('end_seconds_remaining', 'DOUBLE'),
      start_type: c('possession_start_type', 'VARCHAR'),
      counted: c('count_as_possession', 'BOOLEAN'),
      second_chance: c('is_second_chance', 'BOOLEAN'),
      transition: c('is_transition', 'BOOLEAN'),
      garbage_time: c('is_garbage_time', 'BOOLEAN'),
      seconds_to_first_shot: c('seconds_to_first_shot', 'DOUBLE'),
      ...Object.fromEntries(counts.map((n) => [n, c(n)])),
      ...Object.fromEntries(PLAYERS.map((i) => [`off_${i}`, c(`off_player_${i}`)])),
      ...Object.fromEntries(PLAYERS.map((i) => [`def_${i}`, c(`def_player_${i}`)])),
      lineup_source: c('lineup_source', 'VARCHAR')
    })}
    FROM (SELECT s.*, ${c('offense_team_id')} AS team FROM ${have.tables.has(t) ? t : '(SELECT 1)'} s) s
    JOIN game g ON g.nba_game_id = ${c('game_id', 'VARCHAR')}`
}

export const eventsSql = (have: Have): string[] => [
  nbaShotsSql(have),
  espnShotsSql(have),
  possessionsSql(have)
]
