import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { buildPublished } from '@main/stats/derived/published'
import { compileQuery } from '@main/stats/engine/compile'
import { grainsOf } from '@main/stats/engine/registry'
import { runQuery } from '@main/stats/engine/run'
import { METRICS } from '@shared/stats/catalogue'
import type { StatsQuery, StatsResult, StatsRow } from '@shared/stats/types'
import { addGame, addNbaLine, BOS, emptySources, LAL } from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

const CTX = { currentSeason: 2027 }
let db: StatsDb

const run = (q: Partial<StatsQuery> & { scope: StatsQuery['scope'] }): Promise<StatsResult> =>
  runQuery(db, { entity: 'player', metrics: ['games_out_injury', 'games_out_other'], ...q }, CTX)

const row = (r: StatsResult, id: string): StatsRow => r.rows.find((x) => x.id === id)!
const ids = (r: StatsResult): string[] => r.rows.map((x) => x.id).sort()

const INJURY = 'Injury/Illness - Left Ankle; Sprain'

/**
 * Player 1 plays three regular-season games and one playoff game for Boston, and the reports list
 * them out of two more: three times for one (an injury) and once for the other (a G League
 * assignment), and questionable for a game they then played. Player 2 plays two games for Los Angeles
 * and is listed out of a playoff game they have no line in (out for the whole playoff run), and out
 * of a game they did play. Player 3 never plays: Boston lists them out of three regular-season games
 * for an injury, so they are out for the whole regular season. They are in no box score, so only the
 * report names them, and the roster gives their position. Player 2 has no roster row, so their
 * playoff row takes the position of their regular-season line.
 */
beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Boston'), (2, 'Bea Laker')`)
  await db.exec(`INSERT INTO src_nba_rosters VALUES (1, 2026, 'G'), (3, 2026, 'F-C')`)
  const game = (id: string, date: string, type = 'regular'): Promise<void> =>
    addGame(db, { id, date, home: BOS, away: LAL, scores: [100, 90], season: 2026, type })
  await game('a', '2025-11-01')
  await game('b', '2025-11-03')
  await game('c', '2025-11-05')
  await game('e', '2025-11-07')
  await game('f', '2025-11-09')
  await game('po1', '2026-04-20', 'playoffs')
  await game('po2', '2026-04-22', 'playoffs')
  for (const g of ['a', 'b', 'c', 'po1']) await addNbaLine(db, g, 1, BOS, { position: 'G' })
  for (const g of ['a', 'b']) await addNbaLine(db, g, 2, LAL, { position: 'G' })
  await buildDerived(db)

  await db.exec(`CREATE TABLE src_nba_injury_report (season INTEGER, report_datetime TIMESTAMP,
    game_date DATE, team_id BIGINT, current_status VARCHAR, reason VARCHAR, category VARCHAR,
    game_id VARCHAR, person_id BIGINT, report_player_name VARCHAR)`)
  const at = (hour: number): string =>
    `TIMESTAMP '2025-11-01 ${String(hour).padStart(2, '0')}:00:00'`
  await db.exec(`INSERT INTO src_nba_injury_report VALUES
    (2026, ${at(10)}, DATE '2025-11-07', ${BOS}, 'Out', '${INJURY}', NULL, 'e', 1, 'Boston, Ana'),
    (2026, ${at(14)}, DATE '2025-11-07', ${BOS}, 'Out', '${INJURY}', NULL, 'e', 1, 'Boston, Ana'),
    (2026, ${at(18)}, DATE '2025-11-07', ${BOS}, 'Out', '${INJURY}', NULL, 'e', 1, 'Boston, Ana'),
    (2026, ${at(10)}, DATE '2025-11-09', ${BOS}, 'Out', 'G League - On Assignment', NULL, 'f', 1, 'Boston, Ana'),
    (2026, ${at(10)}, DATE '2025-11-05', ${BOS}, 'Out', '${INJURY}', NULL, 'c', 1, 'Boston, Ana'),
    (2026, ${at(18)}, DATE '2025-11-05', ${BOS}, 'Questionable', '${INJURY}', NULL, 'c', 1, 'Boston, Ana'),
    (2026, ${at(10)}, DATE '2026-04-22', ${LAL}, 'Out', '${INJURY}', NULL, 'po2', 2, 'Laker, Bea'),
    (2026, ${at(10)}, DATE '2025-11-03', ${LAL}, 'Out', '${INJURY}', NULL, 'b', 2, 'Laker, Bea'),
    (2026, ${at(10)}, DATE '2025-11-01', ${BOS}, 'Out', '${INJURY}', NULL, 'a', 3, 'Three, Cara'),
    (2026, ${at(11)}, DATE '2025-11-03', ${BOS}, 'Out', '${INJURY}', NULL, 'b', 3, 'Three, Cara'),
    (2026, ${at(12)}, DATE '2025-11-05', ${BOS}, 'Out', '${INJURY}', NULL, 'c', 3, 'Three, Cara')`)
  await buildPublished(db)
})

describe('games out, through the engine', () => {
  it('is a published metric: the season grain, no games to divide by', () => {
    expect(grainsOf(METRICS.get('games_out_injury')!)).toEqual(['season'])
  })

  it('counts a game once, by the last report, for the regular season', async () => {
    const r = await run({ scope: { seasons: [2026] } })
    expect(r.grain).toBe('season')
    // Game e: three reports, one game. Game c: Out, then Questionable: not out. Game f: another reason.
    expect(row(r, '1').values.games_out_injury.value).toBe(1)
    expect(row(r, '1').values.games_out_other.value).toBe(1)
    expect(row(r, '2').values.games_out_other.value).toBeFalsy()
  })

  it('counts a game the player was listed Out of even when the box score has them in it', async () => {
    // Player 2 was listed Out of game b and has a line in it: the listing is published, not corrected.
    const r = await run({ scope: { seasons: [2026] } })
    expect(row(r, '2').games).toBe(2)
    expect(row(r, '2').values.games_out_injury.value).toBe(1)
  })

  it('answers a season before the reports with the reason, not a number, and adds nobody', async () => {
    const r = await run({ scope: { seasons: [2019] } })
    expect(r.columns.map((c) => c.reason)).toEqual([
      'Recorded from 2019-20.',
      'Recorded from 2019-20.'
    ])
    expect(r.rows).toEqual([])
  })

  it('stays a total under per game, since the table publishes no games to divide by', async () => {
    const r = await run({ scope: { seasons: [2026] }, transform: 'perGame' })
    expect(r.columns[0].reason).toBeNull()
    expect(row(r, '1').values.games_out_injury.value).toBe(1)
  })
})

describe('a player with games out and no box-score line (Plan T1206)', () => {
  it('lists a player out for the whole regular season, with the box-score stats null', async () => {
    const r = await run({
      metrics: ['games_out_injury', 'games_out_other', 'pts', 'min'],
      scope: { seasons: [2026] }
    })
    expect(ids(r)).toEqual(['1', '2', '3'])
    const cara = row(r, '3')
    // Named by the report, placed by the report's team and the roster's position.
    expect(cara).toMatchObject({
      name: 'Cara Three',
      team: 'BOS',
      position: 'F',
      games: 0,
      noLine: true
    })
    expect(cara.values.games_out_injury.value).toBe(3)
    expect(cara.values.pts.value).toBeNull()
    expect(cara.values.min.value).toBeNull()
    expect(row(r, '1').noLine).toBeUndefined()
    expect(r.columns.find((c) => c.id === 'games_out_injury')?.addsRows).toBe(true)
    expect(r.columns.find((c) => c.id === 'pts')?.addsRows).toBeUndefined()
  })

  it('never qualifies, ranks or gets a percentile, for any metric', async () => {
    const r = await run({
      metrics: ['games_out_injury', 'min'],
      scope: { seasons: [2026] },
      transform: 'percentile'
    })
    for (const v of Object.values(row(r, '3').values)) {
      expect(v).toMatchObject({ qualified: false, rank: null, percentile: null })
    }
    // The players with a line still rank among themselves.
    expect(row(r, '1').values.games_out_injury.rank).not.toBeNull()
  })

  it('stays out of the league mean', async () => {
    // Players 1 and 2 have one injury game each: their mean is 1, so each is 0 against it. With Cara's
    // three games in it, the mean would be 5/3.
    const r = await run({ scope: { seasons: [2026] }, transform: 'vsLeague' })
    expect(row(r, '1').values.games_out_injury.value).toBe(0)
    expect(row(r, '2').values.games_out_injury.value).toBe(0)
    expect(row(r, '3').values.games_out_injury.value).toBeNull()
  })

  it('is listed in order of the count it is sorted by, though it does not qualify', async () => {
    const r = await run({
      scope: { seasons: [2026] },
      sort: { metric: 'games_out_injury', dir: 'desc' }
    })
    expect(r.rows.map((x) => x.id)).toEqual(['3', '1', '2'])
  })

  it('lists a player out for the whole playoff run', async () => {
    const r = await run({ scope: { seasons: [2026], gameTypes: ['playoffs'] } })
    expect(ids(r)).toEqual(['1', '2'])
    // No roster row: the position of their regular-season line, the same player that season.
    expect(row(r, '2')).toMatchObject({
      name: 'Bea Laker',
      team: 'LAL',
      position: 'G',
      games: 0,
      noLine: true
    })
    expect(
      ids(await run({ scope: { seasons: [2026], gameTypes: ['playoffs'], positions: ['G'] } }))
    ).toEqual(['1', '2'])
    expect(row(r, '2').values.games_out_injury.value).toBe(1)
    expect(row(r, '1').values.games_out_injury.value).toBeFalsy()
  })

  it('counts the playoff run out for a player with a regular-season line, over both', async () => {
    // Player 2 has a line in the regular season, so one row: game b and game po2.
    const r = await run({ scope: { seasons: [2026], gameTypes: ['regular', 'playoffs'] } })
    expect(row(r, '2').noLine).toBeUndefined()
    expect(row(r, '2').games).toBe(2)
    expect(row(r, '2').values.games_out_injury.value).toBe(2)
  })

  it('holds a position, team or player filter by what the table says of the player', async () => {
    const at = (scope: Partial<StatsQuery['scope']>): Promise<StatsResult> =>
      run({ scope: { seasons: [2026], ...scope } })
    expect(ids(await at({ positions: ['F'] }))).toEqual(['3'])
    expect(ids(await at({ positions: ['G'] }))).toEqual(['1', '2'])
    expect(ids(await at({ teams: [String(BOS)] }))).toEqual(['1', '3'])
    expect(ids(await at({ teams: [String(LAL)] }))).toEqual(['2'])
    expect(ids(await at({ players: ['3'] }))).toEqual(['3'])
  })

  it('has a row per season when grouped by season', async () => {
    const r = await run({ scope: { seasons: [2025, 2026] }, groupBy: ['season'] })
    expect(row(r, '3').group.season).toBe(2026)
    expect(row(r, '3').values.games_out_injury.value).toBe(3)
  })

  it('is listed only for the counts the query reads', async () => {
    const r = await run({ metrics: ['games_out_other'], scope: { seasons: [2026] } })
    expect(ids(r)).toEqual(['1', '2'])
  })

  it('is not added where games out have no answer: a range, the last games, a split', async () => {
    for (const scope of [
      { lastN: 3 },
      { dates: ['2025-11-01', '2025-11-05'] as [string, string] },
      { opponents: [String(LAL)] },
      { split: 'clutch' as const }
    ]) {
      const r = await run({ scope: { seasons: [2026], ...scope } })
      expect(r.columns[0].reason).not.toBeNull()
      expect(ids(r)).not.toContain('3')
    }
  })

  it('is not added for the stability measure, which reads only qualified rows', () => {
    const q: StatsQuery = {
      entity: 'player',
      metrics: ['games_out_injury'],
      scope: { seasons: [2026] },
      groupBy: ['season']
    }
    expect(compileQuery(q, CTX).adds).toEqual(['pub_player_availability'])
    expect(compileQuery(q, { ...CTX, internal: { unlimited: true } }).adds).toEqual([])
  })

  it('leaves a query that reads no availability metric exactly as it was, row for row', async () => {
    const q: StatsQuery = {
      entity: 'player',
      metrics: ['pts', 'min', 'ts_pct'],
      scope: { seasons: [2026], gameTypes: ['regular', 'playoffs'] },
      transform: 'percentile'
    }
    const plain = compileQuery(q, CTX)
    expect(plain.adds).toEqual([])
    expect(plain.sql).not.toMatch(/no_line|added/)
    const before = await runQuery(db, q, CTX)
    // The box-score players only, as they were.
    expect(ids(before)).toEqual(['1', '2'])
    // With games out read too, the rows with a line are the same rows with the same values.
    const after = await runQuery(db, { ...q, metrics: [...q.metrics, 'games_out_injury'] }, CTX)
    const strip = (r: StatsRow): StatsRow => ({
      ...r,
      values: Object.fromEntries(Object.entries(r.values).filter(([k]) => q.metrics.includes(k)))
    })
    expect(after.rows.filter((r) => !r.noLine).map(strip)).toEqual(before.rows)
  })
})
