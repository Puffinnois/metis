import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  fileName,
  fileUrl,
  LOAD_TIERS,
  seasonsOf,
  SOURCES,
  SOURCES_BY_LEAGUE,
  type SourceFile
} from '@main/stats/sources'
import { LEAGUES, type LeagueId } from '@shared/leagues'

/** The releases as listed by `scripts/inventory-sources.mjs --league=<id>`. */
const inventoryOf = (league: LeagueId): Set<string> =>
  new Set(
    readFileSync(join(__dirname, `../../fixtures/${league}-inventory.tsv`), 'utf8')
      // Git checks the file out with CRLF on Windows.
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.replace('\t', '/'))
  )

const pathOf = (source: SourceFile, season: number): string =>
  `${source.release}/${fileName(source, season)}`

interface Listing {
  league: LeagueId
  /** The last season the listing was taken in. */
  through: number
  /** Files the rule generates that are not published. */
  knownAbsent: (path: string) => boolean
  /** Published but not loaded: proven to repeat other files (D23). */
  skipped: (path: string) => boolean
  skippedCount: number
  listed: number
  tiers: Record<(typeof LOAD_TIERS)[number], number>
}

const LISTINGS: Listing[] = [
  {
    league: 'nba',
    through: 2027,
    // Playoffs have not been played in the current season, pair matchups are not out yet, and the
    // 2001-02 catch-and-shoot file does not exist.
    knownAbsent: (path) => {
      if (path === 'nba_stats_leaguedash/player_tracking_catchshoot_2002.parquet') return true
      if (!path.endsWith('_2027.parquet')) return false
      return path.includes('playoffs') || path.includes('leagueseasonmatchups')
    },
    skipped: (path) =>
      /^nba_stats_leaguedash\/(player|team|lineups)_master_\d{4}\.parquet$/.test(path),
    skippedCount: 82,
    listed: 3107,
    tiers: { core: 828, published: 1991, events: 149, plays: 57 }
  },
  {
    league: 'wnba',
    through: 2026,
    // The coaches release has no 2019 file.
    knownAbsent: (path) => path === 'wnba_stats_coaches/coaches_2019.parquet',
    // The dashboards' masters, the game logs filed as schedules, and the 2026 play by play that
    // repeats `wnba_play_by_play_2026` (wnba-data-sources.md, "Which files repeat others").
    skipped: (path) =>
      /^wnba_stats_leaguedash\/(player|team|lineups)_master_\d{4}\.parquet$/.test(path) ||
      /^wnba_stats_schedules\/wnba_stats_schedule_(\d{4}|master)\.parquet$/.test(path) ||
      path === 'wnba_stats_pbp/play_by_play_2026.parquet',
    skippedCount: 94,
    listed: 1586,
    tiers: { core: 571, published: 751, events: 115, plays: 55 }
  }
]

for (const listing of LISTINGS) {
  const inventory = inventoryOf(listing.league)
  const sources = SOURCES_BY_LEAGUE[listing.league]
  const generated = sources.flatMap((source) =>
    seasonsOf(source, listing.through).map((season) => ({
      source,
      season,
      path: pathOf(source, season)
    }))
  )
  const generatedPaths = new Set(generated.map((g) => g.path))
  const { knownAbsent, skipped } = listing

  describe(`the ${listing.league} source registry against the release listing`, () => {
    it('covers every published file, apart from those proven to repeat others', () => {
      expect([...inventory].filter((path) => !generatedPaths.has(path) && !skipped(path))).toEqual(
        []
      )
      expect([...inventory].filter(skipped)).toHaveLength(listing.skippedCount)
    })

    it('generates no file that is not published, apart from the known gaps', () => {
      expect([...generatedPaths].filter((p) => !inventory.has(p) && !knownAbsent(p))).toEqual([])
    })

    it('has as many files as the listing', () => {
      expect(inventory.size).toBe(listing.listed)
      expect(generatedPaths.size - [...generatedPaths].filter(knownAbsent).length).toBe(
        inventory.size - [...inventory].filter(skipped).length
      )
    })

    it('splits the files into the measured load tiers', () => {
      const published = generated.filter((g) => inventory.has(g.path))
      const counts = Object.fromEntries(
        LOAD_TIERS.map((tier) => [tier, published.filter((g) => g.source.tier === tier).length])
      )
      expect(counts).toEqual(listing.tiers)
    })

    it('names only its own league’s releases', () => {
      const prefixes = LEAGUES[listing.league].releases.prefixes
      const other = LEAGUES[listing.league === 'nba' ? 'wnba' : 'nba'].releases.prefixes
      for (const s of sources) {
        expect(prefixes.some((p) => s.release.startsWith(p))).toBe(true)
        expect(other.some((p) => s.release.startsWith(p))).toBe(false)
      }
    })

    it('has unique ids, generates each file once and gives a table one tier', () => {
      expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length)
      expect(generatedPaths.size).toBe(generated.length)
      const byTable = new Map<string, SourceFile[]>()
      for (const source of sources) {
        byTable.set(source.table, [...(byTable.get(source.table) ?? []), source])
      }
      for (const [table, files] of byTable) {
        expect(table).toMatch(/^src_[a-z0-9_]+$/)
        expect(new Set(files.map((s) => s.tier)).size).toBe(1)
        expect(files.every((s) => s.shared === files.length > 1)).toBe(true)
      }
    })
  })
}

describe('the WNBA sources', () => {
  const wnba = SOURCES_BY_LEAGUE.wnba
  it('measure 37 releases, 1,492 files loaded', () => {
    expect(new Set(wnba.map((s) => s.release)).size).toBe(37)
  })

  it('read the game logs as player and team rows, and 2026 player lines from the box scores', () => {
    const logs = wnba.find((s) => s.id === 'wnba_game_logs')!
    expect(fileUrl(logs, 2026)).toBe(
      'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/wnba_stats_player_game_logs/player_game_logs_2026.parquet'
    )
    expect(logs.grain).toBe('player-game and team-game')
    expect(seasonsOf(wnba.find((s) => s.id === 'wnba_player_box')!, 2026)).toEqual([2026])
  })

  it('mark the six releases the keys are built from', () => {
    expect([...new Set(wnba.filter((s) => s.keys).map((s) => s.release))].sort()).toEqual([
      'espn_wnba_player_boxscores',
      'espn_wnba_schedules',
      'wnba_crosswalk',
      'wnba_groups',
      'wnba_stats_player_game_logs',
      'wnba_stats_schedules'
    ])
  })
})

describe('the sources', () => {
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
    expect(LEAGUES.nba.currentSeason(new Date('2026-11-05T12:00:00Z'))).toBe(2027)
    expect(LEAGUES.nba.currentSeason(new Date('2027-06-13T12:00:00Z'))).toBe(2027)
    expect(LEAGUES.nba.currentSeason(new Date('2027-07-31T12:00:00Z'))).toBe(2027)
    expect(LEAGUES.nba.currentSeason(new Date('2027-08-01T12:00:00Z'))).toBe(2028)
  })
})
