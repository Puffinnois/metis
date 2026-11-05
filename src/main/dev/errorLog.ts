import type { NoteError } from '@shared/devNotes'

const MAX_ENTRIES = 30
const NODE_WARNING = /^\(node:\d+\) (\[\w+\] )?\w*Warning:/
const STACK_LINES = 8
/** A note attaches the errors of the last 15 minutes, at most 10. */
export const RECENT_MS = 15 * 60 * 1000
export const RECENT_MAX = 10

export interface ErrorLog {
  push(entry: NoteError): void
  /** Newest first, within `RECENT_MS` of `now`; `recentErrors` collapses repeats, then cuts. */
  recent(now: number): NoteError[]
}

export function createErrorLog(): ErrorLog {
  const entries: NoteError[] = []
  return {
    push: (entry) => {
      entries.push({ ...entry, stack: trimStack(entry.stack) })
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
    },
    recent: (now) => entries.filter((e) => now - Date.parse(e.at) <= RECENT_MS).reverse()
  }
}

/** The first eight lines of a stack, each trimmed; null when there is none. */
export function trimStack(stack: string | null | undefined): string | null {
  if (!stack) return null
  const lines = stack
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
  return lines.length === 0 ? null : lines.slice(0, STACK_LINES).join('\n')
}

/** `console.error`'s arguments as one entry: errors by name and message, the first one's stack. */
export function errorEntry(args: unknown[], origin: NoteError['origin'], at: Date): NoteError {
  const message = args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`
      if (typeof a === 'string') return a
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')
  const error = args.find((a): a is Error => a instanceof Error)
  // An Error's stack repeats its message on the first line.
  const stack = error?.stack?.split('\n').slice(1).join('\n') ?? null
  return { at: at.toISOString(), origin, message, stack: trimStack(stack) }
}

/**
 * Records every `console.error` and uncaught exception of the main process, whatever
 * the mode, and still prints them. `uncaughtExceptionMonitor` observes without changing Electron's
 * handling.
 */
export function captureMainErrors(log: ErrorLog, now: () => Date = () => new Date()): void {
  const original = console.error.bind(console)
  console.error = (...args: unknown[]): void => {
    // Node prints its process warnings (ExperimentalWarning …) through console.error: not errors.
    if (!(typeof args[0] === 'string' && NODE_WARNING.test(args[0])))
      log.push(errorEntry(args, 'main', now()))
    original(...args)
  }
  process.on('uncaughtExceptionMonitor', (err) => log.push(errorEntry([err], 'main', now())))
}

/** The errors a note attaches now, newest first, at most 10. */
export function recentErrors(deps: { errors: ErrorLog }, now: Date): NoteError[] {
  return collapseRepeats(deps.errors.recent(now.getTime())).slice(0, RECENT_MAX)
}

/** The same error again (a query retried, say) is listed once, newest, with its count. */
export function collapseRepeats(errors: NoteError[]): NoteError[] {
  const seen = new Map<string, { entry: NoteError; count: number }>()
  for (const e of errors) {
    const key = `${e.origin}|${e.message}`
    const hit = seen.get(key)
    if (hit) hit.count++
    else seen.set(key, { entry: e, count: 1 })
  }
  return [...seen.values()].map(({ entry, count }) =>
    count > 1 ? { ...entry, message: `${entry.message} (×${count})` } : entry
  )
}
