import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  buildPublished,
  canBuildPublished,
  markPublishedStale,
  PUBLISHED_VERSION,
  publishedStale
} from '@main/stats/derived/published'
import { bootstrapStatsDb } from '@main/stats/schema'
import { openTestDb } from '../../../fixtures/stats'

vi.mock('@main/stats/derived/publishedTables', async (actual) => ({
  ...(await actual<typeof import('@main/stats/derived/publishedTables')>()),
  PUBLISHED_TABLES: [
    {
      table: 'published_test_widgets',
      entity: 'player',
      source: 'src_test_widgets',
      firstSeason: 2014,
      games: 'gp',
      minutes: 'min',
      columns: ['widgets', 'gone']
    },
    {
      table: 'published_test_teams',
      entity: 'team',
      source: 'src_test_teams',
      games: null,
      minutes: 'min',
      possessions: 'poss',
      columns: ['widgets', { name: 'rated', sql: '{rating} * {poss}' }]
    }
  ]
}))

let db: StatsDb

interface WidgetRow {
  player_id: number
  season: number
  game_type: string
  games: number | null
  minutes: number | null
  possessions: number | null
  widgets: number | null
  gone: number | null
}

const widgets = (): Promise<WidgetRow[]> =>
  db.all<WidgetRow>('SELECT * FROM published_test_widgets ORDER BY season, game_type')

beforeEach(async () => {
  db = await openTestDb()
})

describe('the published tables', () => {
  it('exist empty from the first open, with every column', async () => {
    expect(await widgets()).toEqual([])
    const cols = await db.all<{ column_name: string }>(
      "SELECT column_name FROM duckdb_columns() WHERE table_name = 'published_test_teams'"
    )
    expect(cols.map((c) => c.column_name)).toEqual([
      'team_id',
      'season',
      'game_type',
      'games',
      'minutes',
      'possessions',
      'widgets',
      'rated'
    ])
  })

  it('gain a column a new version adds on the next open, keeping their rows', async () => {
    await db.exec('DROP TABLE published_test_widgets')
    await db.exec(
      `CREATE TABLE published_test_widgets (player_id BIGINT, season INTEGER, game_type VARCHAR)`
    )
    await db.exec(`INSERT INTO published_test_widgets VALUES (1, 2026, 'regular')`)
    await bootstrapStatsDb(db, new Date())
    expect(await widgets()).toMatchObject([{ player_id: 1, widgets: null }])
  })

  it('read totals only, and map both spellings of a season type', async () => {
    await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER,
      season_type VARCHAR, per_mode VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
    await db.exec(`INSERT INTO src_test_widgets VALUES
      (1, 2026, 'Regular Season', 'Totals', 70, 2000, 500),
      (1, 2026, 'Regular Season', 'PerGame', 70, 28.6, 7.1),
      (1, 2025, 'regular-season', 'totals', 60, 1800, 400),
      (1, 2026, 'Playoffs', 'Totals', 5, 150, 30),
      (1, 2026, 'PlayIn', 'Totals', 1, 30, 5)`)
    await buildPublished(db)
    expect(await widgets()).toMatchObject([
      { season: 2025, game_type: 'regular', games: 60, minutes: 1800, widgets: 400 },
      { season: 2026, game_type: 'playoffs', games: 5, minutes: 150, widgets: 30 },
      { season: 2026, game_type: 'regular', games: 70, minutes: 2000, widgets: 500 }
    ])
  })

  it('keep zeros, and read a column the source does not have as NULL', async () => {
    await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER,
      season_type VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
    await db.exec(`INSERT INTO src_test_widgets VALUES (1, 2026, 'Regular Season', 0, 0, 0)`)
    await buildPublished(db)
    expect(await widgets()).toMatchObject([
      { games: 0, minutes: 0, possessions: null, widgets: 0, gone: null }
    ])
  })

  it('leave out seasons before the first with real values', async () => {
    await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER,
      season_type VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
    await db.exec(`INSERT INTO src_test_widgets VALUES
      (1, 2013, 'Regular Season', 80, 2400, 0), (1, 2014, 'Regular Season', 80, 2400, 90)`)
    await buildPublished(db)
    expect((await widgets()).map((r) => r.season)).toEqual([2014])
  })

  it('read a team by its id, with what it publishes', async () => {
    await db.exec(`CREATE TABLE src_test_teams (team_id BIGINT, season INTEGER,
      season_type VARCHAR, min DOUBLE, poss DOUBLE, widgets BIGINT, rating DOUBLE)`)
    await db.exec(
      `INSERT INTO src_test_teams VALUES (7, 2026, 'Regular Season', 3950, 8100, 12, 110.5)`
    )
    await buildPublished(db)
    const rows = await db.all('SELECT * FROM published_test_teams')
    expect(rows).toMatchObject([
      {
        team_id: 7,
        games: null,
        minutes: 3950,
        possessions: 8100,
        widgets: 12,
        rated: 110.5 * 8100
      }
    ])
  })

  it('work a column out of the source columns, NULL when one is missing', async () => {
    await db.exec(`CREATE TABLE src_test_teams (team_id BIGINT, season INTEGER,
      season_type VARCHAR, min DOUBLE, poss DOUBLE)`)
    await db.exec(`INSERT INTO src_test_teams VALUES (7, 2026, 'Regular Season', 3950, 8100)`)
    await buildPublished(db)
    expect(await db.all('SELECT rated FROM published_test_teams')).toEqual([{ rated: null }])
  })

  it('build empty, without failing, while a source is not loaded', async () => {
    expect(await buildPublished(db)).toBe(0)
    expect(await widgets()).toEqual([])
  })

  it('return the rows they wrote, and replace them on a rebuild', async () => {
    await db.exec(`CREATE TABLE src_test_widgets (player_id BIGINT, season INTEGER,
      season_type VARCHAR, gp BIGINT, min DOUBLE, widgets BIGINT)`)
    await db.exec(`INSERT INTO src_test_widgets VALUES (1, 2026, 'Regular Season', 1, 1, 1)`)
    expect(await buildPublished(db)).toBe(1)
    await db.exec('DELETE FROM src_test_widgets')
    expect(await buildPublished(db)).toBe(0)
    expect(await widgets()).toEqual([])
  })

  it('say when they are out of date', async () => {
    expect(canBuildPublished()).toBe(true)
    expect(await publishedStale(db)).toBe(true)
    await buildPublished(db)
    expect(await publishedStale(db)).toBe(false)
    const state = await db.get<{ version: number }>(
      "SELECT version FROM derived_state WHERE name = 'published'"
    )
    expect(state?.version).toBe(PUBLISHED_VERSION)
    await markPublishedStale(db)
    expect(await publishedStale(db)).toBe(true)
  })
})
