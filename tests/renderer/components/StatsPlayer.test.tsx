// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api'
import { StatsApp } from '@/screens/stats/StatsApp'
import type { StatsGame, StatsQuery, StatsResult, StatsSeason } from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

vi.mock('@/lib/api', () => ({
  api: {
    stats: {
      status: vi.fn(),
      data: vi.fn(),
      onChanged: vi.fn(() => () => {}),
      catalogue: vi.fn(),
      seasons: vi.fn(),
      query: vi.fn(),
      views: vi.fn(),
      player: vi.fn(),
      games: vi.fn(),
      game: vi.fn(),
      standings: vi.fn()
    },
    dev: { mode: vi.fn().mockResolvedValue(false), onModeChanged: vi.fn(() => () => {}) }
  }
}))

const BUILT = {
  available: true,
  through: { season: 2026, date: '2026-06-13' },
  updatedAt: '2026-11-06T12:00:00Z',
  builtAt: '2026-11-06T12:00:00Z',
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

const SEASONS: StatsSeason[] = [
  {
    season: 2026,
    firstDate: '2025-10-21',
    lastDate: '2026-06-13',
    types: [{ type: 'regular', games: 1230 }],
    teams: [
      { id: '10', code: 'BOS', name: 'Boston', conference: 'east', division: 'atlantic' },
      { id: '20', code: 'LAL', name: 'Los Angeles', conference: 'west', division: 'pacific' }
    ]
  },
  {
    season: 1995,
    firstDate: '1994-11-04',
    lastDate: '1995-06-14',
    types: [{ type: 'regular', games: 1107 }],
    teams: [{ id: '10', code: 'BOS', name: 'Boston', conference: 'east', division: 'atlantic' }]
  }
]

const GAMES: StatsGame[] = [
  {
    id: 'g1',
    season: 2026,
    type: 'regular',
    date: '2026-01-05',
    home: { id: '10', code: 'BOS', name: 'Boston', score: 110 },
    away: { id: '20', code: 'LAL', name: 'Los Angeles', score: 102 },
    played: true,
    hasBox: true,
    overtimes: 0
  },
  {
    id: 'g2',
    season: 2026,
    type: 'regular',
    date: '2026-01-07',
    home: { id: '20', code: 'LAL', name: 'Los Angeles', score: 100 },
    away: { id: '10', code: 'BOS', name: 'Boston', score: 90 },
    played: true,
    hasBox: true,
    overtimes: 1
  }
]

const NAMES = ['Luka Dončić', 'Jayson Tatum']
const reasons = (season: number, m: { firstSeason: number }): string | null =>
  season < m.firstSeason ? 'Recorded from 1996-97.' : null

/** Two players, one line a game. A player filter narrows them; a 1994-95 scope has no plus-minus. */
function answer(q: StatsQuery): StatsResult {
  const season = q.scope.seasons[0]
  const metrics = catalogueFixture().filter((m) => q.metrics.includes(m.id))
  const ids = (q.scope.players ?? ['1', '2']).filter((id) => season !== 2000 || id !== '1')
  const groups: Record<string, string | number>[] = q.groupBy?.includes('game')
    ? [{ game: 'g1' }, { game: 'g2' }]
    : q.groupBy?.includes('season')
      ? [{ season: 2026 }]
      : [{}]
  const rows = ids.flatMap((id) =>
    groups.map((group) => ({
      id,
      name: NAMES[Number(id) - 1],
      team: 'BOS',
      position: 'G',
      group,
      games: q.groupBy?.includes('game') ? 1 : 2,
      values: Object.fromEntries(
        metrics.map((m) => [
          m.id,
          {
            value: season < m.firstSeason ? null : q.groupBy?.includes('game') ? 10 : 20,
            raw: 20,
            sample: 100,
            qualified: true,
            percentile: 80,
            rank: 2
          }
        ])
      )
    }))
  )
  return {
    grain: 'season',
    columns: metrics.map((m) => ({
      id: m.id,
      label: m.label,
      short: m.short,
      unit: m.unit,
      decimals: m.decimals,
      direction: m.direction,
      seasons: [season],
      reason: reasons(season, m)
    })),
    rows,
    total: rows.length,
    notes: season === 1995 ? ['Plus-minus: starts in 1996-97.'] : [],
    ms: 1
  }
}

const lastQuery = (): StatsQuery => {
  const calls = vi.mocked(api.stats.query).mock.calls
  return calls[calls.length - 1][0]
}

async function openDashboard(): Promise<void> {
  render(
    <StatsApp
      update={{ status: 'idle' }}
      version="0.1.0"
      onOpenUpdate={() => {}}
      onToggleTheme={() => {}}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Players' }))
  await screen.findByRole('heading', { level: 1, name: /Dončić/ })
}

beforeEach(() => {
  vi.mocked(api.stats.status).mockResolvedValue(BUILT)
  vi.mocked(api.stats.catalogue).mockResolvedValue(catalogueFixture())
  vi.mocked(api.stats.seasons).mockResolvedValue(SEASONS)
  vi.mocked(api.stats.views).mockResolvedValue([])
  vi.mocked(api.stats.query).mockImplementation((q) => Promise.resolve(answer(q)))
  vi.mocked(api.stats.game).mockResolvedValue(null)
  vi.mocked(api.stats.games).mockResolvedValue(GAMES)
  vi.mocked(api.stats.player).mockImplementation((id) =>
    Promise.resolve({
      id,
      name: NAMES[Number(id) - 1],
      position: 'G',
      team: { id: '10', code: 'BOS' },
      seasons: [1995, 2026],
      number: '77',
      height: '6-7',
      weight: '230',
      birthDate: 'FEB 28, 1999',
      school: null
    })
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the player dashboard', () => {
  it('opens on the league’s leader, with the rail, the header and every tab', async () => {
    await openDashboard()
    for (const name of ['Overview', 'Scoring', 'Shooting', 'Playmaking', 'Rebounding', 'Defense']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy()
    }
    expect(screen.getByRole('tab', { name: 'Game log' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Splits' })).toBeTruthy()
    expect(screen.getByText(/#77 · 6-7, 230 lb · Born Feb 28, 1999/)).toBeTruthy()
    const rail = within(screen.getByRole('complementary', { name: 'Players' }))
    expect(rail.getByRole('button', { name: /Jayson Tatum/ })).toBeTruthy()
    expect(await screen.findByText('Percentile rankings')).toBeTruthy()
    expect(await screen.findByText('Career by season')).toBeTruthy()
  })

  it('moves to another player from the rail, and not while their answers load', async () => {
    await openDashboard()
    const rail = within(screen.getByRole('complementary', { name: 'Players' }))
    fireEvent.click(rail.getByRole('button', { name: /Jayson Tatum/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Tatum/ })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: /Dončić/ })).toBeNull()
  })

  it('says why a stat is empty in a season before it was recorded', async () => {
    await openDashboard()
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), {
      target: { value: '1995' }
    })
    fireEvent.click(await screen.findByRole('tab', { name: 'Defense' }))
    expect(await screen.findByText('Recorded from 1996-97.')).toBeTruthy()
    expect(screen.getByText('Plus-minus: starts in 1996-97.')).toBeTruthy()
  })

  it('says so when the player did not play in the scope, and keeps their career', async () => {
    await openDashboard()
    vi.mocked(api.stats.query).mockImplementation((q) =>
      Promise.resolve(q.limit === 1 ? { ...answer(q), rows: [] } : answer(q))
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), {
      target: { value: '1995' }
    })
    expect(await screen.findByText(/played no games in 1994-95/)).toBeTruthy()
    expect(await screen.findByText('Career by season')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Shooting' }))
    expect(screen.queryByText('Efficiency')).toBeNull()
  })

  it('says so when a career has no games of the type, and draws no empty table', async () => {
    vi.mocked(api.stats.query).mockImplementation((q) =>
      Promise.resolve(q.limit === 100 ? { ...answer(q), rows: [] } : answer(q))
    )
    await openDashboard()
    expect(await screen.findByText('No games in regular season in any season.')).toBeTruthy()
    expect(screen.getByText('Career by season')).toBeTruthy()
  })

  it('reads every game of the log, with its total, and opens a game', async () => {
    await openDashboard()
    fireEvent.click(screen.getByRole('tab', { name: 'Game log' }))
    const log = within(await screen.findByRole('table', { name: 'Game log' }))
    expect(log.getByRole('row', { name: /Jan 7/ })).toBeTruthy()
    expect(log.getByRole('row', { name: /Jan 5/ })).toBeTruthy()
    expect(log.getByText('W 110–102')).toBeTruthy()
    expect(log.getByText('L 90–100 OT')).toBeTruthy()
    expect(log.getByText('Total')).toBeTruthy()
    expect(screen.queryByText(/do not add up/)).toBeNull()
    fireEvent.click(log.getByRole('row', { name: /Jan 7/ }))
    await screen.findByRole('complementary', { name: 'Games' })
  })

  it('asks the engine for each split, scoped to the player', async () => {
    await openDashboard()
    fireEvent.click(screen.getByRole('tab', { name: 'Splits' }))
    expect(await screen.findByText('Where')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'By opponent' })).toBeTruthy()
    const asked = vi.mocked(api.stats.query).mock.calls.map(([q]) => q)
    expect(asked.some((q) => q.scope.home === true && q.scope.players?.[0] === '1')).toBe(true)
  })

  it('changes the mode across the tab', async () => {
    await openDashboard()
    fireEvent.click(screen.getByRole('radio', { name: 'Totals' }))
    await waitFor(() => expect(lastQuery().transform).toBe('raw'))
  })

  it('opens the leaderboards from the dashboard, and a name opens the dashboard', async () => {
    await openDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Player leaderboards →' }))
    expect(await screen.findByRole('heading', { name: /player leaderboard/ })).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Jayson Tatum' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Tatum/ })).toBeTruthy()
  })
})
