import { LEAGUES } from '../../leagues'
import type { MetricDef } from '../types'
import { BOX_COMPOSITES } from './boxComposites'
import { COMPOSITE } from './composite'
import { DASHBOARDS } from './dashboards'
import { FANTASY } from './fantasy'
import { TEAM_RECORDS } from './records'
import { TRACKING } from './tracking'
import { HUSTLE } from './hustle'
import { AVAILABILITY } from './availability'
import { IMPACT } from './impact'
import { DARKO_METRICS } from './darko'
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
import { COLLEGE, collegeCoverage } from './college'
import { COLLEGE_DEPTH } from './collegeDepth'

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
  ...DARKO_METRICS,
  ...AVAILABILITY,
  ...SHOTS,
  ...PLAYS,
  ...RATINGS,
  ...BOX_COMPOSITES,
  ...FANTASY,
  ...TEAM_RECORDS,
  ...COLLEGE,
  ...COLLEGE_DEPTH
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

// Each metric's coverage in the WNBA and the college leagues, stated from the rules in `wnba.ts` and
// `college.ts` where the metric states none. The two college leagues share one rule (D38).
for (const m of CATALOGUE) {
  const leagues = { ...m.leagues }
  if (leagues.wnba === undefined) leagues.wnba = wnbaCoverage(m, componentsOf(m))
  if (leagues.ncaam === undefined)
    leagues.ncaam = collegeCoverage(m, componentsOf(m), LEAGUES.ncaam)
  if (leagues.ncaaw === undefined)
    leagues.ncaaw = collegeCoverage(m, componentsOf(m), LEAGUES.ncaaw)
  m.leagues = leagues
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
  playTablesNotBuilt,
  EVERY_GAME_ONLY,
  tablesOf,
  MODEL_NO_SPLIT,
  ONE_SEASON_ONLY,
  STATE_ONE_SEASON,
  PUBLISHED_TYPES_ONLY,
  REGULAR_SEASON_ONLY,
  WHOLE_SEASONS_ONLY
} from '../coverage'
