import type { MetricDef } from '../types'
import { allSides, metric } from './define'

/** Reference section 14.1: the composites anyone can compute from a box score. */
const f = { family: 'composite' } as const

const PIE = `({pts} + {fgm} + {ftm} - {fga} - {fta} + {dreb} + 0.5 * {oreb} + {ast} + {stl}
  + 0.5 * {blk} - {pf} - {tov})`

export const COMPOSITE: MetricDef[] = [
  ...allSides(
    'eff',
    'Efficiency (EFF)',
    'EFF',
    'Points, rebounds, assists, steals and blocks, minus missed shots, missed free throws and turnovers. It has no adjustment for pace or opponent, and it is not PER.',
    {
      value: '{pts} + {reb} + {ast} + {stl} + {blk} - ({fga} - {fgm}) - ({fta} - {ftm}) - {tov}',
      sample: 'games',
      aggregation: 'sum',
      decimals: 0,
      tier: 'core',
      ...f,
      categories: ['impact.composites'],
      opponents: ['defense.impact', 'impact.composites']
    }
  ),
  ...allSides(
    'gmsc',
    'Game Score',
    'GmSc',
    "John Hollinger's measure of one game's production. Summed over games here: per game gives the usual figure.",
    {
      value: `{pts} + 0.4 * {fgm} - 0.7 * {fga} - 0.4 * ({fta} - {ftm}) + 0.7 * {oreb} + 0.3 * {dreb}
        + {stl} + 0.7 * {ast} + 0.7 * {blk} - 0.4 * {pf} - {tov}`,
      sample: 'games',
      aggregation: 'sum',
      decimals: 1,
      tier: 'core',
      ...f,
      categories: ['impact.composites'],
      opponents: ['defense.impact', 'impact.composites']
    }
  ),
  metric(
    'pie',
    'Player Impact Estimate',
    'PIE',
    "The player's share of everything both teams did while they were on the floor, counted the way the NBA's PIE counts it. Each game's total is scaled by their share of its minutes, as the NBA's published figure is.",
    {
      value: `${PIE} / nullif({x_pie_den}, 0)`,
      sample: 'minutes',
      unit: 'pct',
      minSample: 1000,
      tier: 'core',
      ...f,
      categories: ['impact.composites']
    }
  ),
  metric(
    'team_pie',
    'Team Impact Estimate',
    'PIE',
    "The team's share of everything both teams did, counted the way the NBA's PIE counts it.",
    {
      value: `${PIE} / nullif({pie_total}, 0)`,
      sample: 'box_games',
      unit: 'pct',
      entity: 'team',
      side: 'offense',
      ...f,
      categories: ['impact.composites']
    }
  )
]
