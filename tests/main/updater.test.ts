import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installAutoUpdater,
  type UpdateController,
  type UpdaterDeps,
  type UpdaterLike
} from '@main/updater'
import type { UpdateState } from '@shared/types'

type Listener = (payload: never) => unknown

interface Harness {
  controller: UpdateController
  /** Every state pushed through onChange, in order. */
  states: UpdateState[]
  logs: string[]
  counts: { checks: number }
  /** Arguments of each quitAndInstall call. */
  installs: [boolean, boolean][]
  registered: string[]
  emit: (event: string, payload: unknown) => void
}

interface Options {
  enabled?: boolean
  checkFails?: boolean
  checkIntervalMs?: number
}

function setup({ enabled = true, checkFails = false, checkIntervalMs }: Options = {}): Harness {
  const listeners = new Map<string, Listener>()
  const states: UpdateState[] = []
  const logs: string[] = []
  const counts = { checks: 0 }
  const installs: [boolean, boolean][] = []

  const updater: UpdaterLike = {
    checkForUpdates() {
      counts.checks++
      return checkFails ? Promise.reject(new Error('offline')) : Promise.resolve(null)
    },
    quitAndInstall(isSilent, isForceRunAfter) {
      installs.push([isSilent, isForceRunAfter])
    },
    on(event: string, listener: Listener) {
      listeners.set(event, listener)
      return updater
    }
  }
  const deps: UpdaterDeps = {
    enabled,
    updater,
    onChange: (state) => {
      states.push(state)
    },
    checkIntervalMs,
    log: (message) => {
      logs.push(message)
    }
  }
  const controller = installAutoUpdater(deps)
  return {
    controller,
    states,
    logs,
    counts,
    installs,
    registered: [...listeners.keys()].sort(),
    emit: (event, payload) => listeners.get(event)?.(payload as never)
  }
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const info = (version = '0.11.0', releaseNotes: unknown = '<p>Notes</p>'): unknown => ({
  version,
  releaseNotes
})

afterEach(() => {
  vi.useRealTimers()
})

describe('installAutoUpdater', () => {
  it('does nothing when disabled', () => {
    const h = setup({ enabled: false })
    expect(h.counts.checks).toBe(0)
    expect(h.registered).toEqual([])
    expect(h.controller.state()).toEqual({ status: 'idle' })
    h.controller.install()
    expect(h.installs).toEqual([])
  })

  it('checks at once and subscribes to the four events', () => {
    const h = setup()
    expect(h.counts.checks).toBe(1)
    expect(h.registered).toEqual([
      'download-progress',
      'error',
      'update-available',
      'update-downloaded'
    ])
    expect(h.controller.state()).toEqual({ status: 'idle' })
  })

  it('goes available with the release notes, or null when they are not a string', () => {
    const h = setup()
    h.emit('update-available', info())
    expect(h.controller.state()).toEqual({
      status: 'available',
      version: '0.11.0',
      notes: '<p>Notes</p>'
    })
    h.emit('update-available', info('0.11.0', [{ version: '0.11.0', note: 'x' }]))
    expect(h.controller.state()).toEqual({ status: 'available', version: '0.11.0', notes: null })
  })

  it('tracks download progress as a rounded percent and drops repeats', () => {
    const h = setup()
    h.emit('update-available', info())
    h.emit('download-progress', { percent: 41.6 })
    h.emit('download-progress', { percent: 41.7 })
    h.emit('download-progress', { percent: 43.2 })
    expect(h.states.map((s) => (s.status === 'downloading' ? s.percent : s.status))).toEqual([
      'available',
      42,
      43
    ])
    expect(h.controller.state()).toEqual({
      status: 'downloading',
      version: '0.11.0',
      notes: '<p>Notes</p>',
      percent: 43
    })
  })

  it('ignores progress before an update is known', () => {
    const h = setup()
    h.emit('download-progress', { percent: 10 })
    expect(h.states).toEqual([])
  })

  it('goes ready when downloaded and installs silently with relaunch', () => {
    const h = setup()
    h.emit('update-available', info())
    h.emit('update-downloaded', info())
    expect(h.controller.state()).toEqual({
      status: 'ready',
      version: '0.11.0',
      notes: '<p>Notes</p>'
    })
    h.controller.install()
    expect(h.installs).toEqual([[true, true]])
  })

  it('does not install unless ready', () => {
    const h = setup()
    h.emit('update-available', info())
    h.controller.install()
    expect(h.installs).toEqual([])
  })

  it('records and logs updater errors', () => {
    const h = setup()
    expect(() => h.emit('error', new Error('boom'))).not.toThrow()
    expect(h.controller.state()).toEqual({ status: 'error', message: 'boom' })
    expect(h.logs).toEqual(['auto-update failed'])
  })

  it('logs a failed check without an unhandled rejection', async () => {
    const h = setup({ checkFails: true })
    await tick()
    expect(h.logs).toEqual(['auto-update check failed'])
    expect(h.controller.state()).toEqual({ status: 'idle' })
  })

  it('checks again every interval', () => {
    vi.useFakeTimers()
    const h = setup({ checkIntervalMs: 1000 })
    expect(h.counts.checks).toBe(1)
    vi.advanceTimersByTime(2500)
    expect(h.counts.checks).toBe(3)
  })
})
