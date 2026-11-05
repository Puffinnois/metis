import type { StatsFamily, StatsFamilyState } from '@shared/stats/types'

const COUNT = new Intl.NumberFormat('en-US')

export const fmtCount = (n: number): string => COUNT.format(n)

/** "4.3 GB", "214 MB", "12 KB". */
export function fmtBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`
  if (bytes > 0) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return '–'
}

/** Seasons are labelled by their final year in the data (`2026`) and shown as `2025-26`. */
export function seasonLabel(season: number): string {
  return `${season - 1}-${String(season % 100).padStart(2, '0')}`
}

export function seasonRange(first: number | null, last: number | null): string {
  if (first === null || last === null) return 'All seasons'
  return first === last ? seasonLabel(first) : `${seasonLabel(first)} to ${seasonLabel(last)}`
}

export const STATE_LABELS: Record<StatsFamilyState, string> = {
  loaded: 'Loaded',
  partial: 'Part loaded',
  waiting: 'Waiting',
  failed: 'Failed'
}

export const TIER_LABELS: Record<StatsFamily['tier'], string> = {
  core: 'Core: schedules, box scores, rosters',
  published: 'Published: dashboards, tracking, play types',
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
