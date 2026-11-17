import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import type { Downloads, FetchedFile } from '@main/stats/download'
import { fileUrl, type SourceFile } from '@main/stats/sources'
import { dropLeftOut, refreshStats, STATS_LEFT_OUT_STEP } from '@main/stats/sync'
import { openTestDb, tempDir, writeFixture } from '../../fixtures/stats'
import { LEAGUES } from '@shared/leagues'

// The file steps alone, as in `sync.test.ts`: the published tables' step is tested elsewhere.
vi.mock('@main/stats/derived/publishedTables', async (actual) => ({
  ...(await actual<typeof import('@main/stats/derived/publishedTables')>()),
  PUBLISHED_TABLES: []
}))

const NOW = new Date('2026-11-05T12:00:00Z')

const source = (id: string, release: string): SourceFile => ({
  id,
  table: `src_${id}`,
  release,
  stem: id,
  tier: 'core',
  grain: 'row',
  version: 1,
  firstSeason: 2027,
  allSeasons: false,
  shared: false
})

const KEEP = source('keep', 'kept_release')
const GONE = source('gone', 'gone_release')

/** Both files served; records what was asked. */
async function served(db: StatsDb): Promise<Downloads & { asked: string[] }> {
  const dir = tempDir()
  const file = await writeFixture(db, dir, 'a.parquet', 'SELECT 1 AS x')
  const urls = new Set([fileUrl(KEEP, 2027), fileUrl(GONE, 2027)])
  let n = 0
  const asked: string[] = []
  return {
    asked,
    async fetchFile(url): Promise<FetchedFile> {
      asked.push(url)
      if (!urls.has(url)) return { kind: 'missing' }
      const path = join(dir, `${n++}.parquet`)
      copyFileSync(file, path)
      return { kind: 'file', path, etag: null, bytes: 1 }
    },
    removeFile: async () => undefined
  }
}

const tables = async (db: StatsDb): Promise<string[]> =>
  (
    await db.all<{ t: string }>(
      "SELECT table_name AS t FROM duckdb_tables() WHERE table_name LIKE 'src_%' ORDER BY 1"
    )
  ).map((r) => r.t)

const refresh = (
  db: StatsDb,
  downloads: Downloads,
  leftOut: readonly string[]
): ReturnType<typeof refreshStats> =>
  refreshStats(
    { db, league: LEAGUES.nba, downloads, now: () => NOW },
    { force: true },
    [KEEP, GONE],
    leftOut
  )

describe('a release left out of the build', () => {
  it('is not downloaded on a fresh install', async () => {
    const db = await openTestDb()
    const downloads = await served(db)
    const { steps } = await refresh(db, downloads, ['gone_release'])
    expect(downloads.asked).toEqual([fileUrl(KEEP, 2027)])
    expect(steps.map((s) => s.source)).toEqual(['stats:keep:2027'])
    expect(await tables(db)).toEqual(['src_keep'])
  })

  it('is dropped from an install that had loaded it, which then matches a fresh one', async () => {
    const db = await openTestDb()
    await refresh(db, await served(db), [])
    expect(await tables(db)).toEqual(['src_gone', 'src_keep'])

    const downloads = await served(db)
    const { steps } = await refresh(db, downloads, ['gone_release'])
    expect(steps[0]).toMatchObject({
      source: STATS_LEFT_OUT_STEP,
      status: 'ok',
      message: '2 left out'
    })
    expect(downloads.asked).not.toContain(fileUrl(GONE, 2027))
    expect(await tables(db)).toEqual(['src_keep'])
    expect(await db.all('SELECT source FROM source_state ORDER BY 1')).toEqual([{ source: 'keep' }])
    // Every built table is marked out of date, so the steps rebuild from what is left.
    expect(
      await db.all(
        "SELECT name, version FROM derived_state WHERE name IN ('identity', 'derived', 'plays:0', 'models:0') ORDER BY 1"
      )
    ).toEqual([
      { name: 'derived', version: 0 },
      { name: 'identity', version: 0 },
      { name: 'models:0', version: 0 },
      { name: 'plays:0', version: 0 }
    ])

    // Once gone, nothing is left to drop.
    expect(await dropLeftOut(db, ['gone_release'], [KEEP, GONE])).toBe(0)
  })

  it('refuses a list naming a release Metis does not load, and loads nothing', async () => {
    const db = await openTestDb()
    const downloads = await served(db)
    const { steps, fatal } = await refresh(db, downloads, ['no_such_release'])
    expect(fatal).toBeUndefined()
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({ source: STATS_LEFT_OUT_STEP, status: 'error' })
    expect(steps[0].message).toContain('no_such_release')
    expect(downloads.asked).toEqual([])
  })
})
