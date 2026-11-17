// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { DEFAULT_CHART, type ChartState } from '@/lib/stats/chart'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsData } from '@/lib/stats/useStats'
import { StatsChart } from '@/screens/stats/StatsChart'
import type { StatsQuery, StatsResult, StatsRow } from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

vi.mock('@/lib/api', () => ({ api: { stats: { query: vi.fn() } } }))
const query = vi.mocked(api.stats.query)

const catalogue = catalogueFixture()
const byId = new Map(catalogue.map((m) => [m.id, m]))

const DATA: StatsData = {
  status: null,
  catalogue,
  byId,
  seasons: [
    {
      season: 2026,
      firstDate: '2025-10-21',
      lastDate: '2026-04-12',
      types: [{ type: 'regular', games: 1230 }],
      teams: [
        {
          id: '1610612738',
          code: 'BOS',
          name: 'Boston Celtics',
          conference: 'east',
          division: 'atlantic'
        },
        {
          id: '1610612747',
          code: 'LAL',
          name: 'Los Angeles Lakers',
          conference: 'west',
          division: 'pacific'
        }
      ]
    }
  ],
  version: 'v1',
  error: null
}

const SEASON: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

/** Players 1–15 (all qualified), each metric rising with the id; drives only for whole seasons. */
function answer(q: StatsQuery): StatsResult {
  const split = q.scope.dates !== undefined || q.scope.lastN !== undefined
  const gap = (id: string): string | null =>
    split && byId.get(id)?.published ? 'Published for whole seasons only.' : null
  const ids = q.entity === 'player' ? 15 : 12
  const rows: StatsRow[] = Array.from({ length: ids }, (_, i) => ({
    id: q.entity === 'player' ? String(i + 1) : i === 0 ? '1610612738' : `t${i}`,
    name: q.entity === 'player' ? `Player ${i + 1}` : i === 0 ? 'Boston Celtics' : `Team ${i}`,
    team: q.entity === 'player' ? (i < 2 ? 'LAL' : 'BOS') : null,
    position: i % 2 ? 'G' : 'C',
    group: {},
    games: 60,
    values: Object.fromEntries(
      q.metrics.map((m) => [
        m,
        {
          value: gap(m) ? null : 0.1 + i * 0.01,
          raw: null,
          sample: 100,
          qualified: true,
          percentile: q.entity === 'team' ? (100 * i) / (ids - 1) : null,
          rank: null
        }
      ])
    )
  }))
  return {
    grain: split ? 'game' : 'season',
    columns: q.metrics.map((m) => ({
      id: m,
      label: byId.get(m)?.label ?? m,
      short: m,
      unit: byId.get(m)?.unit ?? 'number',
      decimals: 1,
      direction: byId.get(m)?.direction ?? 'higher',
      seasons: gap(m) ? [] : [2026],
      reason: gap(m)
    })),
    rows,
    total: rows.length,
    notes: [],
    ms: 3
  }
}

function Harness({
  scope = SEASON,
  initial = DEFAULT_CHART,
  onOpenPlayer = vi.fn(),
  onOpenTeam = vi.fn(),
  onCompare = vi.fn(),
  onScope = vi.fn()
}: {
  scope?: StatsScope
  initial?: ChartState
  onOpenPlayer?: (id: string) => void
  onOpenTeam?: (id: string) => void
  onCompare?: (s: { entity: string; id: string }[]) => void
  onScope?: (s: StatsScope) => void
}): React.JSX.Element {
  const [state, setState] = useState<ChartState>(initial)
  return (
    <StatsChart
      data={DATA}
      scope={scope}
      onScope={onScope}
      state={state}
      onState={setState}
      onOpenPlayer={onOpenPlayer}
      onOpenTeam={onOpenTeam}
      onCompare={onCompare}
    />
  )
}

const dots = (): Element[] => [...document.querySelectorAll('[data-dot]')]

afterEach(() => {
  cleanup()
  query.mockReset()
})

describe('the chart', () => {
  it('opens on the first preset, plots every qualified player, and opens a dot’s dashboard', async () => {
    query.mockImplementation(async (q) => answer(q))
    const onOpenPlayer = vi.fn()
    render(<Harness onOpenPlayer={onOpenPlayer} />)
    expect(
      screen.getByRole('heading', { name: 'True shooting percentage vs usage percentage' })
    ).toBeTruthy()
    await waitFor(() => expect(dots()).toHaveLength(15))
    expect(query.mock.calls[0][0]).toMatchObject({
      entity: 'player',
      metrics: ['usg_pct', 'ts_pct', 'min'],
      transform: 'perGame'
    })
    expect(screen.getByText(/2025-26 · Regular season · Whole season · per game/)).toBeTruthy()
    fireEvent.click(dots()[0].querySelector('circle')!)
    expect(onOpenPlayer).toHaveBeenCalledWith(dots()[0].getAttribute('data-dot'))
  })

  it('switches preset and axes, and sizes and colours the dots', async () => {
    query.mockImplementation(async (q) => answer(q))
    render(<Harness />)
    await waitFor(() => expect(dots()).toHaveLength(15))
    fireEvent.click(screen.getByRole('button', { name: 'Threes: volume vs accuracy' }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Three-point percentage vs three-point attempts' })
      ).toBeTruthy()
    )
    fireEvent.change(screen.getByTitle('Y axis'), { target: { value: 'drives' } })
    fireEvent.change(screen.getByTitle('X axis'), { target: { value: 'pts' } })
    fireEvent.change(screen.getByTitle('Size by'), { target: { value: 'ast' } })
    fireEvent.change(screen.getByTitle('Colour by'), { target: { value: '@position' } })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Drives vs points' })).toBeTruthy()
    )
    await waitFor(() =>
      expect(query.mock.lastCall?.[0].metrics).toEqual(['pts', 'drives', 'ast', 'min'])
    )
    await waitFor(() => expect(dots()).toHaveLength(15))
    const fills = new Set(
      dots().map((d) => d.querySelector('circle:last-child')!.getAttribute('fill'))
    )
    expect(fills).toEqual(new Set(['var(--s1)', 'var(--s3)']))
    const radii = new Set(
      dots().map((d) => d.querySelector('circle:last-child')!.getAttribute('r'))
    )
    expect(radii.size).toBeGreaterThan(5)
    expect(screen.getByText('Guard')).toBeTruthy()
    expect(
      within(screen.getByRole('table', { name: 'Chart table' })).getByText('Assists')
    ).toBeTruthy()
  })

  it('shows a season-grain metric’s reason under a date range, and offers the whole season', async () => {
    query.mockImplementation(async (q) => answer(q))
    const onScope = vi.fn()
    const dates: StatsScope = {
      ...SEASON,
      range: { kind: 'dates', from: '2025-11-01', to: '2025-12-01' }
    }
    render(
      <Harness
        scope={dates}
        onScope={onScope}
        initial={{ ...DEFAULT_CHART, x: 'pts', y: 'drives' }}
      />
    )
    const status = await screen.findByRole('status')
    expect(within(status).getByText('Drives: Published for whole seasons only.')).toBeTruthy()
    expect(dots()).toHaveLength(0)
    fireEvent.click(within(status).getByRole('button', { name: 'Use the whole season' }))
    expect(onScope).toHaveBeenCalledWith({ ...dates, range: { kind: 'season' } })
  })

  it('says too few qualify, how many and why, and can show the rest', async () => {
    query.mockImplementation(async (q) => {
      const r = answer(q)
      // Only four players have enough minutes.
      r.rows = r.rows.map((row, i) => ({
        ...row,
        values: { ...row.values, min: { ...row.values.min, qualified: i < 4 } }
      }))
      return r
    })
    render(<Harness />)
    const status = await screen.findByRole('status')
    expect(within(status).getByText('Too few qualifiers to chart')).toBeTruthy()
    expect(
      within(status).getByText(
        /^4 players qualify on both axes in the 2025-26 regular season\. A scatter needs at least 10: a player qualifies with enough minutes/
      )
    ).toBeTruthy()
    fireEvent.click(within(status).getByRole('button', { name: 'Show all 15 players' }))
    await waitFor(() => expect(dots()).toHaveLength(15))
    expect(screen.getAllByText('NQ').length).toBeGreaterThan(0)
  })

  it('picks up to three points with shift-click and sends them to Compare', async () => {
    query.mockImplementation(async (q) => answer(q))
    const onCompare = vi.fn()
    render(<Harness onCompare={onCompare} />)
    await waitFor(() => expect(dots()).toHaveLength(15))
    for (const id of ['3', '7', '9', '11']) {
      const d = document.querySelector(`[data-dot="${id}"] circle`)!
      fireEvent.click(d, { shiftKey: true })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Compare these →' }))
    expect(onCompare).toHaveBeenCalledWith([
      { entity: 'player', id: '3' },
      { entity: 'player', id: '7' },
      { entity: 'player', id: '9' }
    ])
  })

  it('charts teams, coloured by conference, and opens a team', async () => {
    query.mockImplementation(async (q) => answer(q))
    const onOpenTeam = vi.fn()
    render(<Harness onOpenTeam={onOpenTeam} />)
    await waitFor(() => expect(dots()).toHaveLength(15))
    fireEvent.click(screen.getByRole('radio', { name: 'Teams' }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Defensive rating vs offensive rating' })
      ).toBeTruthy()
    )
    await waitFor(() => expect(dots()).toHaveLength(12))
    expect(query.mock.lastCall?.[0]).toMatchObject({
      entity: 'team',
      metrics: ['team_ortg', 'team_drtg']
    })
    fireEvent.change(screen.getByTitle('Colour by'), { target: { value: '@conference' } })
    await waitFor(() =>
      expect(
        document.querySelector('[data-dot="1610612738"] circle:last-child')!.getAttribute('fill')
      ).toBe('var(--s1)')
    )
    expect(
      within(screen.getByRole('table', { name: 'Chart table' })).getByText('BOS · Boston Celtics')
    ).toBeTruthy()
    fireEvent.click(
      within(screen.getByRole('table', { name: 'Chart table' })).getByText('BOS · Boston Celtics')
    )
    expect(onOpenTeam).toHaveBeenCalledWith('1610612738')
  })

  it('says when a query fails', async () => {
    query.mockRejectedValue(new Error('The engine stopped.'))
    render(<Harness />)
    expect(await screen.findByText(/The engine stopped/)).toBeTruthy()
  })
})
