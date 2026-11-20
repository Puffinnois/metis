import { LEAGUES, type EloConstants } from '@shared/leagues'

/**
 * Team Elo (Plan T1002, reference section 13): FiveThirtyEight's published NBA Elo, with its home
 * court and its carry between seasons fitted out of sample. Every game played counts in date order,
 * and the ratings carry from season to season, regressed toward the mean. Pure functions over the
 * schedule, so the model is testable without a database.
 */

export interface EloParams {
  k: number
  /** Home court in Elo points; 0 at a neutral site. */
  homeCourt: number
  /** The share of a rating's distance from the mean kept between seasons. */
  carry: number
  /** Elo points per point of margin; the NBA's 28 when not given. */
  perPoint?: number
}

/** FiveThirtyEight's published values: K 20, home court 100, a quarter back to the mean. */
export const FIVETHIRTYEIGHT: EloParams = { k: 20, homeCourt: 100, carry: 0.75 }

/**
 * The NBA's constants (`League.models.elo` in the registry), which the pure functions take when no
 * league's are passed: 538's start of 1500, mean of 1505 (a little above 1500 since new franchises
 * enter below it), 1300 for a new franchise, K 20 and 28 Elo points a point of margin; home court 80
 * and a carry of 0.65 fitted on 1995-96 to 2009-10 and scored on 2010-11 on (`scripts/check-elo.mjs`),
 * lowering the later seasons' Brier score by 0.0018 against 538's 100 and 0.75. Each league's are
 * fitted on its own seasons.
 */
export const ELO: EloConstants = LEAGUES.nba.models.elo

/** The win probability of the side with this rating edge (home court included). */
export const winProbability = (diff: number): number => 1 / (1 + Math.pow(10, -diff / 400))

/** The expected margin, in points, of the side with this rating edge. */
export const expectedMargin = (diff: number, perPoint: number = ELO.perPoint): number =>
  diff / perPoint

/**
 * 538's margin-of-victory multiplier: a bigger win moves the ratings more, a favourite's win less (its
 * edge is partly why it won), so ratings do not run away from each other.
 * `winnerDiff` is the winner's pre-game edge, home court included; negative for an upset.
 */
export const movMultiplier = (margin: number, winnerDiff: number): number =>
  Math.pow(Math.abs(margin) + 3, 0.8) / (7.5 + 0.006 * winnerDiff)

/**
 * The home side's rating change for a game with this edge (`diff`, home court included) and this
 * margin (home less away); the away side's is its negative, so a game moves no points in or out.
 * A basketball game has no tie.
 */
export function eloShift(diff: number, margin: number, k: number = ELO.k): number {
  const won = margin > 0
  const winnerDiff = won ? diff : -diff
  return k * movMultiplier(margin, winnerDiff) * ((won ? 1 : 0) - winProbability(diff))
}

/** A rating carried into a new season: part of the way back to the mean. */
export const regress = (
  rating: number,
  carry: number = ELO.carry,
  mean: number = ELO.mean
): number => mean + (rating - mean) * carry

export interface EloGame<T> {
  game_id: string
  /** `YYYY-MM-DD`. */
  date: string
  home: T
  away: T
  /** No home court: a game abroad, a Cup semifinal or final in Las Vegas, the 2020 bubble. */
  neutral: boolean
  /** Home less away; null for a game not played yet. */
  margin: number | null
}

export interface EloRow<T> {
  game_id: string
  date: string
  home: T
  away: T
  played: boolean
  homePre: number
  awayPre: number
  /** The home court applied, in Elo points: 0 at a neutral site. */
  homeCourt: number
  /** The home side's win probability and expected margin before the game. */
  homeWin: number
  homeMargin: number
  /** Null for a game not played. */
  homePost: number | null
  awayPost: number | null
}

/**
 * Runs one season's games. `start` holds each team's rating as the season begins (already carried
 * and regressed); a team missing from it enters at `entry` (1300, a new franchise). Played games go
 * in date order (then by id), each moving both ratings. Games not played yet are rated afterwards
 * with the ratings as they stand after every game played, whatever their listed date: a postponed
 * game is still to come. Returns a row per game in that order and every team's rating at the end.
 */
export function runSeason<T>(
  games: readonly EloGame<T>[],
  start: ReadonlyMap<T, number>,
  params: EloParams = ELO,
  entry: number = ELO.newTeam
): { rows: EloRow<T>[]; ratings: Map<T, number> } {
  const ratings = new Map(start)
  const rating = (team: T): number => {
    if (!ratings.has(team)) ratings.set(team, entry)
    return ratings.get(team)!
  }
  const byDate = (a: EloGame<T>, b: EloGame<T>): number =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : 1
  const played = games.filter((g) => g.margin !== null).sort(byDate)
  const toCome = games.filter((g) => g.margin === null).sort(byDate)
  const rows: EloRow<T>[] = []
  const rate = (g: EloGame<T>): void => {
    const homePre = rating(g.home)
    const awayPre = rating(g.away)
    const homeCourt = g.neutral ? 0 : params.homeCourt
    const diff = homePre + homeCourt - awayPre
    const shift = g.margin === null ? null : eloShift(diff, g.margin, params.k)
    if (shift !== null) {
      ratings.set(g.home, homePre + shift)
      ratings.set(g.away, awayPre - shift)
    }
    rows.push({
      game_id: g.game_id,
      date: g.date,
      home: g.home,
      away: g.away,
      played: shift !== null,
      homePre,
      awayPre,
      homeCourt,
      homeWin: winProbability(diff),
      homeMargin: expectedMargin(diff, params.perPoint ?? ELO.perPoint),
      homePost: shift === null ? null : homePre + shift,
      awayPost: shift === null ? null : awayPre - shift
    })
  }
  for (const g of played) rate(g)
  for (const g of toCome) rate(g)
  return { rows, ratings }
}

/**
 * The ratings a season starts from: each team of the season before, regressed. A team new to the
 * league this season takes the rating of a team that played last season and is gone this one, when
 * exactly one such pair exists: a franchise that moved under a new identity (the Hornets from
 * Charlotte to New Orleans in 2002, filed by the NBA under two ids). Any other new team is left out,
 * so it enters at 1300.
 */
export function seasonStart<T>(
  last: ReadonlyMap<T, number>,
  teams: readonly T[],
  carry: number = ELO.carry,
  mean: number = ELO.mean,
  /** False where teams join and leave as schools (`LeagueModels.pairMoves`): none is paired. */
  pairMoves = true
): Map<T, number> {
  const out = new Map<T, number>()
  const here = new Set(teams)
  const arrived = teams.filter((t) => !last.has(t))
  const gone = [...last.keys()].filter((t) => !here.has(t))
  for (const t of teams) {
    const r = last.get(t)
    if (r !== undefined) out.set(t, regress(r, carry, mean))
  }
  if (pairMoves && arrived.length === 1 && gone.length === 1) {
    out.set(arrived[0], regress(last.get(gone[0])!, carry, mean))
  }
  return out
}

/** The mean squared error of probabilities against what happened (1 a win, 0 a loss). */
export function brier(pairs: readonly { p: number; won: boolean }[]): number {
  if (pairs.length === 0) return NaN
  return pairs.reduce((s, x) => s + (x.p - (x.won ? 1 : 0)) ** 2, 0) / pairs.length
}

/** The mean negative log-likelihood of what happened, in nats. */
export function logLoss(pairs: readonly { p: number; won: boolean }[]): number {
  if (pairs.length === 0) return NaN
  return -pairs.reduce((s, x) => s + Math.log(x.won ? x.p : 1 - x.p), 0) / pairs.length
}
