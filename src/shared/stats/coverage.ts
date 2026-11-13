import { seasonLabel } from './seasons'
import type { MetricDef } from './types'

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
export function coverageReason(def: Coverage, seasons: readonly number[]): string | null {
  if (seasons.some((s) => covers(def, s))) return null
  if (seasons.some((s) => s < def.firstSeason)) {
    return `Recorded from ${seasonLabel(def.firstSeason)}.`
  }
  return `Not in the source for ${seasons.map(seasonLabel).join(', ')}.`
}
