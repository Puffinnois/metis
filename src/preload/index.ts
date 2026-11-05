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
