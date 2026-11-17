import { DEFAULT_LEAGUE, LEAGUES, leagueOf, type League, type LeagueId } from '@shared/leagues'
import type {
  LeagueDownload,
  LeagueDownloads,
  StatsFamily,
  StatsFamilyState,
  StatsStatus
} from '@shared/stats/types'
import { currentLeague, seasonLabel } from './league'

const COUNT = new Intl.NumberFormat('en-US')

export const fmtCount = (n: number): string => COUNT.format(n)

/** "4.3 GB", "214 MB", "12 KB". */
export function fmtBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`
  if (bytes > 0) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return '–'
}

/** A season as the league on screen writes it (`2025-26` in the NBA, `2026` in the WNBA). */
export { seasonLabel }

/** A range of seasons as `league` writes them (the league on screen unless named). */
export function seasonRange(
  first: number | null,
  last: number | null,
  league: League = currentLeague()
): string {
  if (first === null || last === null) return 'All seasons'
  const label = (s: number): string => league.seasonLabel(s)
  return first === last ? label(first) : `${label(first)} to ${label(last)}`
}

export const STATE_LABELS: Record<StatsFamilyState, string> = {
  loaded: 'Loaded',
  partial: 'Part loaded',
  waiting: 'Waiting',
  failed: 'Failed',
  'left-out': 'Not in this version'
}

export const TIER_LABELS: Record<StatsFamily['tier'], string> = {
  core: 'Core: schedules, box scores, rosters',
  published: 'Published: dashboards, tracking, play types, impact',
  events: 'Events: shots, possessions, lineups',
  plays: 'Play by play'
}

export interface TierGroup {
  tier: StatsFamily['tier']
  label: string
  families: StatsFamily[]
}

/** Families grouped by tier, in load order. */
export function byTier(families: StatsFamily[]): TierGroup[] {
  const groups: TierGroup[] = []
  for (const family of families) {
    const last = groups.at(-1)
    if (last?.tier === family.tier) last.families.push(family)
    else groups.push({ tier: family.tier, label: TIER_LABELS[family.tier], families: [family] })
  }
  return groups
}

export interface DataTotals {
  filesLoaded: number
  filesExpected: number
}

export function totals(families: StatsFamily[]): DataTotals {
  return families.reduce(
    (sum, f) => ({
      filesLoaded: sum.filesLoaded + f.filesLoaded,
      filesExpected: sum.filesExpected + f.filesExpected
    }),
    { filesLoaded: 0, filesExpected: 0 }
  )
}

/** The choice a first run offers before anything is ticked by the user: the default league alone. */
export function defaultChoice(): Record<LeagueId, boolean> {
  return Object.fromEntries(
    Object.values(LEAGUES).map((l) => [l.id, l.id === DEFAULT_LEAGUE])
  ) as Record<LeagueId, boolean>
}

export interface FirstRunRow {
  league: League
  /** What its first load downloads and the file it leaves, as measured (`League.size`). */
  downloadBytes: number
  fileBytes: number
  /** The free space its first load needs now. */
  roomNeeded: number
  /** Whether the free space covers it alone; true when the system will not say. */
  fits: boolean
}

/** One row per league for the first run's question, in the registry's order. */
export function firstRunRows(downloads: LeagueDownloads): FirstRunRow[] {
  return downloads.leagues.map((d) => {
    const league = leagueOf(d.league)
    return {
      league,
      downloadBytes: league.size.downloadBytes,
      fileBytes: league.size.fileBytes,
      roomNeeded: d.roomNeeded,
      fits: downloads.freeBytes === null || downloads.freeBytes >= d.roomNeeded
    }
  })
}

/**
 * Why the chosen leagues cannot all load, or null: their first loads together need more room than is
 * free (each league's own check is `fits`). Nothing is refused when the system will not say.
 */
export function roomProblem(
  choice: Partial<Record<LeagueId, boolean>>,
  downloads: LeagueDownloads
): string | null {
  const needed = downloads.leagues
    .filter((d) => choice[d.league])
    .reduce((sum, d) => sum + d.roomNeeded, 0)
  if (downloads.freeBytes === null || needed <= downloads.freeBytes) return null
  return `Not enough disk space: this needs ${fmtBytes(needed)}, and ${fmtBytes(downloads.freeBytes)} is free.`
}

/** A league's line in the Data panel: whether it downloads, and what it is doing now. */
export function leagueState(download: LeagueDownload, status: StatsStatus | null): string {
  if (!download.on) return download.hasFile ? 'Off: kept, not refreshed' : 'Off'
  if (status?.noRoom) return 'Not enough disk space'
  if (status?.paused) return 'Paused'
  if (status?.busy) {
    return status.progress
      ? `Loading: ${fmtCount(status.progress.done)} of ${fmtCount(status.progress.total)} files`
      : 'Loading'
  }
  return 'On'
}
