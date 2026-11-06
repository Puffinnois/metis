import type { Entity, StatsQuery, StatsResult } from '@shared/stats/types'
import { fmtStat, type ValueFormat } from './format'
import { queryScope, type StatsScope } from './scope'

/** One card of the home: a metric's top six. */
export interface BoardDef {
  key: string
  entity: Entity
  metric: string
  title: string
  /** The leaderboard tab "All →" opens. */
  tab: string
}

const player = (metric: string, title: string): BoardDef => ({
  key: metric,
  entity: 'player',
  metric,
  title,
  tab: 'ALL'
})

export const BOARDS: BoardDef[] = [
  player('pts', 'Points'),
  player('reb', 'Rebounds'),
  player('ast', 'Assists'),
  player('fg3m', 'Threes made'),
  player('stl', 'Steals'),
  player('blk', 'Blocks'),
  player('ts_pct', 'True shooting'),
  { key: 'team_nrtg', entity: 'team', metric: 'team_nrtg', title: 'Net rating', tab: 'offense' }
]

/** Rows on a card. */
export const BOARD_ROWS = 6

/**
 * A per-game leader needs 70 % of the games: the NBA's own rule is 58 of 82, near enough, and a player
 * with ten great games should not lead a season.
 */
export const MIN_GAMES_SHARE = 0.7

/** Every qualified row, sorted by the engine. Counts per game when asked. */
export function boardQuery(board: BoardDef, scope: StatsScope, perGame: boolean): StatsQuery {
  return {
    entity: board.entity,
    metrics: [board.metric],
    scope: { ...queryScope(scope, board.entity), qualifiedOnly: true },
    transform: perGame ? 'perGame' : 'raw',
    limit: 1000
  }
}

export interface BoardRow {
  id: string
  rank: number
  name: string
  team: string | null
  value: string
  /** The value over the leader's, for the bar. */
  fraction: number
  lead: boolean
}

export interface BoardView {
  rows: BoardRow[]
  /** "per game" / "total" for counts, nothing for rates. */
  sub: string
}

/**
 * The card's rows from its result, in the engine's order. The games a player needs come from the
 * result itself, its most games being about what a team played in this scope, so they hold for a
 * date range or a last N as they do for a season.
 */
export function boardView(result: StatsResult, format: ValueFormat, perGame: boolean): BoardView {
  const metric = result.columns[0]?.id
  const most = Math.max(0, ...result.rows.map((r) => r.games))
  const need = perGame && format.aggregation === 'sum' ? Math.ceil(most * MIN_GAMES_SHARE) : 1
  const ranked = result.rows.filter(
    (r) => metric && r.values[metric]?.value !== null && r.games >= need
  )
  const leader = ranked[0] ? Math.abs(ranked[0].values[metric!].value ?? 0) : 0
  return {
    rows: ranked.slice(0, BOARD_ROWS).map((r, i) => {
      const v = r.values[metric!].value
      return {
        id: r.id,
        rank: i + 1,
        name: r.name,
        team: r.team,
        value: fmtStat(v, format, perGame ? 'perGame' : 'raw'),
        fraction: leader ? Math.max(0, Math.min(1, (v ?? 0) / leader)) : 0,
        lead: i === 0
      }
    }),
    sub: format.aggregation === 'sum' ? (perGame ? 'per game' : 'total') : ''
  }
}
