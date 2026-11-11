import type { ExploreSubject } from '@/lib/stats/explore'
import { covers } from '@shared/stats/coverage'
import { seasonLabel } from '@shared/stats/seasons'
import type {
  BoardMode,
  Entity,
  MetricFamily,
  MetricInfo,
  StatsQuery,
  StatsResult,
  StatsRow,
  StatsSeason
} from '@shared/stats/types'
import { cellTitle, familyLabel, fmtStat, isRescaled, ordinal } from './format'
import {
  bestFirst,
  familyColumns,
  MAX_COLUMNS,
  modeWords,
  qualifies,
  rankWithinTab,
  ROW_LIMIT,
  searchKey,
  tabOf,
  TEAM_TABS,
  type TabDef
} from './leaderboard'
import { queryScope, rangeLabel, typeLabel, type StatsScope } from './scope'

/** Compare: three slots side by side, all players or all teams, one row per metric. */

/** The three slots, in series order (--s1, --s2, --s3); null is an open slot. */
export type Slots = [string | null, string | null, string | null]

export const NO_SLOTS: Slots = [null, null, null]

/** How many seasons, ending with the scope bar's, Compare reads: one, the last few, or every one. */
export type SeasonSpan = 1 | 3 | 5 | 10 | 'all'

/** What Compare shows, kept by the app across screens. */
export interface CompareState {
  entity: Entity
  slots: Slots
  /**
   * The open slots are filled once with the leaders in scope: on the first visit, before anyone is
   * picked or removed. Any choice of the user's turns it off.
   */
  autofill: boolean
  span: SeasonSpan
  mode: BoardMode
  /** The rows chosen for each kind; null for the default families. */
  columns: Record<Entity, string[] | null>
}

export const DEFAULT_COMPARE: CompareState = {
  entity: 'player',
  slots: NO_SLOTS,
  autofill: true,
  span: 1,
  mode: 'perGame',
  columns: { player: null, team: null }
}

/** Players switch to teams, or back: the slots hold one kind, so they are cleared. */
export function setEntity(state: CompareState, entity: Entity): CompareState {
  if (state.entity === entity) return state
  return { ...state, entity, slots: NO_SLOTS, autofill: false }
}

/** Puts someone in a slot (null empties it). Someone already in another slot moves, not doubles. */
export function setSlot(state: CompareState, slot: number, id: string | null): CompareState {
  const slots = state.slots.map((s, k) => (k === slot ? id : s === id ? null : s)) as Slots
  return { ...state, slots, autofill: false }
}

/**
 * A dashboard's Compare: each subject goes in the first open slot, or the last slot when all three
 * are taken. One of the other kind clears the slots first. Someone already compared stays where they are.
 */
export function addSubjects(
  state: CompareState,
  entity: Entity,
  ids: readonly string[]
): CompareState {
  let slots: Slots = state.entity === entity ? [...state.slots] : [...NO_SLOTS]
  for (const id of ids) {
    if (slots.includes(id)) continue
    const open = slots.indexOf(null)
    slots = slots.map((s, k) => (k === (open < 0 ? 2 : open) ? id : s)) as Slots
  }
  return { ...state, entity, slots }
}

/**
 * Compare opened from another screen (a dashboard's Compare, the chart's picks) with these players or
 * teams: each in the first open slot, as `addSubjects` does. The first subject's kind decides; an
 * empty list keeps what Compare had.
 */
export function compareWith(
  state: CompareState,
  subjects: readonly ExploreSubject[]
): CompareState {
  if (!subjects.length) return state
  const entity = subjects[0].entity
  return addSubjects(
    state,
    entity,
    subjects.filter((s) => s.entity === entity).map((s) => s.id)
  )
}

/** The open slots filled from the candidates, best first, skipping anyone already compared. */
export function fillSlots(slots: Slots, candidates: readonly string[]): Slots {
  const left = candidates.filter((id) => !slots.includes(id))
  return slots.map((s) => s ?? left.shift() ?? null) as Slots
}

/** The leaderboard tab Compare reads like: every player (ranked within their position), or every team. */
export function compareTab(entity: Entity): TabDef {
  if (entity === 'player') return tabOf('player', 'ALL')
  // Teams compare both ends of the floor, so neither end's metrics come first in the picker.
  const offense = TEAM_TABS[0]
  return {
    id: 'compare',
    label: 'Teams',
    title: 'team',
    entity: 'team',
    groups: [],
    sort: offense.sort
  }
}

/** The families a comparison opens with: the box score, shooting, and the ratings or composites. */
export const DEFAULT_FAMILIES: Record<Entity, MetricFamily[]> = {
  player: ['traditional', 'shooting', 'composite'],
  team: ['traditional', 'shooting', 'possessions']
}

/** The leaderboards' family order, for grouping the rows. */
const FAMILY_ORDER: MetricFamily[] = [
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

/** Players are qualified on minutes, so the minutes row always stays. */
const QUALIFIER = 'min'

/** The rows a player comparison keeps: the minutes first when missing, at most 40 in all. */
function withQualifier(entity: Entity, columns: readonly string[]): string[] {
  if (entity !== 'player' || columns.includes(QUALIFIER)) return [...columns]
  return [QUALIFIER, ...columns].slice(0, MAX_COLUMNS)
}

/** The default rows: the core metrics of the default families, in that order. */
export function defaultColumns(entity: Entity, catalogue: readonly MetricInfo[]): string[] {
  const ids = DEFAULT_FAMILIES[entity].flatMap((f) =>
    catalogue
      .filter((m) => m.family === f && m.entity === entity && m.tier === 'core')
      .filter((m) => m.id !== 'gp' && m.id !== 'team_gp')
      .map((m) => m.id)
  )
  return withQualifier(entity, [...new Set(ids)]).slice(0, MAX_COLUMNS)
}

/** The rows on screen: the user's, else the defaults. */
export function compareColumns(state: CompareState, catalogue: readonly MetricInfo[]): string[] {
  const own = state.columns[state.entity]
  return own ? withQualifier(state.entity, own) : defaultColumns(state.entity, catalogue)
}

/** New rows for the kind on screen, the minutes kept for players. */
export function setColumns(state: CompareState, columns: readonly string[]): CompareState {
  return {
    ...state,
    columns: { ...state.columns, [state.entity]: withQualifier(state.entity, columns) }
  }
}

/** A family's rows added at the end, as many as fit under 40. */
export function addFamily(
  columns: readonly string[],
  family: MetricFamily,
  entity: Entity,
  catalogue: readonly MetricInfo[]
): string[] {
  const more = familyColumns(catalogue, compareTab(entity), family).filter(
    (id) => !columns.includes(id)
  )
  return [...columns, ...more].slice(0, MAX_COLUMNS)
}

/** The seasons a span reads, newest first: those with box scores up to the scope bar's season. */
export function spanSeasons(
  span: SeasonSpan,
  scope: StatsScope,
  seasons: readonly StatsSeason[]
): number[] {
  const upTo = seasons.map((s) => s.season).filter((s) => s <= scope.season)
  const sorted = [...new Set(upTo)].sort((a, b) => b - a)
  if (sorted.length === 0) return [scope.season]
  return span === 'all' ? sorted : sorted.slice(0, span)
}

/** "2023-24 to 2025-26". */
export function spanLabel(list: readonly number[]): string {
  if (list.length === 0) return ''
  const lo = Math.min(...list)
  const hi = Math.max(...list)
  return lo === hi ? seasonLabel(hi) : `${seasonLabel(lo)} to ${seasonLabel(hi)}`
}

/** The span choices: each one only when it reaches further back than the one before. */
export function spanOptions(
  scope: StatsScope,
  seasons: readonly StatsSeason[]
): { value: SeasonSpan; label: string }[] {
  const all = spanSeasons('all', scope, seasons)
  const out: { value: SeasonSpan; label: string }[] = [
    { value: 1, label: seasonLabel(scope.season) }
  ]
  for (const n of [3, 5, 10] as const) {
    if (all.length > n) out.push({ value: n, label: `Last ${n} seasons` })
  }
  if (all.length > 1) out.push({ value: 'all', label: `Every season (${spanLabel(all)})` })
  return out
}

/** "2025-26 · Regular season · Whole season", or "2016-17 to 2025-26 · Regular season · Whole seasons". */
export function compareScopeLabel(
  scope: StatsScope,
  list: readonly number[],
  entity: Entity
): string {
  if (list.length <= 1) {
    return `${seasonLabel(scope.season)} · ${typeLabel(scope.seasonType)} · ${rangeLabel(scope, entity)}`
  }
  return `${spanLabel(list)} · ${typeLabel(scope.seasonType)} · Whole seasons`
}

/** Why a range from the scope bar is not applied: it belongs to one season. */
export function rangeNote(scope: StatsScope, list: readonly number[]): string | null {
  if (list.length <= 1 || scope.range.kind === 'season') return null
  return 'A date range or last games belongs to one season, so several seasons are read whole.'
}

/** The leaders a slot fills with: points for players, net rating for teams. */
const LEAD_METRIC: Record<Entity, string> = { player: 'pts', team: 'team_nrtg' }

/**
 * The one query behind the screen. One season asks for every player or team in scope, so each slot
 * is ranked among the same pool as on the dashboards. Several seasons ask for the slots alone: a pool
 * over a span would mix careers, so there are no ranks. Null when there is nobody to ask about.
 */
export function compareQuery(
  state: CompareState,
  columns: readonly string[],
  scope: StatsScope,
  list: readonly number[]
): StatsQuery | null {
  const { entity } = state
  const ids = state.slots.filter((s): s is string => s !== null)
  const many = list.length > 1
  if (many && ids.length === 0) return null
  const metrics = withQualifier(entity, columns)
  if (metrics.length === 0) return null
  const lead = metrics.includes(LEAD_METRIC[entity]) ? LEAD_METRIC[entity] : metrics[0]
  const base = queryScope(scope, entity)
  return {
    entity,
    metrics,
    scope: many
      ? {
          seasons: [...list],
          gameTypes: base.gameTypes,
          ...(entity === 'player' ? { players: ids } : { teams: ids })
        }
      : base,
    transform: state.mode,
    sort: { metric: lead, dir: 'desc' },
    limit: many ? 3 : entity === 'player' ? ROW_LIMIT : 40
  }
}

/**
 * The query a slot's search reads over several seasons: everyone who played in them. One season's
 * search reads the comparison's own rows.
 */
export function candidatesQuery(scope: StatsScope, list: readonly number[]): StatsQuery {
  return {
    entity: 'player',
    metrics: [QUALIFIER],
    scope: { seasons: [...list], gameTypes: queryScope(scope, 'player').gameTypes },
    sort: { metric: QUALIFIER, dir: 'desc' },
    limit: 5000
  }
}

/**
 * The rows ranked as the dashboards rank them: a player among the qualified players of their
 * position, a team among every team. Over several seasons the answer holds the slots alone, so its
 * ranks would be among three: they are dropped.
 */
export function rankedResult(result: StatsResult, entity: Entity, many: boolean): StatsResult {
  if (many) {
    return {
      ...result,
      rows: result.rows.map((r) => ({
        ...r,
        values: Object.fromEntries(
          Object.entries(r.values).map(([id, v]) => [id, { ...v, percentile: null, rank: null }])
        )
      }))
    }
  }
  return entity === 'player' ? rankWithinTab(result, compareTab('player')) : result
}

/** The open slots' leaders: qualified rows by the query's order (points, net rating). */
export function leaders(result: StatsResult, entity: Entity): string[] {
  const tab = compareTab(entity)
  return result.rows.filter((r) => qualifies(r, tab)).map((r) => r.id)
}

export interface CompareCell {
  text: string
  /** 0–100 among the pool; null below the sample, without a value or over several seasons. */
  percentile: number | null
  /** "4th"; null with no percentile or for a metric with no better side. */
  rank: string | null
  /** The best value of the row. */
  lead: boolean
  /** The hover: the rank and sample, or why there is no value. */
  title: string
}

export interface CompareRow {
  metric: string
  label: string
  /** "per game" for a count in a rate mode. */
  sub: string
  info: MetricInfo | null
  /** One per slot; null for an open slot. */
  cells: (CompareCell | null)[]
  /** Why no slot has a value: "Recorded from 2013-14." */
  missing: string | null
}

export interface CompareView {
  groups: { label: string; rows: CompareRow[] }[]
  /** Rows each slot leads. */
  leads: number[]
  /** Rows that can be led: a better side and at least two values. */
  counted: number
}

/** How a value is compared: at the precision it is shown, so two values that read alike tie. */
function shownKey(value: number, info: MetricInfo, mode: BoardMode): number {
  const decimals = isRescaled(info, mode) ? Math.max(1, info.decimals) : info.decimals
  const shown = info.unit === 'pct' ? value * 100 : value
  return Number(shown.toFixed(decimals))
}

/**
 * Whether a slot's seasons in scope reach before a metric's coverage: its value is over part of
 * them. Null when they are all covered, or none is (the value is then blank anyway).
 */
function partialFrom(info: MetricInfo, seasons: readonly number[] | null): string | null {
  if (!seasons || seasons.length < 2) return null
  const covered = seasons.filter((s) => covers(info, s))
  if (covered.length === 0 || covered.length === seasons.length) return null
  return seasons.some((s) => s < info.firstSeason)
    ? `Recorded from ${seasonLabel(info.firstSeason)}`
    : `Not in the source for ${seasons
        .filter((s) => !covers(info, s))
        .map(seasonLabel)
        .join(', ')}`
}

/** Why a slot has no value for a metric that others have. */
export function blankReason(
  info: MetricInfo,
  row: StatsRow | undefined,
  seasons: readonly number[] | null
): string {
  if (!row) return 'No games in scope.'
  if (seasons && seasons.length > 0 && !seasons.some((s) => covers(info, s))) {
    return seasons.some((s) => s < info.firstSeason)
      ? `Recorded from ${seasonLabel(info.firstSeason)}.`
      : `Not in the source for ${seasons.map(seasonLabel).join(', ')}.`
  }
  return `No ${info.sampleLabel} in scope.`
}

/**
 * Every row, grouped by family, one cell per slot. The best value in a row leads it, read the
 * metric's way (fewer turnovers is better); a metric with no better side, or a tie between every
 * value, leads nowhere. A blank is never a zero: it says why.
 */
export function compareView(
  result: StatsResult | null,
  slots: Slots,
  columns: readonly string[],
  byId: ReadonlyMap<string, MetricInfo>,
  mode: BoardMode,
  entity: Entity,
  /** Each slot's seasons in scope, for coverage over several seasons; null when unknown or one season. */
  slotSeasons: readonly (readonly number[] | null)[] = []
): CompareView {
  const leads = slots.map(() => 0)
  let counted = 0
  const rowOf = (id: string | null): StatsRow | undefined =>
    id ? result?.rows.find((r) => r.id === id) : undefined
  const rows = slots.map(rowOf)
  const byFamily = new Map<MetricFamily | 'other', CompareRow[]>()

  for (const metric of columns) {
    const info = byId.get(metric) ?? null
    const missing = result?.columns.find((c) => c.id === metric)?.reason ?? null
    const f = info ?? { unit: 'number' as const, decimals: 1 }
    // A rate mode cannot average a sum over seasons it was not recorded in.
    const inexact = (k: number): string | null => {
      if (!info) return null
      const from = partialFrom(info, slotSeasons[k] ?? null)
      if (!from) return null
      return info.aggregation === 'sum' && !info.published && isRescaled(info, mode)
        ? `${from}, so an average over these seasons would not be exact.`
        : null
    }
    const values = slots.map((id, k) => {
      if (!id || missing || inexact(k)) return null
      return rows[k]?.values[metric]?.value ?? null
    })
    const keys = values.map((v) => (v === null || !info ? null : shownKey(v, info, mode)))
    const filled = keys.filter((v): v is number => v !== null)
    const direction = info?.direction ?? 'neutral'
    const best =
      direction === 'neutral' || filled.length < 2
        ? null
        : direction === 'lower'
          ? Math.min(...filled)
          : Math.max(...filled)
    const tie = best !== null && filled.every((v) => v === best)
    const leading = best !== null && !tie
    if (best !== null) counted++

    const cells = slots.map((id, k): CompareCell | null => {
      if (!id) return null
      const row = rows[k]
      const v = row?.values[metric]
      const lead = leading && keys[k] === best
      if (lead) leads[k]++
      if (missing) return { text: '—', percentile: null, rank: null, lead: false, title: missing }
      const wrong = inexact(k)
      if (wrong) return { text: '—', percentile: null, rank: null, lead: false, title: wrong }
      if (!v || v.value === null || !info) {
        return {
          text: '—',
          percentile: null,
          rank: null,
          lead: false,
          title: info ? blankReason(info, row, slotSeasons[k] ?? null) : ''
        }
      }
      const from = partialFrom(info, slotSeasons[k] ?? null)
      const position = entity === 'player' ? (row?.position ?? null) : null
      const hover = cellTitle(v, info, position)
      return {
        text: fmtStat(v.value, f, mode),
        percentile: v.percentile,
        rank:
          v.rank !== null && v.percentile !== null && direction !== 'neutral'
            ? ordinal(v.rank)
            : null,
        lead,
        title: from ? `${from} only.${hover ? `\n${hover}` : ''}` : hover
      }
    })
    const family = info?.family ?? 'other'
    byFamily.set(family, [
      ...(byFamily.get(family) ?? []),
      {
        metric,
        label: info?.label ?? metric,
        sub: info && isRescaled(info, mode) ? modeWords(mode) : '',
        info,
        cells,
        missing
      }
    ])
  }
  const order = (f: MetricFamily | 'other'): number =>
    f === 'other' ? FAMILY_ORDER.length : FAMILY_ORDER.indexOf(f)
  const groups = [...byFamily]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([family, list]) => ({
      label: family === 'other' ? 'Other' : familyLabel(family),
      rows: list
    }))
  return { groups, leads, counted }
}

export interface SlotCard {
  id: string
  name: string
  /** The team's code (players), or the team's own (teams). */
  team: string | null
  position: string | null
  games: number
  /** Players: they meet the minutes the leaderboards ask, so they are ranked. */
  qualified: boolean
}

/** A slot's header: the row's name, team and games, or the id while it loads. */
export function slotCard(
  result: StatsResult | null,
  id: string,
  entity: Entity,
  fallback: string | null = null
): SlotCard {
  const r = result?.rows.find((x) => x.id === id)
  return {
    id,
    name: r?.name ?? fallback ?? id,
    team: r?.team ?? null,
    position: r?.position ?? null,
    games: r?.games ?? 0,
    qualified: !!r && qualifies(r, compareTab(entity))
  }
}

export interface Candidate {
  id: string
  name: string
  /** "BOS · G", "Boston Celtics". */
  detail: string
}

/** Who a player slot can take: the rows in scope, most minutes first. */
export function playerCandidates(result: StatsResult | null): Candidate[] {
  const rows = [...(result?.rows ?? [])].sort(
    (a, b) => (b.values[QUALIFIER]?.raw ?? 0) - (a.values[QUALIFIER]?.raw ?? 0)
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    detail: [r.team, r.position].filter(Boolean).join(' · ')
  }))
}

/** Who a team slot can take: the teams of these seasons, each by its latest name, A to Z. */
export function teamCandidates(
  seasons: readonly StatsSeason[],
  list: readonly number[]
): Candidate[] {
  const out = new Map<string, Candidate>()
  const newest = [...seasons]
    .filter((s) => list.includes(s.season))
    .sort((a, b) => b.season - a.season)
  for (const s of newest) {
    for (const t of s.teams) {
      if (!out.has(t.id)) out.set(t.id, { id: t.id, name: t.name, detail: t.code })
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** The search's matches, the slots' own left out: "doncic" finds "Luka Dončić", a team by code too. */
export function searchCandidates(
  candidates: readonly Candidate[],
  search: string,
  exclude: readonly (string | null)[],
  limit = 8
): Candidate[] {
  const needle = searchKey(search.trim())
  return candidates
    .filter((c) => !exclude.includes(c.id))
    .filter((c) => !needle || searchKey(`${c.name} ${c.detail}`).includes(needle))
    .slice(0, limit)
}

/** What the ranks are among, and how the best value is marked. */
export function poolNote(
  entity: Entity,
  list: readonly number[],
  result: StatsResult | null
): string {
  const best = 'The best value in each row is bold.'
  if (list.length > 1) return `Ranks are for one season at a time, so none are shown. ${best}`
  if (entity === 'team') {
    return `Percentiles and ranks among the ${result?.rows.length ?? 30} teams. ${best}`
  }
  return `Percentiles and ranks among qualified players of the same position, as on the dashboards. ${best}`
}

/** The direction a metric is read: for the hover of a row's label. */
export const betterSide = (info: MetricInfo | null): string =>
  !info || info.direction === 'neutral'
    ? 'No better side'
    : bestFirst(info) === 'asc'
      ? 'Lower is better'
      : 'Higher is better'
