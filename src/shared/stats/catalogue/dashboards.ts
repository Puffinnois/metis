import type { MetricDef, MetricFamily } from '../types'
import { metric, NBA_FIRST_SEASON, ratio, type Opts } from './define'

/**
 * Reference sections 4 to 6 as the NBA publishes them on its league dashboards, beside the formula
 * versions in the other files (D14). They have no game behind them, so they answer whole seasons only.
 * Same-named stats keep different ids: `usg_pct` is the box-score formula, `nba_usg_pct` the NBA's.
 *
 * A rate the NBA publishes ready-made is stored times its minutes, or its possessions for a rating
 * (`derived/publishedTables.ts`), so one season reads as published and seasons together are weighted.
 */
const SOURCES = ["The NBA's league dashboards"]

const WEIGHTED =
  'Over more than one season, the published values are weighted by minutes, since the NBA does not publish their parts.'
const WEIGHTED_POSS =
  'Over more than one season, the published values are weighted by possessions, since the NBA does not publish their parts.'
const ON_COURT = 'Counted while the player was on the floor.'

interface Published {
  id: string
  label: string
  short: string
  description: string
  family: MetricFamily
}

/** A published rate stored times its minutes: read back over the minutes. */
function rate(table: string, column: string, p: Published, o: Partial<Opts> = {}): MetricDef {
  const team = table.startsWith('pub_team')
  return metric(p.id, p.label, p.short, p.description, {
    value: ratio(column, 'minutes'),
    sample: 'minutes',
    family: p.family,
    entity: team ? 'team' : 'player',
    kind: 'derived',
    unit: 'pct',
    sources: SOURCES,
    firstSeason: NBA_FIRST_SEASON,
    published: table,
    minSample: team ? undefined : 1000,
    side: team ? 'offense' : undefined,
    ...o
  })
}

/** A published rating stored times its possessions: read back over the possessions. */
const rating = (table: string, column: string, p: Published, o: Partial<Opts> = {}): MetricDef =>
  rate(table, column, p, { value: ratio(column, 'possessions'), unit: 'rating', ...o })

/** A published count: summed, and per game over the games the NBA counted. */
function total(table: string, column: string, p: Published, o: Partial<Opts> = {}): MetricDef {
  const team = table.startsWith('pub_team')
  return metric(p.id, p.label, p.short, p.description, {
    value: `{${column}}`,
    sample: 'games',
    family: p.family,
    entity: team ? 'team' : 'player',
    kind: 'recorded',
    aggregation: 'sum',
    unit: 'count',
    decimals: 0,
    sources: SOURCES,
    firstSeason: NBA_FIRST_SEASON,
    published: table,
    side: team ? 'offense' : undefined,
    ...o
  })
}

const P = 'pub_player_advanced'
const T = 'pub_team_advanced'

/** What the player and team advanced dashboards share, with each side's words. */
function advanced(entity: 'player' | 'team'): MetricDef[] {
  const table = entity === 'player' ? P : T
  const id = (c: string): string => (entity === 'player' ? `nba_${c}` : `team_nba_${c}`)
  const whose = "The team's"
  const court = entity === 'player' ? ` ${ON_COURT}` : ''
  const possessions = (s: string): Pick<Published, 'description' | 'family'> => ({
    family: 'possessions',
    description: `${s}${court} ${WEIGHTED_POSS}`
  })
  return [
    rating(table, 'off_rating', {
      ...possessions(`${whose} points per 100 possessions, as the NBA counts them.`),
      id: id('ortg'),
      label: entity === 'player' ? 'On-court offensive rating (NBA)' : 'Offensive rating (NBA)',
      short: 'ORtg NBA'
    }),
    rating(
      table,
      'def_rating',
      {
        ...possessions(`Points allowed per 100 possessions, as the NBA counts them.`),
        id: id('drtg'),
        label: entity === 'player' ? 'On-court defensive rating (NBA)' : 'Defensive rating (NBA)',
        short: 'DRtg NBA'
      },
      { direction: 'lower', side: entity === 'team' ? 'defense' : undefined }
    ),
    rating(table, 'net_rating', {
      ...possessions('Offensive rating minus defensive rating, as the NBA publishes them.'),
      id: id('nrtg'),
      label: entity === 'player' ? 'On-court net rating (NBA)' : 'Net rating (NBA)',
      short: 'NRtg NBA'
    }),
    rating(
      table,
      'e_off_rating',
      {
        ...possessions("The NBA's offensive rating over its own estimate of possessions."),
        id: id('e_ortg'),
        label: 'Estimated offensive rating (NBA)',
        short: 'E ORtg NBA'
      },
      { kind: 'estimated' }
    ),
    rating(
      table,
      'e_def_rating',
      {
        ...possessions("The NBA's defensive rating over its own estimate of possessions."),
        id: id('e_drtg'),
        label: 'Estimated defensive rating (NBA)',
        short: 'E DRtg NBA'
      },
      { kind: 'estimated', direction: 'lower', side: entity === 'team' ? 'defense' : undefined }
    ),
    rating(
      table,
      'e_net_rating',
      {
        ...possessions('Estimated offensive rating minus estimated defensive rating.'),
        id: id('e_nrtg'),
        label: 'Estimated net rating (NBA)',
        short: 'E NRtg NBA'
      },
      { kind: 'estimated' }
    ),
    rate(
      table,
      'pace',
      {
        id: id('pace'),
        label: 'Pace (NBA)',
        short: 'Pace NBA',
        description: `Possessions per 48 minutes, as the NBA counts them.${court} ${WEIGHTED}`,
        family: 'possessions'
      },
      { unit: 'pace', direction: 'neutral' }
    ),
    rate(
      table,
      'pace',
      {
        id: id('pace40'),
        label: 'Pace per 40 (NBA)',
        short: 'Pace40 NBA',
        description: `The NBA's pace scaled to 40 minutes.${court} ${WEIGHTED}`,
        family: 'possessions'
      },
      { value: `40 * ${ratio('pace', 'minutes')} / 48`, unit: 'pace', direction: 'neutral' }
    ),
    rate(
      table,
      'e_pace',
      {
        id: id('e_pace'),
        label: 'Estimated pace (NBA)',
        short: 'E Pace NBA',
        description: `Pace over the NBA's own estimate of possessions.${court} ${WEIGHTED}`,
        family: 'possessions'
      },
      { unit: 'pace', direction: 'neutral', kind: 'estimated' }
    ),
    total(
      table,
      'possessions',
      {
        id: id('poss'),
        label: entity === 'player' ? 'Possessions played (NBA)' : 'Possessions (NBA)',
        short: 'Poss NBA',
        description:
          entity === 'player'
            ? "The team's possessions while the player was on the floor, as the NBA counts them."
            : "The team's possessions, as the NBA counts them.",
        family: 'possessions'
      },
      { direction: 'neutral' }
    ),
    rate(table, 'ast_pct', {
      id: id('ast_pct'),
      label: 'Assist percentage (NBA)',
      short: 'AST% NBA',
      description:
        entity === 'player'
          ? `The share of teammates' field goals the player assisted while on the floor, as the NBA publishes it. ${WEIGHTED}`
          : `The share of the team's field goals that were assisted, as the NBA publishes it. ${WEIGHTED}`,
      family: 'shooting'
    }),
    rate(
      table,
      'ast_to',
      {
        id: id('ast_to'),
        label: 'Assists per turnover (NBA)',
        short: 'AST/TO NBA',
        description: `Assists per turnover, as the NBA publishes it. ${WEIGHTED}`,
        family: 'shooting'
      },
      { unit: 'number', decimals: 2 }
    ),
    rate(
      table,
      'ast_ratio',
      {
        id: id('ast_ratio'),
        label: 'Assist ratio (NBA)',
        short: 'AST Ratio',
        description: `Assists per 100 plays used, as the NBA publishes it. ${WEIGHTED}`,
        family: 'shooting'
      },
      { unit: 'number' }
    ),
    rate(table, 'oreb_pct', {
      id: id('oreb_pct'),
      label: 'Offensive rebound percentage (NBA)',
      short: 'OREB% NBA',
      description: `The share of available offensive rebounds taken${entity === 'player' ? ' while on the floor' : ''}, as the NBA publishes it. ${WEIGHTED}`,
      family: 'shooting'
    }),
    rate(table, 'dreb_pct', {
      id: id('dreb_pct'),
      label: 'Defensive rebound percentage (NBA)',
      short: 'DREB% NBA',
      description: `The share of available defensive rebounds taken${entity === 'player' ? ' while on the floor' : ''}, as the NBA publishes it. ${WEIGHTED}`,
      family: 'shooting'
    }),
    rate(table, 'reb_pct', {
      id: id('reb_pct'),
      label: 'Rebound percentage (NBA)',
      short: 'REB% NBA',
      description: `The share of all available rebounds taken${entity === 'player' ? ' while on the floor' : ''}, as the NBA publishes it. ${WEIGHTED}`,
      family: 'shooting'
    }),
    rate(table, 'efg_pct', {
      id: id('efg_pct'),
      label: 'Effective field-goal percentage (NBA)',
      short: 'eFG% NBA',
      description: `Field-goal percentage with a three counted as one and a half makes, as the NBA publishes it. ${WEIGHTED}`,
      family: 'shooting'
    }),
    rate(table, 'ts_pct', {
      id: id('ts_pct'),
      label: 'True shooting percentage (NBA)',
      short: 'TS% NBA',
      description: `Points per two shooting attempts, free throws counted at 0.44 of a trip, as the NBA publishes it. ${WEIGHTED}`,
      family: 'shooting'
    }),
    rate(
      table,
      'pie',
      {
        id: id('pie'),
        label: entity === 'player' ? 'Player Impact Estimate (NBA)' : 'Team Impact Estimate (NBA)',
        short: 'PIE NBA',
        description:
          entity === 'player'
            ? `The NBA's published PIE. It reads higher than the box-score PIE here, and behaves like a share of what happened while the player was on the floor. ${WEIGHTED}`
            : `The NBA's published PIE for the team: its share of what both teams did. ${WEIGHTED}`,
        family: 'composite'
      },
      {}
    ),
    entity === 'player'
      ? rate(
          table,
          'tm_tov_pct',
          {
            id: id('tov_ratio'),
            label: 'Turnover ratio (NBA)',
            short: 'TO Ratio',
            description: `Turnovers per 100 plays the player used, as the NBA publishes it. ${WEIGHTED}`,
            family: 'shooting'
          },
          { unit: 'number', direction: 'lower' }
        )
      : rate(
          table,
          'tm_tov_pct',
          {
            id: id('tov_pct'),
            label: 'Turnover percentage (NBA)',
            short: 'TOV% NBA',
            description: `Turnovers per possession, as the NBA publishes it. ${WEIGHTED}`,
            family: 'shooting'
          },
          { direction: 'lower' }
        )
  ]
}

const PLAYER_ADVANCED: MetricDef[] = [
  ...advanced('player'),
  rate(
    P,
    'e_tov_pct',
    {
      id: 'nba_e_tov_ratio',
      label: 'Estimated turnover ratio (NBA)',
      short: 'E TO Ratio',
      description: `The NBA's turnover ratio over its own estimate of plays. ${WEIGHTED}`,
      family: 'shooting'
    },
    { unit: 'number', direction: 'lower', kind: 'estimated' }
  ),
  rate(
    P,
    'usg_pct',
    {
      id: 'nba_usg_pct',
      label: 'Usage percentage (NBA)',
      short: 'USG% NBA',
      description: `The share of the team's plays the player used while on the floor, as the NBA publishes it. ${WEIGHTED}`,
      family: 'shooting'
    },
    { direction: 'neutral' }
  ),
  rate(
    P,
    'e_usg_pct',
    {
      id: 'nba_e_usg_pct',
      label: 'Estimated usage percentage (NBA)',
      short: 'E USG% NBA',
      description: `The NBA's usage over its own estimate of plays. ${WEIGHTED}`,
      family: 'shooting'
    },
    { direction: 'neutral', kind: 'estimated' }
  )
]

const FF = 'pub_team_four_factors'

const TEAM_FOUR_FACTORS: MetricDef[] = [
  rate(FF, 'fta_rate', {
    id: 'team_nba_fta_rate',
    label: 'Free-throw attempt rate (NBA)',
    short: 'FTr NBA',
    description: `Free-throw attempts per field-goal attempt, as the NBA publishes it. ${WEIGHTED}`,
    family: 'shooting'
  }),
  ...(
    [
      ['efg_pct', 'effective field-goal percentage', 'eFG%', 'lower'],
      ['fta_rate', 'free-throw attempt rate', 'FTr', 'lower'],
      ['tov_pct', 'turnover percentage', 'TOV%', 'higher'],
      ['oreb_pct', 'offensive rebound percentage', 'OREB%', 'lower']
    ] as const
  ).map(([c, words, short, direction]) =>
    rate(
      FF,
      `opp_${c}`,
      {
        id: `opp_nba_${c}`,
        label: `Opponent ${words} (NBA)`,
        short: `Opp ${short}`,
        description: `The team's opponents' ${words}, one of the four factors, as the NBA publishes it. ${WEIGHTED}`,
        family: 'shooting'
      },
      { direction, side: 'defense' }
    )
  )
]

/** Points by kind, from the misc dashboards. */
const KINDS = [
  ['pts_off_tov', 'Points off turnovers', 'PTS OffTO'],
  ['pts_2_nd_chance', 'Second-chance points', '2nd PTS'],
  ['pts_fb', 'Fast-break points', 'FB PTS'],
  ['pts_paint', 'Points in the paint', 'PITP']
] as const

const lower = (s: string): string => s[0].toLowerCase() + s.slice(1)

const MISC: MetricDef[] = [
  ...KINDS.flatMap(([c, label, short]) => [
    total('pub_player_misc', c, {
      id: `nba_${c}`,
      label: `${label} (NBA)`,
      short: `${short} NBA`.slice(0, 14),
      description: `The player's ${lower(label)}, as the NBA classifies them.`,
      family: 'scoring'
    }),
    total(
      'pub_player_misc',
      `opp_${c}`,
      {
        id: `nba_on_opp_${c}`,
        label: `Opponent ${lower(label)} on court (NBA)`,
        short: `Opp ${short}`,
        description: `Opponents' ${lower(label)} while the player was on the floor, as the NBA classifies them. Not points the player gave up alone.`,
        family: 'scoring'
      },
      { direction: 'lower' }
    ),
    total('pub_team_misc', c, {
      id: `team_nba_${c}`,
      label: `${label} (NBA)`,
      short: `${short} NBA`.slice(0, 14),
      description: `The team's ${lower(label)}, as the NBA classifies them.`,
      family: 'scoring'
    }),
    total(
      'pub_team_misc',
      `opp_${c}`,
      {
        id: `opp_nba_${c}`,
        label: `Opponent ${lower(label)} (NBA)`,
        short: `Opp ${short}`,
        description: `The team's opponents' ${lower(label)}, as the NBA classifies them.`,
        family: 'scoring'
      },
      { direction: 'lower', side: 'defense' }
    )
  ]),
  total('pub_player_misc', 'blka', {
    id: 'nba_blka',
    label: 'Shots blocked (NBA)',
    short: 'BLKA',
    description: "The player's attempts blocked by a defender.",
    family: 'traditional'
  }),
  total(
    'pub_player_misc',
    'pfd',
    {
      id: 'nba_pfd',
      label: 'Fouls drawn (NBA)',
      short: 'PFD',
      description: 'Fouls committed against the player.',
      family: 'traditional'
    },
    { firstSeason: 2006 }
  )
]

/** The scoring dashboards' shares: of a player's or team's attempts, points and makes. */
const SHARES = [
  [
    'pct_fga_2_pt',
    'fga_2pt',
    'Share of attempts from two',
    '%FGA 2PT',
    'of field-goal attempts that were twos'
  ],
  [
    'pct_fga_3_pt',
    'fga_3pt',
    'Share of attempts from three',
    '%FGA 3PT',
    'of field-goal attempts that were threes'
  ],
  ['pct_pts_2_pt', 'pts_2pt', 'Share of points from twos', '%PTS 2PT', 'of points from twos'],
  [
    'pct_pts_2_pt_mr',
    'pts_mid',
    'Share of points from midrange',
    '%PTS MR',
    'of points from midrange twos'
  ],
  ['pct_pts_3_pt', 'pts_3pt', 'Share of points from threes', '%PTS 3PT', 'of points from threes'],
  [
    'pct_pts_ft',
    'pts_ft',
    'Share of points from free throws',
    '%PTS FT',
    'of points from free throws'
  ],
  [
    'pct_pts_fb',
    'pts_fb',
    'Share of points on the fast break',
    '%PTS FB',
    'of points on the fast break'
  ],
  [
    'pct_pts_off_tov',
    'pts_off_tov',
    'Share of points off turnovers',
    '%PTS OffTO',
    'of points off turnovers'
  ],
  [
    'pct_pts_paint',
    'pts_paint',
    'Share of points in the paint',
    '%PTS PITP',
    'of points in the paint'
  ],
  [
    'pct_ast_2_pm',
    'ast_2pm',
    'Assisted share of made twos',
    '%AST 2PM',
    'of made twos that were assisted'
  ],
  [
    'pct_uast_2_pm',
    'uast_2pm',
    'Unassisted share of made twos',
    '%UAST 2PM',
    'of made twos that were not assisted'
  ],
  [
    'pct_ast_3_pm',
    'ast_3pm',
    'Assisted share of made threes',
    '%AST 3PM',
    'of made threes that were assisted'
  ],
  [
    'pct_uast_3_pm',
    'uast_3pm',
    'Unassisted share of made threes',
    '%UAST 3PM',
    'of made threes that were not assisted'
  ],
  [
    'pct_ast_fgm',
    'ast_fgm',
    'Assisted share of field goals',
    '%AST FGM',
    'of field goals made that were assisted'
  ],
  [
    'pct_uast_fgm',
    'uast_fgm',
    'Unassisted share of field goals',
    '%UAST FGM',
    'of field goals made that were not assisted'
  ]
] as const

const SCORING_SHARES: MetricDef[] = SHARES.flatMap(([c, id, label, short, words]) => [
  rate(
    'pub_player_scoring',
    c,
    {
      id: `nba_share_${id}`,
      label: `${label} (NBA)`,
      short,
      description: `The share of the player's ${words.replace(/^of /, '')}, as the NBA classifies them. ${WEIGHTED}`,
      family: 'scoring'
    },
    { direction: 'neutral' }
  ),
  rate(
    'pub_team_scoring',
    c,
    {
      id: `team_nba_share_${id}`,
      label: `${label} (NBA)`,
      short,
      description: `The share of the team's ${words.replace(/^of /, '')}, as the NBA classifies them. ${WEIGHTED}`,
      family: 'scoring'
    },
    { direction: 'neutral' }
  )
])

/** The usage dashboard: a player's share of the team's events while on the floor. */
const USAGE = [
  ['pct_fgm', 'fgm', 'field goals made', '%FGM'],
  ['pct_fga', 'fga', 'field-goal attempts', '%FGA'],
  ['pct_fg3_m', 'fg3m', 'threes made', '%3PM'],
  ['pct_fg3_a', 'fg3a', 'three-point attempts', '%3PA'],
  ['pct_ftm', 'ftm', 'free throws made', '%FTM'],
  ['pct_fta', 'fta', 'free-throw attempts', '%FTA'],
  ['pct_oreb', 'oreb', 'offensive rebounds', '%OREB'],
  ['pct_dreb', 'dreb', 'defensive rebounds', '%DREB'],
  ['pct_reb', 'reb', 'rebounds', '%REB'],
  ['pct_ast', 'ast', 'assists', '%AST'],
  ['pct_tov', 'tov', 'turnovers', '%TOV'],
  ['pct_stl', 'stl', 'steals', '%STL'],
  ['pct_blk', 'blk', 'blocks', '%BLK'],
  ['pct_blka', 'blka', 'shots blocked', '%BLKA'],
  ['pct_pf', 'pf', 'fouls', '%PF'],
  ['pct_pfd', 'pfd', 'fouls drawn', '%PFD'],
  ['pct_pts', 'pts', 'points', '%PTS']
] as const

const USAGE_SHARES: MetricDef[] = USAGE.map(([c, id, words, short]) =>
  rate(
    'pub_player_usage',
    c,
    {
      id: `nba_share_${id}`,
      label: `Share of team ${words} on court (NBA)`,
      short: `${short} NBA`,
      description: `The player's share of the team's ${words} while they were on the floor, as the NBA publishes it. Not the same as a percentage of what was available. ${WEIGHTED}`,
      family: 'scoring'
    },
    { direction: 'neutral', firstSeason: c === 'pct_pfd' ? 2006 : NBA_FIRST_SEASON }
  )
)

const DEFENSE: MetricDef[] = [
  total(
    'pub_player_defense',
    'def_ws',
    {
      id: 'nba_def_ws',
      label: 'Defensive win shares (NBA)',
      short: 'DWS NBA',
      description:
        "Wins credited to the player's defense, as the NBA's defense dashboard publishes them. The NBA does not state its method; it is not Basketball-Reference's Win Shares.",
      family: 'composite'
    },
    { kind: 'estimated', decimals: 2 }
  )
]

export const DASHBOARDS: MetricDef[] = [
  ...PLAYER_ADVANCED,
  ...advanced('team'),
  ...TEAM_FOUR_FACTORS,
  ...MISC,
  ...SCORING_SHARES,
  ...USAGE_SHARES,
  ...DEFENSE
]
