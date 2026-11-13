import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Db } from '@main/db/connection'
import { deleteStatsView, listStatsViews, saveStatsView } from '@main/db/repos/statsViews'
import type { StatsClient } from '@main/stats/client'
import type { installAutoUpdater } from '@main/updater'
import { IPC } from '@shared/ipc'
import type { LineupGroup } from '@shared/stats/lineups'
import type {
  StatsAssistRequest,
  StatsAssistNetwork,
  StatsGameFlow,
  StatsShotRequest,
  StatsShotChart,
  LeaderboardBoard,
  MetricInfo,
  StatsDataReport,
  StatsGame,
  StatsGameDetail,
  StatsLineups,
  StatsMatchups,
  StatsMatchupScope,
  StatsGameMatchups,
  StatsOfficialCareer,
  StatsOnCourtScope,
  StatsOnCourtUnits,
  StatsWithOrWithout,
  StatsOfficialsSeason,
  GameType,
  StatsProfile,
  StatsAvailability,
  StatsCoach,
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
    (_event, player: string, season: number, scope?: StatsMatchupScope): Promise<StatsMatchups> =>
      ctx.stats
        ? ctx.stats.matchups(player, season, scope)
        : Promise.resolve({ guarded: [], guardedBy: [], source: 'season' })
  )
  ipcMain.handle(IPC.statsGameMatchups, (_event, game: string): Promise<StatsGameMatchups> =>
    ctx.stats ? ctx.stats.gameMatchups(game) : Promise.resolve({ pairs: [], reason: null })
  )
  ipcMain.handle(
    IPC.statsOfficialsSeason,
    (_event, season: number, gameTypes: GameType[]): Promise<StatsOfficialsSeason | null> =>
      ctx.stats ? ctx.stats.officialsSeason(season, gameTypes) : Promise.resolve(null)
  )
  ipcMain.handle(
    IPC.statsOfficialCareer,
    (_event, official: string, gameTypes: GameType[]): Promise<StatsOfficialCareer | null> =>
      ctx.stats ? ctx.stats.officialCareer(official, gameTypes) : Promise.resolve(null)
  )
  ipcMain.handle(
    IPC.statsOnCourtUnits,
    (
      _event,
      team: string,
      season: number,
      scope: StatsOnCourtScope,
      size: number
    ): Promise<StatsOnCourtUnits> =>
      ctx.stats
        ? ctx.stats.onCourtUnits(team, season, scope, size)
        : Promise.resolve({ units: [], reason: null })
  )
  ipcMain.handle(
    IPC.statsWithOrWithout,
    (
      _event,
      player: string,
      teammate: string | null,
      season: number,
      scope: StatsOnCourtScope
    ): Promise<StatsWithOrWithout> =>
      ctx.stats
        ? ctx.stats.withOrWithout(player, teammate, season, scope)
        : Promise.resolve({
            teamId: null,
            teammate: null,
            teammates: [],
            splits: null,
            reason: null
          })
  )
  ipcMain.handle(
    IPC.statsLineups,
    (
      _event,
      team: string,
      season: number,
      gameType: string,
      group: LineupGroup
    ): Promise<StatsLineups> =>
      ctx.stats
        ? ctx.stats.lineups(team, season, gameType, group)
        : Promise.resolve({ units: [], floorMinutes: null })
  )
  ipcMain.handle(IPC.statsShots, (_event, request: StatsShotRequest): Promise<StatsShotChart> =>
    ctx.stats
      ? ctx.stats.shots(request)
      : Promise.resolve({ shots: [], total: 0, made: 0, capped: false, zones: [], reason: null })
  )
  ipcMain.handle(
    IPC.statsAssists,
    (_event, request: StatsAssistRequest): Promise<StatsAssistNetwork> =>
      ctx.stats
        ? ctx.stats.assists(request)
        : Promise.resolve({ pairs: [], total: 0, reason: null })
  )
  ipcMain.handle(IPC.statsGameFlow, (_event, game: string): Promise<StatsGameFlow> =>
    ctx.stats
      ? ctx.stats.gameFlow(game)
      : Promise.resolve({
          points: [],
          periods: 4,
          homeTeam: '',
          awayTeam: '',
          summary: null,
          reason: null
        })
  )
  ipcMain.handle(
    IPC.statsAvailability,
    (_event, players: string[]): Promise<StatsAvailability[]> =>
      ctx.stats ? ctx.stats.availability(players) : Promise.resolve([])
  )
  ipcMain.handle(IPC.statsCoaches, (_event, team: string, season: number): Promise<StatsCoach[]> =>
    ctx.stats ? ctx.stats.coaches(team, season) : Promise.resolve([])
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
