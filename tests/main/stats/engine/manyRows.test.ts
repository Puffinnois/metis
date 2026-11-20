import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived, NARROWED, narrowCounts } from '@main/stats/derived/build'
import { compileQuery, type CompileContext } from '@main/stats/engine/compile'
import { runQuery } from '@main/stats/engine/run'
import { LEAGUES, type League } from '@shared/leagues'
import type { StatsQuery, StatsResult } from '@shared/stats/types'
import {
  addGame,
  addNbaLine,
  BOS,
  emptySources,
  LAL,
  type Stats
} from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

/**
 * A league of many rows (`League.manyRows`, the college leagues, T1302.9) ranks every column in one
 * pass and picks the rows it lists before reading their columns back; its build stores the counts as
 * BIGINT (`narrowCounts`). Neither may change an answer: each query here runs with the setting on and
 * off on the same tables, and must give the same rows, values, ranks, percentiles and order. The
 * players are made to tie (equal values, a lower-is-better column, rows that do not qualify).
 */
const read = (league: League): League => ({
  ...league,
  metricsByDefault: true,
  builds: ['identity', 'derived']
})
const many = read(LEAGUES.ncaam)
const one = { ...many, manyRows: undefined }
const ctx = (league: League): CompileContext => ({ league, currentSeason: 2026 })

// FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, AST, STL, BLK, TOV, PF, PTS
const line = (pts: number, ast: number, tov: number, fg3m = 1): Stats => [
  4,
  9,
  fg3m,
  3,
  2,
  3,
  1,
  3,
  ast,
  1,
  0,
  tov,
  2,
  pts
]

let db: StatsDb
beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles', 'west', 'pacific')`)
  await db.exec('ALTER TABLE team ADD COLUMN division_i BOOLEAN DEFAULT true')
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  const names = ['Ana', 'Bea', 'Cat', 'Dee', 'Eve', 'Fay', 'Gia', 'Hal']
  await db.exec(`INSERT INTO player VALUES ${names.map((n, i) => `(${i + 1}, '${n}')`).join(', ')}`)
  await addGame(db, { id: 'a', date: '2026-01-05', home: BOS, away: LAL, scores: [100, 90] })
  await addGame(db, { id: 'b', date: '2026-01-07', home: LAL, away: BOS, scores: [95, 99] })
  await addGame(db, { id: 'c', date: '2026-02-03', home: BOS, away: LAL, scores: [80, 81] })
  // Ana and Bea tie on points and assists; Dee and Eve on turnovers; Hal plays one game.
  const plays: [string, number, number, string, Stats][] = [
    ['a', 1, BOS, 'G', line(20, 5, 2)],
    ['b', 1, BOS, 'G', line(10, 3, 1)],
    ['c', 1, BOS, 'G', line(15, 4, 3)],
    ['a', 2, BOS, 'G', line(15, 4, 2)],
    ['b', 2, BOS, 'G', line(15, 4, 2)],
    ['c', 2, BOS, 'G', line(15, 4, 2, 0)],
    ['a', 3, BOS, 'F', line(9, 1, 4)],
    ['b', 3, BOS, 'F', line(12, 2, 0)],
    ['c', 3, BOS, 'F', line(30, 0, 1)],
    ['a', 4, LAL, 'G', line(22, 7, 3)],
    ['b', 4, LAL, 'G', line(18, 6, 3)],
    ['c', 4, LAL, 'G', line(8, 2, 3)],
    ['a', 5, LAL, 'F', line(11, 1, 3)],
    ['b', 5, LAL, 'F', line(14, 2, 3)],
    ['c', 5, LAL, 'F', line(16, 3, 3)],
    ['a', 6, LAL, 'C', line(6, 0, 1)],
    ['b', 6, LAL, 'C', line(25, 1, 5)],
    ['c', 6, LAL, 'C', line(19, 2, 2)],
    ['a', 7, LAL, 'G', line(3, 9, 0)],
    ['c', 7, LAL, 'G', line(5, 8, 1)],
    ['b', 8, BOS, 'C', line(40, 0, 6)]
  ]
  for (const [game, player, team, position, stats] of plays) {
    await addNbaLine(db, game, player, team, { stats, position, minutes: '30:00' })
  }
  await buildDerived(db)
})

const run = (league: League, q: StatsQuery): Promise<StatsResult> => runQuery(db, q, ctx(league))
// Rows of one player tied on every sort key (a board by game or opponent) have no order in the SQL.
const strip = (r: StatsResult, grouped = false): unknown => ({
  ...r,
  ms: 0,
  rows: grouped
    ? [...r.rows].sort((a, b) =>
        `${a.id}|${JSON.stringify(a.group)}`.localeCompare(`${b.id}|${JSON.stringify(b.group)}`)
      )
    : r.rows
})

const METRICS = ['pts', 'ast', 'tov', 'fg_pct', 'fg3_pct', 'ast_tov', 'min']
const QUERIES: [string, Partial<StatsQuery>][] = [
  ['totals', {}],
  ['per game', { transform: 'perGame' }],
  ['percentile', { transform: 'percentile' }],
  ['z score', { transform: 'zScore' }],
  ['vs league', { transform: 'vsLeague' }],
  ['by opponent', { groupBy: ['opponent'] }],
  ['by month', { groupBy: ['month'] }],
  ['by game', { groupBy: ['game'] }],
  ['qualified only', { transform: 'perGame', scope: { seasons: [2026], qualifiedOnly: true } }],
  ['sorted by turnovers, fewest first', { sort: { metric: 'tov', dir: 'asc' } }],
  ['a limit inside a tie', { limit: 3, transform: 'perGame' }],
  ['ranks off', { ranks: false }],
  ['a team', { scope: { seasons: [2026], teams: [String(BOS)] } }]
]

describe('a league of many rows', () => {
  it.each(QUERIES)('gives the same board with one pass of ranks: %s', async (_, extra) => {
    const q: StatsQuery = {
      entity: 'player',
      metrics: METRICS,
      ...extra,
      scope: { seasons: [2026], ...(extra.scope ?? {}) }
    }
    const grouped = (q.groupBy ?? []).length > 0
    expect(strip(await run(many, q), grouped)).toEqual(strip(await run(one, q), grouped))
  })

  it('gives the same team board', async () => {
    const q: StatsQuery = {
      entity: 'team',
      metrics: ['team_pts', 'opp_pts', 'team_ortg', 'team_drtg'],
      scope: { seasons: [2026] }
    }
    expect(strip(await run(many, q))).toEqual(strip(await run(one, q)))
  })

  it('ranks ties as the window functions do', async () => {
    const r = await run(many, { entity: 'player', metrics: ['ast'], scope: { seasons: [2026] } })
    // Ana and Bea both have 12 assists; Dee leads the guards with 15, Gia has 17 in two games.
    const ast = Object.fromEntries(r.rows.map((x) => [x.name, x.values.ast]))
    expect(ast.Ana.raw).toBe(12)
    expect(ast.Bea.raw).toBe(12)
    expect(ast.Ana.rank).toBe(ast.Bea.rank)
    expect(ast.Ana.percentile).toBe(ast.Bea.percentile)
  })

  it('leaves the NBA’s and the WNBA’s SQL as it was', () => {
    const q: StatsQuery = { entity: 'player', metrics: METRICS, scope: { seasons: [2026] } }
    for (const league of [LEAGUES.nba, LEAGUES.wnba]) {
      const sql = compileQuery(q, ctx(league)).sql
      expect(sql).not.toContain('ranklong')
      expect(sql).not.toContain('listed AS')
    }
    expect(compileQuery(q, ctx(many)).sql).toContain('ranklong')
  })
})

describe('narrowCounts', () => {
  it('stores the counts as BIGINT with the same values and row order', async () => {
    const before = await Promise.all(
      NARROWED.map((t) => db.all(`SELECT * FROM ${t} ORDER BY rowid`))
    )
    const wide = await db.all<{ n: number }>(
      `SELECT count(*) AS n FROM duckdb_columns() WHERE table_name IN (${NARROWED.map((t) => `'${t}'`).join(', ')}) AND data_type = 'HUGEINT'`
    )
    expect(wide[0].n).toBeGreaterThan(0)
    await narrowCounts(db)
    const after = await Promise.all(
      NARROWED.map((t) => db.all(`SELECT * FROM ${t} ORDER BY rowid`))
    )
    expect(after).toEqual(before)
    const left = await db.all<{ n: number }>(
      `SELECT count(*) AS n FROM duckdb_columns() WHERE table_name IN (${NARROWED.map((t) => `'${t}'`).join(', ')}) AND data_type = 'HUGEINT'`
    )
    expect(left[0].n).toBe(0)
  })

  it('gives the same boards on narrowed tables', async () => {
    const q: StatsQuery = {
      entity: 'player',
      metrics: METRICS,
      transform: 'perGame',
      scope: { seasons: [2026] }
    }
    const wide = strip(await run(many, q))
    await narrowCounts(db)
    expect(strip(await run(many, q))).toEqual(wide)
  })
})
