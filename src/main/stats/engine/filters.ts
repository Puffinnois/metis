import type { League } from '@shared/leagues'
import {
  AGE_REFERENCE,
  ATTRIBUTE_BY_ID,
  attributeGap,
  type AttributeDef,
  type AttributeTable
} from '@shared/stats/attributes'
import type { FilterOp, GroupBy, MetricDef, StatsFilter, StatsQuery } from '@shared/stats/types'

/**
 * `StatsQuery.filters` (D51): conditions on who a row is (an attribute) or what it did (a metric),
 * applied after the engine has aggregated and ranked, so a row keeps its rank and percentile among
 * every row and the answer lists the rows left. This module checks them and writes their SQL; the
 * compiler places it (`compile.ts`).
 */

export const MAX_FILTERS = 20
const MAX_TEXT = 80
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
const OPS: FilterOp[] = [
  'between',
  'atLeast',
  'atMost',
  'anyOf',
  'noneOf',
  'contains',
  'is',
  'isNot',
  'hasValue',
  'hasNone'
]

/** The operators each kind of value takes; a metric's value is a number. */
const OPS_BY_TYPE: Record<AttributeDef['type'], FilterOp[]> = {
  number: ['between', 'atLeast', 'atMost', 'hasValue', 'hasNone'],
  date: ['between', 'atLeast', 'atMost', 'hasValue', 'hasNone'],
  enum: ['anyOf', 'noneOf', 'hasValue', 'hasNone'],
  text: ['anyOf', 'noneOf', 'contains', 'hasValue', 'hasNone'],
  flag: ['is', 'isNot', 'hasValue', 'hasNone']
}

/** The tables an attribute is read from, as the filters join them. */
export const ATTRIBUTE_TABLE_NAMES: Record<AttributeTable, string> = {
  player: 'player_attributes',
  playerSeason: 'player_season_attributes',
  team: 'team_attributes'
}

const ALIAS: Record<AttributeTable, string> = { player: 'fa', playerSeason: 'fs', team: 'ft' }

/** A condition checked: its attribute, or its metric's place among the compiled metrics. */
export interface CheckedFilter {
  filter: StatsFilter
  attribute?: AttributeDef
  metric?: string
}

/**
 * Checks the conditions' shape, before anything reaches SQL, and returns them with their attribute
 * or metric. `fail` throws the engine's error with the message given.
 */
export function checkFilters(
  q: StatsQuery,
  fail: (message: string) => never,
  knownFields: (value: unknown, fields: string[], what: string) => void
): CheckedFilter[] {
  if (q.filters === undefined) return []
  if (!Array.isArray(q.filters) || q.filters.length > MAX_FILTERS) {
    fail(`filters must list at most ${MAX_FILTERS} conditions`)
  }
  return q.filters.map((f, i) => {
    const what = `filters[${i}]`
    knownFields(f, ['attribute', 'metric', 'op', 'value'], what)
    const on = [f.attribute, f.metric].filter((x) => x !== undefined)
    if (on.length !== 1 || typeof on[0] !== 'string') {
      fail(`${what} must name one attribute or one metric`)
    }
    if (!OPS.includes(f.op)) fail(`${what}.op must be one of ${OPS.join(', ')}`)
    if (f.attribute !== undefined) {
      const a = ATTRIBUTE_BY_ID.get(f.attribute) ?? fail(`unknown attribute "${f.attribute}"`)
      if (a.entity !== q.entity) {
        fail(`"${a.id}" is a ${a.entity} attribute, not a ${q.entity} one`)
      }
      checkValue(f, a.type, what, fail)
      return { filter: f, attribute: a }
    }
    checkValue(f, 'number', what, fail)
    return { filter: f, metric: f.metric }
  })
}

function checkValue(
  f: StatsFilter,
  type: AttributeDef['type'],
  what: string,
  fail: (message: string) => never
): void {
  if (!OPS_BY_TYPE[type].includes(f.op)) {
    fail(`${what}: ${f.op} does not apply to a ${type}; use ${OPS_BY_TYPE[type].join(', ')}`)
  }
  const v = f.value as unknown
  const bound = (x: unknown): boolean =>
    type === 'date'
      ? typeof x === 'string' && DATE.test(x)
      : typeof x === 'number' && Number.isFinite(x)
  const kind = type === 'date' ? 'a date YYYY-MM-DD' : 'a number'
  const word = (x: unknown): boolean =>
    typeof x === 'string' && x.trim().length > 0 && x.length <= MAX_TEXT
  switch (f.op) {
    case 'between': {
      const ok =
        Array.isArray(v) && v.length === 2 && v.every(bound) && (v[0] as never) <= (v[1] as never)
      if (!ok) fail(`${what}.value must be [min, max], each ${kind}`)
      return
    }
    case 'atLeast':
    case 'atMost':
      if (!bound(v)) fail(`${what}.value must be ${kind}`)
      return
    case 'anyOf':
    case 'noneOf':
      if (!Array.isArray(v) || v.length === 0 || v.length > 64 || !v.every(word)) {
        fail(`${what}.value must list 1–64 texts of up to ${MAX_TEXT} characters`)
      }
      return
    case 'contains':
      if (!word(v)) fail(`${what}.value must be a text of up to ${MAX_TEXT} characters`)
      return
    default:
      if (v !== undefined) fail(`${what}: ${f.op} takes no value`)
  }
}

/** The metrics the conditions name that the query does not list: computed for them, not shown. */
export function filterMetrics(q: StatsQuery, checked: CheckedFilter[]): string[] {
  return [
    ...new Set(
      checked.flatMap((c) => (c.metric && !q.metrics.includes(c.metric) ? [c.metric] : []))
    )
  ]
}

/**
 * Why no row can answer these conditions, or null: an attribute the league does not have or has in
 * none of the seasons in scope, or a metric with no answer to the query (its column's reason).
 */
export function filterGap(
  checked: CheckedFilter[],
  league: League,
  seasons: number[],
  metrics: MetricDef[],
  gaps: (string | null)[]
): string | null {
  for (const c of checked) {
    if (c.attribute) {
      const gap = attributeGap(c.attribute, league.id, seasons)
      if (gap !== null) {
        return gap.startsWith(`${c.attribute.label}:`) ? gap : `${c.attribute.label}: ${gap}`
      }
      continue
    }
    const i = metrics.findIndex((m) => m.id === c.metric)
    if (i >= 0 && gaps[i] !== null) return `${metrics[i].label}: ${gaps[i]}`
  }
  return null
}

/** The built tables the conditions read, for the check that the file holds them. */
export function filterTables(checked: CheckedFilter[]): string[] {
  return [
    ...new Set(
      checked.flatMap((c) => (c.attribute ? [ATTRIBUTE_TABLE_NAMES[c.attribute.table]] : []))
    )
  ]
}

/**
 * The conditions in SQL over the ranked rows `x`: the joins to the attribute tables, whether a row
 * passes every condition, and whether it is a row the conditions cannot place: one that lacks a
 * value a condition needs and passes every condition it has a value for. A row that fails a
 * condition it has a value for is known to fail, so it is not counted as left out for no value
 * ("experience 0 and height at least 82": a veteran with no height is not counted). A row's season, for an
 * attribute that changes by season and for age, is its group's season when the query groups by
 * season, else the latest season of its rows in scope. `metricIndex` gives a metric's compiled place
 * (its `t<i>` column, the value as the transform shows it); `add` binds a value.
 */
export function filterSql(
  checked: CheckedFilter[],
  groupBy: GroupBy[],
  league: League,
  metricIndex: (id: string) => number,
  add: (value: string | number | boolean) => string
): { joins: string; pass: string; missing: string } {
  const season = groupBy.includes('season') ? 'x.g_season' : 'x.last_season'
  const used = new Set(checked.flatMap((c) => (c.attribute ? [c.attribute.table] : [])))
  const joins = [...used]
    .map((t) => {
      const name = ATTRIBUTE_TABLE_NAMES[t]
      const a = ALIAS[t]
      if (t === 'player') return `LEFT JOIN ${name} ${a} ON ${a}.player_id = x.id`
      const key = t === 'team' ? 'team_id' : 'player_id'
      return `LEFT JOIN ${name} ${a} ON ${a}.${key} = x.id AND ${a}.season = ${season}`
    })
    .join('\n      ')
  const passes: string[] = []
  const unknownOrPass: string[] = []
  const missing: string[] = []
  for (const c of checked) {
    const subject = c.attribute
      ? attributeSql(c.attribute, league, season)
      : `x.t${metricIndex(c.metric as string)}`
    const type = c.attribute?.type ?? 'number'
    const cond = condition(c.filter, subject, type, add)
    passes.push(`coalesce(${cond}, false)`)
    unknownOrPass.push(`coalesce(${cond}, true)`)
    if (c.filter.op !== 'hasValue' && c.filter.op !== 'hasNone') missing.push(`${subject} IS NULL`)
  }
  return {
    joins,
    pass: passes.join(' AND ') || 'true',
    missing:
      missing.length > 0
        ? `(${unknownOrPass.join(' AND ')} AND (${missing.join(' OR ')}))`
        : 'false'
  }
}

/** An attribute's value for the row: its column, or age worked out at the season's reference day. */
function attributeSql(a: AttributeDef, league: League, season: string): string {
  const column = `${ALIAS[a.table]}.${a.column}`
  if (a.computed === 'age') {
    const r = AGE_REFERENCE[league.id]
    return `date_sub('year', ${column}, make_date(${season}::INTEGER, ${r.month}, ${r.day}))`
  }
  return column
}

function condition(
  f: StatsFilter,
  subject: string,
  type: AttributeDef['type'],
  add: (value: string | number | boolean) => string
): string {
  const bind = (v: unknown): string =>
    type === 'date' ? `${add(v as string)}::DATE` : add(v as number)
  const lower = (v: unknown): string[] => (v as string[]).map((x) => add(x.trim().toLowerCase()))
  switch (f.op) {
    case 'between': {
      const [lo, hi] = f.value as [unknown, unknown]
      return `${subject} BETWEEN ${bind(lo)} AND ${bind(hi)}`
    }
    case 'atLeast':
      return `${subject} >= ${bind(f.value)}`
    case 'atMost':
      return `${subject} <= ${bind(f.value)}`
    case 'anyOf':
      return `lower(${subject}) IN (${lower(f.value).join(', ')})`
    case 'noneOf':
      return `lower(${subject}) NOT IN (${lower(f.value).join(', ')})`
    case 'contains':
      return `contains(lower(${subject}), ${add((f.value as string).trim().toLowerCase())})`
    case 'is':
      return `${subject} = true`
    case 'isNot':
      return `${subject} = false`
    case 'hasValue':
      return `${subject} IS NOT NULL`
    case 'hasNone':
      return `${subject} IS NULL`
  }
}
