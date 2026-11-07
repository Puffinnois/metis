// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api'
import { StatsApp } from '@/screens/stats/StatsApp'
import type { StatsQuery, StatsResult, StatsSeason } from '@shared/stats/types'
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
      player: vi.fn(),
      games: vi.fn(),
      standings: vi.fn(),
      views: vi.fn(),
      saveView: vi.fn(),
      deleteView: vi.fn(),
      exportCsv: vi.fn()
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
    types: [
      { type: 'regular', games: 1230 },
      { type: 'playoffs', games: 85 }
    ],
    teams: [
      { id: '1610612738', code: 'BOS', name: 'Boston', conference: 'east', division: 'atlantic' }
    ]
  },
  {
    season: 1995,
    firstDate: '1994-11-04',
    lastDate: '1995-06-14',
    types: [{ type: 'regular', games: 1107 }],
    teams: []
  }
]

/** Every metric asked for, reading 12, for two players and a reason for what the season lacks. */
function answer(q: StatsQuery): StatsResult {
  const season = q.scope.seasons[0]
  const metrics = catalogueFixture().filter((m) => q.metrics.includes(m.id))
  const rows = ['Luka Dončić', 'Jayson Tatum'].map((name, i) => ({
    id: String(i + 1),
    name,
    team: 'BOS',
    position: 'G',
    group: {},
    games: 70,
    values: Object.fromEntries(
      metrics.map((m) => [
        m.id,
        {
          value: season < m.firstSeason ? null : 12 - i,
          raw: 12,
          sample: 100,
          qualified: true,
          percentile: 90 - i * 50,
          rank: i + 1
        }
      ])
    )
  }))
  return {
    grain: 'season',
    columns: metrics.map((m) => ({
      id: m.id,
      label: m.label,
      short: m.short,
      unit: m.unit,
      decimals: m.decimals,
      direction: m.direction,
      seasons: season < m.firstSeason ? [] : [season],
      reason: season < m.firstSeason ? 'Recorded from 1996-97.' : null
    })),
    rows,
    total: rows.length,
    notes: [],
    ms: 3
  }
}

function renderApp(): void {
  render(
    <StatsApp
      update={{ status: 'idle' }}
      version="0.1.0"
      onOpenUpdate={() => {}}
      onToggleTheme={() => {}}
    />
  )
}

const lastQuery = (): StatsQuery => vi.mocked(api.stats.query).mock.lastCall![0]

/** The home's boards end on a team's: this is the last one a player board asked. */
const lastPlayerQuery = (): StatsQuery =>
  vi
    .mocked(api.stats.query)
    .mock.calls.map(([q]) => q)
    .filter((q) => q.entity === 'player')
    .at(-1)!

beforeEach(() => {
  vi.mocked(api.stats.status).mockResolvedValue(BUILT)
  vi.mocked(api.stats.catalogue).mockResolvedValue(catalogueFixture())
  vi.mocked(api.stats.seasons).mockResolvedValue(SEASONS)
  vi.mocked(api.stats.views).mockResolvedValue([])
  vi.mocked(api.stats.query).mockReset()
  vi.mocked(api.stats.query).mockImplementation(async (q) => answer(q))
  vi.mocked(api.stats.games).mockResolvedValue([])
  vi.mocked(api.stats.standings).mockResolvedValue([])
  vi.mocked(api.stats.player).mockImplementation(async (id) => ({
    id,
    name: 'Luka Dončić',
    position: 'G',
    team: null,
    seasons: [2026],
    number: null,
    height: null,
    weight: null,
    birthDate: null,
    school: null
  }))
})

afterEach(cleanup)

describe('the home', () => {
  it('shows eight boards, per game, and a leader', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Leaderboards' })).toBeTruthy()
    for (const title of ['Points', 'Rebounds', 'Assists', 'Net rating']) {
      expect(await screen.findByText(title)).toBeTruthy()
    }
    await waitFor(() => expect(screen.getAllByText('Luka Dončić').length).toBe(8))
    expect(lastQuery().transform).toBe('perGame')
    expect(screen.getByText(/2025-26 · Regular season · Whole season/)).toBeTruthy()
  })

  it('switches to totals and to another season', async () => {
    renderApp()
    await screen.findAllByText('Luka Dončić')
    fireEvent.click(screen.getByRole('radio', { name: 'Totals' }))
    await waitFor(() => expect(lastQuery().transform).toBe('raw'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), {
      target: { value: '1995' }
    })
    await waitFor(() => expect(lastQuery().scope.seasons).toEqual([1995]))
    expect(screen.getByText(/1994-95 · Regular season/)).toBeTruthy()
  })

  it('opens the full board, sorted by that metric, in the same mode', async () => {
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Open the full Assists board' }))
    expect(await screen.findByRole('heading', { name: /player leaderboard/ })).toBeTruthy()
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({
        sort: { metric: 'ast', dir: 'desc' },
        transform: 'perGame'
      })
    )
  })

  it('opens a team board on the team leaderboard', async () => {
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Open the full Net rating board' }))
    expect(await screen.findByRole('heading', { name: /team offense leaderboard/ })).toBeTruthy()
  })
})

describe('the scope bar', () => {
  it('offers only the types a season has box scores for', async () => {
    renderApp()
    await screen.findAllByText('Luka Dončić')
    const type = screen.getByRole('combobox', { name: 'Season type' })
    expect(within(type).queryByRole('option', { name: 'Preseason' })).toBeNull()
    expect(within(type).getByRole('option', { name: 'Playoffs' })).toBeTruthy()
    expect(within(type).getByRole('option', { name: 'Regular season and after' })).toBeTruthy()
  })

  it('reads a date range, inside the season', async () => {
    renderApp()
    await screen.findAllByText('Luka Dončić')
    fireEvent.change(screen.getByRole('combobox', { name: 'Range' }), {
      target: { value: 'dates' }
    })
    await waitFor(() => expect(lastQuery().scope.dates).toEqual(['2025-10-21', '2026-06-13']))
    const from = screen.getByLabelText('From date') as HTMLInputElement
    expect(from.min).toBe('2025-10-21')
    fireEvent.change(from, { target: { value: '2026-01-01' } })
    await waitFor(() => expect(lastQuery().scope.dates).toEqual(['2026-01-01', '2026-06-13']))
  })

  it('reads the last N games, a player’s or their team’s', async () => {
    renderApp()
    await screen.findAllByText('Luka Dončić')
    fireEvent.change(screen.getByRole('combobox', { name: 'Range' }), {
      target: { value: 'last' }
    })
    await waitFor(() =>
      expect(lastPlayerQuery().scope).toMatchObject({ lastN: 10, lastNOf: 'appearances' })
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'How many games' }), {
      target: { value: '5' }
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Whose games' }), {
      target: { value: 'team' }
    })
    await waitFor(() =>
      expect(lastPlayerQuery().scope).toMatchObject({ lastN: 5, lastNOf: 'team' })
    )
    // A team's board reads its own last games.
    const team = vi
      .mocked(api.stats.query)
      .mock.calls.map(([q]) => q)
      .filter((q) => q.entity === 'team')
      .at(-1)!
    expect(team.scope).toMatchObject({ lastN: 5 })
    expect(team.scope).not.toHaveProperty('lastNOf')
  })
})

describe('the leaderboard', () => {
  /** Players opens the dashboard; its leaderboards are a click on. */
  const toLeaderboard = async (): Promise<void> => {
    fireEvent.click(await screen.findByRole('button', { name: 'Player leaderboards →' }))
  }

  async function openPlayers(): Promise<void> {
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Players' }))
    await toLeaderboard()
    await screen.findByText('Luka Dončić')
  }

  it('shows the rows, their position group, and the column heads', async () => {
    await openPlayers()
    expect(screen.getByRole('heading', { name: /2025-26 player leaderboard/ })).toBeTruthy()
    // The sorted column's head carries its arrow.
    expect(screen.getByRole('columnheader', { name: /^PTS/ })).toBeTruthy()
    for (const head of ['TS%', 'AST', 'REB', '+/-']) {
      expect(screen.getByRole('columnheader', { name: head })).toBeTruthy()
    }
  })

  it('moves to a position tab, keeping the mode', async () => {
    await openPlayers()
    fireEvent.click(screen.getByRole('radio', { name: 'Per 36' }))
    await waitFor(() => expect(lastQuery().transform).toBe('per36'))
    fireEvent.click(screen.getByRole('tab', { name: 'Centers' }))
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ transform: 'per36', scope: { positions: ['C'] } })
    )
    expect(screen.getByRole('heading', { name: /center leaderboard/ })).toBeTruthy()
  })

  it('sorts by a column, best first, then the other way', async () => {
    await openPlayers()
    fireEvent.click(screen.getByRole('columnheader', { name: 'AST' }))
    await waitFor(() => expect(lastQuery().sort).toEqual({ metric: 'ast', dir: 'desc' }))
    fireEvent.click(screen.getByRole('columnheader', { name: /AST/ }))
    await waitFor(() => expect(lastQuery().sort).toEqual({ metric: 'ast', dir: 'asc' }))
  })

  it('filters by team and finds a name without its accents', async () => {
    await openPlayers()
    fireEvent.change(screen.getByRole('combobox', { name: 'Team' }), {
      target: { value: '1610612738' }
    })
    await waitFor(() => expect(lastQuery().scope.teams).toEqual(['1610612738']))
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'doncic' } })
    expect(screen.getByText('Luka Dončić')).toBeTruthy()
    expect(screen.queryByText('Jayson Tatum')).toBeNull()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'nobody' } })
    expect(await screen.findByText('No players match.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(await screen.findByText('Jayson Tatum')).toBeTruthy()
  })

  it('shows a preset of a family', async () => {
    await openPlayers()
    fireEvent.change(screen.getByRole('combobox', { name: 'Metric family' }), {
      target: { value: 'composite' }
    })
    await waitFor(() => expect(lastQuery().metrics).toContain('eff'))
    expect(screen.getByRole('columnheader', { name: 'GmSc' })).toBeTruthy()
  })

  it('reads a gap as a dash with its reason, not an error', async () => {
    await openPlayers()
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), {
      target: { value: '1995' }
    })
    const cell = await screen.findAllByTitle('Recorded from 1996-97.')
    expect(cell[0].textContent).toBe('—')
    expect(screen.getByRole('heading', { name: /1994-95 player leaderboard/ })).toBeTruthy()
  })

  it('exports what is shown, and says where it went', async () => {
    vi.mocked(api.stats.exportCsv).mockResolvedValue('/home/x/stats.csv')
    await openPlayers()
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() => expect(api.stats.exportCsv).toHaveBeenCalled())
    const [name, csv] = vi.mocked(api.stats.exportCsv).mock.lastCall!
    expect(name).toBe('stats-2025-26-all-players-whole-season.csv')
    expect(csv).toContain('Luka Dončić')
    expect(await screen.findByText('Saved 2 rows to /home/x/stats.csv')).toBeTruthy()
  })

  it('reads a team table with no qualifier and no player columns', async () => {
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Teams' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Team leaderboards →' }))
    await screen.findByRole('heading', { name: /team offense leaderboard/ })
    await screen.findByText('Luka Dončić')
    expect(screen.queryByRole('button', { name: /Qualified only/ })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Team' })).toBeNull()
    expect(lastQuery().entity).toBe('team')
    fireEvent.click(screen.getByRole('tab', { name: 'Defense' }))
    await waitFor(() => expect(lastQuery().sort).toEqual({ metric: 'team_drtg', dir: 'asc' }))
  })

  it('shows the engine’s error, and its notes', async () => {
    vi.mocked(api.stats.query).mockRejectedValue(new Error('the query took longer than 5 s'))
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Players' }))
    expect(await screen.findByText('the query took longer than 5 s')).toBeTruthy()
  })
})

describe('saved views', () => {
  it('lists them on the home and opens one', async () => {
    const board = {
      entity: 'player' as const,
      tab: 'C',
      columns: ['reb', 'blk'],
      sort: { by: 'blk', dir: 'desc' as const },
      mode: 'per36' as const,
      qualifiedOnly: true,
      team: null
    }
    vi.mocked(api.stats.views).mockResolvedValue([
      { id: 1, name: 'Rim protectors', board, updatedAt: 't' }
    ])
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Rim protectors' }))
    expect(await screen.findByRole('heading', { name: /center leaderboard/ })).toBeTruthy()
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({
        metrics: ['reb', 'blk', 'min'],
        transform: 'per36',
        sort: { metric: 'blk', dir: 'desc' }
      })
    )
  })
})

describe('re-reading', () => {
  it('asks again when a refresh has rebuilt the tables, and not before', async () => {
    renderApp()
    await screen.findAllByText('Luka Dončić')
    const changed = vi.mocked(api.stats.onChanged).mock.lastCall![0]
    await waitFor(() => expect(api.stats.query).toHaveBeenCalledTimes(8))
    vi.mocked(api.stats.status).mockResolvedValue({ ...BUILT, busy: true })
    changed()
    await screen.findByText(/updating/)
    expect(api.stats.query).toHaveBeenCalledTimes(8)
    vi.mocked(api.stats.status).mockResolvedValue({
      ...BUILT,
      builtAt: '2026-11-06T13:00:00Z'
    })
    changed()
    await waitFor(() => expect(api.stats.query).toHaveBeenCalledTimes(16))
  })
})

describe('the glossary', () => {
  it('lists the metrics, by entity, family and search', async () => {
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Glossary' }))
    expect(await screen.findByRole('heading', { name: 'Glossary' })).toBeTruthy()
    expect(screen.getByText('True shooting percentage')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search metrics'), { target: { value: 'usage' } })
    expect(screen.getByText('Usage percentage')).toBeTruthy()
    expect(screen.queryByText('True shooting percentage')).toBeNull()
    fireEvent.change(screen.getByLabelText('Search metrics'), { target: { value: 'zzz' } })
    expect(screen.getByText('No metric matches.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search metrics'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Teams' }))
    expect(screen.getByText('Net rating')).toBeTruthy()
    expect(screen.getAllByText('Estimated').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByRole('combobox', { name: 'Family' }), {
      target: { value: 'composite' }
    })
    expect(screen.queryByText('Net rating')).toBeNull()
    expect(screen.getByText('Team Impact Estimate')).toBeTruthy()
  })

  it('says when a metric starts and what the source skips', async () => {
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Glossary' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Teams' }))
    fireEvent.change(screen.getByLabelText('Search metrics'), {
      target: { value: 'field-goal points from inside' }
    })
    expect(screen.getAllByText('2008-09, except 2017-18').length).toBe(2)
  })
})
