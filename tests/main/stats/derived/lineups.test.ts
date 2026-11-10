import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildPublished } from '@main/stats/derived/published'
import { LINEUPS, lineupsSql } from '@main/stats/derived/lineups'
import { inspect } from '@main/stats/derived/sql'
import { LINEUP_STORED } from '@shared/stats/lineups'
import { openTestDb } from '../../../fixtures/stats'

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
})

const BOS = 1610612738
const OKC = 1610612760

/** The columns every dashboard shares. */
const HEAD = `group_id VARCHAR, group_name VARCHAR, team_id BIGINT, gp BIGINT, min DOUBLE,
  sum_time_played BIGINT, season INTEGER, season_type VARCHAR, group_quantity INTEGER`

const build = async (): Promise<void> => {
  await db.exec(lineupsSql(await inspect(db)))
}

interface Unit {
  season: number
  game_type: string
  team_id: number
  p1: number
  p5: number
  names: string | null
  games: number | null
  minutes: number | null
  [column: string]: number | string | null
}

const units = (): Promise<Unit[]> =>
  db.all<Unit>(
    `SELECT * REPLACE (p1::INTEGER AS p1, p5::INTEGER AS p5) FROM ${LINEUPS}
     ORDER BY season, game_type, team_id, p1, p5`
  )

describe('the lineup table', () => {
  beforeEach(async () => {
    // Base and advanced list the same five with the ids in a different order; the second unit is in
    // base alone, the third in the scoring file alone; a pair, a repeated row, a unit of another
    // team, a playoff row and a 2006-07 row are the rest. The id is ascending in the real files:
    // base writes it the other way here to show the key does not depend on it.
    await db.exec(`CREATE TABLE src_dash_lineups_base (${HEAD}, w BIGINT, l BIGINT, fgm BIGINT,
      fga BIGINT, fg3_m BIGINT, fg3_a BIGINT, pts BIGINT, plus_minus BIGINT, fg_pct DOUBLE)`)
    await db.exec(`INSERT INTO src_dash_lineups_base VALUES
      ('-5-3-1-2-4-', 'A - B - C - D - E', ${BOS}, 4, 60, 180000, 2026, 'Regular Season', 5, 3, 1, 40, 90, 20, 8, 100, 6, 0.444),
      ('-1-2-3-4-5-', 'A - B - C - D - E', ${BOS}, 4, 60, 100, 2026, 'Regular Season', 5, 9, 9, 9, 9, 9, 9, 9, 9, 0.9),
      ('-1-2-3-4-6-', 'A - B - C - D - F', ${BOS}, 2, 12.5, 37500, 2026, 'Regular Season', 5, 1, 1, 1, 3, 0, 1, 33, -2, NULL),
      ('-1-2-3-4-5-', 'A - B - C - D - E', ${OKC}, 1, 10, 30000, 2026, 'Regular Season', 5, 0, 1, 5, 9, 2, 4, 21, 1, NULL),
      ('-1-2-3-4-5-', 'A - B - C - D - E', ${BOS}, 2, 7, 21000, 2026, 'Playoffs', 5, 1, 1, 5, 10, 2, 4, 11, 3, NULL),
      ('-1-2-', 'A - B', ${BOS}, 4, 99, 297000, 2026, 'Regular Season', 2, 2, 2, 50, 20, 5, 3, 50, 4, NULL),
      ('-1-2-3-4-5-', 'A - B - C - D - E', ${BOS}, 4, 60, 180000, 2006, 'Regular Season', 5, 1, 1, 1, 1, 1, 1, 1, 1, NULL)`)
    // The advanced file has no pie column, and its minutes are a per-game average in the NBA's
    // scoring and four-factors files but rounded totals here.
    await db.exec(`CREATE TABLE src_dash_lineups_advanced (${HEAD}, off_rating DOUBLE,
      def_rating DOUBLE, ast_pct DOUBLE, poss BIGINT)`)
    await db.exec(`INSERT INTO src_dash_lineups_advanced VALUES
      ('-1-2-3-4-5-', 'A - B - C - D - E', ${BOS}, 4, 60, 180000, 2026, 'Regular Season', 5, 120.5, 100.25, 0.6, 120),
      ('-1-2-3-4-5-', 'A - B - C - D - E', ${BOS}, 2, 7, 21000, 2026, 'Playoffs', 5, 90, 80, 0.5, 40)`)
    await db.exec(`CREATE TABLE src_dash_lineups_scoring (${HEAD}, pct_fga_3_pt DOUBLE)`)
    await db.exec(`INSERT INTO src_dash_lineups_scoring VALUES
      ('-1-2-3-4-5-', 'A - B - C - D - E', ${BOS}, 4, 15, 180000, 2026, 'Regular Season', 5, 0.4),
      ('-7-8-9-10-11-', 'G - H - I - J - K', ${BOS}, 3, 4, 36000, 2026, 'Regular Season', 5, 0.25)`)
  })

  it('pairs a unit across files by its five ids, whatever order a file writes them in', async () => {
    await build()
    const [unit] = (await units()).filter(
      (u) => u.team_id === BOS && u.game_type === 'regular' && u.p1 === 1 && u.p5 === 5
    )
    expect(unit).toMatchObject({
      games: 4,
      // Minutes are the seconds the NBA counts in fiftieths, not the rounded `min` column.
      minutes: 60,
      fgm: 40,
      adv_off_rating: 120.5,
      adv_ast_pct: 0.6,
      possessions: 120,
      sc_pct_fga_3_pt: 0.4
    })
    expect(await units()).toHaveLength(5)
  })

  it('keeps one row for a repeated unit, the one with the most time', async () => {
    await build()
    const rows = await units()
    const same = rows.filter((u) => u.team_id === BOS && u.game_type === 'regular' && u.p1 === 1)
    expect(same.filter((u) => u.p5 === 5)).toHaveLength(1)
    expect(same.find((u) => u.p5 === 5)?.fgm).toBe(40)
  })

  it('reads NULL for a measure a file does not list, and for a table or column it lacks', async () => {
    await build()
    const rows = await units()
    const baseOnly = rows.find((u) => u.p5 === 6)
    expect(baseOnly).toMatchObject({ games: 2, minutes: 12.5, fgm: 1, possessions: null })
    expect(baseOnly?.adv_off_rating).toBeNull()
    expect(baseOnly?.sc_pct_fga_3_pt).toBeNull()
    // Dashboards that are not there at all, and the advanced file's missing pie.
    const first = rows.find((u) => u.p5 === 5 && u.team_id === BOS && u.game_type === 'regular')
    for (const id of ['adv_pie', 'misc_pts_fb', 'ff_opp_efg_pct', 'opp_pts', 'opp_plus_minus']) {
      expect(first?.[id]).toBeNull()
    }
  })

  it('lists a unit only the scoring file knows, with its games and minutes from that file', async () => {
    await build()
    const only = (await units()).find((u) => u.p1 === 7)
    expect(only).toMatchObject({
      games: 3,
      minutes: 12,
      names: 'G - H - I - J - K',
      sc_pct_fga_3_pt: 0.25,
      fgm: null
    })
  })

  it('keeps teams, season types and the five-man files apart, and leaves out 2006-07', async () => {
    await build()
    const rows = await units()
    expect(rows.map((u) => [u.season, u.game_type, u.team_id, u.p1, u.p5])).toEqual([
      [2026, 'playoffs', BOS, 1, 5],
      [2026, 'regular', BOS, 1, 5],
      [2026, 'regular', BOS, 1, 6],
      [2026, 'regular', BOS, 7, 11],
      [2026, 'regular', OKC, 1, 5]
    ])
  })

  it('builds in a refresh, and builds an empty table when no lineup file is there', async () => {
    await db.exec('DROP TABLE src_dash_lineups_base')
    await db.exec('DROP TABLE src_dash_lineups_advanced')
    await db.exec('DROP TABLE src_dash_lineups_scoring')
    await buildPublished(db)
    expect(await units()).toEqual([])
  })

  it('stores a column for everything it reads', async () => {
    const cols = await db.all<{ column_name: string }>(
      `SELECT column_name FROM duckdb_columns() WHERE table_name = '${LINEUPS}'`
    )
    const held = new Set(cols.map((c) => c.column_name))
    for (const c of LINEUP_STORED) expect(held.has(c.id)).toBe(true)
  })
})
