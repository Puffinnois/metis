import { describe, expect, it } from 'vitest'
import { openDatabase } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { addFavourite, listFavouriteRows } from '@main/db/repos/favourites'
import { readFavourites, unstarFavourite, type PairedIds } from '@main/favourites'
import { pairOf, type LeagueId } from '@shared/leagues'

/**
 * A favourite follows the person (D49, D46): a linked player's star given in one league of a pair
 * reads as a favourite in the other, through the links as they are when read.
 */
type Link = { college: string; pro: string | null }

/** The links worker's answer over a small set of links, as `leagueControl.pairedIds` gives it. */
function pairedFrom(links: Link[], pair: { college: LeagueId; pro: LeagueId }): PairedIds {
  return async (league, ids) => {
    const out = new Map<string, string>()
    if (pairOf(league)?.college !== pair.college) return out
    for (const l of links) {
      if (l.pro === null) continue
      if (league === pair.college && ids.includes(l.college)) out.set(l.college, l.pro)
      if (league === pair.pro && ids.includes(l.pro)) out.set(l.pro, l.college)
    }
    return out
  }
}

const MEN = { college: 'ncaam', pro: 'nba' } as const

function db(): ReturnType<typeof openDatabase> {
  const d = openDatabase(':memory:')
  migrate(d)
  return d
}

describe('favourites read through the links', () => {
  it("shows a linked college player's star in the NBA under their NBA id, named as starred", async () => {
    const d = db()
    // Cooper Flagg: ESPN's college id, and the NBA's own id for him.
    addFavourite(d, 'ncaam', 'player', '4870562', 'Cooper Flagg', '2026-11-22T10:00:00Z')
    const all = await readFavourites(d, pairedFrom([{ college: '4870562', pro: '1642843' }], MEN))
    expect(all.ncaam).toMatchObject([{ id: '4870562', from: null }])
    expect(all.nba).toEqual([
      {
        league: 'nba',
        kind: 'player',
        id: '1642843',
        name: 'Cooper Flagg',
        starredAt: '2026-11-22T10:00:00Z',
        from: 'ncaam'
      }
    ])
    // The row stays where the star was given.
    expect(listFavouriteRows(d).map((f) => f.league)).toEqual(['ncaam'])
    expect(all.wnba).toEqual([])
  })

  it('follows from the professional side to the college one too', async () => {
    const d = db()
    addFavourite(d, 'nba', 'player', '1642843', 'Cooper Flagg', 't1')
    const all = await readFavourites(d, pairedFrom([{ college: '4870562', pro: '1642843' }], MEN))
    expect(all.ncaam).toMatchObject([{ id: '4870562', from: 'nba' }])
  })

  it("keeps an unlinked player's star in their own league", async () => {
    const d = db()
    addFavourite(d, 'nba', 'player', '2544', 'LeBron James', 't1')
    addFavourite(d, 'ncaam', 'player', '5000', 'A Senior', 't2')
    const all = await readFavourites(d, pairedFrom([{ college: '4870562', pro: '1642843' }], MEN))
    expect(all.nba.map((f) => f.id)).toEqual(['2544'])
    expect(all.ncaam.map((f) => f.id)).toEqual(['5000'])
  })

  it('never follows a team, and never crosses into the other pair', async () => {
    const d = db()
    addFavourite(d, 'ncaam', 'team', '150', 'Duke Blue Devils', 't1')
    addFavourite(d, 'ncaaw', 'player', '4870562', 'Same Number', 't2')
    const all = await readFavourites(d, pairedFrom([{ college: '4870562', pro: '1642843' }], MEN))
    expect(all.nba).toEqual([])
    expect(all.wnba).toEqual([])
  })

  it('carries a star once a link arrives later, with nothing written', async () => {
    const d = db()
    addFavourite(d, 'ncaam', 'player', '5101', 'A Freshman', 't1')
    expect((await readFavourites(d, pairedFrom([], MEN))).nba).toEqual([])
    // Drafted the next year: the links step makes the link, and the next read has it.
    const drafted = pairedFrom([{ college: '5101', pro: '1700001' }], MEN)
    expect((await readFavourites(d, drafted)).nba).toMatchObject([{ id: '1700001', from: 'ncaam' }])
  })

  it('leaves out a link to a draftee with no professional id', async () => {
    const d = db()
    addFavourite(d, 'ncaam', 'player', '5102', 'Drafted Abroad', 't1')
    const all = await readFavourites(d, pairedFrom([{ college: '5102', pro: null }], MEN))
    expect(all.nba).toEqual([])
  })

  it('is the league’s own where the links are absent', async () => {
    const d = db()
    addFavourite(d, 'ncaam', 'player', '4870562', 'Cooper Flagg', 't1')
    // `leagueControl.pairedIds` answers an empty map with no links file, never an error.
    const none: PairedIds = async () => new Map()
    const all = await readFavourites(d, none)
    expect(all.ncaam).toHaveLength(1)
    expect(all.nba).toEqual([])
  })

  it('lists a person starred on both sides once in each league', async () => {
    const d = db()
    addFavourite(d, 'ncaam', 'player', '4870562', 'Cooper Flagg', 't1')
    addFavourite(d, 'nba', 'player', '1642843', 'Cooper Flagg', 't2')
    const all = await readFavourites(d, pairedFrom([{ college: '4870562', pro: '1642843' }], MEN))
    expect(all.nba).toMatchObject([{ id: '1642843', from: null }])
    expect(all.ncaam).toMatchObject([{ id: '4870562', from: null }])
  })

  it('keeps each league in starred order, followed stars among its own', async () => {
    const d = db()
    addFavourite(d, 'nba', 'player', '2544', 'LeBron James', '2026-11-22T09:00:00Z')
    addFavourite(d, 'ncaam', 'player', '4870562', 'Cooper Flagg', '2026-11-22T10:00:00Z')
    addFavourite(d, 'nba', 'team', '1610612738', 'Boston Celtics', '2026-11-22T11:00:00Z')
    const all = await readFavourites(d, pairedFrom([{ college: '4870562', pro: '1642843' }], MEN))
    expect(all.nba.map((f) => f.name)).toEqual(['LeBron James', 'Cooper Flagg', 'Boston Celtics'])
  })
})

describe('unstarring a linked player', () => {
  const links = pairedFrom([{ college: '4870562', pro: '1642843' }], MEN)

  it('from the side it was given on removes it from both', async () => {
    const d = db()
    addFavourite(d, 'ncaam', 'player', '4870562', 'Cooper Flagg', 't1')
    await unstarFavourite(d, links, 'ncaam', 'player', '4870562')
    const all = await readFavourites(d, links)
    expect([...all.nba, ...all.ncaam]).toEqual([])
  })

  it('from the paired side removes the star where it was given', async () => {
    const d = db()
    addFavourite(d, 'ncaam', 'player', '4870562', 'Cooper Flagg', 't1')
    await unstarFavourite(d, links, 'nba', 'player', '1642843')
    expect(listFavouriteRows(d)).toEqual([])
  })

  it('removes both rows of a person starred on both sides', async () => {
    const d = db()
    addFavourite(d, 'ncaam', 'player', '4870562', 'Cooper Flagg', 't1')
    addFavourite(d, 'nba', 'player', '1642843', 'Cooper Flagg', 't2')
    await unstarFavourite(d, links, 'nba', 'player', '1642843')
    expect(listFavouriteRows(d)).toEqual([])
  })

  it("leaves another player's star and a team's alone", async () => {
    const d = db()
    addFavourite(d, 'nba', 'player', '2544', 'LeBron James', 't1')
    addFavourite(d, 'nba', 'team', '1642843', 'Same Number', 't2')
    addFavourite(d, 'ncaam', 'player', '4870562', 'Cooper Flagg', 't3')
    await unstarFavourite(d, links, 'nba', 'player', '1642843')
    expect(listFavouriteRows(d).map((f) => `${f.league}:${f.kind}:${f.id}`)).toEqual([
      'nba:player:2544',
      'nba:team:1642843'
    ])
  })
})
