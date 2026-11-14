import { describe, expect, it } from 'vitest'
import {
  leagueOf,
  leaguePace,
  leaguePpp,
  possessions,
  teamPace,
  type Box,
  type TeamSeason
} from '../../../../src/main/stats/models/box'
import {
  blend,
  BPM,
  bpmForTeam,
  centerOnTeam,
  positionEstimate,
  rawBpm,
  roleEstimate,
  teamRatings,
  vorp
} from '../../../../src/main/stats/models/bpm'
import { seasonComposites } from '../../../../src/main/stats/models/composites'
import {
  floorPct,
  offensiveRating,
  oliverDefense,
  oliverOffense
} from '../../../../src/main/stats/models/oliver'
import { aPer, leagueMeanAPer, perLeague, perOf, uPer } from '../../../../src/main/stats/models/per'
import {
  marginalPointsPerWin,
  winShares,
  wsPer48
} from '../../../../src/main/stats/models/winShares'
import { CLE_2017, CLE_ID, TEAMS_2017 } from '../../../fixtures/composites'

/**
 * Worked values: LeBron James's 2016-17 regular season with Cleveland, from the box-score inputs in
 * `tests/fixtures/composites.ts`, worked through each published formula by a separate script written
 * from Basketball-Reference's pages (not from this code). His line: 2,794.58 minutes, 736 of 1,344,
 * 124 of 342 threes, 358 of 531 free throws, 97 offensive and 542 defensive rebounds, 646 assists,
 * 92 steals, 44 blocks, 303 turnovers, 134 fouls, 1,954 points. Cleveland: 19,880 minutes, 3,275 of
 * 6,963, 1,067 threes, 1,431 of 1,913, 766 and 2,821 rebounds, 1,858 assists, 539 steals, 327
 * blocks, 1,121 turnovers (1,081 by players, 40 by the team), 1,486 fouls, 9,048 points; its
 * opponents 8,787 points. Basketball-Reference publishes for this season: PER 27.0, OWS 9.8, DWS
 * 3.0, WS 12.9, WS/48 .221, BPM 7.6, VORP 6.7, ORtg 119, DRtg 108 (checked in the PR, not here).
 */
const teams = new Map<number, TeamSeason>(TEAMS_2017.map(([id, , t]) => [id, t]))
const cle = teams.get(CLE_ID) as TeamSeason
const league = leagueOf([...teams.values()])
const lebron = CLE_2017[0].box

describe('possessions and pace', () => {
  it("are Basketball-Reference's, from season totals", () => {
    expect(possessions(cle)).toBeCloseTo(7966.716997, 5)
    expect(teamPace(cle)).toBeCloseTo(96.17767, 5)
    expect(league.poss).toBeCloseTo(238736.089424, 4)
    expect(leaguePace(league)).toBeCloseTo(96.394114, 5)
    expect(leaguePpp(league)).toBeCloseTo(1.0880340741, 9)
    expect(league.teamGames).toBe(2460)
  })
})

describe("Oliver's offense", () => {
  const off = oliverOffense(lebron, cle)
  it('works LeBron James 2016-17 term by term', () => {
    expect(off.qAst).toBeCloseTo(0.4217535387, 9)
    expect(off.scPoss).toBeCloseTo(974.42661984, 6)
    expect(off.fgxPoss).toBeCloseTo(465.21233238, 6)
    expect(off.ftxPoss).toBeCloseTo(22.54538606, 6)
    expect(off.totPoss).toBeCloseTo(1765.18433828, 6)
    expect(off.pprod).toBeCloseTo(2098.84641026, 6)
    expect(offensiveRating(off)).toBeCloseTo(118.9023925, 6)
    expect(floorPct(off)).toBeCloseTo(0.5520254167, 9)
  })
  it('counts nothing for a player with no shots', () => {
    const empty: Box = { ...lebron, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, pts: 0 }
    const o = oliverOffense({ ...empty, ast: 0, oreb: 0, tov: 0 }, cle)
    expect(o.totPoss).toBe(0)
    expect(o.pprod).toBe(0)
    expect(offensiveRating(o)).toBe(0)
  })
})

describe("Oliver's defense", () => {
  const def = oliverDefense(lebron, cle)
  it('works LeBron James 2016-17 term by term', () => {
    expect(def.stops).toBeCloseTo(610.7500537, 6)
    expect(def.stopPct).toBeCloseTo(0.5453602054, 9)
    expect(def.teamDrtg).toBeCloseTo(110.2963743, 6)
    expect(def.drtg).toBeCloseTo(108.4300418, 6)
    expect(def.stops / def.dPoss).toBeCloseTo(def.stopPct, 12)
  })
})

describe('PER', () => {
  const lg = perLeague(league)
  it("has the league's constants", () => {
    expect(lg.factor).toBeCloseTo(0.6004929826, 9)
    expect(lg.vop).toBeCloseTo(1.0623227608, 9)
    expect(lg.drbPct).toBeCloseTo(0.7670512401, 9)
  })
  it('works uPER and aPER for LeBron James 2016-17', () => {
    const u = uPer(lebron, cle, lg)
    expect(u).toBeCloseTo(0.5409831089, 9)
    expect(aPer(u, cle, league)).toBeCloseTo(0.5422005708, 9)
  })
  it("scales to the league's minutes-weighted mean of 15", () => {
    const mean = leagueMeanAPer([
      { aPer: 0.6, mp: 1000 },
      { aPer: 0.3, mp: 2000 }
    ])
    expect(mean).toBeCloseTo(0.4, 12)
    expect(perOf(0.6, mean)).toBeCloseTo(22.5, 12)
    expect(perOf(0.3, mean)).toBeCloseTo(11.25, 12)
    // Weighted by minutes, the two read 15.
    expect((22.5 * 1000 + 11.25 * 2000) / 3000).toBeCloseTo(15, 12)
  })
})

describe('Win Shares', () => {
  const off = oliverOffense(lebron, cle)
  const def = oliverDefense(lebron, cle)
  const ws = winShares(lebron, off, def, cle, league)
  it('works LeBron James 2016-17', () => {
    expect(marginalPointsPerWin(cle, league)).toBeCloseTo(33.713137995, 8)
    expect(ws.ows).toBeCloseTo(9.845187352, 8)
    expect(ws.dws).toBeCloseTo(3.015461315, 8)
    expect(ws.ws).toBeCloseTo(12.860648667, 8)
    expect(wsPer48(ws.ws, lebron.mp)).toBeCloseTo(0.2208955933, 9)
  })
})

describe('BPM 2.0', () => {
  it("estimates LeBron James's position and role before blending", () => {
    expect(positionEstimate(lebron, cle)).toBeCloseTo(2.42047247, 7)
    expect(roleEstimate(lebron, cle)).toBeCloseTo(-0.33298437, 7)
    // 50 minutes of the listed position: a forward, 3.5; of role 4.
    expect(blend(positionEstimate(lebron, cle), lebron.mp, 3.5)).toBeCloseTo(2.43944761, 7)
    expect(blend(roleEstimate(lebron, cle), lebron.mp, 4)).toBeCloseTo(-0.25682235, 7)
  })
  it('works raw BPM at a given position and role', () => {
    expect(rawBpm(lebron, cle, 2, 1, BPM)).toBeCloseTo(15.1372267, 6)
  })
  it('centers a team on 3 by minutes, within 1 to 5', () => {
    const out = centerOnTeam([0.2, 3, 6], [100, 100, 100])
    expect(out.every((x) => x >= 1 && x <= 5)).toBe(true)
    expect((out[0] + out[1] + out[2]) / 3).toBeCloseTo(3, 9)
    expect(centerOnTeam([2, 4], [300, 300])).toEqual([2, 4])
  })
  it("makes Cleveland's players add up to its rating", () => {
    const players = CLE_2017.map((l) => ({
      box: l.box,
      listed: { G: 1.5, F: 3.5, C: 5 }[l.position] ?? null
    }))
    const lead = (0.5 * (cle.team.pts - cle.opp.pts)) / cle.games
    const ratings = teamRatings(cle, league, lead)
    // 261 points over 7,966.7 possessions, plus half the lead effect on an average lead of 1.59.
    expect(ratings.rating).toBeCloseTo((100 * 261) / 7966.716997 + 0.175 * lead, 6)
    const out = bpmForTeam(players, cle, ratings)
    const sum = (f: (r: (typeof out)[number]) => number): number =>
      out.reduce((s, r) => s + f(r) * r.share, 0)
    expect(sum((r) => r.bpm)).toBeCloseTo(ratings.rating, 9)
    expect(sum((r) => r.obpm)).toBeCloseTo(ratings.offense, 9)
    const minutes = out.reduce((s, r, i) => s + r.position * players[i].box.mp, 0)
    expect(minutes / players.reduce((s, p) => s + p.box.mp, 0)).toBeCloseTo(3, 6)
    // LeBron James: position about 2.3 and role 1, as Basketball-Reference's worked example has.
    expect(out[0].position).toBeCloseTo(2.32, 2)
    expect(out[0].role).toBe(1)
    expect(out[0].bpm).toBeCloseTo(7.7, 1)
    expect(out[0].dbpm).toBeCloseTo(out[0].bpm - out[0].obpm, 12)
    expect(out[0].vorp).toBeCloseTo(vorp(out[0].bpm, out[0].share, 82), 12)
  })
  it('adds the strength of the opponents to the rating, half of it to the offense', () => {
    const base = teamRatings(cle, league, 1.5)
    const hard = teamRatings(cle, league, 1.5, 0.5)
    // Half a point a game over 82 games and 7,966.7 possessions.
    expect(hard.rating - base.rating).toBeCloseTo((100 * 0.5 * 82) / 7966.716997, 6)
    expect(hard.offense - base.offense).toBeCloseTo((hard.rating - base.rating) / 2, 12)
  })
  it('defines VORP from BPM, the share of the floor time and the games', () => {
    expect(vorp(7.6, 0.702863003, 82)).toBeCloseTo(6.747484829, 8)
    expect(vorp(-2, 0.5, 82)).toBe(0)
    expect(vorp(3, 0.5, 41)).toBeCloseTo(1.25, 12)
  })
})

describe('a season', () => {
  const lines = CLE_2017.map((l, i) => ({
    playerId: i + 1,
    teamId: CLE_ID,
    box: l.box,
    listed: null
  }))
  it("adds a team's players up to the team, and reads PER 15 across the league's lines", () => {
    const { players, teams: rows } = seasonComposites(lines, teams)
    const team = rows.find((t) => t.teamId === CLE_ID)
    const stints = players.filter((p) => p.teamId !== null)
    expect(team?.ws).toBeCloseTo(
      stints.reduce((s, p) => s + p.ws, 0),
      9
    )
    const per =
      stints.reduce((s, p) => s + p.per_num, 0) / stints.reduce((s, p) => s + p.cmp_minutes, 0)
    expect(per).toBeCloseTo(15, 9)
  })
  it("builds a traded player's season from each stint with its own team", () => {
    const half = (b: Box): Box =>
      Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v / 2])) as unknown as Box
    const traded = [
      { playerId: 99, teamId: CLE_ID, box: half(lebron), listed: null },
      { playerId: 99, teamId: 1610612744, box: half(lebron), listed: null }
    ]
    const { players } = seasonComposites([...lines.slice(1), ...traded], teams)
    const rows = players.filter((p) => p.playerId === 99)
    expect(rows).toHaveLength(3)
    const total = rows.find((r) => r.teamId === null)
    const parts = rows.filter((r) => r.teamId !== null)
    for (const c of ['ws', 'vorp', 'pprod', 'tot_poss', 'per_num', 'cmp_minutes'] as const) {
      expect(total?.[c]).toBeCloseTo(parts[0][c] + parts[1][c], 9)
    }
    // With Golden State's pace and teammates the same line is worth a different amount.
    expect(parts[0].ws).not.toBeCloseTo(parts[1].ws, 3)
  })
})
