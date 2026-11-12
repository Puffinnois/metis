import {
  COURT,
  OFF_COURT,
  SHOT_BANDS,
  SHOT_TYPES,
  SHOT_ZONE_GROUPS,
  SHOT_ZONES
} from '@shared/stats/shots'
import { nbaShotsSelect } from './events'
import type { PlayBuilder } from './playBuilders'
import { PLAY_TABLES } from './plays'
import type { Have } from './sql'

/**
 * Shots by zone, distance band and type (reference section 7), counted per player-game and team-game
 * from the NBA's shot file, so the engine's game grain sums them under any filter and its season grain
 * adds a season's games. Counts only: every rate is divided when read (data policy 3).
 *
 * The NBA's shots are the source (`shot_nba`); ESPN's are another coordinate frame and are not read
 * here. A season before the shots start has no rows, and its metrics read null with their reason.
 * Built season by season through `PLAY_BUILDERS` (`playBuilders.ts`), after the play tables; a change
 * of rule bumps `PLAYS_VERSION` there.
 */

export const SHOT_PLAYER_GAME = 'shot_player_game'
export const SHOT_TEAM_GAME = 'shot_team_game'

type Dim = 'zone' | 'band' | 'type'

/** The buckets, each with the column of a classified shot it reads and the values it counts. */
const BUCKETS: ReadonlyArray<{ key: string; dim: Dim; of: readonly string[] }> = [
  ...SHOT_ZONES.map((z) => ({ key: z.key, dim: 'zone' as const, of: [z.key] })),
  ...SHOT_ZONE_GROUPS.map((g) => ({ key: g.key, dim: 'zone' as const, of: g.of })),
  ...SHOT_BANDS.map((b) => ({ key: b.key, dim: 'band' as const, of: [b.key] })),
  ...SHOT_TYPES.map((t) => ({ key: t.key, dim: 'type' as const, of: [t.key] }))
]

/**
 * What each bucket counts: attempts, makes, points, assisted makes, and the makes and points the
 * league's rate for that bucket would give the same attempts (`x`), for "relative to league". The `x`
 * counts are stored in thousandths of a make or a point, as integers: stored as doubles they were
 * three quarters of the tables' size (measured), and a thousandth is far below any rate's precision.
 */
export const EXPECTED_SCALE = 1000

const MEASURES = ['fga', 'fgm', 'pts', 'ast', 'xfgm', 'xpts'] as const

/**
 * The totals: every shot row, its threes, assisted makes, the distances (to average them), and the
 * points the league's rate by zone would give these attempts.
 */
const TOTALS = [
  'shots_fga',
  'shots_fgm',
  'shots_pts',
  'shots_fg3a',
  'shots_fg3m',
  'shots_ast',
  'dist_sum',
  'dist_n',
  'shots_xpts'
] as const

/** A table's counts, named as the catalogue reads them: `ra_fga`, `d24p_xpts`, `shots_fga`. */
export const SHOT_COMPONENTS: readonly string[] = [
  ...BUCKETS.flatMap((b) => MEASURES.map((m) => `${b.key}_${m}`)),
  ...TOTALS
]

/** The opponent's shots against a team: the same counts as `opp_ra_fga`, for defense by zone. */
export const OPP_SHOT_COMPONENTS: readonly string[] = SHOT_COMPONENTS.map((c) => `opp_${c}`)

/**
 * The counts that read 0 for a player or team with no shot in scope; the league-rate columns stay
 * NULL there, since a season with no league rate yet has no expectation to compare with.
 */
export const isZeroCount = (component: string): boolean => !/x(fgm|pts)$/.test(component)

type Columns = ReadonlyArray<readonly [string, string]>

const KEY_COLUMNS: Columns = [
  ['game_id', 'VARCHAR'],
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['game_date', 'DATE']
]

/** Every column, typed, in order: the key, the player or team, then the counts. */
export const SHOT_PLAYER_COLUMNS: Columns = [
  ...KEY_COLUMNS,
  ['player_id', 'BIGINT'],
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ...SHOT_COMPONENTS.map((c) => [c, 'INTEGER'] as const)
]
export const SHOT_TEAM_COLUMNS: Columns = [
  ...KEY_COLUMNS,
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ...[...SHOT_COMPONENTS, ...OPP_SHOT_COMPONENTS].map((c) => [c, 'INTEGER'] as const)
]

/** The tables, empty, created on every open so a query before the first build reads no rows. */
export function shotsBootstrap(): string[] {
  return (
    [
      [SHOT_PLAYER_GAME, SHOT_PLAYER_COLUMNS],
      [SHOT_TEAM_GAME, SHOT_TEAM_COLUMNS]
    ] as const
  ).map(
    ([t, cs]) => `CREATE TABLE IF NOT EXISTS ${t} (${cs.map(([n, ty]) => `${n} ${ty}`).join(', ')})`
  )
}

const sqlText = (s: string): string => `'${s.replaceAll("'", "''")}'`

/** `shotZone` in SQL, over a shot's `x`, `y` and `value`: the same rules, the same constants. */
export function zoneSql(x = 'x', y = 'y', value = 'value'): string {
  const r = `sqrt(${x} * ${x} + ${y} * ${y})`
  const three = `CASE WHEN ${value} IS NULL
      THEN (abs(${x}) >= ${COURT.cornerX} AND ${y} <= ${COURT.cornerTopY}) OR ${r} >= ${COURT.arcRadius}
      ELSE ${value} = 3 END`
  return `CASE
      WHEN ${x} IS NULL OR ${y} IS NULL OR isnan(${x}) OR isnan(${y}) OR isinf(${x}) OR isinf(${y})
        OR abs(${x}) > ${OFF_COURT.maxAbsX} OR ${y} < ${OFF_COURT.minY} OR ${y} > ${OFF_COURT.maxY}
        THEN 'unk'
      WHEN ${y} > ${COURT.halfCourtY} THEN 'back'
      WHEN ${three} THEN CASE WHEN ${y} <= ${COURT.cornerTopY}
                              THEN CASE WHEN ${x} < 0 THEN 'c3l' ELSE 'c3r' END
                              ELSE 'atb3' END
      WHEN ${r} <= ${COURT.restrictedRadius} THEN 'ra'
      WHEN abs(${x}) <= ${COURT.laneHalfWidth} AND ${y} <= ${COURT.laneTopY} THEN 'paint'
      ELSE 'mid' END`
}

/** `shotBand` in SQL: the published distance, else the coordinates' distance rounded to the foot. */
export function bandSql(distance = 'distance', x = 'x', y = 'y'): string {
  const feet = `coalesce(${distance}, round(sqrt(${x} * ${x} + ${y} * ${y}) / 10))`
  return `CASE ${SHOT_BANDS.map(
    (b) =>
      `WHEN ${feet} >= ${b.min}${b.max === null ? '' : ` AND ${feet} <= ${b.max}`} THEN ${sqlText(b.key)}`
  ).join(' ')} END`
}

/** `shotType` in SQL: the first pattern the text contains, ignoring case. */
export function typeSql(subtype = 'subtype'): string {
  const rules = SHOT_TYPES.filter((t) => t.pattern !== null).map(
    (t) =>
      `WHEN regexp_matches(${subtype}, ${sqlText(t.pattern ?? '')}, 'i') THEN ${sqlText(t.key)}`
  )
  return `CASE ${rules.join(' ')} ELSE 'other' END`
}

/**
 * Each count summed over a group of classified shots `c`; `prefix` names them for the opponent's side.
 * A bucket's league rates are `lg_<dim>_pct` and `lg_<dim>_pps` on each shot.
 */
const expected = (sum: string): string => `round(${EXPECTED_SCALE} * ${sum})::INTEGER`

function sums(prefix = ''): string[] {
  return [
    ...BUCKETS.flatMap(({ key, dim, of }) => {
      const where = `c.${dim} IN (${of.map(sqlText).join(', ')})`
      return [
        `count(*) FILTER (WHERE ${where})::INTEGER AS ${prefix}${key}_fga`,
        `count(*) FILTER (WHERE ${where} AND c.made)::INTEGER AS ${prefix}${key}_fgm`,
        `coalesce(sum(c.value) FILTER (WHERE ${where} AND c.made), 0)::INTEGER AS ${prefix}${key}_pts`,
        `count(*) FILTER (WHERE ${where} AND c.assisted)::INTEGER AS ${prefix}${key}_ast`,
        `${expected(`sum(c.lg_${dim}_pct) FILTER (WHERE ${where})`)} AS ${prefix}${key}_xfgm`,
        `${expected(`sum(c.lg_${dim}_pps) FILTER (WHERE ${where})`)} AS ${prefix}${key}_xpts`
      ]
    }),
    `count(*)::INTEGER AS ${prefix}shots_fga`,
    `count(*) FILTER (WHERE c.made)::INTEGER AS ${prefix}shots_fgm`,
    `coalesce(sum(c.value) FILTER (WHERE c.made), 0)::INTEGER AS ${prefix}shots_pts`,
    `count(*) FILTER (WHERE c.value = 3)::INTEGER AS ${prefix}shots_fg3a`,
    `count(*) FILTER (WHERE c.value = 3 AND c.made)::INTEGER AS ${prefix}shots_fg3m`,
    `count(*) FILTER (WHERE c.assisted)::INTEGER AS ${prefix}shots_ast`,
    `coalesce(sum(c.feet), 0)::INTEGER AS ${prefix}dist_sum`,
    `count(c.feet)::INTEGER AS ${prefix}dist_n`,
    `${expected('sum(c.lg_zone_pps)')} AS ${prefix}shots_xpts`
  ]
}

/**
 * One season's shots, classified, each with whether its make was assisted and the league's rates for
 * its zone, band and type.
 *
 * - **Shots:** the SELECT behind `shot_nba`, for this season only. The view itself is created after
 *   the builders have run, so on a new database it would still be empty here.
 * - **Assisted:** the make's row in `play_nba` names the assist; `play_nba` is built for the season
 *   before this builder runs. A make is found there by game, period, clock and shooter, which is
 *   unique for all but a handful of makes a season; where two makes share them, they pair in order,
 *   and both are the same shooter's at the same moment.
 * - **League rates:** the season's regular-season shots, by bucket: the share made and points per
 *   attempt. Every game type of the season is compared with them, so a playoff run reads against the
 *   league's season, not against the few teams left.
 */
function classifiedSql(have: Have, season: number): string {
  const plays = have.tables.has(PLAY_TABLES.nba)
    ? `SELECT game_id, period, clock, player_id, seq, assist_id
       FROM ${PLAY_TABLES.nba} WHERE season = ${season} AND fgm = 1`
    : `SELECT NULL::VARCHAR AS game_id, NULL::INTEGER AS period, NULL::DOUBLE AS clock,
              NULL::BIGINT AS player_id, NULL::INTEGER AS seq, NULL::BIGINT AS assist_id WHERE false`
  const key = 'game_id, period, clock, player_id'
  const rates = (dim: string): string => `lg_${dim} AS (
      SELECT ${dim}, avg(made::INTEGER) AS pct, avg(CASE WHEN made THEN value ELSE 0 END) AS pps
      FROM s WHERE game_type = 'regular' GROUP BY ${dim})`
  return `WITH s AS (
      SELECT game_id, season, game_type, game_date, team_id, opponent_id, player_id, period, clock,
             coalesce(made, false) AS made, value, distance, x, y,
             row_number() OVER () AS rid,
             ${zoneSql()} AS zone, ${bandSql()} AS band, ${typeSql()} AS type,
             coalesce(distance, round(sqrt(x * x + y * y) / 10)) AS feet
      FROM (${nbaShotsSelect(have, season)}) v),
    mk AS (SELECT rid, ${key},
                  row_number() OVER (PARTITION BY ${key} ORDER BY x, y, rid) AS k
           FROM s WHERE made),
    pl AS (SELECT ${key}, assist_id,
                  row_number() OVER (PARTITION BY ${key} ORDER BY seq) AS k
           FROM (${plays}) p),
    ast AS (SELECT mk.rid FROM mk JOIN pl USING (${key}, k) WHERE pl.assist_id IS NOT NULL),
    ${rates('zone')}, ${rates('band')}, ${rates('type')},
    c AS (
      SELECT s.*, ast.rid IS NOT NULL AS assisted,
             lz.pct AS lg_zone_pct, lz.pps AS lg_zone_pps,
             lb.pct AS lg_band_pct, lb.pps AS lg_band_pps,
             lt.pct AS lg_type_pct, lt.pps AS lg_type_pps
      FROM s LEFT JOIN ast USING (rid)
      LEFT JOIN lg_zone lz USING (zone) LEFT JOIN lg_band lb USING (band)
      LEFT JOIN lg_type lt USING (type))`
}

/** One season's player-games, as a SELECT of `SHOT_PLAYER_COLUMNS` in order. */
export function playerGameSql(have: Have, season: number): string {
  return `${classifiedSql(have, season)}
    SELECT c.game_id, any_value(c.season), any_value(c.game_type), any_value(c.game_date),
           c.player_id, c.team_id, any_value(c.opponent_id), ${sums().join(', ')}
    FROM c WHERE c.player_id IS NOT NULL
    GROUP BY c.game_id, c.player_id, c.team_id`
}

/** A side with no shot in a game took none: its counts read 0, its league expectations NULL. */
const side = (alias: string, c: string): string =>
  isZeroCount(c) ? `coalesce(${alias}.${c}, 0)` : `${alias}.${c}`

/** One season's team-games: the team's shots, and its opponent's against it. */
export function teamGameSql(have: Have, season: number): string {
  return `${classifiedSql(have, season)},
    own AS (SELECT c.game_id, c.team_id, any_value(c.opponent_id) AS opponent_id,
                   any_value(c.season) AS season, any_value(c.game_type) AS game_type,
                   any_value(c.game_date) AS game_date, ${sums().join(', ')}
            FROM c WHERE c.team_id IS NOT NULL GROUP BY c.game_id, c.team_id),
    opp AS (SELECT c.game_id, c.opponent_id AS team_id, any_value(c.team_id) AS opp_team,
                   any_value(c.season) AS season, any_value(c.game_type) AS game_type,
                   any_value(c.game_date) AS game_date, ${sums('opp_').join(', ')}
            FROM c WHERE c.opponent_id IS NOT NULL GROUP BY c.game_id, c.opponent_id)
    SELECT coalesce(own.game_id, opp.game_id), coalesce(own.season, opp.season),
           coalesce(own.game_type, opp.game_type), coalesce(own.game_date, opp.game_date),
           coalesce(own.team_id, opp.team_id), coalesce(own.opponent_id, opp.opp_team),
           ${SHOT_COMPONENTS.map((c) => side('own', c)).join(', ')},
           ${OPP_SHOT_COMPONENTS.map((c) => side('opp', c)).join(', ')}
    FROM own FULL JOIN opp ON opp.game_id = own.game_id AND opp.team_id = own.team_id`
}

/** The builders `PLAY_BUILDERS` runs, after the play tables, one season at a time. */
export const SHOT_BUILDERS: readonly PlayBuilder[] = [
  { table: SHOT_PLAYER_GAME, columns: SHOT_PLAYER_COLUMNS, select: playerGameSql },
  { table: SHOT_TEAM_GAME, columns: SHOT_TEAM_COLUMNS, select: teamGameSql }
]
