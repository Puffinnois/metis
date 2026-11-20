import { currentLeague } from '@/lib/stats/league'
import { playoffEraIn, type League } from '@shared/leagues'
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

/**
 * The heads of Metis's own columns and the metric each shows, so they carry its stability mark and
 * card (Plan T1006); the published columns are the NBA's, not catalogue metrics.
 */
export const HEAD_METRICS: Readonly<Record<string, string>> = {
  'PYTH W': 'team_pyth_w',
  SRS: 'team_srs',
  SOS: 'team_sos',
  ELO: 'team_elo',
  PROJ: 'team_proj_w',
  'PLAYOFF%': 'team_playoff_pct',
  'TITLE%': 'team_title_pct'
}

/** The team strength columns, computed by Metis, after the published ones. */
export const STRENGTH_METRICS = ['team_pyth_w', 'team_srs', 'team_sos', 'team_elo'] as const

/**
 * Each team's strength over the season: its final SRS, SOS and Elo, over the regular season or, where
 * the league's standings count every game (the college leagues, D45), over every counted game.
 */
export function strengthQuery(season: number, league: League = currentLeague()): StatsQuery {
  return {
    entity: 'team',
    metrics: [...STRENGTH_METRICS],
    scope: {
      seasons: [season],
      gameTypes: league.defaultType === 'counted' ? [...league.countedTypes] : ['regular']
    },
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

/**
 * The head, with the forecast's columns when there is one. A season whose teams are in no division
 * (the WNBA's, always) has no DIV column: its file publishes "0-0" for every team there.
 */
export const standingsHead = (
  forecast: ForecastCells | null,
  rows: readonly StatsStanding[] | null = null
): string[] => {
  const head = forecast ? [...STANDINGS_HEAD, ...FORECAST_HEAD] : STANDINGS_HEAD
  return rows && rows.length > 0 && !hasDivisions(rows) ? head.filter((h) => h !== 'DIV') : head
}

/** The grid's widths, with DIV's left out where the head leaves it out. */
export function standingsColumns(
  forecast: ForecastCells | null,
  rows: readonly StatsStanding[] | null = null
): string {
  const widths = [...STANDINGS_WIDTHS, ...(forecast ? FORECAST_WIDTHS : [])]
  const head = forecast ? [...STANDINGS_HEAD, ...FORECAST_HEAD] : STANDINGS_HEAD
  const shown = new Set(standingsHead(forecast, rows))
  return widths.filter((_, i) => shown.has(head[i])).join(' ')
}

const STANDINGS_WIDTHS = [
  '24px',
  'minmax(190px,1.6fr)',
  '32px',
  '32px',
  '44px',
  '40px',
  '52px',
  '52px',
  '52px',
  '52px',
  '44px',
  '44px',
  '48px',
  '48px',
  '48px',
  '56px',
  '52px',
  '52px',
  '52px'
]
/** The forecast's three: the projected record and two odds (Plan T1003). */
const FORECAST_WIDTHS = ['56px', '64px', '56px']

/**
 * What the forecast is, in a line under the table: the play-in only where the season's format has one
 * (the NBA's from 2020-21; the WNBA never has).
 */
export const forecastNote = (
  runs: number | null,
  season: number,
  league: League = currentLeague()
): string =>
  `PROJ, PLAYOFF% and TITLE% are a model’s odds, computed by Metis: the rest of the season played ${
    runs === null ? 'many' : runs.toLocaleString('en-US')
  } times from its Elo ratings, then ${
    playoffEraIn(league, season).playIn === 'none' ? 'the playoffs' : 'the play-in and the playoffs'
  }.`

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
  forecast: ForecastCells | null,
  divisions = true
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
      ...(divisions ? [dash(s.divisionRecord)] : []),
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
  const divisions = hasDivisions(rows)
  return names.map((title) => ({
    title,
    rows: rows
      .filter((r) => (r.conference ?? 'Unknown') === title)
      .sort((a, b) => rankOf(a.conferenceRank) - rankOf(b.conferenceRank))
      .map((r) => row(r, 'conference', strength, forecast, divisions))
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

/** Whether the season's teams are in divisions: the WNBA's never are, only conferences. */
export const hasDivisions = (rows: readonly StatsStanding[]): boolean =>
  rows.some((r) => r.division !== null)

/** The views a season's standings offer: by division only where it has divisions. */
export const standingsViews = (rows: readonly StatsStanding[] | null): StandingsView[] =>
  rows && rows.length > 0 && !hasDivisions(rows) ? ['conference'] : ['conference', 'division']

export const standingsTables = (
  rows: readonly StatsStanding[],
  by: StandingsView,
  strength: StrengthCells | null = null,
  forecast: ForecastCells | null = null
): StandingsTable[] =>
  by === 'conference' || !hasDivisions(rows)
    ? conferenceTables(rows, strength, forecast)
    : divisionTables(rows, strength, forecast)

/** Metis's own columns are not the league's, and the table says so, with the league's exponent. */
export const strengthNote = (league: League = currentLeague()): string =>
  league.models === null
    ? `PYTH W, SRS, SOS and ELO are Metis's own, not computed for the ${league.name} yet.`
    : league.divisionIOnly
      ? `PYTH W, SRS, SOS and ELO are computed by Metis from the final scores: Pythagorean wins over every game with the exponent ${league.models.pythagoreanExponent}, SRS, the strength of schedule and Elo on games between Division I teams alone, after the last game. A game against a team outside Division I counts in the record, not in the ratings.`
      : `PYTH W, SRS, SOS and ELO are computed by Metis from the final scores: Pythagorean wins with the exponent ${league.models.pythagoreanExponent}, SRS and the strength of schedule solved on the regular season, Elo after the last regular-season game.`

/**
 * What the table depends on, or why there is none. What is missing is read from the rows, so a league
 * whose file publishes the last ten and the streak from its first season (the WNBA's, 1997) says
 * nothing of them.
 */
export function standingsNotes(
  season: number,
  rows: readonly StatsStanding[],
  league: League = currentLeague()
): string[] {
  if (rows.length === 0) {
    return season < league.standingsFrom
      ? [`Published standings start in ${league.seasonLabel(league.standingsFrom)}.`]
      : [`No standings are published for ${league.seasonLabel(season)}.`]
  }
  const notes: string[] = []
  if (rows.every((r) => r.last10 === null && r.streak === null)) {
    notes.push(`The last ten and the streak are not published for ${league.seasonLabel(season)}.`)
  } else if (rows.every((r) => r.last10 === null)) {
    // ESPN's college standings publish the streak but no last ten.
    notes.push(`The last ten is not published for ${league.seasonLabel(season)}.`)
  }
  const records = hasDivisions(rows)
    ? rows.every((r) => r.conferenceRecord === null && r.divisionRecord === null)
    : rows.every((r) => r.conferenceRecord === null)
  if (records) {
    notes.push(
      `The ${league.name}’s file has no real conference ${hasDivisions(rows) ? 'or division ' : ''}records for ${league.seasonLabel(season)}.`
    )
  }
  notes.push(strengthNote(league))
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
