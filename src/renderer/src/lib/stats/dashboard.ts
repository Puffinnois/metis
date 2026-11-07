import type { BoardMode, MetricInfo, StatsResult, StatsRow } from '@shared/stats/types'
import { BOARD_MODES } from './leaderboard'
import { cellTitle, fmtStat, ordinal } from './format'

/** What the player and team dashboards share: titled lists of metrics, each read against its pool. */

/** The dashboards open per game, the way a season is usually read. */
export const DASHBOARD_MODES: { value: BoardMode; label: string }[] = [
  BOARD_MODES[1],
  BOARD_MODES[0],
  ...BOARD_MODES.slice(2)
]

export interface SectionDef {
  title: string
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
}

export interface SectionView {
  title: string
  note?: string
  lines: StatLine[]
}

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
    ...(s.note ? { note: s.note } : {}),
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
