import { coachRole, isInjuryReason } from '@shared/stats/availability'
import type { StatsAvailability, StatsCoach, StatsOfficial } from '@shared/stats/types'
import type { StatsDb } from './db'
import { column, inspect, type Have } from './derived/sql'

/**
 * Three small reads beside the engine: a player's status on the latest official injury report, a
 * team's coaches for a season, and the officials of a game. Each reads its source's rows as
 * published, and a table not loaded reads as nothing.
 */

const REPORT = 'src_nba_injury_report'

const ID = /^-?[0-9]{1,12}$/

const trimmed = (have: Have, table: string, name: string): string =>
  `nullif(trim(${column(have, table, 's', name, 'VARCHAR')}), '')`

/**
 * Each player's status on their team's latest report of the current season: the newest report that
 * lists at least one player, since a report still "not yet submitted" lists nobody. A player the
 * latest report does not list has no status, whatever an older report said. This is what the report
 * published, never a forecast of whether they play.
 */
export async function readAvailability(db: StatsDb, ids: string[]): Promise<StatsAvailability[]> {
  const keys = [...new Set(ids.filter((id) => ID.test(id)).map(Number))]
  const have = await inspect(db)
  const held = have.columns.get(REPORT)
  const needs = ['season', 'team_id', 'person_id', 'report_datetime', 'current_status']
  if (keys.length === 0 || !needs.every((c) => held?.has(c))) return []
  const rows = await db.all<{
    player_id: number
    status: string
    reason: string | null
    category: string | null
    report_date: string
    game_date: string | null
    game_id: string | null
  }>(
    `WITH listed AS (
       SELECT TRY_CAST(s.season AS INTEGER) AS season, TRY_CAST(s.team_id AS BIGINT) AS team_id,
              TRY_CAST(s.person_id AS BIGINT) AS player_id,
              TRY_CAST(s.report_datetime AS TIMESTAMP) AS reported,
              ${trimmed(have, REPORT, 'current_status')} AS status,
              ${trimmed(have, REPORT, 'reason')} AS reason,
              ${trimmed(have, REPORT, 'category')} AS category,
              ${column(have, REPORT, 's', 'game_date', 'DATE')} AS game_date,
              ${trimmed(have, REPORT, 'game_id')} AS game_id
       FROM ${REPORT} s
     ), current AS (
       SELECT * FROM listed
       WHERE player_id IS NOT NULL AND status IS NOT NULL AND reported IS NOT NULL
         AND season = (SELECT max(season) FROM listed WHERE player_id IS NOT NULL)
     ), newest AS (
       SELECT team_id, max(reported) AS reported FROM current GROUP BY team_id
     )
     SELECT c.player_id, c.status, c.reason, c.category, c.reported::DATE::VARCHAR AS report_date,
            c.game_date::VARCHAR AS game_date, c.game_id
     FROM current c JOIN newest n ON n.team_id = c.team_id AND n.reported = c.reported
     WHERE c.player_id IN (${keys.map(() => '?').join(', ')})
     QUALIFY row_number() OVER (PARTITION BY c.player_id ORDER BY c.game_date DESC NULLS LAST) = 1`,
    keys
  )
  return rows.map((r) => ({
    playerId: String(r.player_id),
    status: r.status,
    reason: r.reason && r.reason !== '-' ? r.reason : null,
    injury: isInjuryReason(r.category, r.reason),
    reportDate: r.report_date,
    gameDate: r.game_date,
    gameId: r.game_id
  }))
}

/**
 * A team's staff for a season, from the NBA's coach file: head coaches first, then assistants in the
 * file's order. The file gives no dates, so a season with two head coaches lists both. Some teams have
 * no row for a season (28 of 30 teams in 2025-26), which reads as an empty list, not as no coach.
 */
export async function readCoaches(
  db: StatsDb,
  team: string,
  season: number
): Promise<StatsCoach[]> {
  const t = 'src_nba_coaches'
  const have = await inspect(db)
  const held = have.columns.get(t)
  if (!ID.test(team) || !Number.isInteger(season) || !held?.has('team_id')) return []
  const rows = await db.all<{
    coach_id: number | null
    name: string | null
    title: string | null
    order: number | null
  }>(
    `SELECT TRY_CAST(s.coach_id AS BIGINT) AS coach_id,
            coalesce(${trimmed(have, t, 'coach_name')},
                     nullif(trim(concat_ws(' ', ${trimmed(have, t, 'first_name')}, ${trimmed(have, t, 'last_name')})), '')) AS name,
            ${trimmed(have, t, 'coach_type')} AS title,
            ${column(have, t, 's', 'sort_sequence', 'INTEGER')} AS "order"
     FROM ${t} s
     WHERE TRY_CAST(s.team_id AS BIGINT) = ? AND TRY_CAST(s.season AS INTEGER) = ?`,
    [Number(team), season]
  )
  const coaches: StatsCoach[] = []
  for (const r of rows) {
    const role = coachRole(r.title)
    if (role && r.name) {
      coaches.push({
        id: r.coach_id === null ? r.name : String(r.coach_id),
        name: r.name,
        title: r.title ?? '',
        role
      })
    }
  }
  // Head coaches first, then the file's order for the rest, and a name as the last tie-break.
  const order = new Map(
    rows.map((r) => [r.coach_id === null ? r.name : String(r.coach_id), r.order ?? 999])
  )
  return coaches.sort(
    (a, b) =>
      Number(b.role === 'head') - Number(a.role === 'head') ||
      (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) ||
      a.name.localeCompare(b.name)
  )
}

/** The officials of a game, from the NBA's file by the game's NBA id; none before it keeps them. */
export async function readOfficials(db: StatsDb, gameId: string): Promise<StatsOfficial[]> {
  const t = 'src_nba_officials'
  const have = await inspect(db)
  if (!have.tables.has(t) || !have.tables.has('game')) return []
  const rows = await db.all<{ id: number; first: string | null; last: string | null }>(
    `SELECT DISTINCT TRY_CAST(s.official_id AS BIGINT) AS id,
            ${trimmed(have, t, 'first_name')} AS first, ${trimmed(have, t, 'last_name')} AS last
     FROM ${t} s JOIN game g ON g.nba_game_id = s.game_id
     WHERE g.game_id = ?`,
    [gameId]
  )
  return rows
    .map((r) => ({ id: String(r.id), name: [r.first, r.last].filter(Boolean).join(' ') }))
    .filter((o) => o.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name))
}
