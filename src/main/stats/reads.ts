import type {
  GameSide,
  GameType,
  StatsGame,
  StatsGameDetail,
  StatsPlayerInfo,
  StatsStanding
} from '@shared/stats/types'
import type { StatsDb } from './db'
import { column, inspect, type Have } from './derived/sql'

/**
 * What the dashboards read beside the query engine: who a player is, the schedule, a game's facts and
 * the published standings. Each is a plain read of one thing, and a table not loaded yet reads as
 * nothing, so a screen can say what is missing.
 */

/** A published text column, trimmed: the source pads some with spaces and leaves others empty. */
const text = (have: Have, table: string, alias: string, name: string): string =>
  `nullif(trim(${column(have, table, alias, name, 'VARCHAR')}), '')`

export async function readPlayer(db: StatsDb, id: string): Promise<StatsPlayerInfo | null> {
  const have = await inspect(db)
  if (!have.tables.has('player') || !/^-?[0-9]{1,12}$/.test(id)) return null
  const key = Number(id)
  const person = await db.get<{ name: string }>('SELECT name FROM player WHERE player_id = ?', [
    key
  ])
  if (!person) return null
  const seasons = have.tables.has('player_season')
    ? await db.all<{
        season: number
        position: string | null
        team_id: number | null
        code: string | null
      }>(
        `WITH s AS (
           SELECT season, mode(position) AS position, arg_max(last_team_id, last_date) AS team_id
           FROM player_season
           WHERE player_id = ? AND team_id IS NULL AND game_type NOT IN ('all-star', 'preseason')
           GROUP BY 1
         )
         SELECT s.season, s.position, s.team_id, t.code
         FROM s LEFT JOIN team t ON t.team_id = s.team_id AND t.season = s.season
         ORDER BY s.season`,
        [key]
      )
    : []
  const r = 'src_nba_rosters'
  const roster = have.tables.has(r)
    ? await db.get<{
        number: string | null
        height: string | null
        weight: string | null
        birth_date: string | null
        school: string | null
      }>(
        `SELECT ${text(have, r, 'r', 'num')} AS number, ${text(have, r, 'r', 'height')} AS height,
                ${text(have, r, 'r', 'weight')} AS weight,
                ${text(have, r, 'r', 'birth_date')} AS birth_date,
                ${text(have, r, 'r', 'school')} AS school
         FROM ${r} r WHERE r.player_id = ? ORDER BY r.season DESC LIMIT 1`,
        [key]
      )
    : null
  const latest = seasons.at(-1)
  return {
    id,
    name: person.name,
    position: seasons.findLast((s) => s.position)?.position ?? null,
    team: latest?.team_id ? { id: String(latest.team_id), code: latest.code } : null,
    seasons: seasons.map((s) => s.season),
    number: roster?.number ?? null,
    height: roster?.height ?? null,
    weight: roster?.weight ?? null,
    birthDate: roster?.birth_date ?? null,
    school: roster?.school ?? null
  }
}

interface GameRow {
  game_id: string
  season: number
  game_type: GameType
  date: string
  played: boolean
  has_box: boolean
  overtimes: number | null
  home_id: number | null
  home_code: string | null
  home_name: string | null
  home_score: number | null
  away_id: number | null
  away_code: string | null
  away_name: string | null
  away_score: number | null
}

const side = (
  id: number | null,
  code: string | null,
  name: string | null,
  score: number | null,
  played: boolean
): GameSide => ({
  id: id === null ? null : String(id),
  code: code ?? 'TBD',
  name: name ?? code ?? 'To be decided',
  score: played ? score : null
})

/**
 * A season's schedule. A side with no row in `team` is an All-Star team or a touring club, so its
 * name comes from the schedule that lists it. Overtime is read from the team's minutes: 240 in
 * regulation and 25 more per period.
 */
export async function readGames(db: StatsDb, season: number): Promise<StatsGame[]> {
  const have = await inspect(db)
  if (!have.tables.has('game') || !have.tables.has('team_game')) return []
  const n = 'src_nba_schedule'
  const e = 'src_espn_schedule'
  const nba = have.tables.has(n)
    ? `SELECT game_id, any_value(home_team_abbreviation) AS home_code, any_value(home_team_name) AS home_name,
              any_value(away_team_abbreviation) AS away_code, any_value(away_team_name) AS away_name
       FROM ${n} WHERE season = $1 GROUP BY 1`
    : `SELECT NULL::VARCHAR AS game_id, NULL::VARCHAR AS home_code, NULL::VARCHAR AS home_name,
              NULL::VARCHAR AS away_code, NULL::VARCHAR AS away_name`
  const espn = have.tables.has(e)
    ? `SELECT game_id, any_value(home_abbreviation) AS home_code, any_value(home_display_name) AS home_name,
              any_value(away_abbreviation) AS away_code, any_value(away_display_name) AS away_name
       FROM ${e} WHERE game_id IN (SELECT espn_game_id FROM game WHERE season = $1) GROUP BY 1`
    : `SELECT NULL::BIGINT AS game_id, NULL::VARCHAR AS home_code, NULL::VARCHAR AS home_name,
              NULL::VARCHAR AS away_code, NULL::VARCHAR AS away_name`
  const rows = await db.all<GameRow>(
    `WITH box AS (
       SELECT game_id, sum(box_games) AS box, max(seconds) AS seconds FROM team_game
       WHERE season = $1 GROUP BY 1
     ), nba AS (${nba}), espn AS (${espn})
     SELECT g.game_id, g.season, g.game_type, g.game_date::VARCHAR AS date, g.played,
            coalesce(b.box, 0) > 0 AS has_box,
            CASE WHEN coalesce(b.box, 0) > 0
                 THEN greatest(0, round((b.seconds / 60.0 - 240) / 25))::INTEGER END AS overtimes,
            g.home_team_id AS home_id, coalesce(h.code, n.home_code, e.home_code) AS home_code,
            coalesce(h.name, n.home_name, e.home_name) AS home_name, g.home_score,
            g.away_team_id AS away_id, coalesce(a.code, n.away_code, e.away_code) AS away_code,
            coalesce(a.name, n.away_name, e.away_name) AS away_name, g.away_score
     FROM game g
     LEFT JOIN team h ON h.team_id = g.home_team_id AND h.season = g.season
     LEFT JOIN team a ON a.team_id = g.away_team_id AND a.season = g.season
     LEFT JOIN box b ON b.game_id = g.game_id
     LEFT JOIN nba n ON n.game_id = g.nba_game_id
     LEFT JOIN espn e ON e.game_id = g.espn_game_id
     WHERE g.season = $1
     ORDER BY g.game_date, g.game_id`,
    [season]
  )
  return rows.map((r) => ({
    id: r.game_id,
    season: r.season,
    type: r.game_type,
    date: r.date,
    played: r.played,
    hasBox: r.has_box,
    overtimes: r.overtimes,
    home: side(r.home_id, r.home_code, r.home_name, r.home_score, r.played),
    away: side(r.away_id, r.away_code, r.away_name, r.away_score, r.played)
  }))
}

/** ESPN writes a game's periods as text in Python's form: `[{'period': 1, 'value': 23.0} {…}]`. */
export function parsePeriods(published: string | null): number[] {
  if (!published) return []
  return [...published.matchAll(/'value': (-?[0-9.]+)/g)].map((m) => Number(m[1]))
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

export async function readGame(db: StatsDb, id: string): Promise<StatsGameDetail | null> {
  const have = await inspect(db)
  const e = 'src_espn_schedule'
  if (!have.tables.has('game') || !have.tables.has(e)) return null
  const r = await db.get<{
    venue: string | null
    city: string | null
    attendance: number | null
    note: string | null
    home_lines: string | null
    away_lines: string | null
    home_score: number | null
    away_score: number | null
  }>(
    `SELECT ${text(have, e, 'e', 'venue_full_name')} AS venue,
            ${text(have, e, 'e', 'venue_address_city')} AS city,
            ${column(have, e, 'e', 'attendance', 'DOUBLE')} AS attendance,
            ${text(have, e, 'e', 'notes_headline')} AS note,
            ${text(have, e, 'e', 'home_linescores')} AS home_lines,
            ${text(have, e, 'e', 'away_linescores')} AS away_lines,
            g.home_score, g.away_score
     FROM game g JOIN ${e} e ON e.game_id = g.espn_game_id
     WHERE g.game_id = ? LIMIT 1`,
    [id]
  )
  if (!r) return null
  const home = parsePeriods(r.home_lines)
  const away = parsePeriods(r.away_lines)
  // Periods that do not add up to the score would contradict the header, so they are not shown.
  const agree = home.length > 0 && sum(home) === r.home_score && sum(away) === r.away_score
  return {
    id,
    venue: r.venue,
    city: r.city,
    attendance: r.attendance && r.attendance > 0 ? r.attendance : null,
    note: r.note,
    periods: agree ? { home, away } : null
  }
}

/**
 * The published standings. The NBA's file is in the core tier and holds 1996-97 on; the league
 * dashboards' repeats it on every column read, and only it reaches 1995-96.
 */
export async function readStandings(db: StatsDb, season: number): Promise<StatsStanding[]> {
  const have = await inspect(db)
  for (const t of ['src_nba_standings', 'src_dash_standings']) {
    if (!have.tables.has(t)) continue
    const num = (name: string, type = 'INTEGER'): string => column(have, t, 's', name, type)
    const txt = (name: string): string => text(have, t, 's', name)
    const rows = await db.all<{
      team_id: number
      code: string | null
      name: string
      conference: string | null
      division: string | null
      conference_rank: number | null
      division_rank: number | null
      wins: number
      losses: number
      win_pct: number | null
      conference_gb: number | null
      division_gb: number | null
      home: string | null
      road: string | null
      conference_record: string | null
      division_record: string | null
      last10: string | null
      streak: string | null
      clinch: string | null
      ppg: number | null
      allowed: number | null
    }>(
      `SELECT s.team_id, tm.code,
              coalesce(nullif(trim(concat_ws(' ', ${txt('team_city')}, ${txt('team_name')})), ''), tm.name)
                AS name,
              ${txt('conference')} AS conference, ${txt('division')} AS division,
              ${num('playoff_rank')} AS conference_rank, ${num('division_rank')} AS division_rank,
              ${num('wins')} AS wins, ${num('losses')} AS losses,
              ${num('win_pct', 'DOUBLE')} AS win_pct,
              ${num('conference_games_back', 'DOUBLE')} AS conference_gb,
              ${num('division_games_back', 'DOUBLE')} AS division_gb,
              ${txt('home')} AS home, ${txt('road')} AS road,
              ${txt('conference_record')} AS conference_record,
              ${txt('division_record')} AS division_record,
              ${txt('l10')} AS last10, ${txt('str_current_streak')} AS streak,
              nullif(trim(ltrim(${column(have, t, 's', 'clinch_indicator', 'VARCHAR')}, ' -')), '') AS clinch,
              ${num('points_pg', 'DOUBLE')} AS ppg, ${num('opp_points_pg', 'DOUBLE')} AS allowed
       FROM ${t} s LEFT JOIN team tm ON tm.team_id = s.team_id AND tm.season = s.season
       WHERE s.season = ?
       ORDER BY conference, conference_rank`,
      [season]
    )
    if (rows.length > 0) {
      return rows.map((r) => ({
        teamId: String(r.team_id),
        code: r.code,
        name: r.name,
        conference: r.conference,
        division: r.division,
        conferenceRank: r.conference_rank,
        divisionRank: r.division_rank,
        wins: r.wins,
        losses: r.losses,
        winPct: r.win_pct,
        conferenceGamesBack: r.conference_gb,
        divisionGamesBack: r.division_gb,
        home: r.home,
        road: r.road,
        conferenceRecord: r.conference_record,
        divisionRecord: r.division_record,
        last10: r.last10,
        streak: r.streak,
        clinch: r.clinch,
        pointsPerGame: r.ppg,
        allowedPerGame: r.allowed
      }))
    }
  }
  return []
}
