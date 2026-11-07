import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as derived from '@main/stats/derived/build'
import * as published from '@main/stats/derived/published'
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

vi.mock('@main/stats/derived/build', () => ({
  canDerive: vi.fn(async () => true),
  derivedStale: vi.fn(async () => false),
  markDerivedStale: vi.fn(async () => undefined),
  buildDerived: vi.fn(async () => 11)
}))

vi.mock('@main/stats/derived/published', () => ({
  canBuildPublished: vi.fn(() => true),
  publishedStale: vi.fn(async () => false),
  markPublishedStale: vi.fn(async () => undefined),
  buildPublished: vi.fn(async () => 13),
  publishedBootstrap: vi.fn(() => [])
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
const EVENTS = source('events_file', 'events')

beforeEach(() => {
  vi.mocked(published.canBuildPublished).mockReturnValue(true)
  vi.mocked(published.publishedStale).mockResolvedValue(false)
  vi.mocked(published.markPublishedStale).mockClear()
  vi.mocked(published.buildPublished).mockClear()
  vi.mocked(identity.canBuildIdentity).mockResolvedValue(true)
  vi.mocked(identity.identityStale).mockResolvedValue(false)
  vi.mocked(identity.buildIdentity).mockClear()
  vi.mocked(derived.canDerive).mockResolvedValue(true)
  vi.mocked(derived.derivedStale).mockResolvedValue(false)
  vi.mocked(derived.buildDerived).mockClear()
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

describe('the identity and derived steps', () => {
  it('run as soon as the core tier has loaded, not at the end of the whole load', async () => {
    const { steps } = await run([CORE, PUBLISHED])
    expect(steps.map((s) => s.source)).toEqual([
      'stats:core_file:2027',
      'stats:identity',
      'stats:derived',
      'stats:published_file:2027',
      'stats:published'
    ])
    expect(identity.buildIdentity).toHaveBeenCalledTimes(1)
    expect(derived.buildDerived).toHaveBeenCalledTimes(1)
    expect(steps[1].rowsWritten).toBe(7)
    expect(steps[2].rowsWritten).toBe(11)
  })

  it('mark the tables out of date before anything can stop the build', async () => {
    vi.mocked(identity.markIdentityStale).mockClear()
    vi.mocked(derived.markDerivedStale).mockClear()
    await run([CORE])
    expect(identity.markIdentityStale).toHaveBeenCalledOnce()
    expect(derived.markDerivedStale).toHaveBeenCalledOnce()
  })

  it('run at the end when only the core tier was due', async () => {
    const { steps } = await run([CORE])
    expect(steps.map((s) => s.source)).toEqual([
      'stats:core_file:2027',
      'stats:identity',
      'stats:derived'
    ])
  })

  it('do not run when nothing in the core tier changed', async () => {
    const { steps } = await run([PUBLISHED])
    expect(steps.map((s) => s.source)).toEqual(['stats:published_file:2027', 'stats:published'])
    expect(identity.buildIdentity).not.toHaveBeenCalled()
    expect(derived.buildDerived).not.toHaveBeenCalled()
  })

  it('do not run when the core tier found nothing new', async () => {
    const { steps } = await run([CORE], [CORE])
    expect(steps.map((s) => s.status)).toEqual(['skipped'])
    expect(identity.buildIdentity).not.toHaveBeenCalled()
    expect(derived.buildDerived).not.toHaveBeenCalled()
  })

  it('rebuild only identity when a new version made only it stale', async () => {
    vi.mocked(identity.identityStale).mockResolvedValue(true)
    const { steps } = await run([])
    expect(steps.map((s) => s.source)).toEqual(['stats:identity'])
  })

  it('rebuild only the derived tables when a new version made only them stale', async () => {
    vi.mocked(derived.derivedStale).mockResolvedValue(true)
    const { steps } = await run([])
    expect(steps.map((s) => s.source)).toEqual(['stats:derived'])
    expect(identity.buildIdentity).not.toHaveBeenCalled()
  })

  it('wait while a table they read is not loaded', async () => {
    vi.mocked(identity.canBuildIdentity).mockResolvedValue(false)
    vi.mocked(derived.canDerive).mockResolvedValue(false)
    const { steps } = await run([CORE])
    expect(steps.map((s) => s.source)).toEqual(['stats:core_file:2027'])
    expect(identity.buildIdentity).not.toHaveBeenCalled()
    expect(derived.buildDerived).not.toHaveBeenCalled()
  })

  it('log a failure and carry on with the load', async () => {
    vi.mocked(identity.buildIdentity).mockRejectedValueOnce(new Error('bad join'))
    vi.mocked(derived.buildDerived).mockRejectedValueOnce(new Error('bad sum'))
    const { steps } = await run([CORE, PUBLISHED])
    expect(steps.map((s) => [s.source, s.status, s.message])).toEqual([
      ['stats:core_file:2027', 'ok', null],
      ['stats:identity', 'error', 'bad join'],
      ['stats:derived', 'error', 'bad sum'],
      ['stats:published_file:2027', 'ok', null],
      ['stats:published', 'ok', null]
    ])
  })
})

describe('the published step', () => {
  it('runs once the published tier has loaded, before the events load', async () => {
    const { steps } = await run([PUBLISHED, EVENTS])
    expect(steps.map((s) => s.source)).toEqual([
      'stats:published_file:2027',
      'stats:published',
      'stats:events_file:2027'
    ])
    expect(steps[1].rowsWritten).toBe(13)
    expect(published.buildPublished).toHaveBeenCalledTimes(1)
  })

  it('marks the tables out of date before anything can stop the build', async () => {
    await run([PUBLISHED])
    expect(published.markPublishedStale).toHaveBeenCalledOnce()
  })

  it('does not run when nothing published changed', async () => {
    const { steps } = await run([CORE, EVENTS])
    expect(steps.map((s) => s.source)).not.toContain('stats:published')
    expect(published.buildPublished).not.toHaveBeenCalled()
    await run([PUBLISHED], [PUBLISHED])
    expect(published.buildPublished).not.toHaveBeenCalled()
  })

  it('runs alone when a new version made the tables stale', async () => {
    vi.mocked(published.publishedStale).mockResolvedValue(true)
    const { steps } = await run([])
    expect(steps.map((s) => s.source)).toEqual(['stats:published'])
  })

  it('logs nothing while there is no table to build', async () => {
    vi.mocked(published.canBuildPublished).mockReturnValue(false)
    vi.mocked(published.publishedStale).mockResolvedValue(true)
    const { steps } = await run([PUBLISHED])
    expect(steps.map((s) => s.source)).toEqual(['stats:published_file:2027'])
    expect(published.markPublishedStale).not.toHaveBeenCalled()
  })

  it('logs a failure and carries on with the load', async () => {
    vi.mocked(published.buildPublished).mockRejectedValueOnce(new Error('bad cast'))
    const { steps } = await run([PUBLISHED, EVENTS])
    expect(steps.map((s) => [s.source, s.status, s.message])).toEqual([
      ['stats:published_file:2027', 'ok', null],
      ['stats:published', 'error', 'bad cast'],
      ['stats:events_file:2027', 'ok', null]
    ])
  })
})
