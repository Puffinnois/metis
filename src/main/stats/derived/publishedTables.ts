import { PLAY_TYPE_SIDES, PLAY_TYPES_FIRST_SEASON } from '@shared/stats/playTypes'
import { AVAILABILITY_FIRST_SEASON } from '@shared/stats/availability'
import type { Entity, GameType } from '@shared/stats/types'
import { AVAILABILITY_COUNTS, AVAILABILITY_TABLE, availabilitySql } from './availability'
import type { Have } from './sql'

/**
 * A table the dataset publishes per season, with no game behind it. A traded player has one row for
 * their whole season, under their last team (measured on the league dashboards and hustle), except in
 * the play types, which have a row per team. The engine adds a player's rows up either way.
 */
export interface PublishedTable {
  /** The table built from the source, and what a metric's `published` names. */
  table: string
  entity: Entity
  source: string
  /** The first season holding real values: some files have earlier rows with only games and minutes. */
  firstSeason?: number
  /**
   * The rows to read when a source holds several tables in one: each column's value, compared without
   * case (`{ play_type: 'isolation' }`).
   */
  match?: Readonly<Record<string, string>>
  /** The source's column holding the player or team id, when it is not `player_id` or `team_id`. */
  key?: string
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
  /**
   * Other sources that take over some components wherever they hold the season and season type. Their
   * rows are added to the table, and this source's values of those components read NULL there; the
   * rest, the games among them, still come from this source. They must not hold the same season type.
   */
  replacedBy?: PublishedReplacement | readonly PublishedReplacement[]
  /** A table that is not the source's totals but built from its rows: the statement that builds it. */
  sql?: (have: Have) => string
}

/** See `PublishedTable.replacedBy`. */
export interface PublishedReplacement {
  source: string
  key?: string
  /** A column already holding the season type in the one set (D12), as a built table does. */
  typeColumn?: string
  /** Only these season types of it. */
  types?: readonly GameType[]
  /** Each component it takes over, from its own columns: a bare column or `{column}`s worked out. */
  columns: Readonly<Record<string, string>>
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

/**
 * Reference section 11: one table per play type and side, from the one source file of them all. A
 * traded player has a row per team, which the engine adds up. The games are the player's games on that
 * side of the ball, the same for every type of it.
 *
 * Points per possession and field-goal percentage are rebuilt from their parts: before 2023-24 the
 * published rates are often rounded to two places, and to whole points per possession on some rows of
 * 2015-16 to 2017-18 (measured). The rest come without their parts and are stored times what they
 * divide by. A type's frequency divides by all the player's possessions with a play type on that side,
 * worked out from its published share; a row whose share rounds to 0 is left out of both sides.
 */
const PLAY_TYPE_TABLES: PublishedTable[] = PLAY_TYPE_SIDES.map(({ type, side, key }) => ({
  table: `pub_player_pt_${key}`,
  entity: 'player',
  source: 'src_nba_play_types',
  firstSeason: PLAY_TYPES_FIRST_SEASON,
  match: {
    play_type: type.source.toLowerCase(),
    type_grouping: side === 'offense' ? 'offensive' : 'defensive'
  },
  games: 'gp',
  // The play-type files publish no minutes.
  minutes: null,
  columns: [
    { name: `${key}_poss`, sql: '{poss}' },
    { name: `${key}_pts`, sql: '{pts}' },
    { name: `${key}_fgm`, sql: '{fgm}' },
    { name: `${key}_fga`, sql: '{fga}' },
    { name: `${key}_freq_poss`, sql: 'CASE WHEN {poss_pct} > 0 THEN {poss} END' },
    { name: `${key}_all_poss`, sql: 'CASE WHEN {poss_pct} > 0 THEN {poss} / {poss_pct} END' },
    { name: `${key}_efg_w`, sql: '{efg_pct} * {fga}' },
    ...(
      [
        ['ft', 'ft_poss_pct'],
        ['tov', 'tov_poss_pct'],
        ['sf', 'sf_poss_pct'],
        ['and1', 'plusone_poss_pct'],
        ['score', 'score_poss_pct']
      ] as const
    ).map(([name, c]) => ({ name: `${key}_${name}_w`, sql: `{${c}} * {poss}` }))
  ]
}))

/** Matchups start in 2017-18. */
export const MATCHUPS_FIRST_SEASON = 2018

/** A source's minutes as published in its rows of totals, `41:33`, as minutes. */
const clockMinutes = (c: string): string =>
  `TRY_CAST(split_part({${c}:text}, ':', 1) AS DOUBLE) + TRY_CAST(split_part({${c}:text}, ':', 2) AS DOUBLE) / 60`

/** What a defender's matchups add up: what the players they guarded did against them. */
export const MATCHUP_COUNTS = [
  'player_pts',
  'team_pts',
  'matchup_fgm',
  'matchup_fga',
  'matchup_fg3_m',
  'matchup_fg3_a',
  'matchup_ftm',
  'matchup_fta',
  'matchup_ast',
  'matchup_tov',
  'matchup_blk',
  'sfl'
] as const

/** The positions the rollup splits a defender's matchups by. */
export const MATCHUP_POSITIONS = ['g', 'f', 'c'] as const

/**
 * Reference section 10.2, for defenders. The rollup file gives a defender's season for the regular
 * season and the playoffs, and the current season before its pair file is out. In the regular season
 * the pair file, added up per defender, takes over: it matches the game matchups on every defender of
 * every season, while the 2025-26 rollup reads about 5 % less time than both (measured). In the
 * playoffs the game matchups take over the same way: the 2025-26 playoff rollup agrees with them on 17
 * of 230 defenders (measured). The games still come from the rollup, since the pair file's are per
 * pair. The help columns are left out: the pair file publishes them as zeros on every row.
 */
const MATCHUP_TABLES: PublishedTable[] = [
  {
    table: 'pub_player_matchups',
    entity: 'player',
    source: 'src_nba_matchup_rollups',
    key: 'def_player_id',
    firstSeason: MATCHUPS_FIRST_SEASON,
    match: { position: 'total' },
    games: 'gp',
    // Matchup minutes are time guarding someone, not minutes played: no per 36 is read from them.
    minutes: null,
    possessions: 'partial_poss',
    columns: [{ name: 'matchup_minutes', sql: clockMinutes('matchup_min') }, ...MATCHUP_COUNTS],
    replacedBy: [
      {
        source: 'src_nba_season_matchups',
        key: 'def_player_id',
        columns: {
          possessions: 'partial_poss',
          matchup_minutes: '{matchup_time_sec} / 60',
          ...Object.fromEntries(MATCHUP_COUNTS.map((c) => [c, c]))
        }
      },
      {
        // Built from the game file, already in minutes and keyed to `game`'s season types.
        source: 'game_matchups',
        key: 'def_player_id',
        typeColumn: 'game_type',
        types: ['playoffs'],
        columns: {
          possessions: 'possessions',
          matchup_minutes: 'matchup_minutes',
          ...Object.fromEntries(MATCHUP_COUNTS.map((c) => [c, c]))
        }
      }
    ]
  },
  {
    // Shares of the rollup's own time, so a season reads as the NBA's percent of time.
    table: 'pub_player_matchup_positions',
    entity: 'player',
    source: 'src_nba_matchup_rollups',
    key: 'def_player_id',
    firstSeason: MATCHUPS_FIRST_SEASON,
    games: null,
    minutes: null,
    columns: [
      {
        name: 'pos_all_minutes',
        sql: `CASE WHEN lower({position:text}) = 'total' THEN ${clockMinutes('matchup_min')} END`
      },
      ...MATCHUP_POSITIONS.flatMap((p) =>
        (
          [
            ['minutes', clockMinutes('matchup_min')],
            ['poss', '{partial_poss}'],
            ['pts', '{player_pts}'],
            ['fgm', '{matchup_fgm}'],
            ['fga', '{matchup_fga}']
          ] as const
        ).map(([name, sql]) => ({
          name: `pos_${p}_${name}`,
          sql: `CASE WHEN lower({position:text}) = '${p}' THEN ${sql} END`
        }))
      )
    ]
  }
]

/** The impact models' first season, and DARKO's: it needs a season before it (measured). */
export const IMPACT_FIRST_SEASON = 1997
export const DARKO_FIRST_SEASON = 1998

/** The RAPM-style models, each part weighted by the possessions it was fitted on. */
export const IMPACT_BY_POSSESSIONS = [
  ['o_rapm', '{off_poss}'],
  ['d_rapm', '{def_poss}'],
  ['rapm', '({off_poss} + {def_poss})'],
  ['o_adj_rapm', '{off_poss}'],
  ['d_adj_rapm', '{def_poss}'],
  ['adj_rapm', '({off_poss} + {def_poss})']
] as const
/** The box-score models, weighted by minutes. */
export const IMPACT_BY_MINUTES = ['ospm', 'dspm', 'spm', 'obpm', 'dbpm', 'bpm'] as const
export const DARKO_COLUMNS = [
  'darko_filtered_skill',
  'darko_projected_rating',
  'darko_projected_sd'
] as const

/**
 * Reference section 14: the dataset's own impact models, not the original publishers' values. It
 * leaves out play-in games. Each model value is stored times what it was fitted on, so a season reads
 * as published and seasons together are weighted. A fresh download has no `darko_*` columns and fills
 * `boban_*` with other values (measured against the old file: none equal), so DARKO reads blank.
 */
const IMPACT_TABLES: PublishedTable[] = [
  {
    table: 'pub_player_impact',
    entity: 'player',
    source: 'src_nba_impact',
    firstSeason: IMPACT_FIRST_SEASON,
    games: 'gp',
    minutes: 'min',
    columns: [
      ...IMPACT_BY_POSSESSIONS.map(([c, by]) => times(c, by)),
      ...IMPACT_BY_MINUTES.map((c) => times(c, '{min}')),
      'war',
      'off_poss',
      'def_poss',
      { name: 'impact_poss', sql: '{off_poss} + {def_poss}' }
    ]
  },
  {
    // DARKO is the player's state at the season's end and a projection of the next one. Its playoff
    // rows repeat the regular season's on every player, so only the regular season is read.
    table: 'pub_player_darko',
    entity: 'player',
    source: 'src_nba_impact',
    firstSeason: DARKO_FIRST_SEASON,
    match: { season_type: 'regular season' },
    games: 'gp',
    minutes: 'min',
    columns: DARKO_COLUMNS.map((c) => times(c, '{gp}'))
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
  ...HUSTLE,
  ...PLAY_TYPE_TABLES,
  ...MATCHUP_TABLES,
  ...IMPACT_TABLES,
  {
    // Games listed Out, counted by game from the injury reports (`derived/availability.ts`).
    table: AVAILABILITY_TABLE,
    entity: 'player',
    source: 'src_nba_injury_report',
    firstSeason: AVAILABILITY_FIRST_SEASON,
    games: null,
    minutes: null,
    columns: [...AVAILABILITY_COUNTS],
    sql: availabilitySql
  }
]
