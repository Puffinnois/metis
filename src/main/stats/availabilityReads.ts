import { coachRole, isInjuryReason } from '@shared/stats/availability'
import type {
  StatsAvailability,
  StatsCoach,
  StatsGameListing,
  StatsOfficial
} from '@shared/stats/types'
import type { StatsDb } from './db'
import { builds, type League } from '@shared/leagues'
import { playsRecipe } from './derived/playsRecipe'
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
 * The players' listings for these games (T1601.4): each player's status and reason on the last report
 * before each game, as the games-out counts take it (`pub_player_availability`), but kept by game with
 * the reason's words. Ids that are not ids name nobody; a league with no report reads as nothing.
 */
export async function readGameListings(
  db: StatsDb,
  games: string[],
  players: string[]
): Promise<StatsGameListing[]> {
  const gameIds = [...new Set(games.filter((g) => /^[0-9A-Za-z_-]{1,20}$/.test(g)))].slice(0, 200)
  const keys = [...new Set(players.filter((id) => ID.test(id)).map(Number))].slice(0, 500)
  const have = await inspect(db)
  const held = have.columns.get(REPORT)
  const needs = ['game_id', 'person_id', 'report_datetime', 'current_status']
  if (gameIds.length === 0 || keys.length === 0 || !needs.every((c) => held?.has(c))) return []
  const rows = await db.all<{
    game_id: string
    player_id: number
    status: string
    reason: string | null
  }>(
    `SELECT ${trimmed(have, REPORT, 'game_id')} AS game_id, TRY_CAST(s.person_id AS BIGINT) AS player_id,
            ${trimmed(have, REPORT, 'current_status')} AS status, ${trimmed(have, REPORT, 'reason')} AS reason
     FROM ${REPORT} s
     WHERE ${trimmed(have, REPORT, 'game_id')} IN (${gameIds.map(() => '?').join(', ')})
       AND TRY_CAST(s.person_id AS BIGINT) IN (${keys.map(() => '?').join(', ')})
       AND TRY_CAST(s.report_datetime AS TIMESTAMP) IS NOT NULL
     QUALIFY row_number() OVER (
       PARTITION BY game_id, player_id ORDER BY TRY_CAST(s.report_datetime AS TIMESTAMP) DESC) = 1`,
    [...gameIds, ...keys]
  )
  return rows
    .filter((r) => r.status !== null)
    .map((r) => ({
      gameId: String(r.game_id),
      playerId: String(r.player_id),
      status: r.status,
      reason: r.reason && r.reason !== '-' ? r.reason : null
    }))
}

/**
 * A team's staff for a season, from the league's coach file (the NBA's or the WNBA's, the same shape):
 * head coaches first, then assistants in the file's order. The file gives no dates, so a season with two head coaches lists both. Some teams have
 * no row for a season (28 of 30 teams in 2025-26), which reads as an empty list, not as no coach.
 */
/**
 * The coach files, one a league: a league's stats file holds its own alone (D36). A team keyed `-id` in
 * `team` (the 2026 Portland Fire, T1301.5) is `id` in the file.
 */
const COACHES = ['src_nba_coaches', 'src_wnba_coaches']

export async function readCoaches(
  db: StatsDb,
  team: string,
  season: number
): Promise<StatsCoach[]> {
  const have = await inspect(db)
  const t = COACHES.find((name) => have.columns.has(name)) ?? COACHES[0]
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
     WHERE TRY_CAST(s.team_id AS BIGINT) = abs(?::BIGINT) AND TRY_CAST(s.season AS INTEGER) = ?`,
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

/** The officials of a game, from the league's file by its game id; none before it keeps them. */
export async function readOfficials(
  db: StatsDb,
  gameId: string,
  league?: League
): Promise<StatsOfficial[]> {
  // A league whose plays are not built may name no plays recipe yet (the college leagues until
  // T1302.6), and its officials come with them.
  if (league && !builds(league, 'plays')) return []
  const t = playsRecipe(league).officials
  const have = await inspect(db)
  if (!have.tables.has(t) || !have.tables.has('game')) return []
  const rows = await db.all<{ id: number; first: string | null; last: string | null }>(
    `SELECT DISTINCT TRY_CAST(s.official_id AS BIGINT) AS id,
            ${trimmed(have, t, 'first_name')} AS first, ${trimmed(have, t, 'last_name')} AS last
     FROM ${t} s JOIN game g ON g.${playsRecipe(league).officialsGame ?? 'nba_game_id'} = s.game_id
     WHERE g.game_id = ?`,
    [gameId]
  )
  return rows
    .map((r) => ({ id: String(r.id), name: [r.first, r.last].filter(Boolean).join(' ') }))
    .filter((o) => o.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name))
}
