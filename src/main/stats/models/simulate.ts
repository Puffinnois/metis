import { playBracket, playIn, type PlayGame } from './playoffs'
import { rng, sideMargin } from './random'
import { Records, seedConferences, type League, type SeasonRules } from './standings'

/**
 * Season simulation (Plan T1003): the rest of the regular season played many times from the current
 * Elo ratings, then the play-in and the bracket to the title, with each season's rules. Pure code: the
 * Elo model is passed in, so the simulation is testable without a database.
 *
 * Inside a run the ratings move after every simulated game, by the same update Elo applies to a game
 * played, so a team that gets hot in a run stays hot in it. A game's winner is drawn with the Elo win
 * probability; its margin from a normal around the Elo expected margin, cut on the winner's side
 * (`sideMargin`), so point differential (a tiebreaker) and the update's margin multiplier have a
 * margin to read and the winner keeps exactly the Elo probability.
 */

/** What the simulation needs of an Elo model. */
export interface EloModel {
  /** Home court in Elo points (0 at a neutral site). */
  homeCourt: number
  /** The win probability of the side with this rating edge, home court included. */
  winProbability: (diff: number) => number
  /** The home side's rating change for a game with this edge and this margin (home less away). */
  shift: (diff: number, margin: number) => number
  /** Elo points per point of margin. */
  perPoint: number
  /** The spread of a game's margin around the Elo expected margin, in points. */
  marginSd: number
}

export interface PlayedGame {
  home: number
  away: number
  /** Home less away, never zero. */
  margin: number
}

export interface GameLeft {
  home: number
  away: number
  neutral: boolean
}

export interface SimInput {
  league: League
  rules: SeasonRules
  /** The regular season's games played so far. */
  played: readonly PlayedGame[]
  /** Its games still to play, in date order. */
  left: readonly GameLeft[]
  /**
   * Each team's games still to play against an opponent the schedule does not name yet (the season
   * in progress's Cup games, listed once the group stage sets them). They count in the overall record
   * only, against an average team at no home court.
   */
  unnamed?: readonly number[]
  /** Every team's Elo rating now. */
  ratings: Float64Array
  elo: EloModel
  runs: number
  seed: number
}

/** A team's forecast: averages over the runs. */
export interface TeamForecast {
  wins: number
  losses: number
  /** Reaches the bracket of sixteen, through the play-in or not. */
  playoffs: number
  /** A seed of one to six: no play-in (from 2020-21). */
  top6: number
  /** Finishes seventh to tenth and plays in (from 2020-21; 2019-20's eighth and ninth when it was played). */
  playIn: number
  /** Wins a first-round series. */
  round2: number
  /** Reaches its conference's finals. */
  conferenceFinals: number
  finals: number
  title: number
  /** The mean place in the conference's seed order, one to fifteen, before the play-in. */
  seed: number
}

/** Plays the rest of the season `runs` times and returns each team's averages, by index. */
export function simulateSeason(input: SimInput): TeamForecast[] {
  const { league, rules, elo, runs } = input
  const n = league.ids.length
  const random = rng(input.seed)
  const fixed = new Records(n)
  for (const g of input.played) fixed.add(g.home, g.away, g.margin)
  const unnamed = input.unnamed ?? new Array<number>(n).fill(0)
  let mean = 0
  for (let t = 0; t < n; t++) mean += input.ratings[t] / n

  const sum = {
    wins: new Float64Array(n),
    losses: new Float64Array(n),
    playoffs: new Float64Array(n),
    top6: new Float64Array(n),
    playIn: new Float64Array(n),
    round2: new Float64Array(n),
    conferenceFinals: new Float64Array(n),
    finals: new Float64Array(n),
    title: new Float64Array(n),
    seed: new Float64Array(n)
  }
  const reachedSums = [sum.round2, sum.conferenceFinals, sum.finals, sum.title]
  const rec = new Records(n)
  const rating = new Float64Array(n)

  /** One game: draws the winner and the margin, moves both ratings, returns the margin. */
  const game = (home: number, away: number, court: number): number => {
    const diff = rating[home] + court - rating[away]
    const won = random() < elo.winProbability(diff)
    const margin = sideMargin(diff / elo.perPoint, elo.marginSd, won, random())
    const shift = elo.shift(diff, margin)
    rating[home] += shift
    rating[away] -= shift
    return margin
  }
  const court = (neutral: boolean): number => (neutral ? 0 : elo.homeCourt)
  const playoffGame: PlayGame = (home, away, neutral) => game(home, away, court(neutral)) > 0

  for (let run = 0; run < runs; run++) {
    rec.copy(fixed)
    rating.set(input.ratings)
    for (const g of input.left) rec.add(g.home, g.away, game(g.home, g.away, court(g.neutral)))
    for (let t = 0; t < n; t++) {
      for (let k = 0; k < unnamed[t]; k++) {
        // Against an average team: only this team's rating moves.
        const diff = rating[t] - mean
        const won = random() < elo.winProbability(diff)
        const margin = sideMargin(diff / elo.perPoint, elo.marginSd, won, random())
        rating[t] += elo.shift(diff, margin)
        rec.addExtra(t, margin)
      }
    }
    for (let t = 0; t < n; t++) {
      sum.wins[t] += rec.won(t)
      sum.losses[t] += rec.lost(t)
    }
    const { tb, conferences } = seedConferences(league, rec, rules, random)
    const brackets = conferences.map(({ order }) => {
      order.forEach((t, i) => (sum.seed[t] += i + 1))
      const result = playIn(order, rules, rec, playoffGame)
      for (const t of result.bracket) sum.playoffs[t] += 1
      for (const t of result.played) sum.playIn[t] += 1
      if (rules.playIn === 'modern') for (const t of order.slice(0, 6)) sum.top6[t] += 1
      return result.bracket
    }) as [number[], number[]]
    playBracket(
      brackets,
      rules,
      tb,
      playoffGame,
      (team, round) => (reachedSums[round - 1][team] += 1)
    )
  }

  return Array.from({ length: n }, (_, t) => ({
    wins: sum.wins[t] / runs,
    losses: sum.losses[t] / runs,
    playoffs: sum.playoffs[t] / runs,
    top6: sum.top6[t] / runs,
    playIn: sum.playIn[t] / runs,
    round2: sum.round2[t] / runs,
    conferenceFinals: sum.conferenceFinals[t] / runs,
    finals: sum.finals[t] / runs,
    title: sum.title[t] / runs,
    seed: sum.seed[t] / runs
  }))
}
