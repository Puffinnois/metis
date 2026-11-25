// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TeamChooser } from '@/components/stats/TeamChooser'
import { ALL_TEAMS, teamChoices } from '@/lib/stats/teamSearch'

vi.mock('@/components/stats/FavouriteStar', () => ({ FavouriteMark: () => null }))

const TEAMS = teamChoices([
  { id: '1', code: 'ATL', name: 'Atlanta Hawks', conference: 'East' },
  { id: '2', code: 'BOS', name: 'Boston Celtics', conference: 'East' },
  { id: '3', code: 'OKC', name: 'Oklahoma City Thunder', conference: 'West' },
  { id: '4', code: 'POR', name: 'Portland Trail Blazers', conference: 'West' }
])

afterEach(cleanup)

function show(value = '2'): {
  onChange: ReturnType<typeof vi.fn>
  outer: ReturnType<typeof vi.fn>
  trigger: () => HTMLElement
  search: () => HTMLElement
  codes: () => string[]
  resting: () => string | null
} {
  const onChange = vi.fn()
  const outer = vi.fn()
  render(
    <div onKeyDown={outer}>
      <TeamChooser title="Team" value={value} choices={[ALL_TEAMS, ...TEAMS]} onChange={onChange} />
    </div>
  )
  return {
    onChange,
    outer,
    trigger: () => screen.getByRole('button', { name: /^Team: / }),
    search: () => screen.getByRole('combobox', { name: 'Search: Team' }),
    codes: () => screen.queryAllByRole('option').map((o) => o.textContent ?? ''),
    resting: () => {
      const id = screen
        .getByRole('combobox', { name: 'Search: Team' })
        .getAttribute('aria-activedescendant')
      return id ? (document.getElementById(id)?.textContent ?? null) : null
    }
  }
}

describe('TeamChooser', () => {
  it('opens on the whole list at once, resting on the team chosen now', () => {
    const c = show()
    expect(c.trigger().textContent).toBe('BOS')
    fireEvent.click(c.trigger())
    expect(c.codes()).toHaveLength(5)
    expect(c.codes()[0]).toBe('All teams')
    expect(c.resting()).toContain('Boston Celtics')
    expect(screen.getByRole('option', { selected: true }).textContent).toContain('Boston Celtics')
  })

  it('is chosen with the keyboard alone: an arrow opens it, typing narrows, Enter takes', () => {
    const c = show()
    fireEvent.keyDown(c.trigger(), { key: 'ArrowDown' })
    fireEvent.change(c.search(), { target: { value: 'okla' } })
    expect(c.codes()).toHaveLength(1)
    fireEvent.keyDown(c.search(), { key: 'Enter' })
    expect(c.onChange).toHaveBeenCalledExactlyOnceWith('3')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('starts the search with a letter typed on the closed control', () => {
    const c = show()
    fireEvent.keyDown(c.trigger(), { key: 'p' })
    expect(c.search()).toHaveProperty('value', 'p')
    expect(c.resting()).toContain('Portland')
  })

  it('moves with the arrows, held to the list', () => {
    const c = show()
    fireEvent.click(c.trigger())
    fireEvent.keyDown(c.search(), { key: 'ArrowDown' })
    expect(c.resting()).toContain('Oklahoma City')
    fireEvent.keyDown(c.search(), { key: 'PageDown' })
    expect(c.resting()).toContain('Portland')
    fireEvent.keyDown(c.search(), { key: 'ArrowDown' })
    expect(c.resting()).toContain('Portland')
    fireEvent.keyDown(c.search(), { key: 'PageUp' })
    expect(c.resting()).toBe('All teams')
    fireEvent.keyDown(c.search(), { key: 'Enter' })
    expect(c.onChange).toHaveBeenCalledExactlyOnceWith('')
  })

  it('closes on Escape and leaves the choice as it was, the next opening unsearched', () => {
    const c = show()
    fireEvent.click(c.trigger())
    fireEvent.change(c.search(), { target: { value: 'port' } })
    fireEvent.keyDown(c.search(), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(c.onChange).not.toHaveBeenCalled()
    fireEvent.click(c.trigger())
    expect(c.search()).toHaveProperty('value', '')
    expect(c.codes()).toHaveLength(5)
  })

  it('says when no team matches, and Enter then does nothing', () => {
    const c = show()
    fireEvent.click(c.trigger())
    fireEvent.change(c.search(), { target: { value: 'zzz' } })
    expect(screen.getByRole('status').textContent).toBe('No team matches')
    fireEvent.keyDown(c.search(), { key: 'Enter' })
    expect(c.onChange).not.toHaveBeenCalled()
  })

  it('does not report the team already chosen, as a select does not', () => {
    const c = show()
    fireEvent.click(c.trigger())
    fireEvent.click(screen.getByRole('option', { name: /Boston/ }))
    expect(c.onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('keeps its keys from what it sits in, the rail that moves on the same arrows', () => {
    const c = show()
    fireEvent.keyDown(c.trigger(), { key: 'ArrowDown' })
    fireEvent.keyDown(c.search(), { key: 'ArrowDown' })
    fireEvent.keyDown(c.search(), { key: 'Enter' })
    expect(c.outer).not.toHaveBeenCalled()
  })

  it('leaves a shortcut with a modifier to the app', () => {
    const c = show()
    fireEvent.keyDown(c.trigger(), { key: 'ArrowLeft', altKey: true })
    expect(c.outer).toHaveBeenCalledOnce()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('names a team the list lacks by its label, never as another', () => {
    render(
      <TeamChooser
        title="Team"
        value="gone"
        choices={[ALL_TEAMS, ...TEAMS]}
        label="SEA"
        onChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Team: SEA' })).toBeTruthy()
  })
})
