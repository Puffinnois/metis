import type { BoardMode, MetricInfo, StatsResult, StatsRow } from '@shared/stats/types'
import { boardModes } from './leaderboard'
import { cellTitle, fmtStat, ordinal } from './format'
import { inLeague } from './league'

/** What the player and team dashboards share: titled lists of metrics, each read against its pool. */

/** The dashboards open per game, the way a season is usually read. */
/** A dashboard's modes: per game first, then the board's, in the league on screen. */
export const dashboardModes = (): { value: BoardMode; label: string }[] => {
  const modes = boardModes()
  return [modes[1], modes[0], ...modes.slice(2)]
}

export interface SectionDef {
  title: string
  /** A line under the title; `{league}` and `{shotsFrom}` read the league on screen (`inLeague`). */
  note?: string
  metrics: string[]
}

export interface StatLine {
  metric: string
  label: string
  value: string
  /** 0–100 among the qualified rows; null below the sample or with no value. */
  percentile: number | null
  /** "12th"; a metric with no better side has none. */
  rank: string | null
  /** Why there is no value: "Recorded from 1996-97." */
  missing: string | null
  title: string
  info: MetricInfo | undefined
  /** Shaded as having no better side, for a line with no metric behind it. */
  neutral?: boolean
}

export interface SectionView {
  title: string
  note?: string
  lines: StatLine[]
}

/**
 * The tabs the league on screen shows (Plan T1301.9): one whose every metric the league does not have
 * (the WNBA's Tracking, Play types and Matchups: no release publishes them) is left out, and the
 * Glossary still lists those metrics with the reason. A tab with no sections, or a metric the catalogue
 * does not know, keeps the tab; so does every tab before the catalogue answers.
 */
export function shownTabs<T extends string>(
  tabs: readonly { id: T; label: string }[],
  sections: Partial<Record<T, readonly SectionDef[]>>,
  byId: ReadonlyMap<string, MetricInfo>
): { id: T; label: string }[] {
  if (byId.size === 0) return [...tabs]
  return tabs.filter((t) => {
    const of = sections[t.id]
    if (!of) return true
    return sectionMetrics(of).some((id) => !byId.get(id)?.unavailable)
  })
}

/** The tab to show: the one asked for, or the first when the league on screen has no such tab. */
export const shownTab = <T extends string>(tab: T, tabs: readonly { id: T }[]): T =>
  tabs.some((t) => t.id === tab) ? tab : (tabs[0]?.id ?? tab)

/** Every metric of some sections, once, in order. */
export const sectionMetrics = (sections: readonly SectionDef[]): string[] => [
  ...new Set(sections.flatMap((s) => s.metrics))
]

export function statLine(
  metric: string,
  result: StatsResult,
  row: StatsRow | undefined,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  /** The position group a player is ranked in; null for a team. */
  position: string | null
): StatLine {
  const info = byId.get(metric)
  const v = row?.values[metric]
  return {
    metric,
    label: info?.label ?? metric,
    value: fmtStat(v?.value ?? null, info ?? { unit: 'number', decimals: 1 }, mode),
    percentile: v?.percentile ?? null,
    rank:
      v?.rank !== null && v?.rank !== undefined && info?.direction !== 'neutral'
        ? ordinal(v.rank)
        : null,
    missing: result.columns.find((c) => c.id === metric)?.reason ?? null,
    title: v && info ? cellTitle(v, info, position) : '',
    info
  }
}

/** The sections' lines for one row of a query that asked for all their metrics. */
export function sectionViews(
  sections: readonly SectionDef[],
  result: StatsResult,
  id: string,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  position: string | null
): SectionView[] {
  const row = result.rows.find((r) => r.id === id)
  return sections.map((s) => ({
    title: s.title,
    ...(s.note ? { note: inLeague(s.note) } : {}),
    lines: s.metrics.map((m) => statLine(m, result, row, byId, mode, position))
  }))
}

/** A line of a chart: one value per game, in order. */
export interface ChartPoint {
  key: string
  /** The axis: "Jan 5". */
  label: string
  /** The hover: "Jan 5 vs BOS". */
  title: string
  value: number | null
}

export interface ChartSeries {
  id: string
  label: string
  points: ChartPoint[]
}
