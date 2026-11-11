import type { ExploreSubject } from '@/lib/stats/explore'

/** Whose seasons Trends shows and which metric, kept for the session. T803 fills this in. */
export interface TrendsState {
  /** Null until one is picked or opened: Trends then shows the last dashboard's. */
  subject: ExploreSubject | null
  metric: string | null
}

export const DEFAULT_TRENDS: TrendsState = { subject: null, metric: null }

/** Trends opened from another screen on this player or team; no metric keeps the one shown. */
export function trendsFor(
  state: TrendsState,
  subject: ExploreSubject,
  metric?: string
): TrendsState {
  return { ...state, subject, metric: metric ?? state.metric }
}
