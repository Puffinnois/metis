import type { Entity, GameType } from '@shared/stats/types'

/**
 * A table the dataset publishes per season, with no game behind it. A traded player has one row for
 * their whole season, under their last team (measured on the league dashboards and hustle).
 */
export interface PublishedTable {
  /** The table built from the source, and what a metric's `published` names. */
  table: string
  entity: Entity
  source: string
  /** The first season holding real values: some files have earlier rows with only games and minutes. */
  firstSeason?: number
  /**
   * The source's columns for its own tracked games and minutes: they can differ from the official
   * ones, and a rate must divide by what was tracked. Null when it does not publish them. A team's
   * minutes are as published: elapsed, about 48 a game.
   */
  games: string | null
  minutes: string | null
  possessions?: string
  /**
   * The source's columns to read, each a component of the same name, or a component worked out from
   * them. A divisor can be worked out too. In either, `{name}` is the source's column.
   */
  columns: readonly (string | PublishedColumn)[]
}

/** A component worked out from the source's columns: `{off_rating} * {poss}`. */
export interface PublishedColumn {
  name: string
  sql: string
}

/** The season types these tables hold (measured). The Cup final and the play-in have no rows. */
export const PUBLISHED_GAME_TYPES: readonly GameType[] = ['regular', 'playoffs']

/**
 * A rate the source publishes ready-made, times what it was measured over. Its parts are not
 * published, so a season reads back exactly as published, and seasons added together are weighted by
 * that divisor: minutes, or possessions for a rating.
 */
const times = (name: string, by: string): PublishedColumn => ({ name, sql: `{${name}} * ${by}` })

/**
 * The player dashboards for advanced stats and scoring publish minutes per game, even in their rows of
 * totals; the others publish the season's minutes (measured on every season, 1996-97 to 2026-27).
 */
const SEASON_MINUTES_FROM_PER_GAME = '{gp} * {min}'

/** Columns the advanced dashboards publish for players and teams alike. */
const ADVANCED_BY_POSSESSIONS = [
  'off_rating',
  'def_rating',
  'net_rating',
  'e_off_rating',
  'e_def_rating',
  'e_net_rating'
]
const ADVANCED_BY_MINUTES = [
  'pace',
  'e_pace',
  'ast_pct',
  'ast_to',
  'ast_ratio',
  'oreb_pct',
  'dreb_pct',
  'reb_pct',
  'tm_tov_pct',
  'efg_pct',
  'ts_pct',
  'pie'
]

/** The shares of a player's or team's shots and points the scoring dashboards publish. */
export const SCORING_SHARES = [
  'pct_fga_2_pt',
  'pct_fga_3_pt',
  'pct_pts_2_pt',
  'pct_pts_2_pt_mr',
  'pct_pts_3_pt',
  'pct_pts_ft',
  'pct_pts_fb',
  'pct_pts_off_tov',
  'pct_pts_paint',
  'pct_ast_2_pm',
  'pct_uast_2_pm',
  'pct_ast_3_pm',
  'pct_uast_3_pm',
  'pct_ast_fgm',
  'pct_uast_fgm'
] as const

/** A player's share of the team's events while they were on the floor, from the usage dashboard. */
export const USAGE_SHARES = [
  'pct_fgm',
  'pct_fga',
  'pct_fg3_m',
  'pct_fg3_a',
  'pct_ftm',
  'pct_fta',
  'pct_oreb',
  'pct_dreb',
  'pct_reb',
  'pct_ast',
  'pct_tov',
  'pct_stl',
  'pct_blk',
  'pct_blka',
  'pct_pf',
  'pct_pfd',
  'pct_pts'
] as const

/** Points by kind from the misc dashboards: scored, and scored by opponents while on the floor. */
export const MISC_POINTS = [
  'pts_off_tov',
  'pts_2_nd_chance',
  'pts_fb',
  'pts_paint',
  'opp_pts_off_tov',
  'opp_pts_2_nd_chance',
  'opp_pts_fb',
  'opp_pts_paint'
] as const

/** Optical tracking starts in 2013-14; the catch-and-shoot and pull-up files hold zeros before it. */
export const TRACKING_FIRST_SEASON = 2014

/** The three touch areas, each with its own file of the same columns. */
export const TOUCH_AREAS = ['elbow', 'post', 'paint'] as const

/** A player tracking file: totals per season, over the games and minutes tracking counted. */
const tracking = (
  table: string,
  file: string,
  columns: readonly (string | PublishedColumn)[]
): PublishedTable => ({
  table,
  entity: 'player',
  source: `src_dash_player_tracking_${file}`,
  firstSeason: TRACKING_FIRST_SEASON,
  games: 'gp',
  minutes: 'min',
  columns
})

/**
 * The catch-and-shoot and pull-up files leave a player's threes blank, not 0, when they took none
 * (measured on every season): a row with attempts reads 0 there, or its eFG% would be blank too.
 */
const shotType = (p: string): (string | PublishedColumn)[] => [
  `${p}_fgm`,
  `${p}_fga`,
  `${p}_pts`,
  ...['fg3_m', 'fg3_a'].map((c) => ({
    name: `${p}_${c}`,
    sql: `CASE WHEN {${p}_fga} IS NOT NULL THEN coalesce({${p}_${c}}, 0) END`
  }))
]

/**
 * Reference section 8. A rate the files publish with its parts is rebuilt from them when read; one
 * published without them is stored times what it was measured over. Measured on every season: seconds
 * per touch are not rebuilt, since the time of possession is published to a tenth of a minute and
 * misses on a fifth of rows. The efficiency file is kept only where it differs from the others: its
 * drive, touch-area and total points repeat them on every row, while its catch-and-shoot and pull-up
 * figures differ on a third to a half.
 */
const TRACKING: PublishedTable[] = [
  tracking('pub_player_speed', 'speeddistance', [
    'dist_miles',
    'dist_miles_off',
    'dist_miles_def',
    ...['avg_speed', 'avg_speed_off', 'avg_speed_def'].map((c) => times(c, '{min}'))
  ]),
  tracking('pub_player_touches', 'possessions', [
    'points',
    'touches',
    'front_ct_touches',
    'time_of_poss',
    times('avg_sec_per_touch', '{touches}'),
    times('avg_drib_per_touch', '{touches}')
  ]),
  tracking('pub_player_drives', 'drives', [
    'drives',
    ...['fgm', 'fga', 'ftm', 'fta', 'pts', 'passes', 'ast', 'tov', 'pf'].map((c) => `drive_${c}`)
  ]),
  tracking('pub_player_passing', 'passing', [
    'passes_made',
    'passes_received',
    'ast',
    'ft_ast',
    'secondary_ast',
    'potential_ast',
    'ast_pts_created',
    'ast_adj'
  ]),
  tracking(
    'pub_player_rebounding',
    'rebounding',
    (['oreb', 'dreb', 'reb'] as const).flatMap((r) => [
      r,
      `${r}_contest`,
      `${r}_uncontest`,
      `${r}_chances`,
      `${r}_chance_defer`,
      times(`avg_${r}_dist`, `{${r}}`)
    ])
  ),
  tracking('pub_player_catch_shoot', 'catchshoot', shotType('catch_shoot')),
  tracking('pub_player_pull_up', 'pullupshot', shotType('pull_up')),
  ...TOUCH_AREAS.map((a) =>
    tracking(`pub_player_${a}_touch`, `${a}touch`, [
      `${a}_touches`,
      ...['fgm', 'fga', 'ftm', 'fta', 'pts', 'passes', 'ast', 'tov', 'fouls'].map(
        (c) => `${a}_touch_${c}`
      )
    ])
  ),
  tracking('pub_player_tracking_efficiency', 'efficiency', [
    'catch_shoot_pts',
    'pull_up_pts',
    ...['catch_shoot_fg_pct', 'pull_up_fg_pct', 'eff_fg_pct'].map((c) => times(c, '{min}'))
  ]),
  tracking('pub_player_rim_defense', 'defense', ['def_rim_fgm', 'def_rim_fga'])
]

/**
 * Hustle starts in 2016-17: the 2015-16 regular-season file is 2016-17's under the wrong label, and
 * coverage is per season, so that season's playoffs are left out with it.
 */
export const HUSTLE_FIRST_SEASON = 2017

/** Box outs hold zeros before 2017-18. */
export const BOX_OUTS_FIRST_SEASON = 2018

/** What the player and team hustle files share. */
export const HUSTLE_COUNTS = [
  'contested_shots',
  'contested_shots_2_pt',
  'contested_shots_3_pt',
  'deflections',
  'charges_drawn',
  'screen_assists',
  'screen_ast_pts',
  'off_loose_balls_recovered',
  'def_loose_balls_recovered',
  'loose_balls_recovered',
  'off_boxouts',
  'def_boxouts',
  'box_outs'
] as const

/**
 * Reference section 9. The two box-out rebound rates divide by the box outs on nearly every row only
 * from 2024-25; before, what they divide by is not published, so they are stored times the box outs
 * (measured).
 */
const HUSTLE: PublishedTable[] = [
  {
    table: 'pub_player_hustle',
    entity: 'player',
    source: 'src_nba_hustle_player',
    firstSeason: HUSTLE_FIRST_SEASON,
    games: 'g',
    minutes: 'min',
    columns: [
      ...HUSTLE_COUNTS,
      'box_out_player_team_rebs',
      'box_out_player_rebs',
      times('pct_box_outs_team_reb', '{box_outs}'),
      times('pct_box_outs_reb', '{box_outs}')
    ]
  },
  {
    table: 'pub_team_hustle',
    entity: 'team',
    source: 'src_nba_hustle_team',
    firstSeason: HUSTLE_FIRST_SEASON,
    // The team file publishes no games.
    games: null,
    minutes: 'min',
    columns: HUSTLE_COUNTS
  }
]

/** Every published table. Each family adds its own; bump `PUBLISHED_VERSION` when one changes. */
export const PUBLISHED_TABLES: readonly PublishedTable[] = [
  {
    table: 'pub_player_advanced',
    entity: 'player',
    source: 'src_dash_player_stats_advanced',
    games: 'gp',
    minutes: SEASON_MINUTES_FROM_PER_GAME,
    possessions: 'poss',
    columns: [
      ...ADVANCED_BY_POSSESSIONS.map((c) => times(c, '{poss}')),
      ...[...ADVANCED_BY_MINUTES, 'e_tov_pct', 'usg_pct', 'e_usg_pct'].map((c) =>
        times(c, SEASON_MINUTES_FROM_PER_GAME)
      )
    ]
  },
  {
    table: 'pub_team_advanced',
    entity: 'team',
    source: 'src_dash_team_stats_advanced',
    games: 'gp',
    minutes: 'min',
    possessions: 'poss',
    columns: [
      ...ADVANCED_BY_POSSESSIONS.map((c) => times(c, '{poss}')),
      ...ADVANCED_BY_MINUTES.map((c) => times(c, '{min}'))
    ]
  },
  {
    table: 'pub_team_four_factors',
    entity: 'team',
    source: 'src_dash_team_stats_fourfactors',
    games: 'gp',
    minutes: 'min',
    columns: ['fta_rate', 'opp_efg_pct', 'opp_fta_rate', 'opp_tov_pct', 'opp_oreb_pct'].map((c) =>
      times(c, '{min}')
    )
  },
  {
    table: 'pub_player_misc',
    entity: 'player',
    source: 'src_dash_player_stats_misc',
    games: 'gp',
    minutes: 'min',
    columns: [...MISC_POINTS, 'blka', 'pfd']
  },
  {
    table: 'pub_team_misc',
    entity: 'team',
    source: 'src_dash_team_stats_misc',
    games: 'gp',
    minutes: 'min',
    columns: MISC_POINTS
  },
  {
    table: 'pub_player_scoring',
    entity: 'player',
    source: 'src_dash_player_stats_scoring',
    games: 'gp',
    minutes: SEASON_MINUTES_FROM_PER_GAME,
    columns: SCORING_SHARES.map((c) => times(c, SEASON_MINUTES_FROM_PER_GAME))
  },
  {
    table: 'pub_team_scoring',
    entity: 'team',
    source: 'src_dash_team_stats_scoring',
    games: 'gp',
    minutes: SEASON_MINUTES_FROM_PER_GAME,
    columns: SCORING_SHARES.map((c) => times(c, SEASON_MINUTES_FROM_PER_GAME))
  },
  {
    table: 'pub_player_usage',
    entity: 'player',
    source: 'src_dash_player_stats_usage',
    games: 'gp',
    minutes: 'min',
    columns: USAGE_SHARES.map((c) => times(c, '{min}'))
  },
  {
    table: 'pub_player_defense',
    entity: 'player',
    source: 'src_dash_player_stats_defense',
    games: 'gp',
    minutes: 'min',
    columns: ['def_ws']
  },
  ...TRACKING,
  ...HUSTLE
]
