import { covers, coverageReason } from '@shared/stats/coverage'
import { seasonLabel } from '@shared/stats/seasons'
import type {
  BoardMode,
  Entity,
  MetricFamily,
  MetricInfo,
  StatsQuery,
  StatsResult,
  StatsRow,
  StatsSeason,
  StatsStatus
} from '@shared/stats/types'
import type { ExploreSubject } from './explore'
import { fmtStat, isRescaled, ordinal } from './format'
import { queryScope, type StatsScope } from './scope'

/** Trends: one metric by season across a player's career or a team's history. */
export type TrendEntity = Entity

/** A player or a team, as Explore names one. */
export type TrendSubject = ExploreSubject

/** Whose seasons Trends shows and how, kept for the session. */
export interface TrendsState {
  /** Null until one is picked or opened: Trends then shows the last dashboard's, while `follow`. */
  subject: TrendSubject | null
  metric: string | null
  /** Players or teams, when nobody is shown. */
  entity: TrendEntity
  mode: BoardMode
  /** Off once the Players/Teams switch is used: the dashboard's subject no longer stands in. */
  follow: boolean
}

export const DEFAULT_TRENDS: TrendsState = {
  subject: null,
  metric: null,
  entity: 'player',
  mode: 'perGame',
  follow: true
}

/** Trends opened from another screen on this player or team; no metric keeps the one shown. */
export function trendsFor(state: TrendsState, subject: TrendSubject, metric?: string): TrendsState {
  return { ...state, subject, metric: metric ?? state.metric }
}

/** Who Trends shows: the one picked or opened, else the dashboard's while following. */
export function trendSubject(
  state: TrendsState,
  fallback: TrendSubject | null
): TrendSubject | null {
  return state.subject ?? (state.follow ? fallback : null)
}

/** The metric Trends opens on, when none is picked. */
export const DEFAULT_METRIC: Record<TrendEntity, string> = { player: 'pts', team: 'team_nrtg' }

/** The first season with box scores, 1993-94. */
export const FIRST_SEASON = 1994

/** The leaderboard's qualifier for players: minutes, scaled to each season's games. */
export const QUALIFIER = 'min'

/**
 * Seasons per pool query to begin with. A season has about 260 to 285 players over the minutes
 * qualifier and the engine returns at most 5,000 rows, so a career is asked for in parts of 14
 * seasons (at most about 4,000 rows each); a part cut off at the limit is asked for again in halves.
 */
export const POOL_CHUNK = 14

const ROW_LIMIT = 5000

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

/** A count of games is the row's own column. */
const GAMES = new Set(['gp', 'team_gp'])

/**
 * Whether a metric can be charted by season: read per season, shown on screens, and not one season's
 * state (a projection), which means nothing across several.
 */
export function trendable(info: MetricInfo | undefined, entity: TrendEntity): boolean {
  return (
    !!info &&
    info.entity === entity &&
    info.tier !== 'stored' &&
    info.grains.includes('season') &&
    !info.oneSeason &&
    !info.unavailable &&
    !GAMES.has(info.id)
  )
}

/** The metric select: every metric for the entity, grouped by family, in the catalogue's order. */
export function trendMetrics(
  entity: TrendEntity,
  catalogue: readonly MetricInfo[]
): { family: MetricFamily; metrics: MetricInfo[] }[] {
  return FAMILIES.map((family) => ({
    family,
    metrics: catalogue.filter((m) => m.family === family && trendable(m, entity))
  })).filter((g) => g.metrics.length > 0)
}

/** The metric shown: the one picked if it can be charted, else the default, else the first offered. */
export function trendMetric(
  picked: string | null,
  entity: TrendEntity,
  byId: ReadonlyMap<string, MetricInfo>,
  catalogue: readonly MetricInfo[]
): string | null {
  if (picked && trendable(byId.get(picked), entity)) return picked
  if (trendable(byId.get(DEFAULT_METRIC[entity]), entity)) return DEFAULT_METRIC[entity]
  return catalogue.find((m) => trendable(m, entity))?.id ?? null
}

/** Every season in the data: 1993-94 through the one the data runs through. */
export function trendSeasons(status: StatsStatus | null, now = new Date()): number[] {
  const last = Math.max(FIRST_SEASON, status?.through?.season ?? now.getUTCFullYear())
  return Array.from({ length: last - FIRST_SEASON + 1 }, (_, i) => FIRST_SEASON + i)
}

/** The scope bar's season type; its season and range do not limit a career. */
const gameTypes = (scope: StatsScope): StatsQuery['scope']['gameTypes'] =>
  queryScope({ ...scope, range: { kind: 'season' } }, 'player').gameTypes

const metricsOf = (entity: TrendEntity, metric: string): string[] =>
  entity === 'player' && metric !== QUALIFIER ? [metric, QUALIFIER] : [metric]

/** The subject's own rows by season: every season they played, qualified or not. */
export function subjectQuery(
  entity: TrendEntity,
  id: string,
  metric: string,
  seasons: readonly number[],
  scope: StatsScope,
  mode: BoardMode
): StatsQuery {
  return {
    entity,
    metrics: metricsOf(entity, metric),
    scope: {
      seasons: [...seasons],
      gameTypes: gameTypes(scope),
      ...(entity === 'player' ? { players: [id] } : { teams: [id] })
    },
    groupBy: ['season'],
    transform: mode,
    limit: seasons.length
  }
}

/**
 * A player's teams: their minutes by season, team and month, so a traded player's teams are named
 * in the order they played for them. About seven rows a season.
 */
export function teamsQuery(
  player: string,
  seasons: readonly number[],
  scope: StatsScope
): StatsQuery {
  return {
    entity: 'player',
    metrics: [QUALIFIER],
    scope: { seasons: [...seasons], gameTypes: gameTypes(scope), players: [player] },
    groupBy: ['season', 'team', 'month'],
    transform: 'raw',
    limit: ROW_LIMIT
  }
}

/** The span split into runs of at most `size` seasons. */
export function chunks(seasons: readonly number[], size = POOL_CHUNK): number[][] {
  const out: number[][] = []
  for (let i = 0; i < seasons.length; i += size) out.push(seasons.slice(i, i + size))
  return out
}

/** The pool's parts to begin with: a player's career in runs of `POOL_CHUNK` seasons, a team's whole. */
export function poolParts(entity: TrendEntity, span: readonly number[]): number[][] {
  if (!span.length) return []
  return entity === 'player' ? chunks(span) : [[...span]]
}

const partKey = (seasons: readonly number[]): string =>
  `${seasons[0]}-${seasons[seasons.length - 1]}`

/**
 * The pool each season ranks in, one query a part of the span. `qualifiedOnly` with the sort on
 * minutes leaves out players under the leaderboard's minutes qualifier; the metric's own sample
 * (attempts for a shooting rate) is applied from each row's `qualified` flag in `seasonPool`, as
 * the leaderboard's `rankWithinTab` does. Every team is in.
 */
export function poolQueries(
  entity: TrendEntity,
  metric: string,
  parts: readonly (readonly number[])[],
  scope: StatsScope,
  mode: BoardMode
): Map<string, StatsQuery> {
  return new Map(
    parts.map((seasons) => [
      partKey(seasons),
      {
        entity,
        metrics: metricsOf(entity, metric),
        scope: {
          seasons: [...seasons],
          gameTypes: gameTypes(scope),
          ...(entity === 'player' ? { qualifiedOnly: true } : {})
        },
        groupBy: ['season'],
        transform: mode,
        sort: { metric: entity === 'player' ? QUALIFIER : metric, dir: 'desc' },
        limit: ROW_LIMIT
      } satisfies StatsQuery
    ])
  )
}

const cutOff = (r: StatsResult | undefined): boolean => !!r && r.total > r.rows.length

/**
 * The parts again with each one cut off at the row limit split in half; null when none can be split
 * (all whole, or only single seasons cut off), so the answers stand.
 */
export function refineParts(
  parts: readonly (readonly number[])[],
  results: ReadonlyMap<string, StatsResult>
): number[][] | null {
  let split = false
  const out = parts.flatMap((seasons) => {
    if (seasons.length > 1 && cutOff(results.get(partKey(seasons)))) {
      split = true
      const half = Math.ceil(seasons.length / 2)
      return [seasons.slice(0, half), seasons.slice(half)]
    }
    return [[...seasons]]
  })
  return split ? out : null
}

/**
 * The pool queries' rows together, and the seasons whose part was still cut off at the row limit:
 * those have no league to read, so no band and no rank.
 */
export function mergePool(results: ReadonlyMap<string, StatsResult> | null): {
  rows: StatsRow[]
  unavailable: Set<number>
} | null {
  if (!results) return null
  const unavailable = new Set<number>()
  const rows: StatsRow[] = []
  for (const r of results.values()) {
    if (cutOff(r)) for (const x of r.rows) unavailable.add(seasonOf(x))
    else rows.push(...r.rows)
  }
  return { rows, unavailable }
}

/** What the chart says about seasons with no league. */
export function poolNote(unavailable: ReadonlySet<number>): string | null {
  if (!unavailable.size) return null
  const seasons = [...unavailable].sort((a, b) => a - b).map(seasonLabel)
  return `Too many players to read the league in ${seasons.join(', ')}: no band or rank.`
}

const seasonOf = (r: StatsRow): number => Number(r.group.season)

/** The seasons a player or team has games in: from the first to the last, a missed season kept. */
export function careerSpan(result: StatsResult | null, seasons: readonly number[]): number[] {
  const has = new Set((result?.rows ?? []).filter((r) => r.games > 0).map(seasonOf))
  const first = seasons.findIndex((s) => has.has(s))
  if (first < 0) return []
  let last = seasons.length - 1
  while (!has.has(seasons[last])) last--
  return seasons.slice(first, last + 1)
}

/** A row's value when it counts for the pool: the qualifier (players) and the metric's own sample. */
function pooled(r: StatsRow, metric: string, entity: TrendEntity): number | null {
  if (entity === 'player' && r.values[QUALIFIER]?.qualified !== true) return null
  const v = r.values[metric]
  return v?.qualified && v.value !== null && Number.isFinite(v.value) ? v.value : null
}

/** A season's pool: the values of its qualified rows, by id. */
export function seasonPool(
  rows: readonly StatsRow[],
  season: number,
  metric: string,
  entity: TrendEntity
): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (seasonOf(r) !== season) continue
    const v = pooled(r, metric, entity)
    if (v !== null) out.set(r.id, v)
  }
  return out
}

/**
 * A value's place in its pool, the better side first: tied values share a rank (1, 2, 2, 4), as the
 * engine's `rank`, and the percentile is the share of the rest it beats, as `percent_rank`. A metric
 * with no better side ranks higher first, as the leaderboard sorts it.
 */
export function rankIn(
  pool: readonly number[],
  value: number,
  direction: MetricInfo['direction']
): { rank: number; of: number; percentile: number } {
  const down = direction === 'lower'
  const better = pool.filter((y) => (down ? y < value : y > value)).length
  const worse = pool.filter((y) => (down ? y > value : y < value)).length
  return {
    rank: better + 1,
    of: pool.length,
    percentile: pool.length > 1 ? (100 * worse) / (pool.length - 1) : 100
  }
}

/** Linear interpolation between the closest ranks, as DuckDB's `quantile_cont`. */
export function quantile(sorted: readonly number[], q: number): number | null {
  if (!sorted.length) return null
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo)
}

export interface BandPoint {
  season: number
  /** The pool's size. */
  n: number
  p10: number | null
  p25: number | null
  median: number | null
  p75: number | null
  p90: number | null
}

/** The league each season: the 10th, 25th, 50th, 75th and 90th percentile values of its pool. */
export function trendBand(
  rows: readonly StatsRow[],
  metric: string,
  seasons: readonly number[],
  entity: TrendEntity,
  unavailable: ReadonlySet<number> = new Set()
): BandPoint[] {
  return seasons.map((season) => {
    const vs = unavailable.has(season)
      ? []
      : [...seasonPool(rows, season, metric, entity).values()].sort((a, b) => a - b)
    return {
      season,
      n: vs.length,
      p10: quantile(vs, 0.1),
      p25: quantile(vs, 0.25),
      median: quantile(vs, 0.5),
      p75: quantile(vs, 0.75),
      p90: quantile(vs, 0.9)
    }
  })
}

/** A player's teams each season, in the order they played for them, from `teamsQuery`'s rows. */
export function teamsBySeason(result: StatsResult | null): Map<number, string[]> {
  // A season runs October to June (the 2020 restart into October): September first, then on.
  const order = (month: number): number => (month + 3) % 12
  const first = new Map<number, Map<string, number>>()
  for (const r of result?.rows ?? []) {
    if (r.games <= 0) continue
    const season = seasonOf(r)
    const team = r.team ?? String(r.group.team ?? '')
    if (!team) continue
    const m = order(Number(r.group.month))
    const teams = first.get(season) ?? new Map<string, number>()
    teams.set(team, Math.min(teams.get(team) ?? m, m))
    first.set(season, teams)
  }
  return new Map(
    [...first].map(([season, teams]) => [
      season,
      [...teams].sort((a, b) => a[1] - b[1]).map(([t]) => t)
    ])
  )
}

export interface TrendPoint {
  season: number
  /** Null outside the metric's coverage, in a season not played, or without a value. */
  value: number | null
  /** The subject has games that season. */
  played: boolean
  /** The source has the metric that season. */
  covered: boolean
  /** In that season's pool, as the leaderboard draws it. */
  qualified: boolean
  /** The season's league could be read (not cut off at the row limit). */
  pooled: boolean
  rank: number | null
  of: number
  percentile: number | null
  games: number | null
  /** Total minutes (players). */
  minutes: number | null
  teams: string[]
}

/** The subject's line: its value each season, ranked in that season's own pool. */
export function trendLine(
  subject: StatsResult | null,
  pool: readonly StatsRow[],
  id: string,
  metric: string,
  span: readonly number[],
  entity: TrendEntity,
  info: MetricInfo | undefined,
  teams: ReadonlyMap<number, string[]> = new Map(),
  unavailable: ReadonlySet<number> = new Set()
): TrendPoint[] {
  const direction = info?.direction ?? 'neutral'
  return span.map((season) => {
    const row = subject?.rows.find((r) => seasonOf(r) === season)
    const played = !!row && row.games > 0
    const covered = info ? covers(info, season) : true
    const raw = covered && played ? (row?.values[metric]?.value ?? null) : null
    const value = raw !== null && Number.isFinite(raw) ? raw : null
    const pooled = !unavailable.has(season)
    const members = pooled ? seasonPool(pool, season, metric, entity) : new Map<string, number>()
    const mine = members.get(id)
    const place =
      value !== null && mine !== undefined ? rankIn([...members.values()], mine, direction) : null
    return {
      season,
      value,
      played,
      covered,
      qualified: place !== null,
      pooled,
      rank: place?.rank ?? null,
      of: place?.of ?? members.size,
      percentile: place?.percentile ?? null,
      games: played ? (row?.games ?? null) : null,
      minutes: played && entity === 'player' ? (row?.values[QUALIFIER]?.sample ?? null) : null,
      teams: teams.get(season) ?? []
    }
  })
}

/** Whether a season is still being played: the one the data runs through, before July. */
export function inProgress(season: number, status: StatsStatus | null, now = new Date()): boolean {
  return status?.through?.season === season && now < new Date(Date.UTC(season, 6, 1))
}

/**
 * What the chart says about the span: where the metric starts, in its own words ("Recorded from
 * 2013-14."), seasons the source lacks, why it has no answer at all, and a total still running.
 */
export function trendNotes(
  info: MetricInfo | undefined,
  span: readonly number[],
  mode: BoardMode,
  status: StatsStatus | null,
  columnReason: string | null = null,
  now = new Date()
): string[] {
  if (!info || !span.length) return []
  const notes: string[] = []
  if (columnReason) notes.push(columnReason)
  const before = span.filter((s) => s < info.firstSeason)
  if (before.length) {
    const reason = coverageReason(info, before)
    if (reason) notes.push(reason)
  }
  const missing = span.filter((s) => s >= info.firstSeason && info.missingSeasons?.includes(s))
  if (missing.length) notes.push(`Not in the source for ${missing.map(seasonLabel).join(', ')}.`)
  const last = span[span.length - 1]
  const total = info.aggregation === 'sum' && !isRescaled(info, mode)
  if (total && inProgress(last, status, now)) notes.push(`${seasonLabel(last)} is in progress.`)
  return notes
}

/** The first season of the span the metric covers, when it starts after the span: the chart marks it. */
export function coverageStart(
  info: MetricInfo | undefined,
  span: readonly number[]
): number | null {
  if (!info || !span.length || info.firstSeason <= span[0]) return null
  return span.includes(info.firstSeason) ? info.firstSeason : null
}

export interface TrendRow {
  season: number
  label: string
  teams: string
  games: string
  minutes: string
  value: string
  /** "7th of 143"; why there is none otherwise. */
  rank: string
  qualified: boolean
  played: boolean
}

/** The table under the chart, newest first: every season of the span. */
export function trendRows(
  points: readonly TrendPoint[],
  info: MetricInfo | undefined,
  mode: BoardMode
): TrendRow[] {
  const f = {
    unit: info?.unit ?? 'number',
    decimals: info?.decimals ?? 1,
    aggregation: info?.aggregation,
    totalOnly: info?.totalOnly,
    perGameOnly: info?.perGameOnly
  }
  return points
    .map((p) => ({
      season: p.season,
      label: seasonLabel(p.season),
      teams: p.teams.join(', '),
      games: p.games === null ? '' : String(p.games),
      minutes: p.minutes === null ? '' : Math.round(p.minutes).toLocaleString('en-US'),
      value: p.value === null ? '' : fmtStat(p.value, f, mode),
      rank: !p.played
        ? 'Did not play'
        : !p.covered
          ? 'Not recorded'
          : p.value === null
            ? ''
            : p.rank !== null
              ? `${ordinal(p.rank)} of ${p.of}`
              : p.pooled
                ? 'Not qualified'
                : 'No league data',
      qualified: p.qualified,
      played: p.played
    }))
    .reverse()
}

/** The lines of a season's hover card. */
export function hoverLines(
  p: TrendPoint,
  entity: TrendEntity,
  format: (v: number) => string,
  band: BandPoint | null = null
): { title: string; lines: string[] } {
  const lines: string[] = []
  if (!p.played) lines.push('Did not play')
  else if (!p.covered) lines.push('Not recorded this season')
  else if (p.value === null) lines.push('No value')
  else {
    lines.push(format(p.value))
    lines.push(
      p.rank !== null
        ? `${ordinal(p.rank)} of ${p.of} · ${ordinal(Math.round(p.percentile ?? 0))} percentile`
        : p.pooled
          ? 'Not qualified'
          : 'No league data this season'
    )
  }
  if (p.played) {
    const g = `${p.games ?? 0} games`
    lines.push(
      entity === 'player' && p.minutes !== null
        ? `${g} · ${Math.round(p.minutes).toLocaleString('en-US')} minutes`
        : g
    )
  }
  // The league that season, so the band behind the point can be read as numbers.
  if (band && band.median !== null) {
    lines.push(`League median ${format(band.median)} · ${band.n} qualified`)
    lines.push(
      `25th–75th ${format(band.p25!)}–${format(band.p75!)} · 10th–90th ${format(band.p10!)}–${format(band.p90!)}`
    )
  }
  const title = `${seasonLabel(p.season)}${p.teams.length ? ` · ${p.teams.join(', ')}` : ''}`
  return { title, lines }
}

/** Every player in the data, for the search: their career minutes, most first. */
export function playerSearchQuery(seasons: readonly number[]): StatsQuery {
  return {
    entity: 'player',
    metrics: [QUALIFIER],
    scope: { seasons: [...seasons], gameTypes: ['regular', 'play-in', 'playoffs', 'cup-final'] },
    transform: 'raw',
    sort: { metric: QUALIFIER, dir: 'desc' },
    limit: ROW_LIMIT
  }
}

export interface SearchOption {
  id: string
  label: string
}

/** "LeBron James · LAL", sorted by name; two players of the same name tell apart by team. */
export function playerOptions(result: StatsResult | null): SearchOption[] {
  return (result?.rows ?? [])
    .map((r) => ({ id: r.id, label: r.team ? `${r.name} · ${r.team}` : r.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Every franchise in the data under its latest name: "LAL · Los Angeles Lakers". */
export function teamOptions(seasons: readonly StatsSeason[]): SearchOption[] {
  const latest = new Map<string, { code: string; name: string; season: number }>()
  for (const s of seasons) {
    for (const t of s.teams) {
      const was = latest.get(t.id)
      if (!was || s.season > was.season) {
        latest.set(t.id, { code: t.code, name: t.name, season: s.season })
      }
    }
  }
  return [...latest]
    .map(([id, t]) => ({ id, label: `${t.code} · ${t.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** "Every season · Playoffs": which parts of the scope bar Trends follows. */
export function scopeNote(typeLabel: string): string {
  return `Every season in the data · ${typeLabel}. The scope bar's season and range do not apply here.`
}
