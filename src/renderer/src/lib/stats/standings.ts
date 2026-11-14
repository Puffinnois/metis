import { seasonLabel } from '@shared/stats/seasons'
import type { StatsQuery, StatsResult, StatsStanding } from '@shared/stats/types'
import { fmtStat, ordinal } from './format'

/**
 * The published standings, by conference or by division. Nothing published is recomputed; the last
 * four columns are Metis's own (Plans T1001 and T1002), from the final scores, and the screen says so.
 */

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
  'DIFF',
  'PYTH W',
  'SRS',
  'SOS',
  'ELO'
]

/** The team strength columns, computed by Metis, after the published ones. */
export const STRENGTH_METRICS = ['team_pyth_w', 'team_srs', 'team_sos', 'team_elo'] as const

/** Each team's strength over the season's regular season: its final SRS, SOS and Elo. */
export function strengthQuery(season: number): StatsQuery {
  return {
    entity: 'team',
    metrics: [...STRENGTH_METRICS],
    scope: { seasons: [season], gameTypes: ['regular'] },
    limit: 40,
    ranks: false
  }
}

/** A team's strength cells by its id, in the order of `STRENGTH_METRICS`. */
export type StrengthCells = ReadonlyMap<string, readonly (number | null)[]>

export function strengthCells(result: StatsResult | null): StrengthCells | null {
  if (!result) return null
  return new Map(
    result.rows.map((r) => [r.id, STRENGTH_METRICS.map((m) => r.values[m]?.value ?? null)])
  )
}

/**
 * Plan T1003: the season forecast, for the season in progress only. A past season's whole regular
 * season would read the forecast after its last game, whose playoff odds are already 100 % or 0 %:
 * noise beside the published standings, so its table shows none (the team Overview keeps the trend).
 */
export const FORECAST_HEAD = ['PROJ', 'PLAYOFF%', 'TITLE%']

export const FORECAST_METRICS = [
  'team_proj_w',
  'team_proj_l',
  'team_playoff_pct',
  'team_title_pct',
  'team_forecast_runs'
] as const

export function forecastQuery(season: number): StatsQuery {
  return {
    entity: 'team',
    metrics: [...FORECAST_METRICS],
    scope: { seasons: [season], gameTypes: ['regular'] },
    limit: 40,
    ranks: false
  }
}

/** A team's forecast cells by its id, in the order of `FORECAST_HEAD`, and the runs behind them. */
export interface ForecastCells {
  cells: ReadonlyMap<string, readonly string[]>
  runs: number | null
}

/** "51-31": the projected wins rounded, and the losses the rest of the rounded games. */
export function fmtProjected(w: number | null, l: number | null): string {
  if (w === null || l === null) return '—'
  const wins = Math.round(w)
  return `${wins}-${Math.round(w + l) - wins}`
}

/** "87%", "<1%", ">99%": odds to the point, never a 0 or a 100 the runs did not show. */
export function fmtOdds(x: number | null): string {
  if (x === null) return '—'
  if (x <= 0) return '0%'
  if (x >= 1) return '100%'
  if (x < 0.005) return '<1%'
  if (x > 0.995) return '>99%'
  return `${Math.round(x * 100)}%`
}

export function forecastCells(result: StatsResult | null): ForecastCells | null {
  if (!result || result.rows.length === 0) return null
  const v = (r: StatsResult['rows'][number], m: string): number | null => r.values[m]?.value ?? null
  return {
    cells: new Map(
      result.rows.map((r) => [
        r.id,
        [
          fmtProjected(v(r, 'team_proj_w'), v(r, 'team_proj_l')),
          fmtOdds(v(r, 'team_playoff_pct')),
          fmtOdds(v(r, 'team_title_pct'))
        ]
      ])
    ),
    runs: result.rows.map((r) => v(r, 'team_forecast_runs')).find((x) => x !== null) ?? null
  }
}

/** The head, with the forecast's columns when there is one. */
export const standingsHead = (forecast: ForecastCells | null): string[] =>
  forecast ? [...STANDINGS_HEAD, ...FORECAST_HEAD] : STANDINGS_HEAD

/** What the forecast is, in a line under the table. */
export const forecastNote = (runs: number | null): string =>
  `PROJ, PLAYOFF% and TITLE% are a model’s odds, computed by Metis: the rest of the season played ${
    runs === null ? 'many' : runs.toLocaleString('en-US')
  } times from its Elo ratings, then the play-in and the playoffs.`

/** "+7.45" or "−2.10": a rating's sign always shows, with a real minus. */
export function fmtSigned(x: number | null, decimals: number): string {
  if (x === null) return '—'
  const text = Math.abs(x).toFixed(decimals)
  if (Number(text) === 0) return text
  return x > 0 ? `+${text}` : `−${text}`
}

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

function row(
  s: StatsStanding,
  by: StandingsView,
  strength: StrengthCells | null,
  forecast: ForecastCells | null
): StandingRow {
  const rank = by === 'conference' ? s.conferenceRank : s.divisionRank
  const back = by === 'conference' ? s.conferenceGamesBack : s.divisionGamesBack
  const diff = fmtPoints(s.differential)
  const [pythW, srs, sos, elo] = strength?.get(s.teamId) ?? [null, null, null, null]
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
      s.differential !== null && s.differential > 0 ? `+${diff}` : diff,
      pythW === null ? '—' : pythW.toFixed(1),
      fmtSigned(srs, 2),
      fmtSigned(sos, 2),
      fmtStat(elo, { unit: 'number', decimals: 0 }),
      ...(forecast ? (forecast.cells.get(s.teamId) ?? FORECAST_HEAD.map(() => '—')) : [])
    ]
  }
}

const rankOf = (r: number | null): number => r ?? Number.MAX_SAFE_INTEGER

/** Two tables, East first. */
export function conferenceTables(
  rows: readonly StatsStanding[],
  strength: StrengthCells | null = null,
  forecast: ForecastCells | null = null
): StandingsTable[] {
  const names = [...new Set(rows.map((r) => r.conference ?? 'Unknown'))].sort()
  return names.map((title) => ({
    title,
    rows: rows
      .filter((r) => (r.conference ?? 'Unknown') === title)
      .sort((a, b) => rankOf(a.conferenceRank) - rankOf(b.conferenceRank))
      .map((r) => row(r, 'conference', strength, forecast))
  }))
}

/** A table per division that season, by conference: four until 2003-04, six after. */
export function divisionTables(
  rows: readonly StatsStanding[],
  strength: StrengthCells | null = null,
  forecast: ForecastCells | null = null
): StandingsTable[] {
  const seen = new Map<string, string>()
  for (const r of rows) seen.set(r.division ?? 'Unknown', r.conference ?? 'Unknown')
  const names = [...seen].sort(([a, ca], [b, cb]) => ca.localeCompare(cb) || a.localeCompare(b))
  return names.map(([title]) => ({
    title,
    rows: rows
      .filter((r) => (r.division ?? 'Unknown') === title)
      .sort((a, b) => rankOf(a.divisionRank) - rankOf(b.divisionRank))
      .map((r) => row(r, 'division', strength, forecast))
  }))
}

export const standingsTables = (
  rows: readonly StatsStanding[],
  by: StandingsView,
  strength: StrengthCells | null = null,
  forecast: ForecastCells | null = null
): StandingsTable[] =>
  by === 'conference'
    ? conferenceTables(rows, strength, forecast)
    : divisionTables(rows, strength, forecast)

/** The first season with published standings, by final year, and with streaks and the last ten. */
const FIRST_STANDINGS = 1996
const FIRST_STREAKS = 2002

/** Metis's own columns are not the NBA's, and the table says so. */
export const STRENGTH_NOTE =
  'PYTH W, SRS, SOS and ELO are computed by Metis from the final scores: Pythagorean wins with the exponent 14, SRS and the strength of schedule solved on the regular season, Elo after the last regular-season game.'

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
  notes.push(STRENGTH_NOTE)
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
