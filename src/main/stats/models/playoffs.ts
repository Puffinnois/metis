import { gamesBehind, type Records, type SeasonRules, type TieBreaker } from './standings'

/**
 * The postseason (Plan T1003): the play-in, the bracket and best-of series with their home pattern,
 * for the rules of a season (`rulesOf`). Pure code: a game is played by the function passed in, so the
 * simulation draws it and the playoff-field check feeds the real results.
 */

/** Plays one game, `home` hosting (no home court when `neutral`); true when `home` wins. */
export type PlayGame = (home: number, away: number, neutral: boolean) => boolean

/** Which games the better side hosts: game by game, true at home. */
export const PATTERNS = {
  '2-2-1': [true, true, false, false, true],
  '2-2-1-1-1': [true, true, false, false, true, false, true],
  '2-3-2': [true, true, false, false, false, true, true]
} as const

/** Plays a series to `games` (five or seven); `hi` has home court. Returns the winner. */
export function playSeries(
  hi: number,
  lo: number,
  pattern: readonly boolean[],
  neutral: boolean,
  play: PlayGame
): number {
  const need = (pattern.length + 1) / 2
  let a = 0
  let b = 0
  for (let g = 0; a < need && b < need; g++) {
    const hiHome = pattern[g]
    const hiWon = hiHome ? play(hi, lo, neutral) : !play(lo, hi, neutral)
    if (hiWon) a++
    else b++
  }
  return a === need ? hi : lo
}

export interface PlayInResult {
  /** The eight teams of the bracket, seed one first. */
  bracket: number[]
  /** The teams that played in the play-in. */
  played: number[]
  /** The play-in's losers, ninth first (the loser of the last game, then of nine against ten). */
  out: number[]
}

/**
 * The conference's eight bracket seeds from its seed order. `modern` (from 2020-21): seventh hosts
 * eighth, the winner seeded seventh; ninth hosts tenth, the loser out; the loser of the first hosts
 * the winner of the second for the eighth seed. `bubble` (2019-20): when the ninth team finished
 * within four games of the eighth, it had to beat the eighth twice, the eighth once.
 */
export function playIn(
  order: readonly number[],
  rules: SeasonRules,
  rec: Records,
  play: PlayGame
): PlayInResult {
  if (rules.playIn === 'modern' && order.length >= 10) {
    const [s7, s8, s9, s10] = order.slice(6, 10)
    const first = play(s7, s8, false)
    const seventh = first ? s7 : s8
    const loser = first ? s8 : s7
    const second = play(s9, s10, false) ? s9 : s10
    const eighth = play(loser, second, false) ? loser : second
    return {
      bracket: [...order.slice(0, 6), seventh, eighth],
      played: [s7, s8, s9, s10],
      out: [eighth === loser ? second : loser, second === s9 ? s10 : s9]
    }
  }
  if (rules.playIn === 'bubble' && order.length >= 9 && gamesBehind(rec, order[7], order[8]) <= 4) {
    const [s8, s9] = [order[7], order[8]]
    const neutral = rules.neutralPlayoffs
    const eighth = play(s8, s9, neutral) ? s8 : play(s8, s9, neutral) ? s8 : s9
    return {
      bracket: [...order.slice(0, 7), eighth],
      played: [s8, s9],
      out: [eighth === s8 ? s9 : s8]
    }
  }
  return { bracket: order.slice(0, 8), played: [], out: [] }
}

/** How far each team went: 1 the conference semifinals, 2 its finals, 3 the Finals, 4 the title. */
export type Reached = (team: number, round: 1 | 2 | 3 | 4) => void

export interface Seeded {
  team: number
  seed: number
}

/**
 * Which side has home court. By seed within a conference before 2006-07; by record from then on, and
 * in the Finals always, a tie in record broken by the two-team tiebreakers. For the Finals the NBA's
 * text names no separate procedure; the same steps are applied, an approximation stated in
 * `nba-data-sources.md`.
 */
export function homeCourt(
  a: Seeded,
  b: Seeded,
  finals: boolean,
  rules: SeasonRules,
  tb: TieBreaker
): [Seeded, Seeded] {
  if (!finals && !rules.homeByRecord) return a.seed < b.seed ? [a, b] : [b, a]
  const pa = tb.rec.pct(a.team)
  const pb = tb.rec.pct(b.team)
  if (Math.abs(pa - pb) > 1e-9) return pa > pb ? [a, b] : [b, a]
  return tb.breakTie([a.team, b.team])[0] === a.team ? [a, b] : [b, a]
}

/**
 * Plays both conferences' brackets and the Finals: one against eight, four against five, three
 * against six, two against seven, the winners of the first two pairs meeting and of the last two.
 * Returns the champion.
 */
export function playBracket(
  brackets: readonly [readonly number[], readonly number[]],
  rules: SeasonRules,
  tb: TieBreaker,
  play: PlayGame,
  reached: Reached
): number {
  const neutral = rules.neutralPlayoffs
  const series = (a: Seeded, b: Seeded, round: number, finals = false): Seeded => {
    const [hi, lo] = homeCourt(a, b, finals, rules, tb)
    const pattern =
      round === 0 && rules.firstRound === 5
        ? PATTERNS['2-2-1']
        : finals
          ? PATTERNS[rules.finals]
          : PATTERNS['2-2-1-1-1']
    return playSeries(hi.team, lo.team, pattern, neutral, play) === hi.team ? hi : lo
  }
  const champions = brackets.map((teams) => {
    const s = teams.map((team, i) => ({ team, seed: i + 1 }))
    const r1 = [
      series(s[0], s[7], 0),
      series(s[3], s[4], 0),
      series(s[2], s[5], 0),
      series(s[1], s[6], 0)
    ]
    for (const w of r1) reached(w.team, 1)
    const r2 = [series(r1[0], r1[1], 1), series(r1[2], r1[3], 1)]
    for (const w of r2) reached(w.team, 2)
    const champion = series(r2[0], r2[1], 2)
    reached(champion.team, 3)
    return champion
  })
  const title = series(champions[0], champions[1], 3, true)
  reached(title.team, 4)
  return title.team
}
