import { describe, expect, it } from 'vitest'
import {
  CATEGORIES,
  isUmbrella,
  opponentsOf,
  placementParts,
  type Category
} from '@shared/stats/categories'
import { CATALOGUE, METRICS } from '@shared/stats/catalogue'

const cats = (id: string): readonly string[] | undefined => METRICS.get(id)?.categories

describe('the category registry (D52)', () => {
  it('has unique ids, and unique sub-group ids within a category, each with a sentence', () => {
    const all = CATEGORIES as readonly Category[]
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length)
    for (const c of all) {
      expect(c.definition).toMatch(/\.$/)
      expect(new Set(c.groups.map((g) => g.id)).size).toBe(c.groups.length)
      for (const g of c.groups) expect(g.definition, `${c.id}.${g.id}`).toMatch(/\.$/)
    }
  })

  it('moves an act to the other end for the opponents, the umbrella first', () => {
    expect(opponentsOf(['shooting.threes', 'offense.shooting'])).toEqual([
      'defense.shooting_allowed',
      'shooting.threes'
    ])
    expect(opponentsOf(['rebounding.defensive', 'defense.rebounding'])).toEqual([
      'offense.rebounding',
      'rebounding.defensive'
    ])
    expect(opponentsOf(['rebounding.all'])).toEqual(['rebounding.all'])
    // Steals and blocks have no one other end: the helper must state the opponents' categories.
    expect(() => opponentsOf(['defense.steals_blocks'])).toThrow(/state the opponents/)
  })
})

describe("the catalogue's categories", () => {
  it('places every metric but a stored one', () => {
    const unplaced = CATALOGUE.filter((m) => m.tier !== 'stored' && !m.categories?.length)
    expect(unplaced.map((m) => m.id)).toEqual([])
  })

  it('names sub-groups the registry has, one per category', () => {
    for (const m of CATALOGUE) {
      const placed = m.categories ?? []
      for (const p of placed) expect(placementParts(p), `${m.id}: ${p}`).not.toBeNull()
      const categories = placed.map((p) => p.split('.')[0])
      expect(new Set(categories).size, m.id).toBe(categories.length)
    }
  })

  it("leads an opponents' metric with the team's end, so it is described there", () => {
    for (const m of CATALOGUE.filter((x) => x.id.startsWith('opp_'))) {
      const placed = m.categories ?? []
      if (placed.some(isUmbrella)) expect(isUmbrella(placed[0]), m.id).toBe(true)
    }
    expect(cats('opp_tov')).toEqual(['defense.turnovers_forced', 'playmaking.turnovers'])
    expect(cats('opp_stl')).toEqual(['offense.turnovers', 'playmaking.turnovers'])
    expect(cats('opp_blk')?.[0]).toBe('offense.shooting')
    expect(cats('opp_dreb')?.[0]).toBe('offense.rebounding')
    expect(cats('opp_pf')?.[0]).toBe('offense.fouls_drawn')
  })

  it('places the reviewed hard cases as the document decides', () => {
    expect(cats('tov')).toEqual(['playmaking.turnovers', 'offense.turnovers'])
    expect(cats('plus_minus')).toEqual(['impact.on_court'])
    expect(cats('ts_pct_plus')).toEqual(cats('ts_pct'))
    expect(cats('tov_pct_plus')).toEqual(cats('tov_pct'))
    expect(cats('usg_pct')).toEqual(['offense.usage'])
    expect(cats('ncaa_rim_blocks')).toEqual(['defense.steals_blocks'])
    expect(cats('fta_rate')).toEqual(['shooting.free_throws', 'fouls.drawn', 'offense.fouls_drawn'])
    expect(cats('opp_fta_rate')?.[0]).toBe('defense.fouls')
    expect(cats('dist_miles')).toEqual(['hustle.movement'])
    expect(cats('team_pace')).toEqual(['results.pace'])
    expect(cats('team_ortg')).toEqual(['results.ratings', 'offense.ratings'])
    expect(cats('team_drtg')).toEqual(['results.ratings', 'defense.ratings'])
    expect(cats('dd2')).toEqual(['impact.all_around'])
    expect(cats('pt_iso_ppp')).toEqual(['play_types.iso', 'offense.play_types'])
    expect(cats('pt_d_iso_ppp')).toEqual(['play_types.d_iso', 'defense.play_types'])
    expect(cats('opp_shot_c3_fg_pct')).toEqual([
      'defense.shooting_allowed',
      'shooting.corner_threes'
    ])
    expect(cats('team_playoff_pct')).toEqual(['predictive.season_forecast', 'results.forecast'])
  })
})
