import type { UpdateState } from '@shared/types'

interface UpdateInfoLike {
  version: string
  releaseNotes?: unknown
}

/** The slice of electron-updater's `autoUpdater` this module uses; injectable for tests. */
export interface UpdaterLike {
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
  /** Re-check period. Defaults to one hour. */
  checkIntervalMs?: number
  /** Defaults to console.error. Every updater failure ends here and in the state, nowhere else. */
  log?: (message: string, err: unknown) => void
}

export interface UpdateController {
  state(): UpdateState
  /** Silent install + relaunch. No-op unless the state is `ready`. */
  install(): void
}

const HOUR_MS = 60 * 60 * 1000
const IDLE: UpdateState = { status: 'idle' }

/**
 * Owns the update state: electron-updater downloads a newer version in the background
 * (autoDownload) and installs it on quit (autoInstallOnAppQuit); the renderer shows the state and
 * asks for an immediate install. Failures — offline, no release yet, rate limit — are logged and
 * recorded, never shown natively.
 */
export function installAutoUpdater(deps: UpdaterDeps): UpdateController {
  if (!deps.enabled) return { state: () => IDLE, install: () => undefined }
  const log = deps.log ?? ((message, err) => console.error(message, err))
  let state: UpdateState = IDLE

  const set = (next: UpdateState): void => {
    if (JSON.stringify(next) === JSON.stringify(state)) return
    state = next
    deps.onChange(next)
  }

  deps.updater.on('error', (err) => {
    log('auto-update failed', err)
    set({ status: 'error', message: err.message })
  })
  deps.updater.on('update-available', (info) =>
    set({ status: 'available', version: info.version, notes: notesOf(info.releaseNotes) })
  )
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
    deps.updater.checkForUpdates().catch((err) => log('auto-update check failed', err))
  }
  check()
  setInterval(check, deps.checkIntervalMs ?? HOUR_MS).unref()

  return {
    state: () => state,
    install: () => {
      if (state.status === 'ready') deps.updater.quitAndInstall(true, true)
    }
  }
}

/** GitHub releases arrive as an HTML string; other providers may send arrays — we only render strings. */
function notesOf(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null
}
