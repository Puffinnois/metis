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

export { coverageReason, covers } from '../coverage'
