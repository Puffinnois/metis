import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, FolderOpen, MapPin, RotateCw, Trash } from 'lucide-react'
import { api } from '@/lib/api'
import { errorMessage, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { NOTE_TAGS, tagLabel, type DevNote, type NoteContext, type NoteTag } from '@shared/devNotes'

type StatusFilter = 'open' | 'done' | 'all'

/** Notes shown under the filters, newest first (the list comes newest first). */
function filterNotes(notes: DevNote[], status: StatusFilter, tag: NoteTag | 'all'): DevNote[] {
  return notes.filter(
    (n) => (status === 'all' || n.status === status) && (tag === 'all' || n.tag === tag)
  )
}

function Thumb({ path }: { path: string }): React.JSX.Element | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    api.dev.notes
      .image(path)
      .then((url) => live && setSrc(url))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [path])
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      className="h-[42px] w-[64px] shrink-0 rounded-[4px] border border-line object-cover"
    />
  )
}

const ACTION =
  'flex cursor-pointer items-center gap-1 rounded-[5px] px-1.5 py-1 text-fg-2 hover:bg-hover hover:text-fg'

interface NotesListProps {
  onGo: (context: NoteContext) => void
  onOpenFolder: () => void
}

/** All notes: filter, mark done, delete, copy for Claude, go there. */
export function NotesList({ onGo, onOpenFolder }: NotesListProps): React.JSX.Element {
  const [notes, setNotes] = useState<DevNote[] | null>(null)
  const [folder, setFolder] = useState('')
  const [status, setStatus] = useState<StatusFilter>('open')
  const [tag, setTag] = useState<NoteTag | 'all'>('all')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([api.dev.notes.list(), api.dev.notes.folder()])
      .then(([list, dir]) => {
        setNotes(list)
        setFolder(dir)
      })
      .catch((err) => setMessage(errorMessage(err)))
  }, [])
  useEffect(load, [load])

  const act = (work: Promise<unknown>, done?: string): void => {
    setMessage(null)
    work
      .then(() => {
        if (done) setMessage(done)
        load()
      })
      .catch((err) => setMessage(errorMessage(err)))
  }

  const shown = notes ? filterNotes(notes, status, tag) : []
  const open = notes?.filter((n) => n.status === 'open') ?? []

  return (
    <div className="flex min-h-0 flex-col text-[12.5px]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
        {(['open', 'done', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              'cursor-pointer rounded-full px-2 py-0.5 capitalize',
              status === s ? 'bg-fg text-paper' : 'text-fg-2 hover:text-fg'
            )}
          >
            {s}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <select
          aria-label="Tag"
          value={tag}
          onChange={(e) => setTag(e.target.value as NoteTag | 'all')}
          className="rounded-[5px] border border-line bg-paper px-1.5 py-0.5"
        >
          <option value="all">Every tag</option>
          {NOTE_TAGS.map((t) => (
            <option key={t} value={t}>
              {tagLabel(t)}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <button type="button" aria-label="Reload" title="Reload" onClick={load} className={ACTION}>
          <RotateCw className="size-3.5" />
        </button>
      </div>
      <ul className="m-0 min-h-0 flex-1 list-none overflow-auto p-0">
        {notes === null && <li className="px-3 py-6 text-center text-fg-3">Loading…</li>}
        {notes !== null && shown.length === 0 && (
          <li className="px-3 py-6 text-center text-fg-3">
            {notes.length === 0 ? 'No notes yet.' : 'No notes under these filters.'}
          </li>
        )}
        {shown.map((n) => (
          <li key={n.id} className="border-b border-line px-3 py-2.5">
            <div className="flex gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10.5px] text-fg-3">
                  {n.id} · {tagLabel(n.tag)} · {relativeTime(n.created)}
                  {n.status === 'done' && <span className="text-good"> · done</span>}
                </div>
                <div
                  className={cn(
                    'mt-0.5 font-medium',
                    n.status === 'done' && 'text-fg-3 line-through'
                  )}
                >
                  {n.title}
                </div>
                {n.where && (
                  <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{n.where}</div>
                )}
              </div>
              {n.images[0] && <Thumb path={n.images[0]} />}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button
                type="button"
                className={ACTION}
                onClick={() =>
                  act(api.dev.notes.setStatus(n.id, n.status === 'open' ? 'done' : 'open'))
                }
              >
                <Check className="size-3.5" />
                {n.status === 'open' ? 'Mark done' : 'Reopen'}
              </button>
              <button
                type="button"
                className={ACTION}
                title="Copy this note as Markdown, image paths absolute"
                onClick={() => act(api.dev.notes.copy([n.id]), `Copied ${n.id}`)}
              >
                <Copy className="size-3.5" />
                Copy for Claude
              </button>
              {n.context && (
                <button type="button" className={ACTION} onClick={() => onGo(n.context!)}>
                  <MapPin className="size-3.5" />
                  Go there
                </button>
              )}
              {confirming === n.id ? (
                <>
                  <button
                    type="button"
                    className={cn(ACTION, 'text-bad hover:text-bad')}
                    onClick={() => {
                      setConfirming(null)
                      act(api.dev.notes.remove(n.id), `Deleted ${n.id}`)
                    }}
                  >
                    Delete {n.id}
                  </button>
                  <button type="button" className={ACTION} onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </>
              ) : (
                <button type="button" className={ACTION} onClick={() => setConfirming(n.id)}>
                  <Trash className="size-3.5" />
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {message && <p className="m-0 border-t border-line px-3 py-1.5 text-fg-2">{message}</p>}
      <div className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-2">
        <button type="button" className={ACTION} onClick={onOpenFolder} title={folder}>
          <FolderOpen className="size-3.5" />
          Open folder
        </button>
        <button
          type="button"
          className={ACTION}
          onClick={() =>
            act(
              api.dev.notes.chooseFolder().then((dir) => {
                if (dir) setFolder(dir)
              })
            )
          }
        >
          Change folder…
        </button>
        <span className="flex-1" />
        <button
          type="button"
          className={ACTION}
          disabled={open.length === 0}
          onClick={() =>
            act(
              api.dev.notes.copy(open.map((n) => n.id)),
              `Copied ${open.length} open note${open.length === 1 ? '' : 's'}`
            )
          }
        >
          <Copy className="size-3.5" />
          Copy all open
        </button>
      </div>
    </div>
  )
}
