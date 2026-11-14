import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { grainsOf } from '@main/stats/engine/registry'
import { runQuery } from '@main/stats/engine/run'
import { buildModels, type ModelTable } from '@main/stats/models/build'
import { METRICS } from '@shared/stats/catalogue'
import type { MetricDef, StatsQuery, StatsResult } from '@shared/stats/types'
import { addNbaLine, BOS, emptySources, LAL, MIA } from '../../../fixtures/boxScores'
import { addLeague } from '../../../fixtures/models'
import { openTestDb } from '../../../fixtures/stats'

// Two sum tables beside the real SRS table: one per player, team and season (Win Shares will be one),
// one per team and game.
vi.mock('@main/stats/models/build', async (actual) => {
  const real = await actual<typeof import('@main/stats/models/build')>()
  const extra: ModelTable[] = [
    {
      table: 'test_player_shares',
      entity: 'player',
      kind: 'sum',
      grain: 'season',
      columns: [
        ['season', 'INTEGER'],
        ['game_type', 'VARCHAR'],
        ['team_id', 'BIGINT'],
        ['player_id', 'BIGINT'],
        ['shares', 'DOUBLE']
      ],
      components: ['shares']
    },
    {
      table: 'test_team_points',
      entity: 'team',
      kind: 'sum',
      grain: 'game',
      columns: [
        ['season', 'INTEGER'],
        ['game_type', 'VARCHAR'],
        ['team_id', 'BIGINT'],
        ['game_id', 'VARCHAR'],
        ['game_date', 'DATE'],
        ['model_points', 'DOUBLE']
      ],
      components: ['model_points']
    }
  ]
  const tables = [...real.MODEL_TABLES, ...extra]
  return {
    ...real,
    MODEL_TABLES: tables,
    modelTable: (name: string | undefined) => tables.find((t) => t.table === name)
  }
})

vi.mock('@shared/stats/catalogue', async (actual) => {
  const real = await actual<typeof import('@shared/stats/catalogue')>()
  const def = (id: string, o: Partial<MetricDef>): MetricDef => ({
    ...real.METRICS.get('team_srs')!,
    id,
    label: id,
    short: id,
    ...o
  })
  const extra = [
    def('test_shares', {
      entity: 'player',
      value: '{shares}',
      aggregation: 'sum',
      model: 'test_player_shares'
    }),
    def('test_points', {
      value: '{model_points} / nullif({games}, 0)',
      model: 'test_team_points'
    }),
    def('test_srs_plus', { value: '{mov} + {sos}' })
  ]
  return {
    ...real,
    CATALOGUE: [...real.CATALOGUE, ...extra],
    METRICS: new Map([...real.METRICS, ...extra.map((m): [string, MetricDef] => [m.id, m])])
  }
})

const CTX = { currentSeason: 2027 }
let db: StatsDb

const team = (
  q: Partial<StatsQuery> & { scope: StatsQuery['scope'] },
  metrics = ['team_srs']
): Promise<StatsResult> => runQuery(db, { entity: 'team', metrics, ...q }, CTX)

const value = (r: StatsResult, id: number, metric = 'team_srs', season?: number): number | null =>
  r.rows.find((x) => x.id === String(id) && (season === undefined || x.group.season === season))!
    .values[metric].value

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await addLeague(db)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Traded'), (2, 'Bea Laker')`)
  // Player 1 is traded from Boston to Miami after the first game; player 2 plays for the Lakers.
  await addNbaLine(db, 'a', 1, BOS)
  await addNbaLine(db, 'b', 1, MIA)
  await addNbaLine(db, 'a', 2, LAL)
  await addNbaLine(db, 'b', 2, LAL)
  await buildDerived(db)
  await buildModels(db, 2026)
  await db.exec(`CREATE TABLE test_player_shares (season INTEGER, game_type VARCHAR,
    team_id BIGINT, player_id BIGINT, shares DOUBLE)`)
  await db.exec(`INSERT INTO test_player_shares VALUES
    (2026, 'regular', ${BOS}, 1, 1.5), (2026, 'regular', ${MIA}, 1, 0.5),
    (2026, 'regular', ${LAL}, 2, 2.0)`)
  await db.exec(`CREATE TABLE test_team_points (season INTEGER, game_type VARCHAR, team_id BIGINT,
    game_id VARCHAR, game_date DATE, model_points DOUBLE)`)
  await db.exec(`INSERT INTO test_team_points VALUES
    (2026, 'regular', ${BOS}, 'a', DATE '2025-11-01', 30),
    (2026, 'regular', ${BOS}, 'c', DATE '2025-11-03', 10)`)
})

describe('a state read from a model table', () => {
  it('reads both grains', () => {
    expect(grainsOf(METRICS.get('team_srs')!)).toEqual(['game', 'season'])
  })

  it('reads a whole season as its last game: the final rating', async () => {
    const r = await team({ scope: { seasons: [2026] } })
    expect(value(r, BOS)).toBeCloseTo(8 / 3, 10)
    expect(value(r, LAL)).toBeCloseTo(-2, 10)
    expect(value(r, MIA)).toBeCloseTo(-2 / 3, 10)
    expect(r.columns[0].reason).toBeNull()
  })

  it('reads a date range as the rating after each team’s last game in it', async () => {
    const r = await team({ scope: { seasons: [2026], dates: ['2025-11-01', '2025-11-02'] } })
    expect(value(r, BOS)).toBeCloseTo(5, 10)
    expect(value(r, LAL)).toBeCloseTo(-2, 10)
    expect(value(r, MIA)).toBeCloseTo(-6, 10)
    expect(r.notes).toContain('Simple Rating System: as of the last game in scope.')
  })

  it('reads each game after it when grouped by game', async () => {
    const r = await team({ scope: { seasons: [2026], teams: [String(LAL)] }, groupBy: ['game'] })
    const byGame = Object.fromEntries(r.rows.map((x) => [x.group.game, x.values.team_srs.value]))
    expect(byGame.a).toBeCloseTo(-5, 10)
    expect(byGame.b).toBeCloseTo(-2, 10)
  })

  it('reads the schedule strengths as they stood, and the margin from the scores in scope', async () => {
    const metrics = ['team_sos', 'team_sos_left', 'team_games_left', 'team_mov']
    const day = await team(
      { scope: { seasons: [2026], dates: ['2025-11-01', '2025-11-02'] } },
      metrics
    )
    expect(value(day, MIA, 'team_sos')).toBeCloseTo(-2, 10)
    expect(value(day, MIA, 'team_sos_left')).toBeCloseTo(8, 10)
    expect(value(day, MIA, 'team_games_left')).toBe(2)
    expect(value(day, MIA, 'team_mov')).toBe(-4)
    const season = await team({ scope: { seasons: [2026] } }, metrics)
    expect(value(season, BOS, 'team_mov')).toBe(4)
    expect(value(season, LAL, 'team_sos_left')).toBeNull()
  })

  it('formulas over its columns hold: MOV + SOS is SRS', async () => {
    const r = await team({ scope: { seasons: [2026] } }, ['team_srs', 'test_srs_plus'])
    for (const id of [BOS, LAL, MIA]) {
      expect(value(r, id, 'test_srs_plus')).toBeCloseTo(value(r, id)!, 10)
    }
  })

  it('answers each season by season, and one season at a time otherwise', async () => {
    const by = await team({ scope: { seasons: [2025, 2026] }, groupBy: ['season'] })
    expect(value(by, BOS, 'team_srs', 2025)).toBeCloseTo(3, 10)
    expect(value(by, BOS, 'team_srs', 2026)).toBeCloseTo(8 / 3, 10)
    const both = await team({ scope: { seasons: [2025, 2026] } })
    expect(both.columns[0].reason).toBe('A rating as of a game, read one season at a time.')
    expect(value(both, BOS)).toBeNull()
  })

  it('reads null with its reason in a scope of other season types or under a split', async () => {
    const playoffs = await team({ scope: { seasons: [2026], gameTypes: ['playoffs'] } })
    expect(playoffs.columns[0].reason).toBe('Solved on the regular season.')
    expect(value(playoffs, LAL)).toBeNull()
    const split = await team({ scope: { seasons: [2026], split: 'clutch' } })
    expect(split.columns[0].reason).toBe('Computed per game, not per moment, so it has no split.')
  })

  it('reads the regular season’s rating in a scope of both', async () => {
    const r = await team({ scope: { seasons: [2026], gameTypes: ['regular', 'playoffs'] } })
    expect(value(r, LAL)).toBeCloseTo(-2, 10)
  })
})

describe('a sum read from a model table', () => {
  it('per player, team and season: whole seasons, a traded player’s teams added once', async () => {
    expect(grainsOf(METRICS.get('test_shares')!)).toEqual(['season'])
    const all = await runQuery(
      db,
      { entity: 'player', metrics: ['test_shares'], scope: { seasons: [2026] } },
      CTX
    )
    expect(all.rows.find((x) => x.id === '1')!.values.test_shares.value).toBe(2)
    expect(all.rows.find((x) => x.id === '2')!.values.test_shares.value).toBe(2)
    const miami = await runQuery(
      db,
      {
        entity: 'player',
        metrics: ['test_shares'],
        scope: { seasons: [2026], teams: [String(MIA)] }
      },
      CTX
    )
    expect(miami.rows.map((x) => [x.id, x.values.test_shares.value])).toEqual([['1', 0.5]])
    const dates = await runQuery(
      db,
      {
        entity: 'player',
        metrics: ['test_shares'],
        scope: { seasons: [2026], dates: ['2025-11-01', '2025-11-01'] }
      },
      CTX
    )
    expect(dates.columns[0].reason).toBe('Computed for whole seasons only.')
  })

  it('per team and game: any scope, exact', async () => {
    expect(grainsOf(METRICS.get('test_points')!)).toEqual(['game', 'season'])
    const season = await team({ scope: { seasons: [2026] } }, ['test_points'])
    expect(value(season, BOS, 'test_points')).toBe(20)
    const day = await team({ scope: { seasons: [2026], dates: ['2025-11-03', '2025-11-30'] } }, [
      'test_points'
    ])
    expect(value(day, BOS, 'test_points')).toBe(10)
  })
})
