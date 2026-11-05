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
}
