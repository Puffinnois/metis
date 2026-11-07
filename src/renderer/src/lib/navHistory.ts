import { useCallback, useRef, useState } from 'react'
import type { StatsScreen } from '@/lib/stats/screens'

/**
 * A page Back returns to: a screen and, on a dashboard, its player or team. Tabs, scopes and filters
 * stay as they are.
 */
export interface NavLocation {
  screen: StatsScreen
  team: string | null
  player: { id: string; position: string | null } | null
  /** The game open on Games. */
  game?: string | null
}

/** Pages kept; the oldest go first. */
export const BACK_LIMIT = 50

// The same player is the same page, whichever position they were opened under.
const keyOf = (l: NavLocation): string => JSON.stringify({ ...l, player: l.player?.id ?? null })

/** A dashboard that was waiting for its default, now showing it: the same page. */
function fillsIn(was: NavLocation, now: NavLocation): boolean {
  if (was.screen !== now.screen) return false
  return (
    (was.screen === 'team' && was.team === null) || (was.screen === 'player' && was.player === null)
  )
}

export interface BackStack {
  canGoBack: boolean
  /** Called with every page shown; a new one puts the page before it on the stack. */
  report: (location: NavLocation) => void
  /** The page to return to, taken off the stack; the next report is that page, not a new one. */
  back: () => NavLocation | null
}

export function useBackStack(): BackStack {
  const [stack, setStack] = useState<NavLocation[]>([])
  const current = useRef<NavLocation | null>(null)
  const restoring = useRef(false)

  const report = useCallback((location: NavLocation) => {
    const was = current.current
    current.current = location
    if (was === null || keyOf(was) === keyOf(location) || fillsIn(was, location)) return
    if (restoring.current) {
      restoring.current = false
      return
    }
    setStack((s) => [...s, was].slice(-BACK_LIMIT))
  }, [])

  const back = useCallback((): NavLocation | null => {
    const to = stack.at(-1)
    if (!to) return null
    restoring.current = true
    setStack(stack.slice(0, -1))
    return to
  }, [stack])

  return { canGoBack: stack.length > 0, report, back }
}

/** Alt+← and the mouse's back button; not while typing, where Alt+← belongs to the text. */
export function isBackGesture(e: KeyboardEvent | MouseEvent): boolean {
  if (e instanceof MouseEvent) return e.button === 3
  if (e.key !== 'ArrowLeft' || !e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return false
  const t = e.target
  return !(
    t instanceof HTMLElement &&
    (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
  )
}
