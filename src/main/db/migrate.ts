import { withTransaction, type Db } from './connection'
import { migrations as appMigrations, type Migration } from './migrations'

/** Applies `migrations` (default: the app database's) that `db` has not seen yet. */
export function migrate(db: Db, migrations: Migration[] = appMigrations): number {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`)
  const row = db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_version').get() as {
    v: number
  }
  let current = row.v
  for (const m of migrations) {
    if (m.version <= current) continue
    withTransaction(db, () => {
      db.exec(m.sql)
      db.prepare('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)').run(
        m.version,
        m.name,
        new Date().toISOString()
      )
    })
    current = m.version
  }
  return current
}
