import { addFavourite, listFavouriteRows, removeFavourite } from '@main/db/repos/favourites'
import type { Db } from '@main/db/connection'
import {
  emptyFavourites,
  type Favourite,
  type FavouriteKind,
  type FavouritesByLeague
} from '@shared/favourites'
import { pairedLeague, type LeagueId } from '@shared/leagues'

/**
 * A league's players' ids in its paired league, for those of `ids` who are linked (D46): id here →
 * id there. It answers an empty map, and never fails, where the links file or the pair is absent.
 */
export type PairedIds = (league: LeagueId, ids: string[]) => Promise<Map<string, string>>

/**
 * Every league's favourites (D49): the stars given in each league, then, for a linked player starred
 * in the paired league, that player's id here, named as starred and marked `from` that league. The
 * link is read now, not when the star was given, so a link made later (a college favourite drafted the
 * next year) carries the star with nothing to do, and a link dropped takes it away.
 */
export async function readFavourites(db: Db, paired: PairedIds): Promise<FavouritesByLeague> {
  const out = emptyFavourites()
  const rows = listFavouriteRows(db)
  for (const row of rows) out[row.league].push(row)
  for (const league of Object.keys(out) as LeagueId[]) {
    const other = pairedLeague(league)
    if (!other) continue
    const theirs = rows.filter((r) => r.league === other && r.kind === 'player')
    if (!theirs.length) continue
    const here = await paired(
      other,
      theirs.map((r) => r.id)
    )
    const own = new Set(out[league].filter((f) => f.kind === 'player').map((f) => f.id))
    const followed: Favourite[] = []
    for (const r of theirs) {
      const id = here.get(r.id)
      if (id === undefined || own.has(id)) continue
      own.add(id)
      followed.push({ ...r, league, id, from: other })
    }
    out[league] = [...out[league], ...followed].sort((a, b) =>
      a.starredAt < b.starredAt ? -1 : a.starredAt > b.starredAt ? 1 : 0
    )
  }
  return out
}

export function starFavourite(
  db: Db,
  league: LeagueId,
  kind: FavouriteKind,
  id: string,
  name: string,
  now: string
): void {
  addFavourite(db, league, kind, id, name, now)
}

/**
 * Takes the star away from a player or team in a league. For a linked player it goes in both leagues
 * of the pair, whichever side it was given on, since the star belongs to the person (D49).
 */
export async function unstarFavourite(
  db: Db,
  paired: PairedIds,
  league: LeagueId,
  kind: FavouriteKind,
  id: string
): Promise<void> {
  removeFavourite(db, league, kind, id)
  const other = pairedLeague(league)
  if (kind !== 'player' || !other) return
  const there = (await paired(league, [id])).get(id)
  if (there !== undefined) removeFavourite(db, other, 'player', there)
}
