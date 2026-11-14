import { div, leaguePace, reb, teamPace, type Box, type LeagueSeason, type TeamSeason } from './box'

/**
 * John Hollinger's Player Efficiency Rating, as Basketball-Reference documents it in "Calculating
 * PER" (reference section 14.1). Every count it needs is in the box scores from 1993-94, so none of
 * the method's estimates for statistics not yet recorded applies.
 */

/** The league's constants of a season: `factor`, `VOP` (value of a possession) and `DRB%`. */
export interface PerLeague {
  factor: number
  vop: number
  drbPct: number
  /** Free throws made per foul, and free-throw attempts per foul. */
  ftPerPf: number
  ftaPerPf: number
}

export function perLeague(l: LeagueSeason): PerLeague {
  const t = l.totals
  return {
    factor: 2 / 3 - div(0.5 * div(t.ast, t.fgm), 2 * div(t.fgm, t.ftm)),
    vop: div(t.pts, t.fga - t.oreb + t.tov + 0.44 * t.fta),
    drbPct: div(reb(t) - t.oreb, reb(t)),
    ftPerPf: div(t.ftm, t.pf),
    ftaPerPf: div(t.fta, t.pf)
  }
}

/** Unadjusted PER: the player's production per minute, each count valued against the league. */
export function uPer(p: Box, ts: TeamSeason, lg: PerLeague): number {
  const a = div(ts.team.ast, ts.team.fgm)
  const { factor, vop, drbPct } = lg
  const sum =
    p.fg3m +
    (2 / 3) * p.ast +
    (2 - factor * a) * p.fgm +
    p.ftm * 0.5 * (1 + (1 - a) + (2 / 3) * a) -
    vop * p.tov -
    vop * drbPct * (p.fga - p.fgm) -
    vop * 0.44 * (0.44 + 0.56 * drbPct) * (p.fta - p.ftm) +
    vop * (1 - drbPct) * p.dreb +
    vop * drbPct * p.oreb +
    vop * p.stl +
    vop * drbPct * p.blk -
    p.pf * (lg.ftPerPf - 0.44 * lg.ftaPerPf * vop)
  return div(sum, p.mp)
}

/** Adjusted PER: uPER scaled from the team's pace to the league's. */
export const aPer = (u: number, ts: TeamSeason, l: LeagueSeason): number =>
  u * div(leaguePace(l), teamPace(ts))

/**
 * PER from aPER: scaled so the league's minutes-weighted mean of aPER reads 15. `leagueAPer` is that
 * mean over every player's line of the season (`leagueMeanAPer`).
 */
export const perOf = (a: number, leagueAPer: number): number => 15 * div(a, leagueAPer)

/** The minutes-weighted mean of aPER over the league's lines. */
export function leagueMeanAPer(lines: readonly { aPer: number; mp: number }[]): number {
  let num = 0
  let den = 0
  for (const l of lines) {
    num += l.aPer * l.mp
    den += l.mp
  }
  return div(num, den)
}
