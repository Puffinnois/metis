import { CATALOGUE, componentsOf } from '@shared/stats/catalogue'
import { sampleLabel } from '@shared/stats/samples'
import type { Entity, Grain, MetricDef, MetricInfo } from '@shared/stats/types'
import { PLAYER_SUMS, TEAM_SUMS } from '../derived/game'
import { gameTable } from '../derived/gameTables'
import { publishedComponents, publishedTable } from '../derived/published'

/** The columns each entity's game and season tables can sum. */
export const COMPONENTS: Record<Entity, ReadonlySet<string>> = {
  player: new Set(PLAYER_SUMS),
  team: new Set(TEAM_SUMS)
}

/**
 * Where a metric can be read. One from box scores has both grains; one the dataset publishes per
 * season has only the season, unless a game table holds it too. None when a component is not in its table.
 */
export function grainsOf(def: MetricDef): Grain[] {
  const parts = componentsOf(def)
  if (def.built) {
    // A built table holds the counts; the box scores the rest (games, minutes, box_games).
    const table = gameTable(def.built)
    const ok =
      table?.entity === def.entity &&
      parts.every((c) => table.components.includes(c) || COMPONENTS[def.entity].has(c))
    return ok ? ['game', 'season'] : []
  }
  if (def.published) {
    const table = publishedTable(def.published)
    const held = table ? publishedComponents(table) : []
    if (table?.entity !== def.entity || !parts.every((c) => held.includes(c))) return []
    // A game table, where one holds every part, answers what splits a season.
    const games = gameTable(def.publishedGames)
    return games?.entity === def.entity && parts.every((c) => games.components.includes(c))
      ? ['game', 'season']
      : ['season']
  }
  return parts.every((c) => COMPONENTS[def.entity].has(c)) ? ['game', 'season'] : []
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
