import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Downloads } from '@main/stats/download'
import * as identity from '@main/stats/identity'
import type { SourceFile } from '@main/stats/sources'
import { refreshStats } from '@main/stats/sync'
import { openTestDb, tempDir, writeFixture } from '../../fixtures/stats'

vi.mock('@main/stats/identity', () => ({
  canBuildIdentity: vi.fn(async () => true),
  identityStale: vi.fn(async () => false),
  markIdentityStale: vi.fn(async () => undefined),
  buildIdentity: vi.fn(async () => 7)
}))

const NOW = new Date('2026-11-05T12:00:00Z')
const CURRENT = 2027

const source = (id: string, tier: SourceFile['tier']): SourceFile => ({
  id,
  table: `src_${id}`,
  release: 'r',
  stem: id,
  tier,
  grain: 'row',
  version: 1,
  firstSeason: CURRENT,
  allSeasons: false,
  shared: false
})

const CORE = source('core_file', 'core')
const PUBLISHED = source('published_file', 'published')

beforeEach(() => {
  vi.mocked(identity.canBuildIdentity).mockResolvedValue(true)
  vi.mocked(identity.identityStale).mockResolvedValue(false)
  vi.mocked(identity.buildIdentity).mockClear()
})

async function run(
  sources: SourceFile[],
  missing: SourceFile[] = []
): Promise<ReturnType<typeof refreshStats>> {
  const db = await openTestDb()
  const file = await writeFixture(db, tempDir(), 'a.parquet', 'SELECT 1 AS x')
  const downloads: Downloads = {
    fetchFile: async (url) =>
      missing.some((s) => url.includes(s.stem))
        ? { kind: 'missing' }
        : { kind: 'file', path: file, etag: null, bytes: 1 },
    removeFile: async () => undefined
  }
  return refreshStats({ db, downloads, now: () => NOW }, {}, sources)
}

describe('the identity step', () => {
  it('runs as soon as the core tier has loaded, not at the end of the whole load', async () => {
    const { steps } = await run([CORE, PUBLISHED])
    expect(steps.map((s) => s.source)).toEqual([
      'stats:core_file:2027',
      'stats:identity',
      'stats:published_file:2027'
    ])
    expect(identity.buildIdentity).toHaveBeenCalledTimes(1)
    expect(steps[1].rowsWritten).toBe(7)
  })

  it('marks the tables out of date before anything can stop the build', async () => {
    vi.mocked(identity.markIdentityStale).mockClear()
    await run([CORE])
    expect(identity.markIdentityStale).toHaveBeenCalledOnce()
  })

  it('runs at the end when only the core tier was due', async () => {
    const { steps } = await run([CORE])
    expect(steps.map((s) => s.source)).toEqual(['stats:core_file:2027', 'stats:identity'])
  })

  it('does not run when nothing in the core tier changed', async () => {
    const { steps } = await run([PUBLISHED])
    expect(steps.map((s) => s.source)).toEqual(['stats:published_file:2027'])
    expect(identity.buildIdentity).not.toHaveBeenCalled()
  })

  it('does not run when the core tier found nothing new', async () => {
    const { steps } = await run([CORE], [CORE])
    expect(steps.map((s) => s.status)).toEqual(['skipped'])
    expect(identity.buildIdentity).not.toHaveBeenCalled()
  })

  it('runs with nothing due when a new version made it stale', async () => {
    vi.mocked(identity.identityStale).mockResolvedValue(true)
    const { steps } = await run([])
    expect(steps.map((s) => s.source)).toEqual(['stats:identity'])
  })

  it('waits while a table it reads is not loaded', async () => {
    vi.mocked(identity.canBuildIdentity).mockResolvedValue(false)
    const { steps } = await run([CORE])
    expect(steps.map((s) => s.source)).toEqual(['stats:core_file:2027'])
    expect(identity.buildIdentity).not.toHaveBeenCalled()
  })

  it('logs a failure and carries on with the load', async () => {
    vi.mocked(identity.buildIdentity).mockRejectedValueOnce(new Error('bad join'))
    const { steps } = await run([CORE, PUBLISHED])
    expect(steps.map((s) => [s.source, s.status, s.message])).toEqual([
      ['stats:core_file:2027', 'ok', null],
      ['stats:identity', 'error', 'bad join'],
      ['stats:published_file:2027', 'ok', null]
    ])
  })
})
