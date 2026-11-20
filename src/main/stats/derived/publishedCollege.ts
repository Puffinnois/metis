import type { PublishedTable } from './publishedTables'
import { column, type Have } from './sql'

/**
 * SportsDataverse's published college models (D44, `ncaa-data-sources.md`, "The published models"):
 * its team ratings, its box-score BPM, and its two RAPM fits, the league's and the within-team one,
 * which are different estimands and never share a table, a column or a metric. Each value is stored
 * times what it was fitted on (games, minutes, possessions), so a season reads back as published and
 * seasons together are weighted, as the NBA's impact file is. They are every game of a season together
 * (the ratings' `games` count the postseason), so they are read only over every counted game
 * (`PublishedTable.everyGame`). A team's row is stored under the regular season, which every college
 * team plays; a player's under a type they have a box-score line in (`storedType`), since the engine
 * joins a published row to the player's lines of its type.
 *
 * The tables are built on every league's refresh, and from a file without the sources they are empty.
 */

/** A table with the columns `publishedBootstrap` makes, from a SELECT naming them all. */
const create = (t: string, select: string): string => `CREATE OR REPLACE TABLE ${t} AS ${select}`

/** An empty table of these columns, for a file without the source. */
const empty = (key: string, columns: readonly string[]): string =>
  `SELECT NULL::BIGINT AS ${key}, NULL::INTEGER AS season, NULL::VARCHAR AS game_type,
          ${['games', 'minutes', 'possessions', ...columns].map((c) => `NULL::DOUBLE AS ${c}`).join(', ')}
   WHERE false`

/** A value times its weight, NULL when either is; a published NaN reads NULL. */
const times = (value: string, weight: string): string =>
  `CASE WHEN isnan(${value}) THEN NULL ELSE ${value} * ${weight} END`

/**
 * The game type a player's row is stored under: the regular season where they have a line in it, else
 * the first counted type they have one in. Eight men's players of 2021-22 to 2025-26 have no
 * regular-season line (a walk-on whose one game of 2022-23 was an NCAA tournament game), and stored under
 * the regular season their published values read nothing (T1302.8). The rows are read only over every
 * counted game, so the type a row carries changes nothing else. The regular season without the season
 * table.
 */
function storedType(have: Have, key: string, season: string): { join: string; type: string } {
  if (!have.tables.has('player_season')) return { join: '', type: "'regular'" }
  return {
    join: `LEFT JOIN (
        SELECT player_id, season,
               CASE WHEN bool_or(game_type = 'regular') THEN 'regular' ELSE min(game_type) END AS game_type
        FROM player_season WHERE team_id IS NULL AND game_type NOT IN ('preseason', 'all-star')
        GROUP BY 1, 2) pt ON pt.player_id = ${key} AND pt.season = ${season}`,
    type: "coalesce(pt.game_type, 'regular')"
  }
}

/** The team ratings' values, each stored times the games it was fitted on. */
export const SDV_RATING_VALUES = [
  'adj_o',
  'adj_d',
  'adj_em',
  'adj_tempo',
  'raw_o',
  'raw_d',
  'adj_o_blend',
  'adj_d_blend',
  'adj_em_blend'
] as const
const RATING_COLUMNS = SDV_RATING_VALUES.map((c) => `sdv_${c}_w`)

function ratingsSql(have: Have): string {
  const t = 'src_ratings'
  const table = 'pub_team_sdv_ratings'
  if (!have.tables.has(t)) return create(table, empty('team_id', RATING_COLUMNS))
  const c = (n: string, type = 'DOUBLE'): string => column(have, t, 's', n, type)
  return create(
    table,
    `SELECT ${c('team_id', 'BIGINT')} AS team_id, ${c('season', 'INTEGER')} AS season,
            'regular' AS game_type, ${c('games')} AS games, NULL::DOUBLE AS minutes,
            NULL::DOUBLE AS possessions,
            ${SDV_RATING_VALUES.map((v) => `${times(c(v), c('games'))} AS sdv_${v}_w`).join(', ')}
     FROM ${t} s WHERE ${c('team_id', 'BIGINT')} IS NOT NULL AND ${c('games')} > 0`
  )
}

const BPM_COLUMNS = ['sdv_box_obpm_w', 'sdv_box_dbpm_w', 'sdv_box_bpm_w']

function bpmSql(have: Have): string {
  const t = 'src_player_value'
  const table = 'pub_player_sdv_bpm'
  if (!have.tables.has(t)) return create(table, empty('player_id', BPM_COLUMNS))
  const c = (n: string, type = 'DOUBLE'): string => column(have, t, 's', n, type)
  const stored = storedType(have, c('player_id', 'BIGINT'), c('season', 'INTEGER'))
  return create(
    table,
    `SELECT ${c('player_id', 'BIGINT')} AS player_id, ${c('season', 'INTEGER')} AS season,
            ${stored.type} AS game_type, NULL::DOUBLE AS games, ${c('min')} AS minutes,
            NULL::DOUBLE AS possessions,
            ${['box_obpm', 'box_dbpm', 'box_bpm'].map((v) => `${times(c(v), c('min'))} AS sdv_${v}_w`).join(', ')}
     FROM ${t} s ${stored.join} WHERE ${c('player_id', 'BIGINT')} IS NOT NULL AND ${c('min')} > 0`
  )
}

/**
 * A stats.ncaa.org player id of a season as the player's key: ESPN's athlete through
 * `ncaa_player_ids` (T1302.4), else D28's negative id, so a player no crosswalk names is kept.
 */
const playerKey = (have: Have, t: string): string =>
  `coalesce(i.player_id, -TRY_CAST(${column(have, t, 's', 'player_id', 'VARCHAR')} AS BIGINT))`

const RAPM_COLUMNS = [
  'ncaa_orapm_w',
  'ncaa_drapm_w',
  'ncaa_rapm_w',
  'ncaa_rapm_off_poss',
  'ncaa_rapm_def_poss'
]

function rapmSql(have: Have): string {
  const t = 'src_ncaa_rapm'
  const table = 'pub_player_ncaa_rapm'
  if (!have.tables.has(t)) return create(table, empty('player_id', RAPM_COLUMNS))
  const c = (n: string, type = 'DOUBLE'): string => column(have, t, 's', n, type)
  const off = c('off_poss')
  const def = c('def_poss')
  const stored = storedType(have, playerKey(have, t), c('season', 'INTEGER'))
  return create(
    table,
    `SELECT ${playerKey(have, t)} AS player_id, ${c('season', 'INTEGER')} AS season,
            ${stored.type} AS game_type, NULL::DOUBLE AS games, NULL::DOUBLE AS minutes,
            ${off} + ${def} AS possessions,
            ${times(c('orapm'), off)} AS ncaa_orapm_w, ${times(c('drapm'), def)} AS ncaa_drapm_w,
            ${times(c('rapm_net'), `(${off} + ${def})`)} AS ncaa_rapm_w,
            ${off} AS ncaa_rapm_off_poss, ${def} AS ncaa_rapm_def_poss
     FROM ${t} s
     LEFT JOIN ncaa_player_ids i ON i.season = ${c('season', 'INTEGER')}
       AND i.ncaa_player_id = ${c('player_id', 'VARCHAR')}
     ${stored.join}
     WHERE ${c('player_id', 'VARCHAR')} IS NOT NULL AND ${off} + ${def} > 0
       AND coalesce(${c('estimand', 'VARCHAR')}, 'league') = 'league'`
  )
}

const TEAM_RAPM_COLUMNS = [
  'ncaa_trapm_off_w',
  'ncaa_trapm_def_w',
  'ncaa_trapm_w',
  'ncaa_trapm_poss'
]

function teamRapmSql(have: Have): string {
  const t = 'src_ncaa_rapm_within_team'
  const table = 'pub_player_ncaa_rapm_team'
  if (!have.tables.has(t)) return create(table, empty('player_id', TEAM_RAPM_COLUMNS))
  const c = (n: string, type = 'DOUBLE'): string => column(have, t, 's', n, type)
  const poss = c('team_off_poss')
  const stored = storedType(have, playerKey(have, t), c('season', 'INTEGER'))
  return create(
    table,
    `SELECT ${playerKey(have, t)} AS player_id, ${c('season', 'INTEGER')} AS season,
            ${stored.type} AS game_type, NULL::DOUBLE AS games, NULL::DOUBLE AS minutes,
            ${poss} AS possessions,
            ${times(c('rapm_off'), poss)} AS ncaa_trapm_off_w, ${times(c('rapm_def'), poss)} AS ncaa_trapm_def_w,
            ${times(c('rapm_net'), poss)} AS ncaa_trapm_w, ${poss} AS ncaa_trapm_poss
     FROM ${t} s
     LEFT JOIN ncaa_player_ids i ON i.season = ${c('season', 'INTEGER')}
       AND i.ncaa_player_id = ${c('player_id', 'VARCHAR')}
     ${stored.join}
     WHERE ${c('player_id', 'VARCHAR')} IS NOT NULL AND ${poss} > 0`
  )
}

/** The college leagues' published tables, appended to `PUBLISHED_TABLES`. */
export const COLLEGE_PUBLISHED_TABLES: readonly PublishedTable[] = [
  {
    table: 'pub_team_sdv_ratings',
    entity: 'team',
    source: 'src_ratings',
    games: 'games',
    minutes: null,
    columns: RATING_COLUMNS,
    sql: ratingsSql,
    everyGame: true
  },
  {
    table: 'pub_player_sdv_bpm',
    entity: 'player',
    source: 'src_player_value',
    games: null,
    minutes: 'min',
    columns: BPM_COLUMNS,
    sql: bpmSql,
    everyGame: true
  },
  {
    table: 'pub_player_ncaa_rapm',
    entity: 'player',
    source: 'src_ncaa_rapm',
    games: null,
    minutes: null,
    possessions: 'off_poss',
    columns: RAPM_COLUMNS,
    sql: rapmSql,
    everyGame: true
  },
  {
    table: 'pub_player_ncaa_rapm_team',
    entity: 'player',
    source: 'src_ncaa_rapm_within_team',
    games: null,
    minutes: null,
    possessions: 'team_off_poss',
    columns: TEAM_RAPM_COLUMNS,
    sql: teamRapmSql,
    everyGame: true
  }
]
