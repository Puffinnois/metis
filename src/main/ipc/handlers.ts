import { app, ipcMain } from 'electron'
import type { StatsClient } from '@main/stats/client'
import type { installAutoUpdater } from '@main/updater'
import { IPC } from '@shared/ipc'
import type { StatsDataReport, StatsStatus } from '@shared/stats/types'
import type { UpdateState } from '@shared/types'

export interface AppContext {
  /** Null when the stats worker could not start: the app runs and says so. */
  stats: StatsClient | null
  /** Runs a refresh in the background; each file still decides if it is due. */
  refreshStats: () => void
  /** Tells the window to read the status again. */
  statsChanged: () => void
  update: ReturnType<typeof installAutoUpdater>
}

/** What the nav shows when the stats worker is off. */
export const STATS_OFF: StatsStatus = {
  available: false,
  through: null,
  updatedAt: null,
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

export function registerIpcHandlers(ctx: AppContext): void {
  ipcMain.handle(IPC.statsStatus, (): Promise<StatsStatus> =>
    ctx.stats ? ctx.stats.status() : Promise.resolve(STATS_OFF)
  )
  ipcMain.handle(IPC.statsData, (): Promise<StatsDataReport> =>
    ctx.stats ? ctx.stats.data() : Promise.reject(new Error('The stats are off on this computer.'))
  )
  ipcMain.handle(IPC.statsPause, async (): Promise<void> => {
    await ctx.stats?.pause()
    ctx.statsChanged()
  })
  ipcMain.handle(IPC.statsResume, async (): Promise<void> => {
    await ctx.stats?.resume()
    ctx.refreshStats()
    ctx.statsChanged()
  })
  ipcMain.handle(IPC.updateState, (): UpdateState => ctx.update.state())
  ipcMain.handle(IPC.updateInstall, (): void => ctx.update.install())
  ipcMain.handle(IPC.appVersion, (): string => app.getVersion())
}
