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
 * Season forecast (Plan T1003): the season simulation run by Metis on its Elo, as of the last game
 * in scope: the rest of the regular season played many times, then the play-in and the bracket with
 * that season's rules (`docs/reference/stats-database.md`, "Season forecast"). The season in progress
 * runs 10,000 times on every refresh; past seasons keep twenty snapshots of 500 runs.
 */
const FORECAST_SOURCES = ['Computed by Metis: the season simulated from its Elo ratings']

const forecast: Partial<Opts> & Pick<Opts, 'sample'> = {
  ...fromScores,
  kind: 'model',
  model: 'team_forecast',
  sources: FORECAST_SOURCES,
  firstSeason: ELO_FIRST_SEASON
}

const odds = (
  id: string,
  label: string,
  short: string,
  description: string,
  value: string,
  o: Partial<Opts> = {}
): MetricDef =>
  metric(id, label, short, `${description} A model's odds, as of the last game in scope.`, {
    ...forecast,
    value,
    unit: 'pct',
    decimals: 1,
    ...o
  })

RATINGS.push(
  metric(
    'team_proj_w',
    'Projected wins',
    'PROJ W',
    'Regular-season wins, the games played and the rest simulated from Elo: the mean over the runs, as of the last game in scope.',
    { ...forecast, value: '{proj_w}', decimals: 1 }
  ),
  metric(
    'team_proj_l',
    'Projected losses',
    'PROJ L',
    'Regular-season losses, the games played and the rest simulated from Elo: the mean over the runs, as of the last game in scope.',
    { ...forecast, value: '{proj_l}', decimals: 1, direction: 'lower' }
  ),
  odds(
    'team_playoff_pct',
    'Playoff odds',
    'PLAYOFF%',
    'The share of runs in which the team reaches the playoffs’ sixteen, through the play-in or not.',
    '{p_playoffs}'
  ),
  odds(
    'team_top6_pct',
    'Top-six odds',
    'TOP 6%',
    'The share of runs in which the team finishes in its conference’s top six, clear of the play-in.',
    '{p_top6}',
    { firstSeason: 2021 }
  ),
  odds(
    'team_play_in_pct',
    'Play-in odds',
    'PLAY-IN%',
    'The share of runs in which the team plays in the play-in: seventh to tenth from 2020-21, 2019-20’s eighth and ninth when theirs was played.',
    '{p_play_in}',
    { firstSeason: 2020, direction: 'neutral' }
  ),
  odds(
    'team_round2_pct',
    'Second-round odds',
    'R2%',
    'The share of runs in which the team wins a first-round series.',
    '{p_round2}'
  ),
  odds(
    'team_conf_finals_pct',
    'Conference finals odds',
    'CF%',
    'The share of runs in which the team reaches its conference’s finals.',
    '{p_conf_finals}'
  ),
  odds(
    'team_finals_pct',
    'Finals odds',
    'FINALS%',
    'The share of runs in which the team reaches the Finals.',
    '{p_finals}'
  ),
  odds(
    'team_title_pct',
    'Title odds',
    'TITLE%',
    'The share of runs in which the team wins the title.',
    '{p_title}'
  ),
  metric(
    'team_mean_seed',
    'Mean seed',
    'SEED',
    'The team’s mean place in its conference over the runs, one to fifteen, before the play-in: as of the last game in scope.',
    { ...forecast, value: '{mean_seed}', decimals: 1, direction: 'lower' }
  ),
  metric(
    'team_forecast_runs',
    'Forecast runs',
    'RUNS',
    'How many times the season was simulated for the forecast read: 10,000 for the season in progress, 500 for a past season’s snapshots.',
    { ...forecast, value: '{runs}', unit: 'count', decimals: 0, direction: 'neutral' }
  )
)
