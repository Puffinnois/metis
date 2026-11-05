import settingsSql from './001_settings.sql?raw'

export interface Migration {
  version: number
  name: string
  sql: string
}

/** `metis.db`: the app's own settings. The stats themselves live in `stats.duckdb`. */
export const migrations: Migration[] = [{ version: 1, name: 'settings', sql: settingsSql }]
