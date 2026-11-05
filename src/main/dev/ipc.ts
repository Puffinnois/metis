import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '@main/db/connection'
import { getSetting, setSetting } from '@main/db/repos/settings'
import { errorEntry, recentErrors, type ErrorLog } from '@main/dev/errorLog'
import type { DevMode } from '@main/dev/mode'
import { createNotesStore } from '@main/dev/notesStore'
import { localIso, type NewNote, type NoteError, type NoteStatus } from '@shared/devNotes'
import { IPC } from '@shared/ipc'

export const SETTING_DEV_NOTES_DIR = 'dev_notes_dir'

export interface DevDeps {
  db: Db
  mode: DevMode
  errors: ErrorLog
  getWindow: () => BrowserWindow | null
  now?: () => Date
}

/** Dev mode and the notes. */
export function registerDevHandlers(deps: DevDeps): void {
  const now = deps.now ?? (() => new Date())
  const folder = (): string =>
    getSetting(deps.db, SETTING_DEV_NOTES_DIR) ?? join(app.getPath('userData'), 'dev-notes')
  const notes = createNotesStore(folder)

  ipcMain.handle(IPC.devMode, (): boolean => deps.mode.get())
  ipcMain.handle(IPC.devSetMode, (_event, on: boolean): void => {
    deps.mode.set(on)
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.devChanged, on)
  })
  ipcMain.handle(IPC.devCapture, async (): Promise<string> => {
    const window = deps.getWindow()
    if (!window) throw new Error('No window to capture')
    return (await window.webContents.capturePage()).toDataURL()
  })
  ipcMain.on(IPC.devReportError, (_event, error: { message: string; stack: string | null }) => {
    const entry = errorEntry([String(error?.message ?? 'error')], 'renderer', now())
    deps.errors.push({ ...entry, stack: error?.stack ?? null })
  })
  ipcMain.handle(IPC.devRecentErrors, (): NoteError[] => recentErrors(deps, now()))

  ipcMain.handle(IPC.devNotesList, () => notes.list())
  ipcMain.handle(IPC.devNotesSave, (_event, note: NewNote) => {
    return notes.save(note, {
      app: {
        version: app.getVersion(),
        build: app.isPackaged ? 'packaged' : 'dev',
        platform: process.platform
      },
      time: localIso(now())
    })
  })
  ipcMain.handle(IPC.devNotesSetStatus, (_event, id: string, status: NoteStatus) =>
    notes.setStatus(id, status)
  )
  ipcMain.handle(IPC.devNotesRemove, (_event, id: string) => notes.remove(id))
  ipcMain.handle(IPC.devNotesImage, (_event, path: string) => notes.image(path))
  ipcMain.handle(IPC.devNotesFolder, (): string => folder())
  ipcMain.handle(IPC.devNotesOpenFolder, async (): Promise<void> => {
    mkdirSync(folder(), { recursive: true })
    const failed = await shell.openPath(folder())
    if (failed) throw new Error(failed)
  })
  ipcMain.handle(IPC.devNotesChooseFolder, async (): Promise<string | null> => {
    const window = deps.getWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Dev notes folder',
      defaultPath: folder(),
      properties: ['openDirectory', 'createDirectory']
    }
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const dir = picked.canceled ? null : (picked.filePaths[0] ?? null)
    if (dir) setSetting(deps.db, SETTING_DEV_NOTES_DIR, dir)
    return dir
  })
  ipcMain.handle(IPC.devNotesCopy, (_event, ids: string[]): void =>
    clipboard.writeText(notes.forClaude(ids))
  )
}
