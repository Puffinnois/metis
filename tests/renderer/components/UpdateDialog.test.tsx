// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UpdateDialog } from '@/components/UpdateDialog'
import { api } from '@/lib/api'
import type { UpdateState } from '@shared/types'

vi.mock('@/lib/api', () => ({ api: { update: { install: vi.fn() } } }))
const installMock = vi.mocked(api.update.install)

const ready: UpdateState = {
  status: 'ready',
  version: '0.11.0',
  notes: '<p>Big <strong>news</strong></p>'
}

function renderDialog(state: UpdateState, onOpenChange = vi.fn()): ReturnType<typeof vi.fn> {
  render(<UpdateDialog state={state} currentVersion="0.10.2" open onOpenChange={onOpenChange} />)
  return onOpenChange
}

beforeEach(() => {
  installMock.mockReset()
  installMock.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('UpdateDialog', () => {
  it('shows versions and the sanitized notes', () => {
    renderDialog(ready)
    expect(screen.getByRole('heading', { name: 'Update to 0.11.0' })).toBeTruthy()
    expect(screen.getByText("You're on 0.10.2")).toBeTruthy()
    expect(screen.getByText('news').tagName).toBe('STRONG')
  })

  it('falls back when there are no notes', () => {
    renderDialog({ ...ready, notes: null })
    expect(screen.getByText('No release notes for this version.')).toBeTruthy()
  })

  it('disables the install button and shows progress while downloading', () => {
    renderDialog({ ...ready, status: 'downloading', percent: 42 })
    expect(screen.getByText('Downloading 42%')).toBeTruthy()
    expect(screen.getByTestId('update-progress').style.width).toBe('42%')
    expect(
      (screen.getByRole('button', { name: 'Update & restart' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('installs once when ready and reports restarting', () => {
    renderDialog(ready)
    const button = screen.getByRole('button', { name: 'Update & restart' })
    fireEvent.click(button)
    expect(installMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Restarting…' })).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Restarting…' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('Later closes the dialog', () => {
    const onOpenChange = renderDialog(ready)
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders nothing when there is no update', () => {
    const { container } = render(
      <UpdateDialog
        state={{ status: 'idle' }}
        currentVersion="0.10.2"
        open
        onOpenChange={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe('')
    expect(document.body.textContent).toBe('')
  })
})
