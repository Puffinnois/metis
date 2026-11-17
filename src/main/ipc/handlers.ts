import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Db } from '@main/db/connection'
import { deleteStatsView, listStatsViews, saveStatsView } from '@main/db/repos/statsViews'
import type { StatsClient } from '@main/stats/client'
import { offlineStats, type StatsReads } from '@main/stats/offline'
import type { installAutoUpdater } from '@main/updater'
import { IPC } from '@shared/ipc'
import { leagueOf, type LeagueId } from '@shared/leagues'
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
  /**
   * A league's stats worker: null for a league with no data yet, or when its worker could not start
   * (the app runs and says so). One worker per league, each opening only its own file (D36).
   */
  stats: (league: LeagueId) => StatsClient | null
  /** Runs a league's refresh in the background; each file still decides if it is due. */
  refreshStats: (league: LeagueId) => void
  /** Tells the window to read a league's status again. */
  statsChanged: (league: LeagueId) => void
  update: ReturnType<typeof installAutoUpdater>
}

/**
 * The league a call names, checked (a bad id throws), and what answers for it: its worker, or the
 * answers of a league with no worker (`offlineStats`).
 */
function readsFor(ctx: AppContext, id: LeagueId): StatsReads {
  const league = leagueOf(id)
  return ctx.stats(league.id) ?? offlineStats(league)
}

export function registerIpcHandlers(ctx: AppContext): void {
  // Every stats call names its league first; the renderer holds the current league in one place.
  ipcMain.handle(IPC.statsStatus, (_e, league: LeagueId): Promise<StatsStatus> =>
    readsFor(ctx, league).status()
  )
  ipcMain.handle(IPC.statsData, (_e, league: LeagueId): Promise<StatsDataReport> =>
    readsFor(ctx, league).data()
  )
  ipcMain.handle(IPC.statsQuery, (_e, league: LeagueId, query: StatsQuery): Promise<StatsResult> =>
    readsFor(ctx, league).query(query)
  )
  ipcMain.handle(IPC.statsCatalogue, (_e, league: LeagueId): Promise<MetricInfo[]> =>
    readsFor(ctx, league).catalogue()
  )
  ipcMain.handle(IPC.statsSeasons, (_e, league: LeagueId): Promise<StatsSeason[]> =>
    readsFor(ctx, league).seasons()
  )
  ipcMain.handle(
    IPC.statsPlayer,
    (_e, league: LeagueId, id: string): Promise<StatsPlayerInfo | null> =>
      readsFor(ctx, league).player(id)
  )
  ipcMain.handle(IPC.statsGames, (_e, league: LeagueId, season: number): Promise<StatsGame[]> =>
    readsFor(ctx, league).games(season)
  )
  ipcMain.handle(
    IPC.statsGame,
    (_e, league: LeagueId, id: string): Promise<StatsGameDetail | null> =>
      readsFor(ctx, league).game(id)
  )
  ipcMain.handle(
    IPC.statsStandings,
    (_e, league: LeagueId, season: number): Promise<StatsStanding[]> =>
      readsFor(ctx, league).standings(season)
  )
  ipcMain.handle(
    IPC.statsMatchups,
    (
      _e,
      league: LeagueId,
      player: string,
      season: number,
      scope?: StatsMatchupScope
    ): Promise<StatsMatchups> => readsFor(ctx, league).matchups(player, season, scope)
  )
  ipcMain.handle(
    IPC.statsGameMatchups,
    (_e, league: LeagueId, game: string): Promise<StatsGameMatchups> =>
      readsFor(ctx, league).gameMatchups(game)
  )
  ipcMain.handle(
    IPC.statsOfficialsSeason,
    (
      _e,
      league: LeagueId,
      season: number,
      gameTypes: GameType[]
    ): Promise<StatsOfficialsSeason | null> =>
      readsFor(ctx, league).officialsSeason(season, gameTypes)
  )
  ipcMain.handle(
    IPC.statsOfficialCareer,
    (
      _e,
      league: LeagueId,
      official: string,
      gameTypes: GameType[]
    ): Promise<StatsOfficialCareer | null> =>
      readsFor(ctx, league).officialCareer(official, gameTypes)
  )
  ipcMain.handle(
    IPC.statsOnCourtUnits,
    (
      _e,
      league: LeagueId,
      team: string,
      season: number,
      scope: StatsOnCourtScope,
      size: number
    ): Promise<StatsOnCourtUnits> => readsFor(ctx, league).onCourtUnits(team, season, scope, size)
  )
  ipcMain.handle(
    IPC.statsWithOrWithout,
    (
      _e,
      league: LeagueId,
      player: string,
      teammate: string | null,
      season: number,
      scope: StatsOnCourtScope
    ): Promise<StatsWithOrWithout> =>
      readsFor(ctx, league).withOrWithout(player, teammate, season, scope)
  )
  ipcMain.handle(
    IPC.statsLineups,
    (
      _e,
      league: LeagueId,
      team: string,
      season: number,
      gameType: string,
      group: LineupGroup
    ): Promise<StatsLineups> => readsFor(ctx, league).lineups(team, season, gameType, group)
  )
  ipcMain.handle(
    IPC.statsShots,
    (_e, league: LeagueId, request: StatsShotRequest): Promise<StatsShotChart> =>
      readsFor(ctx, league).shots(request)
  )
  ipcMain.handle(
    IPC.statsAssists,
    (_e, league: LeagueId, request: StatsAssistRequest): Promise<StatsAssistNetwork> =>
      readsFor(ctx, league).assists(request)
  )
  ipcMain.handle(IPC.statsGameFlow, (_e, league: LeagueId, game: string): Promise<StatsGameFlow> =>
    readsFor(ctx, league).gameFlow(game)
  )
  ipcMain.handle(
    IPC.statsAvailability,
    (_e, league: LeagueId, players: string[]): Promise<StatsAvailability[]> =>
      readsFor(ctx, league).availability(players)
  )
  ipcMain.handle(
    IPC.statsCoaches,
    (_e, league: LeagueId, team: string, season: number): Promise<StatsCoach[]> =>
      readsFor(ctx, league).coaches(team, season)
  )
  ipcMain.handle(IPC.statsProfile, (_e, league: LeagueId, player: string): Promise<StatsProfile> =>
    readsFor(ctx, league).profile(player)
  )
  // Saved views are kept per league in `metis.db` (D35).
  ipcMain.handle(IPC.statsViews, (_e, league: LeagueId): StatsView[] =>
    listStatsViews(ctx.db, leagueOf(league).id)
  )
  ipcMain.handle(
    IPC.statsSaveView,
    (_e, league: LeagueId, name: string, board: LeaderboardBoard): StatsView =>
      saveStatsView(ctx.db, leagueOf(league).id, name, board, new Date().toISOString())
  )
  ipcMain.handle(IPC.statsDeleteView, (_e, league: LeagueId, id: number): void =>
    deleteStatsView(ctx.db, leagueOf(league).id, id)
  )
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
  ipcMain.handle(IPC.statsPause, async (_e, league: LeagueId): Promise<void> => {
    await readsFor(ctx, league).pause()
    ctx.statsChanged(league)
  })
  ipcMain.handle(IPC.statsResume, async (_e, league: LeagueId): Promise<void> => {
    await readsFor(ctx, league).resume()
    ctx.refreshStats(league)
    ctx.statsChanged(league)
  })
  ipcMain.handle(IPC.updateState, (): UpdateState => ctx.update.state())
  ipcMain.handle(IPC.updateInstall, (): Promise<void> => ctx.update.install())
  ipcMain.handle(IPC.appVersion, (): string => app.getVersion())
}
