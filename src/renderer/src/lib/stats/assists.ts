import type { Entity, StatsAssistPair, StatsAssistRequest } from '@shared/stats/types'
import type { StatsScope } from './scope'
import { shotRequest } from './shotChart'

/** Who assisted whom (Plan T905): the tables on the team's and the player's Play by play tab. */

/** Pairs shown before "Show all". */
export const ASSIST_LIMIT = 15

export const TEAM_ASSIST_HEAD = ['Passer', 'Scorer', 'Makes', '3PM', 'PTS', 'Share']
export const PLAYER_ASSIST_HEAD = ['Player', 'Makes', '3PM', 'PTS', 'Share']

/** The read's request: the scope bar's seasons and games, as the shot chart reads them. */
export function assistRequest(entity: Entity, id: string, scope: StatsScope): StatsAssistRequest {
  const { side: _side, ...rest } = shotRequest(entity, id, scope)
  void _side
  return rest
}

export interface AssistRow {
  key: string
  passer: string
  passerName: string
  scorer: string
  scorerName: string
  makes: number
  threes: number
  points: number
  /** The pair's share of the assists listed with it, 0 to 1. */
  share: number
}

const rowOf = (p: StatsAssistPair, total: number): AssistRow => ({
  key: `${p.passer}-${p.scorer}`,
  passer: p.passer,
  passerName: p.passerName,
  scorer: p.scorer,
  scorerName: p.scorerName,
  makes: p.makes,
  threes: p.threes,
  points: p.points,
  share: total > 0 ? p.makes / total : 0
})

/** A team's pairs, most makes first, each with its share of the team's assisted makes. */
export function teamAssistRows(pairs: readonly StatsAssistPair[]): AssistRow[] {
  const total = pairs.reduce((n, p) => n + p.makes, 0)
  return [...pairs].sort(byMakes).map((p) => rowOf(p, total))
}

/** A player's pairs, split: who they fed (as passer), and who fed them (as scorer). */
export function playerAssistRows(
  pairs: readonly StatsAssistPair[],
  player: string
): { feeds: AssistRow[]; fedBy: AssistRow[] } {
  const feeds = pairs.filter((p) => p.passer === player).sort(byMakes)
  const fedBy = pairs.filter((p) => p.scorer === player).sort(byMakes)
  const sum = (xs: StatsAssistPair[]): number => xs.reduce((n, p) => n + p.makes, 0)
  return {
    feeds: feeds.map((p) => rowOf(p, sum(feeds))),
    fedBy: fedBy.map((p) => rowOf(p, sum(fedBy)))
  }
}

const byMakes = (a: StatsAssistPair, b: StatsAssistPair): number =>
  b.makes - a.makes ||
  b.points - a.points ||
  a.passerName.localeCompare(b.passerName) ||
  a.scorerName.localeCompare(b.scorerName)

/** "12 of 40 pairs", or the count alone when all are shown. */
export function assistCount(shown: number, total: number): string {
  if (total === 0) return ''
  return shown < total ? `${shown} of ${total} pairs` : `${total} ${total === 1 ? 'pair' : 'pairs'}`
}

export const pctText = (share: number): string => `${(100 * share).toFixed(1)}%`
