import { seasonLabel } from '@shared/stats/seasons'
import type { StatsMatchupPair } from '@shared/stats/types'
import { fmtClock, fmtStat } from './format'
import type { StatsScope } from './scope'

/**
 * The player dashboard's Matchups tab: beside the defender's totals, the pairs behind them, from the
 * NBA's pair file. It is published for whole regular seasons only, from 2017-18.
 */

export const MATCHUPS_FIRST_SEASON = 2018

/** How many pairs a list shows before "all". */
export const PAIR_LIMIT = 12

export const PAIR_HEAD = ['Player', 'G', 'MIN', 'Poss', 'PTS', 'FG', 'FG%', '3P', 'AST', 'TOV']

/** Why the pairs cannot answer this scope; null when they can. */
export function pairGap(scope: StatsScope): string | null {
  if (scope.season < MATCHUPS_FIRST_SEASON) {
    return `Tracked from ${seasonLabel(MATCHUPS_FIRST_SEASON)}.`
  }
  if (scope.seasonType !== 'regular') return 'The NBA publishes pairs for the regular season only.'
  if (scope.range.kind !== 'season') return 'Pairs are published for whole seasons only.'
  return null
}

export interface PairRow {
  key: string
  name: string
  cells: string[]
}

const count = (x: number | null): string => fmtStat(x, { unit: 'count', decimals: 0 })
const made = (m: number | null, a: number | null): string =>
  m === null || a === null ? '—' : `${count(m)}-${count(a)}`

/** A list's rows, longest first as read, each with its numbers as the table shows them. */
export function pairRows(pairs: StatsMatchupPair[], limit: number | null = PAIR_LIMIT): PairRow[] {
  return pairs.slice(0, limit ?? pairs.length).map((p) => ({
    key: p.id,
    name: p.name,
    cells: [
      count(p.games),
      fmtClock(p.minutes),
      fmtStat(p.partialPoss, { unit: 'number', decimals: 1 }),
      count(p.pts),
      made(p.fgm, p.fga),
      // No attempts is no percentage, not 0 %.
      fmtStat(p.fga ? (p.fgm ?? 0) / p.fga : null, { unit: 'pct', decimals: 1 }),
      made(p.fg3m, p.fg3a),
      count(p.ast),
      count(p.tov)
    ]
  }))
}

/** "12 of 287 players", or "3 players" when the list shows them all. */
export function pairCount(shown: number, total: number): string {
  const players = total === 1 ? 'player' : 'players'
  return shown < total ? `${shown} of ${total} ${players}` : `${total} ${players}`
}
