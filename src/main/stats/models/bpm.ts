import {
  div,
  minuteShare,
  possessions,
  reb,
  tsa,
  type Box,
  type LeagueSeason,
  type TeamSeason
} from './box'

/**
 * Box Plus/Minus 2.0 and VORP, as Basketball-Reference documents them in "About Box Plus/Minus"
 * (Daniel Myers's method; reference section 14.2): a position and an offensive role estimated from
 * the box score, coefficients that slide with them, rates per 100 team possessions, and a team
 * adjustment that makes the team's players add up to its rating.
 */

/** A coefficient at position (or role) 1 and at 5; between them it slides in a straight line. */
type Pair = readonly [number, number]

export interface BpmCoefficients {
  pts: Pair
  fg3m: Pair
  ast: Pair
  tov: Pair
  orb: Pair
  drb: Pair
  stl: Pair
  blk: Pair
  pf: Pair
  /** These two slide with the offensive role, not the position. */
  fga: Pair
  fta: Pair
  /** The position constant at position 1; it is 0 from position 3 up. */
  position1: number
  /** Added per unit of offensive role above 3. */
  roleSlope: number
}

/** The published table for BPM. */
export const BPM: BpmCoefficients = {
  pts: [0.86, 0.86],
  fg3m: [0.389, 0.389],
  ast: [0.58, 1.034],
  tov: [-0.964, -0.964],
  orb: [0.613, 0.181],
  drb: [0.116, 0.181],
  stl: [1.369, 1.008],
  blk: [1.327, 0.703],
  pf: [-0.367, -0.367],
  fga: [-0.56, -0.78],
  fta: [-0.246, -0.343],
  position1: -0.818,
  roleSlope: 1.387
}

/** The published table for offensive BPM. */
export const OBPM: BpmCoefficients = {
  pts: [0.605, 0.605],
  fg3m: [0.477, 0.477],
  ast: [0.476, 0.476],
  tov: [-0.579, -0.882],
  orb: [0.606, 0.422],
  drb: [-0.112, 0.103],
  stl: [0.177, 0.294],
  blk: [0.725, 0.097],
  pf: [-0.439, -0.439],
  fga: [-0.33, -0.472],
  fta: [-0.145, -0.208],
  position1: -1.698,
  roleSlope: 0.43
}

/** The position regression on the player's shares of the team's counts while on the floor. */
export const POSITION_REGRESSION = {
  intercept: 2.13,
  trb: 8.668,
  stl: -2.486,
  pf: 0.992,
  ast: -3.536,
  blk: 1.667
}
/** The offensive role regression: assists and points above a shooting threshold. */
export const ROLE_REGRESSION = { intercept: 6.0, ast: -6.642, thresholdPts: -8.544 }
/** The threshold is this many points per true shot attempt below the team's. */
export const THRESHOLD_MARGIN = 0.33
/** Minutes of the listed position (or of role 4) blended into each estimate. */
export const PRIOR_MINUTES = 50
export const PRIOR_ROLE = 4
/** Points per true shot attempt the scoring coefficients were fitted at. */
export const SHOOTING_BASELINE = 1.0
/** Leading teams play this much worse per 100 possessions per point of lead; half is the team's. */
export const LEAD_EFFECT = 0.35
/** VORP's replacement level, in BPM. */
export const REPLACEMENT = -2.0

const slide = ([lo, hi]: Pair, at: number): number => lo + ((hi - lo) * (at - 1)) / 4
const clamp = (x: number): number => Math.min(5, Math.max(1, x))

/** A player's share of a team count while on the floor: 0.2 is an even fifth. */
const onFloorShare = (x: number, teamX: number, share: number): number => div(x, teamX * share)

/** The position regression before blending: 1 is a point guard, 5 a center. */
export function positionEstimate(p: Box, ts: TeamSeason): number {
  const s = minuteShare(p, ts)
  const t = ts.team
  const r = POSITION_REGRESSION
  return (
    r.intercept +
    r.trb * onFloorShare(reb(p), reb(t), s) +
    r.stl * onFloorShare(p.stl, t.stl, s) +
    r.pf * onFloorShare(p.pf, t.pf, s) +
    r.ast * onFloorShare(p.ast, t.ast, s) +
    r.blk * onFloorShare(p.blk, t.blk, s)
  )
}

/** The offensive role regression before blending: 1 creates shots, 5 receives them. */
export function roleEstimate(p: Box, ts: TeamSeason): number {
  const s = minuteShare(p, ts)
  const t = ts.team
  const teamPps = div(t.pts, tsa(t))
  const threshold = (b: Box): number => b.pts - (teamPps - THRESHOLD_MARGIN) * tsa(b)
  const r = ROLE_REGRESSION
  return (
    r.intercept +
    r.ast * onFloorShare(p.ast, t.ast, s) +
    r.thresholdPts * onFloorShare(threshold(p), threshold(t), s)
  )
}

/**
 * Each estimate blended with `PRIOR_MINUTES` of the prior, then shifted by one constant per team so
 * its minutes-weighted mean is 3, kept between 1 and 5. The clamp moves the mean, so the shift is
 * found again until it holds.
 */
export function centerOnTeam(blended: readonly number[], minutes: readonly number[]): number[] {
  const total = minutes.reduce((a, b) => a + b, 0)
  if (total === 0) return blended.map(clamp)
  let k = 0
  for (let i = 0; i < 100; i++) {
    const mean = blended.reduce((sum, b, j) => sum + clamp(b + k) * minutes[j], 0) / total
    if (Math.abs(3 - mean) < 1e-9) break
    k += 3 - mean
  }
  return blended.map((b) => clamp(b + k))
}

export const blend = (estimate: number, mp: number, prior: number): number =>
  div(estimate * mp + prior * PRIOR_MINUTES, mp + PRIOR_MINUTES)

/** Raw BPM (or OBPM) of one player before the team adjustment. */
export function rawBpm(
  p: Box,
  ts: TeamSeason,
  position: number,
  role: number,
  c: BpmCoefficients
): number {
  const s = minuteShare(p, ts)
  const teamPoss = possessions(ts)
  const per100 = (x: number): number => div(100 * x, s * teamPoss)
  // Points re-valued as if the team shot at the baseline: the team's context is taken out.
  const adjPts = p.pts + (SHOOTING_BASELINE - div(ts.team.pts, tsa(ts.team))) * tsa(p)
  const positionConstant = position >= 3 ? 0 : (c.position1 * (3 - position)) / 2
  return (
    slide(c.pts, position) * per100(adjPts) +
    slide(c.fg3m, position) * per100(p.fg3m) +
    slide(c.ast, position) * per100(p.ast) +
    slide(c.tov, position) * per100(p.tov) +
    slide(c.orb, position) * per100(p.oreb) +
    slide(c.drb, position) * per100(p.dreb) +
    slide(c.stl, position) * per100(p.stl) +
    slide(c.blk, position) * per100(p.blk) +
    slide(c.pf, position) * per100(p.pf) +
    slide(c.fga, role) * per100(p.fga) +
    slide(c.fta, role) * per100(p.fta) +
    positionConstant +
    c.roleSlope * (role - 3)
  )
}

/** One player's line with a team, and the position the roster lists (1 to 5), if any. */
export interface BpmPlayer {
  box: Box
  listed: number | null
}

export interface BpmResult {
  position: number
  role: number
  rawBpm: number
  rawObpm: number
  bpm: number
  obpm: number
  dbpm: number
  /** The player's share of the team's time on the floor (`MP / (team MP / 5)`). */
  share: number
  vorp: number
}

export interface TeamRatings {
  /** Net points per 100 possessions with half the lead effect: what BPM adds up to. */
  rating: number
  /** Points per 100 above the league's, with half of that lead effect: what OBPM adds up to. */
  offense: number
}

/**
 * The team's ratings the adjustment targets. `averageLead` is the team's mean lead over its minutes;
 * `teamRatings`'s caller estimates it (Plan T1005: half the margin per game).
 */
export function teamRatings(ts: TeamSeason, l: LeagueSeason, averageLead: number): TeamRatings {
  const poss = possessions(ts)
  const lead = (LEAD_EFFECT / 2) * averageLead
  return {
    rating: div(100 * (ts.team.pts - ts.opp.pts), poss) + lead,
    offense: div(100 * ts.team.pts, poss) - div(100 * l.totals.pts, l.poss) + lead / 2
  }
}

/**
 * BPM, OBPM, DBPM and VORP for every player of one team's season. Each total gets one constant per
 * team so that the players' values weighted by their share of the floor time add up to the rating.
 */
export function bpmForTeam(
  players: readonly BpmPlayer[],
  ts: TeamSeason,
  ratings: TeamRatings
): BpmResult[] {
  const minutes = players.map((p) => p.box.mp)
  const position = centerOnTeam(
    players.map((p) => blend(positionEstimate(p.box, ts), p.box.mp, p.listed ?? 3)),
    minutes
  )
  const role = centerOnTeam(
    players.map((p) => blend(roleEstimate(p.box, ts), p.box.mp, PRIOR_ROLE)),
    minutes
  )
  const share = players.map((p) => minuteShare(p.box, ts))
  const raw = players.map((p, i) => rawBpm(p.box, ts, position[i], role[i], BPM))
  const rawO = players.map((p, i) => rawBpm(p.box, ts, position[i], role[i], OBPM))
  const shares = share.reduce((a, b) => a + b, 0)
  const weighted = (xs: number[]): number => xs.reduce((sum, x, i) => sum + x * share[i], 0)
  const k = div(ratings.rating - weighted(raw), shares)
  const kO = div(ratings.offense - weighted(rawO), shares)
  return players.map((_, i) => {
    const bpm = raw[i] + k
    const obpm = rawO[i] + kO
    return {
      position: position[i],
      role: role[i],
      rawBpm: raw[i],
      rawObpm: rawO[i],
      bpm,
      obpm,
      dbpm: bpm - obpm,
      share: share[i],
      vorp: vorp(bpm, share[i], ts.games)
    }
  })
}

/** VORP: `(BPM + 2) × share of the floor time × team games / 82`. */
export const vorp = (bpm: number, share: number, teamGames: number): number =>
  (bpm - REPLACEMENT) * share * (teamGames / 82)
