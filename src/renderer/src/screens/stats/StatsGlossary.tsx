import { useState } from 'react'
import { Search } from 'lucide-react'
import { Segmented, StatsSelect } from '@/components/stats/controls'
import { MetricCardBody } from '@/components/stats/MetricCard'
import { familyLabel } from '@/lib/stats/format'
import { searchKey } from '@/lib/stats/leaderboard'
import type { MetricFamily, MetricInfo } from '@shared/stats/types'

const FAMILIES: MetricFamily[] = [
  'traditional',
  'shooting',
  'shots',
  'plays',
  'possessions',
  'on_court',
  'scoring',
  'composite',
  'tracking',
  'hustle',
  'play_types',
  'matchups',
  'impact',
  'availability'
]

/** Every metric the screens show, by family or search, with its sample, seasons and source. */
export function StatsGlossary({ catalogue }: { catalogue: MetricInfo[] }): React.JSX.Element {
  const [entity, setEntity] = useState<'player' | 'team'>('player')
  const [family, setFamily] = useState<MetricFamily | ''>('')
  const [search, setSearch] = useState('')
  const needle = searchKey(search.trim())
  const shown = catalogue
    .filter(
      (m) =>
        m.tier !== 'stored' &&
        m.entity === entity &&
        (!family || m.family === family) &&
        (!needle || searchKey(`${m.label} ${m.short} ${m.description}`).includes(needle))
    )
    .sort((a, b) => a.label.localeCompare(b.label))
  return (
    <div className="flex flex-col gap-5 px-8 pt-[22px] pb-7">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[28px] leading-none font-bold tracking-[-0.03em]">Glossary</h1>
          <div className="text-[13px] text-fg-2">
            {shown.length} {entity} metrics · what each measures, its sample, and the seasons it
            covers
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="Players or teams"
            value={entity}
            options={[
              { value: 'player', label: 'Players' },
              { value: 'team', label: 'Teams' }
            ]}
            onChange={setEntity}
          />
          <StatsSelect
            title="Family"
            value={family}
            options={[
              { value: '' as const, label: 'Every family' },
              ...FAMILIES.map((f) => ({ value: f, label: familyLabel(f) }))
            ]}
            onChange={setFamily}
          />
          <label className="flex h-7 w-[200px] items-center gap-[7px] rounded-[7px] border border-line bg-panel px-2.5 text-fg-3">
            <Search className="size-3.5 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search metrics"
              aria-label="Search metrics"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none"
            />
          </label>
        </div>
      </header>
      <div className="grid grid-cols-3 gap-4">
        {shown.map((m) => (
          <article
            key={m.id}
            className="rounded-[10px] bg-panel p-3.5 shadow-[0_0_0_1px_var(--line)]"
          >
            <MetricCardBody info={m} className="w-full" />
          </article>
        ))}
      </div>
      {shown.length === 0 && (
        <div className="py-16 text-center text-[13px] text-fg-3">No metric matches.</div>
      )}
    </div>
  )
}
