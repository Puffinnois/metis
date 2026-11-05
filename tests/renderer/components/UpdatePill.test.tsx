// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UpdatePill } from '@/components/UpdatePill'
import type { UpdateState } from '@shared/types'

afterEach(cleanup)

const available: UpdateState = { status: 'available', version: '0.11.0', notes: null }

describe('UpdatePill', () => {
  it('renders nothing when idle or errored', () => {
    const { container } = render(<UpdatePill state={{ status: 'idle' }} onOpen={() => undefined} />)
    expect(container.innerHTML).toBe('')
    cleanup()
    const errored = render(
      <UpdatePill state={{ status: 'error', message: 'x' }} onOpen={() => undefined} />
    )
    expect(errored.container.innerHTML).toBe('')
  })

  it('offers the update when available or ready', () => {
    render(<UpdatePill state={available} onOpen={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Update to 0.11.0' })).toBeTruthy()
    cleanup()
    render(<UpdatePill state={{ ...available, status: 'ready' }} onOpen={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Update to 0.11.0' })).toBeTruthy()
  })

  it('shows the percentage while downloading', () => {
    render(
      <UpdatePill
        state={{ ...available, status: 'downloading', percent: 42 }}
        onOpen={() => undefined}
      />
    )
    expect(screen.getByRole('button', { name: 'Downloading 42%' })).toBeTruthy()
  })

  it('opens the dialog on click', () => {
    const onOpen = vi.fn()
    render(<UpdatePill state={available} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
