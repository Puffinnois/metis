// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { api } from '@/lib/api'
import { StatsData } from '@/screens/stats/StatsData'
import type { StatsDataReport, StatsStatus } from '@shared/stats/types'

vi.mock('@/lib/api', () => ({
  api: {
    stats: {
      data: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      onChanged: vi.fn(() => () => {})
    }
  }
}))

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

const REPORT: StatsDataReport = {
  databaseBytes: 4.3 * 1024 ** 3,
  freeBytes: 100 * 1024 ** 3,
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

beforeEach(() => {
  vi.mocked(api.stats.data).mockReset()
  vi.mocked(api.stats.pause).mockReset()
  vi.mocked(api.stats.resume).mockReset()
  vi.mocked(api.stats.data).mockResolvedValue(REPORT)
})
afterEach(cleanup)

describe('the Data panel', () => {
  it('says what is loaded, how large, and how much room is left', async () => {
    render(<StatsData status={STATUS} />)
    expect(await screen.findByText(/37 of 65 files · 4.3 GB on disk · 100.0 GB free/)).toBeTruthy()
    expect(screen.getByText('Player box scores (ESPN)')).toBeTruthy()
    expect(screen.getByText('1993-94 to 2026-27')).toBeTruthy()
    expect(screen.getByText('34 of 34')).toBeTruthy()
    expect(screen.getByText('Core: schedules, box scores, rosters')).toBeTruthy()
  })

  it('shows what failed and why', async () => {
    render(<StatsData status={STATUS} />)
    expect(await screen.findByText('Failed')).toBeTruthy()
    expect(screen.getByText('HTTP 500 for a file')).toBeTruthy()
  })

  it('credits the data', async () => {
    render(<StatsData status={STATUS} />)
    const link = await screen.findByRole('link', { name: 'SportsDataverse' })
    expect(link.getAttribute('href')).toContain('sportsdataverse-data')
  })

  it('offers no pause when nothing is running', async () => {
    render(<StatsData status={STATUS} />)
    await screen.findByText('Failed')
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull()
  })

  it('pauses a running load', async () => {
    render(<StatsData status={{ ...STATUS, busy: true }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(api.stats.pause).toHaveBeenCalledOnce()
  })

  it('resumes a paused load, and says it is paused', async () => {
    render(<StatsData status={{ ...STATUS, paused: true }} />)
    expect(await screen.findByText(/Nothing downloads until you resume/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(api.stats.resume).toHaveBeenCalledOnce()
  })

  it('says when there is not enough room to load', async () => {
    const noRoom = { neededBytes: 6 * 1024 ** 3, freeBytes: 2 * 1024 ** 3 }
    render(<StatsData status={{ ...STATUS, noRoom }} />)
    expect(await screen.findByText(/it needs 6.0 GB, and 2.0 GB is free/)).toBeTruthy()
  })

  it('reads again as the load goes', async () => {
    render(<StatsData status={STATUS} />)
    await screen.findByText('Failed')
    const calls = vi.mocked(api.stats.data).mock.calls.length
    vi.mocked(api.stats.onChanged).mock.lastCall?.[0]()
    expect(vi.mocked(api.stats.data).mock.calls.length).toBe(calls + 1)
  })

  it('shows the error when the report cannot be read', async () => {
    vi.mocked(api.stats.data).mockRejectedValue(new Error('worker gone'))
    render(<StatsData status={STATUS} />)
    expect(await screen.findByText('worker gone')).toBeTruthy()
  })
})
