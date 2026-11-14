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

/**
 * Plan T1004: the adjusted ratings, a ridge regression of points per 100 possessions on offense,
 * defense and home court, solved on the regular season as of every game day (`models/adjusted.ts`).
 * Possessions are the box-score estimate the plain ratings divide by.
 */
const adjusted: Partial<Opts> & Pick<Opts, 'sample'> = {
  ...solved,
  model: 'adjusted_rating',
  sources: ['Computed by Metis from the box scores'],
  unit: 'rating',
  decimals: 1
}

const NOT_PUBLISHED = "A model computed by Metis, not the NBA's or any publisher's figure."

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
  ),
  metric(
    'team_adj_ortg',
    'Adjusted offensive rating',
    'ADJ ORtg',
    `Points scored per 100 estimated possessions against an average defense on a neutral floor: a regression on the regular season so far that adjusts for the defenses faced and home court. ${NOT_PUBLISHED}`,
    { ...adjusted, value: '{adj_ortg}' }
  ),
  metric(
    'team_adj_drtg',
    'Adjusted defensive rating',
    'ADJ DRtg',
    `Points allowed per 100 estimated possessions against an average offense on a neutral floor: a regression on the regular season so far that adjusts for the offenses faced and home court. ${NOT_PUBLISHED}`,
    // The offense side, as SRS is, so the team board's Ratings preset shows it beside the others.
    { ...adjusted, value: '{adj_drtg}', direction: 'lower' }
  ),
  metric(
    'team_adj_nrtg',
    'Adjusted net rating',
    'ADJ NRtg',
    `Adjusted offensive rating minus adjusted defensive rating: points per 100 possessions better than an average team on a neutral floor. ${NOT_PUBLISHED}`,
    { ...adjusted, value: '{adj_nrtg}', tier: 'core' }
  ),
  metric(
    'team_adj_home',
    'Home court, per 100 possessions',
    'HOME',
    `The net points per 100 possessions a team gains at home over a neutral floor, the league's estimate from the regression behind the adjusted ratings, as of the last game in scope. ${NOT_PUBLISHED}`,
    { ...adjusted, value: '{adj_home}', direction: 'neutral' }
  )
]

/**
 * Elo (Plan T1002): FiveThirtyEight's published NBA Elo, computed by Metis over every game between
 * teams of the league in date order, playoffs included, carried from season to season. Every team
 * starts at 1500 in 1993-94, so the first two seasons are a burn-in and the metrics read from 1995-96
 * (`docs/reference/nba-data-sources.md`, "Elo").
 */
export const ELO_FIRST_SEASON = 1996

const ELO_SOURCES = ["Computed by Metis from the final scores, by FiveThirtyEight's NBA Elo"]

const rated: Partial<Opts> & Pick<Opts, 'sample'> = {
  ...fromScores,
  kind: 'model',
  sources: ELO_SOURCES,
  firstSeason: ELO_FIRST_SEASON
}

RATINGS.push(
  metric(
    'team_elo',
    'Elo rating',
    'ELO',
    'A rating carried from game to game, 1500 an average team: 100 points better wins 64 % of the time on a neutral floor. FiveThirtyEight’s NBA Elo, playoffs included, as of the last game in scope.',
    { ...rated, model: 'elo_game', value: '{elo}', decimals: 0, tier: 'core' }
  ),
  metric(
    'team_elo_exp_w',
    'Expected wins by Elo',
    'ELO W',
    'The games Elo expected the team to win: its win probability before each game, added over the games in scope.',
    { ...rated, model: 'elo_wins', value: '{elo_exp_wins}', aggregation: 'sum', totalOnly: true }
  ),
  metric(
    'team_elo_w_over',
    'Wins over Elo',
    'W − ELO W',
    'Wins less the games Elo expected the team to win.',
    {
      ...rated,
      model: 'elo_wins',
      value: '{wins} - {elo_exp_wins}',
      aggregation: 'sum',
      totalOnly: true,
      decimals: 1,
      direction: 'neutral'
    }
  )
)

/**
 * The family's order, which the team board's Ratings preset reads: its core metrics first (the margin,
 * then the three ratings of a team's strength), then the first extended ones up to twelve columns. So
 * those that repeat a preset column (Pythagorean losses, wins over Elo), the games left and the
 * league's home court come last, and are offered in the column picker.
 */
const ORDER = [
  'team_mov',
  'team_srs',
  'team_elo',
  'team_adj_nrtg',
  'team_pyth_pct',
  'team_pyth_w',
  'team_win_resid',
  'team_sos',
  'team_sos_left',
  'team_adj_ortg',
  'team_adj_drtg',
  'team_elo_exp_w',
  'team_pyth_l',
  'team_games_left',
  'team_elo_w_over',
  'team_adj_home'
]
// A metric not listed keeps its place after those that are.
const place = (id: string): number => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length)
RATINGS.sort((a, b) => place(a.id) - place(b.id))
