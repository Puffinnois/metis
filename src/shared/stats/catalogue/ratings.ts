import type { MetricDef } from '../types'
import { FIRST_SEASON, metric, type Opts } from './define'

/**
 * Reference section 13: team strength, computed by Metis (Plan T1001). The point margin and the
 * Pythagorean record are formulas over the final scores of the games in scope, so any scope reads them
 * exactly. SRS and the schedule strengths are solved on the regular season and read from a model table
 * (`model`): the value after the last game in scope.
 */
const SCORES = ['Computed by Metis from the final scores']

const fromScores: Partial<Opts> & Pick<Opts, 'sample'> = {
  family: 'ratings',
  entity: 'team',
  side: 'offense',
  kind: 'derived',
  aggregation: 'ratio',
  sample: 'games',
  sources: SCORES,
  firstSeason: FIRST_SEASON
}

const solved: Partial<Opts> & Pick<Opts, 'sample'> = {
  ...fromScores,
  kind: 'model',
  model: 'team_strength'
}

/** Basketball-Reference's exponent for the NBA, on points for and against. */
export const PYTHAGOREAN_EXPONENT = 14

const pyth = `pow({points_for}, ${PYTHAGOREAN_EXPONENT}) / nullif(pow({points_for}, ${PYTHAGOREAN_EXPONENT}) + pow({points_against}, ${PYTHAGOREAN_EXPONENT}), 0)`
const decided = '({wins} + {losses})'

export const RATINGS: MetricDef[] = [
  metric(
    'team_mov',
    'Margin of victory',
    'MOV',
    'Points scored less points allowed, per game, from the final scores.',
    {
      ...fromScores,
      value: '({points_for} - {points_against}) / nullif({games}, 0)',
      decimals: 2,
      tier: 'core'
    }
  ),
  metric(
    'team_pyth_pct',
    'Pythagorean winning percentage',
    'PYTH%',
    'The winning percentage the points scored and allowed point to: points for to the 14th, over points for and against each to the 14th (the exponent Basketball-Reference uses).',
    { ...fromScores, kind: 'estimated', value: pyth, unit: 'pct', decimals: 1 }
  ),
  metric(
    'team_pyth_w',
    'Pythagorean wins',
    'PYTH W',
    'The games won the Pythagorean winning percentage gives over the games played.',
    { ...fromScores, kind: 'estimated', value: `${decided} * ${pyth}`, decimals: 1 }
  ),
  metric(
    'team_pyth_l',
    'Pythagorean losses',
    'PYTH L',
    'The games lost the Pythagorean winning percentage gives over the games played.',
    {
      ...fromScores,
      kind: 'estimated',
      value: `${decided} * (1 - ${pyth})`,
      decimals: 1,
      direction: 'lower'
    }
  ),
  metric(
    'team_win_resid',
    'Wins over Pythagorean',
    'W − PYTH',
    'Wins less Pythagorean wins: a residual of the record against the scoring margin, often read as close-game luck but not shown to be luck.',
    {
      ...fromScores,
      value: `{wins} - ${decided} * ${pyth}`,
      decimals: 1,
      direction: 'neutral'
    }
  ),
  metric(
    'team_srs',
    'Simple Rating System',
    'SRS',
    'Points a game better than an average team on a neutral floor: the margin of victory plus the strength of schedule. Solved on the regular season, as of the last game in scope.',
    { ...solved, value: '{srs}', decimals: 2, tier: 'core' }
  ),
  metric(
    'team_sos',
    'Strength of schedule',
    'SOS',
    'The average SRS of the opponents played, one term per game, so SRS is the margin of victory plus it. Regular season, as of the last game in scope.',
    { ...solved, value: '{sos}', decimals: 2, direction: 'neutral' }
  ),
  metric(
    'team_sos_left',
    'Strength of schedule left',
    'SOS LEFT',
    'The average SRS, as of the last game in scope, of the opponents in the regular-season games after it, one term per game. Blank once none are left.',
    { ...solved, value: '{sos_left}', decimals: 2, direction: 'neutral' }
  ),
  metric(
    'team_games_left',
    'Games left',
    'LEFT',
    'Regular-season games on the schedule after the last game in scope.',
    { ...solved, value: '{games_left}', unit: 'count', decimals: 0, direction: 'neutral' }
  )
]
