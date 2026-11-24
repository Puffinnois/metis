import type { MetricInfo, StatsResult } from '@shared/stats/types'
import type { SectionDef } from './dashboard'
import { categoryViews } from './categoryViews'
import type { TabDef } from './leaderboard'

/**
 * A player's or team's page by category (D52, Plan T1702.4): a tab per category the league has for
 * the kind, its sub-groups as sections. Every metric of the category is on its tab, folded or not, so
 * none needs a search; each section is one query of at most 40 metrics.
 */

/** A category's tab on a page: `cat:shooting`. */
export type CategoryTab = `cat:${string}`

export const categoryTab = (id: string): CategoryTab => `cat:${id}`

/** The category a page's tab shows, or null for Overview, the game log and the rest. */
export const categoryOfTab = (tab: string): string | null =>
  tab.startsWith('cat:') ? tab.slice(4) : null

/** One section of a category's tab: Key stats, a sub-group, or an umbrella's heading › sub-group. */
export interface PageSection extends SectionDef {
  key: string
}

/**
 * A category's sections on a page, in the board's order: Key stats, then each sub-group; an
 * umbrella's heading over 40 metrics as its specific sub-groups ("Shooting › Threes"). The same views
 * as the leaderboard's chips, so a page and a board read a category alike.
 */
export function pageSections(
  catalogue: readonly MetricInfo[],
  tab: TabDef,
  category: string
): PageSection[] {
  return categoryViews(catalogue, tab, category).flatMap((v) =>
    v.children
      ? v.children.map((c) => ({
          key: c.key,
          title: `${v.label} › ${c.label}`,
          metrics: c.metrics
        }))
      : [{ key: v.key, title: v.label, metrics: v.metrics }]
  )
}

/** Sections open when a tab opens: all of a short tab, else its Key stats and first sub-group. */
export const openAtFirst = (sections: readonly PageSection[]): Set<string> =>
  new Set((sections.length <= 4 ? sections : sections.slice(0, 2)).map((s) => s.key))

/**
 * The page tabs before categories, as old step files, the notes' context and a place kept in the
 * session name them, read as the category that now holds their metrics. Tracking's movement is
 * Hustle and movement's; Play by play's turnovers, fouls and assists start on Playmaking.
 */
export const OLD_PLAYER_TABS: Readonly<Record<string, CategoryTab>> = {
  scoring: 'cat:scoring',
  shooting: 'cat:shooting',
  shots: 'cat:shooting',
  plays: 'cat:playmaking',
  playmaking: 'cat:playmaking',
  rebounding: 'cat:rebounding',
  defense: 'cat:defense',
  tracking: 'cat:hustle',
  play_types: 'cat:play_types',
  matchups: 'cat:defense'
}

export const OLD_TEAM_TABS: Readonly<Record<string, CategoryTab>> = {
  offense: 'cat:offense',
  defense: 'cat:defense',
  shots: 'cat:shooting',
  plays: 'cat:playmaking'
}

/** How many of a section's metrics hold a value for the page's player or team in this scope. */
export function valuedCount(section: PageSection, result: StatsResult, subject: string): number {
  const row = result.rows.find((r) => r.id === subject)
  return section.metrics.filter((id) => {
    const v = row?.values[id]?.value
    return v !== null && v !== undefined
  }).length
}
