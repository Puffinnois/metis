import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Loading, Notes } from '@/components/stats/parts'
import { StatSections } from '@/components/stats/StatLines'
import { openAtFirst, type PageSection } from '@/lib/stats/categoryPage'
import type { SectionView } from '@/lib/stats/dashboard'
import { useStatsQuery } from '@/lib/stats/useStats'
import type { StatsQuery, StatsResult } from '@shared/stats/types'

const FRESH = { keepLast: false }

/**
 * A category's tab on a page (D52): each section folds, and an open one asks for its own metrics, at
 * most 40, so a long category (Shooting, 16 sub-groups) costs a query a section opened, never all of
 * them at once. Every metric of the category is a click away, with no search.
 */
export function CategorySections({
  sections,
  query,
  view,
  note,
  version
}: {
  sections: PageSection[]
  /** The query a section's metrics are read with: the player's position pool, the league's teams. */
  query: (metrics: string[]) => StatsQuery
  /** The section's lines from the pool's answer. */
  view: (section: PageSection, result: StatsResult) => SectionView[]
  /** A note under an open section: who the percentiles are among. */
  note: (result: StatsResult) => string
  version: string | null
}): React.JSX.Element {
  const [open, setOpen] = useState(() => openAtFirst(sections))
  const toggle = (key: string): void =>
    setOpen((was) => {
      const next = new Set(was)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return (
    <div className="flex flex-col gap-6">
      {sections.map((s) => (
        <section key={s.key} className="flex flex-col gap-3" data-page-section={s.key}>
          <button
            type="button"
            aria-expanded={open.has(s.key)}
            onClick={() => toggle(s.key)}
            className="flex cursor-pointer items-center gap-2 self-start text-left"
          >
            {open.has(s.key) ? (
              <ChevronDown className="size-4 text-fg-3" />
            ) : (
              <ChevronRight className="size-4 text-fg-3" />
            )}
            <span className="text-[15px] leading-none font-semibold tracking-[-0.01em]">
              {s.title}
            </span>
            <span className="text-[12px] text-fg-3">
              {s.metrics.length} {s.metrics.length === 1 ? 'metric' : 'metrics'}
            </span>
          </button>
          {open.has(s.key) && (
            <SectionBody section={s} query={query} view={view} note={note} version={version} />
          )}
        </section>
      ))}
    </div>
  )
}

function SectionBody({
  section,
  query,
  view,
  note,
  version
}: {
  section: PageSection
  query: (metrics: string[]) => StatsQuery
  view: (section: PageSection, result: StatsResult) => SectionView[]
  note: (result: StatsResult) => string
  version: string | null
}): React.JSX.Element {
  const q = useMemo(() => query(section.metrics), [query, section.metrics])
  const { result, error } = useStatsQuery(q, version, FRESH)
  if (!result) return <Loading error={error} />
  return (
    <div className="flex flex-col gap-3">
      {/* The section's head is the fold's button above, so its lines go untitled. */}
      <StatSections sections={view(section, result).map((v) => ({ ...v, title: '' }))} />
      <Notes notes={[note(result), ...result.notes]} />
    </div>
  )
}
