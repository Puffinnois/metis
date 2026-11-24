import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { openStatsService } from '@main/stats/service'
import type { StatsLogEntry } from '@main/stats/protocol'

// The refresh reports the steps the test names and asks a query after each; the engine counts how
// often the file's shape is read and answers nothing, so only the service's cache is under test.
const during = vi.hoisted(() => ({
  steps: [] as string[],
  ask: null as null | (() => Promise<void>)
}))
const reads = vi.hoisted(() => ({ count: 0 }))

vi.mock('@main/stats/sync', () => ({
  refreshStats: vi.fn(async (deps: { onStep?: (entry: StatsLogEntry) => void }) => {
    for (const source of during.steps) {
      deps.onStep?.({ source, status: 'ok' } as StatsLogEntry)
      await during.ask?.()
    }
    return { steps: [] }
  }),
  STATS_DERIVED_STEP: 'stats:derived'
}))

vi.mock('@main/stats/engine/run', async (original) => ({
  ...(await original<typeof import('@main/stats/engine/run')>()),
  readFileSchema: vi.fn(async () => {
    reads.count++
    return { columns: new Map(), empty: new Set() }
  }),
  runQuery: vi.fn(async () => ({ columns: [], rows: [] }))
}))

describe('what the open file holds, as the service keeps it', () => {
  it('reads the file’s shape once, again after each build step, and not after a download', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'metis-schema-'))
    const service = await openStatsService(
      { league: 'nba', dataDir: dir, tempDir: join(dir, 'tmp') },
      () => {},
      { freeBytes: () => null }
    )
    await service.read('CREATE TABLE player_season (season INTEGER)')
    const ask = async (): Promise<void> => {
      await service.query({ entity: 'player', metrics: ['pts'], scope: { seasons: [2026] } })
    }
    await ask()
    await ask()
    expect(reads.count).toBe(1)

    // A new metric answers once the step that builds its table is done, not only when the whole
    // refresh is: a college file's models take minutes after its game tables.
    const seen: number[] = []
    during.steps = ['src_nba_player_box', 'stats:derived', 'stats:models']
    during.ask = async () => {
      await ask()
      seen.push(reads.count)
    }
    await service.refresh({})
    expect(seen).toEqual([1, 2, 3])

    await ask()
    expect(reads.count).toBe(4)
    await service.close()
    rmSync(dir, { recursive: true, force: true })
  })
})
