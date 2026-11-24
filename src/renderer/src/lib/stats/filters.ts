import type { League } from '@shared/leagues'
import {
  ATTRIBUTE_GROUPS,
  ATTRIBUTES,
  type AttributeDef,
  type AttributeType,
  type AttributeUnit
} from '@shared/stats/attributes'
import { CATEGORIES, placementParts, type Placement } from '@shared/stats/categories'
import type {
  BoardMode,
  Entity,
  FilterOp,
  LeaderboardBoard,
  MetricInfo,
  StatsFilter,
  StatsAttributeValue,
  StatsQuery,
  StatsResult
} from '@shared/stats/types'
import { isRescaled } from './format'
import { pickable, rankWithinTab, searchKey, type TabDef } from './leaderboard'

/**
 * The Filters control of the Players and Teams leaderboards (T1701.2, D51): what can be filtered on,
 * in what words, and the query and rows a filtered board reads. A condition is kept on the board as
 * the engine reads it (`StatsFilter`, a percentage as a fraction), so a saved view holds exactly what
 * was asked; the control converts a value to the board's units for display and back.
 */

/** The most conditions a board holds, the engine's limit. */
export const MAX_FILTERS = 20

/** Something a board can be filtered on: an attribute of who a row is, or a metric. */
export interface FilterItem {
  kind: 'attribute' | 'metric'
  id: string
  label: string
  /** The heading it is listed under: an attribute's group, a metric's primary category. */
  group: string
  /** Whose listing an attribute is, where two hold the same kind of fact (`AttributeDef.byline`). */
  byline: string | null
  /** A metric's sub-group within its category; none for an attribute. */
  subgroup: string | null
  description: string
  type: AttributeType
  /** How a number reads: an attribute's unit, or `pct` for a metric's percentage. */
  unit: AttributeUnit | 'pct' | null
  values: readonly string[] | null
  /** Why the league on screen has no value for it; null when it has. */
  reason: string | null
}

/** The attributes of one kind of row in the league on screen, those it lacks with their reason. */
export function attributeItems(league: League, entity: Entity): FilterItem[] {
  return ATTRIBUTES.filter((a) => a.entity === entity).map((a) => attributeItem(a, league))
}

function attributeItem(a: AttributeDef, league: League): FilterItem {
  const coverage = a.leagues[league.id]
  return {
    kind: 'attribute',
    id: a.id,
    label: a.label,
    group: a.group,
    byline: a.byline ?? null,
    subgroup: null,
    description: a.description,
    type: a.type,
    unit: a.unit ?? null,
    values: a.values ?? null,
    reason: 'unavailable' in coverage ? coverage.unavailable : null
  }
}

/**
 * The metrics a board's tab offers, each under its primary category (D52), its first placement, as the
 * Glossary lists it. Ordered by the categories' order, then the sub-group's, then the label.
 */
export function metricItems(catalogue: readonly MetricInfo[], tab: TabDef): FilterItem[] {
  const order = new Map<string, number>()
  CATEGORIES.forEach((c, i) =>
    c.groups.forEach((g, j) => order.set(`${c.id}.${g.id}`, i * 100 + j))
  )
  const primary = (m: MetricInfo): Placement | null => m.categories?.[0] ?? null
  return pickable(catalogue, tab)
    .map((m) => {
      const p = primary(m)
      const parts = p ? placementParts(p) : null
      return {
        item: {
          kind: 'metric' as const,
          id: m.id,
          label: m.label,
          group: parts?.category.label ?? 'Other',
          byline: null,
          subgroup: parts?.group.label ?? null,
          description: m.description,
          type: 'number' as const,
          unit: m.unit === 'pct' ? ('pct' as const) : null,
          values: null,
          reason: null
        },
        rank: p ? (order.get(p) ?? 99_999) : 99_999
      }
    })
    .sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label))
    .map((x) => x.item)
}

/** The items by heading, attributes first in their groups' order, narrowed by a search. */
export function filterGroups(
  items: readonly FilterItem[],
  search: string
): { group: string; items: FilterItem[] }[] {
  const needle = searchKey(search.trim())
  const shown = needle
    ? items.filter((i) =>
        searchKey(
          `${i.label} ${i.byline ?? ''} ${i.group} ${i.subgroup ?? ''} ${i.description}`
        ).includes(needle)
      )
    : items
  const groups = new Map<string, FilterItem[]>()
  const groupOrder = (i: FilterItem): number =>
    i.kind === 'attribute'
      ? (ATTRIBUTE_GROUPS as readonly string[]).indexOf(i.group)
      : ATTRIBUTE_GROUPS.length
  for (const i of [...shown].sort((a, b) => groupOrder(a) - groupOrder(b))) {
    groups.set(i.group, [...(groups.get(i.group) ?? []), i])
  }
  return [...groups].map(([group, list]) => ({ group, items: list }))
}

/** The operators each kind of value takes, in the order the control offers them. */
export const OPS_BY_TYPE: Record<AttributeType, FilterOp[]> = {
  number: ['atLeast', 'atMost', 'between', 'hasValue', 'hasNone'],
  date: ['atLeast', 'atMost', 'between', 'hasValue', 'hasNone'],
  enum: ['anyOf', 'noneOf', 'hasValue', 'hasNone'],
  text: ['anyOf', 'noneOf', 'contains', 'hasValue', 'hasNone'],
  flag: ['is', 'isNot', 'hasValue', 'hasNone']
}

export const OP_WORDS: Record<FilterOp, string> = {
  atLeast: 'at least',
  atMost: 'at most',
  between: 'between',
  anyOf: 'is any of',
  noneOf: 'is none of',
  contains: 'contains',
  is: 'yes',
  isNot: 'no',
  hasValue: 'is known',
  hasNone: 'is not known'
}

/** The condition an item starts as: its type's first operator, with no value yet. */
export function newCondition(item: FilterItem): StatsFilter {
  const op = OPS_BY_TYPE[item.type][0]
  return item.kind === 'attribute' ? { attribute: item.id, op } : { metric: item.id, op }
}

/** The id a condition is on. */
export const conditionId = (f: StatsFilter): string => f.attribute ?? f.metric ?? ''

/** An item's key: an attribute and a metric may share an id. */
export const itemKey = (i: Pick<FilterItem, 'kind' | 'id'>): string => `${i.kind}:${i.id}`

/** The key of the item a condition is on. */
export const conditionKey = (f: StatsFilter): string =>
  f.attribute !== undefined ? `attribute:${f.attribute}` : `metric:${f.metric ?? ''}`

/** The items by key, for the conditions to find theirs. */
export const itemsByKey = (items: readonly FilterItem[]): Map<string, FilterItem> =>
  new Map(items.map((i) => [itemKey(i), i]))

/** Whether a condition has what its operator needs, so the engine can read it. */
export function isComplete(f: StatsFilter): boolean {
  const v = f.value as unknown
  const bound = (x: unknown): boolean =>
    (typeof x === 'number' && Number.isFinite(x)) ||
    (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x))
  switch (f.op) {
    case 'between':
      return Array.isArray(v) && v.length === 2 && v.every(bound) && v[0] <= v[1]
    case 'atLeast':
    case 'atMost':
      return bound(v)
    case 'anyOf':
    case 'noneOf':
      return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.trim())
    case 'contains':
      return typeof v === 'string' && v.trim().length > 0
    default:
      return v === undefined
  }
}

/** A number as the board shows it: a percentage of a metric times 100. */
export const toShown = (value: number, item: Pick<FilterItem, 'unit'>): number =>
  item.unit === 'pct' ? round(value * 100) : value

/** A number typed in the board's units, as the engine reads it: a percentage over 100. */
export const fromShown = (value: number, item: Pick<FilterItem, 'unit'>): number =>
  item.unit === 'pct' ? value / 100 : value

const round = (x: number): number => Math.round(x * 1e6) / 1e6

const UNIT_WORDS: Partial<Record<AttributeUnit | 'pct', string>> = {
  inches: 'in',
  pounds: 'lb',
  seconds: 's',
  percent: '%',
  pct: '%',
  seats: 'seats'
}

/** A number with its unit, as a chip writes it: "80 in", "40%". */
function withUnit(value: number, item: FilterItem): string {
  const shown = toShown(value, item)
  const text = shown.toLocaleString('en-US', { maximumFractionDigits: 3, useGrouping: false })
  const unit = UNIT_WORDS[item.unit ?? 'count']
  if (!unit) return text
  return unit === '%' ? `${text}%` : `${text} ${unit}`
}

/** What a metric condition is compared as, under the board's mode: "per game". */
function modeNote(item: FilterItem, metric: MetricInfo | undefined, mode: BoardMode): string {
  if (item.kind !== 'metric' || !metric || !isRescaled(metric, mode)) return ''
  const words: Record<BoardMode, string> = {
    raw: 'total',
    perGame: 'per game',
    per36: 'per 36',
    per40: 'per 40',
    per48: 'per 48',
    per100: 'per 100'
  }
  return ` (${words[mode]})`
}

/**
 * A condition as a chip reads: "Age at most 25", "Height 78 to 82 in", "Birth country is any of
 * France, Spain", "Undrafted: yes", "Points at least 20 (per game)". An unfinished one says so.
 */
export function conditionText(
  f: StatsFilter,
  item: FilterItem | undefined,
  metric?: MetricInfo,
  mode: BoardMode = 'raw'
): string {
  const label = item?.label ?? conditionId(f)
  if (!item || !isComplete(f)) return `${label}: choose a value`
  const note = modeNote(item, metric, mode)
  const v = f.value as unknown
  const one = (x: unknown): string => (typeof x === 'number' ? withUnit(x, item) : String(x))
  switch (f.op) {
    case 'between': {
      const [lo, hi] = v as [unknown, unknown]
      if (typeof lo === 'number' && typeof hi === 'number') {
        const unitless = { ...item, unit: item.unit === 'pct' ? item.unit : null }
        return `${label} ${withUnit(lo, unitless)} to ${withUnit(hi, item)}${note}`
      }
      return `${label} ${one(lo)} to ${one(hi)}${note}`
    }
    case 'atLeast':
    case 'atMost':
      return `${label} ${OP_WORDS[f.op]} ${one(v)}${note}`
    case 'anyOf':
    case 'noneOf':
      return `${label} ${OP_WORDS[f.op]} ${(v as string[]).join(', ')}`
    case 'contains':
      return `${label} contains “${String(v)}”`
    case 'is':
    case 'isNot':
      return `${label}: ${OP_WORDS[f.op]}`
    default:
      return `${label} ${OP_WORDS[f.op]}`
  }
}

/** The conditions the engine is asked for: finished, on something the league has, at most 20. */
export function engineFilters(
  filters: readonly StatsFilter[] | undefined,
  items: ReadonlyMap<string, FilterItem>
): StatsFilter[] {
  return (filters ?? [])
    .filter((f) => isComplete(f) && items.get(conditionKey(f))?.reason === null)
    .slice(0, MAX_FILTERS)
}

/** The board's query with its finished conditions; null when it has none, so nothing more is read. */
export function filteredQuery(
  query: StatsQuery | null,
  board: Pick<LeaderboardBoard, 'filters'>,
  items: ReadonlyMap<string, FilterItem>
): StatsQuery | null {
  const filters = engineFilters(board.filters, items)
  return query && filters.length > 0 ? { ...query, filters } : null
}

/**
 * The filtered rows, shaded as the whole board shades them (D51: a filtered row keeps its league
 * percentile). The board ranks its percentiles among the rows it fetched (1,000 at most), so a row it
 * fetched takes that board's percentile and rank, the same with or without the filter. A row past
 * them (a freshman far down a college board of 5,000) takes the engine's own, ranked among every
 * qualified row before the filter: never one among the filtered rows alone, never a blank.
 */
export function rankFiltered(
  filtered: StatsResult,
  board: StatsResult | null,
  tab: TabDef,
  /** The engine ranked among the tab's qualified rows (`rankAmong`): its figures stand, one pool. */
  engineRanks = false
): StatsResult {
  if (engineRanks) return filtered
  const key = (r: StatsResult['rows'][number]): string => `${r.id}|${JSON.stringify(r.group)}`
  const ranked = board ? rankWithinTab(board, tab) : null
  const byKey = new Map((ranked?.rows ?? []).map((r) => [key(r), r]))
  return {
    ...filtered,
    rows: filtered.rows.map((r) => {
      const shaded = byKey.get(key(r))
      if (!shaded) return r
      return {
        ...r,
        values: Object.fromEntries(
          Object.entries(r.values).map(([id, v]) => [
            id,
            {
              ...v,
              percentile: shaded.values[id]?.percentile ?? null,
              rank: shaded.values[id]?.rank ?? null
            }
          ])
        )
      }
    })
  }
}

/**
 * What the footer says of the filters: why no row can answer, or how many rows were left out for
 * having no value, naming the conditions they could lack. Experience is the season's roster's, so a
 * player the roster does not list has none: said where it is filtered on.
 */
export function filterNote(
  result: StatsResult | null,
  filters: readonly StatsFilter[],
  items: ReadonlyMap<string, FilterItem>,
  entity: Entity
): string | null {
  const f = result?.filtered
  if (!f) return null
  if (f.reason) return f.reason
  if (f.noValue === 0) return null
  const names = [
    ...new Set(
      filters
        .filter((x) => x.op !== 'hasValue' && x.op !== 'hasNone')
        .map((x) => items.get(conditionKey(x))?.label ?? conditionId(x))
    )
  ]
  const who = entity === 'player' ? (f.noValue === 1 ? 'player' : 'players') : 'teams'
  const what = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names[0]
  const experience = filters.some((x) => x.attribute === 'experience')
    ? ' Experience is the season’s roster’s: a player it does not list has none.'
    : ''
  return `${f.noValue.toLocaleString('en-US')} ${f.noValue === 1 && entity === 'team' ? 'team' : who} in scope left out: no value for ${what}.${experience}`
}

/** The conditions a board keeps when its tab changes: all of them, attributes and metrics alike. */
export const keptFilters = (board: LeaderboardBoard): StatsFilter[] => board.filters ?? []

/** The most values the picker lists at once; the search narrows the rest. */
export const VALUES_SHOWN = 200

/**
 * The values the picker lists for "any of" and "none of": the chosen first, then those the search
 * finds (letter case and accents ignored), most held first, at most `VALUES_SHOWN`.
 */
export function valuesShown(
  values: readonly StatsAttributeValue[],
  chosen: readonly string[],
  search: string
): { value: string; rows: number | null; chosen: boolean }[] {
  const picked = new Set(chosen)
  const held = new Map(values.map((v) => [v.value, v.rows]))
  const needle = searchKey(search.trim())
  const first = chosen.map((value) => ({ value, rows: held.get(value) ?? null, chosen: true }))
  const rest = values
    .filter((v) => !picked.has(v.value) && (!needle || searchKey(v.value).includes(needle)))
    .slice(0, VALUES_SHOWN)
    .map((v) => ({ value: v.value, rows: v.rows, chosen: false }))
  return [...first, ...rest]
}
