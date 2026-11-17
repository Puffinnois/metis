import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type Api } from '@shared/ipc'
import type { LeagueId } from '@shared/leagues'
import type { UpdateState } from '@shared/types'

const api: Api = {
  update: {
    state: () => ipcRenderer.invoke(IPC.updateState),
    install: () => ipcRenderer.invoke(IPC.updateInstall),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, state: UpdateState): void => listener(state)
      ipcRenderer.on(IPC.updateChanged, handler)
      return () => {
        ipcRenderer.removeListener(IPC.updateChanged, handler)
      }
    }
  },
  app: {
    version: () => ipcRenderer.invoke(IPC.appVersion)
  },
  dev: {
    mode: () => ipcRenderer.invoke(IPC.devMode),
    setMode: (on) => ipcRenderer.invoke(IPC.devSetMode, on),
    onModeChanged: (listener) => {
      const handler = (_event: IpcRendererEvent, on: boolean): void => listener(on)
      ipcRenderer.on(IPC.devChanged, handler)
      return () => {
        ipcRenderer.removeListener(IPC.devChanged, handler)
      }
    },
    capture: () => ipcRenderer.invoke(IPC.devCapture),
    reportError: (error) => ipcRenderer.send(IPC.devReportError, error),
    recentErrors: () => ipcRenderer.invoke(IPC.devRecentErrors),
    notes: {
      list: () => ipcRenderer.invoke(IPC.devNotesList),
      save: (note) => ipcRenderer.invoke(IPC.devNotesSave, note),
      setStatus: (id, status) => ipcRenderer.invoke(IPC.devNotesSetStatus, id, status),
      remove: (id) => ipcRenderer.invoke(IPC.devNotesRemove, id),
      image: (path) => ipcRenderer.invoke(IPC.devNotesImage, path),
      folder: () => ipcRenderer.invoke(IPC.devNotesFolder),
      openFolder: () => ipcRenderer.invoke(IPC.devNotesOpenFolder),
      chooseFolder: () => ipcRenderer.invoke(IPC.devNotesChooseFolder),
      copy: (ids) => ipcRenderer.invoke(IPC.devNotesCopy, ids)
    }
  },
  stats: {
    status: (league) => ipcRenderer.invoke(IPC.statsStatus, league),
    data: (league) => ipcRenderer.invoke(IPC.statsData, league),
    pause: (league) => ipcRenderer.invoke(IPC.statsPause, league),
    resume: (league) => ipcRenderer.invoke(IPC.statsResume, league),
    query: (league, query) => ipcRenderer.invoke(IPC.statsQuery, league, query),
    catalogue: (league) => ipcRenderer.invoke(IPC.statsCatalogue, league),
    seasons: (league) => ipcRenderer.invoke(IPC.statsSeasons, league),
    player: (league, id) => ipcRenderer.invoke(IPC.statsPlayer, league, id),
    games: (league, season) => ipcRenderer.invoke(IPC.statsGames, league, season),
    game: (league, id) => ipcRenderer.invoke(IPC.statsGame, league, id),
    standings: (league, season) => ipcRenderer.invoke(IPC.statsStandings, league, season),
    matchups: (league, player, season, scope) =>
      ipcRenderer.invoke(IPC.statsMatchups, league, player, season, scope),
    gameMatchups: (league, game) => ipcRenderer.invoke(IPC.statsGameMatchups, league, game),
    officialsSeason: (league, season, gameTypes) =>
      ipcRenderer.invoke(IPC.statsOfficialsSeason, league, season, gameTypes),
    officialCareer: (league, official, gameTypes) =>
      ipcRenderer.invoke(IPC.statsOfficialCareer, league, official, gameTypes),
    onCourtUnits: (league, team, season, scope, size) =>
      ipcRenderer.invoke(IPC.statsOnCourtUnits, league, team, season, scope, size),
    withOrWithout: (league, player, teammate, season, scope) =>
      ipcRenderer.invoke(IPC.statsWithOrWithout, league, player, teammate, season, scope),
    profile: (league, player) => ipcRenderer.invoke(IPC.statsProfile, league, player),
    lineups: (league, team, season, gameType, group) =>
      ipcRenderer.invoke(IPC.statsLineups, league, team, season, gameType, group),
    availability: (league, players) => ipcRenderer.invoke(IPC.statsAvailability, league, players),
    coaches: (league, team, season) => ipcRenderer.invoke(IPC.statsCoaches, league, team, season),
    shots: (league, request) => ipcRenderer.invoke(IPC.statsShots, league, request),
    assists: (league, request) => ipcRenderer.invoke(IPC.statsAssists, league, request),
    gameFlow: (league, game) => ipcRenderer.invoke(IPC.statsGameFlow, league, game),
    views: (league) => ipcRenderer.invoke(IPC.statsViews, league),
    saveView: (league, name, board) => ipcRenderer.invoke(IPC.statsSaveView, league, name, board),
    deleteView: (league, id) => ipcRenderer.invoke(IPC.statsDeleteView, league, id),
    exportCsv: (fileName, csv) => ipcRenderer.invoke(IPC.statsExportCsv, fileName, csv),
    onChanged: (listener) => {
      const handler = (_event: IpcRendererEvent, league: LeagueId): void => listener(league)
      ipcRenderer.on(IPC.statsChanged, handler)
      return () => {
        ipcRenderer.removeListener(IPC.statsChanged, handler)
      }
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
