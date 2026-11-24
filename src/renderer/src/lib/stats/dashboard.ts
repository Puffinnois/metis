import type { BoardMode, MetricInfo, StatsResult, StatsRow } from '@shared/stats/types'
import { boardModes } from './leaderboard'
import { cellTitle, fmtStat, ordinal } from './format'
import { currentLeague, inLeague } from './league'
import type { League } from '@shared/leagues'

/** What the player and team dashboards share: titled lists of metrics, each read against its pool. */

/** The dashboards open per game, the way a season is usually read. */
/** A dashboard's modes: per game first, then the board's, in the league on screen. */
export const dashboardModes = (): { value: BoardMode; label: string }[] => {
  const modes = boardModes()
  return [modes[1], modes[0], ...modes.slice(2)]
}

export interface SectionDef {
  title: string
  /**
   * A line under the title; `{league}` and `{shotsFrom}` read the league on screen (`inLeague`), and
   * `{from:id}` and `{to:id}` a metric's seasons in it (`sectionNote`).
   */
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

/** The last season a metric covers before the run of missing seasons that ends its list, if any. */
function lastCovered(info: MetricInfo): number | null {
  const missing = new Set(info.missingSeasons ?? [])
  if (missing.size === 0) return null
  let s = Math.max(...missing)
  while (missing.has(s - 1)) s--
  return s - 1
}

/**
 * A section's note in the league on screen: `{from:id}` is the metric's first season there and
 * `{to:id}` its last before the seasons it stops in ("Tagged from 2016-17", "ESPN's play by play, 2006
 * to 2017"), so no note states one league's seasons in the other. A note naming a metric the league
 * does not have (or one with no last season) is left out: each line says why itself.
 */
export function sectionNote(
  note: string,
  byId: ReadonlyMap<string, MetricInfo>,
  league: League = currentLeague()
): string | undefined {
  let dropped = false
  const text = inLeague(note, league).replace(
    /\{(from|to):([a-z0-9_]+)\}/g,
    (_, kind: string, id: string) => {
      const info = byId.get(id)
      const season =
        !info || info.unavailable ? null : kind === 'from' ? info.firstSeason : lastCovered(info)
      if (season === null) {
        dropped = true
        return ''
      }
      return league.seasonLabel(season)
    }
  )
  return dropped ? undefined : text
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
  position: string | null,
  /** The count the page's line gives, for a metric ranked among another pool (`cellTitle`). */
  line?: number
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
    title: v && info ? cellTitle(v, info, position, line) : '',
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
  position: string | null,
  line?: number
): SectionView[] {
  const row = result.rows.find((r) => r.id === id)
  return sections.map((s) => ({
    title: s.title,
    ...(s.note && sectionNote(s.note, byId) ? { note: sectionNote(s.note, byId) } : {}),
    lines: s.metrics.map((m) => statLine(m, result, row, byId, mode, position, line))
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
