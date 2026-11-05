import { describe, expect, it } from 'vitest'
import { INTERRUPTED_MESSAGE, bootstrapStatsDb } from '@main/stats/schema'
import { openTestDb } from '../../fixtures/stats'

describe('bootstrapStatsDb', () => {
  it('marks steps a closed app left running as interrupted', async () => {
    const db = await openTestDb()
    await db.exec(
      "INSERT INTO sync_log (source, started_at, status) VALUES ('stats:pbp:2027', '2026-10-14T20:23:31Z', 'running')"
    )
    expect(await bootstrapStatsDb(db, new Date('2026-10-16T12:00:00Z'))).toBe(1)
    expect(await db.get('SELECT status, finished_at, message FROM sync_log')).toEqual({
      status: 'interrupted',
      finished_at: '2026-10-16T12:00:00.000Z',
      message: INTERRUPTED_MESSAGE
    })
  })

  it('keeps the log across opens', async () => {
    const db = await openTestDb()
    await db.exec(
      "INSERT INTO sync_log (source, started_at, status) VALUES ('stats:games', 't', 'ok')"
    )
    expect(await bootstrapStatsDb(db, new Date())).toBe(0)
    expect(await db.get('SELECT count(*) AS n FROM sync_log')).toEqual({ n: 1 })
  })
})
