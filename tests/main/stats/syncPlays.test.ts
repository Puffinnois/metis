import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as plays from '@main/stats/derived/playBuilders'
import * as published from '@main/stats/derived/published'
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
  publishedBootstrap: vi.fn(() => []),
  PUBLISHED_LATE_SOURCES: ['src_late_file']
}))

vi.mock('@main/stats/derived/playBuilders', () => ({
  canBuildPlays: vi.fn(async () => true),
  playsDue: vi.fn(async () => false),
  markPlaySeason: vi.fn(async () => undefined),
  buildPlays: vi.fn(async () => 17)
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
// An events file a published table reads, as the game matchups are.
const LATE = source('late_file', 'events')

beforeEach(() => {
  vi.mocked(plays.canBuildPlays).mockResolvedValue(true)
  vi.mocked(plays.playsDue).mockResolvedValue(false)
  vi.mocked(plays.markPlaySeason).mockClear()
  vi.mocked(plays.buildPlays).mockClear()
  // A season is due once any file of the events, plays or core tier wrote rows.
  vi.mocked(plays.markPlaySeason).mockImplementation(async () => {
    vi.mocked(plays.playsDue).mockResolvedValue(true)
  })
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

  it('runs after the published tables are built again for a late file', async () => {
    vi.mocked(published.canBuildPublished).mockReturnValue(true)
    expect(await run([LATE, PLAYS])).toEqual([
      'stats:late_file:2027 ok',
      'stats:plays_file:2027 ok',
      'stats:published ok',
      `${STATS_PLAYS_STEP} ok`
    ])
    vi.mocked(published.canBuildPublished).mockReturnValue(false)
  })

  it('records each season that wrote rows as it loads, before anything can stop the build', async () => {
    await run([PUBLISHED, EVENTS, PLAYS])
    expect(vi.mocked(plays.markPlaySeason).mock.calls.map(([, season]) => season)).toEqual([
      2027, 2027
    ])
  })

  it('does not run when no event, play or core file changed and its version stands', async () => {
    expect(await run([PUBLISHED])).toEqual(['stats:published_file:2027 ok'])
  })

  it('runs when a new version or an earlier refresh left it due, with nothing downloaded', async () => {
    vi.mocked(plays.playsDue).mockResolvedValue(true)
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
