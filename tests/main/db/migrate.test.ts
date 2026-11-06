import { describe, expect, it } from 'vitest'
import { openDatabase, withTransaction } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { getSetting, setSetting } from '@main/db/repos/settings'

describe('migrate', () => {
  it('creates the settings table on an empty database', () => {
    const db = openDatabase(':memory:')
    expect(migrate(db)).toBe(2)
    setSetting(db, 'dev_mode', '1')
    setSetting(db, 'dev_mode', '0')
    expect(getSetting(db, 'dev_mode')).toBe('0')
    expect(getSetting(db, 'nope')).toBeNull()
  })

  it('is idempotent', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(() => migrate(db)).not.toThrow()
    const row = db.prepare('SELECT COUNT(*) AS n FROM schema_version').get() as { n: number }
    expect(row.n).toBe(2)
  })

  it('rolls back the transaction when the callback throws', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(() =>
      withTransaction(db, () => {
        db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('foo', 'bar')
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(getSetting(db, 'foo')).toBeNull()

    // the connection is not left mid-transaction: a subsequent transaction still works
    withTransaction(db, () => {
      setSetting(db, 'baz', 'qux')
    })
    expect(getSetting(db, 'baz')).toBe('qux')
  })
})
