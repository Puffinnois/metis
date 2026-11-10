import {
  LINEUP_GROUPS,
  LINEUP_STORED,
  LINEUPS_FIRST_SEASON,
  type LineupGroup
} from '@shared/stats/lineups'
import { column, gameType, type Have } from './sql'

/**
 * The NBA's five-man units, one row per team, season, season type and set of five players. The team
 * dashboard's Lineups tab reads it; it is no player or team metric, so the query engine never sees it.
 *
 * Each of the six lineup dashboards is a list of units. They are not the same list: the NBA publishes
 * the 2,000 units of a regular season that rank first under each file's own sort, so the base, misc
 * and opponent files agree, the advanced and four-factors files differ at the cut-off, and the
 * scoring file lists other units altogether (`nba-data-sources.md`). So the table holds every unit any
 * file lists, and a measure a file does not list for a unit reads NULL.
 *
 * A unit is keyed by its five player ids in ascending order. The sources already write the id that
 * way (checked on every row), but the key is sorted here anyway, so it never depends on that.
 */
export const LINEUPS = 'pub_lineups'

const source = (group: LineupGroup): string => `src_dash_lineups_${group}`

/** The files whose `min` is the unit's total minutes; in the others it is a per-game average. */
const TOTAL_MINUTES: ReadonlySet<LineupGroup> = new Set(['base', 'misc', 'opponent'])

/** The order in which a file's games, minutes and names are taken when several list the unit. */
const PRECEDENCE: LineupGroup[] = ['base', 'advanced', 'misc', 'opponent', 'fourfactors', 'scoring']

const PLAYERS = ['p1', 'p2', 'p3', 'p4', 'p5']

export function lineupsBootstrap(): string[] {
  const numbers = ['games', 'minutes', ...LINEUP_STORED.map((c) => c.id)]
  return [
    `CREATE TABLE IF NOT EXISTS ${LINEUPS} (
       season INTEGER, game_type VARCHAR, team_id BIGINT,
       ${PLAYERS.map((p) => `${p} BIGINT`).join(', ')}, names VARCHAR,
       ${numbers.map((c) => `${c} DOUBLE`).join(', ')})`,
    ...numbers.map((c) => `ALTER TABLE ${LINEUPS} ADD COLUMN IF NOT EXISTS ${c} DOUBLE`)
  ]
}

/**
 * One dashboard's units, sorted ids and all. A row whose id does not hold five players is left out.
 * What the file lacks (a missing table or column) reads as NULL, and no rows.
 */
function unitsOf(group: LineupGroup, have: Have): string {
  const table = source(group)
  const held = have.tables.has(table)
  const num = (name: string): string => column(have, table, 's', name, 'DOUBLE')
  const season = column(have, table, 's', 'season')
  const ids = `list_sort(list_transform(
    list_filter(string_split(${column(have, table, 's', 'group_id', 'VARCHAR')}, '-'), x -> x <> ''),
    x -> TRY_CAST(x AS BIGINT)))`
  const minutes = TOTAL_MINUTES.has(group)
    ? `coalesce(${num('sum_time_played')} / 3000.0, ${num('min')})`
    : `${num('sum_time_played')} / 3000.0`
  const stored = LINEUP_STORED.filter((c) => c.group === group)
  const where = [
    `${gameType(column(have, table, 's', 'season_type', 'VARCHAR'))} IS NOT NULL`,
    `${season} >= ${LINEUPS_FIRST_SEASON}`
  ]
  // The dashboards also list pairs, triples and fours: T904's, not these.
  if (have.columns.get(table)?.has('group_quantity')) where.push('s.group_quantity = 5')
  const type = gameType(column(have, table, 's', 'season_type', 'VARCHAR'))
  const team = column(have, table, 's', 'team_id', 'BIGINT')
  return `SELECT * EXCLUDE (n, broken, rn) FROM (
    SELECT ${season} AS season, ${type} AS game_type, ${team} AS team_id,
           ${PLAYERS.map((p, i) => `ids[${i + 1}] AS ${p}`).join(', ')}, len(ids) AS n,
           list_bool_or(list_transform(ids, x -> x IS NULL)) AS broken,
           ${column(have, table, 's', 'group_name', 'VARCHAR')} AS names,
           ${num('gp')} AS games, ${minutes} AS minutes,
           ${stored.map((c) => `${num(c.source ?? c.id)} AS ${c.id}`).join(', ')},
           row_number() OVER (PARTITION BY ${season}, ${type}, ${team}, ids
                              ORDER BY ${num('sum_time_played')} DESC NULLS LAST) AS rn
    FROM (SELECT s.*, ${ids} AS ids FROM ${held ? table : '(SELECT 1)'} s
          WHERE ${held ? where.join(' AND ') : 'false'}) s
  ) WHERE rn = 1 AND n = 5 AND NOT broken`
}

/** The table: every unit any of the six files lists, each measure from its own file. */
export function lineupsSql(have: Have): string {
  const key = ['season', 'game_type', 'team_id', ...PLAYERS]
  const alias = (g: LineupGroup): string => `g_${g}`
  const join = (g: LineupGroup): string =>
    `LEFT JOIN ${alias(g)} ON ${key.map((k) => `${alias(g)}.${k} = k.${k}`).join(' AND ')}`
  const first = (field: string): string =>
    `coalesce(${PRECEDENCE.map((g) => `${alias(g)}.${field}`).join(', ')})`
  const stored = LINEUP_STORED.map((c) => `${alias(c.group)}.${c.id} AS ${c.id}`)
  return `CREATE OR REPLACE TABLE ${LINEUPS} AS
    WITH ${LINEUP_GROUPS.map((g) => `${alias(g.id)} AS (${unitsOf(g.id, have)})`).join(',\n')},
    k AS (${LINEUP_GROUPS.map((g) => `SELECT ${key.join(', ')} FROM ${alias(g.id)}`).join(' UNION ')})
    SELECT ${key.map((c) => `k.${c}`).join(', ')}, ${first('names')} AS names,
           ${first('games')} AS games, ${first('minutes')} AS minutes, ${stored.join(', ')}
    FROM k ${LINEUP_GROUPS.map((g) => join(g.id)).join(' ')}`
}
