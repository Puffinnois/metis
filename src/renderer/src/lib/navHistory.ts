import { useCallback, useRef, useState } from 'react'
import type { PlayerTab } from '@/lib/stats/player'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsScreen } from '@/lib/stats/screens'
import type { LeagueId } from '@shared/leagues'

/**
 * A page Back returns to: a league, a screen and, on a dashboard, its player or team. Tabs and
 * filters stay as they are, and so does the scope, except after a move that opened a page in another
 * season or league: Back then returns to the page as it was left, its scope included (T1304.5). A page
 * carries its league, so Back to a page of the other league switches back to it, and never shows one
 * league's player, team or game under the other's name.
 */
export interface NavLocation {
  league: LeagueId
  screen: StatsScreen
  team: string | null
  player: { id: string; position: string | null } | null
  /** The game open on Games. */
  game?: string | null
  /**
   * The season to show it in, where it is opened from another page: a strip row of the other league
   * opens that player in the row's season. Back never sets it, so a scope stays as it was left.
   */
  season?: number
  /**
   * The player dashboard's tab to open on: the league menu's move to the same player's page in the
   * paired league opens on the Overview (T1304.4). Back never sets it either.
   */
  playerTab?: PlayerTab
  /**
   * The scope the page is shown in, reported with it. It is not part of the page: a change of season
   * alone is no move. The stack keeps it only for a page left by a move to another season or league
   * (`leave`), and Back restores it there; elsewhere Back leaves the scope as it is, as it always has.
   */
  scope?: StatsScope
}

/** Pages kept; the oldest go first. */
export const BACK_LIMIT = 50

// The same player is the same page, whichever position they were opened under, in whatever scope.
const keyOf = (l: NavLocation): string =>
  JSON.stringify({ ...l, player: l.player?.id ?? null, scope: undefined })

const withoutScope = (l: NavLocation): NavLocation => {
  const rest = { ...l }
  delete rest.scope
  return rest
}

/** A dashboard that was waiting for its default, now showing it: the same page. */
function fillsIn(was: NavLocation, now: NavLocation): boolean {
  if (was.screen !== now.screen || was.league !== now.league) return false
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
  /**
   * The page on screen is being left by a move to another season or league (a strip's row, the league
   * menu's move to the same player, the search's rows of another season or league): the stack keeps
   * the scope it was left in, for Back to restore.
   */
  leave: () => void
}

export function useBackStack(): BackStack {
  const [stack, setStack] = useState<NavLocation[]>([])
  const current = useRef<NavLocation | null>(null)
  const restoring = useRef(false)
  // The page a move to another season or league is leaving, by its key: only that page keeps its scope.
  const leaving = useRef<string | null>(null)

  const report = useCallback((location: NavLocation) => {
    const was = current.current
    current.current = location
    if (was === null || keyOf(was) === keyOf(location) || fillsIn(was, location)) return
    const left = leaving.current === keyOf(was)
    leaving.current = null
    if (restoring.current) {
      restoring.current = false
      return
    }
    const kept = left ? was : withoutScope(was)
    setStack((s) => [...s, kept].slice(-BACK_LIMIT))
  }, [])

  const leave = useCallback(() => {
    leaving.current = current.current ? keyOf(current.current) : null
  }, [])

  const back = useCallback((): NavLocation | null => {
    const to = stack.at(-1)
    if (!to) return null
    restoring.current = true
    setStack(stack.slice(0, -1))
    return to
  }, [stack])

  return { canGoBack: stack.length > 0, report, back, leave }
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
