import type { ExploreSubject } from '@/lib/stats/explore'
import { familyLabel, fmtStat } from '@/lib/stats/format'
import {
  pickable,
  qualifies,
  rankWithinTab,
  searchKey,
  tabOf,
  type TabDef
} from '@/lib/stats/leaderboard'
import type { RailPosition } from '@/lib/stats/player'
import { queryScope, rangeLabel, typeLabel, type StatsScope } from '@/lib/stats/scope'
import { seasonLabel } from '@shared/stats/seasons'
import type {
  BoardMode,
  Entity,
  MetricFamily,
  MetricInfo,
  StatsQuery,
  StatsResult,
  StatsRow,
  StatsTeam
} from '@shared/stats/types'

/**
 * The chart: any metric against any other, for the players at a position or the teams, in the scope
 * bar's scope. Size and colour read a third and fourth metric's percentile; colour can instead show
 * a category: the roster's position for players, the conference for teams.
 */
export interface ChartState {
  entity: Entity
  /** Players: all, or the guards, forwards or centers, as on the leaderboards. */
  position: RailPosition
  mode: BoardMode
  /** Null: the entity's first preset. */
  x: string | null
  y: string | null
  size: string | null
  /** A metric id, or `POSITION_COLOUR` / `CONFERENCE_COLOUR`. */
  colour: string | null
  /** Only this team's dots (team code for players, NBA id for teams); the axes stay the pool's. */
  team: string | null
  qualifiedOnly: boolean
  search: string
  /** Shift-clicked, up to `MAX_PICKS`: sent to Compare. */
  picks: string[]
  /** The table's order: by a metric's percentile, best first (1) or worst first (-1), or by name. */
  sort: { by: string; dir: 1 | -1 }
}

export const DEFAULT_CHART: ChartState = {
  entity: 'player',
  position: 'ALL',
  mode: 'perGame',
  x: null,
  y: null,
  size: null,
  colour: null,
  team: null,
  qualifiedOnly: true,
  search: '',
  picks: [],
  sort: { by: 'y', dir: 1 }
}

/** Colour by the roster's position (players) or the conference (teams), not by a metric. */
export const POSITION_COLOUR = '@position'
export const CONFERENCE_COLOUR = '@conference'

export const isCategory = (colour: string | null): boolean =>
  colour === POSITION_COLOUR || colour === CONFERENCE_COLOUR

/** The same chart for the other entity or position: its own axes, no picks or filters. */
export function resetChart(state: ChartState, next: Partial<ChartState>): ChartState {
  return {
    ...state,
    ...next,
    x: null,
    y: null,
    size: null,
    colour: null,
    team: null,
    search: '',
    picks: [],
    sort: DEFAULT_CHART.sort
  }
}

/** Shift-click picks this many for Compare: its three slots. */
export const MAX_PICKS = 3

/** Below this many dots a scatter says nothing: "Too few qualifiers to chart". */
export const MIN_DOTS = 10

export interface ChartPreset {
  label: string
  x: string
  y: string
}

/**
 * A volume or role against an efficiency. Drives against points per drive is a tracking pair: it
 * answers for whole seasons from 2013-14, and says so otherwise.
 */
export const PRESETS: Record<Entity, ChartPreset[]> = {
  player: [
    { label: 'Usage vs efficiency', x: 'usg_pct', y: 'ts_pct' },
    { label: 'Threes: volume vs accuracy', x: 'fg3a', y: 'fg3_pct' },
    { label: 'Creating vs care', x: 'ast_pct', y: 'tov_pct' },
    { label: 'Drives vs points per drive', x: 'drives', y: 'drive_pts_per_drive' }
  ],
  team: [
    { label: 'Offense vs defense', x: 'team_ortg', y: 'team_drtg' },
    { label: 'Pace vs net rating', x: 'team_pace', y: 'team_nrtg' },
    { label: 'Three-point rate vs shooting', x: 'team_fg3a_rate', y: 'team_ts_pct' }
  ]
}

/** The axes shown: the state's, else the first preset's. */
export function chartAxes(state: ChartState): { x: string; y: string } {
  const first = PRESETS[state.entity][0]
  return { x: state.x ?? first.x, y: state.y ?? first.y }
}

/** The metrics sized or coloured by, and in the table, besides the axes. */
export function chartExtras(state: ChartState, axes: { x: string; y: string }): string[] {
  const colour = isCategory(state.colour) ? null : state.colour
  return [...new Set([state.size, colour])].filter(
    (m): m is string => m !== null && m !== axes.x && m !== axes.y
  )
}

/** The leaderboard tab whose qualifier and pools the chart uses: the position's, or the teams'. */
export function chartTab(state: Pick<ChartState, 'entity' | 'position'>): TabDef {
  return state.entity === 'player' ? tabOf('player', state.position) : tabOf('team', 'offense')
}

/** The metrics the selectors offer, by family: the leaderboards' column picker's. */
export function chartMetrics(
  catalogue: readonly MetricInfo[],
  entity: Entity
): { family: MetricFamily; label: string; metrics: MetricInfo[] }[] {
  const all = pickable(catalogue, tabOf(entity, entity === 'player' ? 'ALL' : 'offense'))
  const families = [...new Set(all.map((m) => m.family))]
  return families.map((family) => ({
    family,
    label: familyLabel(family),
    metrics: all.filter((m) => m.family === family)
  }))
}

/** Size and colour read a percentile: metrics with a better side only. */
export function scaled(metrics: readonly MetricInfo[]): MetricInfo[] {
  return metrics.filter((m) => m.direction !== 'neutral')
}

/** The engine's most: a season's players fit (about 600), and teams are 30. */
export const CHART_ROWS = 5000

/**
 * One query: the axes, size and colour, and the tab's qualifier, for every row of the position (a
 * percentile is among the position) or every team. Qualification is the leaderboard's, applied here.
 */
export function chartQuery(
  state: Pick<ChartState, 'entity' | 'position' | 'mode'>,
  metrics: readonly string[],
  scope: StatsScope
): StatsQuery {
  const tab = chartTab(state)
  const all = [...new Set([...metrics, ...(tab.qualifier ? [tab.qualifier] : [])])]
  return {
    entity: state.entity,
    metrics: all,
    scope: {
      ...queryScope(scope, state.entity),
      ...(tab.positions ? { positions: tab.positions } : {})
    },
    transform: state.mode,
    sort: { metric: tab.qualifier ?? metrics[0], dir: 'desc' },
    limit: CHART_ROWS
  }
}

/**
 * Why an axis has nothing to plot, in the engine's words: "Drives: Published for whole seasons
 * only.", "Drives: Recorded from 2013-14."; null when both have values.
 */
export function missingAxis(
  result: StatsResult,
  axes: readonly string[],
  byId: ReadonlyMap<string, MetricInfo>
): string | null {
  for (const id of axes) {
    const column = result.columns.find((c) => c.id === id)
    if (!column?.reason) continue
    return `${byId.get(id)?.label ?? column.label}: ${column.reason}`
  }
  return null
}

export interface ChartDot {
  id: string
  name: string
  /** Players: the team's code; teams: their own code. */
  team: string | null
  position: string | null
  x: number
  y: number
  /** The tab's qualifier and both axes' own samples. */
  qualified: boolean
  /** By metric (axes, size, colour). */
  values: Record<string, number | null>
  /** 0–100 among the qualified of the same position (players) or the teams; null otherwise. */
  percentiles: Record<string, number | null>
  /** The colour category's value: G, F, C, or East, West; null when none or not coloured so. */
  category: string | null
  /** The search finds it. */
  matched: boolean
  /** 0–2: its slot in Compare; -1 not picked. */
  pick: number
  games: number
  /** The y axis's sample ("1,204 true shooting attempts"). */
  sample: number | null
}

export type ChartView =
  | { kind: 'missing'; text: string }
  | {
      kind: 'few'
      /** Rows that qualify on both axes. */
      qualified: number
      /** Rows with both values. */
      all: number
    }
  | {
      kind: 'ready'
      /** The dots shown, the special ones (searched, picked) last so they draw on top. */
      dots: ChartDot[]
      /** The axes' domains: every dot the filters would show but the team's. */
      domain: { x: [number, number]; y: [number, number] }
      /** The qualified mean of each axis: the quadrant lines. */
      mean: { x: number; y: number }
      /** Pearson r with both axes oriented, so positive is better on both; null under 3 dots. */
      r: number | null
      /** Qualified rows on both axes. */
      qualified: number
      /** The picks still plotted, in order: Compare's slots. */
      picks: { id: string; name: string }[]
      /** The engine stopped at its row limit: some rows are not plotted. */
      truncated: { shown: number; total: number } | null
    }

const valueOf = (r: StatsRow, id: string): number | null => r.values[id]?.value ?? null

/** "East", "West", from the season's teams; null for a team the season does not list. */
function conferenceOf(teams: readonly StatsTeam[], id: string): string | null {
  const c = teams.find((t) => t.id === id)?.conference
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : null
}

/**
 * The dots: rows with both values, qualified ones only when asked (the leaderboard's rule: the
 * tab's minutes, scaled to the games in scope, and each axis's own sample), one team's only when
 * asked; percentiles among the qualified of the same position, as on the leaderboards.
 */
export function chartView(
  result: StatsResult,
  state: ChartState,
  byId: ReadonlyMap<string, MetricInfo>,
  teams: readonly StatsTeam[] = []
): ChartView {
  const axes = chartAxes(state)
  const missing = missingAxis(result, [axes.x, axes.y], byId)
  if (missing) return { kind: 'missing', text: missing }
  const isPlayer = state.entity === 'player'
  const tab = chartTab(state)
  const ranked = rankWithinTab(result, tab)
  const metrics = [axes.x, axes.y, ...chartExtras(state, axes)]
  const rows = ranked.rows.filter((r) => valueOf(r, axes.x) !== null && valueOf(r, axes.y) !== null)
  const ok = (r: StatsRow): boolean =>
    qualifies(r, tab) &&
    r.values[axes.x]?.qualified === true &&
    r.values[axes.y]?.qualified === true
  const pool = rows.filter(ok)
  const plotted = state.qualifiedOnly ? pool : rows
  if (plotted.length < MIN_DOTS) return { kind: 'few', qualified: pool.length, all: rows.length }

  const code = (r: StatsRow): string | null =>
    isPlayer ? r.team : (teams.find((t) => t.id === r.id)?.code ?? r.team)
  const needle = searchKey(state.search.trim())
  const finds = (r: StatsRow): boolean =>
    needle.length > 1 &&
    (searchKey(r.name).includes(needle) || (!isPlayer && searchKey(code(r) ?? '') === needle))
  const picked = state.picks.flatMap((id) => plotted.filter((r) => r.id === id))
  const picks = picked.map((r) => r.id)
  const category = (r: StatsRow): string | null =>
    state.colour === POSITION_COLOUR && isPlayer
      ? r.position
      : state.colour === CONFERENCE_COLOUR && !isPlayer
        ? conferenceOf(teams, r.id)
        : null
  const dot = (r: StatsRow): ChartDot => ({
    id: r.id,
    name: r.name,
    team: code(r),
    position: r.position,
    x: valueOf(r, axes.x)!,
    y: valueOf(r, axes.y)!,
    qualified: ok(r),
    values: Object.fromEntries(metrics.map((m) => [m, valueOf(r, m)])),
    percentiles: Object.fromEntries(metrics.map((m) => [m, r.values[m]?.percentile ?? null])),
    category: category(r),
    matched: finds(r),
    pick: picks.indexOf(r.id),
    games: r.games,
    sample: r.values[axes.y]?.sample ?? null
  })
  const special = (d: ChartDot): boolean => d.matched || d.pick >= 0
  const inTeam = (r: StatsRow): boolean => !state.team || (isPlayer ? r.team : r.id) === state.team
  const shown = plotted.filter(inTeam).map(dot)
  const span = (vs: number[]): [number, number] => [Math.min(...vs), Math.max(...vs)]
  const mean = (vs: number[]): number => vs.reduce((t, v) => t + v, 0) / vs.length
  const sign = (id: string): number => (byId.get(id)?.direction === 'lower' ? -1 : 1)
  const centre = pool.length ? pool : plotted
  return {
    kind: 'ready',
    dots: [...shown.filter((d) => !special(d)), ...shown.filter(special)],
    domain: {
      x: span(plotted.map((r) => valueOf(r, axes.x)!)),
      y: span(plotted.map((r) => valueOf(r, axes.y)!))
    },
    mean: {
      x: mean(centre.map((r) => valueOf(r, axes.x)!)),
      y: mean(centre.map((r) => valueOf(r, axes.y)!))
    },
    r: pearson(
      shown.map((d) => d.x * sign(axes.x)),
      shown.map((d) => d.y * sign(axes.y))
    ),
    qualified: pool.length,
    picks: picked.map((r) => ({ id: r.id, name: r.name })),
    truncated:
      result.total > result.rows.length ? { shown: result.rows.length, total: result.total } : null
  }
}

/** Pearson's r; null under three points or with no spread. */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((t, v) => t + v, 0) / n
  const my = ys.reduce((t, v) => t + v, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null
}

/** Corner words, [better, worse], for the presets' metrics; others read "high …" / "low …". */
const WORDS: Record<string, [string, string]> = {
  usg_pct: ['high usage', 'low usage'],
  ts_pct: ['efficient', 'inefficient'],
  fg3a: ['high volume', 'low volume'],
  fg3_pct: ['accurate', 'inaccurate'],
  ast_pct: ['creator', 'few assists'],
  tov_pct: ['careful', 'turnover-prone'],
  drives: ['drives a lot', 'few drives'],
  drive_pts_per_drive: ['scores on drives', 'little from drives'],
  team_ortg: ['good offense', 'poor offense'],
  team_drtg: ['good defense', 'poor defense'],
  team_pace: ['fast', 'slow'],
  team_nrtg: ['outscores', 'outscored'],
  team_fg3a_rate: ['shoots threes', 'few threes'],
  team_ts_pct: ['efficient', 'inefficient']
}

/** A label's first letter lowered ("assists"), unless it starts an acronym ("NBA"). */
function lowerFirst(s: string): string {
  return /^[A-Z][A-Z]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1)
}

function words(info: MetricInfo | undefined, id: string): [string, string] {
  if (WORDS[id]) return WORDS[id]
  const s = lowerFirst(info?.label ?? id)
  return info?.direction === 'lower' ? [`low ${s}`, `high ${s}`] : [`high ${s}`, `low ${s}`]
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The four corners' labels: up and right is better on both (a lower-is-better axis runs reversed). A
 * metric with no better side reads high to the right and up.
 */
export function corners(
  x: MetricInfo | undefined,
  xId: string,
  y: MetricInfo | undefined,
  yId: string
): { tl: string; tr: string; bl: string; br: string } {
  const [xg, xb] = words(x, xId)
  const [yg, yb] = words(y, yId)
  return {
    tr: cap(`${xg}, ${yg}`),
    tl: cap(`${xb}, ${yg}`),
    br: cap(`${xg}, ${yb}`),
    bl: cap(`${xb}, ${yb}`)
  }
}

/** "True shooting percentage vs usage percentage". */
export function chartTitle(
  x: MetricInfo | undefined,
  xId: string,
  y: MetricInfo | undefined,
  yId: string
): string {
  return `${y?.label ?? yId} vs ${lowerFirst(x?.label ?? xId)}`
}

/** "guards", "players", "teams": who the dots are, in a sentence. */
export function whoWords(state: Pick<ChartState, 'entity' | 'position'>): string {
  if (state.entity === 'team') return 'teams'
  return state.position === 'ALL' ? 'players' : lowerFirst(chartTab(state).label)
}

/**
 * The designed state when too few qualify: how many, in what scope, and why.
 * "6 centers qualify on both axes in the last 5 games. A scatter needs at least 10: a player
 * qualifies with enough minutes for the games in scope, and enough of each axis's own sample."
 */
export function fewNote(
  qualified: number,
  state: Pick<ChartState, 'entity' | 'position'>,
  scope: StatsScope
): string {
  const range = rangeLabel(scope, state.entity)
  const when =
    scope.range.kind === 'season'
      ? `the ${seasonLabel(scope.season)} ${typeLabel(scope.seasonType).toLowerCase()}`
      : scope.range.kind === 'dates'
        ? `${range} (${seasonLabel(scope.season)})`
        : lowerFirst(range.replace("Team's", "their team's"))
  const why =
    state.entity === 'player'
      ? 'a player qualifies with enough minutes for the games in scope, and enough of each axis’s own sample'
      : 'a team qualifies with enough of each axis’s own sample'
  const verb = qualified === 1 ? 'qualifies' : 'qualify'
  const who = qualified === 1 ? whoWords(state).replace(/s$/, '') : whoWords(state)
  return `${qualified} ${who} ${verb} on both axes in ${when}. A scatter needs at least ${MIN_DOTS}: ${why}.`
}

/** An axis's label: "Turnover percentage ↓" when lower is better (it runs reversed). */
export function axisLabel(info: MetricInfo | undefined, id: string): string {
  return `${info?.label ?? id}${info?.direction === 'lower' ? ' ↓' : ''}`
}

/** Round tick steps: 1, 2, 2.5, 5 × a power of ten. */
export function ticks(lo: number, hi: number, n: number): number[] {
  const raw = (hi - lo || Math.abs(hi) || 1) / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step)
    out.push(Number(v.toFixed(6)))
  return out
}

/** The scatter's box: the plot sits inside the margins. */
export const PLOT = { width: 952, height: 430, left: 56, right: 18, top: 28, bottom: 44 }

export interface Scales {
  x: (v: number) => number
  y: (v: number) => number
  xTicks: number[]
  yTicks: number[]
}

/** The axes' scales, padded 7 %; a lower-is-better axis reversed so up and right is better. */
export function scales(
  domain: { x: [number, number]; y: [number, number] },
  flip: { x: boolean; y: boolean }
): Scales {
  const pad = ([lo, hi]: [number, number]): [number, number] => {
    const p = (hi - lo) * 0.07 || Math.abs(hi) * 0.1 || 1
    return [lo - p, hi + p]
  }
  const [x0, x1] = pad(domain.x)
  const [y0, y1] = pad(domain.y)
  const w = PLOT.width - PLOT.left - PLOT.right
  const h = PLOT.height - PLOT.top - PLOT.bottom
  const along = (v: number, lo: number, hi: number, reversed: boolean): number => {
    const t = (v - lo) / (hi - lo)
    return reversed ? 1 - t : t
  }
  return {
    x: (v) => PLOT.left + along(v, x0, x1, flip.x) * w,
    y: (v) => PLOT.top + (1 - along(v, y0, y1, flip.y)) * h,
    xTicks: ticks(x0, x1, 7).filter((v) => v >= x0 && v <= x1),
    yTicks: ticks(y0, y1, 6).filter((v) => v >= y0 && v <= y1)
  }
}

export interface LabelItem {
  id: string
  text: string
  cx: number
  cy: number
  r: number
  kind: 'strong' | 'muted' | 'team'
}

export interface PlacedLabel extends LabelItem {
  /** The label's left and top. */
  left: number
  top: number
}

/** Labels in order of importance, each right, left, above or below its dot; skipped on a collision. */
export function placeLabels(items: readonly LabelItem[], charWidth: number): PlacedLabel[] {
  const [L, R] = [PLOT.left + 2, PLOT.width - PLOT.right - 2]
  const [T, B] = [PLOT.top + 2, PLOT.height - PLOT.bottom - 2]
  const boxes: { l: number; t: number; w: number; h: number }[] = []
  const out: PlacedLabel[] = []
  for (const it of items) {
    const w = it.text.length * charWidth + 2
    const h = 13
    const o = it.r + 4
    const spots: [number, number][] = [
      [it.cx + o, it.cy - 7],
      [it.cx - o - w, it.cy - 7],
      [it.cx - w / 2, it.cy - it.r - 16],
      [it.cx - w / 2, it.cy + it.r + 3]
    ]
    const hit = spots.find(
      ([l, t]) =>
        l >= L &&
        l + w <= R &&
        t >= T &&
        t + h <= B &&
        !boxes.some((b) => l < b.l + b.w && l + w > b.l && t < b.t + b.h && t + h > b.t)
    )
    if (!hit) continue
    boxes.push({ l: hit[0], t: hit[1], w, h })
    out.push({ ...it, left: hit[0], top: hit[1] })
  }
  return out
}

/** How many of the dots farthest from the crowd a player chart labels. */
export const EXTREME_LABELS = 8

/** "L. Dončić"; a team by its code. */
export function shortName(
  entity: Entity,
  dot: Pick<ChartDot, 'id' | 'name'> & { team?: string | null }
): string {
  return entity === 'team' ? (dot.team ?? dot.name) : dot.name.replace(/^(\S)\S*\s/, '$1. ')
}

/**
 * What gets a label: searched and picked dots, then (players) the eight farthest from the crowd (in
 * standard deviations on both axes, so a dense corner does not take them all), or (teams) every team.
 */
export function labelItems(
  entity: Entity,
  dots: readonly ChartDot[],
  at: (d: ChartDot) => { cx: number; cy: number; r: number }
): LabelItem[] {
  const item = (d: ChartDot, kind: LabelItem['kind']): LabelItem => ({
    id: d.id,
    text: shortName(entity, d),
    ...at(d),
    kind
  })
  const strong = dots.filter((d) => d.matched || d.pick >= 0)
  const rest = dots.filter((d) => !d.matched && d.pick < 0)
  const spots = dots.map(at)
  const spread = (vs: number[]): [number, number] => {
    const m = vs.reduce((t, v) => t + v, 0) / (vs.length || 1)
    const sd = Math.sqrt(vs.reduce((t, v) => t + (v - m) ** 2, 0) / (vs.length || 1)) || 1
    return [m, sd]
  }
  const [mx, sx] = spread(spots.map((p) => p.cx))
  const [my, sy] = spread(spots.map((p) => p.cy))
  const far = (d: ChartDot): number => {
    const { cx, cy } = at(d)
    return ((cx - mx) / sx) ** 2 + ((cy - my) / sy) ** 2
  }
  const others =
    entity === 'team' ? rest : [...rest].sort((a, b) => far(b) - far(a)).slice(0, EXTREME_LABELS)
  return [
    ...strong.map((d) => item(d, 'strong')),
    ...others.map((d) => item(d, entity === 'team' ? 'team' : 'muted'))
  ]
}

/** A dot's radius: by the size metric's percentile (3.5 + 6.5 × p), else 4.5 (players) or 6.5. */
export function dotRadius(entity: Entity, dot: ChartDot, size: string | null): number {
  if (size === null) return entity === 'team' ? 6.5 : 4.5
  return 3.5 + 6.5 * ((dot.percentiles[size] ?? 50) / 100)
}

/** The category colours: a series colour each, in a fixed order so a legend reads the same. */
export const CATEGORIES: Record<string, string[]> = {
  [POSITION_COLOUR]: ['G', 'F', 'C'],
  [CONFERENCE_COLOUR]: ['East', 'West']
}
const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)']

/** The fill for a category value; grey for one the roster does not give. */
export function categoryColour(colour: string, value: string | null): string {
  const i = value === null ? -1 : (CATEGORIES[colour]?.indexOf(value) ?? -1)
  return i < 0 ? 'var(--fg-3)' : SERIES[i % SERIES.length]
}

/** The table's rows: by a metric's percentile (best first, unranked last), or by name. */
export function chartRows(
  dots: readonly ChartDot[],
  sort: ChartState['sort'],
  axes: { x: string; y: string }
): ChartDot[] {
  const metric = sort.by === 'x' ? axes.x : sort.by === 'y' ? axes.y : sort.by
  return [...dots].sort((a, b) => {
    if (sort.by === 'name') return sort.dir * a.name.localeCompare(b.name)
    const pa = a.percentiles[metric] ?? null
    const pb = b.percentiles[metric] ?? null
    if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1
    return sort.dir * (pb - pa)
  })
}

/** "58.2%", "−3.1", "21.4" (a count per game with one decimal). */
export function chartValue(
  info: MetricInfo | undefined,
  v: number | null,
  mode: BoardMode
): string {
  return fmtStat(
    v,
    {
      unit: info?.unit ?? 'number',
      decimals: info?.decimals ?? 1,
      aggregation: info?.aggregation,
      totalOnly: info?.totalOnly,
      perGameOnly: info?.perGameOnly
    },
    mode
  )
}

const MODE_WORDS: Record<BoardMode, string> = {
  raw: 'totals',
  perGame: 'per game',
  per36: 'per 36 minutes',
  per48: 'per 48 minutes',
  per100: 'per 100 possessions'
}

/** "Guards · 2025-26 · Regular season · Whole season · per game". */
export function chartSubtitle(
  state: Pick<ChartState, 'entity' | 'position' | 'mode'>,
  scope: StatsScope
): string {
  return [
    cap(whoWords(state)),
    seasonLabel(scope.season),
    typeLabel(scope.seasonType),
    rangeLabel(scope, state.entity),
    MODE_WORDS[state.mode]
  ].join(' · ')
}

/** The picks as Compare's subjects, in order. */
export function compareSubjects(entity: Entity, picks: readonly string[]): ExploreSubject[] {
  return picks.map((id) => ({ entity, id }))
}
