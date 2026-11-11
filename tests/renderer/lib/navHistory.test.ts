// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { BACK_LIMIT, isBackGesture, useBackStack, type NavLocation } from '@/lib/navHistory'

const page = (screen: 'home' | 'games' | 'players'): NavLocation => ({
  screen,
  team: null,
  player: null
})
const statsPlayer = (id: string, position: 'G' | null): NavLocation => ({
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
    const waiting: NavLocation = { screen: 'team', team: null, player: null }
    act(() => result.current.report(waiting))
    act(() => result.current.report({ ...waiting, team: 'DET' }))
    let to: NavLocation | null = null
    act(() => {
      to = result.current.back()
    })
    // The player before, not the waiting page.
    expect(to).toEqual(statsPlayer('2544', null))
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
