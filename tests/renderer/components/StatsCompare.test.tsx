// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api'
import { DEFAULT_COMPARE, type CompareState } from '@/lib/stats/compare'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsData } from '@/lib/stats/useStats'
import { StatsCompare } from '@/screens/stats/StatsCompare'
import type {
  MetricValue,
  StatsQuery,
  StatsResult,
  StatsRow,
  StatsSeason
} from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

vi.mock('@/lib/api', () => ({
  api: {
    stats: {
      query: vi.fn(),
      player: vi.fn()
    }
  }
}))

const catalogue = catalogueFixture()
const byId = new Map(catalogue.map((m) => [m.id, m]))

const team = (id: string, code: string, name: string): StatsSeason['teams'][number] => ({
  id,
  code,
  name,
  conference: null,
  division: null
})

const SEASONS: StatsSeason[] = [2026, 2025, 2024, 2023].map((season) => ({
  season,
  firstDate: `${season - 1}-10-21`,
  lastDate: `${season}-04-12`,
  types: [{ type: 'regular', games: 1230 }],
  teams: [
    team('1610612738', 'BOS', 'Boston Celtics'),
    team('1610612747', 'LAL', 'Los Angeles Lakers')
  ]
}))

const DATA: StatsData = {
  status: null,
  catalogue,
  byId,
  seasons: SEASONS,
  version: 'v1',
  error: null
}

const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

const v = (value: number | null, over: Partial<MetricValue> = {}): MetricValue => ({
  value,
  raw: value,
  sample: 100,
  qualified: true,
  percentile: null,
  rank: null,
  ...over
})

const PLAYERS: [string, string, string, number, number, number][] = [
  ['p1', 'Shai Gilgeous-Alexander', 'OKC', 32.1, 2.4, 2200],
  ['p2', 'Luka Dončić', 'LAL', 30.0, 3.9, 2100],
  ['p3', 'Nikola Jokić', 'DEN', 28.5, 3.0, 2300],
  ['p4', 'Bench Player', 'BOS', 4.0, 0.5, 200]
]

/** Answers any query with the four players (or two teams), each metric a plain value. */
function answer(q: StatsQuery): StatsResult {
  const rows: StatsRow[] =
    q.entity === 'team'
      ? [
          {
            id: '1610612738',
            name: 'Boston Celtics',
            team: 'BOS',
            position: null,
            group: {},
            games: 82,
            values: {}
          },
          {
            id: '1610612747',
            name: 'Los Angeles Lakers',
            team: 'LAL',
            position: null,
            group: {},
            games: 82,
            values: {}
          }
        ]
      : PLAYERS.map(([id, name, code, pts, tov, min]) => ({
          id,
          name,
          team: code,
          position: 'G',
          group: {},
          games: 70,
          values: {
            min: v(min, { qualified: min >= 1000 }),
            pts: v(pts),
            tov: v(tov)
          }
        }))
  const filtered = q.scope.players ? rows.filter((r) => q.scope.players!.includes(r.id)) : rows
  return {
    grain: 'season',
    columns: q.metrics.map((id) => {
      const info = byId.get(id)!
      return {
        id,
        label: info.label,
        short: info.short,
        unit: info.unit,
        decimals: info.decimals,
        direction: info.direction,
        seasons: [2026],
        reason: info.firstSeason > Math.max(...q.scope.seasons) ? 'Recorded from 2013-14.' : null
      }
    }),
    rows: filtered.map((r) => ({
      ...r,
      values: Object.fromEntries(q.metrics.map((m) => [m, r.values[m] ?? v(10)]))
    })),
    total: filtered.length,
    notes: [],
    ms: 4
  }
}

function Harness({
  initial,
  onOpenPlayer = () => {},
  onOpenTeam = () => {},
  scope = SCOPE
}: {
  initial: CompareState
  onOpenPlayer?: (id: string) => void
  onOpenTeam?: (id: string) => void
  scope?: StatsScope
}): React.JSX.Element {
  const [state, setState] = useState(initial)
  return (
    <StatsCompare
      data={DATA}
      scope={scope}
      state={state}
      onState={setState}
      onOpenPlayer={onOpenPlayer}
      onOpenTeam={onOpenTeam}
    />
  )
}

const slot = (k: number): HTMLElement => document.querySelector(`[data-slot="${k}"]`) as HTMLElement
const cells = (metric: string): HTMLElement[] =>
  [...document.querySelectorAll(`[data-metric="${metric}"] [data-cell]`)] as HTMLElement[]

beforeEach(() => {
  vi.mocked(api.stats.query).mockImplementation(async (q: StatsQuery) => answer(q))
  vi.mocked(api.stats.player).mockImplementation(async (id: string) => ({
    id,
    name: id,
    position: 'G',
    team: null,
    seasons: [2023, 2024, 2025, 2026],
    number: null,
    height: null,
    weight: null,
    birthDate: null,
    school: null
  }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StatsCompare', () => {
  it('opens on the three leaders who qualify, with one league query', async () => {
    render(<Harness initial={DEFAULT_COMPARE} />)
    await waitFor(() => expect(within(slot(2)).getByText('Nikola Jokić')).toBeTruthy())
    expect(within(slot(0)).getByText('Shai Gilgeous-Alexander')).toBeTruthy()
    expect(within(slot(1)).getByText('Luka Dončić')).toBeTruthy()
    const q = vi.mocked(api.stats.query).mock.calls[0][0]
    expect(q.scope.players).toBeUndefined()
    expect(q.transform).toBe('perGame')
  })

  it('bolds the best value the metric’s way', async () => {
    render(<Harness initial={{ ...DEFAULT_COMPARE, slots: ['p1', 'p2', 'p3'], autofill: false }} />)
    await waitFor(() => expect(cells('pts')).toHaveLength(3))
    const lead = (c: HTMLElement): boolean => c.querySelector('[data-lead]') !== null
    expect(cells('pts').map(lead)).toEqual([true, false, false])
    // Fewer turnovers lead.
    expect(cells('tov').map(lead)).toEqual([true, false, false])
    expect(cells('pts')[0].textContent).toContain('32.1')
  })

  it('removes a slot and fills it again from the search', async () => {
    render(<Harness initial={{ ...DEFAULT_COMPARE, slots: ['p1', 'p2', 'p3'], autofill: false }} />)
    await waitFor(() => expect(within(slot(1)).getByText('Luka Dončić')).toBeTruthy())
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Remove Luka Dončić' }))
    expect(within(slot(1)).getByText('Add a second player')).toBeTruthy()
    const input = within(slot(1)).getByRole('textbox', { name: 'Add the second player' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'bench' } })
    fireEvent.mouseDown(within(slot(1)).getByRole('button', { name: /Bench Player/ }))
    await waitFor(() => expect(within(slot(1)).getByText('Bench Player')).toBeTruthy())
    expect(within(slot(1)).getByText('NQ')).toBeTruthy()
  })

  it('clears the slots when switching to teams', async () => {
    render(<Harness initial={{ ...DEFAULT_COMPARE, slots: ['p1', 'p2', 'p3'], autofill: false }} />)
    await waitFor(() => expect(within(slot(0)).getByText('Shai Gilgeous-Alexander')).toBeTruthy())
    fireEvent.click(screen.getByRole('radio', { name: 'Teams' }))
    expect(within(slot(0)).getByText('Add a first team')).toBeTruthy()
    expect(screen.getByText('Add a team to compare.')).toBeTruthy()
    const input = within(slot(0)).getByRole('textbox', { name: 'Add the first team' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'BOS' } })
    fireEvent.mouseDown(within(slot(0)).getByRole('button', { name: /Boston Celtics/ }))
    await waitFor(() => expect(within(slot(0)).getByText('Boston Celtics')).toBeTruthy())
  })

  it("opens a slot's dashboard from its name", async () => {
    const onOpenPlayer = vi.fn()
    render(
      <Harness
        initial={{ ...DEFAULT_COMPARE, slots: ['p1', null, null], autofill: false }}
        onOpenPlayer={onOpenPlayer}
      />
    )
    await waitFor(() => expect(within(slot(0)).getByText('Shai Gilgeous-Alexander')).toBeTruthy())
    fireEvent.click(within(slot(0)).getByRole('button', { name: 'Shai Gilgeous-Alexander' }))
    expect(onOpenPlayer).toHaveBeenCalledWith('p1')
  })

  it('reads several seasons for the slots alone, without ranks', async () => {
    render(
      <Harness
        initial={{ ...DEFAULT_COMPARE, slots: ['p1', 'p2', null], autofill: false, span: 3 }}
      />
    )
    await waitFor(() => expect(cells('pts')).toHaveLength(2))
    const q = vi.mocked(api.stats.query).mock.calls.at(-1)![0]
    expect(q.scope.seasons).toEqual([2026, 2025, 2024])
    expect(q.scope.players).toEqual(['p1', 'p2'])
    expect(screen.getByText(/2023-24 to 2025-26 · Regular season · Whole seasons/)).toBeTruthy()
    expect(screen.getByText(/Ranks are for one season at a time/)).toBeTruthy()
  })

  it('says why a metric has no value in scope, never a zero', async () => {
    render(
      <Harness
        initial={{
          ...DEFAULT_COMPARE,
          slots: ['p1', 'p2', null],
          autofill: false,
          columns: { player: ['min', 'dist_miles'], team: null }
        }}
        scope={{ ...SCOPE, season: 2010 }}
      />
    )
    await waitFor(() => expect(cells('dist_miles')).toHaveLength(2))
    expect(cells('dist_miles').map((c) => c.textContent?.startsWith('—'))).toEqual([true, true])
    expect(cells('dist_miles')[0].getAttribute('title')).toBe('Recorded from 2013-14.')
  })
})
