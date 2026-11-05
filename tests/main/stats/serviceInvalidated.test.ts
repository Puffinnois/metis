import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { openStatsService } from '@main/stats/service'

vi.mock('@main/stats/sync', () => ({
  refreshStats: vi.fn(async () => ({ steps: [], fatal: 'FATAL Error: invalidated' }))
}))

describe('a database DuckDB has invalidated', () => {
  it('reports the stats as off, not as an error on every read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'metis-invalidated-'))
    const service = await openStatsService({
      path: join(dir, 'stats.duckdb'),
      tempDir: join(dir, 'tmp')
    })
    await expect(service.status()).resolves.toMatchObject({ available: true })
    await expect(service.refresh({})).resolves.toMatchObject({ fatal: 'FATAL Error: invalidated' })
    await expect(service.status()).resolves.toEqual({
      available: false,
      through: null,
      updatedAt: null,
      busy: false,
      progress: null
    })
    await service.close()
    rmSync(dir, { recursive: true, force: true })
  })
})
