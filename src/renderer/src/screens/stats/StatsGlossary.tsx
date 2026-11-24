import { Search } from 'lucide-react'
import { Segmented, StatsSelect } from '@/components/stats/controls'
import { MetricCardBody } from '@/components/stats/MetricCard'
import { useScreenState } from '@/lib/stats/session'
import { familyLabel } from '@/lib/stats/format'
import {
  categoriesOf,
  glossarySections,
  placementLabel,
  primaryCategory
} from '@/lib/stats/glossary'
import { searchKey } from '@/lib/stats/leaderboard'
import {
  glossaryOrder,
  STABILITY_LEVELS,
  STABILITY_WORDS,
  type GlossaryOrder,
  type StabilityLevel
} from '@/lib/stats/stability'
import type { MetricFamily, MetricInfo } from '@shared/stats/types'

/** The sources, in the order the reference lists them: a metric's family (D52). */
const FAMILIES: MetricFamily[] = [
  'traditional',
  'shooting',
  'indexes',
  'shots',
  'plays',
  'possessions',
  'on_court',
  'scoring',
  'composite',
  'box_composites',
  'ratings',
  'tracking',
  'hustle',
  'play_types',
  'matchups',
  'impact',
  'raptor',
  'availability'
]

/**
 * Every metric the screens show, by category and sub-group (D52) or search, with its sample, seasons
 * and source. A metric is described under its primary category; a category it also sits in names it
 * with a link there.
 */
export function StatsGlossary({ catalogue }: { catalogue: MetricInfo[] }): React.JSX.Element {
  const [entity, setEntity] = useScreenState<'player' | 'team'>('glossary', 'entity', 'player')
  const [category, setCategory] = useScreenState<string>('glossary', 'category', '')
  const [family, setFamily] = useScreenState<MetricFamily | ''>('glossary', 'family', '')
  const [search, setSearch] = useScreenState('glossary', 'search', '')
  const [level, setLevel] = useScreenState<StabilityLevel | ''>('glossary', 'level', '')
  const [order, setOrder] = useScreenState<GlossaryOrder>('glossary', 'order', 'name')
  const needle = searchKey(search.trim())
  const ofEntity = catalogue.filter((m) => m.tier !== 'stored' && m.entity === entity)
  const categories = categoriesOf(ofEntity)
  // A category the other kind has and this one lacks (Predictive for players) reads as every one.
  const chosen = categories.some((c) => c.id === category) ? category : ''
  const shown = glossaryOrder(
    ofEntity.filter(
      (m) =>
        (!family || m.family === family) &&
        (!needle || searchKey(`${m.label} ${m.short} ${m.description}`).includes(needle))
    ),
    level,
    order
  )
  const sections = glossarySections(shown, chosen)
  const count = new Set(sections.flatMap((s) => [...s.described, ...s.alsoHere])).size
  const open = (m: MetricInfo): void => {
    setCategory(primaryCategory(m) ?? '')
    setSearch(m.label)
  }
  return (
    <div className="flex flex-col gap-5 px-8 pt-[22px] pb-7">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[28px] leading-none font-bold tracking-[-0.03em]">Glossary</h1>
          <div className="text-[13px] text-fg-2">
            {count} {entity} metrics · what each measures, its sample, the seasons it covers and how
            much it carries over
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
            title="Category"
            value={chosen}
            options={[
              { value: '', label: 'Every category' },
              ...categories.map((c) => ({ value: c.id, label: c.label }))
            ]}
            onChange={setCategory}
          />
          <StatsSelect
            title="Source"
            value={family}
            options={[
              { value: '' as const, label: 'Every source' },
              ...FAMILIES.map((f) => ({ value: f, label: familyLabel(f) }))
            ]}
            onChange={setFamily}
          />
          <StatsSelect
            title="Stability"
            value={level}
            options={[
              { value: '' as const, label: 'Any stability' },
              ...STABILITY_LEVELS.map((l) => ({ value: l, label: STABILITY_WORDS[l] }))
            ]}
            onChange={setLevel}
          />
          <StatsSelect
            title="Order"
            value={order}
            options={[
              { value: 'name' as const, label: 'By name' },
              { value: 'stability' as const, label: 'Most stable first' }
            ]}
            onChange={setOrder}
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
      {sections.map((s) => (
        <section
          key={`${s.category.id}.${s.group.id}`}
          className="flex flex-col gap-3"
          data-glossary-section={`${s.category.id}.${s.group.id}`}
        >
          <div className="flex items-baseline gap-3">
            <h2 className="m-0 text-[15px] font-semibold text-fg">
              {s.category.label} › {s.group.label}
            </h2>
            <span className="text-[12px] text-fg-3">{s.group.definition}</span>
          </div>
          {s.described.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {s.described.map((m) => (
                <article
                  key={m.id}
                  // Over 800 cards: the ones off screen are laid out and painted only when scrolled to,
                  // which took the first open from 500 ms to under it (Stage 10 gate).
                  className="rounded-[10px] bg-panel p-3.5 shadow-[0_0_0_1px_var(--line)] [contain-intrinsic-size:auto_300px] [content-visibility:auto]"
                >
                  <MetricCardBody info={m} className="w-full" />
                </article>
              ))}
            </div>
          )}
          {s.alsoHere.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-fg-2">
              <span className="text-fg-3">Also here, described under their own category:</span>
              {s.alsoHere.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => open(m)}
                  title={m.categories?.[0] ? placementLabel(m.categories[0]) : undefined}
                  className="cursor-pointer text-cobalt hover:underline"
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
      {sections.length === 0 && (
        <div className="py-16 text-center text-[13px] text-fg-3">No metric matches.</div>
      )}
    </div>
  )
}
