import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * Reference section 9: actions the NBA's staff tag by hand, for players and teams, from 2016-17. Season
 * totals with no game behind them, so they answer whole seasons only. A player's rates divide by the
 * games and minutes hustle counted, which differ from the official ones. The team file publishes no
 * games, so a team's hustle reads as totals or per 48 minutes, not per game.
 */
const SOURCES = ["The NBA's hustle stats"]
const FIRST = 2017
const BOX_OUTS = 2018

type Side = 'offense' | 'defense'

interface Hustle {
  id: string
  column: string
  label: string
  short: string
  description: string
  side: Side
  direction?: MetricDef['direction']
  firstSeason?: number
}

const PLAYER = 'pub_player_hustle'
const TEAM = 'pub_team_hustle'

/** A tagged count: summed, and per game over the games hustle counted. */
const count = (table: string, column: string, o: Partial<Opts> = {}): Opts => ({
  value: `{${column}}`,
  sample: 'games',
  family: 'hustle',
  kind: 'recorded',
  aggregation: 'sum',
  unit: 'count',
  decimals: 0,
  sources: SOURCES,
  firstSeason: FIRST,
  published: table,
  ...o
})

/** A share of two tagged counts, read as a fraction. */
const share = (table: string, a: string, b: string, o: Partial<Opts> = {}): Opts => ({
  value: ratio(a, b),
  sample: b,
  family: 'hustle',
  unit: 'pct',
  direction: 'neutral',
  sources: SOURCES,
  firstSeason: FIRST,
  published: table,
  ...o
})

/** The counts both files publish, for players and teams. */
const COUNTS: Hustle[] = [
  {
    id: 'contested_shots',
    column: 'contested_shots',
    label: 'Contested shots',
    short: 'Contests',
    description: 'Shots the defense challenged, as tagged.',
    side: 'defense'
  },
  {
    id: 'contested_shots_2pt',
    column: 'contested_shots_2_pt',
    label: 'Contested twos',
    short: 'Contests 2PT',
    description: 'Two-point shots the defense challenged.',
    side: 'defense'
  },
  {
    id: 'contested_shots_3pt',
    column: 'contested_shots_3_pt',
    label: 'Contested threes',
    short: 'Contests 3PT',
    description: 'Three-point shots the defense challenged.',
    side: 'defense'
  },
  {
    id: 'deflections',
    column: 'deflections',
    label: 'Deflections',
    short: 'Defl',
    description: "Times the defense got a hand to the other team's ball. Not every one is a steal.",
    side: 'defense'
  },
  {
    id: 'charges_drawn',
    column: 'charges_drawn',
    label: 'Charges drawn',
    short: 'Charges',
    description: 'Offensive charging fouls drawn. Not every offensive foul is a charge.',
    side: 'defense'
  },
  {
    id: 'screen_assists',
    column: 'screen_assists',
    label: 'Screen assists',
    short: 'Screen AST',
    description: 'Screens that led straight to a teammate’s made field goal.',
    side: 'offense'
  },
  {
    id: 'screen_ast_pts',
    column: 'screen_ast_pts',
    label: 'Screen-assist points',
    short: 'Screen PTS',
    description: 'Points from the field goals that screen assists led to.',
    side: 'offense'
  },
  {
    id: 'loose_balls',
    column: 'loose_balls_recovered',
    label: 'Loose balls recovered',
    short: 'Loose Balls',
    description: 'Loose balls recovered, at either end.',
    side: 'defense'
  },
  {
    id: 'off_loose_balls',
    column: 'off_loose_balls_recovered',
    label: 'Offensive loose balls recovered',
    short: 'Off Loose',
    description: 'Loose balls recovered while on offense.',
    side: 'offense'
  },
  {
    id: 'def_loose_balls',
    column: 'def_loose_balls_recovered',
    label: 'Defensive loose balls recovered',
    short: 'Def Loose',
    description: 'Loose balls recovered while on defense.',
    side: 'defense'
  },
  {
    id: 'box_outs',
    column: 'box_outs',
    label: 'Box outs',
    short: 'Box Outs',
    description: 'Times a rebounding position was held against an opponent, at either end.',
    side: 'defense',
    firstSeason: BOX_OUTS
  },
  {
    id: 'off_box_outs',
    column: 'off_boxouts',
    label: 'Offensive box outs',
    short: 'Off Box Outs',
    description: 'Box outs on the offensive glass.',
    side: 'offense',
    firstSeason: BOX_OUTS
  },
  {
    id: 'def_box_outs',
    column: 'def_boxouts',
    label: 'Defensive box outs',
    short: 'Def Box Outs',
    description: 'Box outs on the defensive glass.',
    side: 'defense',
    firstSeason: BOX_OUTS
  }
]

const PLAYER_COUNTS: MetricDef[] = COUNTS.map((h) =>
  metric(
    h.id,
    h.label,
    h.short,
    h.description,
    count(PLAYER, h.column, { firstSeason: h.firstSeason ?? FIRST, direction: h.direction })
  )
)

/** A team's counts are totals and per 48 minutes: the team file publishes no games. */
const TEAM_COUNTS: MetricDef[] = COUNTS.map((h) =>
  metric(
    `team_${h.id}`,
    h.label,
    h.short,
    `${h.description} For the team, in totals or per 48 minutes: the team file publishes no games.`,
    count(TEAM, h.column, {
      entity: 'team',
      side: h.side,
      firstSeason: h.firstSeason ?? FIRST,
      direction: h.direction
    })
  )
)

/** Which end a loose ball or a box out came at: a split of the player's or team's own. */
function shares(table: string, entity: 'player' | 'team'): MetricDef[] {
  const id = (s: string): string => (entity === 'team' ? `team_${s}` : s)
  const team = entity === 'team' ? { entity, side: 'offense' as const } : {}
  const whose = entity === 'team' ? "the team's" : 'their'
  return [
    metric(
      id('off_loose_balls_pct'),
      'Offensive share of loose balls',
      'Off Loose%',
      `The share of ${whose} loose-ball recoveries made on offense.`,
      share(table, 'off_loose_balls_recovered', 'loose_balls_recovered', {
        minSample: entity === 'team' ? undefined : 20,
        ...team
      })
    ),
    metric(
      id('off_box_outs_pct'),
      'Offensive share of box outs',
      'Off Box Out%',
      `The share of ${whose} box outs made on the offensive glass.`,
      share(table, 'off_boxouts', 'box_outs', {
        minSample: entity === 'team' ? undefined : 50,
        firstSeason: BOX_OUTS,
        ...team
      })
    )
  ]
}

const WEIGHTED =
  'Over more than one season, the published values are weighted by box outs: before 2024-25 the NBA does not always publish what they divide by.'

const PLAYER_BOX_OUT_REBOUNDS: MetricDef[] = [
  metric(
    'box_out_team_rebs',
    'Box outs leading to a team rebound',
    'BO Team REB',
    "The player's box outs on which their team took the rebound.",
    count(PLAYER, 'box_out_player_team_rebs', { firstSeason: BOX_OUTS })
  ),
  metric(
    'box_out_rebs',
    'Box outs leading to their own rebound',
    'BO REB',
    "The player's box outs on which they took the rebound themselves.",
    count(PLAYER, 'box_out_player_rebs', { firstSeason: BOX_OUTS })
  ),
  metric(
    'box_out_team_reb_pct',
    'Team rebound rate after box outs',
    'BO Team REB%',
    `The share of the player's box outs that ended in a team rebound, as the NBA publishes it. ${WEIGHTED}`,
    {
      ...share(PLAYER, 'pct_box_outs_team_reb', 'box_outs', {
        minSample: 50,
        firstSeason: BOX_OUTS
      }),
      direction: 'higher'
    }
  ),
  metric(
    'box_out_reb_pct',
    'Own rebound rate after box outs',
    'BO REB%',
    `The share of the player's box outs that ended in their own rebound, as the NBA publishes it. Not a rebound percentage. ${WEIGHTED}`,
    share(PLAYER, 'pct_box_outs_reb', 'box_outs', { minSample: 50, firstSeason: BOX_OUTS })
  )
]

export const HUSTLE: MetricDef[] = [
  ...PLAYER_COUNTS,
  ...shares(PLAYER, 'player'),
  ...PLAYER_BOX_OUT_REBOUNDS,
  ...TEAM_COUNTS,
  ...shares(TEAM, 'team')
]
