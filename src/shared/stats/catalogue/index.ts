import { seasonLabel } from '../seasons'
import type { MetricDef } from '../types'
import { COMPOSITE } from './composite'
import { POSSESSIONS } from './possessions'
import { SCORING } from './scoring'
import { SHOOTING } from './shooting'
import { TRADITIONAL } from './traditional'

/**
 * The metric catalogue: every metric the engine computes, its formula over component sums, and the
 * words a screen needs to read it. One file per family, so tasks adding metrics do not collide.
 */
export const CATALOGUE: MetricDef[] = [
  ...TRADITIONAL,
  ...SHOOTING,
  ...POSSESSIONS,
  ...SCORING,
  ...COMPOSITE
]

export const METRICS: ReadonlyMap<string, MetricDef> = new Map(CATALOGUE.map((m) => [m.id, m]))

/** A component in a formula: `{fga}`. */
export const TOKEN = /\{([a-z0-9_]+)\}/g

/** Every component a metric reads, its sample and per-game divisor included. */
export function componentsOf(def: Pick<MetricDef, 'value' | 'sample' | 'perGameBy'>): string[] {
  const names = [...def.value.matchAll(TOKEN)].map((m) => m[1])
  return [...new Set([...names, def.sample, ...(def.perGameBy ? [def.perGameBy] : [])])]
}

type Coverage = Pick<MetricDef, 'firstSeason' | 'missingSeasons'>

/** Whether the source has real values for this metric in this season. */
export const covers = (def: Coverage, season: number): boolean =>
  season >= def.firstSeason && !def.missingSeasons?.includes(season)

/** Why a metric has no value in these seasons, in a short sentence; null when it has one. */
export function coverageReason(def: Coverage, seasons: readonly number[]): string | null {
  if (seasons.some((s) => covers(def, s))) return null
  if (seasons.some((s) => s < def.firstSeason)) {
    return `Recorded from ${seasonLabel(def.firstSeason)}.`
  }
  return `Not in the source for ${seasons.map(seasonLabel).join(', ')}.`
}
