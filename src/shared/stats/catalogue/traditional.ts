import type { MetricDef } from '../types'
import { allSides, count, metric, NBA_FIRST_SEASON, NBA_SOURCES, share, type Opts } from './define'

/** Reference section 3: traditional box scores and participation. */
const f = { family: 'traditional' } as const

/** A shooting percentage: its minimum applies to players, since teams always qualify. */
const pct = (a: string, b: string, minSample: number, tier: MetricDef['tier'] = 'extended'): Opts =>
  share(a, b, b, { ...f, minSample, tier })

export const TRADITIONAL: MetricDef[] = [
  metric('gp', 'Games played', 'G', 'Games the player appeared in. Being listed does not count.', {
    ...count('games', { ...f, totalOnly: true })
  }),
  metric(
    'gs',
    'Games started',
    'GS',
    "Games started. ESPN's flag is the only source before 2017-18, and it is missing for some games, mostly in 2001-02, 2004-05 and 2005-06.",
    count('starts', { ...f, totalOnly: true })
  ),
  metric(
    'min',
    'Minutes',
    'MIN',
    'Minutes played. Most lines in 2003-04 and 2004-05 are rounded to the minute.',
    {
      ...count('minutes', {
        ...f,
        sample: 'minutes',
        minSample: 1000,
        unit: 'minutes',
        tier: 'core'
      })
    }
  ),
  metric('w', 'Wins', 'W', 'Team wins in games the player appeared in.', {
    ...count('wins', { ...f, totalOnly: true })
  }),
  metric('l', 'Losses', 'L', 'Team losses in games the player appeared in.', {
    ...count('losses', { ...f, direction: 'lower', totalOnly: true })
  }),
  metric('win_pct', 'Win percentage', 'W%', 'Team wins per game the player appeared in.', {
    value: '{wins} / nullif({wins} + {losses}, 0)',
    sample: 'games',
    unit: 'pct',
    ...f
  }),

  metric('team_gp', 'Games played', 'G', 'Games played, with or without a box score.', {
    ...count('games', { ...f, entity: 'team', side: 'offense', totalOnly: true })
  }),
  metric('team_w', 'Wins', 'W', 'Games won.', {
    ...count('wins', { ...f, entity: 'team', side: 'offense', tier: 'core', totalOnly: true })
  }),
  metric('team_l', 'Losses', 'L', 'Games lost.', {
    ...count('losses', {
      ...f,
      entity: 'team',
      side: 'offense',
      direction: 'lower',
      tier: 'core',
      totalOnly: true
    })
  }),
  metric('team_win_pct', 'Win percentage', 'W%', 'Wins per game.', {
    value: '{wins} / nullif({wins} + {losses}, 0)',
    sample: 'games',
    unit: 'pct',
    entity: 'team',
    side: 'offense',
    tier: 'core',
    ...f
  }),
  metric('team_pts', 'Points', 'PTS', 'Points scored, from the final score.', {
    ...count('points_for', { ...f, entity: 'team', side: 'offense', tier: 'core' })
  }),
  metric('opp_pts', 'Points allowed', 'Opp PTS', 'Points allowed, from the final score.', {
    ...count('points_against', {
      ...f,
      entity: 'team',
      side: 'defense',
      direction: 'lower',
      tier: 'core'
    })
  }),
  metric(
    'team_point_diff',
    'Point differential',
    '+/-',
    'Points scored minus points allowed, from the final score. In one game it is the margin.',
    count('points_for', {
      ...f,
      value: '{points_for} - {points_against}',
      kind: 'derived',
      entity: 'team',
      side: 'offense',
      tier: 'core'
    })
  ),

  metric('pts', 'Points', 'PTS', 'Points scored.', count('pts', { ...f, tier: 'core' })),
  ...allSides(
    'fgm',
    'Field goals made',
    'FGM',
    'Made twos and threes, not free throws.',
    count('fgm', f)
  ),
  ...allSides(
    'fga',
    'Field-goal attempts',
    'FGA',
    'Two- and three-point attempts.',
    count('fga', f)
  ),
  ...allSides(
    'fg_pct',
    'Field-goal percentage',
    'FG%',
    'Field goals made per attempt.',
    pct('fgm', 'fga', 500, 'core')
  ),
  ...allSides('fg_miss', 'Missed field goals', 'FGMX', 'Field-goal attempts minus makes.', {
    ...count('fga', { ...f, value: '{fga} - {fgm}', kind: 'derived', direction: 'neutral' })
  }),
  ...allSides('fg2m', 'Twos made', '2PM', 'Field goals made minus threes made.', {
    ...count('fgm', { ...f, value: '{fgm} - {fg3m}', kind: 'derived' })
  }),
  ...allSides(
    'fg2a',
    'Two-point attempts',
    '2PA',
    'Field-goal attempts minus three-point attempts.',
    {
      ...count('fga', { ...f, value: '{fga} - {fg3a}', kind: 'derived', direction: 'neutral' })
    }
  ),
  ...allSides('fg2_pct', 'Two-point percentage', '2P%', 'Twos made per two-point attempt.', {
    value: '({fgm} - {fg3m}) / nullif({fga} - {fg3a}, 0)',
    sample: 'fga',
    unit: 'pct',
    minSample: 400,
    ...f
  }),
  ...allSides(
    'fg3m',
    'Threes made',
    '3PM',
    'Three-pointers made.',
    count('fg3m', { ...f, tier: 'core' })
  ),
  ...allSides('fg3a', 'Three-point attempts', '3PA', 'Three-point attempts.', count('fg3a', f)),
  ...allSides(
    'fg3_pct',
    'Three-point percentage',
    '3P%',
    'Threes made per attempt.',
    pct('fg3m', 'fg3a', 200, 'core')
  ),
  ...allSides('ftm', 'Free throws made', 'FTM', 'Free throws made.', count('ftm', f)),
  ...allSides('fta', 'Free-throw attempts', 'FTA', 'Free-throw attempts.', count('fta', f)),
  ...allSides(
    'ft_pct',
    'Free-throw percentage',
    'FT%',
    'Free throws made per attempt.',
    pct('ftm', 'fta', 125, 'core')
  ),
  ...allSides('ft_miss', 'Missed free throws', 'FTMX', 'Free-throw attempts minus makes.', {
    ...count('fta', { ...f, value: '{fta} - {ftm}', kind: 'derived', direction: 'lower' })
  }),
  ...allSides(
    'oreb',
    'Offensive rebounds',
    'OREB',
    'Rebounds of their own side’s misses.',
    count('oreb', f)
  ),
  ...allSides(
    'dreb',
    'Defensive rebounds',
    'DREB',
    'Rebounds of the other side’s misses.',
    count('dreb', f)
  ),
  ...allSides(
    'reb',
    'Rebounds',
    'REB',
    'Offensive and defensive rebounds. Team rebounds are not in this box score.',
    {
      ...count('reb', { ...f, tier: 'core' })
    }
  ),
  ...allSides('ast', 'Assists', 'AST', 'Passes credited as leading to a made field goal.', {
    ...count('ast', { ...f, tier: 'core' })
  }),
  ...allSides(
    'tov',
    'Turnovers',
    'TOV',
    'Turnovers charged to players. Team turnovers are not in this box score.',
    {
      ...count('tov', { ...f, direction: 'lower', tier: 'core' })
    }
  ),
  ...allSides('stl', 'Steals', 'STL', 'Steals.', count('stl', { ...f, tier: 'core' })),
  ...allSides('blk', 'Blocks', 'BLK', 'Blocked shots.', count('blk', { ...f, tier: 'core' })),
  ...allSides('pf', 'Personal fouls', 'PF', 'Personal fouls charged.', {
    ...count('pf', { ...f, direction: 'lower' })
  }),
  metric(
    'plus_minus',
    'Plus-minus',
    '+/-',
    "The team's points minus the opponent's while the player was on the floor. It does not isolate what the player caused.",
    count('plus_minus', { ...f, sources: NBA_SOURCES, firstSeason: NBA_FIRST_SEASON, tier: 'core' })
  ),
  metric(
    'dd2',
    'Double-doubles',
    'DD2',
    'Games with at least 10 in two or more of points, rebounds, assists, steals and blocks.',
    count('dd2', { ...f, kind: 'derived' })
  ),
  metric(
    'td3',
    'Triple-doubles',
    'TD3',
    'Games with at least 10 in three or more of points, rebounds, assists, steals and blocks.',
    count('td3', { ...f, kind: 'derived' })
  ),
  metric(
    'qd4',
    'Quadruple-doubles',
    'QD',
    'Games with at least 10 in four or more of points, rebounds, assists, steals and blocks.',
    count('qd4', { ...f, kind: 'derived' })
  ),
  metric(
    'five_by_five',
    'Five-by-fives',
    '5x5',
    'Games with at least 5 in each of points, rebounds, assists, steals and blocks.',
    count('five_by_five', { ...f, kind: 'derived' })
  )
]
