import { describe, expect, it } from 'vitest'
import { COMBINE_BY_ID, COMBINE_MEASURES, COMBINE_SECTIONS, eventYear } from '@shared/stats/profile'

describe('the combine’s measures', () => {
  it('have one id each, and every section has some', () => {
    expect(COMBINE_BY_ID.size).toBe(COMBINE_MEASURES.length)
    for (const s of COMBINE_SECTIONS) {
      expect(COMBINE_MEASURES.some((m) => m.section === s)).toBe(true)
    }
  })

  it('build ratios and sums only from measures that exist', () => {
    for (const m of COMBINE_MEASURES) {
      const s = m.source
      const parts = 'ratio' in s ? s.ratio : 'sum' in s ? s.sum : []
      for (const p of parts) expect(COMBINE_BY_ID.has(p)).toBe(true)
    }
  })

  it('name the published shooting columns, a total first and then each spot', () => {
    const ids = COMBINE_MEASURES.filter((m) => m.unit === 'shots').map((m) => m.id)
    expect(ids.slice(0, 6)).toEqual([
      'fifteen',
      'fifteen_corner_left',
      'fifteen_break_left',
      'fifteen_top_key',
      'fifteen_break_right',
      'fifteen_corner_right'
    ])
    expect(ids).toContain('nba_corner_right')
    expect(ids).toContain('off_drib_college_top_key')
    expect(ids).not.toContain('off_drib_fifteen_corner_left')
    expect(ids.slice(-2)).toEqual(['on_move_fifteen', 'on_move_college'])
    // 3 distances of 5 spots and a total, 2 off the dribble of 3 and a total, 2 on the move.
    expect(ids).toHaveLength(18 + 8 + 2)
  })

  it('give the times as lower is better and measurements no better side', () => {
    expect(COMBINE_BY_ID.get('lane_agility_time')?.better).toBe('lower')
    expect(COMBINE_BY_ID.get('three_quarter_sprint')?.better).toBe('lower')
    expect(COMBINE_BY_ID.get('max_vertical_leap')?.better).toBe('higher')
    expect(COMBINE_BY_ID.get('wingspan')?.better).toBeNull()
  })

  it('read a file’s label as the year after the event', () => {
    expect(eventYear(2026)).toBe(2025)
  })
})
