import type { MetricDef } from '../types'
import { BOX_COMPOSITES } from './boxComposites'
import { COMPOSITE } from './composite'
import { DASHBOARDS } from './dashboards'
import { TRACKING } from './tracking'
import { HUSTLE } from './hustle'
import { AVAILABILITY } from './availability'
import { IMPACT } from './impact'
import { leagueIndexes } from './indexes'
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
import { wnbaCoverage } from './wnba'

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
  ...RATINGS,
  ...BOX_COMPOSITES
]
// The league indexes read the rates above, so they are added once those are all there.
CATALOGUE.push(...leagueIndexes(CATALOGUE))

/** A component in a formula: `{fga}`. */
export const TOKEN = /\{([a-z0-9_]+)\}/g

/** Every component a metric reads, its sample, qualifying count and per-game divisor included. */
export function componentsOf(
  def: Pick<MetricDef, 'value' | 'sample' | 'perGameBy' | 'qualifyBy'>
): string[] {
  const names = [...def.value.matchAll(TOKEN)].map((m) => m[1])
  return [
    ...new Set([
      ...names,
      def.sample,
      ...(def.qualifyBy ? [def.qualifyBy] : []),
      ...(def.perGameBy ? [def.perGameBy] : [])
    ])
  ]
}

// Each metric's coverage in the WNBA, stated from the rules in `wnba.ts` where the metric states none.
for (const m of CATALOGUE) {
  if (m.leagues?.wnba === undefined)
    m.leagues = { ...m.leagues, wnba: wnbaCoverage(m, componentsOf(m)) }
}

export const METRICS: ReadonlyMap<string, MetricDef> = new Map(CATALOGUE.map((m) => [m.id, m]))

export {
  CATALOGUE_GAME_MINUTES,
  COMPUTED_WHOLE_SEASONS,
  coverageIn,
  coverageReason,
  covers,
  metricIn,
  notBuiltYet,
  notInLeague,
  tablesOf,
  MODEL_NO_SPLIT,
  ONE_SEASON_ONLY,
  STATE_ONE_SEASON,
  PUBLISHED_TYPES_ONLY,
  REGULAR_SEASON_ONLY,
  WHOLE_SEASONS_ONLY
} from '../coverage'
