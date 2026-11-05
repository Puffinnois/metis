import { app, ipcMain } from 'electron'
import type { StatsClient } from '@main/stats/client'
import type { installAutoUpdater } from '@main/updater'
import { IPC } from '@shared/ipc'
import type { StatsStatus } from '@shared/stats/types'
import type { UpdateState } from '@shared/types'

export interface AppContext {
  /** Null when the stats worker could not start: the app runs and says so. */
  stats: StatsClient | null
  update: ReturnType<typeof installAutoUpdater>
}

/** What the nav shows when the stats worker is off. */
export const STATS_OFF: StatsStatus = {
  available: false,
  through: null,
  updatedAt: null,
  busy: false
}

export function registerIpcHandlers(ctx: AppContext): void {
  ipcMain.handle(IPC.statsStatus, (): Promise<StatsStatus> =>
    ctx.stats ? ctx.stats.status() : Promise.resolve(STATS_OFF)
  )
  ipcMain.handle(IPC.updateState, (): UpdateState => ctx.update.state())
  ipcMain.handle(IPC.updateInstall, (): void => ctx.update.install())
  ipcMain.handle(IPC.appVersion, (): string => app.getVersion())
}
