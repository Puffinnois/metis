import { useSyncExternalStore } from 'react'
import {
  DEFAULT_LEAGUE,
  isLeagueId,
  leagueOf,
  PER_MINUTE,
  type League,
  type LeagueId
} from '@shared/leagues'

/**
 * The league on screen, held in this one place (D35: the whole app shows one league at a time).
 * Screens read it with `useLeague()`, every IPC call passes its id, and what reads differently by
 * league (season labels, per-minute modes, season types) reads it from the registry through here.
 * The league menu beside the mark calls `setLeague`, and the choice is kept across launches.
 */
const KEY = 'metis.league'

/**
 * The league left on screen at the last launch; the NBA when none is saved, the saved one is not in
 * the registry, or storage is unavailable. Kept beside the theme: it is how the window was left, not a
 * setting of the stats, and only the renderer reads it.
 */
export function savedLeague(): LeagueId {
  try {
    const saved = localStorage.getItem(KEY)
    return isLeagueId(saved) ? saved : DEFAULT_LEAGUE
  } catch {
    return DEFAULT_LEAGUE
  }
}

let current: League = leagueOf(savedLeague())
const listeners = new Set<() => void>()

export const currentLeague = (): League => current

export function setLeague(id: LeagueId): void {
  const next = leagueOf(id)
  if (next === current) return
  current = next
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // The league still switches; it is only not remembered.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The league on screen; a component re-renders when it changes. */
export const useLeague = (): League => useSyncExternalStore(subscribe, currentLeague)

/** A season as the league on screen writes it: `2025-26` in the NBA, `2026` in the WNBA. */
export const seasonLabel = (season: number): string => current.seasonLabel(season)

/** "Per 36", "Per 48": the league's per-minute modes, in order. */
export const perMinuteModes = (): { value: keyof typeof PER_MINUTE; label: string }[] =>
  current.perMinute.map((m) => ({ value: m, label: `Per ${PER_MINUTE[m]}` }))

/**
 * Where a league with no data is turned on: the one place a screen's "No WNBA stats yet" links to.
 * Null until the Data panel can turn a league on (Plan T1301.4), so the reason stands alone.
 */
export const TURN_ON: { label: string } | null = null
