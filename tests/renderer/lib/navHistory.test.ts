// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { BACK_LIMIT, isBackGesture, useBackStack, type NavLocation } from '@/lib/navHistory'

const page = (screen: 'home' | 'games' | 'players'): NavLocation => ({
  league: 'nba',
  screen,
  team: null,
  player: null
})
const statsPlayer = (id: string, position: 'G' | null): NavLocation => ({
  league: 'nba',
  screen: 'player',
  team: null,
  player: { id, position }
})

describe('the back stack', () => {
  it('keeps the pages before, and going back does not add the page it leaves', () => {
    const { result } = renderHook(() => useBackStack())
    act(() => result.current.report(page('home')))
    expect(result.current.canGoBack).toBe(false)
    act(() => result.current.report(page('games')))
    act(() => result.current.report(statsPlayer('2544', null)))
    expect(result.current.canGoBack).toBe(true)

    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    expect(to).toEqual(page('games'))
    act(() => result.current.report(page('games')))
    act(() => {
      to = result.current.back()
    })
    expect(to).toEqual(page('home'))
    act(() => result.current.report(page('home')))
    expect(result.current.canGoBack).toBe(false)
    expect(result.current.back()).toBeNull()
  })

  it('takes the same page reported again, or the same player at a position, as no move', () => {
    const { result } = renderHook(() => useBackStack())
    act(() => result.current.report(statsPlayer('2544', null)))
    act(() => result.current.report(statsPlayer('2544', 'G')))
    act(() => result.current.report(statsPlayer('2544', 'G')))
    expect(result.current.canGoBack).toBe(false)
    act(() => result.current.report(page('players')))
    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    // The position it last had.
    expect(to).toEqual(statsPlayer('2544', 'G'))
  })

  it('takes a waiting dashboard getting its default as the same page', () => {
    const { result } = renderHook(() => useBackStack())
    act(() => result.current.report(statsPlayer('2544', null)))
    const waiting: NavLocation = { league: 'nba', screen: 'team', team: null, player: null }
    act(() => result.current.report(waiting))
    act(() => result.current.report({ ...waiting, team: 'DET' }))
    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    // The player before, not the waiting page.
    expect(to).toEqual(statsPlayer('2544', null))
  })

  it('takes the same screen in the other league as another page, with its own league', () => {
    const { result } = renderHook(() => useBackStack())
    act(() => result.current.report(statsPlayer('2544', null)))
    // The switch: the WNBA's player dashboard, waiting for its default player.
    act(() => result.current.report({ ...page('home'), league: 'wnba', screen: 'player' }))
    expect(result.current.canGoBack).toBe(true)
    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    // LeBron's page in the NBA, never under the WNBA's name.
    expect(to).toEqual(statsPlayer('2544', null))
  })

  it('does not take a dashboard getting its default in the other league as the same page', () => {
    const { result } = renderHook(() => useBackStack())
    const waiting: NavLocation = { league: 'wnba', screen: 'player', team: null, player: null }
    act(() => result.current.report(waiting))
    act(() => result.current.report(statsPlayer('2544', null)))
    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    expect(to).toEqual(waiting)
  })

  it(`keeps the last ${BACK_LIMIT} pages`, () => {
    const { result } = renderHook(() => useBackStack())
    act(() => {
      for (let i = 0; i <= BACK_LIMIT + 5; i++) result.current.report(statsPlayer(`p${i}`, null))
    })
    let n = 0
    for (;;) {
      let to: NavLocation | null = null
      act(() => {
        to = result.current.back()
      })
      if (!to) break
      act(() => result.current.report(to!))
      n++
    }
    expect(n).toBe(BACK_LIMIT)
  })
})

describe('Back after a move to another season or league (T1304.5)', () => {
  const scope = (season: number, seasonType: 'regular' | 'playoffs' = 'regular') =>
    ({ season, seasonType, range: { kind: 'season' } }) as const
  const at = (l: NavLocation, season: number): NavLocation => ({ ...l, scope: scope(season) })

  it('takes a change of scope alone as no move', () => {
    const { result } = renderHook(() => useBackStack())
    act(() => result.current.report(at(statsPlayer('1', null), 2027)))
    act(() => result.current.report(at(statsPlayer('1', null), 2016)))
    expect(result.current.canGoBack).toBe(false)
  })

  it('returns to the page as it was left, its scope included, after such a move', () => {
    const { result } = renderHook(() => useBackStack())
    act(() => result.current.report(at(statsPlayer('1', null), 2027)))
    // The search opens Kobe Bryant in 2015-16: the page left keeps 2026-27.
    act(() => result.current.leave())
    act(() => result.current.report(at(statsPlayer('977', null), 2027)))
    act(() => result.current.report(at(statsPlayer('977', null), 2016)))
    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    expect(to).toEqual(at(statsPlayer('1', null), 2027))
  })

  it('keeps its season type and range too', () => {
    const { result } = renderHook(() => useBackStack())
    const left: NavLocation = {
      ...statsPlayer('1', null),
      scope: {
        season: 2026,
        seasonType: 'playoffs',
        range: { kind: 'last', n: 10, of: 'appearances' }
      }
    }
    act(() => result.current.report(left))
    act(() => result.current.leave())
    act(() => result.current.report({ ...statsPlayer('5', null), league: 'ncaam' }))
    expect(result.current.back()).toEqual(left)
  })

  it('leaves the scope as it is after any other move, as it always has', () => {
    const { result } = renderHook(() => useBackStack())
    act(() => result.current.report(at(statsPlayer('1', null), 2027)))
    act(() => result.current.report(at(statsPlayer('2', null), 2027)))
    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    expect(to).toEqual(statsPlayer('1', null))
  })

  it('keeps the scope only for the page the move left', () => {
    const { result } = renderHook(() => useBackStack())
    act(() => result.current.report(at(statsPlayer('1', null), 2027)))
    act(() => result.current.leave())
    act(() => result.current.report(at(statsPlayer('2', null), 2016)))
    act(() => result.current.report(at(statsPlayer('3', null), 2016)))
    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    expect(to).toEqual(statsPlayer('2', null))
    act(() => result.current.report(at(statsPlayer('2', null), 2016)))
    act(() => {
      to = result.current.back()
    })
    expect(to).toEqual(at(statsPlayer('1', null), 2027))
  })
})

describe('the back gestures', () => {
  it('are Alt+← and the mouse back button, not Alt+← while typing', () => {
    expect(isBackGesture(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }))).toBe(
      true
    )
    expect(isBackGesture(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe(false)
    expect(
      isBackGesture(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, ctrlKey: true }))
    ).toBe(false)
    expect(isBackGesture(new MouseEvent('mouseup', { button: 3 }))).toBe(true)
    expect(isBackGesture(new MouseEvent('mouseup', { button: 0 }))).toBe(false)
    const input = document.createElement('input')
    document.body.append(input)
    const typed = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true })
    let seen: boolean | null = null
    input.addEventListener('keydown', (e) => {
      seen = isBackGesture(e)
    })
    input.dispatchEvent(typed)
    expect(seen).toBe(false)
    input.remove()
  })
})
