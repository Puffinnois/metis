import type { CompareState } from '@/lib/stats/compare'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsData } from '@/lib/stats/useStats'

export interface CompareProps {
  data: StatsData
  scope: StatsScope
  state: CompareState
  onState: (update: (state: CompareState) => CompareState) => void
  onOpenPlayer: (id: string) => void
  onOpenTeam: (id: string) => void
}

/** Players or teams side by side. A placeholder until T802 lands. */
export function StatsCompare({ state }: CompareProps): React.JSX.Element {
  return (
    <div
      className="py-20 text-center text-[13px] text-fg-3"
      data-subjects={state.subjects.map((s) => s.id).join(' ')}
    >
      Compare arrives with T802.
    </div>
  )
}
