import type { LeagueId } from '@shared/leagues'
import type { Db } from '../connection'

export function getSetting(db: Db, key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(db: Db, key: string, value: string): void {
  db.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}

/** A league's own setting (D35), such as the scope it was left on; app-wide ones use `getSetting`. */
export function getLeagueSetting(db: Db, league: LeagueId, key: string): string | null {
  const row = db
    .prepare('SELECT value FROM league_settings WHERE league = ? AND key = ?')
    .get(league, key) as { value: string } | undefined
  return row?.value ?? null
}

export function setLeagueSetting(db: Db, league: LeagueId, key: string, value: string): void {
  db.prepare(
    `INSERT INTO league_settings (league, key, value) VALUES (?, ?, ?)
     ON CONFLICT(league, key) DO UPDATE SET value = excluded.value`
  ).run(league, key, value)
}
