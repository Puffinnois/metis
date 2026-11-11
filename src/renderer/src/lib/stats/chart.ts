import type { Entity } from '@shared/stats/types'

/** What the chart shows, kept for the session. T801 fills this in. */
export interface ChartState {
  entity: Entity
}

export const DEFAULT_CHART: ChartState = { entity: 'player' }
