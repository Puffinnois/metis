// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api'
import { StatsApp } from '@/screens/stats/StatsApp'

vi.mock('@/lib/api', () => ({
  api: {
    stats: { status: vi.fn(), onChanged: vi.fn(() => () => {}) },
    dev: { mode: vi.fn().mockResolvedValue(false), onModeChanged: vi.fn(() => () => {}) }
  }
}))

const EMPTY = { available: true, through: null, updatedAt: null, busy: false, progress: null }

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

  it('reads the status again as a load progresses', async () => {
    vi.mocked(api.stats.status).mockResolvedValue(EMPTY)
    renderApp()
    await screen.findByText('No stats yet')
    expect(screen.getByText(/NBA data has not been loaded/)).toBeTruthy()
    vi.mocked(api.stats.status).mockResolvedValue({
      ...EMPTY,
      busy: true,
      progress: { done: 3, total: 3107 }
    })
    const changed = vi.mocked(api.stats.onChanged).mock.lastCall?.[0]
    changed?.()
    expect(await screen.findByText('Loading the stats · 3 of 3,107 files')).toBeTruthy()
    expect(screen.getByText('NBA data is loading.')).toBeTruthy()
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
