import { useEffect, useState } from 'react'
import { StatsNav } from '@/components/stats/StatsNav'
import { api } from '@/lib/api'
import { useNoteScreen } from '@/lib/dev/noteContext'
import { errorMessage } from '@/lib/format'
import type { NavLocation } from '@/lib/navHistory'
import { NAV_ITEMS, type StatsScreen } from '@/lib/stats/screens'
import type { StatsStatus } from '@shared/stats/types'
import type { UpdateState } from '@shared/types'

/** A page to open: Back, or a dev note's "Go there"; a new nonce opens it again. */
export interface StatsFocus {
  location: NavLocation
  nonce: number
}

interface StatsAppProps {
  update: UpdateState
  version: string | null
  onOpenUpdate: () => void
  onToggleTheme: () => void
  focus?: StatsFocus | null
  /** Every page shown, for Back. */
  onLocation?: (location: NavLocation) => void
  canGoBack?: boolean
  onBack?: () => void
}

/** The app's shell: the nav, the status of the stats database, and the screen. */
export function StatsApp({
  update,
  version,
  onOpenUpdate,
  onToggleTheme,
  focus = null,
  onLocation,
  canGoBack = false,
  onBack
}: StatsAppProps): React.JSX.Element {
  const [screen, setScreen] = useState<StatsScreen>('home')
  const [status, setStatus] = useState<StatsStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  if (focus && focus.nonce !== focused) {
    setFocused(focus.nonce)
    setScreen(focus.location.screen)
  }

  useEffect(() => {
    void api.stats
      .status()
      .then(setStatus)
      .catch((err) => setError(errorMessage(err)))
  }, [])

  useEffect(() => {
    onLocation?.({ screen, team: null, player: null })
  }, [screen, onLocation])

  useNoteScreen(screen)

  const unavailable = status !== null && !status.available
  const label = NAV_ITEMS.find((i) => i.id === screen)?.label
  return (
    <div className="flex h-full flex-col bg-paper text-fg">
      <StatsNav
        current={screen}
        onNavigate={setScreen}
        canGoBack={canGoBack}
        onBack={onBack}
        status={status}
        update={update}
        version={version}
        onOpenUpdate={onOpenUpdate}
        onToggleTheme={onToggleTheme}
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto">
        {unavailable || error ? (
          <div className="py-20 text-center text-[13px] text-bad">
            {error ?? 'The stats database could not be opened on this computer.'}
          </div>
        ) : (
          <div className="py-20 text-center">
            <h1 className="text-[15px] font-semibold">{label}</h1>
            <p className="mt-2 text-[13px] text-fg-3">
              No stats yet: NBA data has not been loaded.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
