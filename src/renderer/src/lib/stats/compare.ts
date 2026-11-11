import type { ExploreSubject } from '@/lib/stats/explore'
import type { Entity } from '@shared/stats/types'

/** Who Compare shows, kept for the session. T802 fills this in. */
export interface CompareState {
  entity: Entity
  subjects: ExploreSubject[]
}

export const DEFAULT_COMPARE: CompareState = { entity: 'player', subjects: [] }

/**
 * Compare opened from another screen (a dashboard, the chart's picks) with these players or teams.
 * An empty list keeps what Compare had.
 */
export function compareWith(state: CompareState, subjects: ExploreSubject[]): CompareState {
  if (!subjects.length) return state
  return { ...state, entity: subjects[0].entity, subjects }
}
