import { describe, expect, it } from 'vitest'
import { DEFAULT_COMPARE, compareWith } from '@/lib/stats/compare'
import { DEFAULT_EXPLORE_TAB, EXPLORE_TABS, exploreTab, lastSubject } from '@/lib/stats/explore'
import { DEFAULT_TRENDS, trendsFor } from '@/lib/stats/trends'

describe('Explore tabs', () => {
  it('are Chart, Compare and Trends, opening on Chart', () => {
    expect(EXPLORE_TABS.map((t) => t.label)).toEqual(['Chart', 'Compare', 'Trends'])
    expect(DEFAULT_EXPLORE_TAB).toBe('chart')
  })

  it('are found by label or id, and anything else is the default', () => {
    expect(exploreTab('Compare')).toBe('compare')
    expect(exploreTab('trends')).toBe('trends')
    expect(exploreTab('Scatter')).toBe('chart')
  })
})

describe('the last dashboard shown', () => {
  it('is the player or team on a dashboard', () => {
    expect(lastSubject(null, 'player', '1966', null)).toEqual({ entity: 'player', id: '1966' })
    expect(lastSubject(null, 'team', null, '13')).toEqual({ entity: 'team', id: '13' })
  })

  it('is kept on screens without one, and while a dashboard waits for its default', () => {
    const was = { entity: 'player' as const, id: '1966' }
    expect(lastSubject(was, 'players', null, null)).toBe(was)
    expect(lastSubject(was, 'explore', '1966', '13')).toBe(was)
    expect(lastSubject(was, 'team', null, null)).toBe(was)
  })

  it('keeps the same object when nothing changed, so the app does not render again', () => {
    const was = { entity: 'team' as const, id: '13' }
    expect(lastSubject(was, 'team', null, '13')).toBe(was)
    expect(lastSubject(was, 'player', '1966', null)).toEqual({ entity: 'player', id: '1966' })
  })
})

describe('opening Compare and Trends from another screen', () => {
  it('puts the subjects in Compare, and an empty list keeps what was there', () => {
    const teams = [
      { entity: 'team' as const, id: '13' },
      { entity: 'team' as const, id: '2' }
    ]
    expect(compareWith(DEFAULT_COMPARE, teams)).toMatchObject({
      entity: 'team',
      slots: ['13', '2', null]
    })
    expect(compareWith(DEFAULT_COMPARE, [])).toBe(DEFAULT_COMPARE)
  })

  it('opens Trends on a subject, keeping the metric when none is given', () => {
    const subject = { entity: 'player' as const, id: '1966' }
    const withMetric = trendsFor(DEFAULT_TRENDS, subject, 'pts')
    expect(withMetric).toMatchObject({ subject, metric: 'pts' })
    const team = { entity: 'team' as const, id: '13' }
    expect(trendsFor(withMetric, team)).toMatchObject({ subject: team, metric: 'pts' })
  })
})
