import { describe, expect, it } from 'vitest'
import {
  categoriesOf,
  glossarySections,
  placementLabel,
  placementsWords,
  primaryCategory
} from '@/lib/stats/glossary'
import type { Placement } from '@shared/stats/categories'
import type { MetricInfo } from '@shared/stats/types'

const m = (id: string, categories: Placement[]): MetricInfo =>
  ({ id, label: id, categories }) as unknown as MetricInfo

const fg3 = m('fg3_pct', ['shooting.threes', 'offense.shooting'])
const dreb = m('dreb', ['rebounding.defensive', 'defense.rebounding'])
const stl = m('stl', ['defense.steals_blocks'])
const ts = m('ts_pct', ['shooting.efficiency', 'offense.shooting'])

describe('the Glossary by category (D52)', () => {
  it('names a placement by its category and sub-group', () => {
    expect(placementLabel('shooting.threes')).toBe('Shooting › Threes')
    expect(placementsWords(dreb)).toBe('Rebounding › Defensive, Defense › Rebounding')
    expect(primaryCategory(dreb)).toBe('rebounding')
  })

  it('offers the categories its metrics hold, in the registry order', () => {
    expect(categoriesOf([stl, fg3]).map((c) => c.id)).toEqual(['offense', 'defense', 'shooting'])
  })

  it('describes every metric once, under its primary category, when none is chosen', () => {
    const sections = glossarySections([fg3, dreb, stl, ts], '')
    expect(sections.map((s) => `${s.category.id}.${s.group.id}`)).toEqual([
      'defense.steals_blocks',
      'shooting.threes',
      'shooting.efficiency',
      'rebounding.defensive'
    ])
    expect(sections.every((s) => s.alsoHere.length === 0)).toBe(true)
  })

  it("describes a category's own metrics and links the ones described elsewhere", () => {
    const sections = glossarySections([fg3, dreb, stl, ts], 'defense')
    expect(sections.map((s) => s.group.id)).toEqual(['steals_blocks', 'rebounding'])
    expect(sections[0].described.map((x) => x.id)).toEqual(['stl'])
    expect(sections[1].described).toEqual([])
    expect(sections[1].alsoHere.map((x) => x.id)).toEqual(['dreb'])
  })

  it('keeps the order the metrics arrive in within a section', () => {
    const [threes, efficiency] = glossarySections([ts, fg3], 'shooting')
    expect(threes.group.id).toBe('threes')
    expect(efficiency.described.map((x) => x.id)).toEqual(['ts_pct'])
  })
})
