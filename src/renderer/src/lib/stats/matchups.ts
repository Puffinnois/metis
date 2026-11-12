import { seasonLabel } from '@shared/stats/seasons'
import type { StatsGameMatchup, StatsMatchupPair, StatsMatchupScope } from '@shared/stats/types'
import { fmtClock, fmtStat } from './format'
import { queryScope, type StatsScope } from './scope'

/**
 * The player dashboard's Matchups tab: beside the defender's totals, the pairs behind them. A whole
 * regular season reads the NBA's pair file; any other scope, the game matchups added up over the
 * player's games in it. Both start in 2017-18. A game's page lists who guarded whom in that game.
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
  return null
}

/** The scope bar's games, as the matchups read takes them. */
export function matchupScope(scope: StatsScope): StatsMatchupScope {
  const q = queryScope(scope, 'player')
  return {
    gameTypes: q.gameTypes ?? ['regular'],
    ...(q.dates ? { dates: q.dates } : {}),
    ...(q.lastN !== undefined ? { lastN: q.lastN } : {}),
    ...(q.lastNOf ? { lastNOf: q.lastNOf } : {})
  }
}

/** Where the pairs come from, said under them. */
export function pairsNote(source: 'season' | 'games'): string {
  const what =
    'PTS, FG and the rest are what the player on offense did while that defender was assigned.'
  return source === 'season'
    ? `From the NBA’s pair file for the whole regular season. ${what}`
    : `Added up from the NBA’s game matchups over the games in scope. ${what}`
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

/** "15 of 87 pairs", or "9 pairs" when the list shows them all. */
export function gamePairCount(shown: number, total: number): string {
  const pairs = total === 1 ? 'pair' : 'pairs'
  return shown < total ? `${shown} of ${total} ${pairs}` : `${total} ${pairs}`
}

/** How many of a game's pairs a side shows before "all". */
export const GAME_PAIR_LIMIT = 15

export const GAME_PAIR_HEAD = [
  'Defender',
  'Guarding',
  'MIN',
  'Poss',
  'PTS',
  'FG',
  '3P',
  'FT',
  'AST',
  'TOV',
  'BLK'
]

export interface GamePairRow {
  key: string
  defId: string
  defName: string
  offId: string
  offName: string
  offPosition: string | null
  cells: string[]
}

/** One defending side of a game: its pairs, longest first. */
export interface GamePairSide {
  teamId: string | null
  code: string
  rows: GamePairRow[]
  total: number
}

/**
 * A game's pairs by the side defending, away team first as the box scores are, each side's longest
 * first (as read). `limit` cuts each side's list; null shows all.
 */
export function gamePairSides(
  pairs: StatsGameMatchup[],
  away: { id: string | null; code: string },
  home: { id: string | null; code: string },
  limit: number | null = GAME_PAIR_LIMIT
): GamePairSide[] {
  return [away, home].map((side) => {
    const mine = pairs.filter((p) => p.defTeamId === side.id)
    return {
      teamId: side.id,
      code: side.code,
      total: mine.length,
      rows: mine.slice(0, limit ?? mine.length).map((p) => ({
        key: `${p.defId}-${p.offId}`,
        defId: p.defId,
        defName: p.defName,
        offId: p.offId,
        offName: p.offName,
        offPosition: p.offPosition,
        cells: [
          fmtClock(p.minutes),
          fmtStat(p.partialPoss, { unit: 'number', decimals: 1 }),
          count(p.pts),
          made(p.fgm, p.fga),
          made(p.fg3m, p.fg3a),
          made(p.ftm, p.fta),
          count(p.ast),
          count(p.tov),
          count(p.blk)
        ]
      }))
    }
  })
}
