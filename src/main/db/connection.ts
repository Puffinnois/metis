import { DatabaseSync } from 'node:sqlite'

export type Db = DatabaseSync

export function openDatabase(path: string): Db {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

export function withTransaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // already rolled back (e.g. SQLITE_FULL); keep the original error
    }
    throw err
  }
}
