import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as models from '@main/stats/models/build'
import * as plays from '@main/stats/derived/playBuilders'
import type { Downloads } from '@main/stats/download'
import type { SourceFile } from '@main/stats/sources'
import { refreshStats, STATS_MODELS_STEP, STATS_PLAYS_STEP } from '@main/stats/sync'
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
  PUBLISHED_LATE_SOURCES: []
}))

vi.mock('@main/stats/derived/playBuilders', () => ({
  canBuildPlays: vi.fn(async () => true),
  playsDue: vi.fn(async () => false),
  markPlaySeason: vi.fn(async () => undefined),
  buildPlays: vi.fn(async () => 17)
}))

vi.mock('@main/stats/models/build', () => ({
  canBuildModels: vi.fn(async () => true),
  modelsDue: vi.fn(async () => false),
  markModelSeason: vi.fn(async () => undefined),
  buildModels: vi.fn(async () => 19),
  modelsBootstrap: vi.fn(() => [])
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
const PLAYS = source('plays_file', 'plays')

beforeEach(() => {
  vi.mocked(models.canBuildModels).mockResolvedValue(true)
  vi.mocked(models.modelsDue).mockResolvedValue(false)
  vi.mocked(models.markModelSeason).mockClear()
  vi.mocked(models.buildModels).mockClear()
  vi.mocked(plays.playsDue).mockResolvedValue(false)
  // A season is due once any file wrote rows.
  vi.mocked(models.markModelSeason).mockImplementation(async () => {
    vi.mocked(models.modelsDue).mockResolvedValue(true)
  })
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

describe('the models step', () => {
  it('runs once, last, after the plays', async () => {
    expect(await run([CORE, PLAYS])).toEqual([
      'stats:core_file:2027 ok',
      'stats:identity ok',
      'stats:derived ok',
      'stats:plays_file:2027 ok',
      `${STATS_PLAYS_STEP} ok`,
      `${STATS_MODELS_STEP} ok`
    ])
    expect(models.buildModels).toHaveBeenCalledTimes(1)
    expect(vi.mocked(models.buildModels).mock.calls[0][1]).toBe(CURRENT)
  })

  it('records the season of every file that wrote rows, published ones included', async () => {
    await run([CORE, PUBLISHED, PLAYS])
    expect(vi.mocked(models.markModelSeason).mock.calls.map(([, season]) => season)).toEqual([
      2027, 2027, 2027
    ])
  })

  it('does not run when nothing changed and its versions stand', async () => {
    expect(await run([])).toEqual([])
  })

  it('runs when a version or an earlier failure left it due, with nothing downloaded', async () => {
    vi.mocked(models.modelsDue).mockResolvedValue(true)
    expect(await run([])).toEqual([`${STATS_MODELS_STEP} ok`])
  })

  it('waits while the game tables are not built', async () => {
    vi.mocked(models.canBuildModels).mockResolvedValue(false)
    expect(await run([PLAYS])).toEqual(['stats:plays_file:2027 ok', `${STATS_PLAYS_STEP} ok`])
  })

  it('logs a failure as the step’s error', async () => {
    vi.mocked(models.buildModels).mockRejectedValueOnce(new Error('singular system'))
    expect(await run([PLAYS])).toEqual([
      'stats:plays_file:2027 ok',
      `${STATS_PLAYS_STEP} ok`,
      `${STATS_MODELS_STEP} error`
    ])
  })
})
