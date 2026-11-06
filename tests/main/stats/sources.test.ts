import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  currentSeason,
  fileName,
  fileUrl,
  LOAD_TIERS,
  seasonsOf,
  SOURCES,
  type SourceFile
} from '@main/stats/sources'

/** The releases as listed by `scripts/inventory-sources.mjs`. */
const inventory = new Set(
  readFileSync(join(__dirname, '../../fixtures/nba-inventory.tsv'), 'utf8')
    // Git checks the file out with CRLF on Windows.
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.replace('\t', '/'))
)
const LISTED_THROUGH = 2027

const pathOf = (source: SourceFile, season: number): string =>
  `${source.release}/${fileName(source, season)}`

const generated = SOURCES.flatMap((source) =>
  seasonsOf(source, LISTED_THROUGH).map((season) => ({
    source,
    season,
    path: pathOf(source, season)
  }))
)
const generatedPaths = new Set(generated.map((g) => g.path))

/**
 * Files the rule generates that are not published. Playoffs have not been played in the current
 * season, pair matchups are not out yet, and the 2001-02 catch-and-shoot file does not exist.
 */
function knownAbsent(path: string): boolean {
  if (path === 'nba_stats_leaguedash/player_tracking_catchshoot_2002.parquet') return true
  if (!path.endsWith('_2027.parquet')) return false
  return path.includes('playoffs') || path.includes('leagueseasonmatchups')
}

/** Published but not loaded: proven to repeat other files (D23). */
const skipped = (path: string): boolean =>
  /^nba_stats_leaguedash\/(player|team|lineups)_master_\d{4}\.parquet$/.test(path)

describe('the source registry against the release listing', () => {
  it('covers every published file, apart from those proven to repeat others', () => {
    expect([...inventory].filter((path) => !generatedPaths.has(path) && !skipped(path))).toEqual([])
    expect([...inventory].filter(skipped)).toHaveLength(82)
  })

  it('generates no file that is not published, apart from the known gaps', () => {
    expect([...generatedPaths].filter((p) => !inventory.has(p) && !knownAbsent(p))).toEqual([])
  })

  it('has as many files as the listing', () => {
    expect(inventory.size).toBe(3107)
    expect(generatedPaths.size - [...generatedPaths].filter(knownAbsent).length).toBe(
      inventory.size - [...inventory].filter(skipped).length
    )
  })

  it('splits the files into the measured load tiers', () => {
    const published = generated.filter((g) => inventory.has(g.path))
    const counts = Object.fromEntries(
      LOAD_TIERS.map((tier) => [tier, published.filter((g) => g.source.tier === tier).length])
    )
    expect(counts).toEqual({ core: 828, published: 1991, events: 149, plays: 57 })
  })
})

describe('the sources', () => {
  it('have unique ids and generate each file once', () => {
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length)
    expect(generatedPaths.size).toBe(generated.length)
  })

  it('share a table only when marked, and give a table one tier', () => {
    const byTable = new Map<string, SourceFile[]>()
    for (const source of SOURCES) {
      byTable.set(source.table, [...(byTable.get(source.table) ?? []), source])
    }
    for (const [table, sources] of byTable) {
      expect(table).toMatch(/^src_[a-z0-9_]+$/)
      expect(new Set(sources.map((s) => s.tier)).size).toBe(1)
      expect(sources.every((s) => s.shared === sources.length > 1)).toBe(true)
    }
  })

  it('name a file by its season, or by nothing when it holds every season', () => {
    const season = SOURCES.find((s) => s.id === 'nba_pbp')!
    expect(fileUrl(season, 2026)).toBe(
      'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/nba_stats_pbp/nba_play_by_play_2026.parquet'
    )
    const all = SOURCES.find((s) => s.id === 'team_aliases')!
    expect(fileName(all, 0)).toBe('nba_team_aliases.parquet')
    expect(seasonsOf(all, 2027)).toEqual([0])
  })

  it('offer each season from the first to the current', () => {
    const rosters = SOURCES.find((s) => s.id === 'espn_rosters')!
    expect(seasonsOf(rosters, 2027)).toEqual([2025, 2026, 2027])
  })
})

describe('currentSeason', () => {
  it('labels a season by its final year, turning in August', () => {
    expect(currentSeason(new Date('2026-11-05T12:00:00Z'))).toBe(2027)
    expect(currentSeason(new Date('2027-06-13T12:00:00Z'))).toBe(2027)
    expect(currentSeason(new Date('2027-07-31T12:00:00Z'))).toBe(2027)
    expect(currentSeason(new Date('2027-08-01T12:00:00Z'))).toBe(2028)
  })
})
