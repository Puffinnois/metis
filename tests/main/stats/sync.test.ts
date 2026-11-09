import { copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import type { Downloads, FetchedFile } from '@main/stats/download'
import { INTERRUPTED_MESSAGE } from '@main/stats/schema'
import { fileUrl, RELEASES_URL, SOURCES, type SourceFile } from '@main/stats/sources'
import {
  ATTEMPT_INTERVAL_MS,
  ERROR_RETRY_MS,
  isDue,
  PARALLEL_DOWNLOADS,
  planSteps,
  PRIOR_SEASON_FRESHNESS_MS,
  refreshStats,
  stepLogName,
  type DueInput,
  type SourceState
} from '@main/stats/sync'
import { openTestDb, tempDir, writeFixture } from '../../fixtures/stats'

// These tests follow the file steps alone; the published tables' own step is tested in
// `syncIdentity.test.ts`, and would otherwise follow every run here.
vi.mock('@main/stats/derived/publishedTables', async (actual) => ({
  ...(await actual<typeof import('@main/stats/derived/publishedTables')>()),
  PUBLISHED_TABLES: []
}))

const NOW = new Date('2026-11-05T12:00:00Z')
const CURRENT = 2027
const HOUR = 60 * 60 * 1000

const state = (fetchedAt: string, sealed = false, version = 1): SourceState => ({
  version,
  fetchedAt,
  sealed,
  rows: 1,
  etag: null,
  bytes: null
})
const due = (over: Partial<DueInput>): boolean =>
  isDue({
    season: CURRENT,
    current: CURRENT,
    force: false,
    now: NOW.getTime(),
    attempt: null,
    version: 1,
    state: null,
    ...over
  })
const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString()

describe('isDue', () => {
  it('runs what was never fetched and what a new version changed', () => {
    expect(due({ season: 2019 })).toBe(true)
    expect(due({ season: 2019, state: state(ago(HOUR), true), version: 2 })).toBe(true)
  })

  it('does not try again within a day unless forced, and forcing reaches only recent seasons', () => {
    const attempt = { startedAt: ago(2 * HOUR), status: 'ok' as const }
    expect(due({ attempt })).toBe(false)
    expect(due({ attempt, force: true })).toBe(true)
    expect(due({ season: 0, attempt, force: true })).toBe(true)
    expect(due({ season: 2020, attempt, force: true })).toBe(false)
    expect(due({ attempt: { ...attempt, startedAt: ago(ATTEMPT_INTERVAL_MS) } })).toBe(true)
  })

  it('tries a failed step again after an hour, not a day', () => {
    const failed = (ms: number): DueInput['attempt'] => ({ startedAt: ago(ms), status: 'error' })
    expect(due({ season: 2019, attempt: failed(ERROR_RETRY_MS - 1) })).toBe(false)
    expect(due({ season: 2019, attempt: failed(ERROR_RETRY_MS) })).toBe(true)
  })

  it('checks the current season daily, the prior weekly, and older ones until sealed', () => {
    const recent = ago(3 * 24 * HOUR)
    expect(due({ state: state(recent) })).toBe(true)
    expect(due({ season: 0, state: state(recent) })).toBe(true)
    expect(due({ season: 2026, state: state(recent) })).toBe(false)
    expect(due({ season: 2026, state: state(ago(PRIOR_SEASON_FRESHNESS_MS)) })).toBe(true)
    expect(due({ season: 2024, state: state(recent, true) })).toBe(false)
    expect(due({ season: 2024, state: state(recent, false) })).toBe(true)
  })
})

describe('planSteps', () => {
  const plan = planSteps(CURRENT)

  it('runs tier by tier, so play by play comes last', () => {
    const tiers = plan.map((step) => step.source.tier)
    const order = tiers.filter((tier, i) => tier !== tiers[i - 1])
    expect(order).toEqual(['core', 'published', 'events', 'plays'])
  })

  it('takes files of all seasons first in a tier, then the newest season back', () => {
    const core = plan.filter((step) => step.source.tier === 'core').map((step) => step.season)
    const firstSeason = core.findIndex((season) => season !== 0)
    expect(core.slice(0, firstSeason).every((season) => season === 0)).toBe(true)
    expect(core[firstSeason]).toBe(CURRENT)
    const seasons = core.slice(firstSeason)
    expect(seasons).toEqual([...seasons].sort((a, b) => b - a))
  })

  it('names each step in the log by source and season', () => {
    const pbp = SOURCES.find((s) => s.id === 'nba_pbp')!
    const aliases = SOURCES.find((s) => s.id === 'team_aliases')!
    expect(stepLogName({ source: pbp, season: 2026 })).toBe('stats:nba_pbp:2026')
    expect(stepLogName({ source: aliases, season: 0 })).toBe('stats:team_aliases')
  })
})

const source = (id: string, over: Partial<SourceFile> = {}): SourceFile => ({
  id,
  table: `src_${id}`,
  release: 'release',
  stem: id,
  tier: 'core',
  grain: 'row',
  version: 1,
  firstSeason: 2026,
  allSeasons: false,
  shared: false,
  ...over
})

interface Served {
  [url: string]: { file: string; etag?: string } | undefined
}

/** A release served from local files; records what was asked. */
function fakeDownloads(served: Served): Downloads & { asked: [string, string | null][] } {
  const dir = tempDir()
  let n = 0
  const asked: [string, string | null][] = []
  return {
    asked,
    async fetchFile(url, etag = null): Promise<FetchedFile> {
      asked.push([url, etag])
      const hit = served[url]
      if (!hit) return { kind: 'missing' }
      if (etag && hit.etag === etag) return { kind: 'unchanged' }
      const path = join(dir, `${n++}.parquet`)
      copyFileSync(hit.file, path)
      return { kind: 'file', path, etag: hit.etag ?? null, bytes: 1 }
    },
    removeFile: async () => undefined
  }
}

const sync = (
  db: StatsDb,
  downloads: Downloads,
  sources: SourceFile[],
  over: { now?: Date; force?: boolean; cancelled?: () => boolean } = {}
): ReturnType<typeof refreshStats> =>
  refreshStats(
    { db, downloads, now: () => over.now ?? NOW, cancelled: over.cancelled },
    { force: over.force },
    sources
  )

describe('refreshStats', () => {
  it('logs every due step, skips unpublished files, and records state with sealing', async () => {
    const db = await openTestDb()
    const dir = tempDir()
    const old = source('t', { firstSeason: 2025 })
    const file = await writeFixture(db, dir, 'a.parquet', 'SELECT 1 AS x')
    const downloads = fakeDownloads({
      [fileUrl(old, 2027)]: { file, etag: '"a"' },
      [fileUrl(old, 2025)]: { file }
    })
    const { steps } = await sync(db, downloads, [old])
    expect(steps.map((s) => [s.source, s.status, s.message])).toEqual([
      ['stats:t:2027', 'ok', null],
      ['stats:t:2026', 'skipped', 'not published yet'],
      ['stats:t:2025', 'ok', null]
    ])
    expect(
      await db.all('SELECT season, rows_written, sealed, etag FROM source_state ORDER BY season')
    ).toEqual([
      { season: 2025, rows_written: 1, sealed: true, etag: null },
      { season: 2027, rows_written: 1, sealed: false, etag: '"a"' }
    ])
    expect(await db.all('SELECT season, x FROM src_t ORDER BY season')).toEqual([
      { season: 2025, x: 1 },
      { season: 2027, x: 1 }
    ])
  })

  it('does not run a step again within the day', async () => {
    const db = await openTestDb()
    const t = source('t')
    const file = await writeFixture(db, tempDir(), 'a.parquet', 'SELECT 1 AS x')
    const downloads = fakeDownloads({
      [fileUrl(t, 2026)]: { file },
      [fileUrl(t, 2027)]: { file }
    })
    await sync(db, downloads, [t])
    expect((await sync(db, downloads, [t])).steps).toEqual([])
  })

  it('downloads nothing the next day when the file has not changed', async () => {
    const db = await openTestDb()
    const t = source('t', { firstSeason: CURRENT })
    const file = await writeFixture(db, tempDir(), 'a.parquet', 'SELECT 1 AS x')
    const downloads = fakeDownloads({ [fileUrl(t, CURRENT)]: { file, etag: '"a"' } })
    await sync(db, downloads, [t])
    const tomorrow = new Date(NOW.getTime() + ATTEMPT_INTERVAL_MS)
    const { steps } = await sync(db, downloads, [t], { now: tomorrow })
    expect(steps.map((s) => [s.status, s.message, s.rowsWritten])).toEqual([['ok', 'unchanged', 0]])
    expect(downloads.asked.at(-1)).toEqual([fileUrl(t, CURRENT), '"a"'])
    expect(await db.get('SELECT rows_written, etag, fetched_at FROM source_state')).toEqual({
      rows_written: 1,
      etag: '"a"',
      fetched_at: tomorrow.toISOString()
    })
  })

  it('loads a new version again even if the file has not changed', async () => {
    const db = await openTestDb()
    const t = source('t', { firstSeason: CURRENT })
    const file = await writeFixture(db, tempDir(), 'a.parquet', 'SELECT 1 AS x')
    const downloads = fakeDownloads({ [fileUrl(t, CURRENT)]: { file, etag: '"a"' } })
    await sync(db, downloads, [t])
    const tomorrow = new Date(NOW.getTime() + ATTEMPT_INTERVAL_MS)
    const { steps } = await sync(db, downloads, [{ ...t, version: 2 }], { now: tomorrow })
    expect(downloads.asked.at(-1)).toEqual([fileUrl(t, CURRENT), null])
    expect(steps[0].rowsWritten).toBe(1)
  })

  it('logs a failed step as an error and carries on', async () => {
    const db = await openTestDb()
    const dir = tempDir()
    const bad = join(dir, 'bad.parquet')
    writeFileSync(bad, 'not parquet')
    const good = await writeFixture(db, dir, 'good.parquet', 'SELECT 1 AS x')
    const a = source('a', { firstSeason: CURRENT })
    const b = source('b', { firstSeason: CURRENT })
    const downloads = fakeDownloads({
      [fileUrl(a, CURRENT)]: { file: bad },
      [fileUrl(b, CURRENT)]: { file: good }
    })
    const { steps } = await sync(db, downloads, [a, b])
    expect(steps.map((s) => [s.source, s.status])).toEqual([
      ['stats:a:2027', 'error'],
      ['stats:b:2027', 'ok']
    ])
  })

  it('logs a download that failed and carries on', async () => {
    const db = await openTestDb()
    const a = source('a', { firstSeason: CURRENT })
    const downloads: Downloads = {
      fetchFile: () => Promise.reject(new Error('connection lost')),
      removeFile: async () => {}
    }
    const { steps } = await sync(db, downloads, [a])
    expect(steps.map((s) => [s.status, s.message])).toEqual([['error', 'connection lost']])
  })

  it('stops between steps once cancelled and logs the step it was in as interrupted', async () => {
    const db = await openTestDb()
    const a = source('a', { firstSeason: CURRENT })
    const b = source('b', { firstSeason: CURRENT })
    let cancelled = false
    const downloads: Downloads = {
      fetchFile: async () => {
        cancelled = true
        throw new Error('aborted')
      },
      removeFile: async () => {}
    }
    const { steps } = await sync(db, downloads, [a, b], { cancelled: () => cancelled })
    expect(steps.map((s) => [s.source, s.status, s.message])).toEqual([
      ['stats:a:2027', 'interrupted', INTERRUPTED_MESSAGE]
    ])
  })

  it('stops at once when the database itself has failed, and says why', async () => {
    const db = await openTestDb()
    const sources = ['a', 'b', 'c'].map((id) => source(id, { firstSeason: CURRENT }))
    const failing = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'get') return () => Promise.reject(new Error('FATAL Error: invalidated'))
        const value = Reflect.get(target, prop, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })
    const result = await sync(failing, fakeDownloads({}), sources)
    expect(result).toEqual({ steps: [], fatal: 'FATAL Error: invalidated' })
  })

  it('tries an interrupted step again on the next run', async () => {
    const db = await openTestDb()
    const a = source('a', { firstSeason: CURRENT })
    let cancelled = false
    const failing: Downloads = {
      fetchFile: async () => {
        cancelled = true
        throw new Error('aborted')
      },
      removeFile: async () => {}
    }
    await sync(db, failing, [a], { cancelled: () => cancelled })
    const file = await writeFixture(db, tempDir(), 'a.parquet', 'SELECT 1 AS x')
    const { steps } = await sync(db, fakeDownloads({ [fileUrl(a, CURRENT)]: { file } }), [a])
    expect(steps.map((s) => s.status)).toEqual(['ok'])
  })

  it('removes each file once loaded, whether or not the load worked', async () => {
    const db = await openTestDb()
    const dir = tempDir()
    const bad = join(dir, 'bad.parquet')
    writeFileSync(bad, 'not parquet')
    const a = source('a', { firstSeason: CURRENT })
    const inner = fakeDownloads({ [fileUrl(a, CURRENT)]: { file: bad } })
    const removed: string[] = []
    const downloads: Downloads = {
      fetchFile: inner.fetchFile,
      removeFile: async (path) => {
        removed.push(path)
      }
    }
    await sync(db, downloads, [a])
    expect(removed).toHaveLength(1)
  })

  it('downloads a few files ahead of the one loading, and never more', async () => {
    const db = await openTestDb()
    const file = await writeFixture(db, tempDir(), 'a.parquet', 'SELECT 1 AS x')
    const sources = Array.from({ length: PARALLEL_DOWNLOADS * 3 }, (_, i) =>
      source(`s${i}`, { firstSeason: CURRENT })
    )
    const served = Object.fromEntries(sources.map((s) => [fileUrl(s, CURRENT), { file }]))
    const inner = fakeDownloads(served)
    let running = 0
    let peak = 0
    const downloads: Downloads = {
      fetchFile: async (url, etag) => {
        running++
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, 2))
        running--
        return inner.fetchFile(url, etag)
      },
      removeFile: async () => {}
    }
    const { steps } = await sync(db, downloads, sources)
    expect(steps.every((s) => s.status === 'ok')).toBe(true)
    expect(steps.map((s) => s.source)).toEqual(sources.map((s) => `stats:${s.id}:2027`))
    expect(peak).toBeLessThanOrEqual(PARALLEL_DOWNLOADS)
    expect(peak).toBeGreaterThan(1)
  })

  it('reports progress in files, and clears it at the end', async () => {
    const db = await openTestDb()
    const a = source('a', { firstSeason: 2026 })
    const seen: unknown[] = []
    await refreshStats(
      {
        db,
        downloads: fakeDownloads({}),
        now: () => NOW,
        onProgress: (p) => seen.push(p)
      },
      {},
      [a]
    )
    expect(seen).toEqual([
      { done: 0, total: 2 },
      { done: 1, total: 2 },
      { done: 2, total: 2 },
      null
    ])
  })

  it('fetches from the release the source names', async () => {
    const db = await openTestDb()
    const downloads = fakeDownloads({})
    await sync(db, downloads, [source('a', { firstSeason: CURRENT })])
    expect(downloads.asked[0][0]).toBe(`${RELEASES_URL}/release/a_2027.parquet`)
  })
})
