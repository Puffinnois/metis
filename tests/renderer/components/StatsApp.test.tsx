// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api'
import { StatsApp } from '@/screens/stats/StatsApp'

vi.mock('@/lib/api', () => ({
  api: {
    stats: { status: vi.fn() },
    dev: { mode: vi.fn().mockResolvedValue(false), onModeChanged: vi.fn(() => () => {}) }
  }
}))

const EMPTY = { available: true, through: null, updatedAt: null, busy: false }

function renderApp(onLocation = vi.fn()): void {
  render(
    <StatsApp
      update={{ status: 'idle' }}
      version="0.1.0"
      onOpenUpdate={() => {}}
      onToggleTheme={() => {}}
      onLocation={onLocation}
    />
  )
}

afterEach(cleanup)

describe('the shell', () => {
  it('opens on Leaderboards, says the database is empty, and has no fantasy link', async () => {
    vi.mocked(api.stats.status).mockResolvedValue(EMPTY)
    renderApp()
    expect(await screen.findByText('No stats yet')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Leaderboards' })).toBeTruthy()
    expect(screen.getByText('Metis')).toBeTruthy()
    expect(screen.queryByText(/fantasy/i)).toBeNull()
    const nav = within(screen.getByRole('navigation'))
    for (const name of ['Leaderboards', 'Players', 'Teams', 'Explore', 'Games', 'Glossary']) {
      expect(nav.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('moves between screens and reports each page for Back', async () => {
    vi.mocked(api.stats.status).mockResolvedValue(EMPTY)
    const onLocation = vi.fn()
    renderApp(onLocation)
    fireEvent.click(screen.getByRole('button', { name: 'Games' }))
    expect(screen.getByRole('heading', { name: 'Games' })).toBeTruthy()
    await waitFor(() =>
      expect(onLocation).toHaveBeenLastCalledWith({ screen: 'games', team: null, player: null })
    )
  })

  it('says so when the stats database is off', async () => {
    vi.mocked(api.stats.status).mockResolvedValue({ ...EMPTY, available: false })
    renderApp()
    expect(await screen.findByText(/could not be opened/)).toBeTruthy()
  })

  it('shows the error when the status cannot be read', async () => {
    vi.mocked(api.stats.status).mockRejectedValue(new Error('worker gone'))
    renderApp()
    expect(await screen.findByText('worker gone')).toBeTruthy()
  })
})
