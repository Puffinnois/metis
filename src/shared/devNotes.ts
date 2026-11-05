/**
 * Dev notes: one Markdown file, one `##` section per note, oldest first. Each
 * section carries a `<!-- note {...} -->` line the app reads back; everything else is free text a
 * person or Claude may edit. Pure: main reads and writes the file, the renderer only sees notes.
 */

export type NoteTag = 'bug' | 'idea' | 'polish'
export type NoteStatus = 'open' | 'done'

export const NOTE_TAGS: NoteTag[] = ['bug', 'idea', 'polish']

/** Devat most six attachments a note. */
export const NOTE_MAX_IMAGES = 6

const TAG_LABEL: Record<NoteTag, string> = { bug: 'Bug', idea: 'Idea', polish: 'Polish' }

export function tagLabel(tag: NoteTag): string {
  return TAG_LABEL[tag]
}

/** One thing a screen says is open, e.g. the player file: a label for the summary line. */
export interface NoteContextPart {
  label: string
  data: Record<string, unknown>
}

/** What the renderer knows when the panel opens or ↻ is pressed. */
export interface NoteWhere {
  /** The screen id: `home`, `player`, `team` … */
  screen: string
  /** Keyed by part (`player`, `team`, `scope` …), in the order screens registered them. */
  parts: Record<string, NoteContextPart>
  env: {
    width: number
    height: number
    /** The display scale times the page zoom. */
    devicePixelRatio: number
    theme: 'light' | 'dark'
  }
}

/** The full context written in a note: the renderer's part plus what main knows. */
export interface NoteContext extends NoteWhere {
  app: { version: string; build: 'dev' | 'packaged'; platform: string }
  /** Local ISO time with its offset. */
  time: string
}

/** One entry of the recent-errors buffer. */
export interface NoteError {
  /** ISO time. */
  at: string
  origin: 'main' | 'renderer' | 'sync'
  message: string
  /** First stack lines, or null. */
  stack: string | null
}

export type NoteImageKind = 'screenshot' | 'snip'

/** An attachment before it is saved: a PNG as a data URL. */
export interface NoteImageDraft {
  kind: NoteImageKind
  dataUrl: string
}

/** What the panel sends to save. */
export interface NewNote {
  text: string
  tag: NoteTag
  where: NoteWhere
  errors: NoteError[]
  images: NoteImageDraft[]
}

/** The machine-readable line of a section. */
export interface NoteMeta {
  id: string
  tag: NoteTag
  status: NoteStatus
  /** Local ISO time with offset. */
  created: string
  /** Relative to the notes folder, e.g. `img/N-014-1.png`. */
  images: string[]
}

/** A note as the app lists it. */
export interface DevNote extends NoteMeta {
  title: string
  /** The developer's words, as they stand in the file now (hand edits included). */
  text: string
  /** The `**Where:**` line, or '' when it was removed. */
  where: string
  /** The context block, when it still parses. */
  context: NoteContext | null
}

/** A run of the file: the header, a note, or a section the app does not recognise (kept as is). */
export interface NotesSection {
  raw: string
  note: DevNote | null
}

export interface NotesFile {
  /** Everything before the first section. */
  header: string
  sections: NotesSection[]
}

export const NOTES_HEADER = `# Metis — dev notes

Notes written in the app's Dev mode. One \`##\` section per note, oldest first.
Each section has a machine-readable \`<!-- note {...} -->\` line; keep it when editing by hand.
To close a note, set \`"status":"done"\` in that line (or use the app). Images are in \`img/\`.
`

const TITLE_MAX = 80
const META_LINE = /^<!-- note (\{.*\}) -->[ \t]*$/m
/** A fence opener (CommonMark): three or more backticks or tildes, an optional info string. */
const FENCE = /^(`{3,}|~{3,})(.*)$/

/** A fence line closes `open` when it uses the same character, at least as long, with no info. */
function closesFence(line: string, open: string): boolean {
  const m = FENCE.exec(line)
  return m !== null && m[1][0] === open[0] && m[1].length >= open.length && m[2].trim() === ''
}

/** The fence still open after `lines`, or null. */
function openFence(lines: string[]): string | null {
  let open: string | null = null
  for (const line of lines) {
    if (open === null) open = FENCE.exec(line)?.[1] ?? null
    else if (closesFence(line, open)) open = null
  }
  return open
}

/** The first non-empty line of the text, trimmed to 80 characters. */
export function noteTitle(text: string): string {
  const first =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l !== '') ?? ''
  return first.length > TITLE_MAX ? `${first.slice(0, TITLE_MAX - 1).trimEnd()}…` : first
}

/** `Player · Nikola Jokić · 2026-27`. */
export function whereSummary(where: Pick<NoteWhere, 'screen' | 'parts'>): string {
  const screen = where.screen.charAt(0).toUpperCase() + where.screen.slice(1)
  const parts = Object.values(where.parts)
    .map((p) => p.label)
    .filter((l) => l !== '')
  return [screen, ...parts].join(' · ')
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** `2026-10-22T14:03:11+02:00`: local time with its offset. */
export function localIso(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/** `2026-10-22 14:03` from a local ISO time, without re-reading it in another zone. */
function shortTime(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

/** Lines that would start a new section, or a title, are escaped so the file keeps its shape. */
function escapeText(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split('\n')
    .map((l) => (/^#{1,2}(\s|$)/.test(l) ? `\\${l}` : l))
  // A fence the text leaves open is closed, or it would swallow the rest of the file.
  const open = openFence(lines)
  if (open !== null) lines.push(open)
  return lines.join('\n')
}

function headingLine(meta: Pick<NoteMeta, 'id' | 'tag' | 'status'>, title: string): string {
  return `## ${meta.id} · ${tagLabel(meta.tag)} · ${meta.status} — ${title}`
}

function metaLine(meta: NoteMeta): string {
  return `<!-- note ${JSON.stringify(meta)} -->`
}

/** The errors as the note's text block writes them, one per line with indented stacks. */
export function formatErrors(errors: NoteError[]): string {
  return errors
    .map((e) => {
      // Local, like the note's When line.
      const time = new Date(e.at).toTimeString().slice(0, 8)
      // Every line of the message is inside the fence: continuation lines are indented too.
      const head = `${time} ${e.origin.padEnd(8)} ${e.message.replace(/\n/g, '\n    ')}`
      return e.stack ? `${head}\n${e.stack.replace(/^/gm, '    ')}` : head
    })
    .join('\n')
}

/** The image's alt text in the file: `Screenshot 1`, `Snip 2`. */
export function imageAlt(kind: NoteImageKind, n: number): string {
  return `${kind === 'snip' ? 'Snip' : 'Screenshot'} ${n}`
}

/**
 * A new note's section, ending with one newline. `images` are the saved files' relative
 * paths with their kinds, in the order they were attached.
 */
export function serializeNote(
  meta: NoteMeta,
  input: { text: string; context: NoteContext; errors: NoteError[]; kinds: NoteImageKind[] }
): string {
  const { context } = input
  const when = [
    shortTime(context.time),
    `v${context.app.version}`,
    context.app.build,
    context.app.platform
  ].join(' · ')
  const lines = [
    headingLine(meta, noteTitle(input.text)),
    '',
    metaLine(meta),
    '',
    `**Where:** ${whereSummary(context)}`,
    `**When:** ${when}`,
    '',
    escapeText(input.text),
    ''
  ]
  if (meta.images.length > 0) {
    meta.images.forEach((path, i) => lines.push(`![${imageAlt(input.kinds[i], i + 1)}](${path})`))
    lines.push('')
  }
  lines.push(
    '<details><summary>Context</summary>',
    '',
    '```json',
    JSON.stringify(context, null, 2),
    '```',
    '',
    '</details>',
    ''
  )
  if (input.errors.length > 0) {
    lines.push(
      `<details><summary>Recent errors (${input.errors.length})</summary>`,
      '',
      '```text',
      formatErrors(input.errors),
      '```',
      '',
      '</details>',
      ''
    )
  }
  return lines.join('\n')
}

function isTag(v: unknown): v is NoteTag {
  return v === 'bug' || v === 'idea' || v === 'polish'
}

function readMeta(raw: string): NoteMeta | null {
  const m = META_LINE.exec(raw)
  if (!m) return null
  try {
    const json = JSON.parse(m[1]) as Record<string, unknown>
    if (typeof json.id !== 'string' || json.id === '') return null
    return {
      id: json.id,
      tag: isTag(json.tag) ? json.tag : 'idea',
      status: json.status === 'done' ? 'done' : 'open',
      created: typeof json.created === 'string' ? json.created : '',
      images: Array.isArray(json.images)
        ? json.images.filter((p): p is string => typeof p === 'string')
        : []
    }
  } catch {
    return null
  }
}

/** The JSON fence inside the `Context` details block, when it still parses. */
function readContext(raw: string): NoteContext | null {
  const m = /<summary>Context<\/summary>[\s\S]*?```json\n([\s\S]*?)\n```/.exec(raw)
  if (!m) return null
  try {
    return JSON.parse(m[1]) as NoteContext
  } catch {
    return null
  }
}

/**
 * The developer's words: the section without its heading, meta line, Where / When lines, images
 * and details blocks. Hand-written lines (a "Done in …" line, say) are kept.
 */
function readText(raw: string): string {
  const out: string[] = []
  let details = 0
  for (const line of raw.split('\n').slice(1)) {
    if (/^<details>/.test(line)) details++
    if (details > 0) {
      if (/^<\/details>/.test(line)) details--
      continue
    }
    if (META_LINE.test(line) || /^\*\*(Where|When):\*\*/.test(line) || /^!\[.*\]\(.*\)$/.test(line))
      continue
    out.push(line.replace(/^\\(#{1,2}(\s|$))/, '$1'))
  }
  return out.join('\n').trim()
}

function readNote(raw: string): DevNote | null {
  const meta = readMeta(raw)
  if (!meta) return null
  const heading = raw.split('\n', 1)[0]
  const dash = heading.indexOf(' — ')
  const where = /^\*\*Where:\*\* (.*)$/m.exec(raw)
  return {
    ...meta,
    title: dash >= 0 ? heading.slice(dash + 3).trim() : heading.replace(/^##\s*/, ''),
    text: readText(raw),
    where: where ? where[1] : '',
    context: readContext(raw)
  }
}

/** The first non-empty line after `i` is a `<!-- note {...} -->` line. */
function metaFollows(lines: string[], i: number): boolean {
  const next = lines.slice(i + 1).find((l) => l.trim() !== '')
  return next !== undefined && META_LINE.test(next)
}

/** Splits on lines starting with `## ` outside code fences. */
export function parseNotes(content: string): NotesFile {
  const text = content.replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const starts: number[] = []
  let open: string | null = null
  lines.forEach((line, i) => {
    // A heading followed by a meta line is a note's start even inside a fence a hand edit left open.
    if (/^## /.test(line) && (open === null || metaFollows(lines, i))) {
      starts.push(i)
      open = null
    } else if (open === null) open = FENCE.exec(line)?.[1] ?? null
    else if (closesFence(line, open)) open = null
  })
  if (starts.length === 0) return { header: text, sections: [] }
  const header = lines.slice(0, starts[0]).join('\n')
  const sections = starts.map((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length
    const raw = lines.slice(start, end).join('\n')
    return { raw, note: readNote(raw) }
  })
  return { header, sections }
}

/** The file again: unchanged sections byte for byte. */
export function formatNotes(file: NotesFile): string {
  return [file.header, ...file.sections.map((s) => s.raw)].join('\n')
}

export function listNotes(file: NotesFile): DevNote[] {
  return file.sections.flatMap((s) => (s.note ? [s.note] : []))
}

/** `N-` and three digits, one more than the highest id in the file (foreign sections too). */
export function nextNoteId(file: NotesFile): string {
  let max = 0
  for (const s of file.sections) {
    const m = /^## N-(\d+)/.exec(s.raw) ?? (s.note ? /^N-(\d+)$/.exec(s.note.id) : null)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `N-${pad(max + 1, 3)}`
}

/** Appends a section, with a blank line before it. */
export function appendNote(file: NotesFile, raw: string): NotesFile {
  const header =
    file.sections.length === 0 ? withBlankEnd(file.header || NOTES_HEADER) : file.header
  const sections = file.sections.map((s, i) =>
    i === file.sections.length - 1 ? { ...s, raw: withBlankEnd(s.raw) } : s
  )
  return {
    header,
    sections: [...sections, { raw: raw.replace(/\n+$/, '\n'), note: readNote(raw) }]
  }
}

/** The text ends with exactly one empty line, so the next `##` is separated from it. */
function withBlankEnd(raw: string): string {
  return `${raw.replace(/\n+$/, '')}\n`
}

/**
 * Sets a note's status: its heading and meta line are regenerated, its body is left as it is.
 * Returns the file unchanged when no note has the id.
 */
export function setNoteStatus(file: NotesFile, id: string, status: NoteStatus): NotesFile {
  return {
    ...file,
    sections: file.sections.map((s) => {
      if (s.note?.id !== id) return s
      const meta: NoteMeta = {
        id: s.note.id,
        tag: s.note.tag,
        status,
        created: s.note.created,
        images: s.note.images
      }
      const lines = s.raw.split('\n')
      lines[0] = headingLine(meta, s.note.title)
      const raw = lines.join('\n').replace(META_LINE, metaLine(meta))
      return { raw, note: readNote(raw) }
    })
  }
}

/** Removes a note's section; its images are main's to delete. */
export function removeNote(file: NotesFile, id: string): NotesFile {
  return { ...file, sections: file.sections.filter((s) => s.note?.id !== id) }
}

/**
 * The notes' sections as one Markdown text for a Claude session, oldest first, with
 * each image link made absolute by `absolute`.
 */
export function notesForClaude(
  file: NotesFile,
  ids: string[],
  absolute: (path: string) => string
): string {
  return file.sections
    .filter((s) => s.note !== null && ids.includes(s.note.id))
    .map((s) => {
      const images = new Set(s.note?.images ?? [])
      return s.raw
        .replace(/^(!\[[^\]]*\]\()([^)]+)\)$/gm, (line, head: string, path: string) =>
          images.has(path) ? `${head}${absolute(path)})` : line
        )
        .trimEnd()
    })
    .join('\n\n')
    .concat('\n')
}
