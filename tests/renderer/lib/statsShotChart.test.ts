import { describe, expect, it } from 'vitest'
import {
  ARC_Y,
  chartGap,
  chartSummary,
  courtLines,
  onChart,
  relText,
  shadeFill,
  shadeLevel,
  shotRequest,
  toView,
  VIEW,
  zonePaths,
  zoneShades
} from '@/lib/stats/shotChart'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsShotChart } from '@shared/stats/types'

const chart = (o: Partial<StatsShotChart> = {}): StatsShotChart => ({
  shots: [],
  total: 0,
  made: 0,
  capped: false,
  zones: [],
  reason: null,
  ...o
})

describe('the court, to scale', () => {
  it('is the half court, 50 by 47 feet, with the basket 4.75 feet in from the baseline', () => {
    expect(VIEW).toEqual({ width: 500, height: 470 })
    expect(toView(0, 0)).toEqual({ cx: 250, cy: 47.5 })
    expect(toView(-250, -47.5)).toEqual({ cx: 0, cy: 0 })
    expect(toView(250, 422.5)).toEqual({ cx: 500, cy: 470 })
  })

  it('meets the corner lines with the arc where 22 and 23¾ feet agree', () => {
    expect(ARC_Y).toBeCloseTo(89.48, 2)
    expect(Math.hypot(220, ARC_Y)).toBeCloseTo(237.5, 6)
  })

  it('draws the lines and a shape for each zone on the court', () => {
    expect(courtLines().length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(zonePaths()).sort()).toEqual(['atb3', 'c3l', 'c3r', 'mid', 'paint', 'ra'])
    for (const d of Object.values(zonePaths())) expect(d).toMatch(/^M [\d.]+ [\d.]+/)
  })

  it('draws what is on this half, and counts the rest without drawing it', () => {
    expect(onChart({ x: 0, y: 0 })).toBe(true)
    expect(onChart({ x: 0, y: 422.5 })).toBe(true)
    expect(onChart({ x: 0, y: 600 })).toBe(false)
    expect(onChart({ x: -16398, y: 0 })).toBe(false)
  })
})

describe('the zones against the league', () => {
  it('steps the heat by points of FG%: level within 2, then 5 and 9', () => {
    expect(shadeLevel(null)).toBeNull()
    expect(shadeLevel(0.019)).toBe(0)
    expect(shadeLevel(0.02)).toBe(1)
    expect(shadeLevel(-0.05)).toBe(-2)
    expect(shadeLevel(0.12)).toBe(3)
    expect(shadeFill(2)).toBe('var(--h2)')
    expect(shadeFill(-3)).toBe('var(--l3)')
    expect(shadeFill(0)).toBe('var(--panel-2)')
  })

  it('compares each zone with what the league’s rate gives the same attempts, from 5 attempts', () => {
    const shades = zoneShades(
      chart({
        total: 30,
        made: 15,
        zones: [
          { zone: 'ra', fga: 20, fgm: 14, expected: 12 },
          { zone: 'mid', fga: 4, fgm: 4, expected: 1.6 },
          { zone: 'atb3', fga: 6, fgm: 1, expected: null }
        ]
      })
    )
    const by = Object.fromEntries(shades.map((z) => [z.zone, z]))
    expect(by.ra).toMatchObject({ pct: 0.7, rel: 0.1, level: 3 })
    // Too few to shade, and no league rate yet: plain, the figures still shown.
    expect(by.mid).toMatchObject({ pct: 1, rel: null, level: null })
    expect(by.atb3.rel).toBeNull()
    expect(by.paint).toMatchObject({ fga: 0, pct: null })
    expect(relText(0.1)).toBe('+10.0')
    expect(relText(-0.034)).toBe('−3.4')
  })
})

describe('what the chart says', () => {
  it('counts the attempts and what is not drawn', () => {
    const c = chart({
      total: 25_000,
      made: 11_000,
      capped: true,
      shots: [{ x: 0, y: 600, made: false, value: 3, zone: 'back' }]
    })
    expect(chartSummary(c)).toBe(
      '25,000 attempts · 11,000 made (44.0%) · the newest 20,000 drawn · 1 from beyond half court not drawn'
    )
  })

  it('gives the reason, no shots, or too few, instead of a chart', () => {
    expect(chartGap(chart({ reason: 'Recorded from 1996-97.' }))).toBe('Recorded from 1996-97.')
    expect(chartGap(chart())).toBe('No shots in these games.')
    expect(chartGap(chart({ total: 12 }))).toBe(
      'Too few shots to chart: 12 in these games, 20 needed.'
    )
    expect(chartGap(chart({ total: 20 }))).toBeNull()
  })

  it('asks for the dashboard’s season, types and range', () => {
    const scope: StatsScope = {
      season: 2026,
      seasonType: 'playoffs',
      range: { kind: 'dates', from: '2026-04-20', to: '2026-05-01' }
    }
    expect(shotRequest('player', '201939', scope)).toEqual({
      entity: 'player',
      id: '201939',
      seasons: [2026],
      scope: { gameTypes: ['playoffs'], dates: ['2026-04-20', '2026-05-01'] }
    })
    const last: StatsScope = {
      season: 2026,
      seasonType: 'regular',
      range: { kind: 'last', n: 10, of: 'team' }
    }
    expect(shotRequest('team', '1610612738', last, 'defense')).toEqual({
      entity: 'team',
      id: '1610612738',
      seasons: [2026],
      scope: { gameTypes: ['regular'], lastN: 10 },
      side: 'defense'
    })
  })
})
