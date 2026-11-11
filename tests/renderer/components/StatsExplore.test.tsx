// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { DEFAULT_CHART } from '@/lib/stats/chart'
import { DEFAULT_COMPARE } from '@/lib/stats/compare'
import type { ExploreSubject, ExploreTab } from '@/lib/stats/explore'
import type { StatsScope } from '@/lib/stats/scope'
import { DEFAULT_TRENDS } from '@/lib/stats/trends'
import type { StatsData } from '@/lib/stats/useStats'
import { StatsExplore } from '@/screens/stats/StatsExplore'

// Compare asks the engine for its rows; here it never answers, so the screen stays on its slots.
vi.mock('@/lib/api', () => ({
  api: { stats: { query: vi.fn(() => new Promise(() => {})), player: vi.fn() } }
}))

const DATA: StatsData = {
  status: null,
  catalogue: [],
  byId: new Map(),
  seasons: [
    {
      season: 2026,
      firstDate: '2025-10-21',
      lastDate: '2026-04-12',
      types: [{ type: 'regular', games: 1230 }],
      teams: []
    }
  ],
  version: 'v1',
  error: null
}

const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }

function Harness({ fallback }: { fallback: ExploreSubject | null }): React.JSX.Element {
  const [tab, setTab] = useState<ExploreTab>('chart')
  return (
    <StatsExplore
      data={DATA}
      scope={SCOPE}
      onScope={vi.fn()}
      tab={tab}
      onTab={setTab}
      chart={DEFAULT_CHART}
      onChart={vi.fn()}
      compare={DEFAULT_COMPARE}
      onCompare={vi.fn()}
      trends={DEFAULT_TRENDS}
      onTrends={vi.fn()}
      trendsFallback={fallback}
      openCompare={vi.fn()}
      onOpenPlayer={vi.fn()}
      onOpenTeam={vi.fn()}
    />
  )
}

afterEach(cleanup)

describe('Explore', () => {
  it('opens on Chart with the scope bar, and moves between the tabs', () => {
    render(<Harness fallback={null} />)
    expect(screen.getByRole('tablist', { name: 'Explore' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Chart' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTitle('Season')).toBeTruthy()
    expect(screen.getByText('Chart arrives with T801.')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('heading', { name: 'Compare' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }))
    expect(screen.getByRole('tab', { name: 'Trends' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('heading', { name: 'Compare' })).toBeNull()
  })

  it('hands Trends the last dashboard shown when nobody is picked', () => {
    render(<Harness fallback={{ entity: 'team', id: '13' }} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }))
    expect(screen.getByText('Trends arrives with T803.').getAttribute('data-subject')).toBe(
      'team:13'
    )
  })
})
