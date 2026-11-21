import { StatsDb } from '@main/stats/db'
import { NAME_MACRO } from '@main/stats/links/sql'
import { linksBootstrap } from '@main/stats/links/tables'

/**
 * Small links-file fixtures for D46's matcher, from the research's own cases (`player-links.md`): an id
 * link, a namesake, a second ESPN id, a draftee who has not played, a player drafted from abroad, a
 * college career that starts after the draft, and two candidates. Ids are made up; names are the
 * research's examples.
 */
export interface ProPlayer {
  pro_id: number
  name: string
  espn: number | null
  first_season: number | null
  dob: string | null
  espn_college_id: number | null
  school: string | null
}
export interface CollegePlayer {
  col_id: number
  name: string
  espn: number | null
  first_season: number
  last_season: number
  dob: string | null
  teams: number[]
  team_names: string[]
}
export interface DraftLine {
  pro_id: number
  name: string
  label: number
  round: number
  round_pick: number
  overall_pick: number
  team: string
  organization: string | null
  organization_type: string | null
}

export const NBA_PLAYERS: ProPlayer[] = [
  // The id: the same ESPN id on both sides.
  { pro_id: 9001, name: 'Paolo Banchero', espn: 101, first_season: 2023, dob: '2002-11-12', espn_college_id: 150, school: 'Duke' },
  // A namesake in college: the id picks the right Brandon Miller.
  { pro_id: 9002, name: 'Brandon Miller', espn: 102, first_season: 2024, dob: '2002-11-22', espn_college_id: 333, school: 'Alabama' },
  // A second ESPN id: name and birth date.
  { pro_id: 9003, name: 'Jalen Hood-Schifino', espn: 4433626, first_season: 2024, dob: '2003-06-19', espn_college_id: 84, school: 'Indiana' },
  // Drafted from abroad, with a namesake in college: no link.
  { pro_id: 9005, name: 'Tyler Smith', espn: 9905, first_season: 2025, dob: '2004-10-01', espn_college_id: null, school: null },
  // An undrafted player whose college seasons are before the window.
  { pro_id: 9007, name: 'Alex Reese', espn: 9907, first_season: 2022, dob: '1999-03-01', espn_college_id: 333, school: 'Alabama' }
]

export const NBA_DRAFT: DraftLine[] = [
  { pro_id: 9001, name: 'Paolo Banchero', label: 2023, round: 1, round_pick: 1, overall_pick: 1, team: 'Orlando Magic', organization: 'Duke', organization_type: 'College/University' },
  { pro_id: 9002, name: 'Brandon Miller', label: 2024, round: 1, round_pick: 2, overall_pick: 2, team: 'Charlotte Hornets', organization: 'Alabama', organization_type: 'College/University' },
  { pro_id: 9003, name: 'Jalen Hood-Schifino', label: 2024, round: 1, round_pick: 17, overall_pick: 17, team: 'Los Angeles Lakers', organization: 'Indiana', organization_type: 'College/University' },
  // Has not played: no NBA row, no ESPN id; name, class and college.
  { pro_id: 9004, name: 'Thomas Sorber', label: 2026, round: 1, round_pick: 15, overall_pick: 15, team: 'Oklahoma City Thunder', organization: 'Georgetown', organization_type: 'College/University' },
  { pro_id: 9005, name: 'Tyler Smith', label: 2025, round: 2, round_pick: 3, overall_pick: 33, team: 'Milwaukee Bucks', organization: 'G League Ignite', organization_type: 'Other Team/Club' },
  // Drafted from a club, then a college row after the draft: never linked.
  { pro_id: 9006, name: 'James Nnaji', label: 2024, round: 2, round_pick: 1, overall_pick: 31, team: 'Detroit Pistons', organization: 'Barcelona', organization_type: 'Other Team/Club' }
]

export const NCAAM_PLAYERS: CollegePlayer[] = [
  { col_id: 101, name: 'Paolo Banchero', espn: 101, first_season: 2022, last_season: 2022, dob: '2002-11-12', teams: [150], team_names: ['Duke Blue Devils'] },
  { col_id: 102, name: 'Brandon Miller', espn: 102, first_season: 2023, last_season: 2023, dob: '2002-11-22', teams: [333], team_names: ['Alabama Crimson Tide'] },
  { col_id: 103, name: 'Brandon Miller', espn: 103, first_season: 2024, last_season: 2025, dob: '2004-01-01', teams: [500], team_names: ['Other Tigers'] },
  { col_id: 5105797, name: 'Jalen Hood-Schifino', espn: 5105797, first_season: 2023, last_season: 2023, dob: '2003-06-19', teams: [84], team_names: ['Indiana Hoosiers'] },
  { col_id: 105, name: 'Thomas Sorber', espn: 105, first_season: 2025, last_season: 2025, dob: null, teams: [46], team_names: ['Georgetown Hoyas'] },
  { col_id: 106, name: 'Tyler Smith', espn: 106, first_season: 2023, last_season: 2024, dob: null, teams: [77], team_names: ['Somewhere Owls'] },
  { col_id: 107, name: 'James Nnaji', espn: 107, first_season: 2026, last_season: 2027, dob: null, teams: [99], team_names: ['Baylor Bears'] }
]

export const WNBA_PLAYERS: ProPlayer[] = [
  { pro_id: 8001, name: 'Caitlin Clark', espn: 201, first_season: 2024, dob: '2002-01-22', espn_college_id: 2294, school: 'Iowa' }
]

export const WNBA_DRAFT: DraftLine[] = [
  { pro_id: 8001, name: 'Caitlin Clark', label: 2024, round: 1, round_pick: 1, overall_pick: 1, team: 'Indiana Fever', organization: null, organization_type: null },
  // The draft names no school (2023 to 2025): name and class alone.
  { pro_id: 8002, name: 'Monika Czinano', label: 2023, round: 2, round_pick: 3, overall_pick: 15, team: 'Los Angeles Sparks', organization: null, organization_type: null },
  // Two college players of the name end in the class: no link.
  { pro_id: 8003, name: 'Kaitlyn Davis', label: 2024, round: 2, round_pick: 1, overall_pick: 13, team: 'Connecticut Sun', organization: null, organization_type: null }
]

export const NCAAW_PLAYERS: CollegePlayer[] = [
  { col_id: 201, name: 'Caitlin Clark', espn: 201, first_season: 2022, last_season: 2024, dob: '2002-01-22', teams: [2294], team_names: ['Iowa Hawkeyes'] },
  { col_id: 202, name: 'Monika Czinano', espn: 202, first_season: 2022, last_season: 2023, dob: null, teams: [2294], team_names: ['Iowa Hawkeyes'] },
  { col_id: 203, name: 'Kaitlyn Davis', espn: 203, first_season: 2022, last_season: 2024, dob: null, teams: [30], team_names: ['USC Trojans'] },
  { col_id: 204, name: 'Kaitlyn Davis', espn: 204, first_season: 2023, last_season: 2024, dob: null, teams: [31], team_names: ['Other Bears'] }
]

const value = (v: unknown): string => {
  if (v === null) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return `[${v.map(value).join(', ')}]`
  return `'${String(v).replaceAll("'", "''")}'`
}

/** Inserts rows into a table, in the order given. */
export async function insertRows(db: StatsDb, table: string, rows: object[]): Promise<void> {
  for (const row of rows) {
    const cols = Object.keys(row)
    await db.exec(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${Object.values(row).map(value).join(', ')})`
    )
  }
}

/** The fixtures' sides, as handed over, in the links file's tables; `reverse` inserts each backwards. */
export async function fillSides(db: StatsDb, reverse = false): Promise<void> {
  const order = <T>(rows: T[]): T[] => (reverse ? [...rows].reverse() : rows)
  await insertRows(db, 'side_nba_players', order(NBA_PLAYERS))
  await insertRows(db, 'side_nba_draft', order(NBA_DRAFT))
  await insertRows(db, 'side_ncaam_players', order(NCAAM_PLAYERS))
  await insertRows(db, 'side_wnba_players', order(WNBA_PLAYERS))
  await insertRows(db, 'side_wnba_draft', order(WNBA_DRAFT))
  await insertRows(db, 'side_ncaaw_players', order(NCAAW_PLAYERS))
}

/** An in-memory links file with its tables and the name macro. */
export async function openLinksDb(): Promise<StatsDb> {
  const db = await StatsDb.open(':memory:')
  for (const sql of linksBootstrap()) await db.exec(sql)
  await db.exec(NAME_MACRO)
  return db
}

/**
 * ESPN's season stats file of a league, as published (one row a stat), for the players named:
 * `[athlete_id, name, season, team_id, team, games, points, rebounds, assists]`.
 */
export function espnSeasonStatsSql(
  lines: readonly (readonly [number, string, number, number, string, number, number, number, number])[]
): string {
  const rows = lines.flatMap(([id, name, season, team, teamName, gp, pts, reb, ast]) => {
    const row = (category: string, stat: string, display: string, v: number | null): string =>
      `(${season}, ${id}, ${value(name)}, ${team}, ${value(teamName)}, ${value(category)}, ${value(stat)}, ${value(display)}, ${v === null ? 'NULL' : v})`
    return [
      row('averages', 'gamesPlayed', String(gp), gp),
      row('averages', 'gamesStarted', String(gp), gp),
      row('averages', 'avgMinutes', '30.0', 30),
      row('totals', 'points', String(pts), pts),
      row('totals', 'totalRebounds', String(reb), reb),
      row('totals', 'assists', String(ast), ast),
      row('totals', 'fieldGoalsMade-fieldGoalsAttempted', '100-200', null)
    ]
  })
  return `SELECT * FROM (VALUES ${rows.join(', ')}) AS t(season, athlete_id, athlete_display_name, team_id,
    team_display_name, category, stat_name, display_value, value)`
}
