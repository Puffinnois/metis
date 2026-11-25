import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { raptorSql, RAPTOR_TABLE } from '@main/stats/derived/raptor'
import { inspect } from '@main/stats/derived/sql'
import { loadSourceFile } from '@main/stats/load'
import { SOURCES } from '@main/stats/sources'
import { openTestDb } from '../../../fixtures/stats'

/**
 * FiveThirtyEight's RAPTOR files (D54) on a fixture of rows written in their shape, not copied from
 * them. The players are made up to meet each way a link is made or refused:
 *
 * - Ann Able: the same name and minutes in 2015, traded mid-season and in the playoffs; in 2016 Metis
 *   counts other minutes, and the season is carried by her id;
 * - Steve Bell, Steven Bell in Metis: the same last name and minutes;
 * - two Cal Coles in 2015, told apart by their minutes;
 * - Dee Dunn: no line in Metis;
 * - Fay Fox: two Basketball-Reference ids for one Metis player, so neither is linked;
 * - Gus Gray: 1989-90, before Metis's first season.
 */
const FIXTURES = join(__dirname, '../../../fixtures/raptor')

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
  for (const source of SOURCES.filter((s) => s.url !== undefined)) {
    await loadSourceFile(db, source, 0, join(FIXTURES, `${source.stem}.csv`))
  }
  await db.exec('CREATE TABLE player (player_id BIGINT, name VARCHAR)')
  await db.exec(`INSERT INTO player VALUES (1, 'Ann Able'), (2, 'Steven Bell'), (3, 'Cal Cole'),
    (4, 'Cal Cole'), (6, 'Fay Fox'), (9, ' ')`)
  await db.exec(`CREATE TABLE player_season (player_id BIGINT, season INTEGER, game_type VARCHAR,
    team_id BIGINT, minutes DOUBLE)`)
  // Each season's whole line (no team), and a team row that must not count twice.
  await db.exec(`INSERT INTO player_season VALUES
    (1, 2015, 'regular', NULL, 750), (1, 2015, 'regular', 10, 500), (1, 2015, 'playoffs', NULL, 50),
    (1, 2016, 'regular', NULL, 300),
    (2, 2015, 'regular', NULL, 600),
    (3, 2015, 'regular', NULL, 1000), (4, 2015, 'regular', NULL, 200),
    (6, 2015, 'regular', NULL, 400), (6, 2016, 'regular', NULL, 400),
    (9, 2015, 'regular', NULL, 300)`)
  await db.exec(raptorSql(await inspect(db)))
})

describe('the RAPTOR files as published', () => {
  it('keep every column, typed from every row, from 1993-94 on', async () => {
    const types = await db.all<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM duckdb_columns()
       WHERE table_name = 'src_raptor_modern_team' ORDER BY column_index`
    )
    expect(types.slice(0, 8).map((t) => `${t.column_name} ${t.data_type}`)).toEqual([
      'player_name VARCHAR',
      'player_id VARCHAR',
      'season INTEGER',
      'season_type VARCHAR',
      'team VARCHAR',
      'poss BIGINT',
      'mp BIGINT',
      'raptor_box_offense DOUBLE'
    ])
    expect(types.map((t) => t.column_name)).toContain('pace_impact')
    const seasons = await db.all<{ season: number }>(
      'SELECT DISTINCT season FROM src_raptor_historical_team ORDER BY 1'
    )
    expect(seasons.map((s) => s.season)).toEqual([2015, 2016])
  })
})

describe('the RAPTOR table', () => {
  const rows = (): Promise<Record<string, number | string | null>[]> =>
    db.all(
      `SELECT player_id, season, game_type, bref_id, link, rp_poss, rp_total / rp_poss AS total,
              rp_off / rp_poss AS off, rp_war AS war, rp_box_total / rp_mposs AS box,
              rp_onoff_total / rp_mposs AS onoff, rp_pred_total / rp_poss AS pred,
              rp_pace / rp_pace_poss AS pace, minutes
       FROM ${RAPTOR_TABLE} ORDER BY player_id, season, game_type`
    )

  it('links each player as the rules allow and no one wrongly', async () => {
    const links = (await rows()).map((r) => [r.bref_id, r.player_id, r.season, r.game_type, r.link])
    expect(links).toEqual([
      ['aaaa01', 1, 2015, 'playoffs', 'name'],
      ['aaaa01', 1, 2015, 'regular', 'name'],
      ['aaaa01', 1, 2016, 'regular', 'carried'],
      ['bbbb01', 2, 2015, 'playoffs', 'last name and minutes'],
      ['bbbb01', 2, 2015, 'regular', 'last name and minutes'],
      ['cccc01', 3, 2015, 'regular', 'name'],
      ['cccc02', 4, 2015, 'regular', 'name']
    ])
  })

  it('weights each rate by possessions over teams, adds WAR, and keeps the modern parts apart', async () => {
    const [playoffs, regular, later] = await rows()
    // 2015's regular season: 1,000 possessions at +2.0 and 500 at -1.0.
    expect(regular).toMatchObject({ rp_poss: 1500, total: 1, war: 1.3, minutes: 750 })
    expect(regular.off).toBeCloseTo((1000 * 1.5 + 500 * -0.5) / 1500, 12)
    expect(regular.box).toBeCloseTo(500 / 1500, 12)
    expect(regular.onoff).toBeCloseTo(3500 / 1500, 12)
    expect(regular.pred).toBeCloseTo((1000 * 1.4 + 500 * -0.5) / 1500, 12)
    expect(regular.pace).toBeCloseTo(0, 12)
    expect(playoffs).toMatchObject({ rp_poss: 100, total: 4, war: 0.3, box: 3, onoff: 6 })
    // No modern row in 2016: the parts read nothing, and their possessions are not counted.
    expect(later).toMatchObject({ total: 2, box: null, onoff: null })
  })

  it('reads back the by-player file from the by-team rows, both season types together', async () => {
    const back = await db.all<{ total: number; published: number; box: number; pbox: number }>(
      `SELECT sum(t.rp_total) / sum(t.rp_poss) AS total, any_value(p.raptor_total) AS published,
              sum(t.rp_box_total) / sum(t.rp_mposs) AS box, any_value(m.raptor_box_total) AS pbox
       FROM ${RAPTOR_TABLE} t
       JOIN src_raptor_historical_player p ON p.player_id = t.bref_id AND p.season = t.season
       JOIN src_raptor_modern_player m ON m.player_id = t.bref_id AND m.season = t.season
       GROUP BY t.player_id, t.season`
    )
    expect(back).toHaveLength(1)
    expect(back[0].total).toBeCloseTo(back[0].published, 12)
    expect(back[0].box).toBeCloseTo(back[0].pbox, 12)
  })

  it('divides by the possessions that have a value, as the by-player files do', async () => {
    // Steve Bell's two playoff possessions have no values: played, and counted as possessions, but
    // not in what a rate is divided by, so the season reads the by-player file's 0.5, not 600 / 1,202.
    const bell = await db.all<{ game_type: string; possessions: number; rp_poss: number | null }>(
      `SELECT game_type, possessions, rp_poss FROM ${RAPTOR_TABLE} WHERE bref_id = 'bbbb01'
       ORDER BY game_type`
    )
    expect(bell).toEqual([
      { game_type: 'playoffs', possessions: 2, rp_poss: null },
      { game_type: 'regular', possessions: 1200, rp_poss: 1200 }
    ])
    const season = await db.get<{ total: number }>(
      `SELECT sum(rp_total) / sum(rp_poss) AS total FROM ${RAPTOR_TABLE} WHERE bref_id = 'bbbb01'`
    )
    expect(season?.total).toBeCloseTo(0.5, 12)
  })

  it('takes the by-player file’s WAR for a season type whose team rows have none, a published 0 included', async () => {
    // As Tyson Chandler's 2019-20 playoffs (Steve Bell's two possessions here) and Malik Newman's 2019-20
    // regular season (Cal Cole's, its WAR emptied): the by-team file prints none, the by-player file 0.
    await db.exec(
      "UPDATE src_raptor_historical_team SET war_total = NULL WHERE player_id = 'cccc02'"
    )
    await db.exec(
      "UPDATE src_raptor_historical_player SET war_total = 0, war_reg_season = 0 WHERE player_id = 'cccc02'"
    )
    // A season type the by-team file has a WAR for keeps it, whatever the by-player file prints.
    await db.exec(
      "UPDATE src_raptor_historical_player SET war_reg_season = 9 WHERE player_id = 'aaaa01'"
    )
    await db.exec(raptorSql(await inspect(db)))
    const war = await db.all<{ bref_id: string; game_type: string; war: number | null }>(
      `SELECT bref_id, game_type, rp_war AS war FROM ${RAPTOR_TABLE}
       WHERE season = 2015 AND bref_id IN ('aaaa01', 'bbbb01', 'cccc02') ORDER BY 1, 2`
    )
    expect(war.map((r) => [r.bref_id, r.game_type, r.war])).toEqual([
      ['aaaa01', 'playoffs', 0.3],
      ['aaaa01', 'regular', 1.3],
      ['bbbb01', 'playoffs', 0],
      ['bbbb01', 'regular', 0.6],
      ['cccc02', 'regular', 0]
    ])
  })

  it('is built empty, never failing, when the files are not there', async () => {
    await db.exec('DROP TABLE src_raptor_historical_team')
    await db.exec(raptorSql(await inspect(db)))
    expect(await rows()).toEqual([])
  })
})
