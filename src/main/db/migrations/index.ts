import settingsSql from './001_settings.sql?raw'
import statsViewsSql from './002_stats_views.sql?raw'

export interface Migration {
  version: number
  name: string
  sql: string
}

/** `metis.db`: the app's own settings and saved views. The stats themselves live in `stats.duckdb`. */
export const migrations: Migration[] = [
  { version: 1, name: 'settings', sql: settingsSql },
  { version: 2, name: 'stats_views', sql: statsViewsSql }
]
