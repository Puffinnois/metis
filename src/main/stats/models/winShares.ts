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

/**
 * The method's three constants: the share of the league's points per possession a player's offense is
 * measured above and its defense below, and the share of the league's points per team-game a marginal
 * win costs. Basketball-Reference's for the NBA (and the WNBA); Sports Reference's college pages use
 * 0.875, 1.125 and 0.5 against the division's totals ("Calculating Win Shares", college basketball),
 * which the college leagues' registry entries carry (`LeagueModels.winShares`, T1302.8).
 */
export interface WinSharesConstants {
  offense: number
  defense: number
  perWin: number
}

export const BREF_WIN_SHARES: WinSharesConstants = { offense: 0.92, defense: 1.08, perWin: 0.32 }

/** Marginal points per win: `0.32 × league points per team-game × team pace / league pace`. */
export const marginalPointsPerWin = (
  ts: TeamSeason,
  l: LeagueSeason,
  perWin: number = BREF_WIN_SHARES.perWin
): number => perWin * div(l.totals.pts, l.teamGames) * div(teamPace(ts), leaguePace(l))

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
  l: LeagueSeason,
  k: WinSharesConstants = BREF_WIN_SHARES
): WinShares {
  const ppp = leaguePpp(l)
  const mppw = marginalPointsPerWin(ts, l, k.perWin)
  const marginalOffense = off.pprod - k.offense * ppp * off.totPoss
  const marginalDefense =
    div(p.mp, ts.team.mp) * possessions(ts) * (k.defense * ppp - def.drtg / 100)
  const ows = div(marginalOffense, mppw)
  const dws = div(marginalDefense, mppw)
  return { ows, dws, ws: ows + dws, mppw }
}

/** Win Shares per 48 minutes. */
export const wsPer48 = (ws: number, mp: number): number => div(48 * ws, mp)
