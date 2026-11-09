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
  }
]
