import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  captureMainErrors,
  collapseRepeats,
  createErrorLog,
  errorEntry,
  recentErrors,
  RECENT_MS,
  trimStack
} from '@main/dev/errorLog'
import type { NoteError } from '@shared/devNotes'

const T0 = Date.parse('2026-10-22T12:00:00.000Z')

function entry(minutesAgo: number, message = `m${minutesAgo}`): NoteError {
  return {
    at: new Date(T0 - minutesAgo * 60_000).toISOString(),
    origin: 'main',
    message,
    stack: null
  }
}

describe('the recent-errors buffer', () => {
  it('keeps the last 30', () => {
    const log = createErrorLog()
    for (let i = 0; i < 35; i++) log.push(entry(0, `e${i}`))
    expect(log.recent(T0)).toHaveLength(30)
    expect(log.recent(T0)[0].message).toBe('e34')
  })

  it('attaches the last 15 minutes, newest first, at most 10', () => {
    const log = createErrorLog()
    log.push(entry(20))
    log.push(entry(15))
    log.push(entry(3))
    log.push(entry(1))
    expect(log.recent(T0).map((e) => e.message)).toEqual(['m1', 'm3', 'm15'])
    expect(log.recent(T0 + RECENT_MS)).toEqual([])
  })

  it('trims a stack to its first eight lines', () => {
    const stack = Array.from({ length: 12 }, (_, i) => `   at f${i} (x.ts:${i})`).join('\n')
    expect(trimStack(stack)?.split('\n')).toEqual(
      Array.from({ length: 8 }, (_, i) => `at f${i} (x.ts:${i})`)
    )
    expect(trimStack('')).toBeNull()
    expect(trimStack(null)).toBeNull()
  })

  it('reads console.error’s arguments', () => {
    const err = new TypeError('boom')
    const e = errorEntry(['stats refresh failed', err, { code: 7 }], 'main', new Date(T0))
    expect(e).toMatchObject({
      at: '2026-10-22T12:00:00.000Z',
      origin: 'main',
      message: 'stats refresh failed TypeError: boom {"code":7}'
    })
    expect(e.stack?.split('\n')[0]).toMatch(/^at /)
  })
})

describe('capturing main’s errors', () => {
  const original = console.error
  afterEach(() => {
    console.error = original
  })

  it('records console.error and still prints it', () => {
    const printed = vi.fn()
    console.error = printed
    const log = createErrorLog()
    captureMainErrors(log, () => new Date(T0))
    console.error('could not start', new Error('nope'))
    expect(printed).toHaveBeenCalledTimes(1)
    expect(log.recent(T0)[0].message).toBe('could not start Error: nope')
  })

  it('leaves out Node’s process warnings', () => {
    console.error = vi.fn()
    const log = createErrorLog()
    captureMainErrors(log, () => new Date(T0))
    console.error('(node:44633) ExperimentalWarning: SQLite is an experimental feature')
    console.error('(node:44633) [DEP0040] DeprecationWarning: The `punycode` module is deprecated.')
    expect(log.recent(T0)).toEqual([])
  })
})

describe('repeats', () => {
  it('lists the same error once, the newest, with its count', () => {
    expect(collapseRepeats([entry(1, 'same'), entry(2, 'other'), entry(3, 'same')])).toEqual([
      { ...entry(1, 'same'), message: 'same (×2)' },
      entry(2, 'other')
    ])
  })
})

describe('repeats before the cut (final review)', () => {
  it('collapses repeats before keeping ten, so older different errors stay', () => {
    const log = createErrorLog()
    for (let i = 0; i < 5; i++) log.push(entry(10, `older ${i}`))
    for (let i = 0; i < 12; i++) log.push(entry(1, 'retried'))
    const shown = recentErrors({ errors: log }, new Date(T0))
    expect(shown.map((e) => e.message)).toEqual([
      'retried (×12)',
      'older 4',
      'older 3',
      'older 2',
      'older 1',
      'older 0'
    ])
  })
})
