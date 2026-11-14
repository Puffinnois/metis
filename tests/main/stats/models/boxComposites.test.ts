import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { grainsOf } from '@main/stats/engine/registry'
import { runQuery } from '@main/stats/engine/run'
import { buildModels } from '@main/stats/models/build'
import { COMPOSITE_TYPES_REASON } from '@main/stats/models/boxComposites'
import { METRICS } from '@shared/stats/catalogue'
import type { StatsQuery, StatsResult } from '@shared/stats/types'
import { addNbaLine, BOS, emptySources, LAL, MIA } from '../../../fixtures/boxScores'
import { addLeague } from '../../../fixtures/models'
import { openTestDb } from '../../../fixtures/stats'

/**
 * The composites' builder through the models step, and their read through the engine (Plan T1005).
 * The league of `tests/fixtures/models.ts`: player 1 plays for Boston on Nov 1 and Miami on Nov 2,
 * player 2 for the Lakers in both, player 3 for Boston and Miami on Nov 3, and player 4 for the
 * Lakers in the playoff game.
 */
let db: StatsDb
const CTX = { currentSeason: 2027 }

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await addLeague(db)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(
    `INSERT INTO player VALUES (1, 'Ana Traded'), (2, 'Bea Laker'), (3, 'Cy'), (4, 'Di')`
  )
  await addNbaLine(db, 'a', 1, BOS)
  await addNbaLine(db, 'b', 1, MIA)
  await addNbaLine(db, 'a', 2, LAL)
  await addNbaLine(db, 'b', 2, LAL)
  await addNbaLine(db, 'c', 3, BOS)
  await addNbaLine(db, 'c', 3, MIA)
  await addNbaLine(db, 'po', 4, LAL)
  await addNbaLine(db, 'po', 4, MIA)
  await buildDerived(db)
  await buildModels(db, 2026)
})

const player = (
  q: Partial<StatsQuery> & { scope: StatsQuery['scope'] },
  metrics: string[]
): Promise<StatsResult> => runQuery(db, { entity: 'player', metrics, ...q }, CTX)

describe('the box-score composites builder', () => {
  it("writes a row per player, team and season type, a traded player's teams apart", async () => {
    const rows = await db.all<{ player_id: number; team_id: number; game_type: string }>(
      `SELECT player_id, team_id, game_type FROM player_composite
       WHERE season = 2026 ORDER BY game_type, player_id, team_id`
    )
    expect(rows.map((r) => [r.game_type, r.player_id, r.team_id])).toEqual([
      ['playoffs', 4, LAL],
      ['playoffs', 4, MIA],
      ['regular', 1, BOS],
      ['regular', 1, MIA],
      ['regular', 2, LAL],
      ['regular', 3, BOS],
      ['regular', 3, MIA]
    ])
  })

  it("adds a team's players up to the team, and reads PER 15 across the league", async () => {
    const check = await db.get<{ ws: number; players: number; per: number }>(
      `SELECT (SELECT sum(ws) FROM team_composite WHERE season = 2026 AND game_type = 'regular') AS ws,
              sum(ws) AS players, sum(per_num) / sum(cmp_minutes) AS per
       FROM player_composite WHERE season = 2026 AND game_type = 'regular'`
    )
    expect(check?.ws).toBeCloseTo(check?.players ?? NaN, 9)
    expect(check?.per).toBeCloseTo(15, 9)
  })
})

describe('the composites through the engine', () => {
  it('read whole seasons only, a traded player’s teams added once', async () => {
    expect(grainsOf(METRICS.get('ws')!)).toEqual(['season'])
    const season = await player({ scope: { seasons: [2026] } }, ['ws', 'per', 'vorp'])
    const stints = await db.get<{ ws: number }>(
      `SELECT sum(ws) AS ws FROM player_composite
       WHERE season = 2026 AND game_type = 'regular' AND player_id = 1`
    )
    expect(season.rows.find((r) => r.id === '1')!.values.ws.value).toBeCloseTo(stints!.ws, 9)
    const range = await player(
      { scope: { seasons: [2026], dates: ['2025-11-01', '2025-11-02'] } },
      ['ws']
    )
    expect(range.columns[0].reason).toBe('Computed for whole seasons only.')
  })

  it('read the playoffs apart, and nothing for the play-in', async () => {
    const playoffs = await player({ scope: { seasons: [2026], gameTypes: ['playoffs'] } }, ['bpm'])
    expect(playoffs.rows.map((r) => r.id)).toEqual(['4'])
    expect(playoffs.rows[0].values.bpm.value).not.toBeNull()
    const playIn = await player({ scope: { seasons: [2026], gameTypes: ['play-in'] } }, ['bpm'])
    expect(playIn.columns[0].reason).toBe(COMPOSITE_TYPES_REASON)
  })
})
