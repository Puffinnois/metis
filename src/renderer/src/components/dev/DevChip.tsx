import { useState } from 'react'
import { Popover } from 'radix-ui'
import { useDev } from '@/lib/dev/devState'

const ITEM =
  'flex h-8 w-full cursor-pointer items-center justify-between gap-4 px-3 text-left text-fg hover:bg-hover'

/**
 * The DEV chip, next to the version in both navs while Dev mode is on: Notes,
 * the notes folder, and turning Dev mode off.
 */
export function DevChip(): React.JSX.Element | null {
  const dev = useDev()
  const [open, setOpen] = useState(false)
  if (!dev?.on) return null
  const pick = (run: () => void) => () => {
    setOpen(false)
    run()
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Dev mode (Ctrl+Shift+D)"
          className="cursor-pointer rounded-[4px] bg-cobalt px-1.5 py-[3px] font-mono text-[10px] leading-none font-bold tracking-[0.06em] text-on-cobalt hover:opacity-90"
        >
          DEV
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[230px] rounded-[10px] bg-panel py-1 text-[12.5px] shadow-[0_0_0_1px_var(--line),0_10px_28px_rgba(0,0,0,0.18)]"
        >
          <button type="button" className={ITEM} onClick={pick(() => dev.openNotes('note'))}>
            New note <span className="font-mono text-[11px] text-fg-3">Ctrl+Shift+N</span>
          </button>
          <button type="button" className={ITEM} onClick={pick(() => dev.openNotes('list'))}>
            All notes
          </button>
          <button type="button" className={ITEM} onClick={pick(dev.openFolder)}>
            Open notes folder
          </button>
          <div className="my-1 h-px bg-line" />
          <button type="button" className={ITEM} onClick={pick(() => dev.setOn(false))}>
            Turn off Dev mode <span className="font-mono text-[11px] text-fg-3">Ctrl+Shift+D</span>
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
