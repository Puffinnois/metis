import type { MetricDef } from '../types'
import { FIRST_SEASON, metric, type Opts } from './define'

/**
 * Reference section 13: team strength, computed by Metis (Plan T1001). The solved ratings read a
 * model table (`model`): the value after the last game in scope.
 */
const solved: Partial<Opts> = {
  family: 'ratings',
  entity: 'team',
  side: 'offense',
  kind: 'model',
  aggregation: 'ratio',
  sample: 'games',
  sources: ['Computed by Metis from the final scores'],
  firstSeason: FIRST_SEASON,
  model: 'team_strength'
}

export const RATINGS: MetricDef[] = [
  metric(
    'team_srs',
    'Simple Rating System',
    'SRS',
    'Points a game better than an average team on a neutral floor: the average margin plus the average rating of the opponents played. Solved on the regular season, as of the last game in scope.',
    { ...solved, value: '{srs}', sample: 'games', decimals: 2, tier: 'core' }
  )
]
