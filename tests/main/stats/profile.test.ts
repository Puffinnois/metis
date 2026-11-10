import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { readProfile } from '@main/stats/reads'
import { openTestDb } from '../../fixtures/stats'

const BOS = 1610612738

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
})

/**
 * A small combine in the source's shape. 2019 is the 2018 combine: four guards and a forward, one
 * guard (Bo, listed `SG-SF`) with no bench press although others did one. 2022 is the 2021 combine:
 * no bench press at all, and the college three published as one total under the left corner. 2016
 * is the 2015 combine, where Ann shot the college three spot by spot.
 */
async function addCombine(): Promise<void> {
  await db.exec(`CREATE TABLE src_nba_combine_anthro (season INTEGER, player_id BIGINT,
    player_name VARCHAR, position VARCHAR, height_wo_shoes DOUBLE, weight VARCHAR, wingspan DOUBLE)`)
  await db.exec(`INSERT INTO src_nba_combine_anthro VALUES
    (2019, 1, 'Ann', 'PG', 75, '190.4', 80), (2019, 2, 'Bo', 'SG-SF', 76, '', 79),
    (2019, 3, 'Cy', 'PG-SG', 74, NULL, NULL), (2019, 4, 'Di', 'SG', 78, '205', 82),
    (2019, 5, 'Ed', 'PF', 80, '230', 84), (2022, 2, 'Bo', 'SG', 76.5, '201.2', 79.5),
    (2022, 6, 'Fay', 'PG', 73, '180', 77)`)
  await db.exec(`CREATE TABLE src_nba_combine_drills (season INTEGER, player_id BIGINT,
    player_name VARCHAR, position VARCHAR, lane_agility_time DOUBLE, bench_press BIGINT)`)
  await db.exec(`INSERT INTO src_nba_combine_drills VALUES
    (2019, 1, 'Ann', 'PG', 10.0, 10), (2019, 2, 'Bo', 'SG-SF', 11.0, NULL),
    (2019, 3, 'Cy', 'PG-SG', 11.0, 12), (2019, 4, 'Di', 'SG', 12.0, 8),
    (2019, 5, 'Ed', 'PF', 11.5, 15), (2022, 2, 'Bo', 'SG', 10.5, NULL),
    (2022, 6, 'Fay', 'PG', NULL, NULL)`)
  const spots = ['corner_left', 'break_left', 'top_key', 'break_right', 'corner_right']
  await db.exec(`CREATE TABLE src_nba_combine_spot_up (season INTEGER, player_id BIGINT,
    player_name VARCHAR, position VARCHAR,
    ${spots.map((s) => `college_${s}_made BIGINT, college_${s}_attempt BIGINT`).join(', ')})`)
  await db.exec(`INSERT INTO src_nba_combine_spot_up VALUES
    (2016, 1, 'Ann', 'PG', 3, 5, 4, 5, 2, 5, 5, 5, 1, 5),
    (2022, 2, 'Bo', 'SG', 19, 25, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (2022, 6, 'Fay', 'PG', 15, 25, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`)
}

describe('a player’s combine', () => {
  it('ranks a time among the position group at every combine, faster higher, ties in the middle', async () => {
    await addCombine()
    const p = await readProfile(db, '2')
    expect(p.combines.map((c) => [c.year, c.position, c.group])).toEqual([
      [2021, 'SG', 'G'],
      [2018, 'SG-SF', 'G']
    ])
    // Guards' lane agility: 10, 10.5, 11, 11, 12. Bo's 11 shares ranks 3 and 4 with Cy.
    expect(p.combines[1].values.lane_agility_time).toEqual({
      value: 11,
      made: null,
      attempts: null,
      percentile: 37.5,
      rank: 3,
      pool: 5,
      held: true
    })
    expect(p.combines[0].values.lane_agility_time).toMatchObject({ percentile: 75, rank: 2 })
  })

  it('leaves a skipped test blank, and says whether the combine held it at all', async () => {
    await addCombine()
    const [y2021, y2018] = (await readProfile(db, '2')).combines
    expect(y2018.values.bench_press).toMatchObject({ value: null, percentile: null, held: true })
    expect(y2021.values.bench_press).toMatchObject({ value: null, held: false })
    // A text weight left empty is not 0 lb.
    expect(y2018.values.weight).toMatchObject({ value: null, held: true })
    expect(y2021.values.weight.value).toBe(201.2)
  })

  it('counts the higher side as better, and a measurement has no rank', async () => {
    await addCombine()
    const ann = (await readProfile(db, '1')).combines.find((c) => c.year === 2018)
    // Guards' bench press: 8, 10, 12.
    expect(ann?.values.bench_press).toMatchObject({ value: 10, percentile: 50, rank: 2, pool: 3 })
    expect(ann?.values.height_wo_shoes).toMatchObject({ value: 75, rank: null, pool: 6 })
    expect(ann?.values.wingspan_to_height.value).toBeCloseTo(80 / 75, 10)
  })

  it('has no percentile for the only player of a group', async () => {
    await addCombine()
    const [ed] = (await readProfile(db, '5')).combines
    expect(ed.group).toBe('F')
    expect(ed.values.lane_agility_time).toMatchObject({ value: 11.5, percentile: null, pool: 1 })
  })

  it('adds up a drill’s spots, and reads a total filed under the first spot as the total', async () => {
    await addCombine()
    const ann = (await readProfile(db, '1')).combines.find((c) => c.year === 2015)
    expect(ann?.values.college).toMatchObject({ value: 0.6, made: 15, attempts: 25 })
    expect(ann?.values.college_corner_left).toMatchObject({ value: 0.6, made: 3, attempts: 5 })
    const [bo] = (await readProfile(db, '2')).combines
    // Guards' college threes: 15 of 25 twice and Bo's 19 of 25.
    expect(bo.values.college).toMatchObject({ made: 19, attempts: 25, percentile: 100, rank: 1 })
    expect(bo.values.college_corner_left).toMatchObject({ value: null, held: false })
  })

  it('reads nothing for a player who never went, and a table not loaded as no combine', async () => {
    await addCombine()
    await expect(readProfile(db, '99')).resolves.toMatchObject({
      combines: [],
      combineYears: { first: 2015, last: 2021 }
    })
    const empty = await openTestDb()
    await expect(readProfile(empty, '1')).resolves.toEqual({
      bio: null,
      draft: null,
      draftYears: null,
      combines: [],
      combineYears: null
    })
    await expect(readProfile(db, 'x; DROP')).resolves.toMatchObject({ combines: [] })
  })
})

describe('a player’s bio and draft', () => {
  beforeEach(async () => {
    await db.exec(`CREATE TABLE team (season INTEGER, team_id BIGINT, code VARCHAR, name VARCHAR)`)
    await db.exec(`INSERT INTO team VALUES (2026, ${BOS}, 'BOS', 'Boston Celtics')`)
    await db.exec(`CREATE TABLE src_nba_rosters (team_id BIGINT, season INTEGER, player_id BIGINT,
      num VARCHAR, position VARCHAR, height VARCHAR, weight VARCHAR, birth_date VARCHAR, age DOUBLE,
      exp VARCHAR, school VARCHAR)`)
    await db.exec(`INSERT INTO src_nba_rosters VALUES
      (${BOS}, 2025, 2, '8', 'G', '6-4', '210', 'OCT 08, 1995', 29, '5', 'Duke'),
      (${BOS}, 2026, 2, '7', 'G-F', '6-4', '218', 'OCT 08, 1995', 30, '6', ' Duke ')`)
    await db.exec(`CREATE TABLE src_nba_draft (person_id BIGINT, season INTEGER, round_number BIGINT,
      round_pick BIGINT, overall_pick BIGINT, team_id BIGINT, team_city VARCHAR, team_name VARCHAR,
      team_abbreviation VARCHAR, organization VARCHAR, organization_type VARCHAR)`)
    await db.exec(`INSERT INTO src_nba_draft VALUES
      (2, 2019, 1, 21, 21, ${BOS}, 'Boston', 'Celtics', 'BOS', 'Duke', 'College/University'),
      (7, 1997, 2, 3, 32, ${BOS}, 'Boston', 'Celtics', 'BOS', '', '')`)
  })

  it('reads the latest roster that lists them, with a column it does not have as null', async () => {
    const p = await readProfile(db, '2')
    expect(p.bio).toEqual({
      season: 2026,
      team: { id: String(BOS), code: 'BOS' },
      number: '7',
      position: 'G-F',
      height: '6-4',
      weight: '218',
      birthDate: 'OCT 08, 1995',
      age: 30,
      experience: '6',
      school: 'Duke',
      howAcquired: null
    })
  })

  it('names the draft by its year, the file’s label less one', async () => {
    const p = await readProfile(db, '2')
    expect(p.draft).toEqual({
      year: 2018,
      round: 1,
      roundPick: 21,
      overallPick: 21,
      team: { id: String(BOS), code: 'BOS', name: 'Boston Celtics' },
      organization: 'Duke',
      organizationType: 'College/University'
    })
    expect(p.draftYears).toEqual({ first: 1996, last: 2018 })
    expect((await readProfile(db, '7')).draft).toMatchObject({
      year: 1996,
      organization: null,
      organizationType: null
    })
  })

  it('has no draft or bio for a player the files do not list', async () => {
    const p = await readProfile(db, '3')
    expect(p).toMatchObject({ bio: null, draft: null, draftYears: { first: 1996, last: 2018 } })
  })
})
