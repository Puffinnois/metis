import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { Columns3 } from 'lucide-react'
import { StatsButton, StatsSelect } from '@/components/stats/controls'
import { StabilityMark } from '@/components/stats/MetricCard'
import { boardCategories, pickerGroups } from '@/lib/stats/categoryViews'
import { familyLabel } from '@/lib/stats/format'
import { MAX_COLUMNS, searchKey, type TabDef } from '@/lib/stats/leaderboard'
import { cn } from '@/lib/utils'

/**
 * Search the catalogue, check to add (at the end) or remove, reset to the preset's. At most 40 columns.
 * The metrics are listed by category and sub-group (D52), each under every category it sits in; the
 * list opens on the board's category, and "Every category" lists them all.
 */
export function ColumnPicker({
  tab,
  catalogue,
  columns,
  onChange,
  onReset,
  category = ''
}: {
  tab: TabDef
  catalogue: Parameters<typeof pickerGroups>[0]
  columns: string[]
  onChange: (columns: string[]) => void
  onReset: () => void
  /** The board's category tab; empty for Overview, or a screen with no category (Compare). */
  category?: string
}): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [within, setWithin] = useState(category)
  const categories = useMemo(() => boardCategories(catalogue, tab), [catalogue, tab])
  const listed = categories.some((c) => c.id === within) ? within : ''
  const groups = useMemo(() => pickerGroups(catalogue, tab, listed), [catalogue, tab, listed])
  const needle = searchKey(search.trim())
  const shown = groups
    .map((g) => ({
      ...g,
      metrics: needle
        ? g.metrics.filter((m) =>
            searchKey(`${m.label} ${m.short} ${m.description}`).includes(needle)
          )
        : g.metrics
    }))
    .filter((g) => g.metrics.length > 0)
  const chosen = new Set(columns)
  const full = columns.length >= MAX_COLUMNS
  const toggle = (id: string): void =>
    onChange(chosen.has(id) ? columns.filter((c) => c !== id) : [...columns, id])

  return (
    <Popover.Root onOpenChange={(open) => open && setWithin(category)}>
      <Popover.Trigger asChild>
        <StatsButton title="Choose the columns">
          <Columns3 className="size-3.5" />
          Columns
          <span className="font-mono text-[11px] text-fg-3">{columns.length}</span>
        </StatsButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 flex max-h-[min(560px,var(--radix-popover-content-available-height))] w-[400px] flex-col rounded-[10px] bg-panel shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          <div className="flex flex-col gap-2 border-b border-line-2 p-2.5">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search metrics"
                aria-label="Search metrics"
                className="h-7 min-w-0 flex-1 rounded-[6px] border border-line bg-panel px-2 text-[12.5px] text-fg outline-none"
              />
              <button
                type="button"
                onClick={onReset}
                className="h-7 shrink-0 cursor-pointer rounded-[6px] px-2 text-[12px] font-medium text-fg-2 hover:bg-hover hover:text-fg"
              >
                Reset
              </button>
            </div>
            <StatsSelect
              title="Category of the columns"
              value={listed}
              options={[
                { value: '', label: 'Every category' },
                ...categories.map((c) => ({ value: c.id, label: c.label }))
              ]}
              onChange={setWithin}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto py-1">
            {shown.map((g) => (
              <div key={`${g.category.id}.${g.group.id}`}>
                <div className="sticky top-0 bg-panel px-3 pt-2 pb-1 text-[11px] font-medium tracking-[0.06em] text-fg-3 uppercase">
                  {listed ? g.group.label : `${g.category.label} › ${g.group.label}`}
                </div>
                {g.metrics.map((m) => {
                  const on = chosen.has(m.id)
                  // The last column stays: a board needs one to query.
                  const locked = (on && columns.length === 1) || (!on && full)
                  return (
                    <label
                      key={m.id}
                      title={`${m.description} From: ${familyLabel(m.family)}.`}
                      className={cn(
                        'flex h-[30px] cursor-pointer items-center gap-2 px-3 text-[12.5px] hover:bg-hover',
                        locked && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked}
                        onChange={() => toggle(m.id)}
                        className="accent-[var(--cobalt)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-fg">{m.label}</span>
                      <span className="font-mono text-[11px] text-fg-3">{m.short}</span>
                      <StabilityMark info={m} className="text-fg-3" />
                    </label>
                  )
                })}
              </div>
            ))}
            {shown.length === 0 && (
              <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                No metric matches.
              </div>
            )}
          </div>
          <div className="border-t border-line-2 px-3 py-2 text-[11.5px] text-fg-3">
            {columns.length} of {MAX_COLUMNS} columns · new ones go at the end
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
