import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { Api } from '@shared/ipc'
import {
  emptyFavourites,
  type Favourite,
  type FavouriteKind,
  type FavouritesByLeague
} from '@shared/favourites'
import type { LeagueId } from '@shared/leagues'

/**
 * Favourites in the renderer (D49): the one mechanism every screen reads, `useFavourites()`, fed by
 * `FavouritesProvider` above the shell (`App.tsx`), which outlives a league switch. It holds every
 * league's favourites as `metis.db` and the links answer them, the league on screen's as sets, and
 * a toggle that shows at once and is then replaced by what the main process answers.
 * `docs/reference/stats-screens.md`, "Favourites", says what reads it.
 */
export interface Favourites {
  /** The league on screen's favourite player ids, a linked player starred in the paired league included. */
  players: ReadonlySet<string>
  /** The league on screen's favourite team ids. */
  teams: ReadonlySet<string>
  isFavourite(kind: FavouriteKind, id: string): boolean
  /** Stars it, or takes the star away, in the league on screen. */
  toggle(kind: FavouriteKind, id: string, name: string): void
  /** Every league's favourites, for the Favourites page: one read, each league's in starred order. */
  all: FavouritesByLeague
  /** False until the first read is in. */
  ready: boolean
}

export interface FavouriteSets {
  players: ReadonlySet<string>
  teams: ReadonlySet<string>
}

/** A league's favourites as two sets of ids, players and teams. */
export function setsOf(list: readonly Favourite[]): FavouriteSets {
  return {
    players: new Set(list.filter((f) => f.kind === 'player').map((f) => f.id)),
    teams: new Set(list.filter((f) => f.kind === 'team').map((f) => f.id))
  }
}

/**
 * What a toggle shows before the main process answers: the star given or gone in the league on screen.
 * The paired league's side of a linked player waits for the answer, which reads the links.
 */
export function toggled(
  all: FavouritesByLeague,
  league: LeagueId,
  kind: FavouriteKind,
  id: string,
  name: string,
  on: boolean,
  now: string
): FavouritesByLeague {
  const list = all[league] ?? []
  const rest = list.filter((f) => !(f.kind === kind && f.id === id))
  const next = on
    ? [...rest, { league, kind, id, name, starredAt: now, from: null } satisfies Favourite]
    : rest
  return { ...all, [league]: next }
}

/** The star's label, which names who it is for. */
export function favouriteLabel(name: string, on: boolean): string {
  return on ? `Remove ${name} from favourites` : `Add ${name} to favourites`
}

const isoNow = (): string => new Date().toISOString()

const NO_SETS: FavouriteSets = { players: new Set(), teams: new Set() }

/** Outside a provider (a screen rendered alone, as in a test) there are no favourites and no star. */
const INERT: Favourites = {
  ...NO_SETS,
  isFavourite: () => false,
  toggle: () => undefined,
  all: emptyFavourites(),
  ready: false
}

export const FavouritesContext = createContext<Favourites | null>(null)

/** Whether a provider is above: the star shows only where it can do something. */
export const useHasFavourites = (): boolean => useContext(FavouritesContext) !== null

/** The league on screen's favourites, the toggle, and every league's (the one way in, D49). */
export function useFavourites(): Favourites {
  return useContext(FavouritesContext) ?? INERT
}

/**
 * The provider's state. Read once at launch and again on each league switch, so a link made since
 * (a college favourite drafted) shows on the next switch or launch. A toggle shows at once; the main
 * process's answer replaces it, unless a later toggle was made meanwhile, whose answer wins.
 */
export function useFavouritesState(
  league: LeagueId,
  source: Api['favourites'] = api.favourites,
  now: () => string = isoNow
): Favourites {
  const [all, setAll] = useState<FavouritesByLeague>(emptyFavourites)
  const [ready, setReady] = useState(false)
  // Each read or write takes a number; only the latest one's answer is kept.
  const seq = useRef(0)
  // What is on show, for a toggle to read without waiting for a render: set with the state.
  const allRef = useRef(all)
  const put = useCallback((next: FavouritesByLeague) => {
    allRef.current = next
    setAll(next)
  }, [])

  const settle = useCallback(
    (ask: () => Promise<FavouritesByLeague>, write: boolean): void => {
      const answered = (mine: number) => (answer: FavouritesByLeague) => {
        if (mine !== seq.current) return
        put(answer)
        setReady(true)
      }
      const mine = ++seq.current
      void ask().then(answered(mine), (err: unknown) => {
        console.error(`favourites: the ${write ? 'change' : 'read'} failed`, err)
        // A failed change goes back to what is stored, whatever the toggle showed.
        if (!write || mine !== seq.current) return
        const again = ++seq.current
        void source
          .all()
          .then(answered(again), (e: unknown) => console.error('favourites: the read failed', e))
      })
    },
    [source, put]
  )

  useEffect(() => {
    settle(() => source.all(), false)
  }, [league, source, settle])

  const sets = useMemo(() => setsOf(all[league] ?? []), [all, league])

  const toggle = useCallback(
    (kind: FavouriteKind, id: string, name: string) => {
      const current = allRef.current
      const on = !(current[league] ?? []).some((f) => f.kind === kind && f.id === id)
      put(toggled(current, league, kind, id, name, on, now()))
      settle(
        () => (on ? source.add(league, kind, id, name) : source.remove(league, kind, id)),
        true
      )
    },
    [league, source, now, settle, put]
  )

  return useMemo(
    () => ({
      players: sets.players,
      teams: sets.teams,
      isFavourite: (kind: FavouriteKind, id: string) =>
        (kind === 'player' ? sets.players : sets.teams).has(id),
      toggle,
      all,
      ready
    }),
    [sets, toggle, all, ready]
  )
}

/**
 * A favourite row's gold edge (T1601.2): 2 px of `--fav` inset on its left, a shadow, so the row keeps
 * its width and height. A row's own inset edge, such as the rail's keyboard cursor, is given after it
 * and wins while it rests there (`cn` keeps the last shadow).
 */
export const FAV_EDGE = 'shadow-[inset_2px_0_0_var(--fav)]'

/** The edge's class for a row, or nothing for a row that is not a favourite. */
export const favouriteEdge = (on: boolean): string => (on ? FAV_EDGE : '')

/** Whether either of a game's teams is a favourite: its card gets the edge. */
export const gameHasFavourite = (teams: ReadonlySet<string>, ids: readonly string[]): boolean =>
  ids.some((id) => teams.has(id))

/**
 * Points in drawing order with the favourites last, so they sit above the others; the order among the
 * rest, and among the favourites, is kept.
 */
export function favouritesLast<T>(points: readonly T[], isFavourite: (p: T) => boolean): T[] {
  return [...points.filter((p) => !isFavourite(p)), ...points.filter(isFavourite)]
}
