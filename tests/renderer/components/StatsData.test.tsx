// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { api } from '@/lib/api'
import { FirstRunLeagues } from '@/components/stats/FirstRunLeagues'
import { StatsData } from '@/screens/stats/StatsData'
import type { LeagueId } from '@shared/leagues'
import type {
  LeagueDownload,
  LeagueDownloads,
  StatsDataReport,
  StatsStatus
} from '@shared/stats/types'

vi.mock('@/lib/api', () => ({
  api: {
    stats: {
      data: vi.fn(),
      status: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      onChanged: vi.fn(() => () => {})
    },
    leagues: { downloads: vi.fn(), setDownloads: vi.fn(), deleteFile: vi.fn() }
  }
}))

const GB = 1024 ** 3
const STATUS: StatsStatus = {
  available: true,
  through: null,
  updatedAt: null,
  builtAt: null,
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

const NBA_REPORT: StatsDataReport = {
  databaseBytes: 4.3 * GB,
  freeBytes: 100 * GB,
  families: [
    {
      release: 'espn_nba_player_boxscores',
      label: 'Player box scores (ESPN)',
      tier: 'core',
      state: 'loaded',
      filesLoaded: 34,
      filesExpected: 34,
      firstSeason: 1994,
      lastSeason: 2027,
      bytes: 19 * 1024 ** 2,
      rows: 1087258,
      fetchedAt: null,
      lastError: null
    },
    {
      release: 'nba_stats_pbp',
      label: 'Play by play (NBA)',
      tier: 'plays',
      state: 'failed',
      filesLoaded: 3,
      filesExpected: 31,
      firstSeason: 2025,
      lastSeason: 2027,
      bytes: 60 * 1024 ** 2,
      rows: 1000,
      fetchedAt: null,
      lastError: 'HTTP 500 for a file'
    }
  ]
}

const WNBA_REPORT: StatsDataReport = {
  databaseBytes: 0,
  freeBytes: null,
  families: [
    {
      release: 'wnba_stats_player_game_logs',
      label: 'Game logs (WNBA)',
      tier: 'core',
      state: 'loaded',
      filesLoaded: 30,
      filesExpected: 30,
      firstSeason: 1997,
      lastSeason: 2026,
      bytes: 3 * 1024 ** 2,
      rows: 147465,
      fetchedAt: null,
      lastError: null
    }
  ]
}

const download = (league: LeagueId, over: Partial<LeagueDownload> = {}): LeagueDownload => ({
  league,
  on: true,
  hasFile: true,
  fileBytes: 4.3 * GB,
  hasData: true,
  roomNeeded: 0,
  ...over
})

const DOWNLOADS: LeagueDownloads = {
  decided: true,
  leagues: [
    download('nba'),
    download('wnba', { on: false, hasFile: false, fileBytes: 0, hasData: false })
  ],
  freeBytes: 100 * GB
}

const statuses: Partial<Record<LeagueId, StatsStatus>> = { nba: STATUS, wnba: STATUS }

beforeEach(() => {
  vi.clearAllMocks()
  statuses.nba = STATUS
  statuses.wnba = { ...STATUS, available: false, noData: 'No WNBA stats yet.' }
  vi.mocked(api.stats.data).mockImplementation(async (league) =>
    league === 'nba' ? NBA_REPORT : WNBA_REPORT
  )
  vi.mocked(api.stats.status).mockImplementation(async (league) => statuses[league] ?? STATUS)
  vi.mocked(api.leagues.downloads).mockResolvedValue(DOWNLOADS)
})
afterEach(cleanup)

const section = async (name: string): Promise<HTMLElement> => screen.findByRole('region', { name })

describe('the Data panel', () => {
  it('groups every league’s releases, whichever is on screen', async () => {
    render(<StatsData />)
    expect(await screen.findByText(/4.3 GB on disk · 100.0 GB free/)).toBeTruthy()
    const nba = await section('NBA')
    expect(await within(nba).findByText('Player box scores (ESPN)')).toBeTruthy()
    expect(within(nba).getByText('1993-94 to 2026-27')).toBeTruthy()
    expect(within(nba).getByText(/On · 37 of 65 files · 4.3 GB on disk/)).toBeTruthy()
    const wnba = await section('WNBA')
    // Each league writes its own seasons: the WNBA's are years.
    expect(await within(wnba).findByText('1997 to 2026')).toBeTruthy()
    expect(within(wnba).getByText(/Off · 30 of 30 files · nothing on disk/)).toBeTruthy()
    expect(within(wnba).getByText(/Not downloaded. Turning it on downloads about/)).toBeTruthy()
  })

  it('shows what failed and why', async () => {
    render(<StatsData />)
    const nba = await section('NBA')
    expect(await within(nba).findByText('Failed')).toBeTruthy()
    expect(within(nba).getByText('HTTP 500 for a file')).toBeTruthy()
  })

  it('credits the data of every league', async () => {
    render(<StatsData />)
    const links = await screen.findAllByRole('link', { name: 'SportsDataverse' })
    // The NBA's, the WNBA's and NCAA Division I's, the two college leagues sharing their sources.
    expect(links).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'WNBA.com' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'stats.ncaa.org' })).toBeTruthy()
  })

  it('turns a league on, and off', async () => {
    vi.mocked(api.leagues.setDownloads).mockResolvedValue(DOWNLOADS)
    render(<StatsData />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn the WNBA on' }))
    expect(api.leagues.setDownloads).toHaveBeenCalledWith({ wnba: true })
    fireEvent.click(screen.getByRole('button', { name: 'Turn the NBA off' }))
    expect(api.leagues.setDownloads).toHaveBeenCalledWith({ nba: false })
  })

  it('deletes a league’s file only after asking, and only once it is off', async () => {
    const off = {
      ...DOWNLOADS,
      leagues: [download('nba'), download('wnba', { on: false, fileBytes: GB })]
    }
    vi.mocked(api.leagues.downloads).mockResolvedValue(off)
    vi.mocked(api.leagues.deleteFile).mockResolvedValue(DOWNLOADS)
    render(<StatsData />)
    const nba = await section('NBA')
    expect(within(nba).queryByRole('button', { name: 'Delete its data' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete its data' }))
    expect(await screen.findByText(/This removes stats-wnba.duckdb \(1.0 GB\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(api.leagues.deleteFile).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete its data' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(api.leagues.deleteFile).toHaveBeenCalledWith('wnba')
  })

  it('pauses and resumes each league on its own', async () => {
    statuses.nba = { ...STATUS, busy: true, progress: { done: 10, total: 40 } }
    render(<StatsData />)
    const nba = await section('NBA')
    expect(await within(nba).findByText(/Loading: 10 of 40 files/)).toBeTruthy()
    fireEvent.click(within(nba).getByRole('button', { name: 'Pause' }))
    expect(api.stats.pause).toHaveBeenCalledWith('nba')
    cleanup()
    statuses.nba = { ...STATUS, paused: true }
    render(<StatsData />)
    expect(await screen.findByText(/Nothing downloads until you resume/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(api.stats.resume).toHaveBeenCalledWith('nba')
  })

  it('says when there is not enough room to load a league', async () => {
    statuses.nba = { ...STATUS, noRoom: { neededBytes: 6 * GB, freeBytes: 2 * GB } }
    render(<StatsData />)
    expect(
      await screen.findByText(/load the NBA: it needs 6.0 GB, and 2.0 GB is free/)
    ).toBeTruthy()
  })

  it('reads a league again when its data changes', async () => {
    render(<StatsData />)
    await section('NBA')
    await screen.findByText('Failed')
    const calls = vi.mocked(api.stats.data).mock.calls.length
    vi.mocked(api.stats.onChanged).mock.lastCall?.[0]('wnba')
    expect(vi.mocked(api.stats.data).mock.calls.length).toBe(calls + 1)
    expect(vi.mocked(api.stats.data).mock.lastCall?.[0]).toBe('wnba')
  })

  it('shows the error when a league’s report cannot be read', async () => {
    vi.mocked(api.stats.data).mockRejectedValue(new Error('worker gone'))
    render(<StatsData />)
    expect((await screen.findAllByText('worker gone')).length).toBe(2)
  })
})

describe('the first run', () => {
  const CLEAN: LeagueDownloads = {
    decided: false,
    leagues: [
      download('nba', { on: false, hasFile: false, fileBytes: 0, roomNeeded: 6 * GB }),
      download('wnba', { on: false, hasFile: false, fileBytes: 0, roomNeeded: 2 * GB })
    ],
    freeBytes: 7 * GB
  }

  it('asks nothing on a profile that has its answer', async () => {
    render(<FirstRunLeagues />)
    await Promise.resolve()
    expect(screen.queryByText('Which leagues should Metis download?')).toBeNull()
  })

  it('asks which leagues to download, with each one’s size, before anything downloads', async () => {
    vi.mocked(api.leagues.downloads).mockResolvedValue(CLEAN)
    vi.mocked(api.leagues.setDownloads).mockResolvedValue({ ...CLEAN, decided: true })
    render(<FirstRunLeagues />)
    expect(await screen.findByText('Which leagues should Metis download?')).toBeTruthy()
    expect(screen.getByText(/Needs 6.0 GB free while it loads/)).toBeTruthy()
    expect(screen.getByText(/Needs 2.0 GB free while it loads/)).toBeTruthy()
    expect(screen.getByText('7.0 GB free.')).toBeTruthy()
    const [nba, wnba] = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect([nba.checked, wnba.checked]).toEqual([true, false])
    // Both together need 8 GB of the 7 free: refused, with the reason.
    fireEvent.click(wnba)
    expect(screen.getByText(/this needs 8.0 GB, and 7.0 GB is free/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Download' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    fireEvent.click(nba)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(api.leagues.setDownloads).toHaveBeenCalledWith({
      nba: false,
      wnba: true,
      ncaam: false,
      ncaaw: false
    })
  })

  it('downloads nothing until at least one league is chosen', async () => {
    vi.mocked(api.leagues.downloads).mockResolvedValue({ ...CLEAN, freeBytes: null })
    render(<FirstRunLeagues />)
    const [nba] = (await screen.findAllByRole('checkbox')) as HTMLInputElement[]
    fireEvent.click(nba)
    expect((screen.getByRole('button', { name: 'Download' }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })
})
