import { useSyncExternalStore } from 'react'
import type { NavLocation } from '@/lib/navHistory'
import { otherLines } from '@/lib/stats/careerStrip'
import type { LeagueHolds } from '@/lib/stats/downloads'
import { LEAGUES, type LeagueId } from '@shared/leagues'
import type { StatsOtherCareer } from '@shared/stats/types'

/**
 * The same player across the league menu (T1304.4). On a linked player's page, with the paired league
 * downloaded, choosing that league in the menu opens the player's page there instead of the league's
 * own screen. The page offers the move once its read of the other career is in; the menu takes it
 * only for the paired league and only while the page that offered it is on screen. Everything else
 * switches as it always has (D35).
 */
export interface PlayerSwitch {
  /** The league and player on screen that offer the move. */
  from: LeagueId
  player: string
  /** The paired league, and the player's page there. */
  to: LeagueId
  location: NavLocation & { season: number }
  /** Their name in that league. */
  name: string
}

/**
 * The move a player's page offers, from its read of the other career: null with no link, with the
 * paired league not ready to show a page, or with no season there (a draftee who has not played, who
 * has no page to open). The page opens on the Overview, in their latest season in that league: the
 * league's default scope where they play now, and for a player who has left college their last
 * college season, where the page has their games.
 */
export function playerSwitch(
  league: LeagueId,
  player: string,
  career: StatsOtherCareer | null,
  otherHolds: LeagueHolds | undefined
): PlayerSwitch | null {
  if (!career?.link || career.league === null || otherHolds !== 'ready') return null
  const id = career.link.playerId
  if (id === null) return null
  const other = LEAGUES[career.league]
  const last = otherLines(career.seasons, other).at(-1)?.season
  if (last === undefined) return null
  return {
    from: league,
    player,
    to: other.id,
    name: career.link.name,
    location: {
      league: other.id,
      screen: 'player',
      team: null,
      player: { id, position: null },
      season: last,
      playerTab: 'overview'
    }
  }
}

/** Where choosing `to` in the menu goes from `from`: the player's page, or null to switch as before. */
export function switchTarget(
  offered: PlayerSwitch | null,
  from: LeagueId,
  to: LeagueId
): NavLocation | null {
  return offered && offered.from === from && offered.to === to ? offered.location : null
}

/** The paired league's second line in the menu while the move is offered: "Cooper Flagg’s page". */
export function switchLine(
  offered: PlayerSwitch | null,
  from: LeagueId,
  to: LeagueId
): string | null {
  return switchTarget(offered, from, to) && offered ? `${offered.name}’s page` : null
}

// The one move offered now, held here so the league menu in the nav can read it without the shell
// building again when a page's read comes in.
let offered: PlayerSwitch | null = null
const listeners = new Set<() => void>()

function set(next: PlayerSwitch | null): void {
  if (next === offered) return
  offered = next
  for (const listener of listeners) listener()
}

/** A page offers its move; it withdraws it when it leaves or the move changes. */
export function offerSwitch(next: PlayerSwitch): void {
  set(next)
}

/** Withdraws a move, only if it is still the one offered (a newer page may have taken its place). */
export function withdrawSwitch(was: PlayerSwitch): void {
  if (offered === was) set(null)
}

export const offeredSwitch = (): PlayerSwitch | null => offered

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The move offered now; the menu re-renders when it changes. */
export const useOfferedSwitch = (): PlayerSwitch | null =>
  useSyncExternalStore(subscribe, offeredSwitch)
