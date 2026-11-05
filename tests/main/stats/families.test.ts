import { describe, expect, it } from 'vitest'
import { FIRST_LOAD_BYTES, LOADED_BYTES, roomNeeded } from '@main/stats/disk'
import { summariseFamilies, type FileAttempt, type HeldFile } from '@main/stats/families'
import { RELEASE_LABELS, SOURCES, type SourceFile } from '@main/stats/sources'

const source = (id: string, over: Partial<SourceFile> = {}): SourceFile => ({
  id,
  table: `src_${id}`,
  release: 'release_a',
  stem: id,
  tier: 'core',
  grain: 'row',
  version: 1,
  firstSeason: 2025,
  allSeasons: false,
  shared: false,
  ...over
})

const file = (over: Partial<HeldFile> = {}): HeldFile => ({
  rows: 10,
  bytes: 100,
  fetchedAt: '2026-11-05T10:00:00.000Z',
  ...over
})

const CURRENT = 2027

function summary(
  sources: SourceFile[],
  held: Record<string, HeldFile> = {},
  attempts: Record<string, FileAttempt> = {}
): ReturnType<typeof summariseFamilies> {
  return summariseFamilies(
    sources,
    CURRENT,
    new Map(Object.entries(held)),
    new Map(Object.entries(attempts))
  )
}

describe('summariseFamilies', () => {
  it('waits while nothing is loaded', () => {
    expect(summary([source('a')])[0]).toMatchObject({
      state: 'waiting',
      filesLoaded: 0,
      filesExpected: 3,
      firstSeason: null,
      bytes: 0
    })
  })

  it('adds up what a family holds, across seasons and sources', () => {
    const [family] = summary([source('a'), source('b', { firstSeason: CURRENT })], {
      'a:2025': file(),
      'a:2026': file({ fetchedAt: '2026-11-05T12:00:00.000Z' }),
      'b:2027': file({ rows: 5, bytes: 50 })
    })
    expect(family).toMatchObject({
      state: 'partial',
      filesLoaded: 3,
      filesExpected: 4,
      firstSeason: 2025,
      lastSeason: 2027,
      bytes: 250,
      rows: 25,
      fetchedAt: '2026-11-05T12:00:00.000Z'
    })
  })

  it('counts a family as loaded when every published file is in', () => {
    const [family] = summary(
      [source('a')],
      { 'a:2025': file(), 'a:2026': file() },
      { 'stats:a:2027': { status: 'skipped', message: 'not published yet' } }
    )
    expect(family).toMatchObject({ state: 'loaded', filesLoaded: 2, filesExpected: 2 })
  })

  it('shows the latest error, until the file loads again', () => {
    const failed = summary(
      [source('a')],
      { 'a:2025': file() },
      { 'stats:a:2026': { status: 'error', message: 'HTTP 500' } }
    )[0]
    expect(failed).toMatchObject({ state: 'failed', lastError: 'HTTP 500' })
    const recovered = summary(
      [source('a')],
      { 'a:2025': file(), 'a:2026': file() },
      { 'stats:a:2026': { status: 'ok', message: null } }
    )[0]
    expect(recovered).toMatchObject({ state: 'partial', lastError: null })
  })

  it('gives a family of files holding all seasons no season range', () => {
    const [family] = summary([source('a', { allSeasons: true })], { 'a:0': file() })
    expect(family).toMatchObject({ state: 'loaded', firstSeason: null, lastSeason: null })
  })

  it('groups by release and lists families in load order', () => {
    const families = summary([
      source('p', { release: 'release_p', tier: 'plays' }),
      source('c', { release: 'release_c', tier: 'core' }),
      source('e', { release: 'release_e', tier: 'events' })
    ])
    expect(families.map((f) => f.tier)).toEqual(['core', 'events', 'plays'])
  })

  it('has a label for every release in the registry', () => {
    const missing = [...new Set(SOURCES.map((s) => s.release))].filter((r) => !RELEASE_LABELS[r])
    expect(missing).toEqual([])
  })
})

describe('roomNeeded', () => {
  it('asks for the whole load at the start, and less as it goes', () => {
    expect(roomNeeded(0)).toBe(FIRST_LOAD_BYTES)
    expect(roomNeeded(1024 ** 3)).toBe(FIRST_LOAD_BYTES - 1024 ** 3)
  })

  it('asks for nothing once the first load is done', () => {
    expect(roomNeeded(LOADED_BYTES)).toBe(0)
  })
})
