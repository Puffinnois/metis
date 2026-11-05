import type { DevNote, NewNote, NoteError, NoteStatus } from './devNotes'
import type { StatsDataReport, StatsStatus } from './stats/types'
import type { UpdateState } from './types'

/** What the preload script exposes to the renderer as `window.api`. */
export interface Api {
  update: {
    state(): Promise<UpdateState>
    /** Silent install + relaunch; no-op unless the state is `ready`. */
    install(): Promise<void>
    /** Fires on every state change; returns the unsubscribe function. */
    onChange(listener: (state: UpdateState) => void): () => void
  }
  app: {
    version(): Promise<string>
  }
  /** The developer tools; only the mode itself works when it is off. */
  dev: {
    mode(): Promise<boolean>
    /** Stores the choice; every window hears it through `onModeChanged`. */
    setMode(on: boolean): Promise<void>
    onModeChanged(listener: (on: boolean) => void): () => void
    /** The window as it looks now, as a PNG data URL (the renderer hides its dev overlays first). */
    capture(): Promise<string>
    /** A renderer error for the recent-errors buffer; fire and forget. */
    reportError(error: { message: string; stack: string | null }): void
    /** The errors a note would attach now, newest first. */
    recentErrors(): Promise<NoteError[]>
    notes: {
      /** Newest first. */
      list(): Promise<DevNote[]>
      save(note: NewNote): Promise<DevNote>
      setStatus(id: string, status: NoteStatus): Promise<void>
      remove(id: string): Promise<void>
      /** A note's image (its path relative to the folder) as a data URL; null when it is gone. */
      image(path: string): Promise<string | null>
      /** The notes folder in use. */
      folder(): Promise<string>
      openFolder(): Promise<void>
      /** Asks for a folder; resolves to it, null if cancelled. */
      chooseFolder(): Promise<string | null>
      /** Copies the notes' sections, image paths made absolute, to the clipboard. */
      copy(ids: string[]): Promise<void>
    }
  }
  stats: {
    /** What the database holds, for the nav's status line. */
    status(): Promise<StatsStatus>
    /** What is loaded, for the Data panel. */
    data(): Promise<StatsDataReport>
    /** Stops a running load and holds off any other, across launches, until `resume`. */
    pause(): Promise<void>
    resume(): Promise<void>
    /** Fires as a refresh progresses and when it ends; returns the unsubscribe function. */
    onChanged(listener: () => void): () => void
  }
}

export const IPC = {
  updateState: 'update:state',
  updateInstall: 'update:install',
  updateChanged: 'update:changed',
  appVersion: 'app:version',
  devMode: 'dev:mode',
  devSetMode: 'dev:setMode',
  devChanged: 'dev:changed',
  devCapture: 'dev:capture',
  devReportError: 'dev:reportError',
  devRecentErrors: 'dev:recentErrors',
  devNotesList: 'dev:notesList',
  devNotesSave: 'dev:notesSave',
  devNotesSetStatus: 'dev:notesSetStatus',
  devNotesRemove: 'dev:notesRemove',
  devNotesImage: 'dev:notesImage',
  devNotesFolder: 'dev:notesFolder',
  devNotesOpenFolder: 'dev:notesOpenFolder',
  devNotesChooseFolder: 'dev:notesChooseFolder',
  devNotesCopy: 'dev:notesCopy',
  statsStatus: 'stats:status',
  statsChanged: 'stats:changed',
  statsData: 'stats:data',
  statsPause: 'stats:pause',
  statsResume: 'stats:resume'
} as const
