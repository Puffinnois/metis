import { div, possessions, reb, type Box, type TeamSeason } from './box'

/**
 * Dean Oliver's individual ratings ("Basketball on Paper"), term by term as Basketball-Reference
 * documents them in "Calculating Individual Offensive and Defensive Ratings". Reference section 5.
 * Every input is a season sum; a term whose denominator is zero contributes nothing.
 */

export interface OliverOffense {
  /** Share of the player's made field goals that were assisted, estimated. */
  qAst: number
  /** Possessions the player ended with a score, in part credited to assists and rebounds. */
  scPoss: number
  /** Possessions ended by a missed field goal the team did not rebound. */
  fgxPoss: number
  /** Possessions ended by missed free throws. */
  ftxPoss: number
  /** Every possession the player used: `ScPoss + FGxPoss + FTxPoss + TOV`. */
  totPoss: number
  /** Points produced: the points the player's scoring possessions are worth. */
  pprod: number
}

/** The team's scoring possessions: field goals made and free-throw trips with a point. */
const scoringPossessions = (t: Box): number =>
  t.fgm + (1 - (1 - div(t.ftm, t.fta)) ** 2) * t.fta * 0.4

export function oliverOffense(p: Box, ts: TeamSeason): OliverOffense {
  const t = ts.team
  const o = ts.opp
  const share = div(p.mp, t.mp / 5)
  const qAst =
    share * 1.14 * div(t.ast - p.ast, t.fgm) +
    div((t.ast / t.mp) * p.mp * 5 - p.ast, (t.fgm / t.mp) * p.mp * 5 - p.fgm) * (1 - share)
  // How much of a make the shooter keeps once the passer's share is taken.
  const kept = 1 - 0.5 * div(p.pts - p.ftm, 2 * p.fga) * qAst
  const fgPart = p.fgm * kept
  const passedTo = div(t.pts - t.ftm - (p.pts - p.ftm), 2 * (t.fga - p.fga))
  const astPart = 0.5 * passedTo * p.ast
  const ftPart = (1 - (1 - div(p.ftm, p.fta)) ** 2) * 0.4 * p.fta
  const teamScPoss = scoringPossessions(t)
  const teamOrbPct = div(t.oreb, t.oreb + (reb(o) - o.oreb))
  const teamPlayPct = div(teamScPoss, t.fga + t.fta * 0.4 + t.tov)
  const orbWeight = div(
    (1 - teamOrbPct) * teamPlayPct,
    (1 - teamOrbPct) * teamPlayPct + teamOrbPct * (1 - teamPlayPct)
  )
  const orbPart = p.oreb * orbWeight * teamPlayPct
  // The team's offensive rebounds already earned part of each scoring possession.
  const reboundCut = 1 - div(t.oreb, teamScPoss) * orbWeight * teamPlayPct
  const scPoss = (fgPart + astPart + ftPart) * reboundCut + orbPart
  const fgxPoss = (p.fga - p.fgm) * (1 - 1.07 * teamOrbPct)
  const ftxPoss = (1 - div(p.ftm, p.fta)) ** 2 * 0.4 * p.fta
  const totPoss = scPoss + fgxPoss + ftxPoss + p.tov

  const pprodFg = 2 * (p.fgm + 0.5 * p.fg3m) * kept
  const pprodAst =
    2 * div(t.fgm - p.fgm + 0.5 * (t.fg3m - p.fg3m), t.fgm - p.fgm) * 0.5 * passedTo * p.ast
  const pprodOrb = p.oreb * orbWeight * teamPlayPct * div(t.pts, teamScPoss)
  const pprod = (pprodFg + pprodAst + p.ftm) * reboundCut + pprodOrb
  return { qAst, scPoss, fgxPoss, ftxPoss, totPoss, pprod }
}

/** Individual offensive rating: points produced per 100 possessions used. */
export const offensiveRating = (o: OliverOffense): number => 100 * div(o.pprod, o.totPoss)

/** Floor percentage: the share of possessions used that scored. */
export const floorPct = (o: OliverOffense): number => div(o.scPoss, o.totPoss)

export interface OliverDefense {
  /** Stops credited to the player: steals, blocks and rebounds kept, then a share of the team's. */
  stops: number
  /** The team's defensive possessions while the player was on the floor: `Stop%`'s denominator. */
  dPoss: number
  /** `Stops / dPoss`. */
  stopPct: number
  /** Individual defensive rating: points allowed per 100 possessions, lower is better. */
  drtg: number
  /** The team's points allowed per 100 possessions. */
  teamDrtg: number
}

export function oliverDefense(p: Box, ts: TeamSeason): OliverDefense {
  const t = ts.team
  const o = ts.opp
  const teamPoss = possessions(ts)
  // Both sides play the same minutes; the opponents' are the team's.
  const oppMp = t.mp
  const dorPct = div(o.oreb, o.oreb + t.dreb)
  const dfgPct = div(o.fgm, o.fga)
  const fmWeight = div(dfgPct * (1 - dorPct), dfgPct * (1 - dorPct) + (1 - dfgPct) * dorPct)
  const stops1 = p.stl + p.blk * fmWeight * (1 - 1.07 * dorPct) + p.dreb * (1 - fmWeight)
  const stops2 =
    (div(o.fga - o.fgm - t.blk, t.mp) * fmWeight * (1 - 1.07 * dorPct) + div(o.tov - t.stl, t.mp)) *
      p.mp +
    div(p.pf, t.pf) * 0.4 * o.fta * (1 - div(o.ftm, o.fta)) ** 2
  const stops = stops1 + stops2
  const dPoss = div(teamPoss * p.mp, oppMp)
  const stopPct = div(stops, dPoss)
  const teamDrtg = 100 * div(o.pts, teamPoss)
  const ptsPerScPoss = div(o.pts, o.fgm + (1 - (1 - div(o.ftm, o.fta)) ** 2) * o.fta * 0.4)
  const drtg = teamDrtg + 0.2 * (100 * ptsPerScPoss * (1 - stopPct) - teamDrtg)
  return { stops, dPoss, stopPct, drtg, teamDrtg }
}
