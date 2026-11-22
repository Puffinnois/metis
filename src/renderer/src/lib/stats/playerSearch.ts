import type { NavLocation } from '@/lib/navHistory'
import { searchKey } from '@/lib/stats/leaderboard'
import type { League } from '@shared/leagues'
import type { StatsIndexedPlayer } from '@shared/stats/types'

/**
 * The player search's reach beyond the rail's ranked rows (T1304.5). The rail lists the scope's top
 * rows by a metric, so a search there found only those: nobody outside the first 1,000, nobody who did
 * not play in the season. Every player with a page in the league is in the league's player index
 * (`stats.playerIndex`, read once); a name that matches one the ranked rows do not hold is listed
 * below them, unranked, with their last season and team, and opens their page in that season.
 */

/** Letters a search needs before the index is searched: one letter would list thousands. */
export const INDEX_SEARCH_MIN = 2

/** Rows listed at most; the rest are counted, and more letters narrow them. */
export const INDEX_ROWS = 25

export const MORE_HEADING = 'Not ranked here'

/** The index with each name's search key worked out once, not at every key typed. */
export interface PlayerIndex {
  players: readonly StatsIndexedPlayer[]
  keys: readonly string[]
}

export function playerIndex(players: readonly StatsIndexedPlayer[]): PlayerIndex {
  return { players, keys: players.map((p) => searchKey(p.name)) }
}

export interface MoreRow {
  id: string
  name: string
  /** Their last team and season: "DUKE · 2024-25". */
  detail: string
  /** The season their page opens in: their last. */
  season: number
  /** The row's hover and accessible name: what a click does. */
  title: string
}

export interface MoreRows {
  rows: MoreRow[]
  /** Matches past the rows listed. */
  hidden: number
}

const NONE: MoreRows = { rows: [], hidden: 0 }

/**
 * The index's players a search finds that the ranked rows do not list (`listed`), newest season first
 * as the index is ordered, then by name. Nothing until the index is read or the search has two letters.
 */
export function moreRows(
  index: PlayerIndex | null,
  search: string,
  listed: ReadonlySet<string>,
  league: League
): MoreRows {
  const needle = searchKey(search.trim())
  if (!index || needle.length < INDEX_SEARCH_MIN) return NONE
  const rows: MoreRow[] = []
  let hidden = 0
  index.players.forEach((p, i) => {
    if (!index.keys[i].includes(needle) || listed.has(p.id)) return
    if (rows.length >= INDEX_ROWS) {
      hidden++
      return
    }
    const season = league.seasonLabel(p.lastSeason)
    rows.push({
      id: p.id,
      name: p.name,
      detail: [p.team, season].filter(Boolean).join(' · '),
      season: p.lastSeason,
      title: `Open ${p.name}’s page, ${season}`
    })
  })
  return { rows, hidden }
}

/**
 * The rail's count line, which counts what is listed and says what it is. With ranked rows alone, the
 * line as it has always read ("24 PLAYERS · BOS · WHOLE SEASON"); with rows found beyond them (the
 * league's unranked players, the paired league's), never "0" over a list: "2 RANKED · 3 MORE", or
 * "3 PLAYERS · NOT RANKED" where none of them is ranked. Upper case, as the line is set.
 */
export function railCount(
  ranked: number,
  more: number,
  team: string | null | undefined,
  range: string
): string {
  if (more === 0) return `${ranked} PLAYERS · ${team ? `${team} · ` : ''}${range.toUpperCase()}`
  if (ranked === 0) return `${more} ${more === 1 ? 'PLAYER' : 'PLAYERS'} · NOT RANKED`
  return `${ranked} RANKED · ${more} MORE`
}

/** The count under the rows when there are more than are listed. */
export function hiddenNote(hidden: number): string | null {
  return hidden > 0 ? `${hidden} more. Type more of the name.` : null
}

/**
 * Where a row opens: the player in the season on screen is a move within the rail, as a ranked row's
 * is; one whose last season is another opens their page in that season, a page of its own for Back.
 */
export function moreTarget(
  row: Pick<MoreRow, 'id' | 'season'>,
  league: League,
  scopeSeason: number
): NavLocation | null {
  if (row.season === scopeSeason) return null
  return {
    league: league.id,
    screen: 'player',
    team: null,
    player: { id: row.id, position: null },
    season: row.season
  }
}
