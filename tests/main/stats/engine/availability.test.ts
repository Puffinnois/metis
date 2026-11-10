import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { buildPublished } from '@main/stats/derived/published'
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

const INJURY = 'Injury/Illness - Left Ankle; Sprain'

/**
 * Player 1 plays three regular-season games and one playoff game for Boston, and the reports list
 * them out of two more: three times for one (an injury) and once for the other (a G League
 * assignment), and questionable for a game they then played. Player 2 plays two games for Los Angeles
 * and is listed out of a playoff game they have no line in, and out of a game they did play.
 */
beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Boston'), (2, 'Bea Laker')`)
  await db.exec(`INSERT INTO src_nba_rosters VALUES (1, 2026, 'G'), (2, 2026, 'G')`)
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
    game_id VARCHAR, person_id BIGINT)`)
  const at = (hour: number): string =>
    `TIMESTAMP '2025-11-01 ${String(hour).padStart(2, '0')}:00:00'`
  await db.exec(`INSERT INTO src_nba_injury_report VALUES
    (2026, ${at(10)}, DATE '2025-11-07', ${BOS}, 'Out', '${INJURY}', NULL, 'e', 1),
    (2026, ${at(14)}, DATE '2025-11-07', ${BOS}, 'Out', '${INJURY}', NULL, 'e', 1),
    (2026, ${at(18)}, DATE '2025-11-07', ${BOS}, 'Out', '${INJURY}', NULL, 'e', 1),
    (2026, ${at(10)}, DATE '2025-11-09', ${BOS}, 'Out', 'G League - On Assignment', NULL, 'f', 1),
    (2026, ${at(10)}, DATE '2025-11-05', ${BOS}, 'Out', '${INJURY}', NULL, 'c', 1),
    (2026, ${at(18)}, DATE '2025-11-05', ${BOS}, 'Questionable', '${INJURY}', NULL, 'c', 1),
    (2026, ${at(10)}, DATE '2026-04-22', ${LAL}, 'Out', '${INJURY}', NULL, 'po2', 2),
    (2026, ${at(10)}, DATE '2025-11-03', ${LAL}, 'Out', '${INJURY}', NULL, 'b', 2)`)
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

  it('reads the playoffs apart, and a player with no box-score line there is not listed', async () => {
    const r = await run({ scope: { seasons: [2026], gameTypes: ['playoffs'] } })
    expect(r.rows.map((x) => x.id)).toEqual(['1'])
    expect(row(r, '1').values.games_out_injury.value).toBeFalsy()
  })

  it('answers a season before the reports with the reason, not a number', async () => {
    const r = await run({ scope: { seasons: [2019] } })
    expect(r.columns.map((c) => c.reason)).toEqual([
      'Recorded from 2019-20.',
      'Recorded from 2019-20.'
    ])
  })

  it('answers a range that splits a season with its reason', async () => {
    const r = await run({ scope: { seasons: [2026], lastN: 3 } })
    expect(r.columns[0].reason).toBe('Published for whole seasons only.')
  })

  it('stays a total under per game, since the table publishes no games to divide by', async () => {
    const r = await run({ scope: { seasons: [2026] }, transform: 'perGame' })
    expect(r.columns[0].reason).toBeNull()
    expect(row(r, '1').values.games_out_injury.value).toBe(1)
  })
})
