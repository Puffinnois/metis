// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api'
import { StatsApp } from '@/screens/stats/StatsApp'
import type {
  StatsGame,
  StatsQuery,
  StatsResult,
  StatsSeason,
  StatsStanding
} from '@shared/stats/types'
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
      standings: vi.fn(),
      availability: vi.fn(() => Promise.resolve([])),
      coaches: vi.fn(() => Promise.resolve([]))
    },
    dev: { mode: vi.fn().mockResolvedValue(false), onModeChanged: vi.fn(() => () => {}) }
  }
}))

const BUILT = {
  available: true,
  through: { season: 2009, date: '2009-06-14' },
  updatedAt: '2026-11-06T12:00:00Z',
  builtAt: '2026-11-06T12:00:00Z',
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

const FRANCHISE = '60'

const SEASONS: StatsSeason[] = [
  {
    season: 2009,
    firstDate: '2008-10-28',
    lastDate: '2009-06-14',
    types: [
      { type: 'regular', games: 1230 },
      { type: 'playoffs', games: 85 }
    ],
    teams: [
      {
        id: FRANCHISE,
        code: 'OKC',
        name: 'Oklahoma City Thunder',
        conference: 'west',
        division: 'northwest'
      },
      { id: '20', code: 'LAL', name: 'Los Angeles Lakers', conference: 'west', division: 'pacific' }
    ]
  },
  {
    season: 2008,
    firstDate: '2007-10-30',
    lastDate: '2008-06-17',
    types: [{ type: 'regular', games: 1230 }],
    teams: [
      {
        id: FRANCHISE,
        code: 'SEA',
        name: 'Seattle SuperSonics',
        conference: 'west',
        division: 'northwest'
      }
    ]
  },
  {
    season: 1995,
    firstDate: '1994-11-04',
    lastDate: '1995-06-14',
    types: [{ type: 'regular', games: 1107 }],
    teams: [
      { id: '20', code: 'LAL', name: 'Los Angeles Lakers', conference: 'west', division: 'p' }
    ]
  }
]

const game = (id: string, date: string, season: number, us: number, them: number): StatsGame => ({
  id,
  season,
  type: 'regular',
  date,
  home: { id: FRANCHISE, code: season === 2009 ? 'OKC' : 'SEA', name: 'Home', score: us },
  away: { id: '20', code: 'LAL', name: 'Los Angeles Lakers', score: them },
  played: true,
  hasBox: true,
  overtimes: 0
})

const GAMES: Record<number, StatsGame[]> = {
  2009: [
    game('w', '2009-01-05', 2009, 110, 100),
    game('l', '2009-01-07', 2009, 90, 100),
    {
      ...game('n', '2099-01-07', 2009, 0, 0),
      played: false,
      home: { id: FRANCHISE, code: 'OKC', name: 'Home', score: null },
      away: { id: '20', code: 'LAL', name: 'Lakers', score: null }
    }
  ],
  2008: [game('old', '2008-01-05', 2008, 100, 90)]
}

const STANDING: StatsStanding = {
  teamId: FRANCHISE,
  code: 'OKC',
  name: 'Oklahoma City Thunder',
  conference: 'West',
  division: 'Northwest',
  conferenceRank: 13,
  divisionRank: 5,
  wins: 23,
  losses: 59,
  winPct: 0.28,
  conferenceGamesBack: 42,
  divisionGamesBack: 31,
  home: '15-26',
  road: '8-33',
  conferenceRecord: '10-42',
  divisionRecord: '4-12',
  last10: '4-6',
  streak: 'W 1',
  pointsPerGame: 97,
  allowedPerGame: 103.1,
  differential: -6.1
}

/** A franchise's rows read each season's name; a metric the season lacks reads null with a reason. */
function answer(q: StatsQuery): StatsResult {
  const season = q.scope.seasons[0]
  const metrics = catalogueFixture().filter((m) => q.metrics.includes(m.id))
  const values = (s: number): StatsResult['rows'][number]['values'] =>
    Object.fromEntries(
      metrics.map((m) => [
        m.id,
        {
          value: s < m.firstSeason ? null : 20,
          raw: 20,
          sample: 100,
          qualified: true,
          percentile: 60,
          rank: 12
        }
      ])
    )
  const rows =
    q.entity === 'player'
      ? [
          {
            id: '1',
            name: 'Kevin Durant',
            team: 'OKC',
            position: 'F',
            group: {},
            games: 74,
            values: values(season)
          }
        ]
      : q.groupBy?.includes('season')
        ? [2009, 2008].map((s) => ({
            id: FRANCHISE,
            name: s === 2009 ? 'Oklahoma City Thunder' : 'Seattle SuperSonics',
            team: s === 2009 ? 'OKC' : 'SEA',
            position: null,
            group: { season: s },
            games: 82,
            values: values(s)
          }))
        : [
            {
              id: FRANCHISE,
              name: 'Oklahoma City Thunder',
              team: 'OKC',
              position: null,
              group: {},
              games: 82,
              values: values(season)
            }
          ]
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
      reason: season < m.firstSeason ? `Recorded from 2008-09.` : null
    })),
    rows,
    total: rows.length,
    notes: [],
    ms: 1
  }
}

async function openTeams(): Promise<void> {
  render(
    <StatsApp
      update={{ status: 'idle' }}
      version="0.1.0"
      onOpenUpdate={() => {}}
      onToggleTheme={() => {}}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Teams' }))
  await screen.findByRole('heading', { level: 1, name: 'OKC' })
}

beforeEach(() => {
  vi.mocked(api.stats.status).mockResolvedValue(BUILT)
  vi.mocked(api.stats.catalogue).mockResolvedValue(catalogueFixture())
  vi.mocked(api.stats.seasons).mockResolvedValue(SEASONS)
  vi.mocked(api.stats.views).mockResolvedValue([])
  vi.mocked(api.stats.query).mockImplementation((q) => Promise.resolve(answer(q)))
  vi.mocked(api.stats.game).mockResolvedValue(null)
  vi.mocked(api.stats.games).mockImplementation((s) => Promise.resolve(GAMES[s] ?? []))
  vi.mocked(api.stats.standings).mockImplementation((s) =>
    Promise.resolve(s === 2009 ? [STANDING] : [])
  )
  vi.mocked(api.stats.player).mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the team dashboard', () => {
  it('opens on the best record, with its standing, record and results', async () => {
    await openTeams()
    expect(await screen.findByText(/13th in the West · 5th in the Northwest/)).toBeTruthy()
    expect(await screen.findByText('1-1')).toBeTruthy()
    expect(screen.getByText('+0.0'.replace('+', ''))).toBeTruthy()
    const strip = within(screen.getByRole('list', { name: 'Results' }))
    expect(strip.getByText('W 110–100')).toBeTruthy()
    expect(strip.getByText('L 90–100')).toBeTruthy()
    expect(strip.getByText('Next')).toBeTruthy()
    for (const name of ['Overview', 'Offense', 'Defense', 'Players', 'Schedule']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy()
    }
  })

  it('follows a relocated franchise across seasons, under each season’s name', async () => {
    await openTeams()
    const history = within(await screen.findByRole('table', { name: 'Season by season' }))
    expect(history.getByText('Oklahoma City Thunder')).toBeTruthy()
    expect(history.getByText('Seattle SuperSonics')).toBeTruthy()
    fireEvent.click(history.getByRole('row', { name: /2007-08/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'SEA' })).toBeTruthy()
    expect(await screen.findByText('1-0')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Season' })).toHaveProperty('value', '2008')
  })

  it('says so when the franchise did not play that season', async () => {
    await openTeams()
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), {
      target: { value: '1995' }
    })
    expect(await screen.findByText('This franchise did not play in 1994-95.')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Team' })).toHaveProperty('value', FRANCHISE)
  })

  it('reads a stat tab, and says why one is empty', async () => {
    await openTeams()
    fireEvent.click(screen.getByRole('tab', { name: 'Offense' }))
    expect(await screen.findByText('Four factors')).toBeTruthy()
    expect(screen.getByText(/among the 1 teams/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Defense' }))
    expect(await screen.findByText('Shooting allowed')).toBeTruthy()
  })

  it('lists the players, and opens one', async () => {
    await openTeams()
    fireEvent.click(screen.getByRole('tab', { name: 'Players' }))
    const players = within(await screen.findByRole('table', { name: 'Players' }))
    expect(players.getByText('Kevin Durant')).toBeTruthy()
    vi.mocked(api.stats.player).mockResolvedValue({
      id: '1',
      name: 'Kevin Durant',
      position: 'F',
      team: null,
      seasons: [2009],
      number: null,
      height: null,
      weight: null,
      birthDate: null,
      school: null
    })
    fireEvent.click(players.getByRole('row', { name: /Kevin Durant/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Durant/ })).toBeTruthy()
  })

  it('lists the schedule with the record after each game', async () => {
    await openTeams()
    fireEvent.click(screen.getByRole('tab', { name: 'Schedule' }))
    const schedule = within(await screen.findByRole('table', { name: 'Schedule' }))
    expect(schedule.getAllByRole('row')).toHaveLength(4)
    expect(schedule.getByText('1-0')).toBeTruthy()
    expect(schedule.getByText('1-1')).toBeTruthy()
    fireEvent.click(schedule.getByRole('row', { name: /Jan 5/ }))
    await screen.findByRole('complementary', { name: 'Games' })
  })

  it('moves to the next team and to the leaderboards', async () => {
    await openTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Next team' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'LAL' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Team leaderboards →' }))
    expect(await screen.findByRole('heading', { name: /team offense leaderboard/ })).toBeTruthy()
  })

  it("opens Trends on the dashboard's team", async () => {
    await openTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Trends →' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Trends' }).getAttribute('aria-selected')).toBe('true')
    )
    expect(document.querySelector('[data-subject]')?.getAttribute('data-subject')).toMatch(/^team:/)
  })
})

describe('the standings', () => {
  const openStandings = async (): Promise<void> => {
    render(
      <StatsApp
        update={{ status: 'idle' }}
        version="0.1.0"
        onOpenUpdate={() => {}}
        onToggleTheme={() => {}}
      />
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Standings' }))
    await screen.findByRole('heading', { level: 1, name: '2008-09 standings' })
  }

  it('reads the conference table, then the division’s, and opens a team', async () => {
    await openStandings()
    const west = within(await screen.findByRole('table', { name: 'West standings' }))
    expect(west.getByRole('row', { name: /Oklahoma City Thunder/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Division' }))
    const division = within(await screen.findByRole('table', { name: 'Northwest standings' }))
    fireEvent.click(division.getByRole('row', { name: /Oklahoma City Thunder/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'OKC' })).toBeTruthy()
  })

  it('says when they start', async () => {
    await openStandings()
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), {
      target: { value: '1995' }
    })
    expect(await screen.findByText('Published standings start in 1995-96.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull())
  })
})
