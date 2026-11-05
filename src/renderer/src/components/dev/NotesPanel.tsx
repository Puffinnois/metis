import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, ChevronUp, RotateCw, Scissors, X } from 'lucide-react'
import { NotesList } from '@/components/dev/NotesList'
import { SnipOverlay } from '@/components/dev/SnipOverlay'
import { api } from '@/lib/api'
import { captureWindow } from '@/lib/dev/capture'
import type { PanelView } from '@/lib/dev/devState'
import { errorMessage } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  NOTE_MAX_IMAGES,
  NOTE_TAGS,
  formatErrors,
  tagLabel,
  whereSummary,
  type NoteContext,
  type NoteError,
  type NoteImageDraft,
  type NoteTag,
  type NoteWhere
} from '@shared/devNotes'

const DRAFT_KEY = 'metis.devNoteDraft'
const MARGIN = 16

interface Draft {
  text: string
  tag: NoteTag
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    const d = raw ? (JSON.parse(raw) as Partial<Draft>) : {}
    return {
      text: typeof d.text === 'string' ? d.text : '',
      tag: NOTE_TAGS.includes(d.tag as NoteTag) ? (d.tag as NoteTag) : 'idea'
    }
  } catch {
    return { text: '', tag: 'idea' }
  }
}

function storeDraft(draft: Draft | null): void {
  try {
    if (draft === null || draft.text === '') localStorage.removeItem(DRAFT_KEY)
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // a reload loses the draft, nothing else
  }
}

interface NotesPanelProps {
  /** null: closed (the draft is kept). */
  view: PanelView | null
  onView: (view: PanelView | null) => void
  /** Kept by `DevTools`, so opening the panel again always expands it. */
  collapsed: boolean
  onCollapsed: (collapsed: boolean) => void
  /** Where the developer is now. */
  where: () => NoteWhere
  onSaved: (id: string) => void
  onGo: (context: NoteContext) => void
  onOpenFolder: () => void
}

/**
 * The notes panel: docked bottom-right, draggable by its header, collapsible;
 * the app stays usable around it. Every capture hides it first (§2.1).
 */
export function NotesPanel({
  view,
  onView,
  collapsed,
  onCollapsed: setCollapsed,
  where: readWhere,
  onSaved,
  onGo,
  onOpenFolder
}: NotesPanelProps): React.JSX.Element | null {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [images, setImages] = useState<NoteImageDraft[]>([])
  const [where, setWhere] = useState<NoteWhere | null>(null)
  const [errors, setErrors] = useState<NoteError[]>([])
  // Off by default: the errors go in only when ticked, after a look if wanted.
  const [withErrors, setWithErrors] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [snipSource, setSnipSource] = useState<string | null>(null)
  // null: docked bottom-right; else where it was dragged to.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Both land together once the errors are read: the summary never shows without its count.
  const recapture = useCallback(() => {
    const done = (list: NoteError[]): void => {
      setWhere(readWhere())
      setErrors(list)
    }
    api.dev.recentErrors().then(done, () => done([]))
  }, [readWhere])

  // Captured when the panel opens on a new note.
  const opened = view !== null
  useEffect(() => {
    if (opened && where === null) recapture()
  }, [opened, where, recapture])

  useEffect(() => {
    if (view === 'note' && !collapsed) textRef.current?.focus()
  }, [view, collapsed])

  const update = (next: Draft): void => {
    setDraft(next)
    storeDraft(next)
  }

  const reset = (): void => {
    update({ text: '', tag: 'idea' })
    setImages([])
    setWhere(null)
    setErrors([])
    setWithErrors(false)
    setShowErrors(false)
    setShowContext(false)
    setProblem(null)
  }

  const shoot = async (snip: boolean): Promise<void> => {
    if (capturing) return
    setProblem(null)
    setCapturing(true)
    try {
      const shot = await captureWindow(api.dev.capture)
      if (snip) setSnipSource(shot)
      else setImages((list) => [...list, { kind: 'screenshot', dataUrl: shot }])
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setCapturing(false)
    }
    // Back to the text, so typing (and Esc) go to the panel.
    if (!snip) textRef.current?.focus()
  }

  const save = async (): Promise<void> => {
    if (draft.text.trim() === '' || busy) return
    setBusy(true)
    setProblem(null)
    try {
      const saved = await api.dev.notes.save({
        text: draft.text,
        tag: draft.tag,
        where: where ?? readWhere(),
        errors: withErrors ? errors : [],
        images
      })
      reset()
      onView(null)
      onSaved(saved.id)
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const startDrag = (e: React.PointerEvent): void => {
    if ((e.target as HTMLElement).closest('button')) return
    const panel = panelRef.current
    if (!panel) return
    const box = panel.getBoundingClientRect()
    const dx = e.clientX - box.left
    const dy = e.clientY - box.top
    const move = (ev: PointerEvent): void => {
      const left = Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - box.width)
      const top = Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - 40)
      setPos({ left, top })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (view === null) return null
  // One capture at a time: a second click while one runs could pass the limit.
  const full = images.length >= NOTE_MAX_IMAGES || capturing

  return (
    <>
      <div
        ref={panelRef}
        data-dev-overlay=""
        role="dialog"
        aria-label="Dev notes"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            setCollapsed(true)
          } else if (e.key === 'Enter' && e.ctrlKey && view === 'note') {
            e.preventDefault()
            void save()
          }
        }}
        style={pos ? { left: pos.left, top: pos.top } : { right: MARGIN, bottom: MARGIN }}
        className={cn(
          'fixed z-50 flex w-[380px] flex-col overflow-hidden rounded-[10px] border border-line bg-panel text-fg shadow-[0_18px_48px_var(--shadow-c)]',
          !collapsed && 'max-h-[min(560px,calc(100vh-32px))]',
          snipSource !== null && 'invisible'
        )}
      >
        <header
          onPointerDown={startDrag}
          className="flex h-10 shrink-0 cursor-move items-center gap-1 border-b border-line pr-1.5 pl-3 select-none"
        >
          {(['note', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                onView(v)
                setCollapsed(false)
              }}
              className={cn(
                'cursor-pointer rounded-[6px] px-2 py-1 text-[12px] font-semibold',
                view === v ? 'bg-panel-2 text-fg' : 'text-fg-3 hover:text-fg'
              )}
            >
              {v === 'note' ? 'Note' : 'All notes'}
            </button>
          ))}
          <span className="ml-1 rounded-[4px] bg-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold text-on-cobalt">
            DEV
          </span>
          <span className="flex-1" />
          <button
            type="button"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            title={collapsed ? 'Expand' : 'Collapse (Esc)'}
            onClick={() => setCollapsed(!collapsed)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-fg-2 hover:bg-hover hover:text-fg"
          >
            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Close"
            title="Close (the draft is kept)"
            onClick={() => onView(null)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-fg-2 hover:bg-hover hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </header>
        {!collapsed && view === 'list' && <NotesList onGo={onGo} onOpenFolder={onOpenFolder} />}
        {!collapsed && view === 'note' && (
          <div className="flex min-h-0 flex-col gap-3 overflow-auto p-3 text-[12.5px]">
            <textarea
              ref={textRef}
              aria-label="Note"
              value={draft.text}
              onChange={(e) => update({ ...draft, text: e.target.value })}
              placeholder="What should change? The first line is the title."
              rows={6}
              className="min-h-[110px] w-full resize-y rounded-[7px] border border-line bg-paper px-2.5 py-2 text-[13px] leading-[1.45] outline-none focus:border-fg-3"
            />
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Tag">
              {NOTE_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={draft.tag === t}
                  onClick={() => update({ ...draft, tag: t })}
                  className={cn(
                    'cursor-pointer rounded-full border px-2.5 py-1 text-[12px] font-medium',
                    draft.tag === t
                      ? 'border-fg bg-fg text-paper'
                      : 'border-line text-fg-2 hover:text-fg'
                  )}
                >
                  {tagLabel(t)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={full}
                onClick={() => void shoot(false)}
                title="The whole window, without this panel"
                className="flex cursor-pointer items-center gap-1.5 rounded-[7px] border border-line px-2.5 py-1.5 font-medium hover:bg-hover disabled:cursor-default disabled:opacity-40"
              >
                <Camera className="size-3.5" />
                Screenshot
              </button>
              <button
                type="button"
                disabled={full}
                onClick={() => void shoot(true)}
                title="Drag a box around the part you mean"
                className="flex cursor-pointer items-center gap-1.5 rounded-[7px] border border-line px-2.5 py-1.5 font-medium hover:bg-hover disabled:cursor-default disabled:opacity-40"
              >
                <Scissors className="size-3.5" />
                Snip
              </button>
              <span className="text-[11.5px] text-fg-3">
                {images.length}/{NOTE_MAX_IMAGES}
              </span>
            </div>
            {images.length > 0 && (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {images.map((img, i) => (
                  <li key={i} className="relative">
                    <img
                      src={img.dataUrl}
                      alt={`${img.kind === 'snip' ? 'Snip' : 'Screenshot'} ${i + 1}`}
                      className="h-[54px] max-w-[96px] rounded-[5px] border border-line object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove attachment ${i + 1}`}
                      onClick={() => setImages((list) => list.filter((_, k) => k !== i))}
                      className="absolute -top-1.5 -right-1.5 flex size-[18px] cursor-pointer items-center justify-center rounded-full bg-ink text-paper"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-[7px] bg-panel-2 px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-expanded={showContext}
                  onClick={() => setShowContext((s) => !s)}
                  className="min-w-0 flex-1 cursor-pointer truncate text-left text-fg-2 hover:text-fg"
                  title="Show the full context"
                >
                  {showContext ? '▾' : '▸'} {where ? whereSummary(where) : '…'}
                </button>
                <button
                  type="button"
                  aria-label="Capture the context again"
                  title="Capture the context again, from where you are now"
                  onClick={recapture}
                  className="flex size-6 cursor-pointer items-center justify-center rounded-[5px] text-fg-2 hover:bg-hover hover:text-fg"
                >
                  <RotateCw className="size-3.5" />
                </button>
              </div>
              {showContext && where && (
                <pre className="mt-2 max-h-[160px] overflow-auto font-mono text-[10.5px] leading-[1.4] text-fg-2">
                  {JSON.stringify(where, null, 2)}
                </pre>
              )}
              <div className="mt-1.5 flex items-center gap-2 text-fg-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={withErrors && errors.length > 0}
                    disabled={errors.length === 0}
                    onChange={(e) => setWithErrors(e.target.checked)}
                  />
                  {errors.length === 0
                    ? 'No recent errors'
                    : `Include recent errors (${errors.length})`}
                </label>
                {errors.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={showErrors}
                    onClick={() => setShowErrors((s) => !s)}
                    className="cursor-pointer text-fg-2 underline hover:text-fg"
                  >
                    {showErrors ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
              {showErrors && errors.length > 0 && (
                <pre className="mt-1.5 max-h-[160px] overflow-auto font-mono text-[10.5px] leading-[1.4] text-fg-2">
                  {formatErrors(errors)}
                </pre>
              )}
            </div>
            {problem && <p className="m-0 text-bad">{problem}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="cursor-pointer rounded-[7px] px-2.5 py-1.5 font-medium text-fg-2 hover:bg-hover hover:text-fg"
              >
                Discard
              </button>
              <span className="flex-1" />
              <button
                type="button"
                disabled={draft.text.trim() === '' || busy}
                onClick={() => void save()}
                title="Save (Ctrl+Enter)"
                className="cursor-pointer rounded-[7px] bg-ink px-3.5 py-1.5 font-semibold text-paper hover:opacity-90 disabled:cursor-default disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
      {snipSource !== null && (
        <SnipOverlay
          source={snipSource}
          onDone={(crop) => {
            setSnipSource(null)
            if (crop) setImages((list) => [...list, { kind: 'snip', dataUrl: crop }])
            // Once the panel is visible again: a hidden textarea takes no focus.
            requestAnimationFrame(() => textRef.current?.focus())
          }}
          onError={(message) => {
            setSnipSource(null)
            setProblem(message)
          }}
        />
      )}
    </>
  )
}
