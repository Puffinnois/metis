import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, relative } from 'node:path'
import {
  appendNote,
  formatNotes,
  listNotes,
  nextNoteId,
  NOTE_MAX_IMAGES,
  notesForClaude,
  parseNotes,
  removeNote,
  serializeNote,
  setNoteStatus,
  type DevNote,
  type NewNote,
  type NoteContext,
  type NoteStatus,
  type NotesFile
} from '@shared/devNotes'

export const NOTES_FILE = 'notes.md'
const IMG_DIR = 'img'
const PNG_DATA_URL = /^data:image\/png;base64,/
const IMAGE_PATH = /^img\/[\w.-]+\.png$/

export interface NotesStore {
  /** The folder in use now. */
  dir(): string
  /** Newest first. */
  list(): DevNote[]
  /** Writes the images, then the note's section; returns the note as it reads back. */
  save(input: NewNote, extra: Omit<NoteContext, keyof NewNote['where']>): DevNote
  setStatus(id: string, status: NoteStatus): void
  /** Removes the section and its images. */
  remove(id: string): void
  /** A note's image as a data URL, for the list's thumbnails; null when it is gone. */
  image(path: string): string | null
  /** The notes' sections for a Claude session, image paths absolute. */
  forClaude(ids: string[]): string
}

/** Codes Windows gives while another program holds the file (antivirus, an editor). */
const BUSY = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RENAME_TRIES = 5
const RENAME_WAIT_MS = 50

function renameWithRetry(from: string, to: string): void {
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(from, to)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? ''
      if (!BUSY.has(code) || attempt >= RENAME_TRIES) throw err
      // A short synchronous wait: main writes the file in one go, between two IPC calls.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RENAME_WAIT_MS)
    }
  }
}

/**
 * The notes folder. Main owns the file: every change reads it, applies the
 * change and writes it atomically, so a hand edit made meanwhile is kept.
 */
export function createNotesStore(dir: () => string): NotesStore {
  const file = (): string => join(dir(), NOTES_FILE)

  const read = (): NotesFile => {
    const path = file()
    return parseNotes(existsSync(path) ? readFileSync(path, 'utf8') : '')
  }

  const write = (notes: NotesFile): void => {
    const path = file()
    mkdirSync(dirname(path), { recursive: true })
    const tmp = `${path}.${process.pid}.tmp`
    writeFileSync(tmp, formatNotes(notes))
    try {
      renameWithRetry(tmp, path)
    } catch (err) {
      rmSync(tmp, { force: true })
      throw err
    }
  }

  /**
   * An image's file: `img/<name>.png` and nothing else, so a hand-edited meta line can never name
   * `notes.md`, the folder, or a file outside it.
   */
  const imageFile = (path: string): string | null => {
    if (!IMAGE_PATH.test(path)) return null
    const imgDir = join(dir(), IMG_DIR)
    const full = normalize(join(dir(), path))
    const rel = relative(imgDir, full)
    return rel === '' || rel.startsWith('..') || isAbsolute(rel) || /[\\/]/.test(rel) ? null : full
  }

  return {
    dir,
    list: () => listNotes(read()).reverse(),
    save: (input, extra) => {
      const notes = read()
      const id = nextNoteId(notes)
      if (input.images.length > NOTE_MAX_IMAGES)
        throw new Error(`A note takes at most ${NOTE_MAX_IMAGES} images`)
      if (input.images.some((img) => !PNG_DATA_URL.test(img.dataUrl)))
        throw new Error('An attachment is not a PNG image')
      mkdirSync(join(dir(), IMG_DIR), { recursive: true })
      const images = input.images.map((img, i) => {
        const rel = `${IMG_DIR}/${id}-${i + 1}.png`
        writeFileSync(
          join(dir(), rel),
          Buffer.from(img.dataUrl.replace(PNG_DATA_URL, ''), 'base64')
        )
        return rel
      })
      const context: NoteContext = { ...input.where, ...extra }
      const raw = serializeNote(
        { id, tag: input.tag, status: 'open', created: extra.time, images },
        { text: input.text, context, errors: input.errors, kinds: input.images.map((i) => i.kind) }
      )
      const next = appendNote(notes, raw)
      write(next)
      const saved = listNotes(next).find((n) => n.id === id)
      if (!saved) throw new Error(`Note ${id} was not written`)
      return saved
    },
    setStatus: (id, status) => write(setNoteStatus(read(), id, status)),
    remove: (id) => {
      const notes = read()
      const note = listNotes(notes).find((n) => n.id === id)
      if (!note) return
      const rest = removeNote(notes, id)
      write(rest)
      // An image another note still lists (a hand edit) stays.
      const kept = new Set(listNotes(rest).flatMap((n) => n.images))
      for (const path of note.images) {
        const full = kept.has(path) ? null : imageFile(path)
        if (full) rmSync(full, { force: true })
      }
    },
    image: (path) => {
      const full = imageFile(path)
      if (!full || !existsSync(full)) return null
      return `data:image/png;base64,${readFileSync(full).toString('base64')}`
    },
    forClaude: (ids) => notesForClaude(read(), ids, (path) => join(dir(), path))
  }
}
