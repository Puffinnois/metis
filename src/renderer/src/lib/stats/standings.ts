import { seasonLabel } from '@shared/stats/seasons'
import type { StatsStanding } from '@shared/stats/types'
import { fmtStat, ordinal } from './format'

/** The published standings, by conference or by division. Nothing here is recomputed. */

export type StandingsView = 'conference' | 'division'

export const STANDINGS_HEAD = [
  '#',
  'Team',
  'W',
  'L',
  'PCT',
  'GB',
  'HOME',
  'ROAD',
  'DIV',
  'CONF',
  'L10',
  'STRK',
  'PPG',
  'OPP',
  'DIFF'
]

export interface StandingRow {
  key: string
  teamId: string
  rank: string
  name: string
  code: string | null
  /** In the order of `STANDINGS_HEAD`, after the team. */
  cells: string[]
}

export interface StandingsTable {
  title: string
  rows: StandingRow[]
}

const dash = (x: string | null): string => x ?? '—'

/** ".683", as standings write it; a perfect record is "1.000". */
export function fmtWinPct(x: number | null): string {
  if (x === null) return '—'
  const text = x.toFixed(3)
  return text.startsWith('0') ? text.slice(1) : text
}

/** The leader is 0 games back, and standings write that as a dash. */
export function fmtGamesBack(x: number | null): string {
  if (x === null) return '—'
  return x === 0 ? '—' : x.toFixed(1).replace(/\.0$/, '')
}

const fmtPoints = (x: number | null): string => fmtStat(x, { unit: 'number', decimals: 1 })

function row(s: StatsStanding, by: StandingsView): StandingRow {
  const rank = by === 'conference' ? s.conferenceRank : s.divisionRank
  const back = by === 'conference' ? s.conferenceGamesBack : s.divisionGamesBack
  const diff = fmtPoints(s.differential)
  return {
    key: s.teamId,
    teamId: s.teamId,
    rank: rank === null ? '' : String(rank),
    name: s.name,
    code: s.code,
    cells: [
      String(s.wins),
      String(s.losses),
      fmtWinPct(s.winPct),
      fmtGamesBack(back),
      dash(s.home),
      dash(s.road),
      dash(s.divisionRecord),
      dash(s.conferenceRecord),
      dash(s.last10),
      dash(s.streak),
      fmtPoints(s.pointsPerGame),
      fmtPoints(s.allowedPerGame),
      s.differential !== null && s.differential > 0 ? `+${diff}` : diff
    ]
  }
}

const rankOf = (r: number | null): number => r ?? Number.MAX_SAFE_INTEGER

/** Two tables, East first. */
export function conferenceTables(rows: readonly StatsStanding[]): StandingsTable[] {
  const names = [...new Set(rows.map((r) => r.conference ?? 'Unknown'))].sort()
  return names.map((title) => ({
    title,
    rows: rows
      .filter((r) => (r.conference ?? 'Unknown') === title)
      .sort((a, b) => rankOf(a.conferenceRank) - rankOf(b.conferenceRank))
      .map((r) => row(r, 'conference'))
  }))
}

/** A table per division that season, by conference: four until 2003-04, six after. */
export function divisionTables(rows: readonly StatsStanding[]): StandingsTable[] {
  const seen = new Map<string, string>()
  for (const r of rows) seen.set(r.division ?? 'Unknown', r.conference ?? 'Unknown')
  const names = [...seen].sort(([a, ca], [b, cb]) => ca.localeCompare(cb) || a.localeCompare(b))
  return names.map(([title]) => ({
    title,
    rows: rows
      .filter((r) => (r.division ?? 'Unknown') === title)
      .sort((a, b) => rankOf(a.divisionRank) - rankOf(b.divisionRank))
      .map((r) => row(r, 'division'))
  }))
}

export const standingsTables = (
  rows: readonly StatsStanding[],
  by: StandingsView
): StandingsTable[] => (by === 'conference' ? conferenceTables(rows) : divisionTables(rows))

/** The first season with published standings, by final year, and with streaks and the last ten. */
const FIRST_STANDINGS = 1996
const FIRST_STREAKS = 2002

/** What the table depends on, or why there is none. */
export function standingsNotes(season: number, rows: readonly StatsStanding[]): string[] {
  if (rows.length === 0) {
    return season < FIRST_STANDINGS
      ? [`Published standings start in ${seasonLabel(FIRST_STANDINGS)}.`]
      : []
  }
  const notes: string[] = []
  if (season < FIRST_STREAKS) {
    notes.push(`The last ten and the streak are published from ${seasonLabel(FIRST_STREAKS)}.`)
  }
  if (rows.every((r) => r.conferenceRecord === null && r.divisionRecord === null)) {
    notes.push(
      `The NBA’s file has no real conference or division records for ${seasonLabel(season)}.`
    )
  }
  return notes
}

/** "2nd in the East · 1st in the Atlantic", for a team's header. */
export function teamPlace(rows: readonly StatsStanding[] | null, team: string): string | null {
  const s = rows?.find((r) => r.teamId === team)
  if (!s) return null
  const place = (rank: number | null, where: string | null): string | null =>
    rank !== null && where ? `${ordinal(rank)} in the ${where}` : null
  const parts = [place(s.conferenceRank, s.conference), place(s.divisionRank, s.division)]
  const known = parts.filter((p): p is string => p !== null)
  return known.length ? known.join(' · ') : null
}
