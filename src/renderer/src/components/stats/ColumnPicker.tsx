import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { Columns3 } from 'lucide-react'
import { StatsButton } from '@/components/stats/controls'
import { familyLabel } from '@/lib/stats/format'
import { MAX_COLUMNS, pickable, searchKey, type TabDef } from '@/lib/stats/leaderboard'
import { cn } from '@/lib/utils'
import type { MetricInfo } from '@shared/stats/types'

/** Search the catalogue, check to add (at the end) or remove, reset to the tab's. At most 40 columns. */
export function ColumnPicker({
  tab,
  catalogue,
  columns,
  onChange,
  onReset
}: {
  tab: TabDef
  catalogue: readonly MetricInfo[]
  columns: string[]
  onChange: (columns: string[]) => void
  onReset: () => void
}): React.JSX.Element {
  const [search, setSearch] = useState('')
  const offered = useMemo(() => pickable(catalogue, tab), [catalogue, tab])
  const needle = searchKey(search.trim())
  const shown = needle
    ? offered.filter((m) => searchKey(`${m.label} ${m.short} ${m.description}`).includes(needle))
    : offered
  const groups = new Map<string, MetricInfo[]>()
  for (const m of shown) {
    const key = familyLabel(m.family)
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  const chosen = new Set(columns)
  const full = columns.length >= MAX_COLUMNS
  const toggle = (id: string): void =>
    onChange(chosen.has(id) ? columns.filter((c) => c !== id) : [...columns, id])

  return (
    <Popover.Root>
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
          className="z-50 flex max-h-[min(560px,var(--radix-popover-content-available-height))] w-[380px] flex-col rounded-[10px] bg-panel shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          <div className="flex items-center gap-2 border-b border-line-2 p-2.5">
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
          <div className="min-h-0 flex-1 overflow-auto py-1">
            {[...groups].map(([family, metrics]) => (
              <div key={family}>
                <div className="sticky top-0 bg-panel px-3 pt-2 pb-1 text-[11px] font-medium tracking-[0.06em] text-fg-3 uppercase">
                  {family}
                </div>
                {metrics.map((m) => {
                  const on = chosen.has(m.id)
                  // The last column stays: a board needs one to query.
                  const locked = (on && columns.length === 1) || (!on && full)
                  return (
                    <label
                      key={m.id}
                      title={m.description}
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
