import { CircleArrowUp } from 'lucide-react'
import type { UpdateState } from '@shared/types'

interface UpdatePillProps {
  state: UpdateState
  onOpen: () => void
}

function label(state: UpdateState): string | null {
  switch (state.status) {
    case 'available':
    case 'ready':
      return `Update to ${state.version}`
    case 'downloading':
      return `Downloading ${state.percent}%`
    default:
      return null
  }
}

/** Nav pill shown while an update is known; the dialog does the rest. */
export function UpdatePill({ state, onOpen }: UpdatePillProps): React.JSX.Element | null {
  const text = label(state)
  if (text === null) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full bg-good pr-3 pl-2.5 font-cond text-[13px] leading-none font-bold tracking-[0.08em] text-on-pos uppercase hover:brightness-105"
    >
      <CircleArrowUp className="size-3.5" />
      {text}
    </button>
  )
}
