import settingsSql from './001_settings.sql?raw'
import statsViewsSql from './002_stats_views.sql?raw'
import leaguesSql from './003_leagues.sql?raw'

export interface Migration {
  version: number
  name: string
  sql: string
}

/**
 * `metis.db`: the app's own settings and saved views, the views and a league's own settings keyed by
 * league (D35). The stats themselves live in a file per league (`stats-nba.duckdb`, D36).
 */
export const migrations: Migration[] = [
  { version: 1, name: 'settings', sql: settingsSql },
  { version: 2, name: 'stats_views', sql: statsViewsSql },
  { version: 3, name: 'leagues', sql: leaguesSql }
]
