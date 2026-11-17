import { seasonLabel, type League } from '../leagues'
import type { MetricCoverage, MetricDef } from './types'

type Coverage = Pick<MetricDef, 'firstSeason' | 'missingSeasons'>

/** Why a metric published per season has no value under a filter that splits a season's games. */
export const WHOLE_SEASONS_ONLY = 'Published for whole seasons only.'
/** Why it has none for the play-in, the Cup final and the rest: the dataset publishes only these. */
export const PUBLISHED_TYPES_ONLY = 'Published for the regular season and playoffs only.'
/** Why a metric that is one season's state, such as a projection, has none over several seasons. */
export const ONE_SEASON_ONLY = 'Published for one season at a time.'
/** Why it has none in the playoffs: its playoff rows repeat the regular season's. */
export const REGULAR_SEASON_ONLY = 'Published for the regular season only.'
/** Why a model computed per season has no value under a filter that splits a season's games. */
export const COMPUTED_WHOLE_SEASONS = 'Computed for whole seasons only.'
/** Why a rating as of a game has none over several seasons at once: it is one season's state. */
export const STATE_ONE_SEASON = 'A rating as of a game, read one season at a time.'
/** Why a model has no value under a split of each game. */
export const MODEL_NO_SPLIT = 'Computed per game, not per moment, so it has no split.'

/** Whether the source has real values for this metric in this season. */
export const covers = (def: Coverage, season: number): boolean =>
  season >= def.firstSeason && !def.missingSeasons?.includes(season)

/** Why a metric has no value in these seasons, in a short sentence; null when it has one. */
export function coverageReason(
  def: Coverage,
  seasons: readonly number[],
  league: League
): string | null {
  if (seasons.some((s) => covers(def, s))) return null
  if (seasons.some((s) => s < def.firstSeason)) {
    return `Recorded from ${seasonLabel(league, def.firstSeason)}.`
  }
  return `Not in the source for ${seasons.map((s) => seasonLabel(league, s)).join(', ')}.`
}

/** Why a metric has no value at all in a league that does not have it. */
export const notInLeague = (league: League): string => `Not recorded for the ${league.name}.`

/**
 * A metric's coverage in a league: what its `leagues` states for it, else its own fields where the
 * league takes them (`metricsByDefault`); null when the league does not have it.
 */
export function coverageIn(def: MetricDef, league: League): MetricCoverage | null {
  const stated = def.leagues?.[league.id]
  if (stated !== undefined) return stated
  if (!league.metricsByDefault) return null
  return {
    firstSeason: def.firstSeason,
    ...(def.missingSeasons ? { missingSeasons: def.missingSeasons } : {}),
    ...(def.unavailable ? { unavailable: def.unavailable } : {})
  }
}

const resolved = new Map<string, WeakMap<MetricDef, MetricDef>>()

/**
 * The metric as one league reads it: its coverage fields are that league's, and a league without it
 * reads it as unavailable with the reason. A league taking the metric's own fields gets the same
 * object back, so the NBA's catalogue is exactly as it was.
 */
export function metricIn(def: MetricDef, league: League): MetricDef {
  if (def.leagues?.[league.id] === undefined && league.metricsByDefault) return def
  let cache = resolved.get(league.id)
  if (!cache) resolved.set(league.id, (cache = new WeakMap()))
  const hit = cache.get(def)
  if (hit) return hit
  const coverage = coverageIn(def, league)
  const out: MetricDef = { ...def, missingSeasons: undefined, unavailable: undefined }
  delete out.missingSeasons
  delete out.unavailable
  if (coverage === null) {
    out.unavailable = notInLeague(league)
  } else {
    out.firstSeason = coverage.firstSeason
    if (coverage.missingSeasons) out.missingSeasons = coverage.missingSeasons
    if (coverage.unavailable) out.unavailable = coverage.unavailable
  }
  cache.set(def, out)
  return out
}
