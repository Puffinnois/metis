import { seasonLabel } from '@shared/stats/seasons'
import type {
  BoardMode,
  Entity,
  LeaderboardBoard,
  MetricFamily,
  MetricInfo,
  PositionGroup,
  StatsQuery,
  StatsResult,
  StatsRow
} from '@shared/stats/types'
import { familyLabel, isRescaled } from './format'
import { queryScope, type StatsScope } from './scope'

/** A leaderboard tab: positions for players, an end of the floor for teams, its default columns. */
export interface TabDef {
  id: string
  label: string
  /** How the title reads: "2025-26 guard leaderboard". */
  title: string
  entity: Entity
  positions?: PositionGroup[]
  /** Team tabs: which metrics the column picker offers first. */
  sides?: NonNullable<MetricInfo['side']>[]
  groups: [string, string[]][]
  sort: string
  /** The metric whose sample qualifies a row, scaled to the games in scope. Teams always qualify. */
  qualifier?: string
}

const PLAYER_GROUPS: [string, string[]][] = [
  ['Playing time', ['min']],
  ['Scoring', ['pts', 'ts_pct', 'efg_pct', 'fg_pct', 'fg3m', 'fg3_pct', 'ft_pct']],
  ['Creating', ['ast', 'tov', 'usg_pct']],
  ['Boards and defense', ['reb', 'stl', 'blk']],
  ['Impact', ['plus_minus', 'gmsc']]
]

const playerTab = (
  id: string,
  label: string,
  title: string,
  positions?: PositionGroup[]
): TabDef => ({
  id,
  label,
  title,
  entity: 'player',
  ...(positions ? { positions } : {}),
  groups: PLAYER_GROUPS,
  sort: 'pts',
  qualifier: 'min'
})

export const PLAYER_TABS: TabDef[] = [
  playerTab('ALL', 'All players', 'player'),
  playerTab('G', 'Guards', 'guard', ['G']),
  playerTab('F', 'Forwards', 'forward', ['F']),
  playerTab('C', 'Centers', 'center', ['C'])
]

export const TEAM_TABS: TabDef[] = [
  {
    id: 'offense',
    label: 'Offense',
    title: 'team offense',
    entity: 'team',
    sides: ['offense'],
    groups: [
      ['Record', ['team_w', 'team_l', 'team_win_pct', 'team_point_diff']],
      ['Rating', ['team_ortg', 'team_nrtg', 'team_pace']],
      ['Scoring', ['team_pts', 'team_ts_pct', 'team_efg_pct', 'team_fg3_pct']],
      ['Four factors', ['team_tov_pct', 'team_orb_pct', 'team_fta_rate']]
    ],
    sort: 'team_nrtg'
  },
  {
    id: 'defense',
    label: 'Defense',
    title: 'team defense',
    entity: 'team',
    sides: ['defense'],
    groups: [
      ['Rating', ['team_drtg', 'opp_pts']],
      ['Shooting allowed', ['opp_ts_pct', 'opp_efg_pct', 'opp_fg3_pct']],
      ['Four factors', ['opp_tov_pct', 'team_drb_pct', 'opp_fta_rate']],
      ['Plays', ['team_stl', 'team_blk']]
    ],
    sort: 'team_drtg'
  }
]

export function tabsOf(entity: Entity): TabDef[] {
  return entity === 'player' ? PLAYER_TABS : TEAM_TABS
}

export function tabOf(entity: Entity, id: string): TabDef {
  const tabs = tabsOf(entity)
  return tabs.find((t) => t.id === id) ?? tabs[0]
}

/** At most 40 metrics a query. */
export const MAX_COLUMNS = 40

/** Rows a leaderboard asks for: search works on them, and a season holds about 600. */
export const ROW_LIMIT = 1000

export const BOARD_MODES: { value: BoardMode; label: string }[] = [
  { value: 'raw', label: 'Totals' },
  { value: 'perGame', label: 'Per game' },
  { value: 'per36', label: 'Per 36' },
  { value: 'per48', label: 'Per 48' },
  { value: 'per100', label: 'Per 100' }
]

const MODE_WORDS: Record<BoardMode, string> = {
  raw: 'totals',
  perGame: 'per game',
  per36: 'per 36 minutes',
  per48: 'per 48 minutes',
  per100: 'per 100 possessions'
}

export const modeWords = (mode: BoardMode): string => MODE_WORDS[mode]

/** The default sort of a metric: best first. */
export function bestFirst(info: MetricInfo | undefined): 'asc' | 'desc' {
  return info?.direction === 'lower' ? 'asc' : 'desc'
}

export function defaultBoard(
  entity: Entity,
  tabId: string,
  catalogue: ReadonlyMap<string, MetricInfo>
): LeaderboardBoard {
  const tab = tabOf(entity, tabId)
  return {
    entity,
    tab: tab.id,
    columns: tab.groups.flatMap(([, ids]) => ids).filter((id) => catalogue.has(id)),
    sort: { by: tab.sort, dir: bestFirst(catalogue.get(tab.sort)) },
    mode: 'raw',
    qualifiedOnly: true,
    team: null
  }
}

const FAMILIES: MetricFamily[] = [
  'traditional',
  'shooting',
  'possessions',
  'scoring',
  'composite',
  'tracking',
  'hustle',
  'play_types',
  'matchups',
  'impact',
  'availability'
]

/** The games column is the row's own, so a count of games is not offered beside it. */
const GAMES = new Set(['gp', 'team_gp'])

/** Whether a metric belongs on a tab: players' on every position tab, a team's on either end. */
export function appliesTo(info: MetricInfo, tab: TabDef): boolean {
  return info.entity === tab.entity && info.tier !== 'stored' && !GAMES.has(info.id)
}

/** What the column picker offers on a tab: the tab's own end first for teams, then by family and label. */
export function pickable(catalogue: readonly MetricInfo[], tab: TabDef): MetricInfo[] {
  const own = (m: MetricInfo): number =>
    tab.sides && m.side && !tab.sides.includes(m.side) ? 1 : 0
  return catalogue
    .filter((m) => appliesTo(m, tab))
    .sort(
      (a, b) =>
        own(a) - own(b) ||
        FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) ||
        a.label.localeCompare(b.label)
    )
}

/**
 * A family's metrics on a tab (its end's, for teams), core first; extended fill in up to 12, those
 * read from games before those published per season, since only the first answer any date range.
 */
function familyMetrics(
  catalogue: readonly MetricInfo[],
  tab: TabDef,
  family: MetricFamily
): string[] {
  const of = pickable(catalogue, tab).filter(
    (m) => m.family === family && (!tab.sides || !m.side || tab.sides.includes(m.side))
  )
  const core = of.filter((m) => m.tier === 'core')
  const extended = of.filter((m) => m.tier !== 'core')
  const fill = [
    ...extended.filter((m) => m.grains.includes('game')),
    ...extended.filter((m) => !m.grains.includes('game'))
  ].slice(0, Math.max(0, 12 - core.length))
  return [...core, ...fill].map((m) => m.id)
}

/** The families a tab has metrics of, for the family filter. */
export function familiesOf(catalogue: readonly MetricInfo[], tab: TabDef): MetricFamily[] {
  return FAMILIES.filter((f) => familyMetrics(catalogue, tab, f).length > 0)
}

/** One family's metrics on the tab. */
export function familyColumns(
  catalogue: readonly MetricInfo[],
  tab: TabDef,
  family: MetricFamily
): string[] {
  return familyMetrics(catalogue, tab, family).slice(0, MAX_COLUMNS)
}

/** Which column preset a board shows: the tab's, one family's, or columns of the user's own. */
export function familyOf(
  board: LeaderboardBoard,
  catalogue: readonly MetricInfo[],
  byId: ReadonlyMap<string, MetricInfo>
): MetricFamily | 'default' | 'custom' {
  const tab = tabOf(board.entity, board.tab)
  const same = (ids: string[]): boolean =>
    ids.length === board.columns.length && ids.every((id, i) => board.columns[i] === id)
  if (same(defaultBoard(board.entity, board.tab, byId).columns)) return 'default'
  return familiesOf(catalogue, tab).find((f) => same(familyColumns(catalogue, tab, f))) ?? 'custom'
}

/** The header groups over the columns: the tab's group names, a family for an added column. */
export function columnGroups(
  columns: readonly string[],
  tab: TabDef,
  catalogue: ReadonlyMap<string, MetricInfo>
): { label: string; span: number }[] {
  const named = new Map(tab.groups.flatMap(([label, ids]) => ids.map((id) => [id, label] as const)))
  const out: { label: string; span: number }[] = []
  for (const id of columns) {
    const info = catalogue.get(id)
    const label = named.get(id) ?? (info ? familyLabel(info.family) : '')
    const last = out[out.length - 1]
    if (last && last.label === label) last.span++
    else out.push({ label, span: 1 })
  }
  return out
}

/** The sort a board's query asks the engine for: its column, or the tab's (by name: the first). */
export function engineSort(
  board: LeaderboardBoard,
  catalogue: ReadonlyMap<string, MetricInfo>
): { metric: string; dir: 'asc' | 'desc' } {
  if (board.sort.by !== 'name' && board.columns.includes(board.sort.by)) {
    return { metric: board.sort.by, dir: board.sort.dir }
  }
  const tab = tabOf(board.entity, board.tab)
  const metric = board.columns.includes(tab.sort) ? tab.sort : board.columns[0]
  return { metric, dir: bestFirst(catalogue.get(metric)) }
}

/**
 * A board the catalogue can answer: a saved view may name metrics it no longer has. Unknown columns are
 * dropped (the tab's defaults if none is left), and a sort on a dropped column falls back to the
 * engine's. Before the catalogue loads, the board is left as it is.
 */
export function normalizeBoard(
  board: LeaderboardBoard,
  catalogue: ReadonlyMap<string, MetricInfo>
): LeaderboardBoard {
  if (catalogue.size === 0) return board
  const kept = board.columns.filter((id) => catalogue.has(id))
  if (kept.length === board.columns.length) return board
  const columns = kept.length > 0 ? kept : defaultBoard(board.entity, board.tab, catalogue).columns
  const next = { ...board, columns }
  if (next.sort.by === 'name' || columns.includes(next.sort.by)) return next
  const { metric, dir } = engineSort(next, catalogue)
  return { ...next, sort: { by: metric, dir } }
}

export function leaderboardQuery(
  board: LeaderboardBoard,
  scope: StatsScope,
  catalogue: ReadonlyMap<string, MetricInfo>
): StatsQuery {
  const fixed = normalizeBoard(board, catalogue)
  const tab = tabOf(fixed.entity, fixed.tab)
  const columns = fixed.columns
  const extra = tab.qualifier && !columns.includes(tab.qualifier) ? [tab.qualifier] : []
  // Qualification is the tab's (see `qualifies`), so the engine returns every row.
  return {
    entity: board.entity,
    metrics: [...columns, ...extra],
    scope: {
      ...queryScope(scope, board.entity),
      ...(tab.positions ? { positions: tab.positions } : {}),
      ...(board.team ? { teams: [board.team] } : {}),
      ...(board.split ? { split: board.split } : {})
    },
    transform: board.mode,
    sort: engineSort(fixed, catalogue),
    limit: ROW_LIMIT
  }
}

/** A row qualifies when its sample of the tab's qualifier is large enough (teams always do). */
export function qualifies(row: StatsRow, tab: TabDef): boolean {
  return !tab.qualifier || row.values[tab.qualifier]?.qualified === true
}

/**
 * Percentiles and ranks among the rows the tab qualifies, per position, as the engine computes them
 * (`percent_rank`, `rank`). The engine ranks a count among every row with a game, since a count's
 * sample has no minimum; the table shows the qualified rows, so it ranks among those. Rows outside
 * the tab's qualifier, or below a metric's own sample, get none. Teams keep the engine's.
 */
export function rankWithinTab(result: StatsResult, tab: TabDef): StatsResult {
  if (!tab.qualifier) return result
  const pools = new Map<string, number[]>()
  const key = (position: string | null, metric: string): string => `${position}|${metric}`
  const ranked = (r: StatsRow, metric: string): number | null => {
    const v = r.values[metric]
    return qualifies(r, tab) && v?.qualified && v.value !== null ? v.value : null
  }
  for (const r of result.rows) {
    for (const c of result.columns) {
      const v = ranked(r, c.id)
      if (v === null) continue
      const k = key(r.position, c.id)
      pools.set(k, [...(pools.get(k) ?? []), v])
    }
  }
  const lower = new Map(result.columns.map((c) => [c.id, c.direction === 'lower']))
  return {
    ...result,
    rows: result.rows.map((r) => ({
      ...r,
      values: Object.fromEntries(
        Object.entries(r.values).map(([id, v]) => {
          const x = ranked(r, id)
          const pool = pools.get(key(r.position, id))
          if (x === null || !pool) return [id, { ...v, percentile: null, rank: null }]
          const down = lower.get(id) ?? false
          const worse = pool.filter((y) => (down ? y > x : y < x)).length
          const better = pool.filter((y) => (down ? y < x : y > x)).length
          const percentile = pool.length > 1 ? (100 * worse) / (pool.length - 1) : 0
          return [id, { ...v, percentile, rank: better + 1 }]
        })
      )
    }))
  }
}

/** "Doncic" finds "Luka Dončić". */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
}

/**
 * The rows a leaderboard shows: the engine's, qualified ones only when asked, filtered by the search,
 * sorted by name when asked.
 */
export function leaderRows(
  result: StatsResult,
  board: LeaderboardBoard,
  search: string,
  /** A row opened from the home: shown even below the qualifier, greyed and marked NQ. */
  keep: string | null = null
): StatsRow[] {
  const needle = searchKey(search.trim())
  const tab = tabOf(board.entity, board.tab)
  const rows = result.rows.filter((r) => {
    if (board.qualifiedOnly && !qualifies(r, tab) && r.id !== keep) return false
    return !needle || searchKey(r.name).includes(needle)
  })
  if (board.sort.by !== 'name') return rows
  const dir = board.sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => a.name.localeCompare(b.name) * dir)
}

const csvCell = (v: string | number | null): string => {
  if (v === null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** The table as shown: numbers unformatted (percentages in percent), the rank, identity and games first. */
export function leaderboardCsv(
  rows: readonly StatsRow[],
  board: LeaderboardBoard,
  catalogue: ReadonlyMap<string, MetricInfo>
): string {
  const infos = board.columns.map((id) => catalogue.get(id))
  const player = board.entity === 'player'
  const head = [
    'Rank',
    player ? 'Player' : 'Team',
    ...(player ? ['Team', 'Position', 'Player id'] : ['Team id']),
    'Games',
    ...infos.map((m, i) => {
      if (!m) return board.columns[i]
      const per = isRescaled(m, board.mode) ? ` ${MODE_WORDS[board.mode]}` : ''
      return `${m.label}${per}${m.unit === 'pct' ? ' (%)' : ''}`
    })
  ]
  const lines = rows.map((r, i) => [
    i + 1,
    r.name,
    ...(player ? [r.team, r.position, r.id] : [r.id]),
    r.games,
    ...board.columns.map((id, j) => {
      const v = r.values[id]?.value ?? null
      if (v === null) return null
      const m = infos[j]
      const shown = m?.unit === 'pct' ? v * 100 : v
      return Number(shown.toFixed((m?.decimals ?? 2) + 2))
    })
  ])
  return [head, ...lines].map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** "stats-2025-26-guards-whole-season.csv". */
export function csvFileName(board: LeaderboardBoard, scope: StatsScope, range: string): string {
  const slug = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  const tab = tabOf(board.entity, board.tab)
  const name = board.entity === 'team' ? `teams ${tab.label}` : tab.label
  return `stats-${seasonLabel(scope.season)}-${slug(name)}-${slug(range)}.csv`
}
