import { relativeTime } from '@/lib/format'
import { seasonLabel } from '@shared/stats/seasons'
import type { Entity, GameType, StatsQuery, StatsSeason, StatsStatus } from '@shared/stats/types'

const DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})
const SHORT_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric'
})

const COUNT = new Intl.NumberFormat('en-US')

/** "412 of 3,107 files", once a refresh knows how many it has to do. */
function filesDone(status: StatsStatus): string | null {
  if (!status.progress) return null
  return `${COUNT.format(status.progress.done)} of ${COUNT.format(status.progress.total)} files`
}

/** "Data through Nov 4, 2026 · updated 2 h ago": the nav's status line. */
export function freshness(status: StatsStatus | null, now = Date.now()): string {
  if (!status) return ''
  if (!status.available) return 'Stats unavailable'
  if (status.noRoom) return 'Not enough disk space'
  if (status.paused && !status.through) return 'Loading paused'
  const files = filesDone(status)
  if (!status.through) {
    if (!status.busy) return 'No stats yet'
    return files ? `Loading the stats · ${files}` : 'Loading the stats…'
  }
  // A game date has no time of day: read at UTC, so no time zone moves it to the day before.
  const through = `Data through ${DAY.format(new Date(`${status.through.date}T00:00:00Z`))}`
  if (status.paused) return `${through} · paused`
  if (!status.busy) return `${through} · updated ${relativeTime(status.updatedAt, now)}`
  return files ? `${through} · updating ${files}` : `${through} · updating…`
}

/** What the season-type control offers: one type, or every game that counts. */
export type SeasonType = 'regular' | 'play-in' | 'playoffs' | 'cup-final' | 'counted' | 'all-star'

const COUNTED: GameType[] = ['regular', 'play-in', 'playoffs', 'cup-final']

const TYPE_LABELS: Record<SeasonType, string> = {
  regular: 'Regular season',
  'play-in': 'Play-in',
  playoffs: 'Playoffs',
  'cup-final': 'NBA Cup final',
  counted: 'Regular season and after',
  'all-star': 'All-Star'
}

export type StatsRange =
  | { kind: 'season' }
  | { kind: 'dates'; from: string; to: string }
  | { kind: 'last'; n: number; of: 'appearances' | 'team' }

/** The controls every stats screen shares, kept for the session. */
export interface StatsScope {
  season: number
  seasonType: SeasonType
  range: StatsRange
}

/** The last-N choices the scope bar offers. */
export const LAST_N = [5, 10, 15, 20, 30]

export const typeLabel = (type: SeasonType): string => TYPE_LABELS[type]

/**
 * The types a season has box scores for. Preseason games have none anywhere, so they never appear,
 * and "Regular season and after" only when there is an after.
 */
export function seasonTypes(season: StatsSeason | undefined): SeasonType[] {
  if (!season) return ['regular']
  const has = new Set(season.types.map((t) => t.type))
  const counted = COUNTED.filter((t) => has.has(t))
  return [
    ...(counted as SeasonType[]),
    ...(counted.length > 1 ? (['counted'] as const) : []),
    ...(has.has('all-star') ? (['all-star'] as const) : [])
  ]
}

/** The latest season with box scores, its regular season, whole. */
export function defaultScope(seasons: StatsSeason[], status: StatsStatus | null): StatsScope {
  const latest = seasons[0]?.season ?? status?.through?.season ?? new Date().getUTCFullYear()
  return { season: latest, seasonType: 'regular', range: { kind: 'season' } }
}

export const seasonOf = (seasons: StatsSeason[], season: number): StatsSeason | undefined =>
  seasons.find((s) => s.season === season)

/**
 * A move to another season: its dates are not this one's, so a date range goes, and a type it does not
 * have falls back to the regular season.
 */
export function moveToSeason(
  scope: StatsScope,
  season: number,
  seasons: StatsSeason[]
): StatsScope {
  const types = seasonTypes(seasonOf(seasons, season))
  return {
    season,
    seasonType: types.includes(scope.seasonType) ? scope.seasonType : 'regular',
    range: scope.range.kind === 'dates' ? { kind: 'season' } : scope.range
  }
}

/** The `scope` part of a query. Last N of the team's games is a choice for players only. */
export function queryScope(scope: StatsScope, entity: Entity): StatsQuery['scope'] {
  const base: StatsQuery['scope'] = {
    seasons: [scope.season],
    gameTypes: scope.seasonType === 'counted' ? COUNTED : [scope.seasonType]
  }
  if (scope.range.kind === 'dates') return { ...base, dates: [scope.range.from, scope.range.to] }
  if (scope.range.kind === 'last') {
    return {
      ...base,
      lastN: scope.range.n,
      ...(entity === 'player' ? { lastNOf: scope.range.of } : {})
    }
  }
  return base
}

const shortDay = (date: string): string => SHORT_DAY.format(new Date(`${date}T00:00:00Z`))

/** "Whole season", "Jan 5 – Feb 1", "Last 10 games", "Team's last 10 games". */
export function rangeLabel(scope: StatsScope, entity: Entity = 'player'): string {
  const r = scope.range
  if (r.kind === 'season') return 'Whole season'
  if (r.kind === 'dates') return `${shortDay(r.from)} – ${shortDay(r.to)}`
  return `${entity === 'player' && r.of === 'team' ? "Team's last" : 'Last'} ${r.n} games`
}

/** "2025-26 · Regular season · Whole season". */
export function scopeLabel(scope: StatsScope, entity: Entity = 'player'): string {
  return `${seasonLabel(scope.season)} · ${typeLabel(scope.seasonType)} · ${rangeLabel(scope, entity)}`
}
