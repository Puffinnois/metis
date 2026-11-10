// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DevChip } from '@/components/dev/DevChip'
import { DevTools } from '@/components/dev/DevTools'
import { api } from '@/lib/api'
import { CAPTURE_ATTR } from '@/lib/dev/capture'
import { useNoteContext } from '@/lib/dev/noteContext'
import type { DevNote, NoteError } from '@shared/devNotes'

vi.mock('@/lib/api', () => ({
  api: {
    dev: {
      mode: vi.fn(),
      setMode: vi.fn(),
      onModeChanged: vi.fn(),
      capture: vi.fn(),
      reportError: vi.fn(),
      recentErrors: vi.fn(),
      notes: {
        list: vi.fn(),
        save: vi.fn(),
        setStatus: vi.fn(),
        remove: vi.fn(),
        image: vi.fn(),
        folder: vi.fn(),
        openFolder: vi.fn(),
        chooseFolder: vi.fn(),
        copy: vi.fn()
      }
    }
  }
}))

const SHOT = 'data:image/png;base64,iVBORw0KGgo='
const ERROR: NoteError = {
  at: '2026-10-22T12:00:00.000Z',
  origin: 'renderer',
  message: 'TypeError: boom',
  stack: null
}

function note(over: Partial<DevNote> = {}): DevNote {
  return {
    id: 'N-001',
    tag: 'bug',
    status: 'open',
    created: '2026-10-22T14:03:11+02:00',
    images: [],
    title: 'Table cuts names',
    text: 'Table cuts names',
    where: 'Player',
    context: null,
    ...over
  }
}

function PlayerFile(): null {
  useNoteContext('player', { label: 'Nikola Jokić', data: { playerId: '203999' } })
  return null
}

const onGo = vi.fn()
function renderTools(): void {
  render(
    <DevTools screen="players" onGo={onGo}>
      <DevChip />
      <PlayerFile />
    </DevTools>
  )
}

function press(code: string): void {
  fireEvent.keyDown(window, { code, ctrlKey: true, shiftKey: true })
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  vi.mocked(api.dev.mode).mockResolvedValue(true)
  vi.mocked(api.dev.setMode).mockResolvedValue()
  vi.mocked(api.dev.onModeChanged).mockReturnValue(() => {})
  vi.mocked(api.dev.recentErrors).mockResolvedValue([ERROR])
  vi.mocked(api.dev.capture).mockResolvedValue(SHOT)
  vi.mocked(api.dev.notes.save).mockResolvedValue(note())
  vi.mocked(api.dev.notes.list).mockResolvedValue([])
  vi.mocked(api.dev.notes.folder).mockResolvedValue('/notes')
  vi.mocked(api.dev.notes.setStatus).mockResolvedValue()
  vi.mocked(api.dev.notes.remove).mockResolvedValue()
  vi.mocked(api.dev.notes.copy).mockResolvedValue()
  vi.mocked(api.dev.notes.image).mockResolvedValue(null)
})
afterEach(cleanup)

describe('dev mode', () => {
  it('shows nothing while off, and Ctrl+Shift+D turns it on', async () => {
    vi.mocked(api.dev.mode).mockResolvedValue(false)
    renderTools()
    await waitFor(() => expect(api.dev.mode).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Note/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'DEV' })).toBeNull()
    press('KeyN')
    expect(screen.queryByRole('dialog')).toBeNull()
    press('KeyD')
    expect(api.dev.setMode).toHaveBeenCalledWith(true)
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Dev mode on')
    expect(screen.getByRole('button', { name: 'DEV' })).toBeTruthy()
  })

  it('follows a switch made elsewhere', async () => {
    let listener: (on: boolean) => void = () => {}
    vi.mocked(api.dev.onModeChanged).mockImplementation((l) => {
      listener = l
      return () => {}
    })
    renderTools()
    expect(await screen.findByRole('button', { name: 'DEV' })).toBeTruthy()
    act(() => listener(false))
    expect(screen.queryByRole('button', { name: 'DEV' })).toBeNull()
  })

  it('the DEV chip opens notes and turns Dev mode off', async () => {
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: 'DEV' }))
    fireEvent.click(screen.getByRole('button', { name: /All notes/ }))
    expect(await screen.findByText('No notes yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'DEV' }))
    fireEvent.click(screen.getByRole('button', { name: /Turn off Dev mode/ }))
    expect(api.dev.setMode).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('forwards renderer errors to main whatever the mode', async () => {
    vi.mocked(api.dev.mode).mockResolvedValue(false)
    renderTools()
    const error = new TypeError('boom')
    window.dispatchEvent(new ErrorEvent('error', { error, message: 'boom' }))
    expect(api.dev.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'TypeError: boom' })
    )
  })
})

describe('writing a note', () => {
  it('opens with Ctrl+Shift+N and saves the text, tag, context and errors', async () => {
    renderTools()
    await screen.findByRole('button', { name: 'DEV' })
    press('KeyN')
    const text = await screen.findByRole('textbox', { name: 'Note' })
    expect(await screen.findByText(/Players · Nikola Jokić/)).toBeTruthy()
    fireEvent.change(text, { target: { value: 'Table cuts names\nmore' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Bug' }))
    expect(await screen.findByText('Include recent errors (1)')).toBeTruthy()
    const tick = screen.getByRole('checkbox')
    expect(tick).toHaveProperty('checked', false)
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByText(/renderer\s+TypeError: boom/)).toBeTruthy()
    fireEvent.click(tick)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.dev.notes.save).toHaveBeenCalledTimes(1))
    const saved = vi.mocked(api.dev.notes.save).mock.calls[0][0]
    expect(saved).toMatchObject({
      text: 'Table cuts names\nmore',
      tag: 'bug',
      errors: [ERROR],
      images: [],
      where: {
        screen: 'players',
        parts: { player: { label: 'Nikola Jokić', data: { playerId: '203999' } } }
      }
    })
    expect(saved.where.env).toMatchObject({ theme: 'light' })
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Saved N-001')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('leaves the errors out by default; saves nothing without text', async () => {
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: /Note/ }))
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'x' } })
    expect(await screen.findByText('Include recent errors (1)')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), {
      key: 'Enter',
      ctrlKey: true
    })
    await waitFor(() => expect(api.dev.notes.save).toHaveBeenCalled())
    expect(vi.mocked(api.dev.notes.save).mock.calls[0][0].errors).toEqual([])
  })

  it('takes a screenshot with the panel hidden, and removes it', async () => {
    let hidden: boolean | null = null
    vi.mocked(api.dev.capture).mockImplementation(async () => {
      hidden = document.documentElement.hasAttribute(CAPTURE_ATTR)
      return SHOT
    })
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: /Note/ }))
    expect(screen.getByRole('dialog').hasAttribute('data-dev-overlay')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Screenshot' }))
    expect(await screen.findByRole('img', { name: 'Screenshot 1' })).toBeTruthy()
    expect(hidden).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment 1' }))
    expect(screen.queryByRole('img', { name: 'Screenshot 1' })).toBeNull()
  })

  it('snip shows the frozen capture, and Esc cancels it without closing anything else', async () => {
    const outside = vi.fn()
    window.addEventListener('keydown', outside)
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: /Note/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Snip' }))
    const overlay = await screen.findByLabelText('Snip a region')
    expect(screen.getByRole('button', { name: 'Use' })).toHaveProperty('disabled', true)
    fireEvent.keyDown(overlay, { key: 'Escape' })
    expect(screen.queryByLabelText('Snip a region')).toBeNull()
    expect(outside).not.toHaveBeenCalled()
    window.removeEventListener('keydown', outside)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('keeps the draft when closed, and across a reload', async () => {
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: /Note/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), {
      target: { value: 'Half a thought' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: /Note/ }))
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveProperty('value', 'Half a thought')
    cleanup()
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: /Note/ }))
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveProperty('value', 'Half a thought')
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveProperty('value', '')
  })
})

describe('final review fixes', () => {
  it('Ctrl+Shift+N and the chip open a collapsed panel again', async () => {
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: /Note/ }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), { key: 'Escape' })
    expect(screen.queryByRole('textbox', { name: 'Note' })).toBeNull()
    press('KeyN')
    expect(screen.getByRole('textbox', { name: 'Note' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'DEV' }))
    fireEvent.click(screen.getByRole('button', { name: /New note/ }))
    expect(screen.getByRole('textbox', { name: 'Note' })).toBeTruthy()
  })

  it('takes one capture at a time, so a double click never passes six', async () => {
    let finish: (url: string) => void = () => {}
    vi.mocked(api.dev.capture).mockImplementation(
      () => new Promise<string>((resolve) => (finish = resolve))
    )
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: /Note/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Screenshot' }))
    await waitFor(() => expect(api.dev.capture).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Screenshot' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Snip' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Screenshot' }))
    await act(async () => finish(SHOT))
    expect(api.dev.capture).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('img', { name: /Screenshot/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Screenshot' })).toHaveProperty('disabled', false)
  })
})

describe('all notes', () => {
  it('filters, marks done, copies, deletes and goes there', async () => {
    const context = { screen: 'team', parts: {} } as never
    vi.mocked(api.dev.notes.list).mockResolvedValue([
      note({ id: 'N-002', title: 'Second', context }),
      note({ id: 'N-001', title: 'Done one', status: 'done' })
    ])
    renderTools()
    fireEvent.click(await screen.findByRole('button', { name: 'DEV' }))
    fireEvent.click(screen.getByRole('button', { name: /All notes/ }))
    expect(await screen.findByText('Second')).toBeTruthy()
    expect(screen.queryByText('Done one')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'all' }))
    expect(screen.getByText('Done one')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0])
    expect(api.dev.notes.setStatus).toHaveBeenCalledWith('N-002', 'done')
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy for Claude' })[0])
    expect(api.dev.notes.copy).toHaveBeenCalledWith(['N-002'])
    expect(await screen.findByText('Copied N-002')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy all open' }))
    expect(api.dev.notes.copy).toHaveBeenLastCalledWith(['N-002'])

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Delete N-001' }))
    expect(api.dev.notes.remove).toHaveBeenCalledWith('N-001')

    fireEvent.click(screen.getByRole('button', { name: 'Go there' }))
    expect(onGo).toHaveBeenCalledWith(context)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
