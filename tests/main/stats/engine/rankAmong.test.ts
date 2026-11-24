import { beforeAll, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { compileQuery } from '@main/stats/engine/compile'
import { runQuery } from '@main/stats/engine/run'
import { LEAGUES } from '@shared/leagues'
import type { MetricValue, StatsQuery } from '@shared/stats/types'
import {
  addGame,
  addNbaLine,
  addNbaTeam,
  BOS,
  emptySources,
  LAL,
  type Stats
} from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

const CTX = { league: LEAGUES.nba, currentSeason: 2027 }

/** A line of `pts` points on `pts` free throws, with `ast` assists. */
const line = (pts: number, ast = 0): Stats => [0, 0, 0, 0, pts, pts, 0, 0, 0, ast, 0, 0, 0, pts]

let db: StatsDb

/**
 * Six guards over four games. The tab's qualifier is minutes (1,000 per 82 games, about 49 over
 * four): players 1, 3 and 5 play enough, players 2, 4 and 6 do not, yet all have free throws.
 */
beforeAll(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'One'), (2, 'Two'), (3, 'Three'), (4, 'Four'),
    (5, 'Five'), (6, 'Six')`)
  const games = ['a', 'b', 'c', 'd']
  for (const [i, id] of games.entries()) {
    await addGame(db, {
      id,
      date: `2026-01-0${i + 1}`,
      home: BOS,
      away: LAL,
      scores: [100, 90],
      season: 2026
    })
    await addNbaTeam(db, id, BOS, line(100))
  }
  const plan: [number, number, string, number][] = [
    [1, 10, '30:00', 2],
    [2, 12, '06:00', 5],
    [3, 4, '30:00', 1],
    [4, 2, '06:00', 9],
    [5, 7, '30:00', 3],
    [6, 9, '06:00', 0]
  ]
  for (const [player, pts, minutes, ast] of plan) {
    for (const g of games) {
      await addNbaLine(db, g, player, BOS, { stats: line(pts, ast), position: 'G', minutes })
    }
  }
  await buildDerived(db)
})

const query = (over: Partial<StatsQuery> = {}): StatsQuery => ({
  entity: 'player',
  metrics: ['ftm', 'min', 'pts', 'ast'],
  scope: { seasons: [2026] },
  transform: 'perGame',
  ...over
})

describe('rankAmong: the rank pool of a board’s tab qualifier', () => {
  it('ranks a metric among the rows the qualifier admits, as the board does (worked by hand)', async () => {
    const r = await runQuery(db, query({ rankAmong: 'min' }), CTX)
    const cell = (id: string, m: string): [number | null, number | null] => {
      const v = r.rows.find((x) => x.id === id)!.values[m]
      return [v.percentile, v.rank]
    }
    // Free throws a game among players 1, 3 and 5 (10, 4, 7), the three with enough minutes:
    // 1 is above both others, 5 above one, 3 above none. The same figures as
    // `tests/renderer/lib/statsRankPool.test.ts` gives the board's own rule on these values.
    expect(cell('1', 'ftm')).toEqual([100, 1])
    expect(cell('5', 'ftm')).toEqual([50, 2])
    expect(cell('3', 'ftm')).toEqual([0, 3])
    for (const id of ['2', '4', '6']) expect(cell(id, 'ftm')).toEqual([null, null])
    // Minutes: the three tie at 30, so none is above another.
    for (const id of ['1', '3', '5']) expect(cell(id, 'min')).toEqual([0, 1])
  })

  it('leaves out of a pool the rows short of the qualifier, but not for a metric that qualifies by its own minimum', async () => {
    const among = await runQuery(db, query({ rankAmong: 'min' }), CTX)
    const own = await runQuery(db, query(), CTX)
    const of = (r: typeof among, id: string, m: string): MetricValue | undefined =>
      r.rows.find((x) => x.id === id)?.values[m]
    // Player 2 has free throws but six minutes a game: ranked alone, not among the tab's rows.
    expect(own.rows.find((x) => x.id === '2')?.values.ftm.percentile).not.toBeNull()
    expect(of(among, '2', 'ftm')?.percentile).toBeNull()
    expect(of(among, '1', 'ftm')).toMatchObject({ rank: 1 })
    // Points (the NBA's per-game leader, D33) qualifies on games alone: the same either way.
    expect(of(among, '2', 'pts')).toMatchObject({
      percentile: of(own, '2', 'pts')?.percentile,
      rank: of(own, '2', 'pts')?.rank
    })
  })

  it('gives each ranked value the size of its pool when asked, and none otherwise', async () => {
    const among = await runQuery(db, query({ rankAmong: 'min', poolSizes: true }), CTX)
    const pool = (id: string, m: string): number | null | undefined =>
      among.rows.find((x) => x.id === id)?.values[m].pool
    // Free throws among the three with enough minutes; points (own minimum) among all six.
    expect(pool('1', 'ftm')).toBe(3)
    expect(pool('2', 'ftm')).toBeNull()
    expect(pool('2', 'pts')).toBe(6)
    const own = await runQuery(db, query(), CTX)
    expect('pool' in own.rows[0].values.ftm).toBe(false)
    // A board asks `rankAmong` without the count: no count, and no window for it in the SQL.
    const board = await runQuery(db, query({ rankAmong: 'min' }), CTX)
    expect('pool' in board.rows[0].values.ftm).toBe(false)
    expect(compileQuery(query({ rankAmong: 'min' }), CTX).sql).not.toMatch(/ AS n0\b/)
    expect(compileQuery(query({ rankAmong: 'min', poolSizes: true }), CTX).sql).toMatch(/ AS n0\b/)
    expect(() => compileQuery(query({ poolSizes: true }), CTX)).toThrow('poolSizes needs rankAmong')
  })

  it('leaves a query without it as it was, and refuses one it cannot read', () => {
    const plain = compileQuery(query(), CTX).sql
    expect(compileQuery(query({ rankAmong: 'min' }), CTX).sql).not.toBe(plain)
    expect(plain).not.toMatch(/AND q1\)/)
    expect(() => compileQuery(query({ rankAmong: 'reb' }), CTX)).toThrow(
      'rankAmong must be one of the metrics'
    )
  })
})
