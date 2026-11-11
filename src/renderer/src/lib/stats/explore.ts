import type { Entity } from '@shared/stats/types'

/** Explore's tabs: Chart, Compare and Trends, each over the shared scope. */
export type ExploreTab = 'chart' | 'compare' | 'trends'

export const EXPLORE_TABS: { id: ExploreTab; label: string }[] = [
  { id: 'chart', label: 'Chart' },
  { id: 'compare', label: 'Compare' },
  { id: 'trends', label: 'Trends' }
]

export const DEFAULT_EXPLORE_TAB: ExploreTab = 'chart'

/** A player or a team, as Explore's tabs and the screens that open them name one. */
export interface ExploreSubject {
  entity: Entity
  id: string
}

/** The tab with this label, for a dev note or a test; anything else is the default. */
export function exploreTab(label: string): ExploreTab {
  return EXPLORE_TABS.find((t) => t.label === label || t.id === label)?.id ?? DEFAULT_EXPLORE_TAB
}

/**
 * The player or team a dashboard showed last, kept so Trends can open on them. A screen with
 * neither keeps what was there: going to the leaderboards and back does not forget it.
 */
export function lastSubject(
  was: ExploreSubject | null,
  screen: string,
  player: string | null,
  team: string | null
): ExploreSubject | null {
  const now: ExploreSubject | null =
    screen === 'player' && player !== null
      ? { entity: 'player', id: player }
      : screen === 'team' && team !== null
        ? { entity: 'team', id: team }
        : null
  if (now === null) return was
  return was !== null && was.entity === now.entity && was.id === now.id ? was : now
}
