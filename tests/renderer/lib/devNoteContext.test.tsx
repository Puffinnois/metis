// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import {
  NoteContextRegistry,
  NoteContextRegistryContext,
  useNoteContext,
  useNoteScreen
} from '@/lib/dev/noteContext'

afterEach(cleanup)

function Part({ k, label }: { k: string; label: string | null }): null {
  useNoteContext(k, label === null ? null : { label, data: { label } })
  return null
}

function Screen({ name }: { name: string }): null {
  useNoteScreen(name)
  return null
}

describe('what the screens say is open', () => {
  it('registers parts while mounted, in order, and forgets them on unmount', () => {
    const registry = new NoteContextRegistry()
    const tree = (children: React.ReactNode): React.JSX.Element => (
      <NoteContextRegistryContext.Provider value={registry}>
        {children}
      </NoteContextRegistryContext.Provider>
    )
    const { rerender } = render(
      tree(
        <>
          <Part k="week" label="wk 8" />
          <Part k="player" label="Nikola Jokić" />
        </>
      )
    )
    expect(registry.snapshot('lineup')).toEqual({
      screen: 'lineup',
      parts: {
        week: { label: 'wk 8', data: { label: 'wk 8' } },
        player: { label: 'Nikola Jokić', data: { label: 'Nikola Jokić' } }
      }
    })
    rerender(
      tree(
        <>
          <Part k="week" label="wk 9" />
          <Part k="player" label={null} />
        </>
      )
    )
    expect(Object.keys(registry.snapshot('lineup').parts)).toEqual(['week'])
    expect(registry.snapshot('lineup').parts.week.label).toBe('wk 9')
    rerender(tree(null))
    expect(registry.snapshot('lineup').parts).toEqual({})
  })

  it('takes a product’s own screen over the app’s while it is mounted', () => {
    const registry = new NoteContextRegistry()
    const { rerender } = render(
      <NoteContextRegistryContext.Provider value={registry}>
        <Screen name="player" />
      </NoteContextRegistryContext.Provider>
    )
    expect(registry.snapshot('home').screen).toBe('player')
    rerender(
      <NoteContextRegistryContext.Provider value={registry}>
        {null}
      </NoteContextRegistryContext.Provider>
    )
    expect(registry.snapshot('home').screen).toBe('home')
  })

  it('does nothing outside the dev tools', () => {
    expect(() => render(<Part k="week" label="wk 1" />)).not.toThrow()
  })
})
