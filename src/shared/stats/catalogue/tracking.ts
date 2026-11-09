import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * Reference section 8: the NBA's optical tracking, players only, from 2013-14. Season totals with no
 * game behind them, so they answer whole seasons only, over the games and minutes tracking counted.
 *
 * A rate the files publish with its parts is rebuilt from them, so seasons together are exact. One
 * published without them (speed, seconds and dribbles per touch, rebound distance, the efficiency
 * file's percentages) is stored times what it was measured over (`derived/publishedTables.ts`).
 */
const SOURCES = ["The NBA's player tracking"]
const FIRST = 2014

const WEIGHTED_MINUTES =
  'Over more than one season, the published values are weighted by minutes, since the NBA does not publish their parts.'

const base = (table: string): Partial<Opts> => ({
  family: 'tracking',
  entity: 'player',
  sources: SOURCES,
  firstSeason: FIRST,
  published: `pub_player_${table}`
})

/** A tracked count: summed, and per game over the games tracking counted. */
const count = (table: string, column: string, o: Partial<Opts> = {}): Opts => ({
  ...base(table),
  value: `{${column}}`,
  sample: 'games',
  kind: 'recorded',
  aggregation: 'sum',
  unit: 'count',
  decimals: 0,
  ...o
})

/** A share of two tracked counts, read as a fraction. */
const pct = (
  table: string,
  a: string,
  b: string,
  minSample: number,
  o: Partial<Opts> = {}
): Opts => ({
  ...base(table),
  value: ratio(a, b),
  sample: b,
  unit: 'pct',
  minSample,
  ...o
})

/** A published rate stored times what it was measured over: read back over it. */
const weighted = (
  table: string,
  column: string,
  by: string,
  minSample: number,
  o: Partial<Opts> = {}
): Opts => ({
  ...base(table),
  value: ratio(column, by),
  sample: by,
  unit: 'number',
  minSample,
  ...o
})

/** Effective field-goal percentage from a file's makes, threes made and attempts. */
const efg = (table: string, p: string): Opts => ({
  ...pct(table, `${p}_fgm`, `${p}_fga`, 100),
  value: `({${p}_fgm} + 0.5 * {${p}_fg3_m}) / nullif({${p}_fga}, 0)`
})

const SPEED: MetricDef[] = [
  metric(
    'dist_miles',
    'Distance run',
    'Dist',
    'Miles the player covered on the floor, as tracked.',
    count('speed', 'dist_miles', { unit: 'number', decimals: 2, direction: 'neutral' })
  ),
  metric(
    'dist_miles_off',
    'Distance run on offense',
    'Dist Off',
    'Miles covered while their team had the ball.',
    count('speed', 'dist_miles_off', { unit: 'number', decimals: 2, direction: 'neutral' })
  ),
  metric(
    'dist_miles_def',
    'Distance run on defense',
    'Dist Def',
    'Miles covered while the other team had the ball.',
    count('speed', 'dist_miles_def', { unit: 'number', decimals: 2, direction: 'neutral' })
  ),
  ...(
    [
      ['avg_speed', 'Average speed', 'Speed', 'on the floor'],
      ['avg_speed_off', 'Average speed on offense', 'Speed Off', 'while their team had the ball'],
      ['avg_speed_def', 'Average speed on defense', 'Speed Def', 'while the other team had it']
    ] as const
  ).map(([c, label, short, when]) =>
    metric(
      c,
      label,
      short,
      `Miles per hour ${when}, as tracked. ${WEIGHTED_MINUTES}`,
      weighted('speed', c, 'minutes', 1000, { decimals: 2, direction: 'neutral' })
    )
  )
]

const TOUCHES: MetricDef[] = [
  metric(
    'touches',
    'Touches',
    'Touches',
    'Times the player had the ball. One possession can hold several.',
    count('touches', 'touches', { direction: 'neutral' })
  ),
  metric(
    'front_ct_touches',
    'Frontcourt touches',
    'FC Touches',
    'Touches in the half the team attacks.',
    count('touches', 'front_ct_touches', { direction: 'neutral' })
  ),
  metric(
    'time_of_poss',
    'Time of possession',
    'Time Poss',
    'Minutes the player held the ball, as tracked.',
    count('touches', 'time_of_poss', { unit: 'minutes', decimals: 1, direction: 'neutral' })
  ),
  metric(
    'sec_per_touch',
    'Seconds per touch',
    'Sec/Touch',
    'Average seconds the player held the ball on a touch, as published. Over more than one season, weighted by touches.',
    weighted('touches', 'avg_sec_per_touch', 'touches', 500, { decimals: 2, direction: 'neutral' })
  ),
  metric(
    'drib_per_touch',
    'Dribbles per touch',
    'Drib/Touch',
    'Average dribbles on a touch, as published. Over more than one season, weighted by touches.',
    weighted('touches', 'avg_drib_per_touch', 'touches', 500, {
      decimals: 2,
      direction: 'neutral'
    })
  ),
  metric(
    'pts_per_touch',
    'Points per touch',
    'PTS/Touch',
    'Points scored per touch: a measure of workload, not points per possession.',
    weighted('touches', 'points', 'touches', 500, { decimals: 3 })
  )
]

const DRIVES: MetricDef[] = [
  metric(
    'drives',
    'Drives',
    'Drives',
    'Dribbles toward the basket from 20 feet or more out to within 10 feet, fast breaks excluded.',
    count('drives', 'drives')
  ),
  metric(
    'drive_fgm',
    'Drive field goals made',
    'Drive FGM',
    'Field goals made on drives.',
    count('drives', 'drive_fgm')
  ),
  metric(
    'drive_fga',
    'Drive field-goal attempts',
    'Drive FGA',
    'Field-goal attempts on drives.',
    count('drives', 'drive_fga', { direction: 'neutral' })
  ),
  metric(
    'drive_fg_pct',
    'Drive field-goal percentage',
    'Drive FG%',
    'Field goals made per attempt on drives.',
    pct('drives', 'drive_fgm', 'drive_fga', 100)
  ),
  metric(
    'drive_ftm',
    'Drive free throws made',
    'Drive FTM',
    'Free throws made from drives.',
    count('drives', 'drive_ftm')
  ),
  metric(
    'drive_fta',
    'Drive free-throw attempts',
    'Drive FTA',
    'Free-throw attempts from drives.',
    count('drives', 'drive_fta')
  ),
  metric(
    'drive_ft_pct',
    'Drive free-throw percentage',
    'Drive FT%',
    'Free throws made per attempt from drives.',
    pct('drives', 'drive_ftm', 'drive_fta', 50)
  ),
  metric(
    'drive_pts',
    'Drive points',
    'Drive PTS',
    'Points the player scored on drives, free throws included.',
    count('drives', 'drive_pts')
  ),
  metric(
    'drive_pts_per_drive',
    'Points per drive',
    'PTS/Drive',
    "The player's own points per drive. The NBA shows it as a percentage; it can pass 100.",
    weighted('drives', 'drive_pts', 'drives', 200, { decimals: 2 })
  ),
  ...(
    [
      ['passes', 'Drive passes', 'Drive Pass', 'Passes out of drives.', 'Drive Pass%', 'neutral'],
      ['ast', 'Drive assists', 'Drive AST', 'Assists out of drives.', 'Drive AST%', 'higher'],
      ['tov', 'Drive turnovers', 'Drive TOV', 'Turnovers on drives.', 'Drive TOV%', 'lower'],
      ['pf', 'Drive fouls drawn', 'Drive PF', 'Fouls drawn on drives.', 'Drive PF%', 'higher']
    ] as const
  ).flatMap(([c, label, short, description, pctShort, direction]) => [
    metric(`drive_${c}`, label, short, description, count('drives', `drive_${c}`, { direction })),
    metric(
      `drive_${c}_pct`,
      `${label} per drive`,
      pctShort,
      `${description.slice(0, -1)}, per drive.`,
      pct('drives', `drive_${c}`, 'drives', 200, { direction })
    )
  ])
]

const PASSING: MetricDef[] = [
  metric(
    'passes_made',
    'Passes made',
    'Passes',
    'Passes the player made, as tracked.',
    count('passing', 'passes_made', { direction: 'neutral' })
  ),
  metric(
    'passes_received',
    'Passes received',
    'Pass Rec',
    'Passes the player received, as tracked.',
    count('passing', 'passes_received', { direction: 'neutral' })
  ),
  metric(
    'potential_ast',
    'Potential assists',
    'Pot AST',
    'Passes that led to a shot, made or missed, within the tracking rules.',
    count('passing', 'potential_ast')
  ),
  metric(
    'secondary_ast',
    'Secondary assists',
    '2nd AST',
    'Passes to the teammate who then made the assist.',
    count('passing', 'secondary_ast')
  ),
  metric(
    'ft_ast',
    'Free-throw assists',
    'FT AST',
    'Passes to a teammate who was then fouled shooting and made a free throw. Not an official assist.',
    count('passing', 'ft_ast')
  ),
  metric(
    'ast_pts_created',
    'Assist points created',
    'AST PTS',
    'Points scored from the player’s assists, as tracking credits them.',
    count('passing', 'ast_pts_created')
  ),
  metric(
    'ast_adj',
    'Adjusted assists',
    'Adj AST',
    'Assists, secondary assists and free-throw assists together, as the NBA publishes them. On many seasons the parts do not add up to it exactly.',
    count('passing', 'ast_adj')
  ),
  metric(
    'ast_per_pass',
    'Assists per pass',
    'AST/Pass',
    'Tracked assists per pass made.',
    pct('passing', 'ast', 'passes_made', 500)
  ),
  metric(
    'ast_adj_per_pass',
    'Adjusted assists per pass',
    'Adj AST/Pass',
    'Adjusted assists per pass made.',
    pct('passing', 'ast_adj', 'passes_made', 500)
  ),
  metric(
    'potential_ast_conv',
    'Potential assists converted',
    'Pot AST Conv',
    'Tracked assists per potential assist: how often a pass that led to a shot became an assist. Worked out here, not published.',
    pct('passing', 'ast', 'potential_ast', 100)
  )
]

const REBOUNDS = [
  ['reb', 'Rebound', 'REB', ''],
  ['oreb', 'Offensive rebound', 'OREB', 'offensive '],
  ['dreb', 'Defensive rebound', 'DREB', 'defensive ']
] as const

const REBOUNDING: MetricDef[] = REBOUNDS.flatMap(([r, label, short, kind]) => [
  metric(
    `${r}_contest`,
    `Contested ${kind}rebounds`,
    `C ${short}`,
    `${kind ? `${label}s` : 'Rebounds'} taken with an opponent close by, as tracked.`,
    count('rebounding', `${r}_contest`)
  ),
  metric(
    `${r}_uncontest`,
    `Uncontested ${kind}rebounds`,
    `UC ${short}`,
    `${kind ? `${label}s` : 'Rebounds'} taken with no opponent close by, as tracked.`,
    count('rebounding', `${r}_uncontest`, { direction: 'neutral' })
  ),
  metric(
    `${r}_chances`,
    `${label} chances`,
    `${short} Chances`,
    `Times the player was close enough to a missed shot to take the ${kind}rebound. Several players can have a chance on one miss.`,
    count('rebounding', `${r}_chances`)
  ),
  metric(
    `${r}_chance_defer`,
    `Deferred ${kind}rebound chances`,
    `${short} Defer`,
    `Chances the player left to a teammate.`,
    count('rebounding', `${r}_chance_defer`, { direction: 'neutral' })
  ),
  metric(
    `${r}_contest_pct`,
    `Contested ${kind}rebound share`,
    `C ${short}%`,
    `The share of the player's ${kind}rebounds that were contested.`,
    pct('rebounding', `${r}_contest`, r, 100, { direction: 'neutral' })
  ),
  metric(
    `${r}_chance_pct`,
    `${label} chance percentage`,
    `${short} Chance%`,
    `${label}s taken per chance.`,
    pct('rebounding', r, `${r}_chances`, 200)
  ),
  metric(
    `${r}_chance_pct_adj`,
    `Adjusted ${kind}rebound chance percentage`,
    `Adj ${short} Ch%`,
    `${label}s taken per chance, leaving out the chances deferred to a teammate.`,
    {
      ...pct('rebounding', r, `${r}_chances`, 200),
      value: `{${r}} / nullif({${r}_chances} - {${r}_chance_defer}, 0)`
    }
  ),
  metric(
    `avg_${r}_dist`,
    `Average ${kind}rebound distance`,
    `${short} Dist`,
    `Feet from the basket where the player took their ${kind}rebounds, on average. Over more than one season, weighted by rebounds.`,
    weighted('rebounding', `avg_${r}_dist`, r, 100, { direction: 'neutral' })
  )
])

/** Catch-and-shoot and pull-up shooting share their columns. */
const SHOT_TYPES = [
  ['catch_shoot', 'Catch-and-shoot', 'C&S', 'shots taken straight off a catch, with no dribble'],
  ['pull_up', 'Pull-up', 'PU', 'shots taken off the dribble']
] as const

const SHOOTING: MetricDef[] = SHOT_TYPES.flatMap(([p, label, short, what]) => {
  const table = p
  return [
    metric(
      `${p}_fgm`,
      `${label} field goals made`,
      `${short} FGM`,
      `Field goals made on ${what}.`,
      count(table, `${p}_fgm`)
    ),
    metric(
      `${p}_fga`,
      `${label} field-goal attempts`,
      `${short} FGA`,
      `Field-goal attempts on ${what}.`,
      count(table, `${p}_fga`, { direction: 'neutral' })
    ),
    metric(
      `${p}_fg_pct`,
      `${label} field-goal percentage`,
      `${short} FG%`,
      `Field goals made per attempt on ${what}.`,
      pct(table, `${p}_fgm`, `${p}_fga`, 100)
    ),
    metric(
      `${p}_fg3m`,
      `${label} threes made`,
      `${short} 3PM`,
      `Threes made on ${what}.`,
      count(table, `${p}_fg3_m`)
    ),
    metric(
      `${p}_fg3a`,
      `${label} three-point attempts`,
      `${short} 3PA`,
      `Three-point attempts on ${what}.`,
      count(table, `${p}_fg3_a`, { direction: 'neutral' })
    ),
    metric(
      `${p}_fg3_pct`,
      `${label} three-point percentage`,
      `${short} 3P%`,
      `Threes made per attempt on ${what}.`,
      pct(table, `${p}_fg3_m`, `${p}_fg3_a`, 50)
    ),
    metric(
      `${p}_efg_pct`,
      `${label} effective field-goal percentage`,
      `${short} eFG%`,
      `Field-goal percentage on ${what}, with a three counted as one and a half makes.`,
      efg(table, p)
    ),
    metric(
      `${p}_pts`,
      `${label} points`,
      `${short} PTS`,
      `Points scored on ${what}.`,
      count(table, `${p}_pts`)
    )
  ]
})

const AREAS = [
  ['elbow', 'Elbow', 'Elbow', 'at the elbows, the corners of the free-throw line'],
  ['post', 'Post', 'Post', 'in the post, with their back to the basket near it'],
  ['paint', 'Paint', 'Paint', 'in the paint, not in the post']
] as const

/**
 * The touch areas. Measured on every season: each rate divides by the area's touches, except the
 * elbow's assist rate, which divides by its passes.
 */
const TOUCH_AREAS: MetricDef[] = AREAS.flatMap(([a, label, short, where]) => {
  const table = `${a}_touch`
  const t = `${a}_touches`
  const c = (x: string): string => `${a}_touch_${x}`
  const astBy = a === 'elbow' ? c('passes') : t
  return [
    metric(
      t,
      `${label} touches`,
      `${short} Touch`,
      `Touches that started ${where}.`,
      count(table, t, { direction: 'neutral' })
    ),
    metric(
      c('fgm'),
      `${label} touch field goals made`,
      `${short} FGM`,
      `Field goals made after a touch ${where}.`,
      count(table, c('fgm'))
    ),
    metric(
      c('fga'),
      `${label} touch field-goal attempts`,
      `${short} FGA`,
      `Field-goal attempts after a touch ${where}.`,
      count(table, c('fga'), { direction: 'neutral' })
    ),
    metric(
      c('fg_pct'),
      `${label} touch field-goal percentage`,
      `${short} FG%`,
      `Field goals made per attempt after a touch ${where}.`,
      pct(table, c('fgm'), c('fga'), 25)
    ),
    metric(
      c('ftm'),
      `${label} touch free throws made`,
      `${short} FTM`,
      `Free throws made after a touch ${where}.`,
      count(table, c('ftm'))
    ),
    metric(
      c('fta'),
      `${label} touch free-throw attempts`,
      `${short} FTA`,
      `Free-throw attempts after a touch ${where}.`,
      count(table, c('fta'))
    ),
    metric(
      c('ft_pct'),
      `${label} touch free-throw percentage`,
      `${short} FT%`,
      `Free throws made per attempt after a touch ${where}.`,
      pct(table, c('ftm'), c('fta'), 25)
    ),
    metric(
      c('pts'),
      `${label} touch points`,
      `${short} PTS`,
      `Points the player scored after a touch ${where}.`,
      count(table, c('pts'))
    ),
    metric(
      c('pts_per_touch'),
      `Points per ${a} touch`,
      `PTS/${short}`,
      `Points the player scored per touch ${where}.`,
      weighted(table, c('pts'), t, 50, { decimals: 3 })
    ),
    metric(
      c('passes'),
      `${label} touch passes`,
      `${short} Pass`,
      `Passes after a touch ${where}.`,
      count(table, c('passes'), { direction: 'neutral' })
    ),
    metric(
      c('pass_pct'),
      `${label} touch pass rate`,
      `${short} Pass%`,
      `Passes per touch ${where}.`,
      pct(table, c('passes'), t, 50, { direction: 'neutral' })
    ),
    metric(
      c('ast'),
      `${label} touch assists`,
      `${short} AST`,
      `Assists after a touch ${where}.`,
      count(table, c('ast'))
    ),
    metric(
      c('ast_pct'),
      `${label} touch assist rate`,
      `${short} AST%`,
      a === 'elbow'
        ? `Assists per pass after a touch ${where}. The NBA divides by passes here, and by touches in the post and the paint.`
        : `Assists per touch ${where}.`,
      pct(table, c('ast'), astBy, 50)
    ),
    metric(
      c('tov'),
      `${label} touch turnovers`,
      `${short} TOV`,
      `Turnovers after a touch ${where}.`,
      count(table, c('tov'), { direction: 'lower' })
    ),
    metric(
      c('tov_pct'),
      `${label} touch turnover rate`,
      `${short} TOV%`,
      `Turnovers per touch ${where}.`,
      pct(table, c('tov'), t, 50, { direction: 'lower' })
    ),
    metric(
      c('fouls'),
      `${label} touch fouls drawn`,
      `${short} PF`,
      `Fouls drawn after a touch ${where}.`,
      count(table, c('fouls'))
    ),
    metric(
      c('foul_pct'),
      `${label} touch foul rate`,
      `${short} PF%`,
      `Fouls drawn per touch ${where}.`,
      pct(table, c('fouls'), t, 50)
    )
  ]
})

const EFFICIENCY = 'tracking_efficiency'

const lower = (s: string): string => s[0].toLowerCase() + s.slice(1)

/** The efficiency file, where it differs from the catch-and-shoot and pull-up files. */
const TRACKING_EFFICIENCY: MetricDef[] = [
  ...SHOT_TYPES.flatMap(([p, label, short]) => [
    metric(
      `eff_${p}_pts`,
      `${label} points (efficiency dashboard)`,
      `${short} PTS Eff`,
      `${label} points as the NBA's tracking efficiency dashboard publishes them. They differ from the ${lower(label)} dashboard's on a third to a half of players.`,
      count(EFFICIENCY, `${p}_pts`)
    ),
    metric(
      `eff_${p}_fg_pct`,
      `${label} FG% (efficiency dashboard)`,
      `${short} FG% Eff`,
      `${label} field-goal percentage as the efficiency dashboard publishes it, without its makes and attempts. ${WEIGHTED_MINUTES}`,
      weighted(EFFICIENCY, `${p}_fg_pct`, 'minutes', 1000, { unit: 'pct', kind: 'derived' })
    )
  ]),
  metric(
    'eff_efg_pct',
    'Effective field-goal percentage (tracking)',
    'eFG% Trk',
    `The player's effective field-goal percentage on the tracking efficiency dashboard. ${WEIGHTED_MINUTES}`,
    weighted(EFFICIENCY, 'eff_fg_pct', 'minutes', 1000, { unit: 'pct' })
  )
]

const RIM_DEFENSE: MetricDef[] = [
  metric(
    'def_rim_fgm',
    'Rim field goals allowed',
    'DFGM Rim',
    'Shots made at the rim while the player defended it, as tracked.',
    count('rim_defense', 'def_rim_fgm', { direction: 'lower' })
  ),
  metric(
    'def_rim_fga',
    'Rim attempts defended',
    'DFGA Rim',
    'Shots at the rim while the player defended it, as tracked.',
    count('rim_defense', 'def_rim_fga', { direction: 'neutral' })
  ),
  metric(
    'def_rim_fg_pct',
    'Rim field-goal percentage allowed',
    'DFG% Rim',
    'Shots made per attempt at the rim while the player defended it.',
    pct('rim_defense', 'def_rim_fgm', 'def_rim_fga', 100, { direction: 'lower' })
  )
]

/** The tracking family's column preset on the leaderboards: one or two from each file. */
const CORE = new Set([
  'dist_miles',
  'avg_speed',
  'touches',
  'time_of_poss',
  'drives',
  'drive_fg_pct',
  'potential_ast',
  'ast_pts_created',
  'catch_shoot_efg_pct',
  'pull_up_efg_pct',
  'reb_chance_pct',
  'def_rim_fg_pct'
])

export const TRACKING: MetricDef[] = [
  ...SPEED,
  ...TOUCHES,
  ...DRIVES,
  ...PASSING,
  ...REBOUNDING,
  ...SHOOTING,
  ...TOUCH_AREAS,
  ...TRACKING_EFFICIENCY,
  ...RIM_DEFENSE
].map((m) => (CORE.has(m.id) ? { ...m, tier: 'core' } : m))
