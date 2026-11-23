// @vitest-environment jsdom
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api'
import { StatsApp } from '@/screens/stats/StatsApp'
import { setLeague, TURN_ON, useLeague } from '@/lib/stats/league'
import { LEAGUES } from '@shared/leagues'
import type { LeagueDownload, LeagueDownloads } from '@shared/stats/types'
import { createSessionStore, SessionContext } from '@/lib/stats/session'
import { useState } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    // An existing profile: the first run's question has its answer.
    leagues: {
      onScreen: vi.fn(async () => undefined),
      downloads: vi.fn().mockResolvedValue({ decided: true, leagues: [], freeBytes: null })
    },
    stats: { status: vi.fn(), data: vi.fn(), onChanged: vi.fn(() => () => {}) },
    dev: { mode: vi.fn().mockResolvedValue(false), onModeChanged: vi.fn(() => () => {}) }
  }
}))

const EMPTY = {
  available: true,
  through: null,
  updatedAt: null,
  builtAt: null,
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

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

afterEach(() => {
  cleanup()
  setLeague('nba')
  localStorage.clear()
})

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
      expect(onLocation).toHaveBeenLastCalledWith(
        // The page; its scope goes with it, for Back after a move to another season (T1304.5).
        expect.objectContaining({
          league: 'nba',
          screen: 'games',
          team: null,
          player: null
        })
      )
    )
  })

  it('opens the Data panel from the status line', async () => {
    vi.mocked(api.stats.status).mockResolvedValue(EMPTY)
    vi.mocked(api.stats.data).mockResolvedValue({ families: [], databaseBytes: 0, freeBytes: null })
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'No stats yet' }))
    expect(await screen.findByRole('heading', { name: 'Data' })).toBeTruthy()
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
    changed?.('nba')
    expect(await screen.findByText('Loading the stats · 3 of 3,107 files')).toBeTruthy()
    expect(screen.getByText(/^NBA data is loading\./)).toBeTruthy()
  })

  const through = { season: 2027, date: '2026-11-04' }
  it.each([
    ['loading, before any box score', { busy: true }, /^NBA data is loading\./],
    ['loading, with box scores in', { busy: true, through }, /^NBA data is loading\./],
    ['paused', { paused: true }, /^Loading is paused\./],
    ['paused, with box scores in', { paused: true, through }, /^Loading is paused\./],
    ['stopped with no tables', { through }, /^The tables are not built yet\./],
    [
      'out of disk space',
      { noRoom: { neededBytes: 1, freeBytes: 0 } },
      /^Not enough disk space to load/
    ]
  ])('says what is happening when %s', async (_, status, note) => {
    vi.mocked(api.stats.status).mockResolvedValue({ ...EMPTY, ...status })
    renderApp()
    expect(await screen.findByText(note)).toBeTruthy()
    expect(screen.queryByText(/still being built/)).toBeNull()
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

describe('the league menu', () => {
  const NO_WNBA = LEAGUES.wnba.noData
  const NOT_BUILT = LEAGUES.wnba.notBuilt
  const download = (league: 'nba' | 'wnba', hasData: boolean): LeagueDownload => ({
    league,
    on: hasData,
    hasFile: hasData,
    fileBytes: hasData ? 1 : 0,
    hasData,
    roomNeeded: 0
  })
  const downloads = (wnba: boolean): LeagueDownloads => ({
    decided: true,
    leagues: [download('nba', true), download('wnba', wnba)],
    freeBytes: null
  })

  // As App builds it: the shell again for each league, the sessions kept above it.
  function Shell({ onLocation }: { onLocation: (l: unknown) => void }): React.JSX.Element {
    const league = useLeague()
    const [store] = useState(createSessionStore)
    return (
      <SessionContext.Provider value={store}>
        <StatsApp
          key={league.id}
          update={{ status: 'idle' }}
          version="1.0.0"
          onOpenUpdate={() => {}}
          onToggleTheme={() => {}}
          onLocation={onLocation}
        />
      </SessionContext.Provider>
    )
  }

  function pick(name: RegExp): void {
    fireEvent.keyDown(screen.getByRole('button', { name: /^League: / }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('menuitemradio', { name }))
  }

  afterEach(() => {
    vi.mocked(api.leagues.downloads).mockResolvedValue({
      decided: true,
      leagues: [],
      freeBytes: null
    })
  })

  it('lists every league by name with its real state, and switches, keeping the screen', async () => {
    vi.mocked(api.leagues.downloads).mockResolvedValue(downloads(false))
    vi.mocked(api.stats.status).mockImplementation((league) =>
      Promise.resolve(
        league === 'wnba' ? { ...EMPTY, available: false, noData: NO_WNBA } : { ...EMPTY }
      )
    )
    const onLocation = vi.fn()
    render(<Shell onLocation={onLocation} />)
    expect(await screen.findByText('No stats yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Games' }))

    fireEvent.keyDown(screen.getByRole('button', { name: 'League: NBA' }), { key: 'Enter' })
    const nba = screen.getByRole('menuitemradio', { name: /^NBA/ })
    const wnba = screen.getByRole('menuitemradio', { name: /^WNBA/ })
    expect(nba.getAttribute('aria-checked')).toBe('true')
    // The NBA is on with nothing built yet (its status has no build): it says so (T1304.5).
    expect(nba.textContent).toMatch(/No tables yet$/)
    expect(wnba.textContent).toMatch(/No stats yet$/)
    fireEvent.click(wnba)

    // The WNBA's Games, off: its reason, no error, and the way to turn it on.
    expect(await screen.findByText(NO_WNBA)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Games' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'No WNBA stats yet' })).toBeTruthy()
    expect(screen.queryByText(/could not be opened/)).toBeNull()
    expect(screen.getByRole('button', { name: 'League: WNBA' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: TURN_ON.label })).toBeTruthy()
    await waitFor(() =>
      expect(onLocation).toHaveBeenLastCalledWith(
        // The page; its scope goes with it, for Back after a move to another season (T1304.5).
        expect.objectContaining({
          league: 'wnba',
          screen: 'games',
          team: null,
          player: null
        })
      )
    )
    expect(localStorage.getItem('metis.league')).toBe('wnba')

    // And back: the NBA's Games.
    pick(/^NBA/)
    expect(await screen.findByText('No stats yet')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Games' })).toBeTruthy()
  })

  it('opens the Data panel from a league that is off, where it is turned on', async () => {
    vi.mocked(api.leagues.downloads).mockResolvedValue(downloads(false))
    vi.mocked(api.stats.status).mockResolvedValue({ ...EMPTY, available: false, noData: NO_WNBA })
    setLeague('wnba')
    render(<Shell onLocation={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: TURN_ON.label }))
    expect(await screen.findByRole('heading', { name: 'Data' })).toBeTruthy()
    expect(screen.queryByText(NO_WNBA)).toBeNull()
  })

  it('reads a loaded league with no tables yet as such, on screen, in the menu and the status line', async () => {
    // The WNBA's entry listing its identity alone, as before T1301.6: no league in the registry lacks
    // its game tables any more, so the state is shown on a variant of its entry.
    const wnba = LEAGUES.wnba as { builds: (typeof LEAGUES.wnba)['builds'] }
    const built = wnba.builds
    wnba.builds = ['identity']
    onTestFinished(() => {
      wnba.builds = built
    })
    vi.mocked(api.leagues.downloads).mockResolvedValue(downloads(true))
    vi.mocked(api.stats.status).mockResolvedValue({ ...EMPTY, noData: NOT_BUILT })
    setLeague('wnba')
    render(<Shell onLocation={() => {}} />)
    expect(await screen.findByText(NOT_BUILT)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'WNBA files loaded · no tables yet' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: TURN_ON.label })).toBeNull()
    expect(screen.queryByText(/could not be opened/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Standings' }))
    expect(screen.getByRole('heading', { name: 'Standings' })).toBeTruthy()
    expect(screen.getByText(NOT_BUILT)).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('button', { name: 'League: WNBA' }), { key: 'Enter' })
    expect(screen.getByRole('menuitemradio', { name: /^WNBA/ }).textContent).toMatch(
      /No tables yet$/
    )
  })
})
