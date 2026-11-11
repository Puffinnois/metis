import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as plays from '@main/stats/derived/plays'
import type { Downloads } from '@main/stats/download'
import type { SourceFile } from '@main/stats/sources'
import { refreshStats, STATS_PLAYS_STEP } from '@main/stats/sync'
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
  canBuildPublished: vi.fn(() => false),
  publishedStale: vi.fn(async () => false),
  markPublishedStale: vi.fn(async () => undefined),
  buildPublished: vi.fn(async () => 13),
  publishedBootstrap: vi.fn(() => [])
}))

vi.mock('@main/stats/derived/plays', () => ({
  canBuildPlays: vi.fn(async () => true),
  playsStale: vi.fn(async () => false),
  markPlaysStale: vi.fn(async () => undefined),
  buildPlays: vi.fn(async () => 17),
  playsBootstrap: vi.fn(() => [])
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

const PUBLISHED = source('published_file', 'published')
const EVENTS = source('events_file', 'events')
const PLAYS = source('plays_file', 'plays')

beforeEach(() => {
  vi.mocked(plays.canBuildPlays).mockResolvedValue(true)
  vi.mocked(plays.playsStale).mockResolvedValue(false)
  vi.mocked(plays.markPlaysStale).mockClear()
  vi.mocked(plays.buildPlays).mockClear()
})

async function run(sources: SourceFile[]): Promise<string[]> {
  const db = await openTestDb()
  const file = await writeFixture(db, tempDir(), 'a.parquet', 'SELECT 1 AS x')
  const downloads: Downloads = {
    fetchFile: async () => ({ kind: 'file', path: file, etag: null, bytes: 1 }),
    removeFile: async () => undefined
  }
  const { steps } = await refreshStats({ db, downloads, now: () => NOW }, {}, sources)
  return steps.map((s) => `${s.source} ${s.status}`)
}

describe('the plays step', () => {
  it('runs once, at the end of the load, after the events and plays tiers', async () => {
    expect(await run([PUBLISHED, EVENTS, PLAYS])).toEqual([
      'stats:published_file:2027 ok',
      'stats:events_file:2027 ok',
      'stats:plays_file:2027 ok',
      `${STATS_PLAYS_STEP} ok`
    ])
    expect(plays.buildPlays).toHaveBeenCalledTimes(1)
  })

  it('marks the tables out of date before anything can stop the build', async () => {
    await run([EVENTS])
    expect(plays.markPlaysStale).toHaveBeenCalledTimes(1)
  })

  it('does not run when no event or play file changed and its version stands', async () => {
    expect(await run([PUBLISHED])).toEqual(['stats:published_file:2027 ok'])
  })

  it('runs when a new version made it stale, with nothing downloaded', async () => {
    vi.mocked(plays.playsStale).mockResolvedValue(true)
    expect(await run([])).toEqual([`${STATS_PLAYS_STEP} ok`])
  })

  it('waits while the game tables it is keyed to are not built', async () => {
    vi.mocked(plays.canBuildPlays).mockResolvedValue(false)
    expect(await run([EVENTS])).toEqual(['stats:events_file:2027 ok'])
  })

  it('logs a failure as the step’s error', async () => {
    vi.mocked(plays.buildPlays).mockRejectedValueOnce(new Error('out of memory'))
    expect(await run([PLAYS])).toEqual(['stats:plays_file:2027 ok', `${STATS_PLAYS_STEP} error`])
  })
})
