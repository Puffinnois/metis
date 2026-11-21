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
import { createFullSpeedRequest, loadWindowsThrottleApi } from '@main/fullSpeed'
import { registerDevHandlers } from '@main/dev/ipc'
import { createDevMode } from '@main/dev/mode'
import { registerIpcHandlers, type AppContext } from '@main/ipc/handlers'
import { createChangeNotifier } from '@main/stats/changes'
import { startStatsWorker } from '@main/stats/client'
import { createLeagueControl } from '@main/stats/leagueControl'
import { startLinksWorker } from '@main/stats/links/client'
import { linksTempDir } from '@main/stats/links/control'
import { installAutoUpdater } from '@main/updater'
import { IPC } from '@shared/ipc'
import { DEFAULT_LEAGUE, LEAGUES, type LeagueId } from '@shared/leagues'

let mainWindow: BrowserWindow | null = null

// The recent-errors buffer runs from launch, whatever the dev mode.
const errorLog = createErrorLog()
captureMainErrors(errorLog)

// Asked once, before the stats worker starts; a failure is logged, never fatal.
const requestFullSpeed = createFullSpeedRequest({
  platform: process.platform,
  loadApi: loadWindowsThrottleApi,
  log: (message) => console.info(message),
  logError: (message, err) =>
    err === undefined ? console.error(message) : console.error(message, err)
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#18181b',
    // Windows and Linux take the window and taskbar icon from here; packaged on Windows the
    // executable's own icon matches it, but in development the window would show Electron's.
    // macOS uses the app bundle's icon.
    ...(process.platform !== 'darwin' ? { icon } : {}),
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

/** How often a window left open looks for new games; each file still decides if it is due. */
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * `--stats-self-test=<file>`: the packaged app opens a throwaway stats database in the worker,
 * writes, reads and round-trips Parquet, writes the result as JSON to `<file>`, and exits 0 on
 * success. CI runs it on the Windows build. The JSON also says whether the full-speed request
 * succeeded (`fullSpeed`), which does not decide the exit code.
 */
const SELF_TEST_FLAG = '--stats-self-test='

async function runStatsSelfTest(out: string): Promise<number> {
  const dir = join(tmpdir(), `metis-stats-self-test-${process.pid}`)
  let result: object
  let code = 1
  try {
    const client = startStatsWorker({
      league: DEFAULT_LEAGUE,
      dataDir: dir,
      tempDir: join(dir, 'tmp')
    })
    const test = await client.selfTest()
    await client.close()
    code = test.parquet && test.json && test.icu && test.query && test.rows === 1000 ? 0 : 1
    result = { ok: code === 0, ...test }
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  writeFileSync(out, JSON.stringify({ ...result, fullSpeed: await requestFullSpeed() }))
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
  await requestFullSpeed()
  const selfTest = process.argv.find((a) => a.startsWith(SELF_TEST_FLAG))
  if (selfTest) {
    app.exit(await runStatsSelfTest(selfTest.slice(SELF_TEST_FLAG.length)))
    return
  }
  electronApp.setAppUserModelId('com.yhabie.metis')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const db = openAppDatabase()
  // Each league's changes are told apart, so a refresh of one never makes the other's screens query.
  const notifiers = new Map(
    Object.values(LEAGUES).map((l) => [
      l.id,
      createChangeNotifier(() => mainWindow?.webContents.send(IPC.statsChanged, l.id))
    ])
  )
  const statsChanged = (league: LeagueId): void => notifiers.get(league)?.()
  // One stats worker per league with something to read, each opening only its own file in the data
  // folder (D36): one league's refresh never waits behind another's write. Which leagues download is
  // the user's choice (`leagueDownloads`); on a clean profile nothing starts until the first run's
  // question is answered.
  const dataDir = app.getPath('userData')
  const leagues = createLeagueControl({
    db,
    dataDir,
    start: (league) =>
      startStatsWorker({ league, dataDir, tempDir: join(dataDir, 'stats-tmp', league) }, () =>
        statsChanged(league)
      ),
    onChanged: statsChanged,
    // The links file's own worker (D47), started when a league of a pair has refreshed or is read.
    startLinks: () => startLinksWorker({ dataDir, tempDir: linksTempDir(dataDir) })
  })
  leagues.open()
  const closeStats = (): Promise<unknown> => leagues.close()
  const ctx: AppContext = {
    db,
    getWindow: () => mainWindow,
    leagues,
    statsChanged,
    update: installAutoUpdater({
      enabled: app.isPackaged && process.platform === 'win32',
      updater: autoUpdater,
      onChange: (state) => mainWindow?.webContents.send(IPC.updateChanged, state),
      // The same close as quitting: a running load or refresh stops and resumes on next launch.
      beforeInstall: async () => {
        await closeStats()
      },
      // The stats are closed by then, so start again rather than run without them.
      onInstallFailed: () => {
        app.relaunch()
        app.quit()
      }
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

  setInterval(() => leagues.refreshAll(), REFRESH_INTERVAL_MS)

  // The process must not exit while DuckDB runs a statement (Electron aborts), so the first quit
  // closes the stats worker, which interrupts a running refresh, and then quits again.
  let closed = false
  app.on('will-quit', (event) => {
    if (closed) return
    event.preventDefault()
    void closeStats().finally(() => {
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
