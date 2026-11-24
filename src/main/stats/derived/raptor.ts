import type { Have } from './sql'
import { column } from './sql'

/**
 * FiveThirtyEight's RAPTOR (D54), from its four archived files. Each rate is published per 100
 * possessions, and a player's season is the possession-weighted mean of their rows by team and season
 * type (measured on all 19,159 player-seasons of the historical files), so the table stores each rate
 * times possessions and the engine divides when it reads: any season type, traded player or run of
 * seasons reads exactly (policy 3). WAR is a count and adds up.
 *
 * The total, its two ends, WAR, Predator and pace impact come from the historical by-team file, which
 * covers every season; the box-score and on/off parts from the modern one, from 2013-14 only, with
 * their own possessions, so a run of seasons crossing 2013-14 divides them by the seasons that have
 * them. The modern file's totals equal the historical file's on all 7,289 rows from 2014.
 *
 * The files key players by Basketball-Reference id and name, not by NBA id, and no crosswalk of the
 * dataset holds Basketball-Reference ids. So a player is linked as D46 links people, with no wrong
 * link tolerated (`nba-data-sources.md`, "RAPTOR"):
 *
 * 1. the same name in the same season, one candidate on each side, minutes within 6 % (or 10);
 * 2. for those still unlinked, the same last name in the same season, one candidate on each side,
 *    minutes within 1 % (or 2): a first name or nickname written differently (Steve and Steven Smith);
 * 3. an id linked to two of the other side's is dropped, both ways;
 * 4. a linked Basketball-Reference id carries its NBA id to the player's other seasons with a line in
 *    Metis: it is the same person, whatever their name or minutes that season.
 *
 * Who is not linked is left out of the table and counted by the check (`scripts/check-raptor.mjs`).
 */
export const RAPTOR_TABLE = 'pub_player_raptor'
export const RAPTOR_FIRST_SEASON = 1994
export const RAPTOR_LAST_SEASON = 2022
export const RAPTOR_MODERN_FIRST_SEASON = 2014

export const RAPTOR_SOURCES = {
  historicalPlayer: 'src_raptor_historical_player',
  historicalTeam: 'src_raptor_historical_team',
  modernPlayer: 'src_raptor_modern_player',
  modernTeam: 'src_raptor_modern_team'
} as const

/** The rates of the historical file, each stored times possessions, and the parts of the modern one. */
const HISTORICAL_RATES = {
  rp_off: 'raptor_offense',
  rp_def: 'raptor_defense',
  rp_total: 'raptor_total',
  rp_pred_off: 'predator_offense',
  rp_pred_def: 'predator_defense',
  rp_pred_total: 'predator_total',
  rp_pace: 'pace_impact'
} as const
const MODERN_RATES = {
  rp_box_off: 'raptor_box_offense',
  rp_box_def: 'raptor_box_defense',
  rp_box_total: 'raptor_box_total',
  rp_onoff_off: 'raptor_onoff_offense',
  rp_onoff_def: 'raptor_onoff_defense',
  rp_onoff_total: 'raptor_onoff_total'
} as const

/** The table's components: possessions, the rates times possessions and WAR. */
export const RAPTOR_COLUMNS = [
  'rp_poss',
  ...Object.keys(HISTORICAL_RATES),
  'rp_war',
  'rp_mposs',
  ...Object.keys(MODERN_RATES)
] as const

/** A name compared without accents, case, punctuation or a generational suffix. */
const nameKey = (x: string): string =>
  `trim(regexp_replace(regexp_replace(regexp_replace(lower(strip_accents(coalesce(${x}, ''))),
     '[^a-z ]', '', 'g'), '\\s+', ' ', 'g'), ' (jr|sr|ii|iii|iv|v)$', ''))`

/** A season type as Metis names it. */
const typeSql = (x: string): string =>
  `CASE upper(${x}) WHEN 'RS' THEN 'regular' WHEN 'PO' THEN 'playoffs' END`

/** One source's rows added up per player, season and season type, its rates weighted by possessions. */
function byType(
  have: Have,
  table: string,
  rates: Readonly<Record<string, string>>,
  poss: string,
  extra = ''
): string {
  const c = (n: string, type = 'DOUBLE'): string => column(have, table, 's', n, type)
  return `SELECT ${c('player_id', 'VARCHAR')} AS bref, ${c('season', 'INTEGER')} AS season,
      ${typeSql(c('season_type', 'VARCHAR'))} AS game_type, sum(${c('poss')}) AS ${poss},
      sum(${c('mp')}) AS mp,
      ${Object.entries(rates)
        .map(([name, src]) => `sum(${c(src)} * ${c('poss')}) AS ${name}`)
        .join(', ')}${extra}
    FROM ${have.tables.has(table) ? table : '(SELECT 1)'} s
    WHERE ${c('season', 'INTEGER')} BETWEEN ${RAPTOR_FIRST_SEASON} AND ${RAPTOR_LAST_SEASON}
    GROUP BY 1, 2, 3`
}

const EMPTY = `CREATE OR REPLACE TABLE ${RAPTOR_TABLE} AS
  SELECT NULL::BIGINT AS player_id, NULL::INTEGER AS season, NULL::VARCHAR AS game_type,
         NULL::DOUBLE AS games, NULL::DOUBLE AS minutes, NULL::DOUBLE AS possessions,
         ${RAPTOR_COLUMNS.map((c) => `NULL::DOUBLE AS ${c}`).join(', ')},
         NULL::VARCHAR AS bref_id, NULL::VARCHAR AS link
  WHERE false`

/** The table, from the by-team files and the players linked to Metis's ids. */
export function raptorSql(have: Have): string {
  const needed = [RAPTOR_SOURCES.historicalPlayer, RAPTOR_SOURCES.historicalTeam, 'player_season']
  if (!needed.every((t) => have.tables.has(t)) || !have.tables.has('player')) return EMPTY
  const hp = RAPTOR_SOURCES.historicalPlayer
  const c = (n: string, type = 'DOUBLE'): string => column(have, hp, 's', n, type)
  const near = (a: string, b: string, share: number, floor: number): string =>
    `abs(${a} - ${b}) <= greatest(${floor}, ${share} * ${a})`
  const lastName = (x: string): string => `regexp_extract(${x}, '([a-z]+)$', 1)`
  return `CREATE OR REPLACE TABLE ${RAPTOR_TABLE} AS
    WITH r AS (
      SELECT ${c('player_id', 'VARCHAR')} AS bref, ${c('season', 'INTEGER')} AS season,
             ${c('mp')} AS mp, ${nameKey(c('player_name', 'VARCHAR'))} AS k
      FROM ${hp} s
      WHERE ${c('season', 'INTEGER')} BETWEEN ${RAPTOR_FIRST_SEASON} AND ${RAPTOR_LAST_SEASON}
        AND ${c('player_id', 'VARCHAR')} IS NOT NULL
    ),
    -- Metis's season lines, regular season and playoffs together as the by-player file counts them.
    m AS (
      SELECT ps.player_id, ps.season, sum(ps.minutes) AS mp, ${nameKey('p.name')} AS k
      FROM player_season ps JOIN player p USING (player_id)
      WHERE ps.team_id IS NULL AND ps.game_type IN ('regular', 'playoffs')
        AND ps.season BETWEEN ${RAPTOR_FIRST_SEASON} AND ${RAPTOR_LAST_SEASON}
      GROUP BY ps.player_id, ps.season, p.name
    ),
    c1 AS (
      SELECT r.bref, m.player_id, r.season FROM r JOIN m ON m.k = r.k AND m.season = r.season
      WHERE r.k <> '' AND ${near('r.mp', 'm.mp', 0.06, 10)}
    ),
    p1 AS (
      SELECT * FROM c1
      QUALIFY count(*) OVER (PARTITION BY bref, season) = 1
          AND count(*) OVER (PARTITION BY player_id, season) = 1
    ),
    i1 AS (
      SELECT bref, min(player_id) AS player_id FROM p1 GROUP BY bref
      HAVING count(DISTINCT player_id) = 1
      QUALIFY count(*) OVER (PARTITION BY min(player_id)) = 1
    ),
    c2 AS (
      SELECT r.bref, m.player_id, r.season FROM r JOIN m
        ON m.season = r.season AND ${lastName('m.k')} = ${lastName('r.k')}
      WHERE ${lastName('r.k')} <> '' AND ${near('r.mp', 'm.mp', 0.01, 2)}
        AND r.bref NOT IN (SELECT bref FROM i1) AND m.player_id NOT IN (SELECT player_id FROM i1)
    ),
    p2 AS (
      SELECT * FROM c2
      QUALIFY count(*) OVER (PARTITION BY bref, season) = 1
          AND count(*) OVER (PARTITION BY player_id, season) = 1
    ),
    i2 AS (
      SELECT bref, min(player_id) AS player_id FROM p2 GROUP BY bref
      HAVING count(DISTINCT player_id) = 1
      QUALIFY count(*) OVER (PARTITION BY min(player_id)) = 1
    ),
    ids AS (SELECT * FROM i1 UNION ALL SELECT * FROM i2),
    -- Each season of a linked player, and how that season was linked.
    linked AS (
      SELECT r.bref, r.season, ids.player_id,
             CASE WHEN p1.bref IS NOT NULL THEN 'name'
                  WHEN p2.bref IS NOT NULL THEN 'last name and minutes'
                  ELSE 'carried' END AS link
      FROM r JOIN ids USING (bref)
      JOIN m ON m.player_id = ids.player_id AND m.season = r.season
      LEFT JOIN p1 ON p1.bref = r.bref AND p1.season = r.season
      LEFT JOIN p2 ON p2.bref = r.bref AND p2.season = r.season
    ),
    h AS (${byType(have, RAPTOR_SOURCES.historicalTeam, HISTORICAL_RATES, 'poss', `, sum(${column(have, RAPTOR_SOURCES.historicalTeam, 's', 'war_total', 'DOUBLE')}) AS war`)}),
    mo AS (${byType(have, RAPTOR_SOURCES.modernTeam, MODERN_RATES, 'mposs')})
    SELECT l.player_id::BIGINT AS player_id, h.season, h.game_type,
           NULL::DOUBLE AS games, h.mp::DOUBLE AS minutes, h.poss::DOUBLE AS possessions,
           h.poss::DOUBLE AS rp_poss,
           ${Object.keys(HISTORICAL_RATES)
             .map((n) => `h.${n}`)
             .join(', ')},
           h.war AS rp_war, mo.mposs::DOUBLE AS rp_mposs,
           ${Object.keys(MODERN_RATES)
             .map((n) => `mo.${n}`)
             .join(', ')},
           l.bref AS bref_id, l.link
    FROM h JOIN linked l ON l.bref = h.bref AND l.season = h.season
    LEFT JOIN mo ON mo.bref = h.bref AND mo.season = h.season AND mo.game_type = h.game_type
    WHERE h.game_type IS NOT NULL`
}
