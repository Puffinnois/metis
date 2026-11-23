import {
  FAVOURITE_ID_MAX,
  FAVOURITE_NAME_MAX,
  isFavouriteKind,
  type Favourite,
  type FavouriteKind
} from '@shared/favourites'
import { isLeagueId, type LeagueId } from '@shared/leagues'
import type { Db } from '../connection'

interface FavouriteRow {
  league: string
  kind: string
  entity_id: string
  name: string
  starred_at: string
}

const idOk = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= FAVOURITE_ID_MAX

/**
 * Every star as given, every league's, oldest first (D49). These are the rows alone: a linked player's
 * star in the paired league is added when read (`src/main/favourites.ts`). A row naming a league or a
 * kind this build does not know is left out, never the whole list's failure.
 */
export function listFavouriteRows(db: Db): Favourite[] {
  const rows = db
    .prepare(
      `SELECT league, kind, entity_id, name, starred_at FROM favourites
       ORDER BY starred_at, league, kind, entity_id`
    )
    .all() as unknown as FavouriteRow[]
  return rows.flatMap((r) =>
    isLeagueId(r.league) && isFavouriteKind(r.kind)
      ? [
          {
            league: r.league,
            kind: r.kind,
            id: r.entity_id,
            name: r.name,
            starredAt: r.starred_at,
            from: null
          }
        ]
      : []
  )
}

/** Stars a player or team in a league; starring it again keeps the first star and its name. */
export function addFavourite(
  db: Db,
  league: LeagueId,
  kind: FavouriteKind,
  id: string,
  name: string,
  now: string
): void {
  if (!isFavouriteKind(kind)) throw new Error('Only a player or a team can be a favourite')
  if (!idOk(id)) throw new Error('This favourite has no id')
  const trimmed = (typeof name === 'string' ? name : '').trim().slice(0, FAVOURITE_NAME_MAX)
  if (!trimmed) throw new Error('A favourite needs a name')
  db.prepare(
    `INSERT INTO favourites (league, kind, entity_id, name, starred_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (league, kind, entity_id) DO NOTHING`
  ).run(league, kind, id, trimmed, now)
}

/** Removes a league's star of a player or team; one it does not hold removes nothing. */
export function removeFavourite(db: Db, league: LeagueId, kind: FavouriteKind, id: string): void {
  if (!isFavouriteKind(kind) || !idOk(id)) return
  db.prepare('DELETE FROM favourites WHERE league = ? AND kind = ? AND entity_id = ?').run(
    league,
    kind,
    id
  )
}
