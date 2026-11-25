import type { GameCount, StatsPlayerGame } from './types'

/*
 * A player's highs, streaks and threshold games (audit entry 443, Plan T1703.3), worked out from their
 * game lines (`stats.playerGames`) when read: nothing is stored. Only types are imported, so a check
 * script can read this file on its own.
 *
 * A game is one the box score has the player in, as games played counts it. A count a line lacks is
 * unknown, never 0: it is no high, it is not a game over a threshold and it is counted apart
 * (`unknown`), and it ends a streak, since nobody can say the streak went on.
 */

/** The counts a line carries, in the order the read gives them. */
export const GAME_COUNTS = [
  'seconds',
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf',
  'pts',
  'plus_minus'
] as const satisfies readonly GameCount[]

const AT = new Map<GameCount, number>(GAME_COUNTS.map((c, i) => [c, i]))

type Line = Pick<StatsPlayerGame, 'counts'>

export const countOf = (game: Line, count: GameCount): number | null =>
  game.counts[AT.get(count)!] ?? null

/** The main box counts a high is kept of, each with the catalogue metric that names it. */
export const HIGHS: readonly { count: GameCount; metric: string }[] = [
  { count: 'pts', metric: 'pts' },
  { count: 'reb', metric: 'reb' },
  { count: 'ast', metric: 'ast' },
  { count: 'stl', metric: 'stl' },
  { count: 'blk', metric: 'blk' },
  { count: 'fg3m', metric: 'fg3m' },
  { count: 'fgm', metric: 'fgm' },
  { count: 'ftm', metric: 'ftm' },
  { count: 'oreb', metric: 'oreb' },
  { count: 'dreb', metric: 'dreb' },
  { count: 'tov', metric: 'tov' },
  { count: 'seconds', metric: 'min' },
  { count: 'plus_minus', metric: 'plus_minus' }
]

/** Something a game did or did not do. */
export interface Feat {
  id: string
  label: string
  /** The head of a narrow column. */
  short: string
  /** The catalogue metrics it reads, whose coverage is its own. */
  metrics: readonly string[]
  /** Whether the game did it; null where the line lacks what would say. */
  did: (game: Line) => boolean | null
}

const atLeast =
  (count: GameCount, n: number): Feat['did'] =>
  (game) => {
    const v = countOf(game, count)
    return v === null ? null : v >= n
  }

const DOUBLES: readonly GameCount[] = ['pts', 'reb', 'ast', 'stl', 'blk']

/** Ten or more in `n` of points, rebounds, assists, steals and blocks. */
const tens =
  (n: number): Feat['did'] =>
  (game) => {
    const values = DOUBLES.map((c) => countOf(game, c))
    const sure = values.filter((v) => v !== null && v >= 10).length
    if (sure >= n) return true
    return sure + values.filter((v) => v === null).length < n ? false : null
  }

const over = (count: GameCount, metric: string, n: number, short: string, word: string): Feat => ({
  id: `${metric}${n}`,
  label: `${n}+ ${word}`,
  short: `${n}+ ${short}`,
  metrics: [metric],
  did: atLeast(count, n)
})

const one = (count: GameCount, metric: string, short: string, label: string): Feat => ({
  id: `${metric}1`,
  label,
  short,
  metrics: [metric],
  did: atLeast(count, 1)
})

const DOUBLE: Feat = {
  id: 'dd2',
  label: 'Double-double',
  short: 'DD',
  metrics: ['pts', 'reb', 'ast', 'stl', 'blk'],
  did: tens(2)
}
const TRIPLE: Feat = {
  id: 'td3',
  label: 'Triple-double',
  short: 'TD',
  metrics: ['pts', 'reb', 'ast', 'stl', 'blk'],
  did: tens(3)
}

/** The games counted, over a season and a career. */
export const THRESHOLDS: readonly Feat[] = [
  over('pts', 'pts', 10, 'PTS', 'points'),
  over('pts', 'pts', 20, 'PTS', 'points'),
  over('pts', 'pts', 30, 'PTS', 'points'),
  over('pts', 'pts', 40, 'PTS', 'points'),
  over('pts', 'pts', 50, 'PTS', 'points'),
  over('reb', 'reb', 10, 'REB', 'rebounds'),
  over('reb', 'reb', 20, 'REB', 'rebounds'),
  over('ast', 'ast', 10, 'AST', 'assists'),
  over('fg3m', 'fg3m', 5, '3PM', 'threes'),
  over('stl', 'stl', 5, 'STL', 'steals'),
  over('blk', 'blk', 5, 'BLK', 'blocks'),
  DOUBLE,
  TRIPLE
]

/** What a run of games in a row is kept of. */
export const STREAKS: readonly Feat[] = [
  over('pts', 'pts', 10, 'PTS', 'points'),
  over('pts', 'pts', 20, 'PTS', 'points'),
  over('pts', 'pts', 30, 'PTS', 'points'),
  over('reb', 'reb', 10, 'REB', 'rebounds'),
  over('ast', 'ast', 10, 'AST', 'assists'),
  DOUBLE,
  TRIPLE,
  one('fg3m', 'fg3m', '3PM', 'A made three'),
  one('stl', 'stl', 'STL', 'A steal'),
  one('blk', 'blk', 'BLK', 'A block')
]

/** A player's best of a count over some games. */
export interface High {
  value: number
  /** How many games reached it, and the latest of them. */
  times: number
  game: StatsPlayerGame
  /** The games whose line lacks the count. */
  unknown: number
}

/** The high of a count over the games, in date order; null when no line has it. */
export function highOf(games: readonly StatsPlayerGame[], count: GameCount): High | null {
  let best = null as High | null
  let unknown = 0
  for (const game of games) {
    const value = countOf(game, count)
    if (value === null) unknown++
    else if (best === null || value > best.value) best = { value, times: 1, game, unknown: 0 }
    else if (value === best.value) best = { ...best, times: best.times + 1, game }
  }
  return best && { ...best, unknown }
}

/** How many of some games did something. */
export interface Tally {
  games: number
  unknown: number
  /** The games it could be said of. */
  known: number
}

export function tallyOf(games: readonly StatsPlayerGame[], feat: Feat): Tally {
  const out = { games: 0, unknown: 0, known: 0 }
  for (const game of games) {
    const did = feat.did(game)
    if (did === null) out.unknown++
    else {
      out.known++
      if (did) out.games++
    }
  }
  return out
}

/** A run of games in a row that each did something, from the first to the last. */
export interface Run {
  length: number
  from: StatsPlayerGame
  to: StatsPlayerGame
}

export interface Streak {
  /** The longest run, the latest of equals; null when no game did it. */
  longest: Run | null
  /** The run the last game stands in; null when the last game did not do it. */
  last: Run | null
  unknown: number
  known: number
}

/** The runs of a feat over the games the player played, in date order. */
export function streakOf(games: readonly StatsPlayerGame[], feat: Feat): Streak {
  let run: Run | null = null
  let longest: Run | null = null
  let unknown = 0
  for (const game of games) {
    const did = feat.did(game)
    if (did === null) unknown++
    if (did !== true) run = null
    else
      run = run
        ? { length: run.length + 1, from: run.from, to: game }
        : { length: 1, from: game, to: game }
    if (run && run.length >= (longest?.length ?? 1)) longest = run
  }
  return { longest, last: run, unknown, known: games.length - unknown }
}
