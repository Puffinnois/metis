import { seasonLabel } from './seasons'
import type { MetricDef } from './types'

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
