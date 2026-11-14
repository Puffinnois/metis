import { solve } from './linear'

/**
 * Opponent-adjusted ratings (reference sections 5 and 13; Plan T1004): offense and defense per 100
 * possessions, adjusted for the opponents played and where. Pure maths: no database here.
 *
 * Each game gives two observations, one per offense: points per 100 possessions =
 * mean + the offense's effect + the defense's effect on points allowed + home court, where home
 * court is +h for the home offense, −h for the road one and 0 at a neutral site. Each observation is
 * weighted by the game's possessions, so the fit is the same as one row per possession. A ridge prior
 * pulls each team effect toward 0 by `lambda` possessions, as if every team had also played that many
 * possessions of league-average basketball: early in a season that keeps two or three games from
 * swinging a rating, and by the end, with some 8,000 possessions a team, it barely moves it.
 */

export interface EfficiencyGame<K> {
  /** YYYY-MM-DD: the as-of pass groups games by day. */
  date: string
  home: K
  away: K
  homePts: number
  awayPts: number
  /** The game's estimated possessions, one count for both teams. */
  poss: number
  neutral: boolean
}

/** The prior on each team effect, in possessions: chosen by predicting the next day's games. */
export const RIDGE_POSSESSIONS = 1000

export interface AdjustedFit<K> {
  /** League points per 100 possessions over the games: what the ratings are centred on. */
  league: number
  /** The fit's intercept: points per 100 at a neutral site between average teams. */
  mean: number
  /** Points per 100 the home offense gains over a neutral site (and the road offense loses). */
  home: number
  /** Effects on points scored and allowed, each summing to 0 over the teams that have played. */
  off: Map<K, number>
  def: Map<K, number>
  /** Possessions each team has played. */
  poss: Map<K, number>
}

/**
 * The weighted sums the normal equations need, kept as games are added so a day's solve does not
 * reread the season. Observation: offense o, defense d, home sign x, weight w (possessions), value
 * y (points per 100), so w·y is 100 × points.
 */
class Ledger<K> {
  readonly index = new Map<K, number>()
  readonly teams: K[] = []
  private w = 0
  private wx = 0
  private wxx = 0
  private wy = 0
  private wxy = 0
  private pts = 0
  /** Per team, as offense and as defense: possessions, possessions × x, 100 × points. */
  private offW: number[] = []
  private offWx: number[] = []
  private offWy: number[] = []
  private defW: number[] = []
  private defWx: number[] = []
  private defWy: number[] = []
  /** Possessions of offense i against defense j, keyed `i,j`. */
  private pairs = new Map<string, number>()

  private slot(team: K): number {
    let i = this.index.get(team)
    if (i === undefined) {
      i = this.teams.length
      this.index.set(team, i)
      this.teams.push(team)
      for (const list of [this.offW, this.offWx, this.offWy, this.defW, this.defWx, this.defWy])
        list.push(0)
    }
    return i
  }

  private observe(o: number, d: number, x: number, w: number, pts: number): void {
    const wy = 100 * pts
    this.w += w
    this.wx += w * x
    this.wxx += w * x * x
    this.wy += wy
    this.wxy += wy * x
    this.pts += pts
    this.offW[o] += w
    this.offWx[o] += w * x
    this.offWy[o] += wy
    this.defW[d] += w
    this.defWx[d] += w * x
    this.defWy[d] += wy
    const key = `${o},${d}`
    this.pairs.set(key, (this.pairs.get(key) ?? 0) + w)
  }

  add(g: EfficiencyGame<K>): void {
    if (!(g.poss > 0)) return
    const h = this.slot(g.home)
    const a = this.slot(g.away)
    const x = g.neutral ? 0 : 1
    this.observe(h, a, x, g.poss, g.homePts)
    this.observe(a, h, -x, g.poss, g.awayPts)
  }

  /**
   * Solves the normal equations of the ridge fit, with the effects of each side constrained to sum to
   * 0 (Lagrange rows). With a prior the constraints already hold at the optimum, so they change
   * nothing; with none (`lambda` 0) they pick the one solution centred on the league, as SRS's
   * "ratings sum to zero" does. Variables: mean, home, offense effects, defense effects, then the two
   * multipliers.
   */
  solve(lambda: number): AdjustedFit<K> {
    const k = this.teams.length
    const n = 2 + 2 * k + 2
    const a = new Float64Array(n * n)
    const b = new Float64Array(n)
    const O = 2
    const D = 2 + k
    const set = (i: number, j: number, v: number): void => {
      a[i * n + j] += v
      if (i !== j) a[j * n + i] += v
    }
    set(0, 0, this.w)
    set(0, 1, this.wx)
    set(1, 1, this.wxx)
    b[0] = this.wy
    b[1] = this.wxy
    // No game off a neutral floor yet: home court is not seen, so it is held at 0.
    if (this.wxx === 0) a[1 * n + 1] = 1
    for (let i = 0; i < k; i++) {
      set(0, O + i, this.offW[i])
      set(0, D + i, this.defW[i])
      set(1, O + i, this.offWx[i])
      set(1, D + i, this.defWx[i])
      set(O + i, O + i, this.offW[i] + lambda)
      set(D + i, D + i, this.defW[i] + lambda)
      b[O + i] = this.offWy[i]
      b[D + i] = this.defWy[i]
      set(O + i, n - 2, 1)
      set(D + i, n - 1, 1)
    }
    for (const [key, w] of this.pairs) {
      const [o, d] = key.split(',').map(Number)
      set(O + o, D + d, w)
    }
    const x = solve(a, b, n)
    return {
      league: this.w > 0 ? (100 * this.pts) / this.w : 0,
      mean: x[0],
      home: x[1],
      off: new Map(this.teams.map((t, i) => [t, x[O + i]])),
      def: new Map(this.teams.map((t, i) => [t, x[D + i]])),
      poss: new Map(this.teams.map((t, i) => [t, this.offW[i]]))
    }
  }
}

/** The fit over these games. */
export function fitAdjusted<K>(
  games: readonly EfficiencyGame<K>[],
  lambda = RIDGE_POSSESSIONS
): AdjustedFit<K> {
  const ledger = new Ledger<K>()
  for (const g of games) ledger.add(g)
  return ledger.solve(lambda)
}

export interface AdjustedRating {
  /** Possessions played so far. */
  poss: number
  /** Points scored per 100 against an average defense on a neutral floor: league + offense effect. */
  ortg: number
  /** Points allowed per 100 against an average offense on a neutral floor: lower is better. */
  drtg: number
  /** Adjusted offensive less adjusted defensive rating. */
  net: number
  league: number
  /** Net points per 100 a team gains at home over a neutral floor: twice the per-side term. */
  homeCourt: number
}

/** A team's adjusted ratings from a fit: the league average added back to each effect. */
export function ratingOf<K>(fit: AdjustedFit<K>, team: K): AdjustedRating | undefined {
  const o = fit.off.get(team)
  const d = fit.def.get(team)
  if (o === undefined || d === undefined) return undefined
  return {
    poss: fit.poss.get(team)!,
    ortg: fit.league + o,
    drtg: fit.league + d,
    net: o - d,
    league: fit.league,
    homeCourt: 2 * fit.home
  }
}

export interface DayAdjusted<K> extends AdjustedRating {
  date: string
  team: K
}

/**
 * The ratings as of the end of every day with games, for the teams that played that day, everyone's
 * games of the day included. Games need not be sorted.
 */
export function adjustedByDay<K>(
  games: readonly EfficiencyGame<K>[],
  lambda = RIDGE_POSSESSIONS
): DayAdjusted<K>[] {
  const sorted = [...games].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
  const ledger = new Ledger<K>()
  const out: DayAdjusted<K>[] = []
  for (let i = 0; i < sorted.length;) {
    const date = sorted[i].date
    const played = new Set<K>()
    for (; i < sorted.length && sorted[i].date === date; i++) {
      const g = sorted[i]
      if (!(g.poss > 0)) continue
      ledger.add(g)
      played.add(g.home)
      played.add(g.away)
    }
    if (played.size === 0) continue
    const fit = ledger.solve(lambda)
    for (const team of played) out.push({ date, team, ...ratingOf(fit, team)! })
  }
  return out
}
