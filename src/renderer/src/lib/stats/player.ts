import { playTypeMetricId } from '@shared/stats/catalogue/playTypes'
import { coverageReason } from '@shared/stats/coverage'
import { PLAY_TYPE_SIDES } from '@shared/stats/playTypes'
import { seasonLabel } from '@shared/stats/seasons'
import type {
  BoardMode,
  MetricInfo,
  StatsGame,
  StatsPlayerInfo,
  StatsQuery,
  StatsResult,
  StatsRow,
  StatsSeason
} from '@shared/stats/types'
import type { ChartPoint, ChartSeries, SectionDef } from './dashboard'
import { cellTitle, fmtClock, fmtStat, heatOf, ordinal, type Heat } from './format'
import { bestFirst, qualifies, rankWithinTab, ROW_LIMIT, searchKey, tabOf } from './leaderboard'
import { queryScope, shortDay, type StatsScope } from './scope'

/** The player dashboard: a rail to pick from, a header, and one set of tabs for every position. */

export type PlayerTab =
  | 'overview'
  | 'scoring'
  | 'shooting'
  | 'shots'
  | 'plays'
  | 'playmaking'
  | 'rebounding'
  | 'defense'
  | 'tracking'
  | 'play_types'
  | 'matchups'
  | 'log'
  | 'splits'
  | 'profile'

export const PLAYER_DASH_TABS: { id: PlayerTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'shooting', label: 'Shooting' },
  { id: 'shots', label: 'Shots' },
  { id: 'plays', label: 'Play by play' },
  { id: 'playmaking', label: 'Playmaking' },
  { id: 'rebounding', label: 'Rebounding' },
  { id: 'defense', label: 'Defense' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'play_types', label: 'Play types' },
  { id: 'matchups', label: 'Matchups' },
  { id: 'log', label: 'Game log' },
  { id: 'splits', label: 'Splits' },
  { id: 'profile', label: 'Profile' }
]

export const TAB_SECTIONS: Record<
  Exclude<PlayerTab, 'overview' | 'log' | 'splits' | 'profile'>,
  SectionDef[]
> = {
  // Plan T905: counted from the NBA's play by play, 1996-97 on.
  plays: [
    {
      title: 'Turnovers',
      note: 'Live-ball: a steal credited',
      metrics: [
        'pbp_tov_bad_pass',
        'pbp_tov_lost_ball',
        'pbp_tov_off_foul',
        'pbp_tov_travel',
        'pbp_tov_live',
        'pbp_tov_dead',
        'pbp_tov_live_share'
      ]
    },
    {
      title: 'Fouls',
      note: 'Fouls drawn: ESPN’s play by play, 2006-07 to 2016-17',
      metrics: [
        'pbp_pf_shooting',
        'pbp_pf_personal',
        'pbp_pf_offensive',
        'pbp_pf_loose_ball',
        'pbp_tech',
        'pbp_flagrant',
        'pbp_fd'
      ]
    },
    {
      title: 'And-ones and trips',
      metrics: [
        'pbp_and1',
        'pbp_and1_pct',
        'pbp_and1_rate',
        'pbp_ft_trip2',
        'pbp_ft_trip3',
        'pbp_trip_rate'
      ]
    },
    {
      title: 'Assists',
      note: 'Assist points: 2 a two, 3 a three',
      metrics: [
        'pbp_ast2',
        'pbp_ast3',
        'pbp_ast_pts',
        'pbp_ast_to3_share',
        'pbp_ast2_share',
        'pbp_ast3_share',
        'pbp_unast_share'
      ]
    }
  ],
  scoring: [
    { title: 'Volume', metrics: ['pts', 'fgm', 'fga', 'fg3m', 'ftm', 'fta', 'tsa'] },
    {
      title: 'Where the points come from',
      metrics: ['pts_2pt', 'pts_3pt', 'pts_ft', 'share_pts_2pt', 'share_pts_3pt', 'share_pts_ft']
    },
    {
      title: 'Share of the team',
      note: 'In the games they played',
      metrics: ['share_pts', 'share_fgm', 'share_fga', 'share_fg3a', 'share_fta', 'usg_pct']
    }
  ],
  shooting: [
    {
      title: 'Efficiency',
      metrics: [
        'ts_pct',
        'efg_pct',
        'fg_pct',
        'fg2_pct',
        'fg3_pct',
        'ft_pct',
        'pts_per_tsa',
        'pts_per_fga',
        'fg_pts_per_fga'
      ]
    },
    {
      title: 'Shot profile',
      metrics: ['fg2a', 'fg3a', 'fta', 'fg3a_rate', 'fg2a_rate', 'fta_rate', 'ftm_per_fga']
    },
    { title: 'Makes and misses', metrics: ['fg2m', 'fg3m', 'fg_miss', 'ft_miss'] }
  ],
  // Shots by zone, band and type (reference section 7), at the game grain, so any range reads.
  shots: [
    {
      title: 'Profile',
      note: 'From the NBA’s shot chart file, 1996-97 on',
      metrics: [
        'shot_avg_dist',
        'shot_ra_freq',
        'shot_paint_freq',
        'shot_mid_freq',
        'shot_c3_freq',
        'shot_atb3_freq'
      ]
    },
    {
      title: 'Against the league',
      note: 'FG% above the league’s rate in each zone that season',
      metrics: [
        'shot_ra_fg_rel',
        'shot_paint_fg_rel',
        'shot_mid_fg_rel',
        'shot_c3_fg_rel',
        'shot_atb3_fg_rel',
        'shot_pps_above',
        'shot_pts_above'
      ]
    },
    {
      title: 'By distance',
      metrics: [
        'shot_lt8_fg_pct',
        'shot_d8_16_fg_pct',
        'shot_d16_24_fg_pct',
        'shot_d24p_fg_pct',
        'shot_lt8_freq',
        'shot_d24p_freq'
      ]
    },
    {
      title: 'Shot types',
      metrics: [
        'shot_dunk_fga',
        'shot_layup_fg_pct',
        'shot_hook_fg_pct',
        'shot_floater_fg_pct',
        'shot_jumper_fg_pct',
        'shot_jumper_freq'
      ]
    },
    {
      title: 'Assisted',
      note: 'The share of makes assisted, by the play by play',
      metrics: ['shot_ra_ast_pct', 'shot_mid_ast_pct', 'shot_c3_ast_pct', 'shot_atb3_ast_pct']
    }
  ],
  playmaking: [
    { title: 'Passing', metrics: ['ast', 'ast_pct', 'ast_ratio', 'share_ast'] },
    { title: 'Ball security', metrics: ['tov', 'tov_pct', 'ast_tov', 'share_tov'] }
  ],
  rebounding: [
    { title: 'Rebounds', metrics: ['reb', 'oreb', 'dreb'] },
    {
      title: 'Share of those available',
      note: 'Estimated from the share of the team’s minutes',
      metrics: ['trb_pct', 'orb_pct', 'drb_pct']
    },
    { title: 'Share of the team', metrics: ['share_reb', 'share_oreb', 'share_dreb'] }
  ],
  defense: [
    { title: 'Plays', note: 'From the box score', metrics: ['stl', 'blk', 'pf'] },
    {
      title: 'Rates',
      note: 'Estimated from the share of the team’s minutes',
      metrics: ['stl_pct', 'blk_pct']
    },
    { title: 'Share of the team', metrics: ['share_stl', 'share_blk', 'share_pf'] },
    { title: 'On the floor', metrics: ['plus_minus', 'win_pct', 'w', 'l'] },
    {
      title: 'Hustle',
      note: 'Tagged from 2016-17',
      metrics: [
        'deflections',
        'contested_shots',
        'charges_drawn',
        'loose_balls',
        'box_outs',
        'screen_assists'
      ]
    }
  ],
  // The NBA's optical tracking, from 2013-14, for whole seasons only.
  tracking: [
    {
      title: 'Movement',
      note: 'Tracked from 2013-14',
      metrics: ['dist_miles', 'avg_speed', 'avg_speed_off', 'avg_speed_def']
    },
    {
      title: 'On the ball',
      metrics: ['touches', 'time_of_poss', 'sec_per_touch', 'drib_per_touch', 'pts_per_touch']
    },
    {
      title: 'Drives',
      metrics: [
        'drives',
        'drive_fg_pct',
        'drive_pts_per_drive',
        'drive_ast_pct',
        'drive_tov_pct',
        'drive_pf_pct'
      ]
    },
    {
      title: 'Passing',
      metrics: ['passes_made', 'potential_ast', 'secondary_ast', 'ast_pts_created', 'ast_per_pass']
    },
    {
      title: 'Shot types',
      metrics: [
        'catch_shoot_fga',
        'catch_shoot_efg_pct',
        'catch_shoot_fg3_pct',
        'pull_up_fga',
        'pull_up_efg_pct',
        'pull_up_fg3_pct'
      ]
    },
    {
      title: 'Touches by area',
      metrics: [
        'elbow_touches',
        'elbow_touch_pts_per_touch',
        'post_touches',
        'post_touch_pts_per_touch',
        'paint_touches',
        'paint_touch_pts_per_touch'
      ]
    },
    {
      title: 'Rebounding',
      metrics: [
        'reb_chances',
        'reb_chance_pct',
        'reb_chance_pct_adj',
        'reb_contest_pct',
        'avg_reb_dist'
      ]
    },
    { title: 'Rim defense', metrics: ['def_rim_fga', 'def_rim_fg_pct'] }
  ],
  // The NBA's play types, from 2015-16, for whole seasons only: how often each type ends a play, and
  // how well it goes. The leaderboards hold every other measure.
  play_types: [
    {
      title: 'How often, on offense',
      note: 'Tagged from 2015-16',
      metrics: PLAY_TYPE_SIDES.filter((s) => s.side === 'offense').map((s) =>
        playTypeMetricId(s.key, 'freq')
      )
    },
    {
      title: 'Points per possession, on offense',
      // From 2023-24 the NBA leaves out a type with fewer than 10 possessions.
      note: 'Blank under 10 plays, from 2023-24',
      metrics: PLAY_TYPE_SIDES.filter((s) => s.side === 'offense').map((s) =>
        playTypeMetricId(s.key, 'ppp')
      )
    },
    {
      title: 'How often, on defense',
      note: 'The plays they defended',
      metrics: PLAY_TYPE_SIDES.filter((s) => s.side === 'defense').map((s) =>
        playTypeMetricId(s.key, 'freq')
      )
    },
    {
      title: 'Points allowed per possession, on defense',
      metrics: PLAY_TYPE_SIDES.filter((s) => s.side === 'defense').map((s) =>
        playTypeMetricId(s.key, 'ppp')
      )
    }
  ],
  // The NBA's matchups, from 2017-18: what the players they were assigned to did against them.
  matchups: [
    {
      title: 'Guarding',
      note: 'Tracked from 2017-18',
      metrics: [
        'matchup_min',
        'matchup_poss',
        'matchup_pts',
        'matchup_pts_per_100',
        'matchup_fg_pct',
        'matchup_fg3_pct'
      ]
    },
    {
      title: 'What the players guarded did',
      metrics: ['matchup_ast', 'matchup_tov', 'matchup_blk', 'matchup_sfl', 'matchup_fta']
    },
    {
      title: 'Who they guarded',
      note: 'By the position the NBA lists',
      metrics: ['matchup_g_time_pct', 'matchup_f_time_pct', 'matchup_c_time_pct']
    },
    {
      title: 'Against each position',
      metrics: [
        'matchup_g_pts_per_100',
        'matchup_f_pts_per_100',
        'matchup_c_pts_per_100',
        'matchup_g_fg_pct',
        'matchup_f_fg_pct',
        'matchup_c_fg_pct'
      ]
    }
  ]
}

export const OVERVIEW_SECTION: SectionDef = {
  title: 'Percentile rankings',
  metrics: [
    'pts',
    'reb',
    'ast',
    'stl',
    'blk',
    'tov',
    'ts_pct',
    'efg_pct',
    'fg3_pct',
    'usg_pct',
    'ast_pct',
    'trb_pct',
    'gmsc',
    'pie',
    'plus_minus'
  ]
}

/** The four big numbers of the Overview: they are all in its rankings, so one query answers both. */
export const TILES = ['pts', 'reb', 'ast', 'ts_pct']

/** The rail's positions; `ALL` is the whole league. */
export const RAIL_POSITIONS = ['ALL', 'G', 'F', 'C'] as const
export type RailPosition = (typeof RAIL_POSITIONS)[number]

/** A player's percentiles are read among the qualified players of their own position. */
const poolTab = (position: string | null): ReturnType<typeof tabOf> =>
  tabOf('player', position ?? 'ALL')

/** Every player of a position, for ranks. The rail and the leaderboards qualify the same way. */
export function positionQuery(
  metrics: string[],
  position: string | null,
  scope: StatsScope,
  mode: BoardMode
): StatsQuery {
  const all = metrics.includes('min') ? metrics : [...metrics, 'min']
  return {
    entity: 'player',
    metrics: all,
    scope: {
      ...queryScope(scope, 'player'),
      ...(position === 'G' || position === 'F' || position === 'C' ? { positions: [position] } : {})
    },
    transform: mode,
    sort: { metric: 'min', dir: 'desc' },
    limit: ROW_LIMIT
  }
}

/** The pool ranked among those who qualify. */
export const rankedPool = (result: StatsResult, position: string | null): StatsResult =>
  rankWithinTab(result, poolTab(position))

/** How many rows a player is ranked against. */
export const poolSize = (result: StatsResult, position: string | null): number =>
  result.rows.filter((r) => qualifies(r, poolTab(position))).length

/** The player in scope: their position that season, team, games and whether they qualify. */
export function selfQuery(player: string, scope: StatsScope): StatsQuery {
  return {
    entity: 'player',
    metrics: ['min'],
    scope: { ...queryScope(scope, 'player'), players: [player] },
    limit: 1
  }
}

export interface TileView {
  metric: string
  label: string
  value: string
  /** "92nd": the percentile, when they qualify. */
  chip: string | null
  tone: 'good' | 'bad' | 'mid'
  title: string
}

export function tileViews(
  result: StatsResult,
  id: string,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  position: string | null
): TileView[] {
  const row = result.rows.find((r) => r.id === id)
  return TILES.map((metric) => {
    const info = byId.get(metric)
    const v = row?.values[metric]
    const p = v?.percentile ?? null
    return {
      metric,
      label: info?.label ?? metric,
      value: fmtStat(v?.value ?? null, info ?? { unit: 'number', decimals: 1 }, mode),
      chip: p === null ? null : ordinal(p),
      tone: p === null ? 'mid' : p >= 75 ? 'good' : p <= 25 ? 'bad' : 'mid',
      title: v && info ? cellTitle(v, info, position) : ''
    }
  })
}

const RAIL_METRICS = [
  'pts',
  'reb',
  'ast',
  'stl',
  'blk',
  'fg3m',
  'min',
  'ts_pct',
  'efg_pct',
  'fg_pct',
  'fg3_pct',
  'ft_pct',
  'usg_pct',
  'ast_pct',
  'trb_pct',
  'gmsc',
  'plus_minus'
]

/** What the rail can rank by. */
export function railMetrics(
  byId: ReadonlyMap<string, MetricInfo>
): { value: string; label: string }[] {
  return RAIL_METRICS.filter((id) => byId.has(id)).map((id) => ({
    value: id,
    label: byId.get(id)?.label ?? id
  }))
}

export function railQuery(
  position: RailPosition,
  team: string | null,
  metric: string,
  scope: StatsScope,
  mode: BoardMode,
  byId: ReadonlyMap<string, MetricInfo>
): StatsQuery {
  return {
    entity: 'player',
    metrics: metric === 'min' ? ['min'] : [metric, 'min'],
    scope: {
      ...queryScope(scope, 'player'),
      ...(position === 'ALL' ? {} : { positions: [position] }),
      ...(team ? { teams: [team] } : {})
    },
    transform: mode,
    sort: { metric, dir: bestFirst(byId.get(metric)) },
    limit: ROW_LIMIT
  }
}

export interface RailRow {
  id: string
  name: string
  team: string | null
  position: string | null
  /** Among those who qualify; null below the sample. */
  rank: number | null
  value: string
  heat: Heat
  title: string
}

/**
 * The rail's rows: those who qualify, best first. A search finds anyone in scope, and the player on
 * screen is listed however far below the sample they are.
 */
export function railRows(
  result: StatsResult,
  metric: string,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  search: string,
  selected: string | null
): RailRow[] {
  const tab = poolTab(null)
  const ranked = rankWithinTab(result, tab)
  const info = byId.get(metric)
  const needle = searchKey(search.trim())
  let place = 0
  return ranked.rows.flatMap((r) => {
    const ok = qualifies(r, tab)
    const rank = ok ? ++place : null
    if (needle ? !searchKey(r.name).includes(needle) : !ok && r.id !== selected) return []
    const v = r.values[metric]
    return [
      {
        id: r.id,
        name: r.name,
        team: r.team,
        position: r.position,
        rank,
        value: fmtStat(v?.value ?? null, info ?? { unit: 'number', decimals: 1 }, mode),
        heat: info ? heatOf(v?.percentile ?? null, info.direction) : 'n',
        title: v && info ? cellTitle(v, info, r.position) : ''
      }
    ]
  })
}

/** The dashboard's first player: whoever leads the league in scoring per game in scope. */
export function defaultPlayer(result: StatsResult | null): string | null {
  if (!result) return null
  const tab = poolTab(null)
  return (result.rows.find((r) => qualifies(r, tab)) ?? result.rows[0])?.id ?? null
}

/** "LeBron" and "James"; a single name goes on the big line. */
export function splitName(name: string): { first: string; last: string } {
  const at = name.indexOf(' ')
  return at < 0 ? { first: '', last: name } : { first: name.slice(0, at), last: name.slice(at + 1) }
}

const titleCase = (text: string): string =>
  text.toLowerCase().replace(/(^|\s)([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase())

/** The header's small print: number, size, birth date, school, career. What is unknown is left out. */
export function playerFacts(info: StatsPlayerInfo): string[] {
  const first = info.seasons[0]
  const last = info.seasons.at(-1)
  const size = [info.height, info.weight ? `${info.weight} lb` : null].filter(Boolean).join(', ')
  return [
    info.number ? `#${info.number}` : null,
    size || null,
    info.birthDate ? `Born ${titleCase(info.birthDate)}` : null,
    info.school,
    first && last
      ? first === last
        ? seasonLabel(first)
        : `${seasonLabel(first)} to ${seasonLabel(last)}`
      : null
  ].filter((x): x is string => x !== null)
}

/** The columns of the season and career table. */
export const LINE_METRICS = [
  'gs',
  'min',
  'pts',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'fg_pct',
  'fg3_pct',
  'ft_pct',
  'ts_pct',
  'plus_minus'
]

/** The scope's game types over a career: its range belongs to one season, so it is left out. */
export function careerQuery(
  player: string,
  seasons: number[],
  scope: StatsScope,
  mode: BoardMode,
  bySeason: boolean
): StatsQuery {
  return {
    entity: 'player',
    metrics: LINE_METRICS,
    scope: {
      seasons,
      gameTypes: queryScope(scope, 'player').gameTypes,
      players: [player]
    },
    ...(bySeason ? { groupBy: ['season' as const] } : {}),
    transform: mode,
    sort: { metric: 'pts', dir: 'desc' },
    limit: 100
  }
}

export interface LineRow {
  key: string
  label: string
  team: string | null
  games: string
  cells: { text: string; title: string }[]
  /** A season inside the career with no games in the scope's type. */
  gap: boolean
}

function lineCells(
  row: StatsRow | undefined,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  season: number | null
): LineRow['cells'] {
  return LINE_METRICS.map((id) => {
    const info = byId.get(id)
    const v = row?.values[id]?.value ?? null
    return {
      text: fmtStat(v, info ?? { unit: 'number', decimals: 1 }, mode),
      // A stat that did not exist that season says so; a season's zero attempts just read as a dash.
      title: v === null && season !== null && info ? (coverageReason(info, [season]) ?? '') : ''
    }
  })
}

/** Oldest first. A season inside the career with no games says so, instead of closing the gap. */
export function careerRows(
  bySeason: StatsResult | null,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode
): LineRow[] {
  const rows = new Map(
    (bySeason?.rows ?? []).map((r) => [Number(r.group.season), r] as [number, StatsRow])
  )
  if (rows.size === 0) return []
  const seasons = [...rows.keys()]
  const out: LineRow[] = []
  for (let s = Math.min(...seasons); s <= Math.max(...seasons); s++) {
    const r = rows.get(s)
    out.push({
      key: String(s),
      label: seasonLabel(s),
      team: r?.team ?? null,
      games: r ? String(r.games) : '0',
      cells: r ? lineCells(r, byId, mode, s) : [],
      gap: !r
    })
  }
  return out
}

/**
 * The career line. A stat that starts after the career did would divide by games it was not recorded
 * in, so its average is left out and says why; its total stands, and says from when.
 */
export function careerTotal(
  total: StatsResult | null,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  firstPlayed: number | null
): LineRow | null {
  const r = total?.rows[0]
  if (!r) return null
  const partial = (id: string): boolean => {
    const info = byId.get(id)
    return !!info && firstPlayed !== null && info.firstSeason > firstPlayed
  }
  return {
    key: 'career',
    label: 'Career',
    team: null,
    games: fmtStat(r.games, { unit: 'count', decimals: 0 }),
    cells: lineCells(r, byId, mode, null).map((c, i) => {
      const id = LINE_METRICS[i]
      if (!partial(id)) return c
      const since = seasonLabel(byId.get(id)?.firstSeason ?? 0)
      return mode === 'raw'
        ? { text: c.text, title: `From ${since} only.` }
        : { text: '—', title: `Recorded from ${since}, so a career average would not be exact.` }
    }),
    gap: false
  }
}

/* ------------------------------ Game log ------------------------------ */

export const LOG_METRICS = [
  'gs',
  'min',
  'pts',
  'fgm',
  'fga',
  'fg_pct',
  'fg3m',
  'fg3a',
  'fg3_pct',
  'ftm',
  'fta',
  'ft_pct',
  'oreb',
  'dreb',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf',
  'plus_minus',
  'gmsc'
]

/** A column of the log: one metric, or made and attempted written together. */
export const LOG_COLUMNS: { label: string; metric?: string; pair?: [string, string] }[] = [
  { label: 'MIN', metric: 'min' },
  { label: 'PTS', metric: 'pts' },
  { label: 'REB', metric: 'reb' },
  { label: 'AST', metric: 'ast' },
  { label: 'STL', metric: 'stl' },
  { label: 'BLK', metric: 'blk' },
  { label: 'FG', pair: ['fgm', 'fga'] },
  { label: 'FG%', metric: 'fg_pct' },
  { label: '3P', pair: ['fg3m', 'fg3a'] },
  { label: '3P%', metric: 'fg3_pct' },
  { label: 'FT', pair: ['ftm', 'fta'] },
  { label: 'FT%', metric: 'ft_pct' },
  { label: 'OREB', metric: 'oreb' },
  { label: 'DREB', metric: 'dreb' },
  { label: 'TOV', metric: 'tov' },
  { label: 'PF', metric: 'pf' },
  { label: '+/-', metric: 'plus_minus' },
  { label: 'GmSc', metric: 'gmsc' }
]

/** Each game in scope, as recorded. */
export function logQuery(player: string, scope: StatsScope): StatsQuery {
  return {
    entity: 'player',
    metrics: LOG_METRICS,
    scope: { ...queryScope(scope, 'player'), players: [player] },
    groupBy: ['game'],
    transform: 'raw',
    sort: { metric: 'pts', dir: 'desc' },
    limit: 300
  }
}

/** The same games as one line: what the log must add up to. */
export function logTotalQuery(player: string, scope: StatsScope): StatsQuery {
  return {
    entity: 'player',
    metrics: LOG_METRICS,
    scope: { ...queryScope(scope, 'player'), players: [player] },
    transform: 'raw',
    limit: 1
  }
}

const count = (x: number | null | undefined): string =>
  x === null || x === undefined ? '—' : `${x}`

function logCells(row: StatsRow, byId: ReadonlyMap<string, MetricInfo>, total: boolean): string[] {
  return LOG_COLUMNS.map((c) => {
    if (c.pair) {
      return `${count(row.values[c.pair[0]]?.value)}-${count(row.values[c.pair[1]]?.value)}`
    }
    const id = c.metric ?? ''
    const v = row.values[id]?.value ?? null
    if (id === 'min' && !total) return fmtClock(v)
    return fmtStat(v, byId.get(id) ?? { unit: 'number', decimals: 1 })
  })
}

/** How a game reads from one team's side, in a log or a schedule. */
export interface GameFacts {
  date: string
  /** "vs BOS" or "@ BOS". */
  opponent: string
  /** "W 110–102", with overtime: "W 110–102 OT". */
  score: string | null
  result: 'W' | 'L' | null
  /** Not the regular season: "Playoffs". */
  type: string | null
}

const TYPE_TAGS: Partial<Record<StatsGame['type'], string>> = {
  'play-in': 'Play-in',
  playoffs: 'Playoffs',
  'cup-final': 'Cup final',
  'all-star': 'All-Star',
  preseason: 'Preseason'
}

export const typeTag = (type: StatsGame['type']): string | null => TYPE_TAGS[type] ?? null

/** How the game reads for the team with this code. */
export function gameFacts(g: StatsGame, code: string | null): GameFacts {
  const home = g.home.code === code
  const us = home ? g.home : g.away
  const them = home ? g.away : g.home
  const won = g.played && us.score !== null && them.score !== null ? us.score > them.score : null
  const ot = g.overtimes ? ` ${g.overtimes > 1 ? `${g.overtimes}OT` : 'OT'}` : ''
  return {
    date: shortDay(g.date),
    opponent: `${home ? 'vs' : '@'} ${them.code}`,
    score: won === null ? null : `${won ? 'W' : 'L'} ${us.score}–${them.score}${ot}`,
    result: won === null ? null : won ? 'W' : 'L',
    type: typeTag(g.type)
  }
}

export interface LogRow extends GameFacts {
  key: string
  team: string | null
  started: boolean
  cells: string[]
}

/** Newest first. A row whose game the schedule does not hold keeps its numbers and says nothing else. */
export function logRows(
  result: StatsResult | null,
  games: readonly StatsGame[] | null,
  byId: ReadonlyMap<string, MetricInfo>
): LogRow[] {
  if (!result) return []
  const byGame = new Map((games ?? []).map((g) => [g.id, g]))
  const dated = result.rows.map((r) => {
    const id = String(r.group.game)
    const g = byGame.get(id)
    const facts: GameFacts = g
      ? gameFacts(g, r.team)
      : { date: '', opponent: '', score: null, result: null, type: null }
    const row: LogRow = {
      ...facts,
      key: id,
      team: r.team,
      started: (r.values.gs?.value ?? 0) > 0,
      cells: logCells(r, byId, false)
    }
    return { row, order: g?.date ?? '' }
  })
  return dated
    .sort((a, b) => b.order.localeCompare(a.order) || b.row.key.localeCompare(a.row.key))
    .map((d) => d.row)
}

export const logTotalCells = (
  total: StatsRow | undefined,
  byId: ReadonlyMap<string, MetricInfo>
): string[] => (total ? logCells(total, byId, true) : [])

/**
 * The counts a log does not add up to against its season total. Both come from one table, so this
 * catches a query that loses or repeats a game: a traded player's stints, or a last-N that cuts one.
 */
export function logDifferences(log: StatsResult, total: StatsRow | undefined): string[] {
  if (!total) return log.rows.length ? ['every count'] : []
  const added = (id: string): number =>
    log.rows.reduce((sum, r) => sum + (r.values[id]?.value ?? 0), 0)
  return LOG_METRICS.filter((id) => {
    const whole = total.values[id]?.value
    // A rate does not add; Game Score does, and minutes to within rounding.
    if (whole === null || whole === undefined || id.endsWith('_pct')) return false
    return Math.abs(added(id) - whole) > 0.01
  })
}

/** One game's value of a metric across the games in scope, oldest first, for the Overview's chart. */
export function gameSeries(
  result: StatsResult | null,
  games: readonly StatsGame[] | null,
  metric: string,
  label: string
): ChartSeries {
  const byGame = new Map((games ?? []).map((g) => [g.id, g]))
  const dated = (result?.rows ?? []).map((r) => {
    const id = String(r.group.game)
    const g = byGame.get(id)
    const facts = g ? gameFacts(g, r.team) : null
    const point: ChartPoint = {
      key: id,
      label: facts?.date ?? '',
      title: facts ? `${facts.date} ${facts.opponent}` : id,
      value: r.values[metric]?.value ?? null
    }
    return { point, order: g?.date ?? '' }
  })
  const points = dated.sort((a, b) => a.order.localeCompare(b.order)).map((d) => d.point)
  return { id: metric, label, points }
}

/* ------------------------------- Splits ------------------------------- */

export const SPLIT_METRICS = [
  'min',
  'pts',
  'reb',
  'ast',
  'stl',
  'blk',
  'tov',
  'fg_pct',
  'fg3_pct',
  'ft_pct',
  'ts_pct',
  'plus_minus'
]

export interface SplitDef {
  key: string
  group: string
  label: string
  patch: Partial<StatsQuery['scope']>
  /** The group's rule, in one line under its title. */
  note?: string
}

const titled = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** The filters the engine offers on a game, in groups. Conferences and divisions are the season's. */
export function splitDefs(season: StatsSeason | undefined): SplitDef[] {
  const teams = season?.teams ?? []
  const named = (values: (string | null)[]): string[] =>
    [...new Set(values.filter((v): v is string => v !== null))].sort()
  return [
    { key: 'home', group: 'Where', label: 'Home', patch: { home: true } },
    { key: 'road', group: 'Where', label: 'Road', patch: { home: false } },
    { key: 'win', group: 'Result', label: 'Wins', patch: { result: 'win' } },
    { key: 'loss', group: 'Result', label: 'Losses', patch: { result: 'loss' } },
    { key: 'starter', group: 'Role', label: 'Started', patch: { starter: true } },
    { key: 'bench', group: 'Role', label: 'Off the bench', patch: { starter: false } },
    {
      key: 'before',
      group: 'All-Star break',
      label: 'Before',
      patch: { allStarBreak: 'before' }
    },
    { key: 'after', group: 'All-Star break', label: 'After', patch: { allStarBreak: 'after' } },
    { key: 'rest0', group: 'Rest', label: 'Back-to-back', patch: { restDays: [0, 0] } },
    { key: 'rest1', group: 'Rest', label: '1 day off', patch: { restDays: [1, 1] } },
    { key: 'rest2', group: 'Rest', label: '2 days off or more', patch: { restDays: [2, 400] } },
    ...named(teams.map((t) => t.conference)).map((c) => ({
      key: `conf-${c}`,
      group: 'Against the conference',
      label: titled(c),
      patch: { conferences: [c] }
    })),
    ...named(teams.map((t) => t.division)).map((d) => ({
      key: `div-${d}`,
      group: 'Against the division',
      label: titled(d),
      patch: { divisions: [d] }
    }))
  ]
}

/** One query per split, one for the months and one for the opponents, all for this player. */
export function splitQueries(
  player: string,
  defs: readonly SplitDef[],
  scope: StatsScope,
  mode: BoardMode
): Map<string, StatsQuery> {
  const base = { ...queryScope(scope, 'player'), players: [player] }
  const query = (extra: Partial<StatsQuery>): StatsQuery => ({
    entity: 'player',
    metrics: SPLIT_METRICS,
    scope: base,
    transform: mode,
    sort: { metric: 'pts', dir: 'desc' },
    limit: 40,
    ...extra
  })
  return new Map<string, StatsQuery>([
    ['all', query({})],
    ...defs.map((d): [string, StatsQuery] => [
      d.key,
      query({ scope: { ...base, ...d.patch }, limit: 1 })
    ]),
    ['months', query({ groupBy: ['month'] })],
    ['opponents', query({ groupBy: ['opponent'] })]
  ])
}

export interface SplitRow {
  key: string
  label: string
  games: string
  cells: string[]
}

export interface SplitGroup {
  title: string
  rows: SplitRow[]
  note?: string
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

function splitRow(
  key: string,
  label: string,
  r: StatsRow,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  metrics: readonly string[]
): SplitRow {
  return {
    key,
    label,
    games: String(r.games),
    cells: metrics.map((id) =>
      fmtStat(r.values[id]?.value ?? null, byId.get(id) ?? { unit: 'number', decimals: 1 }, mode)
    )
  }
}

/** The table, in the order the screen reads it. A split the player has no games in is left out. */
export function splitTable(
  results: ReadonlyMap<string, StatsResult>,
  defs: readonly SplitDef[],
  season: StatsSeason | undefined,
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  metrics: readonly string[] = SPLIT_METRICS
): SplitGroup[] {
  const groups = new Map<string, SplitRow[]>()
  const notes = new Map<string, string>()
  const all = results.get('all')?.rows[0]
  if (all) groups.set('Overall', [splitRow('all', 'All games', all, byId, mode, metrics)])
  for (const d of defs) {
    const r = results.get(d.key)?.rows[0]
    if (!r) continue
    if (d.note) notes.set(d.group, d.note)
    groups.set(d.group, [
      ...(groups.get(d.group) ?? []),
      splitRow(d.key, d.label, r, byId, mode, metrics)
    ])
  }
  // A season reads from the autumn on: August, the start of the bubble's games, comes first.
  const inSeason = (m: number): number => (m + 4) % 12
  const months = [...(results.get('months')?.rows ?? [])]
    .sort((a, b) => inSeason(Number(a.group.month)) - inSeason(Number(b.group.month)))
    .map((r) => {
      const m = Number(r.group.month)
      return splitRow(`month-${m}`, MONTHS[m - 1] ?? String(m), r, byId, mode, metrics)
    })
  if (months.length) groups.set('By month', months)
  const codes = new Map((season?.teams ?? []).map((t) => [t.id, t.code]))
  const opponents = (results.get('opponents')?.rows ?? [])
    .map((r) => {
      const id = String(r.group.opponent)
      return splitRow(`opp-${id}`, codes.get(id) ?? id, r, byId, mode, metrics)
    })
    .sort((a, b) => a.label.localeCompare(b.label))
  if (opponents.length) groups.set('By opponent', opponents)
  return [...groups].map(([title, rows]) =>
    notes.has(title) ? { title, rows, note: notes.get(title) } : { title, rows }
  )
}

/** What the splits' answers depend on: each result's notes, once. */
export function splitNotes(results: ReadonlyMap<string, StatsResult>, scope: StatsScope): string[] {
  const notes = new Set([...results.values()].flatMap((r) => r.notes))
  // A play split's rule is under its group; the engine's copy of it would repeat it.
  for (const n of [...notes]) if (/ Counted from the NBA's play by play\.$/.test(n)) notes.delete(n)
  if (scope.range.kind === 'last') {
    notes.add(`Each split reads its own last ${scope.range.n} games.`)
  }
  return [...notes]
}
