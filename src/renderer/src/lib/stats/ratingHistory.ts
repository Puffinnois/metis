import { seasonLabel } from '@/lib/stats/league'

/*
 * A player's ratings over time (Plan T1704): every dated series of a rating Metis holds for a player,
 * each named with its maker, drawn by date. The read (`stats.ratingHistory`) is the T1703 worker's;
 * the shapes below follow its description until the shared type lands.
 */

/** How often a series has a value: a hand-imported snapshot, a weekly estimate, or every game. */
export type RatingGrain = 'snapshot' | 'weekly' | 'game'

/** One dated value of a series: the rating and its two ends where the maker splits it. */
export interface RatingPoint {
  /** The date the value was made, `YYYY-MM-DD`. */
  date: string
  /** The season it belongs to, by its final year. */
  season: number
  total: number | null
  off: number | null
  def: number | null
  /** What the value was computed from, where the read says ("Games through Jan 12, 41 games"). */
  basis?: string | null
}

/** One maker's rating for one player, every value in date order. */
export interface RatingSeries {
  id: string
  /** The rating's name, without its maker ("Expected impact"). */
  label: string
  /** Who makes it ("SportsDataverse", "DARKO", "Metis"). */
  maker: string
  /** What a value is ("Points per 100 possessions"). */
  unit: string
  grain: RatingGrain
  points: RatingPoint[]
  /** What the series covers and lacks, in short sentences. */
  notes: string[]
}

/** The read's answer for one player. */
export interface RatingHistory {
  series: RatingSeries[]
  /** Notes on the league's series as a whole: which exist and why one is not here. */
  notes: string[]
}

/** Which number of a rating the chart draws. */
export type RatingPart = 'total' | 'off' | 'def'
export const RATING_PARTS: { id: RatingPart; label: string }[] = [
  { id: 'total', label: 'Total' },
  { id: 'off', label: 'Offence' },
  { id: 'def', label: 'Defence' }
]

/** The span drawn: the season in scope, or every season the series reach. */
export type RatingRange = 'season' | 'career'
export const RATING_RANGES: { id: RatingRange; label: string }[] = [
  { id: 'season', label: 'Season' },
  { id: 'career', label: 'Career' }
]

/** A series' name with its maker, as the chart and its legend show it. */
export const seriesName = (s: Pick<RatingSeries, 'label' | 'maker'>): string =>
  `${s.label} (${s.maker})`

export const partValue = (p: RatingPoint, part: RatingPart): number | null => p[part]

/** A series with its points kept to the range and to those with a value for the part. */
export interface ShownSeries {
  series: RatingSeries
  points: RatingPoint[]
}

/** The series to draw: their points in the range with a value for the part; a series left with none is dropped. */
export function shownSeries(
  history: RatingHistory | null,
  range: RatingRange,
  season: number,
  part: RatingPart
): ShownSeries[] {
  if (!history) return []
  return history.series
    .map((series) => ({
      series,
      points: series.points
        .filter((p) => (range === 'career' || p.season === season) && partValue(p, part) !== null)
        .sort((a, b) => a.date.localeCompare(b.date))
    }))
    .filter((s) => s.points.length > 0)
}

/** Whether any series has a value for the part in any season: a part no maker splits is not offered. */
export function offeredParts(history: RatingHistory | null): RatingPart[] {
  return RATING_PARTS.map((p) => p.id).filter(
    (part) =>
      history?.series.some((s) => s.points.some((p) => partValue(p, part) !== null)) ?? false
  )
}

/** The seasons any series has a value in, ascending. */
export function seriesSeasons(history: RatingHistory | null): number[] {
  return [...new Set(history?.series.flatMap((s) => s.points.map((p) => p.season)) ?? [])].sort(
    (a, b) => a - b
  )
}

const DAY = 86_400_000
const time = (date: string): number => Date.parse(`${date}T00:00:00Z`)

/** One season's place on the axis: its first and last date drawn, and where it sits (0 to 1). */
export interface AxisSeason {
  season: number
  from: string
  to: string
  start: number
  end: number
}

/** The x-axis: a position from 0 to 1 for a date of a season, and the seasons with their bounds. */
export interface RatingAxis {
  seasons: AxisSeason[]
  x: (date: string, season: number) => number
}

/** The share of the axis between two seasons: the off-season, left blank rather than drawn. */
export const SEASON_GAP = 0.025

/**
 * The time axis. Within a season, by date; across a career, each season gets an equal stretch from
 * its first date drawn to its last, with a small gap between seasons, so a summer is a gap and not a
 * long flat line, and a season with three snapshots is as legible as one with twenty weeks. A season
 * of one date sits in the middle of its stretch.
 */
export function ratingAxis(shown: readonly ShownSeries[]): RatingAxis {
  const bounds = new Map<number, { from: string; to: string }>()
  for (const s of shown)
    for (const p of s.points) {
      const b = bounds.get(p.season)
      if (!b) bounds.set(p.season, { from: p.date, to: p.date })
      else {
        if (p.date < b.from) b.from = p.date
        if (p.date > b.to) b.to = p.date
      }
    }
  const order = [...bounds.keys()].sort((a, b) => a - b)
  const n = order.length
  const width = n > 0 ? (1 - SEASON_GAP * (n - 1)) / n : 1
  const seasons = order.map((season, i): AxisSeason => {
    const start = i * (width + SEASON_GAP)
    return { season, ...bounds.get(season)!, start, end: start + width }
  })
  const bySeason = new Map(seasons.map((s) => [s.season, s]))
  return {
    seasons,
    x: (date, season) => {
      const s = bySeason.get(season)
      if (!s) return NaN
      const span = time(s.to) - time(s.from)
      if (span < DAY) return (s.start + s.end) / 2
      return s.start + ((time(date) - time(s.from)) / span) * (s.end - s.start)
    }
  }
}

/** A series' runs to join with a line: within a season only, never across a summer. */
export function seasonRuns(points: readonly RatingPoint[]): RatingPoint[][] {
  const runs: RatingPoint[][] = []
  for (const p of points) {
    const last = runs[runs.length - 1]
    if (last && last[0].season === p.season) last.push(p)
    else runs.push([p])
  }
  return runs
}

/** Where a series stops, when it stops before the league's latest season: "Published through 2025-26". */
export function stopNote(series: RatingSeries, latest: number | null): string | null {
  const last = Math.max(...series.points.map((p) => p.season))
  if (!Number.isFinite(last) || latest === null || last >= latest) return null
  return `${series.grain === 'snapshot' ? 'Imported' : 'Published'} through ${seasonLabel(last)}`
}

/** A snapshot series is a few dated imports: its points show, so three read as three, not a curve. */
export const showsPoints = (series: RatingSeries): boolean => series.grain === 'snapshot'

/** A value as the chart writes it: signed, one decimal, as a rating per 100 possessions reads. */
export function fmtRating(v: number): string {
  const r = Math.round(v * 10) / 10
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(1)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A date as the screens write it: "Jan 12, 2026". */
export function fmtDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** The hover's lines for one series' point: its name, the date and value, and what it came from. */
export function pointLines(series: RatingSeries, p: RatingPoint, part: RatingPart): string[] {
  const v = partValue(p, part)
  const word = part === 'total' ? '' : part === 'off' ? ' offence' : ' defence'
  return [
    seriesName(series),
    `${fmtDate(p.date)}: ${v === null ? '—' : fmtRating(v)}${word}`,
    ...(p.basis ? [p.basis] : [])
  ]
}

/** The point of a series nearest an axis position, within a season's stretch; null when far off. */
export function nearestPoint(
  shown: ShownSeries,
  axis: RatingAxis,
  at: number,
  within = SEASON_GAP
): RatingPoint | null {
  let best: RatingPoint | null = null
  let gap = Infinity
  for (const p of shown.points) {
    const d = Math.abs(axis.x(p.date, p.season) - at)
    if (d < gap) {
      gap = d
      best = p
    }
  }
  return gap <= within ? best : null
}

/**
 * The line in place of a chart when there is nothing to draw: which series exist and why none is
 * here. The read's own notes say it best; without them, a line that names the series it looked for.
 */
export function emptyLine(
  history: RatingHistory | null,
  range: RatingRange,
  season: number
): string {
  if (history && history.series.length > 0 && range === 'season') {
    const names = history.series.map(seriesName).join(', ')
    return `No ${names} value for ${seasonLabel(season)}; the career shows every season there is.`
  }
  if (history && history.notes.length > 0) return history.notes.join(' ')
  return 'No ratings over time for this player.'
}

/** A season's month labels on its own axis: the first of each month inside its dates drawn. */
export function monthTicks(season: AxisSeason | undefined): { date: string; label: string }[] {
  if (!season) return []
  const out: { date: string; label: string }[] = []
  let [y, m] = season.from.split('-').map(Number)
  for (;;) {
    const date = `${y}-${String(m).padStart(2, '0')}-01`
    if (date > season.to) break
    if (date >= season.from) out.push({ date, label: MONTHS[m - 1] })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** The least the value axis spans, in points per 100 possessions: ratings move by points, not tenths. */
export const MIN_SPAN = 2

/**
 * The value axis' bounds. Zero is the league's average player, so it stays in view whenever the
 * values come near it: no further from it than their own spread. Far from it (a career all between +6 and +8), the
 * axis keeps to the values rather than flattening them against a distant zero.
 */
export function valueDomain(values: readonly number[]): { lo: number; hi: number; zero: boolean } {
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  // At least MIN_SPAN points tall, so two imports a few tenths apart do not read as a climb.
  if (hi - lo < MIN_SPAN) {
    const mid = (lo + hi) / 2
    lo = mid - MIN_SPAN / 2
    hi = mid + MIN_SPAN / 2
  }
  const spread = hi - lo || Math.max(Math.abs(hi), 1)
  const zero = lo - spread <= 0 && hi + spread >= 0
  if (zero) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  const pad = (hi - lo || 1) * 0.08
  return { lo: lo - pad, hi: hi + pad, zero }
}

/**
 * Whether a series' points are marked: a snapshot's always, so a few imports read as a few points;
 * every series' in a single season, so a reader sees the grain; across a career the straight segments
 * alone, where a mark a week would crowd.
 */
export const marksPoints = (series: RatingSeries, range: RatingRange): boolean =>
  series.grain === 'snapshot' || range === 'season'

/**
 * A snapshot series' legend words: one or two imports named by their dates, so a series that short
 * reads as what it is ("imported Nov 3, 2026"); more, counted.
 */
export function importsNote(series: RatingSeries, points: readonly RatingPoint[]): string | null {
  if (series.grain !== 'snapshot' || points.length === 0) return null
  if (points.length === 1) return `imported ${fmtDate(points[0].date)}`
  if (points.length === 2) {
    const [a, b] = points.map((p) => fmtDate(p.date))
    const sameYear = a.slice(-4) === b.slice(-4)
    return `imported ${sameYear ? a.slice(0, -6) : a} and ${b}`
  }
  return `${points.length} imports, ${fmtDate(points[0].date)} to ${fmtDate(points[points.length - 1].date)}`
}

/** A snapshot series of one or two points labels each with its value and date where it stands. */
export const labelsPoints = (series: RatingSeries, points: readonly RatingPoint[]): boolean =>
  series.grain === 'snapshot' && points.length > 0 && points.length <= 2
