import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChangeNotifier } from '@main/stats/changes'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createChangeNotifier', () => {
  it('tells the window at once, then at most once per interval', () => {
    const notify = vi.fn()
    const changed = createChangeNotifier(notify, 1000)
    changed()
    expect(notify).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 50; i++) changed()
    expect(notify).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('always delivers the last change', () => {
    const notify = vi.fn()
    const changed = createChangeNotifier(notify, 1000)
    changed()
    vi.advanceTimersByTime(400)
    changed()
    expect(notify).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(600)
    expect(notify).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(5000)
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('tells at once again after a quiet interval', () => {
    const notify = vi.fn()
    const changed = createChangeNotifier(notify, 1000)
    changed()
    vi.advanceTimersByTime(1500)
    changed()
    expect(notify).toHaveBeenCalledTimes(2)
  })
})
