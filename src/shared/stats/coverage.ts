import { seasonLabel } from './seasons'
import type { MetricDef } from './types'

type Coverage = Pick<MetricDef, 'firstSeason' | 'missingSeasons'>

/** Why a metric published per season has no value under a filter that splits a season's games. */
export const WHOLE_SEASONS_ONLY = 'Published for whole seasons only.'
/** Why it has none for the play-in, the Cup final and the rest: the dataset publishes only these. */
export const PUBLISHED_TYPES_ONLY = 'Published for the regular season and playoffs only.'

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
