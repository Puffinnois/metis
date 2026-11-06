import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openStatsService, type StatsService } from '@main/stats/service'
import { tempDir } from '../../fixtures/stats'

const BOS = 1610612738
const LAL = 1610612747

let service: StatsService | null = null

afterEach(async () => {
  await service?.close()
  service = null
})

async function open(): Promise<StatsService> {
  const dir = tempDir()
  mkdirSync(join(dir, 'tmp'))
  service = await openStatsService({ path: join(dir, 'stats.duckdb'), tempDir: join(dir, 'tmp') })
  return service
}

/** The tables a screen reads, as a build leaves them, on the worker's own connection. */
async function addTables(s: StatsService): Promise<void> {
  await s.read(`CREATE TABLE team_game (season INTEGER, game_type VARCHAR, game_date DATE,
    team_id BIGINT, box_games INTEGER, games INTEGER, wins INTEGER, losses INTEGER)`)
  await s.read(`INSERT INTO team_game VALUES
    (2026, 'regular', DATE '2025-10-21', ${BOS}, 1, 1, 1, 0),
    (2026, 'regular', DATE '2025-10-21', ${LAL}, 1, 1, 0, 1),
    (2026, 'regular', DATE '2026-04-12', ${BOS}, 1, 1, 0, 1),
    (2026, 'regular', DATE '2026-04-12', ${LAL}, 1, 1, 1, 0),
    (2026, 'playoffs', DATE '2026-04-20', ${BOS}, 1, 1, 1, 0),
    (2026, 'playoffs', DATE '2026-04-20', ${LAL}, 1, 1, 0, 1),
    (2026, 'preseason', DATE '2025-10-02', ${BOS}, 0, 1, 1, 0),
    (2025, 'regular', DATE '2025-01-10', ${BOS}, 1, 1, 1, 0),
    (2025, 'regular', DATE '2025-01-10', ${LAL}, 1, 1, 0, 1)`)
  await s.read(`CREATE TABLE team (season INTEGER, team_id BIGINT, code VARCHAR, name VARCHAR,
    conference VARCHAR, division VARCHAR)`)
  await s.read(`INSERT INTO team VALUES
    (2026, ${BOS}, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2025, ${BOS}, 'BOS', 'Boston Celtics', 'east', 'atlantic')`)
}

describe('reading through the service', () => {
  it('says plainly when the first load has not got as far as the tables', async () => {
    const s = await open()
    await expect(
      s.query({ entity: 'player', metrics: ['pts'], scope: { seasons: [2026] } })
    ).rejects.toThrow('No stats yet: the first load has not got that far.')
    await expect(s.seasons()).resolves.toEqual([])
  })

  it('serves the catalogue without its formulas', async () => {
    const s = await open()
    const catalogue = await s.catalogue()
    const pts = catalogue.find((m) => m.id === 'pts')!
    expect(pts).toMatchObject({
      label: 'Points',
      entity: 'player',
      grains: ['game', 'season'],
      sampleLabel: 'games'
    })
    expect(pts).not.toHaveProperty('value')
    expect(pts).not.toHaveProperty('sample')
  })

  it('lists each season newest first, with only the types that have box scores', async () => {
    const s = await open()
    await addTables(s)
    const seasons = await s.seasons()
    expect(seasons.map((x) => x.season)).toEqual([2026, 2025])
    expect(seasons[0]).toMatchObject({ firstDate: '2025-10-21', lastDate: '2026-04-20' })
    expect(Object.fromEntries(seasons[0].types.map((t) => [t.type, t.games]))).toEqual({
      regular: 2,
      playoffs: 1
    })
    expect(seasons[0].teams).toEqual([
      {
        id: String(BOS),
        code: 'BOS',
        name: 'Boston Celtics',
        conference: 'east',
        division: 'atlantic'
      },
      {
        id: String(LAL),
        code: 'LAL',
        name: 'Los Angeles Lakers',
        conference: 'west',
        division: 'pacific'
      }
    ])
  })

  it('reports when the tables were built', async () => {
    const s = await open()
    expect((await s.status()).builtAt).toBeNull()
    await s.read(`INSERT INTO sync_log (source, started_at, finished_at, status)
      VALUES ('stats:derived', 't0', '2026-11-06T12:00:00Z', 'ok'),
             ('stats:derived', 't1', '2026-11-06T13:00:00Z', 'error')`)
    expect((await s.status()).builtAt).toBe('2026-11-06T12:00:00Z')
  })

  it('checks the engine in the self-test', async () => {
    const s = await open()
    await expect(s.selfTest()).resolves.toMatchObject({ query: true })
    // The test's tables are gone, so the app's are not shadowed.
    await expect(s.read('SELECT current_schema() AS s')).resolves.toEqual([{ s: 'main' }])
  })
})
