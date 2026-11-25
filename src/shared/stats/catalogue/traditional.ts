import type { MetricDef } from '../types'
import {
  allSides,
  count,
  metric,
  NBA_FIRST_SEASON,
  NBA_MINIMUMS,
  NBA_SOURCES,
  share,
  type Opts
} from './define'

/** Reference section 3: traditional box scores and participation. */
const f = { family: 'traditional' } as const

/** A shooting percentage: its minimum applies to players, since teams always qualify. */
const pct = (a: string, b: string, minSample: number, tier: MetricDef['tier'] = 'extended'): Opts =>
  share(a, b, b, { ...f, minSample, tier })

/**
 * One of the NBA's per-game leaders: qualified on 58 games of 82 alone, as the league does (D33). A
 * league whose games rule is a share asks that share of the team's games instead (D43, `GamesRule`).
 */
const nbaPerGame = { minSample: NBA_MINIMUMS.games, qualifyBy: 'games' } as const

/** One of the NBA's shooting leaders: qualified on makes alone, as the league does (D33). */
const nbaPct = (made: 'fgm' | 'fg3m' | 'ftm', attempts: string): Opts => ({
  ...pct(made, attempts, NBA_MINIMUMS[made], 'core'),
  qualifyBy: made
})

export const TRADITIONAL: MetricDef[] = [
  metric('gp', 'Games played', 'G', 'Games the player appeared in. Being listed does not count.', {
    ...count('games', { ...f, totalOnly: true }),
    categories: ['playing_time.games_minutes']
  }),
  metric(
    'gs',
    'Games started',
    'GS',
    "Games started. ESPN's flag is the only source before 2017-18, and it is missing for some games, mostly in 2001-02, 2004-05 and 2005-06.",
    { ...count('starts', { ...f, totalOnly: true }), categories: ['playing_time.games_minutes'] }
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
        // The leaderboards' row qualifier for every metric the NBA's rule does not cover (D33).
        minSample: 1000,
        unit: 'minutes',
        perGameOnly: true,
        tier: 'core'
      }),
      categories: ['playing_time.games_minutes']
    }
  ),
  metric(
    'min_share',
    'Share of team minutes',
    'MIN%',
    "The player's minutes over the team's in the games they played, where the five on the floor make 100 %. A game the team played without them does not count against it: the games share says that.",
    {
      value: '{seconds} / nullif({tm_seconds} / 5.0, 0)',
      sample: 'games',
      unit: 'pct',
      direction: 'neutral',
      ...f,
      categories: ['playing_time.games_minutes']
    }
  ),
  metric(
    'gp_share',
    'Share of team games',
    'GP%',
    'Games the player appeared in over the games their team played in scope. A player who changed teams in a season takes the team with more games.',
    {
      value: '{games} / nullif({team_games}, 0)',
      sample: 'games',
      unit: 'pct',
      direction: 'neutral',
      ...f,
      categories: ['playing_time.games_minutes']
    }
  ),
  metric('w', 'Wins', 'W', 'Team wins in games the player appeared in.', {
    ...count('wins', { ...f, totalOnly: true }),
    categories: ['results.record']
  }),
  metric('l', 'Losses', 'L', 'Team losses in games the player appeared in.', {
    ...count('losses', { ...f, direction: 'lower', totalOnly: true }),
    categories: ['results.record']
  }),
  metric('win_pct', 'Win percentage', 'W%', 'Team wins per game the player appeared in.', {
    value: '{wins} / nullif({wins} + {losses}, 0)',
    sample: 'games',
    unit: 'pct',
    ...f,
    categories: ['results.record']
  }),

  metric('team_gp', 'Games played', 'G', 'Games played, with or without a box score.', {
    ...count('games', { ...f, entity: 'team', side: 'offense', totalOnly: true }),
    categories: ['playing_time.games_minutes']
  }),
  metric('team_w', 'Wins', 'W', 'Games won.', {
    ...count('wins', { ...f, entity: 'team', side: 'offense', tier: 'core', totalOnly: true }),
    categories: ['results.record']
  }),
  metric('team_l', 'Losses', 'L', 'Games lost.', {
    ...count('losses', {
      ...f,
      entity: 'team',
      side: 'offense',
      direction: 'lower',
      tier: 'core',
      totalOnly: true
    }),
    categories: ['results.record']
  }),
  metric('team_win_pct', 'Win percentage', 'W%', 'Wins per game.', {
    value: '{wins} / nullif({wins} + {losses}, 0)',
    sample: 'games',
    unit: 'pct',
    entity: 'team',
    side: 'offense',
    tier: 'core',
    ...f,
    categories: ['results.record']
  }),
  metric('team_pts', 'Points', 'PTS', 'Points scored, from the final score.', {
    ...count('points_for', { ...f, entity: 'team', side: 'offense', tier: 'core' }),
    categories: ['scoring.points', 'offense.scoring']
  }),
  metric('opp_pts', 'Points allowed', 'Opp PTS', 'Points allowed, from the final score.', {
    ...count('points_against', {
      ...f,
      entity: 'team',
      side: 'defense',
      direction: 'lower',
      tier: 'core'
    }),
    categories: ['defense.scoring_allowed', 'scoring.points']
  }),
  metric(
    'team_point_diff',
    'Point differential',
    '+/-',
    'Points scored minus points allowed, from the final score. In one game it is the margin.',
    {
      ...count('points_for', {
        ...f,
        value: '{points_for} - {points_against}',
        kind: 'derived',
        entity: 'team',
        side: 'offense',
        tier: 'core'
      }),
      categories: ['results.margin']
    }
  ),

  metric('pts', 'Points', 'PTS', 'Points scored.', {
    ...count('pts', { ...f, ...nbaPerGame, tier: 'core' }),
    categories: ['scoring.points', 'offense.scoring']
  }),
  ...allSides('fgm', 'Field goals made', 'FGM', 'Made twos and threes, not free throws.', {
    ...count('fgm', f),
    categories: ['shooting.field_goals', 'offense.shooting']
  }),
  ...allSides('fga', 'Field-goal attempts', 'FGA', 'Two- and three-point attempts.', {
    ...count('fga', f),
    categories: ['shooting.field_goals', 'offense.shooting']
  }),
  ...allSides('fg_pct', 'Field-goal percentage', 'FG%', 'Field goals made per attempt.', {
    ...nbaPct('fgm', 'fga'),
    categories: ['shooting.field_goals', 'offense.shooting']
  }),
  ...allSides('fg_miss', 'Missed field goals', 'FGMX', 'Field-goal attempts minus makes.', {
    ...count('fga', { ...f, value: '{fga} - {fgm}', kind: 'derived', direction: 'neutral' }),
    categories: ['shooting.field_goals', 'offense.shooting']
  }),
  ...allSides('fg2m', 'Twos made', '2PM', 'Field goals made minus threes made.', {
    ...count('fgm', { ...f, value: '{fgm} - {fg3m}', kind: 'derived' }),
    categories: ['shooting.twos', 'offense.shooting']
  }),
  ...allSides(
    'fg2a',
    'Two-point attempts',
    '2PA',
    'Field-goal attempts minus three-point attempts.',
    {
      ...count('fga', { ...f, value: '{fga} - {fg3a}', kind: 'derived', direction: 'neutral' }),
      categories: ['shooting.twos', 'offense.shooting']
    }
  ),
  ...allSides('fg2_pct', 'Two-point percentage', '2P%', 'Twos made per two-point attempt.', {
    value: '({fgm} - {fg3m}) / nullif({fga} - {fg3a}, 0)',
    sample: 'fga',
    unit: 'pct',
    minSample: 400,
    ...f,
    categories: ['shooting.twos', 'offense.shooting']
  }),
  ...allSides('fg3m', 'Threes made', '3PM', 'Three-pointers made.', {
    ...count('fg3m', { ...f, tier: 'core' }),
    categories: ['shooting.threes', 'offense.shooting']
  }),
  ...allSides('fg3a', 'Three-point attempts', '3PA', 'Three-point attempts.', {
    ...count('fg3a', f),
    categories: ['shooting.threes', 'offense.shooting']
  }),
  ...allSides('fg3_pct', 'Three-point percentage', '3P%', 'Threes made per attempt.', {
    ...nbaPct('fg3m', 'fg3a'),
    categories: ['shooting.threes', 'offense.shooting']
  }),
  ...allSides('ftm', 'Free throws made', 'FTM', 'Free throws made.', {
    ...count('ftm', f),
    categories: ['shooting.free_throws', 'offense.shooting']
  }),
  ...allSides('fta', 'Free-throw attempts', 'FTA', 'Free-throw attempts.', {
    ...count('fta', f),
    categories: ['shooting.free_throws', 'offense.shooting']
  }),
  ...allSides('ft_pct', 'Free-throw percentage', 'FT%', 'Free throws made per attempt.', {
    ...nbaPct('ftm', 'fta'),
    categories: ['shooting.free_throws', 'offense.shooting']
  }),
  ...allSides('ft_miss', 'Missed free throws', 'FTMX', 'Free-throw attempts minus makes.', {
    ...count('fta', { ...f, value: '{fta} - {ftm}', kind: 'derived', direction: 'lower' }),
    categories: ['shooting.free_throws', 'offense.shooting']
  }),
  ...allSides('oreb', 'Offensive rebounds', 'OREB', 'Rebounds of their own side’s misses.', {
    ...count('oreb', f),
    categories: ['rebounding.offensive', 'offense.rebounding']
  }),
  ...allSides('dreb', 'Defensive rebounds', 'DREB', 'Rebounds of the other side’s misses.', {
    ...count('dreb', f),
    categories: ['rebounding.defensive', 'defense.rebounding']
  }),
  ...allSides(
    'reb',
    'Rebounds',
    'REB',
    'Offensive and defensive rebounds. Team rebounds are not in this box score.',
    {
      ...count('reb', { ...f, ...nbaPerGame, tier: 'core' }),
      categories: ['rebounding.all']
    }
  ),
  ...allSides('ast', 'Assists', 'AST', 'Passes credited as leading to a made field goal.', {
    ...count('ast', { ...f, ...nbaPerGame, tier: 'core' }),
    categories: ['playmaking.passing', 'offense.playmaking']
  }),
  ...allSides(
    'tov',
    'Turnovers',
    'TOV',
    'Turnovers charged to players. Team turnovers are not in this box score.',
    {
      ...count('tov', { ...f, direction: 'lower', tier: 'core' }),
      categories: ['playmaking.turnovers', 'offense.turnovers']
    }
  ),
  ...allSides('stl', 'Steals', 'STL', 'Steals.', {
    ...count('stl', { ...f, ...nbaPerGame, tier: 'core' }),
    categories: ['defense.steals_blocks'],
    opponents: ['offense.turnovers', 'playmaking.turnovers']
  }),
  ...allSides('blk', 'Blocks', 'BLK', 'Blocked shots.', {
    ...count('blk', { ...f, ...nbaPerGame, tier: 'core' }),
    categories: ['defense.steals_blocks'],
    opponents: ['offense.shooting', 'shooting.field_goals'],
    // The opponents' blocks are the team's shots blocked, shown on its own side of Shooting.
    opponentsWords: {
      label: 'Shots blocked by opponents',
      description: "The team's shots its opponents blocked."
    }
  }),
  ...allSides('pf', 'Personal fouls', 'PF', 'Personal fouls charged.', {
    ...count('pf', { ...f, direction: 'lower' }),
    categories: ['fouls.committed', 'defense.fouls']
  }),
  metric(
    'plus_minus',
    'Plus-minus',
    '+/-',
    "The team's points minus the opponent's while the player was on the floor. It does not isolate what the player caused.",
    {
      ...count('plus_minus', {
        ...f,
        sources: NBA_SOURCES,
        firstSeason: NBA_FIRST_SEASON,
        tier: 'core'
      }),
      categories: ['impact.on_court']
    }
  ),
  metric(
    'dd2',
    'Double-doubles',
    'DD2',
    'Games with at least 10 in two or more of points, rebounds, assists, steals and blocks.',
    { ...count('dd2', { ...f, kind: 'derived' }), categories: ['impact.all_around'] }
  ),
  metric(
    'td3',
    'Triple-doubles',
    'TD3',
    'Games with at least 10 in three or more of points, rebounds, assists, steals and blocks.',
    { ...count('td3', { ...f, kind: 'derived' }), categories: ['impact.all_around'] }
  ),
  metric(
    'qd4',
    'Quadruple-doubles',
    'QD',
    'Games with at least 10 in four or more of points, rebounds, assists, steals and blocks.',
    { ...count('qd4', { ...f, kind: 'derived' }), categories: ['impact.all_around'] }
  ),
  metric(
    'five_by_five',
    'Five-by-fives',
    '5x5',
    'Games with at least 5 in each of points, rebounds, assists, steals and blocks.',
    { ...count('five_by_five', { ...f, kind: 'derived' }), categories: ['impact.all_around'] }
  )
]
