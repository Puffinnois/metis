import type { MetricDef } from '../types'
import { COMPOSITE } from './composite'
import { DASHBOARDS } from './dashboards'
import { TRACKING } from './tracking'
import { HUSTLE } from './hustle'
import { AVAILABILITY } from './availability'
import { IMPACT } from './impact'
import { MATCHUPS } from './matchups'
import { ON_COURT } from './onCourt'
import { PLAY_TYPES } from './playTypes'
import { PLAYS } from './plays'
import { POSSESSIONS } from './possessions'
import { RATINGS } from './ratings'
import { SCORING } from './scoring'
import { SHOOTING } from './shooting'
import { SHOTS } from './shots'
import { TRADITIONAL } from './traditional'

/**
 * The metric catalogue: every metric the engine computes, its formula over component sums, and the
 * words a screen needs to read it. One file per family, so tasks adding metrics do not collide.
 */
export const CATALOGUE: MetricDef[] = [
  ...TRADITIONAL,
  ...SHOOTING,
  ...POSSESSIONS,
  ...ON_COURT,
  ...SCORING,
  ...COMPOSITE,
  ...DASHBOARDS,
  ...TRACKING,
  ...HUSTLE,
  ...PLAY_TYPES,
  ...MATCHUPS,
  ...IMPACT,
  ...AVAILABILITY,
  ...SHOTS,
  ...PLAYS,
  ...RATINGS
]

export const METRICS: ReadonlyMap<string, MetricDef> = new Map(CATALOGUE.map((m) => [m.id, m]))

/** A component in a formula: `{fga}`. */
export const TOKEN = /\{([a-z0-9_]+)\}/g

/** Every component a metric reads, its sample and per-game divisor included. */
export function componentsOf(def: Pick<MetricDef, 'value' | 'sample' | 'perGameBy'>): string[] {
  const names = [...def.value.matchAll(TOKEN)].map((m) => m[1])
  return [...new Set([...names, def.sample, ...(def.perGameBy ? [def.perGameBy] : [])])]
}

export {
  COMPUTED_WHOLE_SEASONS,
  coverageReason,
  covers,
  MODEL_NO_SPLIT,
  ONE_SEASON_ONLY,
  STATE_ONE_SEASON,
  PUBLISHED_TYPES_ONLY,
  REGULAR_SEASON_ONLY,
  WHOLE_SEASONS_ONLY
} from '../coverage'
