import { CATALOGUE, componentsOf } from '@shared/stats/catalogue'
import { sampleLabel } from '@shared/stats/samples'
import type { Entity, Grain, MetricDef, MetricInfo } from '@shared/stats/types'
import { PLAYER_SUMS, TEAM_SUMS } from '../derived/game'

/** The columns each entity's game and season tables can sum. */
export const COMPONENTS: Record<Entity, ReadonlySet<string>> = {
  player: new Set(PLAYER_SUMS),
  team: new Set(TEAM_SUMS)
}

/**
 * Where a metric can be read. Everything so far comes from box scores, so it has both grains; a metric
 * published per season (Plan T701) will have only one.
 */
export function grainsOf(def: MetricDef): Grain[] {
  return componentsOf(def).every((c) => COMPONENTS[def.entity].has(c)) ? ['game', 'season'] : []
}

/** The catalogue as the renderer reads it: no formulas, and the grains each metric has. */
export function catalogueInfo(): MetricInfo[] {
  return CATALOGUE.map((def) => {
    const info: Partial<MetricDef> = { ...def }
    delete info.value
    delete info.sample
    return {
      ...(info as Omit<MetricDef, 'value' | 'sample'>),
      grains: grainsOf(def),
      sampleLabel: sampleLabel(def.sample)
    }
  })
}
