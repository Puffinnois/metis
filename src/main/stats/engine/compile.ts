import {
  componentsOf,
  COMPUTED_WHOLE_SEASONS,
  coverageReason,
  METRICS,
  MODEL_NO_SPLIT,
  ONE_SEASON_ONLY,
  PUBLISHED_TYPES_ONLY,
  REGULAR_SEASON_ONLY,
  STATE_ONE_SEASON,
  TOKEN,
  WHOLE_SEASONS_ONLY
} from '@shared/stats/catalogue'
import { seasonLabel } from '@shared/stats/seasons'
import { SPLIT_IDS, SPLITS_FIRST_SEASON, splitById } from '@shared/stats/splits'
import {
  GAME_TYPES,
  POSITION_GROUPS,
  type GameType,
  type Grain,
  type GroupBy,
  type MetricDef,
  type StatsQuery,
  type Transform
} from '@shared/stats/types'
import { gameTable } from '../derived/gameTables'
import { publishedTable } from '../derived/published'
import { SPLIT_PLAYER, SPLIT_PLAYER_SQL, SPLIT_TEAM, SPLIT_TEAM_SQL } from '../derived/splits'
import { PUBLISHED_GAME_TYPES } from '../derived/publishedTables'
import { modelTable, type ModelTable } from '../models/build'
import { grainsOf } from './registry'

/** A query the engine refuses, with a message a person can act on. */
export class StatsQueryError extends Error {}

export const MAX_METRICS = 40
export const DEFAULT_LIMIT = 100
/** A grouped query has a row per player and group: a season by month has about 3,000. */
export const MAX_LIMIT = 5000
/** `minSample` is for 82 games; it scales with the team games a row covers. */
export const FULL_SEASON = 82
const FIRST_SEASON = 1994

const TRANSFORMS: Transform[] = [
  'raw',
  'perGame',
  'per36',
  'per48',
  'per100',
  'percentile',
  'zScore',
  'vsLeague'
]
const GROUPS: GroupBy[] = ['season', 'team', 'opponent', 'month', 'game']
const ID = /^-?[0-9]{1,12}$/
const WORD = /^[a-z-]{1,20}$/
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
/** The NBA's id, or `espn:<id>` before 1996-97. */
const GAME_ID = /^[a-z0-9:]{1,24}$/

type Value = string | number | boolean

/** Bound parameters, numbered as they are added ($1, $2, …): no user value is spliced into SQL. */
class Params {
  readonly values: Value[] = []
  add(value: Value): string {
    this.values.push(value)
    return `$${this.values.length}`
  }
  list(values: Value[]): string {
    return `(${values.map((v) => this.add(v)).join(', ')})`
  }
}

export interface CompileContext {
  /** The season now, by final year: no query reaches past it. */
  currentSeason: number
}

/** What `runQuery` runs: the team games in scope (they scale `minSample`), then the query. */
export interface Compiled {
  grain: Grain
  metrics: MetricDef[]
  /** Per metric: why it has no answer to this query, or null when it has one. */
  gaps: (string | null)[]
  transform: Transform
  gamesSql: string
  gamesParams: Value[]
  /** A row per season: each season qualifies against its own games, so one in progress is fair. */
  bySeason: boolean
  /** `$factor` is replaced by the qualification factor before it runs. */
  sql: string
  params: Value[]
  /** The team games one row covers, given the games and seasons in scope. */
  rowGames(games: number, seasons: number): number
  notes: string[]
}

function fail(message: string): never {
  throw new StatsQueryError(message)
}

function integers(values: unknown, what: string, min: number, max: number): number[] {
  if (!Array.isArray(values) || values.length === 0) fail(`${what} must be a non-empty list`)
  for (const v of values) {
    if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) {
      fail(`${what} must be whole numbers from ${min} to ${max}`)
    }
  }
  return values as number[]
}

function range(value: unknown, what: string): [number, number] {
  const ok =
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    value[0] <= value[1]
  return ok ? (value as [number, number]) : fail(`${what} must be [min, max]`)
}

function texts(values: unknown, what: string, pattern: RegExp): string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 64) {
    fail(`${what} must list 1–64 values`)
  }
  for (const v of values) {
    if (typeof v !== 'string' || !pattern.test(v)) fail(`${what}: "${String(v)}" is not valid`)
  }
  return values as string[]
}

function flag(value: unknown, what: string): boolean {
  return typeof value === 'boolean' ? value : fail(`${what} must be true or false`)
}

const ids = (values: unknown, what: string): number[] => texts(values, what, ID).map(Number)

const QUERY_FIELDS = [
  'entity',
  'metrics',
  'scope',
  'groupBy',
  'transform',
  'sort',
  'limit',
  'ranks'
]
const SCOPE_FIELDS = [
  'seasons',
  'gameTypes',
  'dates',
  'lastN',
  'lastNOf',
  'positions',
  'teams',
  'opponents',
  'conferences',
  'divisions',
  'months',
  'home',
  'allStarBreak',
  'restDays',
  'starter',
  'result',
  'players',
  'games',
  'split',
  'qualifiedOnly'
]

/** Fields the engine does not know are refused, not ignored: a typo would silently change the answer. */
function knownFields(value: unknown, fields: string[], what: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${what} must be an object`)
  }
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(`unknown ${what} field "${key}"`)
  }
}

interface Checked {
  metrics: MetricDef[]
  gaps: (string | null)[]
  grain: Grain
  gameTypes: GameType[]
  transform: Transform
  groupBy: GroupBy[]
}

/** The checks, with readable messages, before anything reaches SQL. */
function validate(q: StatsQuery, ctx: CompileContext): Checked {
  knownFields(q, QUERY_FIELDS, 'query')
  knownFields(q.scope, SCOPE_FIELDS, 'scope')
  if (q.entity !== 'player' && q.entity !== 'team') fail('entity must be "player" or "team"')
  if (!Array.isArray(q.metrics) || q.metrics.length === 0 || q.metrics.length > MAX_METRICS) {
    fail(`metrics must list 1–${MAX_METRICS} catalogue ids`)
  }
  if (new Set(q.metrics).size !== q.metrics.length) fail('metrics must not repeat')
  const metrics = q.metrics.map((id) => {
    const def = METRICS.get(id) ?? fail(`unknown metric "${id}"`)
    if (def.entity !== q.entity) fail(`"${id}" is a ${def.entity} metric, not a ${q.entity} one`)
    return def
  })
  const scope = q.scope
  integers(scope.seasons, 'scope.seasons', FIRST_SEASON, ctx.currentSeason)
  const gameTypes = scope.gameTypes ?? ['regular']
  if (!Array.isArray(gameTypes) || gameTypes.length === 0) {
    fail('scope.gameTypes must be a non-empty list')
  }
  for (const t of gameTypes) {
    if (!GAME_TYPES.includes(t)) {
      fail(`unknown game type "${String(t)}"; use ${GAME_TYPES.join(', ')}`)
    }
  }
  if (scope.dates !== undefined) {
    const [from, to] = texts(scope.dates, 'scope.dates', DATE)
    if (scope.dates.length !== 2 || from > to) fail('scope.dates must be [from, to]')
  }
  if (scope.lastN !== undefined) integers([scope.lastN], 'scope.lastN', 1, 200)
  if (scope.lastNOf !== undefined && !['appearances', 'team'].includes(scope.lastNOf)) {
    fail('scope.lastNOf must be appearances or team')
  }
  if (scope.lastNOf === 'team' && q.entity === 'team') fail('scope.lastNOf is for players')
  if (scope.positions !== undefined) {
    if (q.entity === 'team') fail('scope.positions is for players')
    texts(scope.positions, 'scope.positions', /^[A-Z]{1,2}$/)
    for (const p of scope.positions) {
      if (!(POSITION_GROUPS as readonly string[]).includes(p)) {
        fail(`unknown position "${p}"; use ${POSITION_GROUPS.join(', ')}`)
      }
    }
  }
  if (scope.teams !== undefined) ids(scope.teams, 'scope.teams')
  if (scope.opponents !== undefined) ids(scope.opponents, 'scope.opponents')
  if (scope.conferences !== undefined) texts(scope.conferences, 'scope.conferences', WORD)
  if (scope.divisions !== undefined) texts(scope.divisions, 'scope.divisions', WORD)
  if (scope.months !== undefined) integers(scope.months, 'scope.months', 1, 12)
  if (scope.home !== undefined) flag(scope.home, 'scope.home')
  if (scope.allStarBreak !== undefined && !['before', 'after'].includes(scope.allStarBreak)) {
    fail('scope.allStarBreak must be before or after')
  }
  if (scope.restDays !== undefined) {
    integers(range(scope.restDays, 'scope.restDays'), 'scope.restDays', 0, 400)
  }
  if (scope.starter !== undefined) {
    if (q.entity === 'team') fail('scope.starter is for players')
    flag(scope.starter, 'scope.starter')
  }
  if (scope.result !== undefined && !['win', 'loss'].includes(scope.result)) {
    fail('scope.result must be win or loss')
  }
  if (scope.players !== undefined) {
    if (q.entity === 'team') fail('scope.players is for players')
    ids(scope.players, 'scope.players')
  }
  if (scope.games !== undefined) texts(scope.games, 'scope.games', GAME_ID)
  if (scope.split !== undefined && !SPLIT_IDS.includes(scope.split)) {
    fail(`unknown split "${String(scope.split)}"; use ${SPLIT_IDS.join(', ')}`)
  }
  if (scope.qualifiedOnly !== undefined) flag(scope.qualifiedOnly, 'scope.qualifiedOnly')
  const groupBy = q.groupBy ?? []
  for (const g of groupBy) {
    if (!GROUPS.includes(g)) fail(`cannot group by "${g}"`)
  }
  if (new Set(groupBy).size !== groupBy.length) fail('groupBy must not repeat')
  const transform = q.transform ?? 'raw'
  if (!TRANSFORMS.includes(transform)) fail(`transform must be one of ${TRANSFORMS.join(', ')}`)
  if (q.sort !== undefined && (q.sort === null || typeof q.sort !== 'object')) {
    fail('sort must be { metric, dir }')
  }
  if (q.sort !== undefined) {
    if (!q.metrics.includes(q.sort.metric)) fail('sort.metric must be one of the metrics')
    if (q.sort.dir !== 'asc' && q.sort.dir !== 'desc') fail('sort.dir must be asc or desc')
  }
  if (q.limit !== undefined) integers([q.limit], 'limit', 1, MAX_LIMIT)
  if (q.ranks !== undefined && typeof q.ranks !== 'boolean') fail('ranks must be true or false')
  if (q.ranks === false && transform === 'percentile') fail('percentile needs ranks')

  // The season tables answer anything that does not split a season's games.
  const games =
    scope.dates !== undefined ||
    scope.games !== undefined ||
    scope.lastN !== undefined ||
    scope.opponents !== undefined ||
    scope.conferences !== undefined ||
    scope.divisions !== undefined ||
    scope.months !== undefined ||
    scope.home !== undefined ||
    scope.allStarBreak !== undefined ||
    scope.restDays !== undefined ||
    scope.starter !== undefined ||
    scope.result !== undefined ||
    scope.split !== undefined ||
    groupBy.some((g) => g !== 'season')
  const grain: Grain = games ? 'game' : 'season'
  for (const m of metrics) {
    const grains = grainsOf(m)
    // A published metric under a filter that splits a season is a gap with a reason, not a refusal.
    if ((m.published || m.model) && grains.length > 0) continue
    if (!grains.includes(grain)) fail(`"${m.id}" cannot be read at the ${grain} grain`)
  }
  const gaps = metrics.map((m) => gapOf(m, q, grain, gameTypes, transform))
  return { metrics, gaps, grain, gameTypes, transform, groupBy }
}

/** What a published table can leave out, for the transform that needs it. */
const UNPUBLISHED = {
  games: 'Published without games played.',
  minutes: 'Published without minutes.',
  possessions: 'Published without possessions.'
}

/** A published metric that a game table answers under a filter that splits a season. */
const fromGames = (m: MetricDef): boolean => grainsOf(m).includes('game') && !!m.publishedGames

/** A metric the plays cannot rebuild: tracking, hustle, what is published, what a box score has alone. */
export const NOT_FROM_PLAYS = 'Not counted from the play by play, so it has no split.'
/**
 * A metric on a built table (`built`) counts per game, not per moment of a game: a split would need the
 * table itself split, so it reads this rather than its whole-game value.
 */
export const BUILT_NO_SPLIT = 'Counted per game, not per moment, so it has no split.'
export const SPLITS_FROM = `Splits are counted from the play by play, from ${seasonLabel(SPLITS_FIRST_SEASON)}.`

/** The components a split row can sum, per entity. */
const SPLIT_SQL = { player: SPLIT_PLAYER_SQL, team: SPLIT_TEAM_SQL }

/** Why a metric has no answer under a split; null when the plays answer it. */
function splitGap(m: MetricDef, q: StatsQuery, transform: Transform): string | null {
  if (!q.scope.seasons.some((s) => s >= SPLITS_FIRST_SEASON)) return SPLITS_FROM
  if (m.published) return NOT_FROM_PLAYS
  if (m.model) return MODEL_NO_SPLIT
  if (m.built) return BUILT_NO_SPLIT
  const by = perDivisor(m, transform, q.entity)
  const parts = [...componentsOf(m), ...(by ? [...by.matchAll(TOKEN)].map((x) => x[1]) : [])]
  return parts.every((p) => p in SPLIT_SQL[q.entity]) ? null : NOT_FROM_PLAYS
}

/**
 * Why a metric has no answer to this query; null when it has one. A season outside its coverage comes
 * first, since no change of filter would answer that.
 */
function gapOf(
  m: MetricDef,
  q: StatsQuery,
  grain: Grain,
  gameTypes: GameType[],
  transform: Transform
): string | null {
  if (m.unavailable) return m.unavailable
  const coverage = coverageReason(
    m,
    [...new Set(q.scope.seasons)].sort((a, b) => a - b)
  )
  if (coverage !== null) return coverage
  if (q.scope.split !== undefined) return splitGap(m, q, transform)
  if (m.model) return modelGap(m, q, grain, gameTypes)
  if (!m.published) return null
  if (grain === 'game') {
    // A game table answers every season type it holds; a divisor it lacks is still a gap.
    const games = fromGames(m) ? gameTable(m.publishedGames) : undefined
    if (!games) return WHOLE_SEASONS_ONLY
    for (const match of (perDivisor(m, transform, q.entity) ?? '').matchAll(TOKEN)) {
      const part = match[1] as keyof typeof UNPUBLISHED
      if (part in UNPUBLISHED && !games.components.includes(part)) return UNPUBLISHED[part]
    }
    return null
  }
  if (!gameTypes.some((t) => PUBLISHED_GAME_TYPES.includes(t))) return PUBLISHED_TYPES_ONLY
  if (m.oneSeason) {
    if (!gameTypes.includes('regular')) return REGULAR_SEASON_ONLY
    const bySeason = q.groupBy?.includes('season') ?? false
    if (!bySeason && new Set(q.scope.seasons).size > 1) return ONE_SEASON_ONLY
  }
  const table = publishedTable(m.published)
  for (const match of (perDivisor(m, transform, q.entity) ?? '').matchAll(TOKEN)) {
    const part = match[1] as keyof typeof UNPUBLISHED
    if (part in UNPUBLISHED && !table?.[part]) return UNPUBLISHED[part]
  }
  return null
}

/**
 * Why a model metric has no answer: a season type it is not computed for, a table of whole seasons
 * under a filter that splits one, or a rating as of a game over several seasons at once.
 */
function modelGap(m: MetricDef, q: StatsQuery, grain: Grain, gameTypes: GameType[]): string | null {
  const t = modelTable(m.model)
  if (!t) return null
  if (t.gameTypes && !gameTypes.some((x) => t.gameTypes?.includes(x))) {
    return t.typesReason ?? `Computed for ${t.gameTypes.join(', ')} games only.`
  }
  if (t.kind === 'sum' && t.grain === 'season' && grain === 'game') return COMPUTED_WHOLE_SEASONS
  if (t.kind === 'state' && new Set(q.scope.seasons).size > 1) {
    const by = q.groupBy ?? []
    if (!by.includes('season') && !by.includes('game')) return STATE_ONE_SEASON
  }
  return null
}

/** The filters on a game, as conditions on `w`: the players' rows and the teams' have them all. */
function gameWhere(q: StatsQuery, params: Params): string[] {
  const s = q.scope
  const where: string[] = []
  if (s.dates) {
    where.push(
      `w.game_date BETWEEN ${params.add(s.dates[0])}::DATE AND ${params.add(s.dates[1])}::DATE`
    )
  }
  if (s.games) where.push(`w.game_id IN ${params.list(s.games)}`)
  if (s.months) where.push(`month(w.game_date) IN ${params.list(s.months)}`)
  if (s.opponents) where.push(`w.opponent_id IN ${params.list(s.opponents.map(Number))}`)
  if (s.conferences) where.push(`w.opp_conference IN ${params.list(s.conferences)}`)
  if (s.divisions) where.push(`w.opp_division IN ${params.list(s.divisions)}`)
  if (s.home !== undefined) where.push(`w.home = ${params.add(s.home)}`)
  if (s.allStarBreak) where.push(`w.after_break = ${params.add(s.allStarBreak === 'after')}`)
  if (s.restDays) {
    where.push(`w.rest_days BETWEEN ${params.add(s.restDays[0])} AND ${params.add(s.restDays[1])}`)
  }
  if (s.result) where.push(`w.${s.result === 'win' ? 'wins' : 'losses'} = 1`)
  return where
}

/** What a sum divides by under a transform; null when the transform leaves it a total. */
function perDivisor(m: MetricDef, transform: Transform, entity: 'player' | 'team'): string | null {
  if (m.aggregation !== 'sum' || m.totalOnly) return null
  if (m.perGameOnly && transform !== 'perGame') return null
  // A team's published minutes are elapsed; its box-score minutes are all five players'.
  const fives = entity === 'team' && !m.published ? ' / 5.0' : ''
  switch (transform) {
    case 'perGame':
      return `{${m.perGameBy ?? 'games'}}`
    case 'per36':
      return `{minutes}${fives} / 36.0`
    case 'per48':
      return `{minutes}${fives} / 48.0`
    case 'per100':
      if (m.published) return '{possessions} / 100.0'
      return entity === 'player' ? '{on_poss} / 100.0' : '{poss_sym} / 100.0'
    default:
      return null
  }
}

/**
 * A metric's formula, or NULL when it has a gap: a gap is never a fabricated zero. `sumOf` reads a
 * component from where this metric's sums are.
 */
function metricColumns(
  q: StatsQuery,
  c: Checked,
  sumOf: (m: MetricDef, component: string) => string
): string[] {
  return c.metrics.flatMap((m, i) => {
    if (c.gaps[i] !== null) return [`NULL::DOUBLE AS v${i}`, `NULL::DOUBLE AS s${i}`]
    const by = perDivisor(m, c.transform, q.entity)
    const value = by ? `(${m.value}) / nullif(${by}, 0)` : m.value
    const filled = value.replace(TOKEN, (_, name: string) => sumOf(m, name))
    return [`(${filled})::DOUBLE AS v${i}`, `(${sumOf(m, m.sample)})::DOUBLE AS s${i}`]
  })
}

/** The components a metric reads, in its own table, under this query's transform. */
function partsOf(m: MetricDef, q: StatsQuery, c: Checked): string[] {
  const by = perDivisor(m, c.transform, q.entity)
  return [...componentsOf(m), ...(by ? [...by.matchAll(TOKEN)].map((match) => match[1]) : [])]
}

/** What a metric's own built or model table holds; undefined for the box scores and published tables. */
function heldBy(m: MetricDef): readonly string[] | undefined {
  return (modelTable(m.model) ?? gameTable(m.built))?.components
}

/** The column a model table's rows are keyed by: the player or the team. */
const keyOfModel = (t: ModelTable): string => (t.entity === 'player' ? 'player_id' : 'team_id')

/** Every component a query reads from the box-score tables. */
function neededComponents(q: StatsQuery, c: Checked): Set<string> {
  const needed = new Set(['games'])
  for (const [i, m] of c.metrics.entries()) {
    // A metric with no answer reads NULL, so nothing of it is needed.
    if (m.published || c.gaps[i] !== null) continue
    // A built or model table's values are read from it; its divisors still come from here.
    const held = heldBy(m)
    for (const part of partsOf(m, q, c)) {
      if (!held?.includes(part)) needed.add(part)
    }
  }
  return needed
}

/**
 * A published table's sums per output row, apart from the box scores so neither multiplies the other.
 * It answers only for what the row's box scores have in scope, so a position or team filter holds. A
 * traded player's row is their whole season: one team's part cannot be read from it, so it counts only
 * when every team they played for that season is in scope.
 */
function publishedCte(
  name: string,
  table: string,
  parts: Set<string>,
  q: StatsQuery,
  c: Checked,
  params: Params
): string {
  const key = q.entity === 'player' ? 'player_id' : 'team_id'
  const bySeason = c.groupBy.includes('season')
  const whole =
    q.entity === 'player' && q.scope.teams
      ? `WHERE NOT EXISTS (
           SELECT 1 FROM player_season o
           WHERE o.player_id = w.player_id AND o.season = w.season AND o.game_type = w.game_type
             AND o.team_id IS NOT NULL AND o.team_id NOT IN ${params.list(q.scope.teams.map(Number))})`
      : ''
  return `${name} AS (
    SELECT w.${key} AS id, ${bySeason ? 'w.season AS g_season, ' : ''}
           ${[...parts].map((p) => `sum(w.${p}) AS ${p}`).join(', ')}
    FROM ${table} w
    SEMI JOIN base b ON b.id = w.${key} AND b.season = w.season AND b.game_type = w.game_type
    ${whole}
    GROUP BY w.${key}${bySeason ? ', w.season' : ''})`
}

/**
 * A game table's sums per output row. It is joined to the box-score rows in scope by player and game,
 * so a date range, the last games, a team, an opponent or any other filter on a game holds exactly,
 * and it groups by what the query groups by. Its `games` are the games with a row.
 */
function gameCte(name: string, table: string, parts: Set<string>, c: Checked): string {
  const t = gameTable(table)
  if (!t) throw new StatsQueryError(`no game table "${table}"`)
  const dims = c.groupBy.map((d) => `b.${d} AS g_${d}`)
  const sums = [...parts].map((p) =>
    p === 'games' ? 'count(DISTINCT w.game_id)::DOUBLE AS games' : `sum(w.${p}) AS ${p}`
  )
  return `${name} AS (
    SELECT b.id, ${[...dims, ...sums].join(', ')}
    FROM ${table} w JOIN base b ON b.id = w.${t.key} AND b.game = w.game_id
    GROUP BY b.id${c.groupBy.map((d) => `, b.${d}`).join('')})`
}

/**
 * A built table's sums per output row, at either grain. At the game grain it joins the box-score rows
 * in scope by player or team and game, so every filter on a game holds; at the season grain by
 * season and season type, and by the row's team when the query names teams, so a traded player's
 * teams are never added together twice. A row in scope with no shot reads 0 attempts, not null.
 */
function builtCte(
  name: string,
  table: string,
  parts: Set<string>,
  q: StatsQuery,
  c: Checked,
  params: Params
): string {
  const model = modelTable(table)
  const t = model ? { key: keyOfModel(model), zero: undefined } : gameTable(table)
  if (!t) throw new StatsQueryError(`no built table "${table}"`)
  const dims = c.groupBy.map((d) => `b.${d} AS g_${d}`)
  const sums = [...parts].map((p) =>
    t.zero?.(p) ? `coalesce(sum(w.${p}), 0) AS ${p}` : `sum(w.${p}) AS ${p}`
  )
  // The row's team is NULL on exactly the rows of a player query that names no team (the season
  // table's row of no team), so which condition holds is known here. Written as `row_team IS NULL OR
  // ...` it cannot be hashed, and DuckDB joined every season row to every built row in a nested loop:
  // a shot zone board over 30 seasons took 4.2 s (Plan T907).
  const byTeam = q.entity === 'team' || q.scope.teams !== undefined
  const on =
    c.grain === 'game'
      ? `b.game = w.game_id`
      : `b.season = w.season AND b.game_type = w.game_type${byTeam ? ' AND w.team_id = b.row_team' : ''}`
  return `${name} AS (
    SELECT b.id, ${[...dims, ...sums].join(', ')}
    FROM base b LEFT JOIN ${table} w
      ON b.id = w.${t.key} AND ${on} AND w.season IN ${params.list(q.scope.seasons)}
    GROUP BY b.id${c.groupBy.map((d) => `, b.${d}`).join('')})`
}

/**
 * A state's value per output row: a rating holds its value after each game, so the row reads it at
 * its last game in scope, by date. At the game grain it joins the box-score rows in scope by game, so
 * a date range or any filter on a game reads the rating as it stood then; at the season grain by
 * season and season type, which reads the season's last game. Rows outside the table's season types
 * read null.
 */
function stateCte(
  name: string,
  t: ModelTable,
  parts: Set<string>,
  q: StatsQuery,
  c: Checked,
  params: Params
): string {
  const key = keyOfModel(t)
  const dims = c.groupBy.map((d) => `b.${d} AS g_${d}`)
  // arg_max_null: a value that is null after the last game (none left) stays null; arg_max would
  // skip that row and read an earlier game's value.
  const picks = [...parts].map((p) => `arg_max_null(w.${p}, (w.game_date, w.game_id)) AS ${p}`)
  const byTeam = t.entity === 'player' && q.scope.teams !== undefined
  const on =
    c.grain === 'game'
      ? 'w.game_id = b.game'
      : `w.season = b.season AND w.game_type = b.game_type${byTeam ? ' AND w.team_id = b.row_team' : ''}`
  return `${name} AS (
    SELECT b.id, ${[...dims, ...picks].join(', ')}
    FROM base b JOIN ${t.table} w
      ON w.${key} = b.id AND ${on} AND w.season IN ${params.list(q.scope.seasons)}
    GROUP BY b.id${c.groupBy.map((d) => `, b.${d}`).join('')})`
}

/** The rows in scope, summed per output row, with each metric's value and sample. */
function aggregate(q: StatsQuery, c: Checked, params: Params): string {
  const player = q.entity === 'player'
  const season = c.grain === 'season'
  const table = `${q.entity}_${season ? 'season' : 'game'}`
  const key = player ? 'player_id' : 'team_id'
  const s = q.scope
  const seasons = params.list(s.seasons)
  const types = params.list(c.gameTypes)
  const needed = neededComponents(q, c)

  const where = [`w.season IN ${seasons}`, `w.game_type IN ${types}`]
  // A player's season table holds a row per team and one with no team. Exactly one kind is read, so
  // a traded player's teams are never added to their total.
  if (s.teams) where.push(`w.team_id IN ${params.list(s.teams.map(Number))}`)
  else if (player && season) where.push('w.team_id IS NULL')
  if (s.positions) where.push(`w.position IN ${params.list(s.positions)}`)
  if (s.players) where.push(`w.player_id IN ${params.list(s.players.map(Number))}`)
  if (!season) where.push(...gameWhere(q, params))
  if (s.starter !== undefined) where.push(`w.starter = ${params.add(s.starter)}`)

  const ctes: string[] = []
  let recentJoin = ''
  let lastN = ''
  const split = s.split !== undefined ? params.add(s.split) : null
  if (s.lastN !== undefined) {
    if (split !== null && s.lastNOf !== 'team') {
      // Under a split, the last N games are the player's or team's own, then the split within them:
      // a game with no moment in the split still counts as one of the N.
      ctes.push(`recent AS (
        SELECT w.${key} AS id, w.game_id FROM ${table} w WHERE ${where.join(' AND ')}
        QUALIFY row_number() OVER (PARTITION BY w.${key} ORDER BY w.game_date DESC, w.game_id DESC)
          <= ${params.add(s.lastN)})`)
      recentJoin = `JOIN recent r ON r.id = w.${key} AND r.game_id = w.game_id`
    } else if (s.lastNOf === 'team') {
      // The team's last N games: a player who sat some of them out has fewer.
      const inner = [`w.season IN ${seasons}`, `w.game_type IN ${types}`, ...gameWhere(q, params)]
      ctes.push(`recent AS (
        SELECT w.team_id, w.game_id FROM team_game w WHERE ${inner.join(' AND ')}
        QUALIFY row_number() OVER (PARTITION BY w.team_id ORDER BY w.game_date DESC, w.game_id DESC)
          <= ${params.add(s.lastN)})`)
      recentJoin = 'JOIN recent r ON r.team_id = w.team_id AND r.game_id = w.game_id'
    } else {
      lastN = `QUALIFY row_number() OVER (PARTITION BY w.${key} ORDER BY w.game_date DESC, w.game_id DESC)
        <= ${params.add(s.lastN)}`
    }
  }
  const teamColumn = player && season ? 'w.last_team_id' : 'w.team_id'
  // The row's own team at the season grain, for a built table: NULL on a player's row of no team,
  // which `builtCte` relies on.
  const dimColumns = season
    ? 'w.game_type, w.team_id AS row_team,'
    : `w.team_id AS team, w.opponent_id AS opponent, month(w.game_date) AS month, w.game_id AS game,`
  // Under a split, the counts are the split's rows, joined to the game lines the filters read.
  const splitJoin =
    split === null
      ? ''
      : player
        ? `JOIN ${SPLIT_PLAYER} sp ON sp.player_id = w.player_id AND sp.game_id = w.game_id AND sp.split = ${split}
           LEFT JOIN ${SPLIT_TEAM} st ON st.game_id = w.game_id AND st.team_id = w.team_id AND st.split = ${split}`
        : `JOIN ${SPLIT_TEAM} st ON st.team_id = w.team_id AND st.game_id = w.game_id AND st.split = ${split}`
  const component = (n: string): string =>
    split === null ? `w.${n}` : `(${SPLIT_SQL[q.entity][n] ?? 'NULL'}) AS ${n}`
  ctes.push(`base AS (
    SELECT w.${key} AS id, w.season, ${season ? 'w.last_date' : 'w.game_date'} AS ord,
           ${teamColumn} AS team_id, ${player ? 'w.position' : 'NULL::VARCHAR AS position'},
           ${dimColumns}
           ${[...needed].map(component).join(', ')}
    FROM ${table} w ${recentJoin} ${splitJoin}
    WHERE ${where.join(' AND ')} ${lastN})`)
  ctes.push(`sums AS (
    SELECT id, ${c.groupBy.map((d) => `${d} AS g_${d}, `).join('')}
           arg_max(team_id, ord) AS team_id, max(season) AS last_season, mode(position) AS position,
           ${[...needed].map((n) => `sum(${n}) AS ${n}`).join(', ')}
    FROM base GROUP BY id${c.groupBy.map((d) => `, ${d}`).join('')})`)

  // Only the tables some metric can answer from: under a game filter, the game tables.
  const atGames = !season
  const tableOf = (m: MetricDef): string | undefined =>
    m.model ?? m.built ?? (atGames ? (fromGames(m) ? m.publishedGames : undefined) : m.published)
  const published = new Map<string, Set<string>>()
  c.metrics.forEach((m, i) => {
    const table = tableOf(m)
    if (!(m.published || m.built || m.model) || !table || c.gaps[i] !== null) return
    const parts = published.get(table) ?? new Set<string>()
    const held = heldBy(m)
    for (const part of partsOf(m, q, c)) {
      if (!held || held.includes(part)) parts.add(part)
    }
    published.set(table, parts)
  })
  const tables = [...published.keys()]
  const alias = (table: string): string => `pub${tables.indexOf(table)}`
  // Built and model tables group by every dimension of the query, as the box scores do.
  const isBuilt = (table: string): boolean =>
    c.metrics.some((m) => m.built === table || m.model === table)
  for (const [table, parts] of published) {
    const model = modelTable(table)
    ctes.push(
      model?.kind === 'state'
        ? stateCte(alias(table), model, parts, q, c, params)
        : isBuilt(table)
          ? builtCte(alias(table), table, parts, q, c, params)
          : atGames
            ? gameCte(alias(table), table, parts, c)
            : publishedCte(alias(table), table, parts, q, c, params)
    )
  }
  // A game or built table's rows group by every dimension; a published table's by the season at most.
  const on = (a: string, table: string): string =>
    atGames || isBuilt(table)
      ? c.groupBy.map((d) => ` AND ${a}.g_${d} IS NOT DISTINCT FROM s.g_${d}`).join('')
      : c.groupBy.includes('season')
        ? ` AND ${a}.g_season = s.g_season`
        : ''
  const joins = tables.map(
    (t) => `LEFT JOIN ${alias(t)} ON ${alias(t)}.id = s.id${on(alias(t), t)}`
  )
  const sumOf = (m: MetricDef, n: string): string => {
    const table = tableOf(m)
    if ((m.built || m.model) && table) {
      return heldBy(m)?.includes(n) ? `${alias(table)}.${n}` : `s.${n}`
    }
    return m.published && table ? `${alias(table)}.${n}` : `s.${n}`
  }
  ctes.push(`agg AS (
    SELECT s.id, ${c.groupBy.map((d) => `s.g_${d}, `).join('')} s.team_id, s.last_season, s.position,
           s.games::DOUBLE AS games, ${metricColumns(q, c, sumOf).join(', ')}
    FROM sums s ${joins.join(' ')})`)
  return ctes.join(',\n')
}

/** The caveats the answer depends on. */
function notesOf(q: StatsQuery, c: Checked): string[] {
  const notes = new Set<string>()
  const s = q.scope
  for (const m of c.metrics) {
    if (s.seasons.some((x) => x < m.firstSeason)) {
      notes.add(`${m.label}: starts in ${seasonLabel(m.firstSeason)}.`)
    }
    const gaps = (m.missingSeasons ?? []).filter((x) => s.seasons.includes(x))
    if (gaps.length > 0) {
      notes.add(`${m.label}: not in the source for ${gaps.map(seasonLabel).join(', ')}.`)
    }
    if (modelTable(m.model)?.kind === 'state' && c.grain === 'game') {
      notes.add(`${m.label}: as of the last game in scope.`)
    }
    // Under a split, a published metric's column already says why it has no value.
    if (m.published && s.split !== undefined) continue
    const games = c.grain === 'game' && fromGames(m)
    if (m.published && c.grain === 'game' && !games) {
      notes.add(`${m.label}: published for whole seasons only.`)
    }
    if (m.published && !games && c.gameTypes.some((t) => !PUBLISHED_GAME_TYPES.includes(t))) {
      notes.add(`${m.label}: published for the regular season and playoffs only.`)
    }
  }
  if (
    q.entity === 'player' &&
    s.teams &&
    c.grain === 'season' &&
    c.metrics.some((m) => m.published)
  ) {
    notes.add(
      "A traded player's published numbers cover their whole season, so one team's part is blank."
    )
  }
  if (s.allStarBreak) {
    notes.add('A season with no All-Star Game on the schedule has no games before or after one.')
  }
  if (s.starter !== undefined && s.seasons.some((x) => x >= 2002 && x <= 2006)) {
    notes.add('Who started is unknown for some games from 2001-02 to 2005-06.')
  }
  const split = splitById(s.split)
  if (split) {
    notes.add(`${split.label}: ${split.rule} Counted from the NBA's play by play.`)
    if (s.seasons.some((x) => x < SPLITS_FIRST_SEASON)) {
      notes.add(`${SPLITS_FROM} Earlier seasons are left out.`)
    }
    if (c.transform === 'per100' || c.metrics.some((m) => /\{(on_)?poss/.test(m.value))) {
      notes.add(
        q.entity === 'player'
          ? "Under a split, per 100 uses the team's possessions counted from the plays (derived) in the same moments, times the player's share of its minutes."
          : 'Under a split, possessions are counted from the plays (derived), not estimated.'
      )
    }
  } else if (q.entity === 'player' && c.transform === 'per100') {
    notes.add(
      "Per 100 uses the team's estimated possessions, times the player's share of its minutes."
    )
  } else if (q.entity === 'team' && c.transform === 'per100') {
    notes.add('Per 100 uses estimated possessions.')
  }
  return [...notes]
}

/** Validates a query and compiles it to parameterised, read-only SQL. */
export function compileQuery(q: StatsQuery, ctx: CompileContext): Compiled {
  const c = validate(q, ctx)
  const params = new Params()
  const ctes = aggregate(q, c, params)
  const dims = c.groupBy
  // Percentiles and ranks among qualified rows of the same position (players) and group.
  const group = [...(q.entity === 'player' ? ['position'] : []), ...dims.map((d) => `g_${d}`)]
  const over = (i: number, order: string): string =>
    `OVER (PARTITION BY ${[...group, `(q${i} AND v${i} IS NOT NULL)`].join(', ')} ORDER BY v${i} ${order})`
  const among = group.length > 0 ? `PARTITION BY ${group.join(', ')}` : ''
  const ranked = c.metrics.flatMap((m, i) => {
    const ok = `q${i} AND v${i} IS NOT NULL`
    const up = m.direction === 'lower' ? 'DESC' : 'ASC'
    const best = m.direction === 'lower' ? 'ASC' : 'DESC'
    const ranks = q.ranks !== false
    return [
      ranks
        ? `CASE WHEN ${ok} THEN 100 * percent_rank() ${over(i, up)} END AS p${i}`
        : `NULL::DOUBLE AS p${i}`,
      ranks ? `CASE WHEN ${ok} THEN rank() ${over(i, best)} END AS r${i}` : `NULL::BIGINT AS r${i}`,
      // The league mean and spread, for the transforms that need them.
      ...(c.transform === 'zScore' || c.transform === 'vsLeague'
        ? [
            `avg(v${i}) FILTER (WHERE ${ok}) OVER (${among}) AS m${i}`,
            `stddev_samp(v${i}) FILTER (WHERE ${ok}) OVER (${among}) AS d${i}`
          ]
        : [])
    ]
  })
  const shaped = c.metrics.map((_, i) => {
    switch (c.transform) {
      case 'percentile':
        return `p${i} AS t${i}`
      case 'zScore':
        return `(v${i} - m${i}) / nullif(d${i}, 0) AS t${i}`
      case 'vsLeague':
        return `v${i} - m${i} AS t${i}`
      default:
        return `v${i} AS t${i}`
    }
  })
  const flags = c.metrics.map(
    (m, i) => `(s${i} > 0 AND s${i} >= ${m.minSample ?? 0} * $factor) AS q${i}`
  )
  const sort = q.sort ? q.metrics.indexOf(q.sort.metric) : 0
  const lower = c.metrics[sort].direction === 'lower' && c.transform !== 'percentile'
  const dir = q.sort?.dir ?? (lower ? 'asc' : 'desc')
  const player = q.entity === 'player'
  const sql = `WITH ${ctes},
    flagged AS (SELECT a.*, ${flags.join(', ')} FROM agg a),
    ranked AS (SELECT *, ${ranked.join(', ')} FROM flagged),
    shaped AS (SELECT *, ${shaped.join(', ')} FROM ranked)
    SELECT x.*, ${player ? 'coalesce(pl.name, x.id::VARCHAR)' : 'coalesce(tm.name, x.id::VARCHAR)'} AS name,
           tm.code AS team_code, count(*) OVER () AS total
    FROM shaped x
    ${player ? 'LEFT JOIN player pl ON pl.player_id = x.id' : ''}
    LEFT JOIN team tm ON tm.team_id = x.team_id AND tm.season = x.last_season
    ${q.scope.qualifiedOnly && c.gaps[sort] === null ? `WHERE q${sort}` : ''}
    ORDER BY q${sort} DESC, t${sort} ${dir.toUpperCase()} NULLS LAST, name
    LIMIT ${q.limit ?? DEFAULT_LIMIT}`

  const bySeason =
    c.groupBy.includes('season') && !c.groupBy.includes('game') && q.scope.lastN === undefined
  const gp = new Params()
  const gamesWhere = [
    `w.season IN ${gp.list(q.scope.seasons)}`,
    `w.game_type IN ${gp.list(c.gameTypes)}`,
    ...gameWhere(q, gp)
  ]
  if (q.scope.teams) gamesWhere.push(`w.team_id IN ${gp.list(q.scope.teams.map(Number))}`)
  // Under a split, a sample scales to the split's share of the time as well: clutch is about 8 %
  // of a team's minutes, so it needs about 8 % of the minutes to qualify.
  const shareJoin = q.scope.split
    ? `LEFT JOIN ${SPLIT_TEAM} st ON st.team_id = w.team_id AND st.game_id = w.game_id AND st.split = ${gp.add(q.scope.split)}`
    : ''
  const share = q.scope.split ? 'coalesce(sum(st.seconds) / nullif(sum(w.seconds), 0), 0)' : '1'
  const last = q.scope.lastN
  return {
    grain: c.grain,
    metrics: c.metrics,
    gaps: c.gaps,
    transform: c.transform,
    // The games a team played in scope, on average: teams can be a game or two apart mid-season.
    gamesSql: `SELECT ${bySeason ? 'w.season, ' : ''}
                 count(*)::DOUBLE / nullif(count(DISTINCT (w.team_id, w.season)), 0) * ${bySeason ? '1' : 'count(DISTINCT w.season)'} AS games,
                 ${share}::DOUBLE AS share
               FROM team_game w ${shareJoin} WHERE ${gamesWhere.join(' AND ')}${bySeason ? ' GROUP BY w.season' : ''}`,
    gamesParams: gp.values,
    bySeason,
    sql,
    params: params.values,
    rowGames: (games, seasons) => {
      if (last !== undefined) return Math.min(games, last)
      if (c.groupBy.includes('game')) return 1
      const bySeasons = c.groupBy.includes('season')
      const perSeason = bySeasons ? games : games / Math.max(1, seasons)
      const span = bySeasons ? 1 : seasons
      // A team meets each opponent about three times a season, and plays about six months.
      if (c.groupBy.includes('opponent')) return (perSeason / 29) * span
      if (c.groupBy.includes('month')) return (perSeason / 6) * span
      return perSeason * span
    },
    notes: notesOf(q, c)
  }
}
