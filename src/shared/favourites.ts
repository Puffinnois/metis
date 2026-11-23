import { LEAGUE_IDS, type LeagueId } from './leagues'

/** What can be starred (D49): a player or a team, never a game or a view. */
export type FavouriteKind = 'player' | 'team'

export const FAVOURITE_KINDS: readonly FavouriteKind[] = ['player', 'team']

/**
 * A favourite as a league sees it (D49). `id` is the player's or team's id in that league's stats
 * file, and `name` is the name as it read when starred, so a favourite whose file is gone or rebuilt
 * still has one. A linked player starred in the paired league is a favourite here too (D46): `from`
 * names the league where the star was given, and is null for a star given in this league.
 */
export interface Favourite {
  league: LeagueId
  kind: FavouriteKind
  id: string
  name: string
  /** When the star was given, ISO. */
  starredAt: string
  from: LeagueId | null
}

/** Every league's favourites, each league's in the order they were starred. */
export type FavouritesByLeague = Record<LeagueId, Favourite[]>

export const emptyFavourites = (): FavouritesByLeague =>
  Object.fromEntries(LEAGUE_IDS.map((id) => [id, []])) as unknown as FavouritesByLeague

export const isFavouriteKind = (v: unknown): v is FavouriteKind => v === 'player' || v === 'team'

/** The longest id and name kept; ids are digits in every league today. */
export const FAVOURITE_ID_MAX = 40
export const FAVOURITE_NAME_MAX = 120
