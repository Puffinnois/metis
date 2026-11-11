import { ScopeBar } from '@/components/stats/ScopeBar'
import { TabRow } from '@/components/stats/parts'
import type { ChartState } from '@/lib/stats/chart'
import type { CompareState } from '@/lib/stats/compare'
import { EXPLORE_TABS, type ExploreSubject, type ExploreTab } from '@/lib/stats/explore'
import type { StatsScope } from '@/lib/stats/scope'
import type { TrendsState } from '@/lib/stats/trends'
import type { StatsData } from '@/lib/stats/useStats'
import { StatsChart } from '@/screens/stats/StatsChart'
import { StatsCompare } from '@/screens/stats/StatsCompare'
import { StatsTrends } from '@/screens/stats/StatsTrends'

/** Explore: Chart, Compare and Trends over the shared scope, each tab's state kept by the app. */
export function StatsExplore({
  data,
  scope,
  onScope,
  tab,
  onTab,
  chart,
  onChart,
  compare,
  onCompare,
  trends,
  onTrends,
  trendsFallback,
  openCompare,
  onOpenPlayer,
  onOpenTeam
}: {
  data: StatsData
  scope: StatsScope
  onScope: (scope: StatsScope) => void
  tab: ExploreTab
  onTab: (tab: ExploreTab) => void
  chart: ChartState
  onChart: (update: (state: ChartState) => ChartState) => void
  compare: CompareState
  onCompare: (update: (state: CompareState) => CompareState) => void
  trends: TrendsState
  onTrends: (update: (state: TrendsState) => TrendsState) => void
  /** Trends' player or team when none is picked: the one a dashboard showed last. */
  trendsFallback: ExploreSubject | null
  /** Compare with these players or teams in it. */
  openCompare: (subjects: ExploreSubject[]) => void
  onOpenPlayer: (id: string) => void
  onOpenTeam: (id: string) => void
}): React.JSX.Element {
  // Last N of the team's games is offered for players only, so the scope bar follows the tab.
  const entity = tab === 'chart' ? chart.entity : tab === 'compare' ? compare.entity : 'player'
  return (
    <div className="flex flex-col gap-5 px-8 pt-[22px] pb-8">
      <TabRow label="Explore" tabs={EXPLORE_TABS} value={tab} onChange={onTab}>
        <div className="pb-2">
          <ScopeBar scope={scope} seasons={data.seasons} entity={entity} onChange={onScope} />
        </div>
      </TabRow>
      {tab === 'chart' && (
        <StatsChart
          data={data}
          scope={scope}
          onScope={onScope}
          state={chart}
          onState={onChart}
          onOpenPlayer={onOpenPlayer}
          onOpenTeam={onOpenTeam}
          onCompare={openCompare}
        />
      )}
      {tab === 'compare' && (
        <StatsCompare
          data={data}
          scope={scope}
          state={compare}
          onState={onCompare}
          onOpenPlayer={onOpenPlayer}
          onOpenTeam={onOpenTeam}
        />
      )}
      {tab === 'trends' && (
        <StatsTrends
          data={data}
          scope={scope}
          state={trends}
          onState={onTrends}
          fallback={trendsFallback}
          onOpenPlayer={onOpenPlayer}
          onOpenTeam={onOpenTeam}
        />
      )}
    </div>
  )
}
