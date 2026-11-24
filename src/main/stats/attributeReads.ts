import type { League } from '@shared/leagues'
import { ATTRIBUTE_BY_ID, ATTRIBUTE_VALUES_MAX } from '@shared/stats/attributes'
import type { StatsAttributeValue } from '@shared/stats/types'
import type { StatsDb } from './db'
import { inspect } from './derived/sql'

/**
 * The values a text or enumeration attribute holds for the seasons in scope (T1701.2, D51), each with
 * how many rows hold it, most first: what the Filters control offers for "any of" and "none of", so a
 * reader picks a country or a school rather than spelling it. A player's attribute counts the players
 * with a counted game in those seasons; one that changes by season counts their player-seasons; a
 * team's counts its team-seasons, Division I alone in the colleges, as their boards list. A table not
 * built yet, or an attribute that is not text, reads as nothing.
 */
export async function readAttributeValues(
  db: StatsDb,
  attribute: string,
  seasons: number[],
  league: League
): Promise<StatsAttributeValue[]> {
  const a = ATTRIBUTE_BY_ID.get(attribute)
  if (!a || (a.type !== 'text' && a.type !== 'enum')) return []
  const years = [...new Set(seasons)].filter(
    (s) => Number.isInteger(s) && s >= league.firstSeason && s <= 2100
  )
  if (years.length === 0 || years.length > 200) return []
  const have = await inspect(db)
  const table = {
    player: 'player_attributes',
    playerSeason: 'player_season_attributes',
    team: 'team_attributes'
  }[a.table]
  if (!have.columns.get(table)?.has(a.column) || !have.tables.has('player_season')) return []
  const list = years.join(', ')
  const counted = league.countedTypes.map((t) => `'${t}'`).join(', ')
  const played = `SELECT DISTINCT player_id, season FROM player_season
                  WHERE team_id IS NULL AND season IN (${list}) AND game_type IN (${counted})`
  // The column is the registry's, never the screen's: no text from a request reaches the SQL.
  const sql =
    a.table === 'player'
      ? `SELECT x.${a.column} AS value, count(*) AS n FROM player_attributes x
         WHERE x.player_id IN (SELECT player_id FROM (${played})) AND x.${a.column} IS NOT NULL
         GROUP BY 1`
      : a.table === 'playerSeason'
        ? `SELECT x.${a.column} AS value, count(*) AS n FROM player_season_attributes x
           JOIN (${played}) p ON p.player_id = x.player_id AND p.season = x.season
           WHERE x.${a.column} IS NOT NULL GROUP BY 1`
        : `SELECT x.${a.column} AS value, count(*) AS n FROM team_attributes x
           WHERE x.season IN (${list}) AND x.${a.column} IS NOT NULL
             AND EXISTS (SELECT 1 FROM team_season s WHERE s.team_id = x.team_id AND s.season = x.season)
             ${have.columns.get('team_attributes')?.has('division_i') ? 'AND coalesce(x.division_i, true)' : ''}
           GROUP BY 1`
  const rows = await db.all<{ value: string; n: number }>(
    `${sql} ORDER BY n DESC, value LIMIT ${ATTRIBUTE_VALUES_MAX}`
  )
  return rows.map((r) => ({ value: String(r.value), rows: Number(r.n) }))
}
