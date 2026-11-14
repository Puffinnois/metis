/**
 * The season box scores the composites of reference sections 5 and 14 read (Plan T1005): a player's
 * line with one team, that team's line and its opponents', and the league's. Every value is a sum
 * over the same box-score games, so a player's share of the team is a ratio of like with like.
 */

/** One side's counts over a season. `mp` is minutes: for a team, every player's minutes summed. */
export interface Box {
  mp: number
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
  oreb: number
  dreb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
  pts: number
}

/** A team's season: its counts, its opponents' in the same games, and how many games. */
export interface TeamSeason {
  team: Box
  opp: Box
  games: number
}

/** The league's season: every team's counts summed, its team-games and its possessions. */
export interface LeagueSeason {
  totals: Box
  /** Team-games: each game counts twice, once per side. */
  teamGames: number
  /** Every team's possessions summed (`possessions` of each `TeamSeason`). */
  poss: number
}

/** `a / b`, 0 when `b` is 0: a term with nothing to divide by contributes nothing. */
export const div = (a: number, b: number): number => (b === 0 ? 0 : a / b)

export const reb = (b: Box): number => b.oreb + b.dreb

/** True shooting attempts: `FGA + 0.44 FTA`. */
export const tsa = (b: Box): number => b.fga + 0.44 * b.fta

/** One side's half of Basketball-Reference's possession estimate: `us` shooting, `them` defending. */
function half(us: Box, them: Box): number {
  return (
    us.fga + 0.4 * us.fta - 1.07 * div(us.oreb, us.oreb + them.dreb) * (us.fga - us.fgm) + us.tov
  )
}

/**
 * Basketball-Reference's possessions for a team's season (reference section 5): the mean of both
 * sides' estimates, from season totals as its team pages compute them. Both sides get the same count.
 */
export const possessions = (t: TeamSeason): number =>
  0.5 * (half(t.team, t.opp) + half(t.opp, t.team))

/** Possessions per 48 minutes: `48 × POSS / (team minutes / 5)`. */
export const teamPace = (t: TeamSeason): number => div(48 * possessions(t), t.team.mp / 5)

/** The league's pace, from every team's possessions and minutes. */
export const leaguePace = (l: LeagueSeason): number => div(48 * l.poss, l.totals.mp / 5)

/** League points per possession. */
export const leaguePpp = (l: LeagueSeason): number => div(l.totals.pts, l.poss)

/** A player's share of the team's time on the floor: 1 is every minute of every game. */
export const minuteShare = (p: Box, t: TeamSeason): number => div(p.mp, t.team.mp / 5)

/** Sums boxes: a league from its teams, a player's season from its stints. */
export function addBoxes(boxes: readonly Box[]): Box {
  const out: Box = {
    mp: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    pts: 0
  }
  for (const b of boxes) for (const k of Object.keys(out) as (keyof Box)[]) out[k] += b[k]
  return out
}

/** The league's season from its teams' seasons. */
export function leagueOf(teams: readonly TeamSeason[]): LeagueSeason {
  return {
    totals: addBoxes(teams.map((t) => t.team)),
    teamGames: teams.reduce((n, t) => n + t.games, 0),
    poss: teams.reduce((n, t) => n + possessions(t), 0)
  }
}
