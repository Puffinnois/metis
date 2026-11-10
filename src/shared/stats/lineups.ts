/**
 * The columns of the NBA's published five-man lineup tables, as the team dashboard's Lineups tab shows
 * them. Both the builder (main) and the tab (renderer) read this list, so a column is named once.
 *
 * Each group is one of the NBA's dashboards (`lineups_base` and the rest), and every column of a group
 * is read from that dashboard alone. The dashboards also publish a rank beside every measure and
 * percentages that are a count over a count; neither is stored. The percentages are worked out on read
 * from their parts, which agree with the published ones to the printed digits.
 */

export const LINEUP_GROUPS = [
  { id: 'base', label: 'Base' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'fourfactors', label: 'Four factors' },
  { id: 'misc', label: 'Misc' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'opponent', label: 'Opponent' }
] as const

export type LineupGroup = (typeof LINEUP_GROUPS)[number]['id']

/** Five-man units are published from the 2007-08 season (label 2008). */
export const LINEUPS_FIRST_SEASON = 2008

/** Why a scope the NBA has no lineups for cannot be answered. */
export const LINEUPS_WHOLE_SEASONS = 'Published for whole seasons only.'

export interface LineupColumn {
  /** The stored column's name, and the key of its value in a read. */
  id: string
  group: LineupGroup
  /** The column in the dashboard; null for a percentage worked out from `of`. */
  source: string | null
  label: string
  title: string
  /**
   * `sum` is a count the modes rescale (per game, per 36 or 48 minutes, per 100 possessions); `value`
   * is read as published whatever the mode.
   */
  kind: 'sum' | 'value'
  unit: 'count' | 'number' | 'pct'
  decimals: number
  /** A percentage worked out as the first over the second; `games` is the unit's games. */
  of?: readonly [string, string]
}

type Row = readonly [
  source: string,
  label: string,
  title: string,
  unit?: LineupColumn['unit'],
  decimals?: number,
  kind?: LineupColumn['kind']
]

const PREFIX: Record<LineupGroup, string> = {
  base: '',
  advanced: 'adv_',
  fourfactors: 'ff_',
  misc: 'misc_',
  scoring: 'sc_',
  opponent: ''
}

/** The one stored name that would repeat another group's: the opponent file's own +/-. */
const RENAMED: Record<string, string> = { 'opponent:plus_minus': 'opp_plus_minus' }

function read(group: LineupGroup, rows: Row[], kindOfGroup: LineupColumn['kind']): LineupColumn[] {
  return rows.map(([source, label, title, unit = 'count', decimals = 0, kind = kindOfGroup]) => ({
    id: RENAMED[`${group}:${source}`] ?? `${PREFIX[group]}${source}`,
    group,
    source,
    label,
    title,
    kind,
    unit,
    decimals
  }))
}

function pct(
  id: string,
  group: LineupGroup,
  label: string,
  title: string,
  a: string,
  b: string
): LineupColumn {
  return {
    id,
    group,
    source: null,
    label,
    title,
    kind: 'value',
    unit: 'pct',
    decimals: 1,
    of: [a, b]
  }
}

const BASE = read(
  'base',
  [
    ['w', 'W', 'Wins', 'count', 0, 'value'],
    ['l', 'L', 'Losses', 'count', 0, 'value'],
    ['fgm', 'FGM', 'Field goals made'],
    ['fga', 'FGA', 'Field goals attempted'],
    ['fg3_m', '3PM', 'Three-pointers made'],
    ['fg3_a', '3PA', 'Three-pointers attempted'],
    ['ftm', 'FTM', 'Free throws made'],
    ['fta', 'FTA', 'Free throws attempted'],
    ['oreb', 'OREB', 'Offensive rebounds'],
    ['dreb', 'DREB', 'Defensive rebounds'],
    ['reb', 'REB', 'Rebounds'],
    ['ast', 'AST', 'Assists'],
    ['tov', 'TOV', 'Turnovers'],
    ['stl', 'STL', 'Steals'],
    ['blk', 'BLK', 'Blocks'],
    ['blka', 'BLKA', 'Shots of the unit blocked'],
    ['pf', 'PF', 'Personal fouls'],
    ['pfd', 'PFD', 'Fouls drawn'],
    ['pts', 'PTS', 'Points'],
    ['plus_minus', '+/-', 'Plus-minus']
  ],
  'sum'
).map((c) =>
  c.source === 'fg3_m' ? { ...c, id: 'fg3m' } : c.source === 'fg3_a' ? { ...c, id: 'fg3a' } : c
)

const ADVANCED = read(
  'advanced',
  [
    ['off_rating', 'OFF', 'Points scored per 100 possessions', 'number', 1],
    ['def_rating', 'DEF', 'Points allowed per 100 possessions', 'number', 1],
    ['net_rating', 'NET', 'Offensive rating minus defensive rating', 'number', 1],
    ['e_off_rating', 'E-OFF', 'The NBA’s estimated offensive rating', 'number', 1],
    ['e_def_rating', 'E-DEF', 'The NBA’s estimated defensive rating', 'number', 1],
    ['e_net_rating', 'E-NET', 'The NBA’s estimated net rating', 'number', 1],
    ['ast_pct', 'AST%', 'Share of made field goals assisted', 'pct', 1],
    ['ast_to', 'AST/TO', 'Assists per turnover', 'number', 2],
    ['ast_ratio', 'AST RATIO', 'Assists per 100 possessions', 'number', 1],
    ['oreb_pct', 'OREB%', 'Share of available offensive rebounds taken', 'pct', 1],
    ['dreb_pct', 'DREB%', 'Share of available defensive rebounds taken', 'pct', 1],
    ['reb_pct', 'REB%', 'Share of available rebounds taken', 'pct', 1],
    ['tm_tov_pct', 'TOV%', 'Turnovers per 100 plays', 'pct', 1],
    ['efg_pct', 'eFG%', 'Effective field goal percentage', 'pct', 1],
    ['ts_pct', 'TS%', 'True shooting percentage', 'pct', 1],
    ['pace', 'PACE', 'Possessions per 48 minutes', 'number', 1],
    ['e_pace', 'E-PACE', 'The NBA’s estimated pace', 'number', 1],
    ['pace_per40', 'PACE/40', 'Possessions per 40 minutes', 'number', 1],
    ['pie', 'PIE', 'Player impact estimate: the unit’s share of what both teams did', 'pct', 1]
  ],
  'value'
)

const FOUR_FACTORS = read(
  'fourfactors',
  [
    ['efg_pct', 'eFG%', 'Effective field goal percentage', 'pct', 1],
    ['fta_rate', 'FTA RATE', 'Free throws attempted per field goal attempted', 'number', 3],
    ['tm_tov_pct', 'TOV%', 'Turnovers per 100 plays', 'pct', 1],
    ['oreb_pct', 'OREB%', 'Share of available offensive rebounds taken', 'pct', 1],
    ['opp_efg_pct', 'OPP eFG%', 'Opponent effective field goal percentage', 'pct', 1],
    ['opp_fta_rate', 'OPP FTA RATE', 'Opponent free throws attempted per field goal', 'number', 3],
    ['opp_tov_pct', 'OPP TOV%', 'Opponent turnovers per 100 plays', 'pct', 1],
    [
      'opp_oreb_pct',
      'OPP OREB%',
      'Share of available offensive rebounds the opponent took',
      'pct',
      1
    ]
  ],
  'value'
)

const MISC = read(
  'misc',
  [
    ['pts_off_tov', 'PTS OFF TOV', 'Points scored off turnovers'],
    ['pts_2_nd_chance', '2ND CHANCE', 'Second-chance points'],
    ['pts_fb', 'FAST BREAK', 'Fast-break points'],
    ['pts_paint', 'IN PAINT', 'Points in the paint'],
    ['opp_pts_off_tov', 'OPP PTS OFF TOV', 'Opponent points off turnovers'],
    ['opp_pts_2_nd_chance', 'OPP 2ND CHANCE', 'Opponent second-chance points'],
    ['opp_pts_fb', 'OPP FAST BREAK', 'Opponent fast-break points'],
    ['opp_pts_paint', 'OPP IN PAINT', 'Opponent points in the paint']
  ],
  'sum'
)

const SCORING = read(
  'scoring',
  [
    ['pct_fga_2_pt', '2PT FGA%', 'Share of shots that are two-pointers', 'pct', 1],
    ['pct_fga_3_pt', '3PT FGA%', 'Share of shots that are three-pointers', 'pct', 1],
    ['pct_pts_2_pt', '2PT PTS%', 'Share of points from two-pointers', 'pct', 1],
    ['pct_pts_2_pt_mr', 'MID PTS%', 'Share of points from mid-range two-pointers', 'pct', 1],
    ['pct_pts_3_pt', '3PT PTS%', 'Share of points from three-pointers', 'pct', 1],
    ['pct_pts_fb', 'FB PTS%', 'Share of points on the fast break', 'pct', 1],
    ['pct_pts_ft', 'FT PTS%', 'Share of points from free throws', 'pct', 1],
    ['pct_pts_off_tov', 'TOV PTS%', 'Share of points off turnovers', 'pct', 1],
    ['pct_pts_paint', 'PAINT PTS%', 'Share of points in the paint', 'pct', 1],
    ['pct_ast_2_pm', '2PM AST%', 'Share of made two-pointers assisted', 'pct', 1],
    ['pct_uast_2_pm', '2PM UAST%', 'Share of made two-pointers unassisted', 'pct', 1],
    ['pct_ast_3_pm', '3PM AST%', 'Share of made three-pointers assisted', 'pct', 1],
    ['pct_uast_3_pm', '3PM UAST%', 'Share of made three-pointers unassisted', 'pct', 1],
    ['pct_ast_fgm', 'FGM AST%', 'Share of made field goals assisted', 'pct', 1],
    ['pct_uast_fgm', 'FGM UAST%', 'Share of made field goals unassisted', 'pct', 1]
  ],
  'value'
)

const OPPONENT = read(
  'opponent',
  [
    ['opp_fgm', 'OPP FGM', 'Opponent field goals made'],
    ['opp_fga', 'OPP FGA', 'Opponent field goals attempted'],
    ['opp_fg3_m', 'OPP 3PM', 'Opponent three-pointers made'],
    ['opp_fg3_a', 'OPP 3PA', 'Opponent three-pointers attempted'],
    ['opp_ftm', 'OPP FTM', 'Opponent free throws made'],
    ['opp_fta', 'OPP FTA', 'Opponent free throws attempted'],
    ['opp_oreb', 'OPP OREB', 'Opponent offensive rebounds'],
    ['opp_dreb', 'OPP DREB', 'Opponent defensive rebounds'],
    ['opp_reb', 'OPP REB', 'Opponent rebounds'],
    ['opp_ast', 'OPP AST', 'Opponent assists'],
    ['opp_tov', 'OPP TOV', 'Opponent turnovers'],
    ['opp_stl', 'OPP STL', 'Opponent steals'],
    ['opp_blk', 'OPP BLK', 'Opponent blocks'],
    ['opp_blka', 'OPP BLKA', 'Opponent shots blocked'],
    ['opp_pf', 'OPP PF', 'Opponent personal fouls'],
    ['opp_pfd', 'OPP PFD', 'Opponent fouls drawn'],
    ['opp_pts', 'OPP PTS', 'Opponent points'],
    ['plus_minus', 'OPP +/-', 'Plus-minus as the opponent file prints it']
  ],
  'sum'
).map((c) =>
  c.source === 'opp_fg3_m'
    ? { ...c, id: 'opp_fg3m' }
    : c.source === 'opp_fg3_a'
      ? { ...c, id: 'opp_fg3a' }
      : c
)

/** Stored columns by group, then the percentages worked out beside the counts they divide. */
const WORKED_OUT: LineupColumn[] = [
  pct('w_pct', 'base', 'W%', 'Win percentage', 'w', 'games'),
  pct('fg_pct', 'base', 'FG%', 'Field goal percentage', 'fgm', 'fga'),
  pct('fg3_pct', 'base', '3P%', 'Three-point percentage', 'fg3m', 'fg3a'),
  pct('ft_pct', 'base', 'FT%', 'Free throw percentage', 'ftm', 'fta'),
  pct('opp_fg_pct', 'opponent', 'OPP FG%', 'Opponent field goal percentage', 'opp_fgm', 'opp_fga'),
  pct(
    'opp_fg3_pct',
    'opponent',
    'OPP 3P%',
    'Opponent three-point percentage',
    'opp_fg3m',
    'opp_fg3a'
  ),
  pct('opp_ft_pct', 'opponent', 'OPP FT%', 'Opponent free throw percentage', 'opp_ftm', 'opp_fta')
]

/** Possessions are published with the advanced file; the per-100 mode divides by them. */
export const POSSESSIONS: LineupColumn = {
  id: 'possessions',
  group: 'advanced',
  source: 'poss',
  label: 'POSS',
  title: 'Possessions',
  kind: 'value',
  unit: 'count',
  decimals: 0
}

const ORDER: Record<LineupGroup, string[]> = {
  base: [
    'w',
    'l',
    'w_pct',
    'fgm',
    'fga',
    'fg_pct',
    'fg3m',
    'fg3a',
    'fg3_pct',
    'ftm',
    'fta',
    'ft_pct'
  ],
  advanced: [],
  fourfactors: [],
  misc: [],
  scoring: [],
  opponent: []
}

function ordered(group: LineupGroup, stored: LineupColumn[]): LineupColumn[] {
  const all = [...stored, ...WORKED_OUT.filter((c) => c.group === group)]
  const first = ORDER[group]
  const lead = first.map((id) => all.find((c) => c.id === id)).filter((c): c is LineupColumn => !!c)
  return [...lead, ...all.filter((c) => !first.includes(c.id))]
}

const GROUP_COLUMNS: Record<LineupGroup, LineupColumn[]> = {
  base: ordered('base', BASE),
  advanced: ordered('advanced', [...ADVANCED, POSSESSIONS]),
  fourfactors: ordered('fourfactors', FOUR_FACTORS),
  misc: ordered('misc', MISC),
  scoring: ordered('scoring', SCORING),
  opponent: ordered('opponent', OPPONENT)
}

export const lineupColumns = (group: LineupGroup): LineupColumn[] => GROUP_COLUMNS[group]

/** Every column the table stores, in group order. */
export const LINEUP_STORED: LineupColumn[] = LINEUP_GROUPS.flatMap((g) =>
  GROUP_COLUMNS[g.id].filter((c) => c.source !== null)
)

/** The columns a read of a group returns: the group's own, and the parts its percentages divide. */
export function lineupReadIds(group: LineupGroup): string[] {
  const own = GROUP_COLUMNS[group]
  const parts = own.flatMap((c) => c.of ?? []).filter((p) => p !== 'games')
  return [...new Set([...own.filter((c) => c.source !== null).map((c) => c.id), ...parts])]
}
