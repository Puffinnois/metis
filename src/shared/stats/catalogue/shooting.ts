import type { MetricDef } from '../types'
import { allSides, metric, ratio, share, teamSides } from './define'

/** Reference section 4: shooting efficiency and opportunity rates. */
const f = { family: 'shooting' } as const

/** Estimated from each game's share of the team's minutes, and summed. */
const ON_COURT_NOTE =
  "Estimated: what the team did while they played is guessed from their share of its minutes, game by game. It is not the NBA's published figure."

const TSA = '{fga} + 0.44 * {fta}'

export const SHOOTING: MetricDef[] = [
  ...allSides(
    'efg_pct',
    'Effective field-goal percentage',
    'eFG%',
    'Field-goal percentage with a made three worth one and a half makes. Free throws do not count.',
    {
      value: '({fgm} + 0.5 * {fg3m}) / nullif({fga}, 0)',
      sample: 'fga',
      unit: 'pct',
      minSample: 500,
      tier: 'core',
      ...f
    }
  ),
  ...allSides(
    'tsa',
    'True shooting attempts',
    'TSA',
    'Field-goal attempts plus 0.44 of free-throw attempts: an estimate of scoring chances, since free throws come in ones, twos and threes.',
    {
      value: TSA,
      sample: 'games',
      kind: 'estimated',
      aggregation: 'sum',
      decimals: 1,
      direction: 'neutral',
      ...f
    }
  ),
  ...allSides(
    'ts_pct',
    'True shooting percentage',
    'TS%',
    'Points per true shooting attempt, halved. Counts threes and free throws, and can pass 100 % in a small sample.',
    {
      value: `{pts} / nullif(2 * (${TSA}), 0)`,
      sample: 'fga',
      unit: 'pct',
      minSample: 500,
      tier: 'core',
      ...f
    }
  ),
  ...allSides(
    'pts_per_tsa',
    'Points per true shooting attempt',
    'PTS/TSA',
    'Points per true shooting attempt: twice true shooting as a fraction.',
    {
      value: `{pts} / nullif(${TSA}, 0)`,
      sample: 'fga',
      decimals: 3,
      minSample: 500,
      ...f
    }
  ),
  ...allSides(
    'fg_pts_per_fga',
    'Field-goal points per attempt',
    'FGP/FGA',
    'Points from field goals per attempt: twice effective field-goal percentage. Free throws do not count.',
    {
      value: '(2 * {fgm} + {fg3m}) / nullif({fga}, 0)',
      sample: 'fga',
      decimals: 3,
      minSample: 500,
      ...f
    }
  ),
  ...allSides(
    'pts_per_fga',
    'Points per field-goal attempt',
    'PTS/FGA',
    'All points per field-goal attempt: free-throw points count, free-throw attempts do not.',
    { value: ratio('pts', 'fga'), sample: 'fga', decimals: 3, minSample: 500, ...f }
  ),
  ...allSides(
    'fg3a_rate',
    'Three-point attempt rate',
    '3PAr',
    'Three-point attempts per field-goal attempt. Published by the NBA as PCT_FGA_3PT.',
    share('fg3a', 'fga', 'fga', { ...f, direction: 'neutral', minSample: 500, tier: 'core' })
  ),
  ...allSides(
    'fg2a_rate',
    'Two-point attempt rate',
    '2PAr',
    'Two-point attempts per field-goal attempt. Published by the NBA as PCT_FGA_2PT.',
    {
      value: '({fga} - {fg3a}) / nullif({fga}, 0)',
      sample: 'fga',
      unit: 'pct',
      direction: 'neutral',
      minSample: 500,
      ...f
    }
  ),
  ...allSides(
    'fta_rate',
    'Free-throw attempt rate',
    'FTr',
    'Free-throw attempts per field-goal attempt. One of the Four Factors, as the NBA counts them.',
    { value: ratio('fta', 'fga'), sample: 'fga', decimals: 3, minSample: 500, tier: 'core', ...f }
  ),
  ...allSides(
    'ftm_per_fga',
    'Free throws made per attempt',
    'FT/FGA',
    'Free throws made per field-goal attempt. Basketball-Reference’s Four Factor, which differs from the free-throw attempt rate.',
    { value: ratio('ftm', 'fga'), sample: 'fga', decimals: 3, minSample: 500, ...f }
  ),
  ...allSides(
    'ast_tov',
    'Assist-to-turnover ratio',
    'AST/TO',
    'Assists per turnover. Undefined with no turnovers.',
    { value: ratio('ast', 'tov'), sample: 'tov', decimals: 2, ...f, minSample: 100 }
  ),
  ...allSides(
    'ast_ratio',
    'Assist ratio',
    'AST Ratio',
    'Assists per 100 plays that end with the player or team: attempts, trips to the line, assists and turnovers.',
    {
      value: `{ast} / nullif(${TSA} + {ast} + {tov}, 0)`,
      sample: 'fga',
      unit: 'pct',
      minSample: 500,
      ...f
    }
  ),
  ...allSides(
    'tov_pct',
    'Turnover percentage',
    'TOV%',
    'Turnovers per 100 plays: attempts, trips to the line and turnovers. A team’s is one of the Four Factors, on this estimated denominator.',
    {
      value: `{tov} / nullif(${TSA} + {tov}, 0)`,
      sample: 'fga',
      unit: 'pct',
      direction: 'lower',
      minSample: 500,
      kind: 'estimated',
      tier: 'core',
      ...f
    }
  ),

  metric(
    'ast_pct',
    'Assist percentage',
    'AST%',
    `The share of teammates' field goals the player assisted while on the floor. ${ON_COURT_NOTE}`,
    share('ast', 'x_ast_den', 'minutes', { ...f, kind: 'estimated', minSample: 1000, tier: 'core' })
  ),
  metric(
    'orb_pct',
    'Offensive rebound percentage',
    'ORB%',
    `The share of available offensive rebounds the player took while on the floor. ${ON_COURT_NOTE}`,
    share('oreb', 'x_orb_den', 'minutes', { ...f, kind: 'estimated', minSample: 1000 })
  ),
  metric(
    'drb_pct',
    'Defensive rebound percentage',
    'DRB%',
    `The share of available defensive rebounds the player took while on the floor. ${ON_COURT_NOTE}`,
    share('dreb', 'x_drb_den', 'minutes', { ...f, kind: 'estimated', minSample: 1000 })
  ),
  metric(
    'trb_pct',
    'Total rebound percentage',
    'TRB%',
    `The share of available rebounds the player took while on the floor. ${ON_COURT_NOTE}`,
    share('reb', 'x_trb_den', 'minutes', { ...f, kind: 'estimated', minSample: 1000, tier: 'core' })
  ),
  metric(
    'stl_pct',
    'Steal percentage',
    'STL%',
    `Steals per 100 opponent possessions while on the floor. ${ON_COURT_NOTE}`,
    share('stl', 'x_stl_den', 'minutes', { ...f, kind: 'estimated', minSample: 1000 })
  ),
  metric(
    'blk_pct',
    'Block percentage',
    'BLK%',
    `Blocks per 100 opponent two-point attempts while on the floor. ${ON_COURT_NOTE}`,
    share('blk', 'x_blk_den', 'minutes', { ...f, kind: 'estimated', minSample: 1000 })
  ),
  metric(
    'usg_pct',
    'Usage percentage',
    'USG%',
    `The share of the team's plays the player finished while on the floor: attempts, trips to the line and turnovers. ${ON_COURT_NOTE}`,
    {
      value: '({fga} + 0.44 * {fta} + {tov}) / nullif({x_usg_den}, 0)',
      sample: 'minutes',
      unit: 'pct',
      kind: 'estimated',
      direction: 'neutral',
      minSample: 1000,
      tier: 'core',
      ...f
    }
  ),

  ...teamSides(
    'ast_share',
    'Assisted field goals',
    'AST%',
    'The share of field goals made that were assisted.',
    share('ast', 'fgm', 'fgm', f)
  ),
  metric(
    'team_orb_pct',
    'Offensive rebound percentage',
    'ORB%',
    'The share of available offensive rebounds the team took. One of the Four Factors.',
    {
      ...share('oreb', 'oreb', 'oreb', { ...f, entity: 'team', side: 'offense', tier: 'core' }),
      value: '{oreb} / nullif({oreb} + {opp_dreb}, 0)'
    }
  ),
  metric(
    'team_drb_pct',
    'Defensive rebound percentage',
    'DRB%',
    'The share of available defensive rebounds the team took.',
    {
      ...share('dreb', 'dreb', 'dreb', { ...f, entity: 'team', side: 'defense', tier: 'core' }),
      value: '{dreb} / nullif({dreb} + {opp_oreb}, 0)'
    }
  ),
  metric(
    'team_trb_pct',
    'Total rebound percentage',
    'TRB%',
    'The share of all rebounds the team took.',
    {
      ...share('reb', 'reb', 'reb', { ...f, entity: 'team', side: 'offense' }),
      value: '{reb} / nullif({reb} + {opp_reb}, 0)'
    }
  )
]
