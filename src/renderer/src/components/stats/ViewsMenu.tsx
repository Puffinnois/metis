import { useState } from 'react'
import { Popover } from 'radix-ui'
import { Bookmark, X } from 'lucide-react'
import { StatsButton } from '@/components/stats/controls'
import { errorMessage } from '@/lib/format'
import { tabOf } from '@/lib/stats/leaderboard'
import type { StatsView } from '@shared/stats/types'

/** Open a saved leaderboard, save the current one under a name (the same name replaces it), delete one. */
export function ViewsMenu({
  views,
  onOpen,
  onSave,
  onDelete
}: {
  views: StatsView[]
  onOpen: (view: StatsView) => void
  /** Rejects with a readable message. */
  onSave: (name: string) => Promise<void>
  onDelete: (view: StatsView) => Promise<void>
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await onSave(name)
      setName('')
      setOpen(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <StatsButton title="Saved views">
          <Bookmark className="size-3.5" />
          Views
        </StatsButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 flex w-[300px] flex-col rounded-[10px] bg-panel text-[12.5px] shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          <div className="max-h-[260px] overflow-auto py-1">
            {views.length === 0 && (
              <div className="px-3 py-3 text-fg-3">
                No saved views yet. A view keeps the tab, columns, sort and filters. The season and
                dates stay the ones on screen.
              </div>
            )}
            {views.map((v) => (
              <div key={v.id} className="flex h-8 items-center gap-1 pr-1.5 pl-3 hover:bg-hover">
                <button
                  type="button"
                  onClick={() => {
                    onOpen(v)
                    setOpen(false)
                  }}
                  className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 text-left"
                >
                  <span className="truncate font-medium text-fg">{v.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-fg-3">
                    {v.board.entity === 'team' ? 'Teams' : 'Players'} ·{' '}
                    {tabOf(v.board.entity, v.board.tab).label}
                  </span>
                </button>
                <button
                  type="button"
                  title={`Delete "${v.name}"`}
                  aria-label={`Delete ${v.name}`}
                  onClick={() => void onDelete(v).catch((err) => setError(errorMessage(err)))}
                  className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[5px] text-fg-3 hover:bg-panel-2 hover:text-bad"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <form
            className="flex flex-col gap-1.5 border-t border-line-2 p-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <div className="flex gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this view"
                aria-label="View name"
                maxLength={60}
                className="h-7 min-w-0 flex-1 rounded-[6px] border border-line bg-panel px-2 text-fg outline-none"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="h-7 shrink-0 cursor-pointer rounded-[6px] bg-cobalt px-2.5 font-semibold text-on-cobalt disabled:cursor-default disabled:opacity-50"
              >
                Save
              </button>
            </div>
            {error && <div className="text-bad">{error}</div>}
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
