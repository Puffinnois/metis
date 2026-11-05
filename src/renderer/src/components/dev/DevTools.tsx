import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { NotesPanel } from '@/components/dev/NotesPanel'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import { DevContext, type DevState, type PanelView } from '@/lib/dev/devState'
import { NoteContextRegistry, NoteContextRegistryContext } from '@/lib/dev/noteContext'
import type { NoteContext, NoteWhere } from '@shared/devNotes'

interface DevToolsProps {
  /** The app's screen; one registered with `useNoteScreen` wins. */
  screen: string
  /** "Go there": opens the note's screen. */
  onGo: (context: NoteContext) => void
  children: React.ReactNode
}

const TOAST_MS = 2500

/** Forwards renderer errors to main's recent-errors buffer, whatever the mode. */
function useErrorForwarding(): void {
  useEffect(() => {
    const onError = (e: ErrorEvent): void => {
      const err = e.error instanceof Error ? e.error : null
      api.dev.reportError({
        message: err ? `${err.name}: ${err.message}` : e.message,
        stack: err?.stack?.split('\n').slice(1).join('\n') ?? null
      })
    }
    const onRejection = (e: PromiseRejectionEvent): void => {
      const err = e.reason instanceof Error ? e.reason : null
      api.dev.reportError({
        message: `Unhandled rejection: ${err ? `${err.name}: ${err.message}` : String(e.reason)}`,
        stack: err?.stack?.split('\n').slice(1).join('\n') ?? null
      })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}

/**
 * Dev mode: Ctrl+Shift+D switches it anywhere; while on, the ✎ Note button,
 * Ctrl+Shift+N and the notes panel. Screens below register what is open with `useNoteContext`.
 */
export function DevTools({ screen, onGo, children }: DevToolsProps): React.JSX.Element {
  const registry = useMemo(() => new NoteContextRegistry(), [])
  const [on, setOnState] = useState(false)
  const [view, setView] = useState<PanelView | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  // Opening the panel, by any way, shows it expanded.
  const openNotes = useCallback((next: PanelView) => {
    setView(next)
    setCollapsed(false)
  }, [])
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useErrorForwarding()

  const flash = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  useEffect(() => {
    void api.dev
      .mode()
      .then(setOnState)
      .catch(() => setOnState(false))
    return api.dev.onModeChanged(setOnState)
  }, [])

  const setOn = useCallback(
    (next: boolean) => {
      api.dev
        .setMode(next)
        .then(() => {
          setOnState(next)
          if (!next) setView(null)
          flash(next ? 'Dev mode on' : 'Dev mode off')
        })
        .catch((err) => flash(errorMessage(err)))
    },
    [flash]
  )

  const openFolder = useCallback(() => {
    api.dev.notes.openFolder().catch((err) => flash(errorMessage(err)))
  }, [flash])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return
      if (e.code === 'KeyD') {
        e.preventDefault()
        setOn(!on)
      } else if (e.code === 'KeyN' && on) {
        e.preventDefault()
        openNotes('note')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on, setOn, openNotes])

  // Read when the panel asks, so it is where the developer is now.
  const screenRef = useRef(screen)
  useEffect(() => {
    screenRef.current = screen
  }, [screen])
  const where = useCallback((): NoteWhere => {
    return {
      ...registry.snapshot(screenRef.current),
      env: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      }
    }
  }, [registry])

  const state = useMemo<DevState>(
    () => ({ on, setOn, openNotes, openFolder }),
    [on, setOn, openNotes, openFolder]
  )

  return (
    <NoteContextRegistryContext.Provider value={registry}>
      <DevContext.Provider value={state}>
        {children}
        {on && (
          <>
            {view === null && (
              <button
                type="button"
                data-dev-overlay=""
                onClick={() => openNotes('note')}
                title="Write a dev note (Ctrl+Shift+N)"
                className="fixed right-4 bottom-4 z-50 flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 py-2 text-[12.5px] font-semibold text-fg shadow-[0_6px_20px_var(--shadow-c)] hover:bg-hover"
              >
                <NotebookPen className="size-4" />
                Note
              </button>
            )}
            <NotesPanel
              view={view}
              onView={setView}
              collapsed={collapsed}
              onCollapsed={setCollapsed}
              where={where}
              onSaved={(id) => flash(`Saved ${id}`)}
              onGo={(context) => {
                setView(null)
                onGo(context)
              }}
              onOpenFolder={openFolder}
            />
          </>
        )}
        {toast && (
          <div
            role="status"
            data-dev-overlay=""
            className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-medium text-paper shadow-[0_6px_20px_var(--shadow-c)]"
          >
            {toast}
          </div>
        )}
      </DevContext.Provider>
    </NoteContextRegistryContext.Provider>
  )
}
