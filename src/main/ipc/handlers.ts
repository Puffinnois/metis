import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Db } from '@main/db/connection'
import { deleteStatsView, listStatsViews, saveStatsView } from '@main/db/repos/statsViews'
import type { StatsClient } from '@main/stats/client'
import type { installAutoUpdater } from '@main/updater'
import { IPC } from '@shared/ipc'
import type {
  LeaderboardBoard,
  MetricInfo,
  StatsDataReport,
  StatsGame,
  StatsGameDetail,
  StatsMatchups,
  StatsProfile,
  StatsPlayerInfo,
  StatsQuery,
  StatsResult,
  StatsSeason,
  StatsStanding,
  StatsStatus,
  StatsView
} from '@shared/stats/types'
import type { UpdateState } from '@shared/types'

export interface AppContext {
  db: Db
  getWindow: () => BrowserWindow | null
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
  builtAt: null,
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

const STATS_ARE_OFF = 'The stats are off on this computer.'

export function registerIpcHandlers(ctx: AppContext): void {
  ipcMain.handle(IPC.statsStatus, (): Promise<StatsStatus> =>
    ctx.stats ? ctx.stats.status() : Promise.resolve(STATS_OFF)
  )
  ipcMain.handle(IPC.statsData, (): Promise<StatsDataReport> =>
    ctx.stats ? ctx.stats.data() : Promise.reject(new Error(STATS_ARE_OFF))
  )
  ipcMain.handle(IPC.statsQuery, (_event, query: StatsQuery): Promise<StatsResult> =>
    ctx.stats ? ctx.stats.query(query) : Promise.reject(new Error(STATS_ARE_OFF))
  )
  ipcMain.handle(IPC.statsCatalogue, (): Promise<MetricInfo[]> =>
    ctx.stats ? ctx.stats.catalogue() : Promise.resolve([])
  )
  ipcMain.handle(IPC.statsSeasons, (): Promise<StatsSeason[]> =>
    ctx.stats ? ctx.stats.seasons() : Promise.resolve([])
  )
  ipcMain.handle(IPC.statsPlayer, (_event, id: string): Promise<StatsPlayerInfo | null> =>
    ctx.stats ? ctx.stats.player(id) : Promise.resolve(null)
  )
  ipcMain.handle(IPC.statsGames, (_event, season: number): Promise<StatsGame[]> =>
    ctx.stats ? ctx.stats.games(season) : Promise.resolve([])
  )
  ipcMain.handle(IPC.statsGame, (_event, id: string): Promise<StatsGameDetail | null> =>
    ctx.stats ? ctx.stats.game(id) : Promise.resolve(null)
  )
  ipcMain.handle(IPC.statsStandings, (_event, season: number): Promise<StatsStanding[]> =>
    ctx.stats ? ctx.stats.standings(season) : Promise.resolve([])
  )
  ipcMain.handle(
    IPC.statsMatchups,
    (_event, player: string, season: number): Promise<StatsMatchups> =>
      ctx.stats
        ? ctx.stats.matchups(player, season)
        : Promise.resolve({ guarded: [], guardedBy: [] })
  )
  ipcMain.handle(IPC.statsProfile, (_event, player: string): Promise<StatsProfile> =>
    ctx.stats
      ? ctx.stats.profile(player)
      : Promise.resolve({
          bio: null,
          draft: null,
          draftYears: null,
          combines: [],
          combineYears: null
        })
  )
  ipcMain.handle(IPC.statsViews, (): StatsView[] => listStatsViews(ctx.db))
  ipcMain.handle(IPC.statsSaveView, (_event, name: string, board: LeaderboardBoard): StatsView =>
    saveStatsView(ctx.db, name, board, new Date().toISOString())
  )
  ipcMain.handle(IPC.statsDeleteView, (_event, id: number): void => deleteStatsView(ctx.db, id))
  ipcMain.handle(
    IPC.statsExportCsv,
    async (_event, fileName: string, csv: string): Promise<string | null> => {
      const window = ctx.getWindow()
      const options = {
        defaultPath: join(app.getPath('downloads'), fileName),
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      }
      const picked = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options)
      if (picked.canceled || !picked.filePath) return null
      // A byte-order mark so Excel reads the names' accents as UTF-8.
      await writeFile(picked.filePath, `\uFEFF${csv}`, 'utf8')
      return picked.filePath
    }
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
