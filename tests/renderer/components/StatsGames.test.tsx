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
  through: { season: 2026, date: '2026-01-07' },
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
    lastDate: '2026-01-07',
    types: [{ type: 'regular', games: 1230 }],
    teams: [
      { id: '10', code: 'BOS', name: 'Boston Celtics', conference: 'east', division: 'atlantic' },
      { id: '20', code: 'LAL', name: 'Los Angeles Lakers', conference: 'west', division: 'pacific' }
    ]
  },
  {
    season: 2025,
    firstDate: '2024-10-21',
    lastDate: '2025-06-22',
    types: [{ type: 'regular', games: 1230 }],
    teams: []
  }
]

const game = (id: string, date: string, over: Partial<StatsGame> = {}): StatsGame => ({
  id,
  season: 2026,
  type: 'regular',
  date,
  home: { id: '10', code: 'BOS', name: 'Boston Celtics', score: 110 },
  away: { id: '20', code: 'LAL', name: 'Los Angeles Lakers', score: 102 },
  played: true,
  hasBox: true,
  overtimes: 0,
  ...over
})

const GAMES: StatsGame[] = [
  game('pre', '2025-10-02', { type: 'preseason', hasBox: false, overtimes: null }),
  game('first', '2026-01-05'),
  game('second', '2026-01-05', {
    home: { id: '20', code: 'LAL', name: 'Los Angeles Lakers', score: 95 },
    away: { id: '10', code: 'BOS', name: 'Boston Celtics', score: 99 },
    overtimes: 1
  }),
  game('last', '2026-01-07')
]

function answer(q: StatsQuery): StatsResult {
  const metrics = catalogueFixture().filter((m) => q.metrics.includes(m.id))
  const values = (pts: number): StatsResult['rows'][number]['values'] =>
    Object.fromEntries(
      metrics.map((m) => [
        m.id,
        {
          value: m.id === 'pts' || m.id === 'team_pts' ? pts : m.id === 'gs' ? 1 : 4,
          raw: 4,
          sample: 1,
          qualified: true,
          percentile: null,
          rank: null
        }
      ])
    )
  const rows =
    q.entity === 'player'
      ? [
          { id: '1', name: 'Jayson Tatum', team: 10, pts: 110 },
          { id: '2', name: 'Luka Dončić', team: 20, pts: 100 }
        ].map((p) => ({
          id: p.id,
          name: p.name,
          team: null,
          position: 'F',
          group: { team: p.team },
          games: 1,
          values: values(p.pts)
        }))
      : [
          { id: '10', pts: 110 },
          { id: '20', pts: 102 }
        ].map((t) => ({
          id: t.id,
          name: t.id,
          team: null,
          position: null,
          group: {},
          games: 1,
          values: values(t.pts)
        }))
  return {
    grain: 'game',
    columns: metrics.map((m) => ({
      id: m.id,
      label: m.label,
      short: m.short,
      unit: m.unit,
      decimals: m.decimals,
      direction: m.direction,
      seasons: [2026],
      reason: null
    })),
    rows,
    total: rows.length,
    notes: [],
    ms: 1
  }
}

async function openGames(): Promise<ReturnType<typeof within>> {
  render(
    <StatsApp
      update={{ status: 'idle' }}
      version="0.1.0"
      onOpenUpdate={() => {}}
      onToggleTheme={() => {}}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Games' }))
  const rail = await screen.findByRole('complementary', { name: 'Games' })
  return within(rail)
}

beforeEach(() => {
  vi.mocked(api.stats.status).mockResolvedValue(BUILT)
  vi.mocked(api.stats.catalogue).mockResolvedValue(catalogueFixture())
  vi.mocked(api.stats.seasons).mockResolvedValue(SEASONS)
  vi.mocked(api.stats.views).mockResolvedValue([])
  vi.mocked(api.stats.query).mockImplementation((q) => Promise.resolve(answer(q)))
  vi.mocked(api.stats.games).mockImplementation((s) => Promise.resolve(s === 2026 ? GAMES : []))
  vi.mocked(api.stats.standings).mockResolvedValue([])
  vi.mocked(api.stats.player).mockResolvedValue(null)
  vi.mocked(api.stats.game).mockImplementation((id) =>
    Promise.resolve({
      id,
      venue: 'TD Garden',
      city: 'Boston',
      attendance: 19156,
      note: null,
      periods: { home: [30, 30, 25, 25], away: [25, 25, 26, 26] }
    })
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the games screen', () => {
  it('opens on the latest day played, with its box score', async () => {
    const rail = await openGames()
    expect(await rail.findByText(/1 GAME · JAN 7, 2026/)).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 1, name: 'Final' })).toBeTruthy()
    expect(await screen.findByText('TD Garden, Boston · 19,156')).toBeTruthy()
    const box = within(await screen.findByRole('table', { name: 'BOS box score' }))
    expect(box.getByRole('row', { name: /Jayson Tatum/ })).toBeTruthy()
    expect(box.getByText('Starters')).toBeTruthy()
    expect(box.getByText('Totals')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Score by period' })).toBeTruthy()
    expect(screen.getByRole('table', { name: 'The teams' })).toBeTruthy()
  })

  it('asks the engine for one game by its id', async () => {
    await openGames()
    await screen.findByRole('table', { name: 'BOS box score' })
    const asked = vi.mocked(api.stats.query).mock.calls.map(([q]) => q)
    expect(asked.some((q) => q.scope.games?.[0] === 'last' && q.entity === 'player')).toBe(true)
  })

  it('moves by day, and opens another of the day’s games', async () => {
    const rail = await openGames()
    await screen.findByRole('table', { name: 'BOS box score' })
    expect(screen.getByRole('button', { name: 'The day after' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'The day before' }))
    expect(await rail.findByText(/2 GAMES · JAN 5, 2026/)).toBeTruthy()
    const buttons = within(rail.getByRole('list')).getAllByRole('listitem')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].getAttribute('aria-current')).toBe('true')
    fireEvent.click(buttons[1])
    expect(await screen.findByRole('heading', { level: 1, name: 'Final/OT' })).toBeTruthy()
    await waitFor(() =>
      expect(
        vi.mocked(api.stats.query).mock.calls.some(([q]) => q.scope.games?.[0] === 'second')
      ).toBe(true)
    )
  })

  it('says why a preseason game has no box score, and asks the engine nothing', async () => {
    await openGames()
    await screen.findByRole('table', { name: 'BOS box score' })
    vi.mocked(api.stats.query).mockClear()
    fireEvent.change(screen.getByRole('combobox', { name: 'Day' }), {
      target: { value: '2025-10-02' }
    })
    expect(
      await screen.findByText('Preseason games have no box score in either source.')
    ).toBeTruthy()
    expect(screen.queryByRole('table', { name: 'BOS box score' })).toBeNull()
    expect(vi.mocked(api.stats.query).mock.calls.some(([q]) => q.scope.games?.[0] === 'pre')).toBe(
      false
    )
  })

  it('says when a season has nothing on the schedule', async () => {
    await openGames()
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), {
      target: { value: '2025' }
    })
    expect(await screen.findByText('No games on the schedule for 2024-25.')).toBeTruthy()
  })

  it('opens the team', async () => {
    await openGames()
    await screen.findByRole('table', { name: 'BOS box score' })
    fireEvent.click(screen.getByRole('button', { name: 'Boston Celtics' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'BOS' })).toBeTruthy()
  })

  it('opens a player from the box score', async () => {
    await openGames()
    vi.mocked(api.stats.player).mockResolvedValue({
      id: '1',
      name: 'Jayson Tatum',
      position: 'F',
      team: null,
      seasons: [2026],
      number: null,
      height: null,
      weight: null,
      birthDate: null,
      school: null
    })
    const box = within(await screen.findByRole('table', { name: 'BOS box score' }))
    fireEvent.click(box.getByRole('row', { name: /Jayson Tatum/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Tatum/ })).toBeTruthy()
  })
})
