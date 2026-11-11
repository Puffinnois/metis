// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api'
import type { StatsScope } from '@/lib/stats/scope'
import { DEFAULT_TRENDS, type TrendsState } from '@/lib/stats/trends'
import type { StatsData } from '@/lib/stats/useStats'
import { StatsTrends } from '@/screens/stats/StatsTrends'
import type {
  MetricValue,
  StatsQuery,
  StatsResult,
  StatsRow,
  StatsStatus
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

vi.mock('@/lib/api', () => ({
  api: { stats: { query: vi.fn() } }
}))

const STATUS: StatsStatus = {
  available: true,
  through: { season: 2016, date: '2016-04-13' },
  updatedAt: null,
  builtAt: '2026-11-06T12:00:00Z',
  busy: false,
  progress: null,
  paused: false,
  noRoom: null
}

const catalogue = catalogueFixture()
const DATA: StatsData = {
  status: STATUS,
  catalogue,
  byId: new Map(catalogue.map((m) => [m.id, m])),
  seasons: [],
  version: 'v1',
  error: null
}

const SCOPE: StatsScope = { season: 2016, seasonType: 'regular', range: { kind: 'season' } }

const val = (value: number | null, qualified = true, sample = 2000): MetricValue => ({
  value,
  raw: value,
  sample,
  qualified,
  percentile: null,
  rank: null
})

const row = (
  id: string,
  season: number,
  values: Record<string, MetricValue>,
  games = 70
): StatsRow => ({
  id,
  name: id === '2544' ? 'LeBron James' : `Player ${id}`,
  team: 'CLE',
  position: 'F',
  group: { season },
  games,
  values
})

const answer = (rows: StatsRow[], q: StatsQuery): StatsResult => ({
  grain: 'season',
  columns: q.metrics.map((id) => ({
    id,
    label: id,
    short: id,
    unit: 'number',
    decimals: 1,
    direction: 'higher',
    seasons: [],
    reason: null
  })),
  rows,
  total: rows.length,
  notes: [],
  ms: 1
})

/** LeBron James: 2011-12 to 2015-16, a missed 2013-14, drives recorded from 2013-14. */
function respond(q: StatsQuery): StatsResult {
  const m = q.metrics[0]
  const lebron: Record<number, number> = { 2012: 27, 2013: 26, 2015: 25, 2016: 25 }
  if (q.scope.players?.[0] === '2544' && q.groupBy?.includes('month')) {
    return answer(
      [2012, 2013, 2015, 2016].map((s) => ({
        ...row('2544', s, { min: val(1000) }),
        team: s >= 2015 ? 'CLE' : 'MIA',
        group: { season: s, team: 1, month: 11 }
      })),
      q
    )
  }
  if (q.scope.players?.[0] === '2544') {
    return answer(
      Object.entries(lebron).map(([s, v]) =>
        row('2544', Number(s), {
          [m]: val(m === 'drives' ? (Number(s) >= 2014 ? v : 0) : v),
          min: val(2500)
        })
      ),
      q
    )
  }
  if (q.scope.qualifiedOnly) {
    const rows = q.scope.seasons.flatMap((s) => [
      ...(lebron[s] ? [row('2544', s, { [m]: val(lebron[s]), min: val(2500) })] : []),
      row('1', s, { [m]: val(30), min: val(2500) }),
      row('2', s, { [m]: val(10), min: val(2500) }),
      row('3', s, { [m]: val(20), min: val(2500) })
    ])
    return answer(rows, q)
  }
  // The search.
  return answer([row('2544', 2016, {}), row('1', 2016, {})], q)
}

function Harness({ initial }: { initial: TrendsState }): React.JSX.Element {
  const [state, setState] = React.useState(initial)
  return (
    <StatsTrends
      data={DATA}
      scope={SCOPE}
      state={state}
      onState={(u) => setState(u)}
      fallback={{ entity: 'player', id: '2544' }}
      onOpenPlayer={opened}
      onOpenTeam={() => {}}
    />
  )
}

const opened = vi.fn()

beforeEach(() => {
  vi.mocked(api.stats.query).mockImplementation((q: StatsQuery) => Promise.resolve(respond(q)))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StatsTrends', () => {
  it("follows the dashboard's player: a point a season, ranked in its own pool, a gap for a missed season", async () => {
    render(<Harness initial={DEFAULT_TRENDS} />)
    expect(await screen.findByRole('heading', { name: 'LeBron James' })).toBeTruthy()
    const table = screen.getByRole('table', { name: 'Seasons' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.getAttribute('data-season-row'))).toEqual([
      '2016',
      '2015',
      '2014',
      '2013',
      '2012'
    ])
    expect(within(rows[0]).getByText('2nd of 4')).toBeTruthy()
    expect(within(rows[2]).getByText('Did not play')).toBeTruthy()
    expect(within(rows[4]).getByText('MIA')).toBeTruthy()
    const svg = screen.getByRole('img', { name: /by season/ })
    expect(svg.querySelectorAll('[data-point]')).toHaveLength(4)
    expect(svg.querySelector('[data-band="inner"]')?.getAttribute('d')).toMatch(/Z/)
    // The line breaks at the missed season: two runs.
    expect(svg.querySelector('[data-line]')?.getAttribute('d')?.match(/M/g)).toHaveLength(2)
    expect(screen.getByText(/season and range do not apply/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Player dashboard →' }))
    expect(opened).toHaveBeenCalledWith('2544')
  })

  it('reads blank before a metric is recorded and marks where it starts', async () => {
    render(<Harness initial={{ ...DEFAULT_TRENDS, metric: 'drives' }} />)
    await screen.findByRole('heading', { name: 'LeBron James' })
    const svg = screen.getByRole('img', { name: /by season/ })
    expect(svg.querySelector('[data-coverage-start="2014"]')?.textContent).toBe(
      'Recorded from 2013-14.'
    )
    // 2011-12 and 2012-13 are before tracking: no points, never zeros.
    expect(
      [...svg.querySelectorAll('[data-point]')].map((c) => c.getAttribute('data-point'))
    ).toEqual(['2015', '2016'])
    const rows = within(screen.getByRole('table', { name: 'Seasons' })).getAllByRole('row')
    expect(within(rows[5]).getByText('Not recorded')).toBeTruthy()
  })

  it('asks only for the season type of the scope, over every season of the career', async () => {
    render(<Harness initial={DEFAULT_TRENDS} />)
    await screen.findByRole('heading', { name: 'LeBron James' })
    const asked = vi.mocked(api.stats.query).mock.calls.map(([q]) => q)
    const pool = asked.find((q) => q.scope.qualifiedOnly)!
    expect(pool.scope.seasons).toEqual([2012, 2013, 2014, 2015, 2016])
    expect(pool.scope.gameTypes).toEqual(['regular'])
    expect(asked.every((q) => !q.scope.dates && !q.scope.lastN)).toBe(true)
  })

  it('switches the mode for a total', async () => {
    render(<Harness initial={DEFAULT_TRENDS} />)
    await screen.findByRole('heading', { name: 'LeBron James' })
    fireEvent.click(screen.getByRole('radio', { name: 'Totals' }))
    await waitFor(() =>
      expect(
        vi
          .mocked(api.stats.query)
          .mock.calls.some(([q]) => q.transform === 'raw' && q.scope.players)
      ).toBe(true)
    )
  })

  /** The pool's answers cut off at the row limit when `cut` says so. */
  const cutWhen = (cut: (seasons: number[]) => boolean): void => {
    vi.mocked(api.stats.query).mockImplementation((q: StatsQuery) => {
      const r = respond(q)
      return Promise.resolve(
        q.scope.qualifiedOnly && cut(q.scope.seasons) ? { ...r, total: r.rows.length + 1 } : r
      )
    })
  }
  const poolAsked = (): number[][] =>
    vi
      .mocked(api.stats.query)
      .mock.calls.map(([q]) => q)
      .filter((q) => q.scope.qualifiedOnly)
      .map((q) => q.scope.seasons)

  it('asks again in halves when a part of the pool is cut off, and still draws every band', async () => {
    cutWhen((seasons) => seasons.length > 2)
    render(<Harness initial={DEFAULT_TRENDS} />)
    await screen.findByRole('heading', { name: 'LeBron James' })
    await waitFor(() =>
      expect(poolAsked()).toEqual([
        [2012, 2013, 2014, 2015, 2016],
        [2012, 2013, 2014],
        [2015, 2016],
        [2012, 2013],
        [2014],
        [2015, 2016]
      ])
    )
    const rows = within(await screen.findByRole('table', { name: 'Seasons' })).getAllByRole('row')
    expect(within(rows[1]).getByText('2nd of 4')).toBeTruthy()
    expect(screen.queryByText(/Too many players/)).toBeNull()
  })

  it('says so when one season alone is cut off: no band and no rank there', async () => {
    cutWhen((seasons) => seasons.includes(2015))
    render(<Harness initial={DEFAULT_TRENDS} />)
    await screen.findByRole('heading', { name: 'LeBron James' })
    expect(
      await screen.findByText('Too many players to read the league in 2014-15: no band or rank.')
    ).toBeTruthy()
    const rows = within(screen.getByRole('table', { name: 'Seasons' })).getAllByRole('row')
    expect(within(rows[2]).getByText('No league data')).toBeTruthy()
    expect(within(rows[1]).getByText('2nd of 4')).toBeTruthy()
  })

  it('asks for a search when nothing is followed', () => {
    render(
      <StatsTrends
        data={DATA}
        scope={SCOPE}
        state={DEFAULT_TRENDS}
        onState={() => {}}
        fallback={null}
        onOpenPlayer={() => {}}
        onOpenTeam={() => {}}
      />
    )
    expect(screen.getByText('Find a player to see their seasons.')).toBeTruthy()
  })
})
