import { relativeTime } from '@/lib/format'
import { currentLeague, seasonLabel } from '@/lib/stats/league'
import { inSeason, type League } from '@shared/leagues'
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

/**
 * The season a league finished last, by the data's label: the one its latest season month fell in.
 * Between seasons that is the season just played (the NBA's 2026 from July to September, the WNBA's
 * 2026 from November to April); inside the season months it is the one under way.
 */
export function lastPlayedSeason(league: League, now: Date): number {
  for (let back = 0; back < 12; back++) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 15))
    if (inSeason(league, month)) return league.currentSeason(month)
  }
  return league.currentSeason(now)
}

/**
 * Whether the league is between seasons and its data runs through the season it finished: its season
 * is complete, and a date weeks old is not stale. Data that stops short of that season is not.
 */
export function seasonComplete(league: League, status: StatsStatus, now: Date): boolean {
  if (!status.through || inSeason(league, now)) return false
  return status.through.season === lastPlayedSeason(league, now)
}

/**
 * "Data through Nov 4, 2026 · updated 2 h ago": the nav's status line. Between seasons, "2025-26
 * season complete · data through Jun 18, 2026", for every league alike (the registry's `seasonMonths`).
 */
export function freshness(
  status: StatsStatus | null,
  now = Date.now(),
  league: League = currentLeague()
): string {
  if (!status) return ''
  const files = filesDone(status)
  if (status.noData) {
    // Off, with no worker: nothing to read. On, with its files loading or loaded and no tables built
    // from them (the registry's `derived`): what the load is doing, then that the tables are not built.
    if (!status.available) return `No ${league.name} stats yet`
    if (status.noRoom) return 'Not enough disk space'
    if (status.paused) return 'Loading paused'
    if (status.busy) return files ? `Loading the stats · ${files}` : 'Loading the stats…'
    return `${league.name} files loaded · no tables yet`
  }
  if (!status.available) return 'Stats unavailable'
  if (status.noRoom) return 'Not enough disk space'
  if (status.paused && !status.through) return 'Loading paused'
  if (!status.through) {
    if (!status.busy) return 'No stats yet'
    return files ? `Loading the stats · ${files}` : 'Loading the stats…'
  }
  // A game date has no time of day: read at UTC, so no time zone moves it to the day before.
  const day = DAY.format(new Date(`${status.through.date}T00:00:00Z`))
  if (seasonComplete(league, status, new Date(now))) {
    const done = `${league.seasonLabel(status.through.season)} season complete · data through ${day}`
    if (status.paused) return `${done} · paused`
    if (!status.busy) return done
    return files ? `${done} · updating ${files}` : `${done} · updating…`
  }
  const through = `Data through ${day}`
  if (status.paused) return `${through} · paused`
  if (!status.busy) return `${through} · updated ${relativeTime(status.updatedAt, now)}`
  return files ? `${through} · updating ${files}` : `${through} · updating…`
}

/** What the season-type control offers: one type, or every game that counts. */
export type SeasonType = 'regular' | 'play-in' | 'playoffs' | 'cup-final' | 'counted' | 'all-star'

/** The types that count, as the league on screen has them (the registry's `countedTypes`). */
const counted = (): GameType[] => [...currentLeague().countedTypes]

const TYPE_LABELS: Record<SeasonType, string> = {
  regular: 'Regular season',
  'play-in': 'Play-in',
  playoffs: 'Playoffs',
  'cup-final': 'Cup final',
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

/** A type's name; where the league names it its own way (the NBA Cup final), the league's. */
export const typeLabel = (type: SeasonType): string =>
  (type !== 'counted' && currentLeague().typeNames[type]) || TYPE_LABELS[type]

/**
 * The types a season has box scores for. Preseason games have none anywhere, so they never appear,
 * and "Regular season and after" only when there is an after.
 */
export function seasonTypes(season: StatsSeason | undefined): SeasonType[] {
  if (!season) return ['regular']
  const has = new Set(season.types.map((t) => t.type))
  const held = counted().filter((t) => has.has(t))
  return [
    ...(held as SeasonType[]),
    ...(held.length > 1 ? (['counted'] as const) : []),
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
    gameTypes: scope.seasonType === 'counted' ? counted() : [scope.seasonType]
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

/** "Jan 5". A game date has no time of day: read at UTC, so no time zone moves it. */
export const shortDay = (date: string): string => SHORT_DAY.format(new Date(`${date}T00:00:00Z`))

/** "Jan 5, 2026". */
export const fullDay = (date: string): string => DAY.format(new Date(`${date}T00:00:00Z`))

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
