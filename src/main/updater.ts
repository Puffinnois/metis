import type { UpdateState } from '@shared/types'

interface UpdateInfoLike {
  version: string
  releaseNotes?: unknown
}

/** The slice of electron-updater's `autoUpdater` this module uses; injectable for tests. */
export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void
  on(event: 'error', listener: (err: Error) => void): unknown
  on(event: 'update-available', listener: (info: UpdateInfoLike) => void): unknown
  on(event: 'download-progress', listener: (info: { percent: number }) => void): unknown
  on(event: 'update-downloaded', listener: (info: UpdateInfoLike) => void): unknown
}

export interface UpdaterDeps {
  /** `app.isPackaged && process.platform === 'win32'` in production; false disables everything. */
  enabled: boolean
  updater: UpdaterLike
  /** Called with every new state; index.ts forwards it to the window. */
  onChange: (state: UpdateState) => void
  /**
   * Runs before the installer starts. index.ts closes the stats database here: the installer
   * force-closes the app about two seconds after it starts, and that must not land in a write.
   */
  beforeInstall?: () => Promise<void>
  /** Called when the installer fails to start after `beforeInstall` ran; index.ts relaunches. */
  onInstallFailed?: () => void
  /** Re-check period. Defaults to one hour. */
  checkIntervalMs?: number
  /** Defaults to console.error. Every updater failure ends here and in the state, nowhere else. */
  log?: (message: string, err: unknown) => void
}

export interface UpdateController {
  state(): UpdateState
  /** Closes the stats, then installs silently and relaunches. No-op unless the state is `ready`. */
  install(): Promise<void>
}

const HOUR_MS = 60 * 60 * 1000
const IDLE: UpdateState = { status: 'idle' }

/**
 * Owns the update state. electron-updater finds a newer published release on GitHub, downloads its
 * installer in the background and checks it against the sha512 in that release's `latest.yml`. The
 * installer is not code-signed, so no publisher is checked. The renderer shows the state, and the
 * update installs only when the user chooses Update & restart: never on quit, never on its own.
 * Failures (offline, no release yet, rate limit, a bad download) are logged and recorded, never
 * shown natively, and the next check tries again.
 */
export function installAutoUpdater(deps: UpdaterDeps): UpdateController {
  if (!deps.enabled) return { state: () => IDLE, install: async () => undefined }
  const log = deps.log ?? ((message, err) => console.error(message, err))
  let state: UpdateState = IDLE
  let installing = false

  // The download runs in the background so the update is ready when the user asks for it.
  // Installing on quit is off: it would run the installer without the user choosing it.
  deps.updater.autoDownload = true
  deps.updater.autoInstallOnAppQuit = false

  const set = (next: UpdateState): void => {
    if (JSON.stringify(next) === JSON.stringify(state)) return
    state = next
    deps.onChange(next)
  }

  deps.updater.on('error', (err) => {
    log('auto-update failed', err)
    if (installing) {
      // The stats database is already closed, so the app cannot carry on as it was.
      installing = false
      set({ status: 'error', message: err.message })
      deps.onInstallFailed?.()
      return
    }
    // A downloaded update stays ready: a later failed check does not take the button away.
    if (state.status === 'ready') return
    set({ status: 'error', message: err.message })
  })
  deps.updater.on('update-available', (info) => {
    if (state.status === 'ready') return
    set({ status: 'available', version: info.version, notes: notesOf(info.releaseNotes) })
  })
  deps.updater.on('download-progress', (info) => {
    if (state.status !== 'available' && state.status !== 'downloading') return
    set({
      status: 'downloading',
      version: state.version,
      notes: state.notes,
      percent: Math.round(info.percent)
    })
  })
  deps.updater.on('update-downloaded', (info) =>
    set({ status: 'ready', version: info.version, notes: notesOf(info.releaseNotes) })
  )

  const check = (): void => {
    // Once an update is downloaded there is nothing more to find until the user restarts.
    if (state.status === 'ready' || installing) return
    deps.updater.checkForUpdates().catch((err) => log('auto-update check failed', err))
  }
  check()
  setInterval(check, deps.checkIntervalMs ?? HOUR_MS).unref()

  return {
    state: () => state,
    install: async () => {
      if (state.status !== 'ready' || installing) return
      installing = true
      try {
        await deps.beforeInstall?.()
      } catch (err) {
        log('closing before the update failed', err)
      }
      // A failure to start the installer arrives through the 'error' listener above.
      deps.updater.quitAndInstall(true, true)
    }
  }
}

/** GitHub releases arrive as an HTML string; other providers may send arrays — we only render strings. */
function notesOf(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null
}
