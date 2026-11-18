import { SERIES_PATTERNS } from '@shared/leagues'
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
  return { bracket: order.slice(0, rules.teams), played: [], out: [] }
}

/**
 * How far each team went, by the teams left in the league: 1 the last eight (the NBA's conference
 * semifinals), 2 the last four (its conference finals, the WNBA's semifinals), 3 the final, 4 the
 * title. A round that leaves another number (the WNBA's six after its first round of 2016 to 2021)
 * is no stage.
 */
export type Reached = (team: number, round: 1 | 2 | 3 | 4) => void

/** The stage a number of teams left names. */
const STAGE: Readonly<Record<number, 1 | 2 | 3 | 4>> = { 8: 1, 4: 2, 2: 3, 1: 4 }

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
 * One field's rounds, `rounds` of them: a fixed bracket (`slots`, a bye passing its team on) or a
 * reseeded one (`entering`, the best side alive meeting the worst). `seriesOf` plays a series of a
 * round, and `note` hears the survivors of each round with the seeds still to enter. Series are played
 * in the order the bracket lists them, which keeps a seeded simulation's draws in the same order.
 */
function playField(
  field: readonly Seeded[],
  bracket: SeasonRules['bracket'],
  rounds: number,
  seriesOf: (a: Seeded, b: Seeded, round: number) => Seeded,
  note: (round: number, survivors: readonly Seeded[], waiting: number) => void
): Seeded {
  const at = (seed: number): Seeded | null => field[seed - 1] ?? null
  if ('slots' in bracket) {
    let alive = bracket.slots.map((s) => (s === null ? null : at(s)))
    for (let r = 0; r < rounds; r++) {
      const next: (Seeded | null)[] = []
      for (let i = 0; i < alive.length; i += 2) {
        const a = alive[i]
        const b = alive[i + 1] ?? null
        next.push(a && b ? seriesOf(a, b, r) : (a ?? b))
      }
      alive = next
      note(
        r,
        alive.filter((s): s is Seeded => s !== null),
        0
      )
    }
    return alive.find((s): s is Seeded => s !== null)!
  }
  let alive: Seeded[] = []
  for (let r = 0; r < rounds; r++) {
    for (const s of bracket.entering[r] ?? []) {
      const team = at(s)
      if (team) alive.push(team)
    }
    alive.sort((a, b) => a.seed - b.seed)
    const next: Seeded[] = []
    for (let i = 0; i < Math.floor(alive.length / 2); i++)
      next.push(seriesOf(alive[i], alive[alive.length - 1 - i], r))
    if (alive.length % 2 === 1) next.push(alive[Math.floor(alive.length / 2)])
    alive = next
    const waiting = bracket.entering.slice(r + 1).reduce((n, e) => n + e.length, 0)
    note(r, alive, waiting)
  }
  return alive[0]
}

/**
 * Plays the brackets to the title: each conference's and the final between their champions, or the
 * league's one bracket to its final (`SeasonRules.field`), each round with its own home pattern. The
 * NBA's: one against eight, four against five, three against six, two against seven, the winners of
 * the first two pairs meeting and of the last two. Returns the champion.
 */
export function playBracket(
  brackets: readonly (readonly number[])[],
  rules: SeasonRules,
  tb: TieBreaker,
  play: PlayGame,
  reached: Reached
): number {
  const neutral = rules.neutralPlayoffs
  const last = rules.rounds.length - 1
  const series = (a: Seeded, b: Seeded, round: number): Seeded => {
    const [hi, lo] = homeCourt(a, b, round === last, rules, tb)
    const pattern = SERIES_PATTERNS[rules.rounds[round]]
    return playSeries(hi.team, lo.team, pattern, neutral, play) === hi.team ? hi : lo
  }
  const fields = brackets.length
  // Every field has the same shape, so the teams left in the league are a field's times the fields.
  const note = (_round: number, survivors: readonly Seeded[], waiting: number): void => {
    const stage = STAGE[(survivors.length + waiting) * fields]
    if (stage) for (const s of survivors) reached(s.team, stage)
  }
  const within = fields > 1 ? last : last + 1
  const champions = brackets.map((teams) =>
    playField(
      teams.map((team, i) => ({ team, seed: i + 1 })),
      rules.bracket,
      within,
      series,
      note
    )
  )
  if (fields === 1) return champions[0].team
  const title = series(champions[0], champions[1], last)
  reached(title.team, 4)
  return title.team
}

/** The stages a season's format reaches (`Reached`): the NBA's all four, the WNBA's no last eight. */
export function stagesOf(rules: SeasonRules): Set<number> {
  const out = new Set<number>()
  const fields = rules.field === 'league' ? 1 : 2
  const seeds = Array.from({ length: rules.teams }, (_, i) => ({ team: i, seed: i + 1 }))
  const last = rules.rounds.length - 1
  const champion = playField(
    seeds,
    rules.bracket,
    fields > 1 ? last : last + 1,
    (a, b) => (a.seed < b.seed ? a : b),
    (_r, survivors, waiting) => {
      const stage = STAGE[(survivors.length + waiting) * fields]
      if (stage) out.add(stage)
    }
  )
  if (champion && fields > 1) out.add(4)
  return out
}
