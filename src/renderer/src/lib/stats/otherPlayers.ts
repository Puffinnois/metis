import type { NavLocation } from '@/lib/navHistory'
import type { LeagueHolds } from '@/lib/stats/downloads'
import { searchKey } from '@/lib/stats/leaderboard'
import { LEAGUES, type League, type LeagueId } from '@shared/leagues'
import type { StatsOtherPlayer } from '@shared/stats/types'

/**
 * The player search's rows from the paired league (T1304.4): its linked players who have no page in
 * the league on screen (`stats.otherPlayers`), in practice the draftees who never played in the
 * professional league. Listed under the league's own results with their league named, never ranked
 * among them (D35, D47). A player with a page in both leagues is never here: the league on screen's
 * own row is theirs.
 */

/** Letters a search needs before the other league is searched: one letter would list them all. */
export const OTHER_SEARCH_MIN = 2

export interface OtherRow {
  key: string
  name: string
  league: LeagueId
  leagueName: string
  /** What follows the league on the row's second line: their last team and season, or the offer. */
  detail: string
  /** Their page in that league, where it can be shown now. */
  open: NavLocation | null
  /** Where it cannot: the Data panel on that league, which the career strip's offer opens too. */
  data: LeagueId | null
  /** The row's hover and accessible name: what a click does. */
  title: string
}

/** The heading over the rows: their league, and the fact that puts them there. */
export function otherHeading(other: League, onScreen: League): string {
  return `${other.name} · No ${onScreen.name} games`
}

/**
 * The paired league's rows a search finds. With that league ready, each opens the player's page there
 * on the Overview, in their last season (where the page has their games). With it off, each opens the
 * Data panel on it, for its download; with it loading, the same, where its progress shows. Nothing
 * opens a page that is not there.
 */
export function otherRows(
  players: readonly StatsOtherPlayer[] | null,
  search: string,
  holds: LeagueHolds | undefined,
  on: boolean
): OtherRow[] {
  const needle = searchKey(search.trim())
  // Until the downloads are read, what a row would do is not known: none is listed.
  if (!players || holds === undefined || needle.length < OTHER_SEARCH_MIN) return []
  return players
    .filter((p) => searchKey(p.name).includes(needle))
    .map((p) => {
      const other = LEAGUES[p.league]
      const season = p.lastSeason !== null ? other.seasonLabel(p.lastSeason) : null
      const where = [p.team, season].filter(Boolean).join(', ')
      const key = `${p.league}:${p.playerId ?? p.name}`
      if (holds === 'ready' && p.playerId !== null) {
        return {
          key,
          name: p.name,
          league: other.id,
          leagueName: other.name,
          detail: where,
          open: {
            league: other.id,
            screen: 'player',
            team: null,
            player: { id: p.playerId, position: null },
            ...(p.lastSeason !== null ? { season: p.lastSeason } : {}),
            playerTab: 'overview'
          },
          data: null,
          title: `Open ${p.name}’s ${other.name} page${season ? `, ${season}` : ''}`
        }
      }
      const loading = holds === 'notBuilt' || (holds === 'off' && on)
      return {
        key,
        name: p.name,
        league: other.id,
        leagueName: other.name,
        detail: loading ? 'loading' : 'not downloaded',
        open: null,
        data: other.id,
        title: loading
          ? `${other.name} is loading: its progress is in the Data panel`
          : `Download ${other.name} in the Data panel for ${p.name}’s page`
      }
    })
}
