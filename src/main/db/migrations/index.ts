import settingsSql from './001_settings.sql?raw'
import statsViewsSql from './002_stats_views.sql?raw'
import leaguesSql from './003_leagues.sql?raw'
import favouritesSql from './004_favourites.sql?raw'

export interface Migration {
  version: number
  name: string
  sql: string
}

/**
 * `metis.db`: the app's own settings, saved views and favourites, the views, a league's own settings
 * and the favourites keyed by league (D35, D49). The stats themselves live in a file per league
 * (`stats-nba.duckdb`, D36).
 */
export const migrations: Migration[] = [
  { version: 1, name: 'settings', sql: settingsSql },
  { version: 2, name: 'stats_views', sql: statsViewsSql },
  { version: 3, name: 'leagues', sql: leaguesSql },
  { version: 4, name: 'favourites', sql: favouritesSql }
]
