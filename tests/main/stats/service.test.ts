import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openStatsService, type StatsService } from '@main/stats/service'

let dir: string
let service: StatsService | null

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'metis-service-'))
  service = await openStatsService({ path: join(dir, 'stats.duckdb'), tempDir: join(dir, 'tmp') })
})

afterEach(async () => {
  await service?.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('the stats service', () => {
  it('reports an empty database as available with no stats', async () => {
    await expect(service!.status()).resolves.toEqual({
      available: true,
      through: null,
      updatedAt: null,
      builtAt: null,
      busy: false,
      progress: null,
      paused: false,
      noRoom: null
    })
  })

  it('reports what is loaded for the Data panel, every release included', async () => {
    const report = await service!.data()
    expect(report.families).toHaveLength(44)
    expect(report.families[0]).toMatchObject({ tier: 'core', state: 'waiting', filesLoaded: 0 })
    expect(report.databaseBytes).toBeGreaterThan(0)
  })

  it('holds off a refresh while paused, across a reopen, until resumed', async () => {
    await service!.pause()
    await expect(service!.status()).resolves.toMatchObject({ paused: true, busy: false })
    await expect(service!.refresh({})).resolves.toEqual({ steps: [] })
    await service!.close()
    service = await openStatsService(
      { path: join(dir, 'stats.duckdb'), tempDir: join(dir, 'tmp') },
      () => {},
      { freeBytes: () => 1 }
    )
    await expect(service.status()).resolves.toMatchObject({ paused: true })
    await service.resume()
    await expect(service.status()).resolves.toMatchObject({ paused: false })
  })

  it('does not start a first load without room for it, and says so', async () => {
    await service!.close()
    service = await openStatsService(
      { path: join(dir, 'stats.duckdb'), tempDir: join(dir, 'tmp') },
      () => {},
      { freeBytes: () => 1024 }
    )
    await expect(service.refresh({})).resolves.toEqual({ steps: [] })
    const { noRoom } = await service.status()
    expect(noRoom?.freeBytes).toBe(1024)
    expect(noRoom?.neededBytes).toBeGreaterThan(5 * 1024 ** 3)
  })

  it('names the latest game once box scores are loaded, newest season first', async () => {
    await service!.read(
      `CREATE TABLE src_espn_team_box AS
       SELECT 2026 AS season, DATE '2026-06-13' AS game_date
       UNION ALL SELECT 2027, DATE '2026-11-04' UNION ALL SELECT 2027, DATE '2026-10-21'`
    )
    await expect(service!.status()).resolves.toMatchObject({
      through: { season: 2027, date: '2026-11-04' }
    })
  })

  it('answers one SQL statement on its own connection', async () => {
    await expect(service!.read('SELECT 1 + 1 AS two')).resolves.toEqual([{ two: 2 }])
  })

  it('passes its self-test: write, read, Parquet, JSON and time zones', async () => {
    const result = await service!.selfTest()
    expect(result).toMatchObject({ rows: 1000, parquet: true, json: true, icu: true })
    expect(result.duckdb).toMatch(/^v\d/)
  })

  it('refuses reads once closing', async () => {
    const closing = service!
    service = null
    await closing.close()
    await expect(closing.status()).rejects.toThrow('closing')
  })
})
