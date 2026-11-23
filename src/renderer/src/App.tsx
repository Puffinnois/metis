import { useCallback, useEffect, useRef, useState } from 'react'
import { DevTools } from '@/components/dev/DevTools'
import { UpdateDialog } from '@/components/UpdateDialog'
import { api } from '@/lib/api'
import { isBackGesture, useBackStack, type NavLocation } from '@/lib/navHistory'
import { currentLeague, setLeague, useLeague } from '@/lib/stats/league'
import { NAV_ITEMS, type StatsScreen } from '@/lib/stats/screens'
import { createSessionStore, SessionContext } from '@/lib/stats/session'
import { useTheme } from '@/lib/theme'
import { useUpdateState } from '@/lib/useUpdateState'
import { FavouritesProvider } from '@/screens/stats/FavouritesProvider'
import { StatsApp, type StatsFocus } from '@/screens/stats/StatsApp'
import type { NoteContext } from '@shared/devNotes'

const SCREENS = new Set<string>([...NAV_ITEMS.map((i) => i.id), 'players', 'teams'])

export default function App(): React.JSX.Element {
  const update = useUpdateState()
  const [version, setVersion] = useState<string | null>(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [, toggleTheme] = useTheme()
  // The shell is built for the league on screen, and again for each league switched to (D35).
  const league = useLeague()
  // The main process keeps the league on screen's stats worker open and closes the others once idle
  // (D22's addition of 2026-11-22).
  useEffect(() => {
    void api.leagues.onScreen(league.id).catch(() => undefined)
  }, [league.id])
  // Each league's session, kept here above the shell for when the league is back on screen.
  const [sessions] = useState(createSessionStore)
  const [focus, setFocus] = useState<StatsFocus | null>(null)
  const nonce = useRef(0)
  const open = useCallback((location: NavLocation) => {
    nonce.current += 1
    setFocus({ location, nonce: nonce.current })
  }, [])
  const focused = useCallback(() => setFocus(null), [])

  // A dev note's "Go there": the screen the note was written on.
  const goTo = useCallback(
    (context: NoteContext) => {
      if (SCREENS.has(context.screen)) {
        open({
          league: currentLeague().id,
          screen: context.screen as StatsScreen,
          team: null,
          player: null
        })
      }
    },
    [open]
  )

  // A page of any league: the league switches first, so its player, team or game is that league's
  // (D35). Back uses it, and so does a career strip's row of the other league (T1304.3).
  const openPage = useCallback(
    (to: NavLocation) => {
      if (to.league !== currentLeague().id) setLeague(to.league)
      open(to)
    },
    [open]
  )

  const history = useBackStack()
  const { back, leave } = history
  const goBack = useCallback(() => {
    const to = back()
    if (to) openPage(to)
  }, [back, openPage])
  // A page opened from another: the strip's rows, the league menu's move, the search's rows. One in
  // another season or league leaves the page on screen as it was, its scope kept for Back (T1304.5).
  const openMove = useCallback(
    (to: NavLocation) => {
      if (to.season !== undefined || to.league !== currentLeague().id) leave()
      openPage(to)
    },
    [leave, openPage]
  )

  useEffect(() => {
    const onGesture = (e: KeyboardEvent | MouseEvent): void => {
      if (!isBackGesture(e)) return
      e.preventDefault()
      goBack()
    }
    window.addEventListener('keydown', onGesture)
    window.addEventListener('mouseup', onGesture)
    return () => {
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('mouseup', onGesture)
    }
  }, [goBack])

  useEffect(() => {
    void api.app
      .version()
      .then(setVersion)
      .catch(() => setVersion(null))
  }, [])

  return (
    <DevTools screen="home" onGo={goTo}>
      <SessionContext.Provider value={sessions}>
        <FavouritesProvider>
          <StatsApp
            key={league.id}
            focus={focus}
            onFocused={focused}
            update={update}
            version={version}
            onOpenUpdate={() => setUpdateOpen(true)}
            onToggleTheme={toggleTheme}
            onLocation={history.report}
            canGoBack={history.canGoBack}
            onBack={goBack}
            onOpenPage={openMove}
          />
        </FavouritesProvider>
      </SessionContext.Provider>
      <UpdateDialog
        state={update}
        currentVersion={version ?? '?'}
        open={updateOpen}
        onOpenChange={setUpdateOpen}
      />
    </DevTools>
  )
}
