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
  updater: UpdaterLike
  /** Every state pushed through onChange, in order. */
  states: UpdateState[]
  logs: string[]
  counts: { checks: number; failedInstalls: number }
  /** What happened around an install, in order: `close`, `install`. */
  events: string[]
  /** Arguments of each quitAndInstall call. */
  installs: [boolean, boolean][]
  registered: string[]
  emit: (event: string, payload: unknown) => void
}

interface Options {
  enabled?: boolean
  checkFails?: boolean
  checkIntervalMs?: number
  closeFails?: boolean
  /** quitAndInstall reports a failure through 'error', as electron-updater does. */
  installFails?: boolean
}

function setup({
  enabled = true,
  checkFails = false,
  checkIntervalMs,
  closeFails = false,
  installFails = false
}: Options = {}): Harness {
  const listeners = new Map<string, Listener>()
  const states: UpdateState[] = []
  const logs: string[] = []
  const counts = { checks: 0, failedInstalls: 0 }
  const events: string[] = []
  const installs: [boolean, boolean][] = []

  const updater: UpdaterLike = {
    // electron-updater's own defaults, which installAutoUpdater must change.
    autoDownload: false,
    autoInstallOnAppQuit: true,
    checkForUpdates() {
      counts.checks++
      return checkFails ? Promise.reject(new Error('offline')) : Promise.resolve(null)
    },
    quitAndInstall(isSilent, isForceRunAfter) {
      events.push('install')
      installs.push([isSilent, isForceRunAfter])
      if (installFails) listeners.get('error')?.(new Error('spawn failed') as never)
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
    beforeInstall: async () => {
      await tick()
      events.push('close')
      if (closeFails) throw new Error('worker gone')
    },
    onInstallFailed: () => {
      counts.failedInstalls++
    },
    checkIntervalMs,
    log: (message) => {
      logs.push(message)
    }
  }
  const controller = installAutoUpdater(deps)
  return {
    controller,
    updater,
    states,
    logs,
    counts,
    events,
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

function ready(options: Options = {}): Harness {
  const h = setup(options)
  h.emit('update-available', info())
  h.emit('update-downloaded', info())
  return h
}

afterEach(() => {
  vi.useRealTimers()
})

describe('installAutoUpdater', () => {
  it('does nothing when disabled', async () => {
    const h = setup({ enabled: false })
    expect(h.counts.checks).toBe(0)
    expect(h.registered).toEqual([])
    expect(h.controller.state()).toEqual({ status: 'idle' })
    expect(h.updater.autoInstallOnAppQuit).toBe(true)
    await h.controller.install()
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

  it('downloads in the background but never installs on quit', () => {
    const h = setup()
    expect(h.updater.autoDownload).toBe(true)
    expect(h.updater.autoInstallOnAppQuit).toBe(false)
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

  it('goes ready when downloaded and installs silently with relaunch', async () => {
    const h = ready()
    expect(h.controller.state()).toEqual({
      status: 'ready',
      version: '0.11.0',
      notes: '<p>Notes</p>'
    })
    await h.controller.install()
    expect(h.installs).toEqual([[true, true]])
  })

  it('closes the stats before the installer starts', async () => {
    const h = ready()
    await h.controller.install()
    expect(h.events).toEqual(['close', 'install'])
  })

  it('installs once, however often it is asked', async () => {
    const h = ready()
    await Promise.all([h.controller.install(), h.controller.install()])
    await h.controller.install()
    expect(h.events).toEqual(['close', 'install'])
  })

  it('still installs when closing the stats fails, and logs it', async () => {
    const h = ready({ closeFails: true })
    await h.controller.install()
    expect(h.installs).toEqual([[true, true]])
    expect(h.logs).toEqual(['closing before the update failed'])
  })

  it('reports an installer that does not start, so the app can relaunch', async () => {
    const h = ready({ installFails: true })
    await h.controller.install()
    expect(h.counts.failedInstalls).toBe(1)
    expect(h.controller.state()).toEqual({ status: 'error', message: 'spawn failed' })
    expect(h.logs).toEqual(['auto-update failed'])
  })

  it('does not install unless ready', async () => {
    const h = setup()
    h.emit('update-available', info())
    await h.controller.install()
    expect(h.installs).toEqual([])
    expect(h.events).toEqual([])
  })

  it('records and logs updater errors, such as a failed download', () => {
    const h = setup()
    h.emit('update-available', info())
    h.emit('download-progress', { percent: 30 })
    expect(() => h.emit('error', new Error('sha512 checksum mismatch'))).not.toThrow()
    expect(h.controller.state()).toEqual({ status: 'error', message: 'sha512 checksum mismatch' })
    expect(h.logs).toEqual(['auto-update failed'])
  })

  it('keeps a downloaded update ready through later errors and announcements', () => {
    const h = ready()
    h.emit('error', new Error('offline'))
    h.emit('update-available', info())
    h.emit('download-progress', { percent: 5 })
    expect(h.controller.state()).toEqual({
      status: 'ready',
      version: '0.11.0',
      notes: '<p>Notes</p>'
    })
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

  it('stops checking once an update is ready', () => {
    vi.useFakeTimers()
    const h = setup({ checkIntervalMs: 1000 })
    h.emit('update-available', info())
    h.emit('update-downloaded', info())
    vi.advanceTimersByTime(5000)
    expect(h.counts.checks).toBe(1)
  })
})
