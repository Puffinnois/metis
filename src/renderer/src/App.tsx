import { useCallback, useEffect, useState } from 'react'
import { DevTools } from '@/components/dev/DevTools'
import { UpdateDialog } from '@/components/UpdateDialog'
import { api } from '@/lib/api'
import { isBackGesture, useBackStack, type NavLocation } from '@/lib/navHistory'
import { NAV_ITEMS, type StatsScreen } from '@/lib/stats/screens'
import { useTheme } from '@/lib/theme'
import { useUpdateState } from '@/lib/useUpdateState'
import { StatsApp, type StatsFocus } from '@/screens/stats/StatsApp'
import type { NoteContext } from '@shared/devNotes'

const SCREENS = new Set<string>([...NAV_ITEMS.map((i) => i.id), 'players', 'teams'])

export default function App(): React.JSX.Element {
  const update = useUpdateState()
  const [version, setVersion] = useState<string | null>(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [, toggleTheme] = useTheme()
  const [focus, setFocus] = useState<StatsFocus | null>(null)
  const open = useCallback((location: NavLocation) => {
    setFocus((f) => ({ location, nonce: (f?.nonce ?? 0) + 1 }))
  }, [])

  // A dev note's "Go there": the screen the note was written on.
  const goTo = useCallback(
    (context: NoteContext) => {
      if (SCREENS.has(context.screen)) {
        open({ screen: context.screen as StatsScreen, team: null, player: null })
      }
    },
    [open]
  )

  const history = useBackStack()
  const { back } = history
  const goBack = useCallback(() => {
    const to = back()
    if (to) open(to)
  }, [back, open])

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
      <StatsApp
        focus={focus}
        update={update}
        version={version}
        onOpenUpdate={() => setUpdateOpen(true)}
        onToggleTheme={toggleTheme}
        onLocation={history.report}
        canGoBack={history.canGoBack}
        onBack={goBack}
      />
      <UpdateDialog
        state={update}
        currentVersion={version ?? '?'}
        open={updateOpen}
        onOpenChange={setUpdateOpen}
      />
    </DevTools>
  )
}
