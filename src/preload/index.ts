import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type Api } from '@shared/ipc'
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
    status: () => ipcRenderer.invoke(IPC.statsStatus),
    data: () => ipcRenderer.invoke(IPC.statsData),
    pause: () => ipcRenderer.invoke(IPC.statsPause),
    resume: () => ipcRenderer.invoke(IPC.statsResume),
    query: (query) => ipcRenderer.invoke(IPC.statsQuery, query),
    catalogue: () => ipcRenderer.invoke(IPC.statsCatalogue),
    seasons: () => ipcRenderer.invoke(IPC.statsSeasons),
    player: (id) => ipcRenderer.invoke(IPC.statsPlayer, id),
    games: (season) => ipcRenderer.invoke(IPC.statsGames, season),
    game: (id) => ipcRenderer.invoke(IPC.statsGame, id),
    standings: (season) => ipcRenderer.invoke(IPC.statsStandings, season),
    matchups: (player, season, scope) =>
      ipcRenderer.invoke(IPC.statsMatchups, player, season, scope),
    gameMatchups: (game) => ipcRenderer.invoke(IPC.statsGameMatchups, game),
    officialsSeason: (season, gameTypes) =>
      ipcRenderer.invoke(IPC.statsOfficialsSeason, season, gameTypes),
    officialCareer: (official, gameTypes) =>
      ipcRenderer.invoke(IPC.statsOfficialCareer, official, gameTypes),
    onCourtUnits: (team, season, scope, size) =>
      ipcRenderer.invoke(IPC.statsOnCourtUnits, team, season, scope, size),
    withOrWithout: (player, teammate, season, scope) =>
      ipcRenderer.invoke(IPC.statsWithOrWithout, player, teammate, season, scope),
    profile: (player) => ipcRenderer.invoke(IPC.statsProfile, player),
    lineups: (team, season, gameType, group) =>
      ipcRenderer.invoke(IPC.statsLineups, team, season, gameType, group),
    availability: (players) => ipcRenderer.invoke(IPC.statsAvailability, players),
    coaches: (team, season) => ipcRenderer.invoke(IPC.statsCoaches, team, season),
    views: () => ipcRenderer.invoke(IPC.statsViews),
    saveView: (name, board) => ipcRenderer.invoke(IPC.statsSaveView, name, board),
    deleteView: (id) => ipcRenderer.invoke(IPC.statsDeleteView, id),
    exportCsv: (fileName, csv) => ipcRenderer.invoke(IPC.statsExportCsv, fileName, csv),
    onChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on(IPC.statsChanged, handler)
      return () => {
        ipcRenderer.removeListener(IPC.statsChanged, handler)
      }
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
