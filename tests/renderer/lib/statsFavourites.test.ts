// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  favouriteLabel,
  setsOf,
  toggled,
  useFavourites,
  useFavouritesState
} from '@/lib/stats/favourites'
import { emptyFavourites, type Favourite, type FavouritesByLeague } from '@shared/favourites'
import type { Api } from '@shared/ipc'
import type { LeagueId } from '@shared/leagues'

/** The renderer's one way to favourites (D49): sets for the league on screen, a toggle, every league. */
const fav = (over: Partial<Favourite>): Favourite => ({
  league: 'nba',
  kind: 'player',
  id: '1',
  name: 'Someone',
  starredAt: 't0',
  from: null,
  ...over
})

const byLeague = (over: Partial<FavouritesByLeague>): FavouritesByLeague => ({
  ...emptyFavourites(),
  ...over
})

describe('favourites logic', () => {
  it('splits a league’s favourites into player and team ids', () => {
    const sets = setsOf([
      fav({ id: '1628369' }),
      fav({ id: '1610612738', kind: 'team' }),
      fav({ id: '1642843', from: 'ncaam' })
    ])
    expect([...sets.players]).toEqual(['1628369', '1642843'])
    expect([...sets.teams]).toEqual(['1610612738'])
  })

  it('shows a toggle in the league on screen alone, the others untouched', () => {
    const before = byLeague({ ncaam: [fav({ league: 'ncaam', id: '1' })] })
    const on = toggled(before, 'nba', 'player', '1', 'Jayson Tatum', true, 't1')
    expect(on.nba).toEqual([fav({ id: '1', name: 'Jayson Tatum', starredAt: 't1' })])
    expect(on.ncaam).toBe(before.ncaam)
    const off = toggled(on, 'nba', 'player', '1', 'Jayson Tatum', false, 't2')
    expect(off.nba).toEqual([])
    // A team with the same id is another favourite.
    const team = toggled(on, 'nba', 'team', '1', 'A Team', true, 't3')
    expect(team.nba.map((f) => f.kind)).toEqual(['player', 'team'])
  })

  it('labels the star with whose it is', () => {
    expect(favouriteLabel('Jayson Tatum', false)).toBe('Add Jayson Tatum to favourites')
    expect(favouriteLabel('Boston Celtics', true)).toBe('Remove Boston Celtics from favourites')
  })

  it('is inert outside a provider', () => {
    const { result } = renderHook(() => useFavourites())
    expect(result.current.isFavourite('player', '1')).toBe(false)
    expect(result.current.ready).toBe(false)
    expect(() => result.current.toggle('player', '1', 'x')).not.toThrow()
  })
})

type Source = Api['favourites']

/** A main process that keeps rows and answers every league's, following no links. */
function fakeSource(initial: FavouritesByLeague = emptyFavourites()): Source & {
  stored: FavouritesByLeague
} {
  const s = {
    stored: initial,
    all: vi.fn(async () => s.stored),
    add: vi.fn(async (league: LeagueId, kind, id: string, name: string) => {
      s.stored = toggled(s.stored, league, kind, id, name, true, 'stored')
      return s.stored
    }),
    remove: vi.fn(async (league: LeagueId, kind, id: string) => {
      s.stored = toggled(s.stored, league, kind, id, '', false, 'stored')
      return s.stored
    })
  } as Source & { stored: FavouritesByLeague }
  return s
}

const now = (): string => 'now'

describe('useFavouritesState', () => {
  it('reads every league once, and gives the league on screen’s as sets', async () => {
    const source = fakeSource(
      byLeague({
        nba: [fav({ id: '1642843', from: 'ncaam' }), fav({ id: '2', kind: 'team' })],
        ncaam: [fav({ league: 'ncaam', id: '4870562' })]
      })
    )
    const { result } = renderHook(() => useFavouritesState('nba', source, now))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.isFavourite('player', '1642843')).toBe(true)
    expect(result.current.isFavourite('team', '2')).toBe(true)
    expect(result.current.isFavourite('player', '4870562')).toBe(false)
    // Every league's, in one read, for the Favourites page.
    expect(result.current.all.ncaam.map((f) => f.id)).toEqual(['4870562'])
    expect(source.all).toHaveBeenCalledTimes(1)
  })

  it('shows a toggle at once, then what the main process answers', async () => {
    const source = fakeSource()
    let release: () => void = () => {}
    vi.mocked(source.add).mockImplementationOnce(async (league, kind, id, name) => {
      await new Promise<void>((r) => (release = r))
      // The main process followed the link into the paired league.
      source.stored = byLeague({
        nba: [fav({ id, name })],
        ncaam: [fav({ league, kind, id: '99', name, from: 'nba' })]
      })
      return source.stored
    })
    const { result } = renderHook(() => useFavouritesState('nba', source, now))
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.toggle('player', '1642843', 'Cooper Flagg'))
    expect(result.current.isFavourite('player', '1642843')).toBe(true)
    expect(source.add).toHaveBeenCalledWith('nba', 'player', '1642843', 'Cooper Flagg')
    expect(result.current.all.ncaam).toEqual([])
    await act(async () => release())
    await waitFor(() => expect(result.current.all.ncaam.map((f) => f.id)).toEqual(['99']))
    act(() => result.current.toggle('player', '1642843', 'Cooper Flagg'))
    expect(result.current.isFavourite('player', '1642843')).toBe(false)
    expect(source.remove).toHaveBeenCalledWith('nba', 'player', '1642843')
  })

  it('keeps the latest toggle’s answer when an earlier one answers last', async () => {
    const source = fakeSource()
    const slow: (() => void)[] = []
    vi.mocked(source.add).mockImplementationOnce(async () => {
      await new Promise<void>((r) => slow.push(r))
      return byLeague({ nba: [fav({ id: '1' })] })
    })
    const { result } = renderHook(() => useFavouritesState('nba', source, now))
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.toggle('player', '1', 'One'))
    act(() => result.current.toggle('player', '1', 'One'))
    await waitFor(() => expect(source.remove).toHaveBeenCalled())
    await act(async () => slow[0]())
    expect(result.current.isFavourite('player', '1')).toBe(false)
  })

  it('goes back to what is stored when a change fails', async () => {
    const source = fakeSource()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(source.add).mockRejectedValueOnce(new Error('A favourite needs a name'))
    const { result } = renderHook(() => useFavouritesState('nba', source, now))
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.toggle('player', '1', ''))
    expect(result.current.isFavourite('player', '1')).toBe(true)
    await waitFor(() => expect(result.current.isFavourite('player', '1')).toBe(false))
    expect(source.all).toHaveBeenCalledTimes(2)
    error.mockRestore()
  })

  it('reads again on a league switch, and toggles in the league on screen', async () => {
    const source = fakeSource(byLeague({ ncaam: [fav({ league: 'ncaam', id: '7' })] }))
    const { result, rerender } = renderHook(
      ({ league }: { league: LeagueId }) => useFavouritesState(league, source, now),
      { initialProps: { league: 'nba' as LeagueId } }
    )
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.players.size).toBe(0)
    rerender({ league: 'ncaam' })
    await waitFor(() => expect(source.all).toHaveBeenCalledTimes(2))
    expect(result.current.isFavourite('player', '7')).toBe(true)
    act(() => result.current.toggle('team', '150', 'Duke Blue Devils'))
    expect(source.add).toHaveBeenCalledWith('ncaam', 'team', '150', 'Duke Blue Devils')
  })
})
