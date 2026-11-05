import { describe, expect, it } from 'vitest'
import { openTestDb } from '../../fixtures/stats'

describe('StatsDb.interrupt', () => {
  it('stops the running statement, and the connection keeps working', async () => {
    const db = await openTestDb()
    const long = db.all('SELECT count(*) AS n FROM range(100000000000) a')
    setTimeout(() => db.interrupt(), 50)
    await expect(long).rejects.toThrow('Interrupted')
    expect(await db.get('SELECT 1 AS one')).toEqual({ one: 1 })
  })
})
