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
      busy: false
    })
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
