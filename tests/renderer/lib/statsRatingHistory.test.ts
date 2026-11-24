import { describe, expect, it } from 'vitest'
import {
  emptyLine,
  fmtRating,
  importsNote,
  labelsPoints,
  marksPoints,
  monthTicks,
  nearestPoint,
  offeredParts,
  pointLines,
  ratingAxis,
  SEASON_GAP,
  seasonRuns,
  seriesName,
  seriesSeasons,
  showsPoints,
  shownSeries,
  stopNote,
  valueDomain
} from '@/lib/stats/ratingHistory'
import { DARKO, EXPECTED, LONG_CAREER, NONE_IN_LEAGUE } from './ratingHistoryFixture'

describe('a player’s ratings over time', () => {
  it('names each series with its maker', () => {
    expect(seriesName(EXPECTED)).toBe('Expected impact (SportsDataverse)')
    expect(seriesName(DARKO)).toBe('DPM (DARKO)')
  })

  it('keeps the season in scope, or every season for the career', () => {
    const season = shownSeries(LONG_CAREER, 'season', 2016, 'total')
    expect(season.map((s) => s.series.id)).toEqual(['sdv_current_impact'])
    expect(season[0].points.every((p) => p.season === 2016)).toBe(true)
    const career = shownSeries(LONG_CAREER, 'career', 2016, 'total')
    expect(career.map((s) => s.series.id)).toEqual(['sdv_current_impact', 'darko_dpm'])
    expect(seriesSeasons(LONG_CAREER)).toEqual(Array.from({ length: 21 }, (_, i) => 2007 + i))
  })

  it('drops a point with no value for the part, and offers only the parts some series has', () => {
    const split: typeof LONG_CAREER = {
      notes: [],
      series: [{ ...DARKO, points: DARKO.points.map((p) => ({ ...p, off: null, def: null })) }]
    }
    expect(offeredParts(split)).toEqual(['total'])
    expect(shownSeries(split, 'career', 2027, 'off')).toEqual([])
    expect(offeredParts(LONG_CAREER)).toEqual(['total', 'off', 'def'])
  })

  it('gives each season of a career an equal stretch with a gap for the summer', () => {
    const axis = ratingAxis(shownSeries(LONG_CAREER, 'career', 2016, 'total'))
    expect(axis.seasons).toHaveLength(21)
    const [a, b] = axis.seasons
    expect(b.start - a.end).toBeCloseTo(SEASON_GAP)
    expect(a.end - a.start).toBeCloseTo(b.end - b.start)
    expect(axis.seasons[20].end).toBeCloseTo(1)
    // Within a season, by date: opening night at the stretch's start, the last week at its end.
    expect(axis.x(a.from, a.season)).toBeCloseTo(a.start)
    expect(axis.x(a.to, a.season)).toBeCloseTo(a.end)
    // A season's dates never reach into the next one's stretch.
    const xs = EXPECTED.points.filter((p) => p.season === 2008).map((p) => axis.x(p.date, p.season))
    expect(Math.max(...xs)).toBeLessThan(axis.seasons[2].start)
  })

  it('spreads one season across the whole width', () => {
    const axis = ratingAxis(shownSeries(LONG_CAREER, 'season', 2027, 'total'))
    expect(axis.seasons.map((s) => [s.from, s.to])).toEqual([['2026-11-03', '2026-11-24']])
    expect(axis.x('2026-11-03', 2027)).toBeCloseTo(0)
    expect(axis.x('2026-11-24', 2027)).toBeCloseTo(1)
    expect(axis.x('2026-11-12', 2027)).toBeCloseTo(9 / 21)
  })

  it('labels a season’s months on its own axis', () => {
    const axis = ratingAxis(shownSeries(LONG_CAREER, 'season', 2016, 'total'))
    expect(monthTicks(axis.seasons[0]).map((m) => m.label)).toEqual([
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr'
    ])
    expect(monthTicks(undefined)).toEqual([])
  })

  it('puts a season of one date in the middle of its stretch', () => {
    const one = { notes: [], series: [{ ...DARKO, points: [DARKO.points[0]] }] }
    const axis = ratingAxis(shownSeries(one, 'career', 2027, 'total'))
    expect(axis.x('2026-11-03', 2027)).toBeCloseTo(0.5)
  })

  it('joins points within a season only, never across a summer', () => {
    const runs = seasonRuns(EXPECTED.points)
    expect(runs).toHaveLength(20)
    expect(runs.every((r) => r.length === 24 && r.every((p) => p.season === r[0].season))).toBe(
      true
    )
  })

  it('shows a snapshot series’ points, so three imports read as three points', () => {
    expect(showsPoints(DARKO)).toBe(true)
    expect(showsPoints(EXPECTED)).toBe(false)
  })

  it('says where a series stops before the latest season', () => {
    expect(stopNote(EXPECTED, 2027)).toBe('Published through 2025-26')
    expect(stopNote(DARKO, 2027)).toBeNull()
    expect(
      stopNote({ ...DARKO, points: DARKO.points.map((p) => ({ ...p, season: 2026 })) }, 2027)
    ).toBe('Imported through 2025-26')
    expect(stopNote(EXPECTED, null)).toBeNull()
  })

  it('writes a rating signed with one decimal, and the hover’s date, value and basis', () => {
    expect(fmtRating(2.04)).toBe('+2.0')
    expect(fmtRating(-1.26)).toBe('−1.3')
    expect(fmtRating(0.01)).toBe('0.0')
    expect(pointLines(DARKO, DARKO.points[1], 'off')).toEqual([
      'DPM (DARKO)',
      'Nov 12, 2026: +2.0 offence',
      'Imported board'
    ])
    expect(pointLines(EXPECTED, { ...EXPECTED.points[0], basis: null }, 'total')).toHaveLength(2)
  })

  it('finds the point nearest the pointer, and none in a summer’s gap', () => {
    const shown = shownSeries(LONG_CAREER, 'career', 2016, 'total')
    const axis = ratingAxis(shown)
    const s = axis.seasons[3]
    expect(nearestPoint(shown[0], axis, s.start)?.date).toBe(s.from)
    expect(nearestPoint(shown[1], axis, s.start)).toBeNull()
    const darko = axis.seasons[20]
    expect(nearestPoint(shown[1], axis, darko.end)?.date).toBe('2026-11-24')
  })

  it('says why there is no chart, in one line', () => {
    expect(emptyLine(NONE_IN_LEAGUE, 'career', 2027)).toBe(NONE_IN_LEAGUE.notes[0])
    expect(emptyLine(LONG_CAREER, 'season', 2005)).toBe(
      'No Expected impact (SportsDataverse), DPM (DARKO) value for 2004-05; the career shows every season there is.'
    )
    expect(emptyLine(null, 'career', 2027)).toBe('No ratings over time for this player.')
  })
})

describe('the chart’s honesty', () => {
  it('keeps zero, the average player, in view when the values come near it', () => {
    expect(valueDomain([1.2, 3.4]).zero).toBe(true)
    expect(valueDomain([1.2, 3.4]).lo).toBeLessThan(0)
    expect(valueDomain([-2, 1]).zero).toBe(true)
    const far = valueDomain([6, 8])
    expect(far.zero).toBe(false)
    expect(far.lo).toBeGreaterThan(5)
    expect(valueDomain([2]).zero).toBe(true)
    // Two imports three tenths apart: the axis spans at least two points, and zero comes in view.
    const two = valueDomain([2.1, 2.4])
    expect(two.hi - two.lo).toBeGreaterThanOrEqual(2)
    expect(two.zero).toBe(true)
  })

  it('marks every point in a season, a snapshot’s always, none of a weekly line across a career', () => {
    expect(marksPoints(EXPECTED, 'season')).toBe(true)
    expect(marksPoints(EXPECTED, 'career')).toBe(false)
    expect(marksPoints(DARKO, 'career')).toBe(true)
  })

  it('names one or two imports by their dates, and counts more', () => {
    const [a, b, c] = DARKO.points
    expect(importsNote(DARKO, [a])).toBe('imported Nov 3, 2026')
    expect(importsNote(DARKO, [a, b])).toBe('imported Nov 3 and Nov 12, 2026')
    expect(importsNote(DARKO, [{ ...a, date: '2025-12-30' }, b])).toBe(
      'imported Dec 30, 2025 and Nov 12, 2026'
    )
    expect(importsNote(DARKO, [a, b, c])).toBe('3 imports, Nov 3, 2026 to Nov 24, 2026')
    expect(importsNote(EXPECTED, EXPECTED.points)).toBeNull()
    expect(labelsPoints(DARKO, [a, b])).toBe(true)
    expect(labelsPoints(DARKO, [a, b, c])).toBe(false)
    expect(labelsPoints(EXPECTED, EXPECTED.points.slice(0, 1))).toBe(false)
  })
})
