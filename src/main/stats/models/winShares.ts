import {
  div,
  leaguePace,
  leaguePpp,
  possessions,
  teamPace,
  type Box,
  type LeagueSeason,
  type TeamSeason
} from './box'
import type { OliverDefense, OliverOffense } from './oliver'

/**
 * Win Shares, as Basketball-Reference documents them in "Calculating Win Shares" (reference section
 * 14.2): marginal points over a baseline, divided by the points a win costs that season.
 */

/** Marginal points per win: `0.32 × league points per team-game × team pace / league pace`. */
export const marginalPointsPerWin = (ts: TeamSeason, l: LeagueSeason): number =>
  0.32 * div(l.totals.pts, l.teamGames) * div(teamPace(ts), leaguePace(l))

export interface WinShares {
  ows: number
  dws: number
  ws: number
  /** The points a win cost: the divisor of both halves. */
  mppw: number
}

/**
 * Offense: points produced above 0.92 of the league's points per possession on the possessions used.
 * Defense: the player's minutes' share of the team's defensive possessions, at 1.08 of the league's
 * points per possession less the individual defensive rating.
 */
export function winShares(
  p: Box,
  off: OliverOffense,
  def: OliverDefense,
  ts: TeamSeason,
  l: LeagueSeason
): WinShares {
  const ppp = leaguePpp(l)
  const mppw = marginalPointsPerWin(ts, l)
  const marginalOffense = off.pprod - 0.92 * ppp * off.totPoss
  const marginalDefense = div(p.mp, ts.team.mp) * possessions(ts) * (1.08 * ppp - def.drtg / 100)
  const ows = div(marginalOffense, mppw)
  const dws = div(marginalDefense, mppw)
  return { ows, dws, ws: ows + dws, mppw }
}

/** Win Shares per 48 minutes. */
export const wsPer48 = (ws: number, mp: number): number => div(48 * ws, mp)
