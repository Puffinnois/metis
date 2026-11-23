import { describe, expect, it } from 'vitest'
import { openDatabase } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { migrations } from '@main/db/migrations'
import { addFavourite, listFavouriteRows, removeFavourite } from '@main/db/repos/favourites'
import { saveStatsView, listStatsViews } from '@main/db/repos/statsViews'

/** The favourites table in `metis.db` (D49): a star per league, kind and the league's own id. */
function fresh(): ReturnType<typeof openDatabase> {
  const db = openDatabase(':memory:')
  migrate(db)
  return db
}

describe('favourites repo', () => {
  it('adds and removes, oldest star first, named as starred', () => {
    const db = fresh()
    addFavourite(db, 'nba', 'player', '1628369', '  Jayson Tatum ', '2026-11-22T10:00:00Z')
    addFavourite(db, 'nba', 'team', '1610612738', 'Boston Celtics', '2026-11-22T10:01:00Z')
    expect(listFavouriteRows(db)).toEqual([
      {
        league: 'nba',
        kind: 'player',
        id: '1628369',
        name: 'Jayson Tatum',
        starredAt: '2026-11-22T10:00:00Z',
        from: null
      },
      {
        league: 'nba',
        kind: 'team',
        id: '1610612738',
        name: 'Boston Celtics',
        starredAt: '2026-11-22T10:01:00Z',
        from: null
      }
    ])
    removeFavourite(db, 'nba', 'player', '1628369')
    expect(listFavouriteRows(db).map((f) => f.id)).toEqual(['1610612738'])
  })

  it('keeps the first star when the same favourite is starred again', () => {
    const db = fresh()
    addFavourite(db, 'nba', 'player', '1', 'First Name', 't1')
    addFavourite(db, 'nba', 'player', '1', 'Renamed', 't2')
    expect(listFavouriteRows(db)).toMatchObject([{ id: '1', name: 'First Name', starredAt: 't1' }])
  })

  it('keeps leagues apart, even where their ids are the same number', () => {
    const db = fresh()
    // ESPN's ids in the college leagues and the NBA's own can collide; a player and a team too.
    addFavourite(db, 'nba', 'player', '4433', 'NBA Player', 't1')
    addFavourite(db, 'ncaam', 'player', '4433', 'College Player', 't2')
    addFavourite(db, 'ncaam', 'team', '4433', 'College Team', 't3')
    expect(listFavouriteRows(db).map((f) => `${f.league}:${f.kind}:${f.name}`)).toEqual([
      'nba:player:NBA Player',
      'ncaam:player:College Player',
      'ncaam:team:College Team'
    ])
    removeFavourite(db, 'ncaam', 'player', '4433')
    expect(listFavouriteRows(db).map((f) => `${f.league}:${f.kind}`)).toEqual([
      'nba:player',
      'ncaam:team'
    ])
  })

  it('removes nothing for a star it does not hold', () => {
    const db = fresh()
    addFavourite(db, 'wnba', 'team', '5', 'Las Vegas Aces', 't1')
    removeFavourite(db, 'wnba', 'player', '5')
    removeFavourite(db, 'nba', 'team', '5')
    expect(listFavouriteRows(db)).toHaveLength(1)
  })

  it('refuses a star with no id, no name or another kind', () => {
    const db = fresh()
    expect(() => addFavourite(db, 'nba', 'player', '', 'Someone', 't')).toThrow('no id')
    expect(() => addFavourite(db, 'nba', 'player', '1', '   ', 't')).toThrow('needs a name')
    expect(() => addFavourite(db, 'nba', 'game' as 'player', '1', 'A game', 't')).toThrow(
      'player or a team'
    )
    expect(listFavouriteRows(db)).toEqual([])
  })

  it('arrives on a database from before it, the saved views kept', () => {
    const db = openDatabase(':memory:')
    expect(migrate(db, migrations.slice(0, 3))).toBe(3)
    saveStatsView(
      db,
      'nba',
      'Guards',
      {
        entity: 'player',
        tab: 'G',
        columns: ['pts'],
        sort: { by: 'pts', dir: 'desc' },
        mode: 'raw',
        qualifiedOnly: true,
        team: null
      },
      't'
    )
    expect(migrate(db)).toBe(4)
    expect(listStatsViews(db, 'nba').map((v) => v.name)).toEqual(['Guards'])
    expect(listFavouriteRows(db)).toEqual([])
  })
})
