import type { MetricDef } from '../types'
import { metric, teamSides } from './define'

/**
 * Reference section 5, the estimates. All from the box score: a parser's actual possessions come with
 * the play level, and the NBA's published ratings with the league dashboards.
 */
const team = { family: 'possessions', entity: 'team', kind: 'estimated' } as const

const ESTIMATE =
  'An estimate from the box score, so a game has one possession count for both teams. It is not a count of actual possessions.'

/** Elapsed minutes of a team's games: its players' minutes over the five on the floor. */
const ELAPSED = '{minutes} / 5.0'

export const POSSESSIONS: MetricDef[] = [
  ...teamSides(
    'poss',
    'Possessions, simple estimate',
    'Poss',
    'Field-goal attempts plus 0.44 of free-throw attempts, minus offensive rebounds, plus turnovers.',
    {
      value: '{poss}',
      sample: 'games',
      family: 'possessions',
      kind: 'estimated',
      aggregation: 'sum',
      direction: 'neutral',
      categories: ['results.pace']
    }
  ),
  metric(
    'team_poss_sym',
    "Possessions, both teams' mean",
    'Poss (sym)',
    `The mean of both teams' simple estimates: what the ratings and pace here divide by. ${ESTIMATE}`,
    {
      ...team,
      value: '{poss_sym}',
      sample: 'box_games',
      aggregation: 'sum',
      perGameBy: 'box_games',
      direction: 'neutral',
      side: 'offense',
      categories: ['results.pace']
    }
  ),
  metric(
    'team_poss_bref',
    'Possessions, rebound-adjusted',
    'Poss (adj)',
    `Basketball-Reference's form, which adjusts for the share of offensive rebounds and weights free throws at 0.4. ${ESTIMATE}`,
    {
      ...team,
      value: '{poss_bref}',
      sample: 'box_games',
      aggregation: 'sum',
      perGameBy: 'box_games',
      direction: 'neutral',
      side: 'offense',
      categories: ['results.pace']
    }
  ),
  metric(
    'team_ortg',
    'Offensive rating',
    'ORtg',
    `Points scored per 100 estimated possessions. ${ESTIMATE}`,
    {
      ...team,
      value: '100 * {pts} / nullif({poss_sym}, 0)',
      sample: 'poss_sym',
      unit: 'rating',
      side: 'offense',
      tier: 'core',
      categories: ['results.ratings', 'offense.ratings']
    }
  ),
  metric(
    'team_drtg',
    'Defensive rating',
    'DRtg',
    `Points allowed per 100 estimated possessions. ${ESTIMATE}`,
    {
      ...team,
      value: '100 * {opp_pts} / nullif({poss_sym}, 0)',
      sample: 'poss_sym',
      unit: 'rating',
      direction: 'lower',
      side: 'defense',
      tier: 'core',
      categories: ['results.ratings', 'defense.ratings']
    }
  ),
  metric(
    'team_nrtg',
    'Net rating',
    'NRtg',
    `Offensive rating minus defensive rating. ${ESTIMATE}`,
    {
      ...team,
      value: '100 * ({pts} - {opp_pts}) / nullif({poss_sym}, 0)',
      sample: 'poss_sym',
      unit: 'rating',
      side: 'offense',
      tier: 'core',
      categories: ['results.ratings']
    }
  ),
  metric(
    'team_pace',
    'Pace',
    'Pace',
    `Estimated possessions per 48 minutes, overtime included. ${ESTIMATE}`,
    {
      ...team,
      value: `48 * {poss_sym} / nullif(${ELAPSED}, 0)`,
      gameLength: true,
      sample: 'poss_sym',
      unit: 'pace',
      direction: 'neutral',
      side: 'offense',
      tier: 'core',
      categories: ['results.pace']
    }
  ),
  metric(
    'team_pace40',
    'Pace per 40',
    'Pace40',
    'Pace scaled to 40 minutes, as a college game runs.',
    {
      ...team,
      value: `40 * {poss_sym} / nullif(${ELAPSED}, 0)`,
      sample: 'poss_sym',
      unit: 'pace',
      direction: 'neutral',
      side: 'offense',
      categories: ['results.pace']
    }
  ),
  ...teamSides(
    'ppp',
    'Points per possession',
    'PPP',
    `Points per estimated possession: offensive rating over 100. ${ESTIMATE}`,
    {
      value: '{pts} / nullif({poss_sym}, 0)',
      sample: 'poss_sym',
      family: 'possessions',
      kind: 'estimated',
      decimals: 3,
      categories: ['results.ratings', 'offense.ratings']
    }
  ),
  metric(
    'player_on_poss',
    'Possessions played',
    'Poss',
    `The team's possessions while the player was on the floor, guessed from their share of its minutes. What their per-100 numbers divide by. ${ESTIMATE}`,
    {
      family: 'possessions',
      kind: 'estimated',
      value: '{on_poss}',
      sample: 'games',
      aggregation: 'sum',
      direction: 'neutral',
      categories: ['playing_time.possessions']
    }
  )
]
