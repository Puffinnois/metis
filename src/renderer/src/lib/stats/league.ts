import { useSyncExternalStore } from 'react'
import { DEFAULT_LEAGUE, leagueOf, PER_MINUTE, type League, type LeagueId } from '@shared/leagues'

/**
 * The league on screen, held in this one place (D35: the whole app shows one league at a time).
 * Screens read it with `useLeague()`, every IPC call passes its id, and what reads differently by
 * league (season labels, per-minute modes, season types) reads it from the registry through here.
 * The app opens on the NBA; the league menu (Plan T1301.3) is what calls `setLeague`.
 */
let current: League = leagueOf(DEFAULT_LEAGUE)
const listeners = new Set<() => void>()

export const currentLeague = (): League => current

export function setLeague(id: LeagueId): void {
  const next = leagueOf(id)
  if (next === current) return
  current = next
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
