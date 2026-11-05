import { app, BrowserWindow, dialog, shell } from 'electron'
import { rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { openDatabase, type Db } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { captureMainErrors, createErrorLog } from '@main/dev/errorLog'
import { registerDevHandlers } from '@main/dev/ipc'
import { createDevMode } from '@main/dev/mode'
import { registerIpcHandlers, type AppContext } from '@main/ipc/handlers'
import { createChangeNotifier } from '@main/stats/changes'
import { startStatsWorker, type StatsClient } from '@main/stats/client'
import { installAutoUpdater } from '@main/updater'
import { IPC } from '@shared/ipc'

let mainWindow: BrowserWindow | null = null

// The recent-errors buffer runs from launch, whatever the dev mode.
const errorLog = createErrorLog()
captureMainErrors(errorLog)

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#18181b',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function openAppDatabase(): Db {
  const dbPath = join(app.getPath('userData'), 'metis.db')
  try {
    const db = openDatabase(dbPath)
    migrate(db)
    return db
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    dialog.showErrorBox('Database error', `Could not open ${dbPath}\n\n${message}`)
    app.quit()
    throw err
  }
}

/** A failure here turns the stats off and leaves the app running, where it says so. */
function openStats(onStep: () => void): StatsClient | null {
  try {
    return startStatsWorker(
      {
        path: join(app.getPath('userData'), 'stats.duckdb'),
        tempDir: join(app.getPath('userData'), 'stats-tmp')
      },
      onStep
    )
  } catch (err) {
    console.error('could not start the stats worker; the stats are off', err)
    return null
  }
}

/** How often a window left open looks for new games; each file still decides if it is due. */
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * `--stats-self-test=<file>`: the packaged app opens a throwaway stats database in the worker,
 * writes, reads and round-trips Parquet, writes the result as JSON to `<file>`, and exits 0 on
 * success. CI runs it on the Windows build.
 */
const SELF_TEST_FLAG = '--stats-self-test='

async function runStatsSelfTest(out: string): Promise<number> {
  const dir = join(tmpdir(), `metis-stats-self-test-${process.pid}`)
  let result: object
  let code = 1
  try {
    const client = startStatsWorker({ path: join(dir, 'stats.duckdb'), tempDir: join(dir, 'tmp') })
    const test = await client.selfTest()
    await client.close()
    code = test.parquet && test.json && test.icu && test.rows === 1000 ? 0 : 1
    result = { ok: code === 0, ...test }
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  writeFileSync(out, JSON.stringify(result))
  rmSync(dir, { recursive: true, force: true })
  return code
}

// One process holds the databases: a second launch hands over to the first and quits. The self-test
// runs on its own.
const selfTesting = process.argv.some((a) => a.startsWith(SELF_TEST_FLAG))
const primary = selfTesting || app.requestSingleInstanceLock()
if (!primary) app.quit()
app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

app.whenReady().then(async () => {
  if (!primary) return
  const selfTest = process.argv.find((a) => a.startsWith(SELF_TEST_FLAG))
  if (selfTest) {
    app.exit(await runStatsSelfTest(selfTest.slice(SELF_TEST_FLAG.length)))
    return
  }
  electronApp.setAppUserModelId('com.yhabie.metis')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const db = openAppDatabase()
  const statsChanged = createChangeNotifier(() => mainWindow?.webContents.send(IPC.statsChanged))
  const ctx: AppContext = {
    stats: openStats(statsChanged),
    update: installAutoUpdater({
      enabled: app.isPackaged && process.platform === 'win32',
      updater: autoUpdater,
      onChange: (state) => mainWindow?.webContents.send(IPC.updateChanged, state)
    })
  }
  registerIpcHandlers(ctx)
  registerDevHandlers({
    db,
    mode: createDevMode({ db, packaged: app.isPackaged, argv: process.argv }),
    errors: errorLog,
    getWindow: () => mainWindow
  })
  createWindow()

  const refresh = (): void => {
    ctx.stats?.refresh().then(statsChanged, (err) => console.error('the stats refresh failed', err))
  }
  refresh()
  setInterval(refresh, REFRESH_INTERVAL_MS)

  // The process must not exit while DuckDB runs a statement (Electron aborts), so the first quit
  // closes the stats worker, which interrupts a running refresh, and then quits again.
  let closed = false
  app.on('will-quit', (event) => {
    if (closed) return
    event.preventDefault()
    void Promise.resolve(ctx.stats?.close()).finally(() => {
      closed = true
      app.quit()
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
