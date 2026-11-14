import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { runQuery } from '@main/stats/engine/run'
import { readGame } from '@main/stats/reads'
import { buildModels, markModelSeason, planModels } from '@main/stats/models/build'
import { ELO, eloShift, regress, winProbability } from '@main/stats/models/elo'
import { ELO_GAME_TABLE, ELO_WINS_TABLE, TEAM_ELO } from '@main/stats/models/teamElo'
import type { StatsResult } from '@shared/stats/types'
import { BOS, emptySources, LAL, MIA } from '../../../fixtures/boxScores'
import { addLeague } from '../../../fixtures/models'
import { openTestDb } from '../../../fixtures/stats'

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await addLeague(db)
  await buildDerived(db)
})

/**
 * The fixture league (`tests/fixtures/models.ts`) by hand, game by game in date order.
 * 2024-25: Boston and the Lakers at 1500; Boston by 6 at home.
 * 2025-26: both carried a quarter of the way to 1505; Miami is new, at 1300. Boston by 10 over the
 * Lakers, the Lakers by 4 over Miami, Miami by 2 over Boston (each at home), the Lakers by 50 over
 * Boston in the Cup final (a neutral site), the Lakers by 50 over Miami in the playoffs. The All-Star
 * game never counts. Miami at Boston on Mar 1 is still to come.
 */
function byHand(): Record<string, number> {
  const s0 = eloShift(ELO.homeCourt, 6)
  let bos = regress(1500 + s0)
  let lal = regress(1500 - s0)
  let mia: number = ELO.newTeam
  const play = (
    home: number,
    away: number,
    margin: number,
    court: number = ELO.homeCourt
  ): [number, number] => {
    const s = eloShift(home + court - away, margin)
    return [home + s, away - s]
  }
  ;[bos, lal] = play(bos, lal, 10)
  ;[lal, mia] = play(lal, mia, 4)
  ;[mia, bos] = play(mia, bos, 2)
  ;[lal, bos] = play(lal, bos, 50, 0)
  ;[lal, mia] = play(lal, mia, 50)
  return { s0, bos, lal, mia }
}

const last = async (team: number, season = 2026): Promise<number> =>
  (await db.get<{ elo: number }>(
    `SELECT elo FROM ${ELO_GAME_TABLE} WHERE team_id = ? AND season = ? AND played
       ORDER BY game_date DESC LIMIT 1`,
    [team, season]
  ))!.elo

describe('the Elo builder', () => {
  it('rates every played game of the types it counts, in order, carried from the season before', async () => {
    await buildModels(db, 2026)
    const h = byHand()
    expect(await last(BOS, 2025)).toBeCloseTo(1500 + h.s0, 9)
    expect(await last(BOS)).toBeCloseTo(h.bos, 9)
    expect(await last(LAL)).toBeCloseTo(h.lal, 9)
    expect(await last(MIA)).toBeCloseTo(h.mia, 9)
    const types = await db.all<{ game_id: string; n: number }>(
      `SELECT game_id, count(*)::INTEGER AS n FROM ${ELO_GAME_TABLE} WHERE season = 2026
       GROUP BY 1 ORDER BY 1`
    )
    // Two rows a game, the All-Star game left out.
    expect(types).toEqual(
      ['a', 'b', 'c', 'cup', 'later', 'po'].map((game_id) => ({ game_id, n: 2 }))
    )
    // The ratings move no points in or out: the season's sum stays what it started at.
    const sum = h.bos + h.lal + h.mia
    expect(sum).toBeCloseTo(regress(1500 + h.s0) + regress(1500 - h.s0) + ELO.newTeam, 9)
  })

  it('holds both sides of a game, with no home court at a neutral site', async () => {
    await buildModels(db, 2026)
    const cup = await db.all<Record<string, unknown>>(
      `SELECT team_id, home, neutral, home_court, win_prob, exp_margin, elo_pre, opp_elo_pre, elo, opp_elo
       FROM ${ELO_GAME_TABLE} WHERE game_id = 'cup' ORDER BY home DESC`
    )
    expect(cup.map((r) => [Number(r.team_id), r.home, r.neutral, r.home_court])).toEqual([
      [LAL, true, true, 0],
      [BOS, false, true, 0]
    ])
    const [lal, bos] = cup as Record<string, number>[]
    expect(lal.win_prob).toBeCloseTo(winProbability(lal.elo_pre - lal.opp_elo_pre), 12)
    expect(lal.win_prob + bos.win_prob).toBeCloseTo(1, 12)
    expect(lal.exp_margin).toBeCloseTo((lal.elo_pre - lal.opp_elo_pre) / 28, 12)
    expect(bos.elo_pre).toBe(lal.opp_elo_pre)
    expect(bos.elo).toBe(lal.opp_elo)
    const home = (await db.get<Record<string, number>>(
      `SELECT home_court FROM ${ELO_GAME_TABLE} WHERE game_id = 'a' AND team_id = ${LAL}`
    ))!
    expect(home.home_court).toBe(-ELO.homeCourt)
  })

  it('rates the games still to come with the latest ratings, in the season in progress only', async () => {
    await buildModels(db, 2026)
    const h = byHand()
    const later = (await db.get<Record<string, unknown>>(
      `SELECT played, elo_pre, opp_elo_pre, win_prob, elo FROM ${ELO_GAME_TABLE}
       WHERE game_id = 'later' AND team_id = ${BOS}`
    ))!
    expect(later.played).toBe(false)
    expect(later.elo).toBeNull()
    expect(later.elo_pre).toBeCloseTo(h.bos, 9)
    expect(later.opp_elo_pre).toBeCloseTo(h.mia, 9)
    expect(later.win_prob).toBeCloseTo(winProbability(h.bos + ELO.homeCourt - h.mia), 9)
    await buildModels(db, 2027)
    await markModelSeason(db, 0)
    await buildModels(db, 2027)
    expect(
      await db.get(`SELECT count(*)::INTEGER AS n FROM ${ELO_GAME_TABLE} WHERE game_id = 'later'`)
    ).toEqual({ n: 0 })
  })

  it('adds expected wins over the games played', async () => {
    await buildModels(db, 2026)
    const rows = await db.all<{ team_id: number; w: number; n: number }>(
      `SELECT team_id, sum(elo_exp_wins) AS w, count(*)::INTEGER AS n FROM ${ELO_WINS_TABLE}
       WHERE season = 2026 GROUP BY 1`
    )
    // Five games played, two sides each; every game's two probabilities add to one.
    expect(rows.reduce((s, r) => s + r.n, 0)).toBe(10)
    expect(rows.reduce((s, r) => s + r.w, 0)).toBeCloseTo(5, 12)
  })

  it('recomputes from the earliest season changed on', async () => {
    await buildModels(db, 2026)
    await markModelSeason(db, 2025)
    const plan = (await planModels(db)).find((p) => p.builder === TEAM_ELO)!
    expect(plan.seasons).toEqual([2025, 2026])
    await markModelSeason(db, 2026)
    await buildModels(db, 2026)
    await markModelSeason(db, 2026)
    expect((await planModels(db)).find((p) => p.builder === TEAM_ELO)!.seasons).toEqual([2026])
    // A change in 2024-25's scores reaches 2025-26's ratings.
    await db.exec("UPDATE game SET home_score = 130 WHERE game_id = 'old'")
    await markModelSeason(db, 2025)
    await buildModels(db, 2026)
    const s0 = eloShift(ELO.homeCourt, 30)
    expect(await last(BOS, 2025)).toBeCloseTo(1500 + s0, 9)
    expect(await last(BOS)).not.toBeCloseTo(byHand().bos, 3)
  })

  it('reads through the engine: Elo as of the last game in scope, expected wins added', async () => {
    await buildModels(db, 2026)
    const h = byHand()
    const r: StatsResult = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_elo', 'team_elo_exp_w', 'team_elo_w_over'],
        scope: { seasons: [2026], gameTypes: ['regular', 'playoffs', 'cup-final'] }
      },
      { currentSeason: 2027 }
    )
    const of = (team: number, id: string): number | null =>
      r.rows.find((x) => x.id === String(team))!.values[id].value
    expect(of(LAL, 'team_elo')).toBeCloseTo(h.lal, 9)
    expect(of(MIA, 'team_elo')).toBeCloseTo(h.mia, 9)
    const w = await db.get<{ w: number }>(
      `SELECT sum(elo_exp_wins) AS w FROM ${ELO_WINS_TABLE} WHERE team_id = ${LAL} AND season = 2026`
    )
    expect(of(LAL, 'team_elo_exp_w')).toBeCloseTo(w!.w, 9)
    // The Lakers won three of their four.
    expect(of(LAL, 'team_elo_w_over')).toBeCloseTo(3 - w!.w, 9)
    // Regular season only: the Lakers' rating after Miami beat Boston is the one after their own last
    // regular-season game, Nov 2.
    const reg = await runQuery(
      db,
      { entity: 'team', metrics: ['team_elo'], scope: { seasons: [2026] } },
      { currentSeason: 2027 }
    )
    const lalReg = reg.rows.find((x) => x.id === String(LAL))!.values.team_elo.value
    const nov2 = await db.get<{ elo: number }>(
      `SELECT elo FROM ${ELO_GAME_TABLE} WHERE game_id = 'b' AND team_id = ${LAL}`
    )
    expect(lalReg).toBeCloseTo(nov2!.elo, 9)
  })

  it('gives a game page both sides, played or still to come', async () => {
    await buildModels(db, 2026)
    const h = byHand()
    const later = (await readGame(db, 'later'))?.elo
    expect(later).toMatchObject({ neutral: false, homeCourt: ELO.homeCourt })
    expect(later?.home.pre).toBeCloseTo(h.bos, 9)
    expect(later?.away.pre).toBeCloseTo(h.mia, 9)
    expect(later?.home.post).toBeNull()
    expect(later?.homeWin).toBeCloseTo(winProbability(h.bos + ELO.homeCourt - h.mia), 9)
    expect((await readGame(db, 'cup'))?.elo).toMatchObject({ neutral: true, homeCourt: 0 })
    // The All-Star game is not rated.
    expect((await readGame(db, 'star'))?.elo ?? null).toBeNull()
  })
})
