import type { ExploreSubject } from '@/lib/stats/explore'
import type { StatsScope } from '@/lib/stats/scope'
import type { TrendsState } from '@/lib/stats/trends'
import type { StatsData } from '@/lib/stats/useStats'

export interface TrendsProps {
  data: StatsData
  scope: StatsScope
  state: TrendsState
  onState: (update: (state: TrendsState) => TrendsState) => void
  /** Who Trends shows when nobody is picked: the player or team a dashboard showed last. */
  fallback: ExploreSubject | null
  onOpenPlayer: (id: string) => void
  onOpenTeam: (id: string) => void
}

/** A metric by season across a career. A placeholder until T803 lands. */
export function StatsTrends({ state, fallback }: TrendsProps): React.JSX.Element {
  const subject = state.subject ?? fallback
  return (
    <div
      className="py-20 text-center text-[13px] text-fg-3"
      data-subject={subject ? `${subject.entity}:${subject.id}` : ''}
    >
      Trends arrives with T803.
    </div>
  )
}
