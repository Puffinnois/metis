// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FavouriteStar } from '@/components/stats/FavouriteStar'
import { FavouritesContext, type Favourites } from '@/lib/stats/favourites'
import { emptyFavourites } from '@shared/favourites'

/** The star (D49): its states, its label, and a click that stays its own. */
function provider(players: string[] = [], teams: string[] = []): Favourites {
  const p = new Set(players)
  const t = new Set(teams)
  return {
    players: p,
    teams: t,
    isFavourite: (kind, id) => (kind === 'player' ? p : t).has(id),
    toggle: vi.fn(),
    all: emptyFavourites(),
    ready: true
  }
}

function renderIn(favourites: Favourites | null, ui: React.ReactNode): ReturnType<typeof render> {
  return render(
    favourites ? (
      <FavouritesContext.Provider value={favourites}>{ui}</FavouritesContext.Provider>
    ) : (
      ui
    )
  )
}

afterEach(cleanup)

describe('FavouriteStar', () => {
  it('is an outlined button naming the player when off', () => {
    const f = provider()
    renderIn(f, <FavouriteStar kind="player" id="1628369" name="Jayson Tatum" />)
    const star = screen.getByRole('button', { name: 'Add Jayson Tatum to favourites' })
    expect(star.getAttribute('aria-pressed')).toBe('false')
    expect(star.className).toContain('text-fg-3')
    expect(star.querySelector('svg')?.getAttribute('fill')).toBe('none')
  })

  it('is filled gold and says it removes when on', () => {
    const f = provider([], ['1610612738'])
    renderIn(f, <FavouriteStar kind="team" id="1610612738" name="Boston Celtics" size="lg" />)
    const star = screen.getByRole('button', { name: 'Remove Boston Celtics from favourites' })
    expect(star.getAttribute('aria-pressed')).toBe('true')
    expect(star.className).toContain('text-fav')
    expect(star.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
  })

  it('a player and a team with the same id are different stars', () => {
    const f = provider(['5'])
    renderIn(f, <FavouriteStar kind="team" id="5" name="Team Five" />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
  })

  it('toggles on a click that never reaches the row it sits on', () => {
    const f = provider()
    const onRow = vi.fn()
    renderIn(
      f,
      <table>
        <tbody>
          <tr onClick={onRow}>
            <td>
              <FavouriteStar kind="player" id="1" name="Someone" reveal />
            </td>
          </tr>
        </tbody>
      </table>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add Someone to favourites' }))
    expect(f.toggle).toHaveBeenCalledWith('player', '1', 'Someone')
    expect(onRow).not.toHaveBeenCalled()
  })

  it('is reached by the keyboard, and shown on its row’s hover or focus while off', () => {
    const f = provider(['2'])
    renderIn(
      f,
      <>
        <FavouriteStar kind="player" id="1" name="Off" reveal />
        <FavouriteStar kind="player" id="2" name="On" reveal />
      </>
    )
    const off = screen.getByRole('button', { name: 'Add Off to favourites' })
    const on = screen.getByRole('button', { name: 'Remove On from favourites' })
    // A real button, in the tab order, hidden by opacity alone so it keeps its room.
    expect(off.tagName).toBe('BUTTON')
    expect(off.tabIndex).toBe(0)
    expect(off.className).toContain('opacity-0')
    expect(off.className).toContain('group-hover/fav:opacity-100')
    expect(off.className).toContain('group-focus-within/fav:opacity-100')
    expect(on.className).not.toContain('opacity-0')
    off.focus()
    expect(document.activeElement).toBe(off)
  })

  it('is not drawn outside a favourites provider', () => {
    const { container } = renderIn(null, <FavouriteStar kind="player" id="1" name="Someone" />)
    expect(container.innerHTML).toBe('')
  })
})
