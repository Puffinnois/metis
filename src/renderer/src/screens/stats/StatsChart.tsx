import type { ChartState } from '@/lib/stats/chart'
import type { ExploreSubject } from '@/lib/stats/explore'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsData } from '@/lib/stats/useStats'

export interface ChartProps {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  state: ChartState
  onState: (update: (state: ChartState) => ChartState) => void
  onOpenPlayer: (id: string) => void
  onOpenTeam: (id: string) => void
  /** The points picked on the chart, opened in Compare. */
  onCompare: (subjects: ExploreSubject[]) => void
}

/** Any metric against another. A placeholder until T801 lands. */
export function StatsChart({ state }: ChartProps): React.JSX.Element {
  return (
    <div className="py-20 text-center text-[13px] text-fg-3" data-entity={state.entity}>
      Chart arrives with T801.
    </div>
  )
}
