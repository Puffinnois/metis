/** The status line of the nav: what the stats database holds and whether it is being updated. */
export interface StatsStatus {
  /** The stats worker runs (DuckDB loaded). */
  available: boolean
  /** The latest game with stats; null before the first load. `date` is YYYY-MM-DD. */
  through: { season: number; date: string } | null
  /** The last step that wrote rows, ISO time. */
  updatedAt: string | null
  /** A refresh is running. */
  busy: boolean
  /** How far it has got, in files; null when none is running. */
  progress: { done: number; total: number } | null
  /** The owner paused loading; nothing downloads until they resume. */
  paused: boolean
  /** The first load did not start: too little disk space. */
  noRoom: { neededBytes: number; freeBytes: number } | null
}

export type StatsFamilyState = 'loaded' | 'partial' | 'waiting' | 'failed'

/** One release of the dataset, as the Data panel shows it. */
export interface StatsFamily {
  release: string
  label: string
  tier: 'core' | 'published' | 'events' | 'plays'
  state: StatsFamilyState
  filesLoaded: number
  /** Files published so far: the current season's playoffs do not count before they are played. */
  filesExpected: number
  /** Seasons held, by final year; null for a family of files holding all seasons. */
  firstSeason: number | null
  lastSeason: number | null
  /** As downloaded. */
  bytes: number
  rows: number
  /** The latest file's fetch, ISO time. */
  fetchedAt: string | null
  /** The latest error still standing; a file that has since loaded clears it. */
  lastError: string | null
}

/** What the Data panel shows. */
export interface StatsDataReport {
  families: StatsFamily[]
  databaseBytes: number
  /** Null when the system will not say. */
  freeBytes: number | null
}
