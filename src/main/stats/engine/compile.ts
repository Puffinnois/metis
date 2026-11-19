import {
  componentsOf,
  COMPUTED_WHOLE_SEASONS,
  coverageReason,
  METRICS,
  metricIn,
  MODEL_NO_SPLIT,
  notBuiltYet,
  ONE_SEASON_ONLY,
  PUBLISHED_TYPES_ONLY,
  REGULAR_SEASON_ONLY,
  STATE_ONE_SEASON,
  TOKEN,
  WHOLE_SEASONS_ONLY
} from '@shared/stats/catalogue'
import {
  builds,
  halvesNote,
  PER_MINUTE,
  seasonLabel,
  type League,
  type PerMinuteMode
} from '@shared/leagues'
import { SPLIT_IDS, SPLITS_FIRST_SEASON, splitById } from '@shared/stats/splits'
import {
  POSITION_GROUPS,
  type GameType,
  type Grain,
  type GroupBy,
  type MetricDef,
  type StatsQuery,
  type Transform
} from '@shared/stats/types'
import { gameTable } from '../derived/gameTables'
import { PUBLISHED_DIVISORS, publishedTable } from '../derived/published'
import { SPLIT_PLAYER, SPLIT_PLAYER_SQL, SPLIT_TEAM, SPLIT_TEAM_SQL } from '../derived/splits'
import { PUBLISHED_GAME_TYPES } from '../derived/publishedTables'
import { leftOutGap } from '../leftOut'
import { modelTable, type ModelTable } from '../models/build'
import { grainsOf } from './registry'

/** A query the engine refuses, with a message a person can act on. */
export class StatsQueryError extends Error {}

export const MAX_METRICS = 40
export const DEFAULT_LIMIT = 100
/** A grouped query has a row per player and group: a season by month has about 3,000. */
export const MAX_LIMIT = 5000
const TRANSFORMS: Transform[] = [
  'raw',
  'perGame',
  'per36',
  'per40',
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
  /**
   * The league the query is about (D35): its first season, game types, per-minute modes and the base
   * its qualifying minimums scale from. The worker hands its own league's registry entry.
   */
  league: League
  /** The season now, by the data's label: no query reaches past it. */
  currentSeason: number
  /** Each metric's measured prior (Plan T1006), the sample `shrunk` gives the league's rate. */
  priors?: ReadonlyMap<string, number>
  /**
   * For the stability measure only, never from a query: no row limit, and each row split into the odd
   * and the even games of its player or team (`g_half` 1 and 0), each qualified at half the sample.
   */
  internal?: { unlimited?: boolean; halves?: boolean }
}

/** The internal dimension the stability measure splits a season by: odd and even games. */
const HALF = 'half' as GroupBy

/** What `runQuery` runs: the team games in scope (they scale `minSample`), then the query. */
export interface Compiled {
  grain: Grain
  metrics: MetricDef[]
  /** Per metric: why it has no answer to this query, or null when it has one. */
  gaps: (string | null)[]
  transform: Transform
  /** Per metric: its values are shrunk toward the league by its prior. */
  shrunk: boolean[]
  /** The tables whose own rows were added to the result (`PublishedTable.addsRows`). */
  adds: string[]
  gamesSql: string
  gamesParams: Value[]
  /** A row per season: each season qualifies against its own games, so one in progress is fair. */
  bySeason: boolean
  /** `$factor` is replaced by the qualification factor before it runs. */
  sql: string
  params: Value[]
  /** The team games one row covers, given the games and seasons in scope. */
  rowGames(games: number, seasons: number): number
  /** The team games the catalogue's minimums are stated for: `League.minimumsGames`. */
  fullSeason: number
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
  'shrunk',
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
  /** The tables whose own rows add rows to this query's result (`PublishedTable.addsRows`). */
  adds: string[]
  league: League
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
  const league = ctx.league
  const metrics = q.metrics.map((id) => {
    // As this league reads it: its first season and gaps there, or unavailable where it has none.
    const def = metricIn(METRICS.get(id) ?? fail(`unknown metric "${id}"`), league)
    if (def.entity !== q.entity) fail(`"${id}" is a ${def.entity} metric, not a ${q.entity} one`)
    return def
  })
  const scope = q.scope
  integers(scope.seasons, 'scope.seasons', league.firstSeason, ctx.currentSeason)
  // A query that names no type reads the league's default scope: the regular season, or every counted
  // game where the league counts them all together (D45: the college leagues).
  const gameTypes =
    scope.gameTypes ?? (league.defaultType === 'counted' ? [...league.countedTypes] : ['regular'])
  if (!Array.isArray(gameTypes) || gameTypes.length === 0) {
    fail('scope.gameTypes must be a non-empty list')
  }
  for (const t of gameTypes) {
    if (!league.seasonTypes.includes(t)) {
      fail(`unknown game type "${String(t)}"; use ${league.seasonTypes.join(', ')}`)
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
  const groupBy = [...(q.groupBy ?? [])]
  for (const g of groupBy) {
    if (!GROUPS.includes(g)) fail(`cannot group by "${g}"`)
  }
  if (new Set(groupBy).size !== groupBy.length) fail('groupBy must not repeat')
  const transform = q.transform ?? 'raw'
  if (!TRANSFORMS.includes(transform)) fail(`transform must be one of ${TRANSFORMS.join(', ')}`)
  if (transform in PER_MINUTE && !league.perMinute.includes(transform as PerMinuteMode)) {
    fail(
      `the ${league.name} reads per minute as ${league.perMinute.join(' or ')}, not ${transform}`
    )
  }
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
  if (q.shrunk !== undefined) flag(q.shrunk, 'shrunk')
  if (
    q.shrunk &&
    (transform === 'percentile' || transform === 'zScore' || transform === 'vsLeague')
  ) {
    const perMinute = league.perMinute.map((m) => `per ${PER_MINUTE[m]}`).join(', ')
    fail(`shrunk works with totals, per game, ${perMinute} and per 100`)
  }
  if (ctx.internal?.halves) groupBy.push(HALF)

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
  const gaps = metrics.map((m) => gapOf(m, q, grain, gameTypes, transform, league))
  // A table adds rows only where a metric reads it with an answer, so a query reading none is the
  // query it was. A published table has whole seasons, so only the season grain; and never for the
  // stability measure, which would only drop them again (they never qualify).
  const adds = [
    ...new Set(
      metrics.flatMap((m, i) =>
        m.published &&
        gaps[i] === null &&
        grain === 'season' &&
        !ctx.internal &&
        publishedTable(m.published)?.addsRows
          ? [m.published]
          : []
      )
    )
  ]
  return { metrics, gaps, grain, gameTypes, transform, groupBy, adds, league }
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
export const splitsFrom = (league: League): string =>
  `Splits are counted from the play by play, from ${seasonLabel(league, SPLITS_FIRST_SEASON)}.`

/** The components a split row can sum, per entity. */
const SPLIT_SQL = { player: SPLIT_PLAYER_SQL, team: SPLIT_TEAM_SQL }

/** Why a metric has no answer under a split; null when the plays answer it. */
function splitGap(
  m: MetricDef,
  q: StatsQuery,
  transform: Transform,
  league: League
): string | null {
  // Splits are counted from the plays: a league whose refresh does not build them yet has none.
  if (!builds(league, 'plays')) return notBuiltYet(league, 'plays')
  if (!q.scope.seasons.some((s) => s >= SPLITS_FIRST_SEASON)) return splitsFrom(league)
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
  transform: Transform,
  league: League
): string | null {
  if (m.unavailable) return m.unavailable
  // A source this build leaves out answers nothing for any season or filter (`leftOut.ts`).
  const leftOut = leftOutGap(m, q.scope.split !== undefined, undefined, league)
  if (leftOut !== null) return leftOut
  const coverage = coverageReason(
    m,
    [...new Set(q.scope.seasons)].sort((a, b) => a - b),
    league
  )
  if (coverage !== null) return coverage
  if (q.scope.split !== undefined) return splitGap(m, q, transform, league)
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
    case 'per40':
    case 'per48':
      // The base is the mode's (36, 40 or 48); which modes a league offers is checked on validation.
      return `{minutes}${fives} / ${PER_MINUTE[transform as PerMinuteMode]}.0`
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
    // `k` is what `minSample` counts when it is not the sample (`qualifyBy`: makes); only those
    // metrics carry it, since a sum per metric costs a wide leaderboard time.
    const qualifyBy = m.qualifyBy !== m.sample ? m.qualifyBy : undefined
    if (c.gaps[i] !== null) {
      return [
        `NULL::DOUBLE AS v${i}`,
        `NULL::DOUBLE AS s${i}`,
        ...(qualifyBy ? [`NULL::DOUBLE AS k${i}`] : [])
      ]
    }
    const by = perDivisor(m, c.transform, q.entity)
    const value = by ? `(${m.value}) / nullif(${by}, 0)` : m.value
    const filled = value.replace(TOKEN, (_, name: string) => sumOf(m, name))
    return [
      `(${filled})::DOUBLE AS v${i}`,
      `(${sumOf(m, m.sample)})::DOUBLE AS s${i}`,
      ...(qualifyBy ? [`(${sumOf(m, qualifyBy)})::DOUBLE AS k${i}`] : [])
    ]
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
  params: Params,
  base: string
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
    SEMI JOIN ${base} b ON b.id = w.${key} AND b.season = w.season AND b.game_type = w.game_type
    ${whole}
    GROUP BY w.${key}${bySeason ? ', w.season' : ''})`
}

/**
 * A game table's sums per output row. It is joined to the box-score rows in scope by player and game,
 * so a date range, the last games, a team, an opponent or any other filter on a game holds exactly,
 * and it groups by what the query groups by. Its `games` are the games with a row.
 */
function gameCte(
  name: string,
  table: string,
  parts: Set<string>,
  c: Checked,
  base: string
): string {
  const t = gameTable(table)
  if (!t) throw new StatsQueryError(`no game table "${table}"`)
  const dims = c.groupBy.map((d) => `b.${d} AS g_${d}`)
  const sums = [...parts].map((p) =>
    p === 'games' ? 'count(DISTINCT w.game_id)::DOUBLE AS games' : `sum(w.${p}) AS ${p}`
  )
  return `${name} AS (
    SELECT b.id, ${[...dims, ...sums].join(', ')}
    FROM ${table} w JOIN ${base} b ON b.id = w.${t.key} AND b.game = w.game_id
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
  params: Params,
  base: string
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
    FROM ${base} b LEFT JOIN ${table} w
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
  params: Params,
  base: string
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
    FROM ${base} b JOIN ${t.table} w
      ON w.${key} = b.id AND ${on} AND w.season IN ${params.list(q.scope.seasons)}
    GROUP BY b.id${c.groupBy.map((d) => `, b.${d}`).join('')})`
}

/**
 * The rows in scope, summed per output row, with each metric's value and sample: CTEs named with the
 * prefix `p`, the last `<p>agg`. With `league`, the last is `<p>league` instead: one row per group of
 * `c.groupBy`, each wanted metric's formula read on the sums over every row in it (`lv<i>`), so a
 * league's rate is its own sums divided (data policy 3), never an average of rates.
 */
function aggregate(
  q: StatsQuery,
  c: Checked,
  params: Params,
  p = '',
  league?: readonly boolean[]
): string {
  const base = `${p}base`
  const player = q.entity === 'player'
  const season = c.grain === 'season'
  const table = `${q.entity}_${season ? 'season' : 'game'}`
  const key = player ? 'player_id' : 'team_id'
  const s = q.scope
  const seasons = params.list(s.seasons)
  const types = params.list(c.gameTypes)
  const needed = neededComponents(q, c)

  const where = [`w.season IN ${seasons}`, `w.game_type IN ${types}`]
  const teamColumn = player && season ? 'w.last_team_id' : 'w.team_id'
  // A league that ranks its Division I teams alone (D40) lists only their rows, and its league sums
  // are theirs; a query naming its players or teams reads them whatever their division.
  if (c.league.divisionIOnly && !s.players && !s.teams) where.push(divisionIOf(teamColumn))
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
      ctes.push(`${p}recent AS (
        SELECT w.${key} AS id, w.game_id FROM ${table} w WHERE ${where.join(' AND ')}
        QUALIFY row_number() OVER (PARTITION BY w.${key} ORDER BY w.game_date DESC, w.game_id DESC)
          <= ${params.add(s.lastN)})`)
      recentJoin = `JOIN ${p}recent r ON r.id = w.${key} AND r.game_id = w.game_id`
    } else if (s.lastNOf === 'team') {
      // The team's last N games: a player who sat some of them out has fewer.
      const inner = [`w.season IN ${seasons}`, `w.game_type IN ${types}`, ...gameWhere(q, params)]
      ctes.push(`${p}recent AS (
        SELECT w.team_id, w.game_id FROM team_game w WHERE ${inner.join(' AND ')}
        QUALIFY row_number() OVER (PARTITION BY w.team_id ORDER BY w.game_date DESC, w.game_id DESC)
          <= ${params.add(s.lastN)})`)
      recentJoin = `JOIN ${p}recent r ON r.team_id = w.team_id AND r.game_id = w.game_id`
    } else {
      lastN = `QUALIFY row_number() OVER (PARTITION BY w.${key} ORDER BY w.game_date DESC, w.game_id DESC)
        <= ${params.add(s.lastN)}`
    }
  }
  // The row's own team at the season grain, for a built table: NULL on a player's row of no team,
  // which `builtCte` relies on.
  // The stability measure's halves: the odd and the even games of each player's (team's) season.
  const half = c.groupBy.includes(HALF)
    ? `row_number() OVER (PARTITION BY w.${key}, w.season ORDER BY w.game_date, w.game_id) % 2 AS half,`
    : ''
  const dimColumns = season
    ? 'w.game_type, w.team_id AS row_team,'
    : `w.team_id AS team, w.opponent_id AS opponent, month(w.game_date) AS month, w.game_id AS game, ${half}`
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
  ctes.push(`${base} AS (
    SELECT w.${key} AS id, w.season, ${season ? 'w.last_date' : 'w.game_date'} AS ord,
           ${teamColumn} AS team_id, ${player ? 'w.position' : 'NULL::VARCHAR AS position'},
           ${dimColumns}
           ${[...needed].map(component).join(', ')}
    FROM ${table} w ${recentJoin} ${splitJoin}
    WHERE ${where.join(' AND ')} ${lastN})`)
  // A per-game leader in a league whose games rule is a share of the team's games (D43) qualifies
  // on its own team's games in scope, not the scope's average.
  const own = league === undefined && ownGamesRule(q, c)
  if (own) ctes.push(ownGamesCte(`${p}own`, q, c, params, base, split))
  // A table that adds rows lists its players with no line in scope beside the box-score rows; the
  // league's sums never have them (Plan T1206).
  const adding = league === undefined && c.adds.length > 0
  const rows = adding ? `${p}rows` : base
  if (adding) {
    ctes.push(addedCte(`${p}added`, q, c, params, seasons, types))
    ctes.push(`${rows} AS (SELECT * FROM ${base} UNION ALL BY NAME SELECT * FROM ${p}added)`)
  }
  // Who a row is: from its box-score rows wherever it has any, else from the table's.
  const identity = adding
    ? `coalesce(arg_max(team_id, ord), arg_max(team_id, season)) AS team_id,
       coalesce(max(season) FILTER (WHERE no_line IS NULL), max(season)) AS last_season,
       coalesce(mode(position) FILTER (WHERE no_line IS NULL), mode(position)) AS position,
       any_value(added_name) AS added_name, bool_and(no_line IS NOT NULL) AS no_line,`
    : 'arg_max(team_id, ord) AS team_id, max(season) AS last_season, mode(position) AS position,'
  ctes.push(`${p}sums AS (
    SELECT id, ${c.groupBy.map((d) => `${d} AS g_${d}, `).join('')}
           ${identity}
           ${[...needed].map((n) => `sum(${n}) AS ${n}`).join(', ')}
    FROM ${rows} GROUP BY id${c.groupBy.map((d) => `, ${d}`).join('')})`)

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
  const alias = (table: string): string => `${p}pub${tables.indexOf(table)}`
  // Built and model tables group by every dimension of the query, as the box scores do.
  const isBuilt = (table: string): boolean =>
    c.metrics.some((m) => m.built === table || m.model === table)
  for (const [table, parts] of published) {
    const model = modelTable(table)
    ctes.push(
      model?.kind === 'state'
        ? stateCte(alias(table), model, parts, q, c, params, base)
        : isBuilt(table)
          ? builtCte(alias(table), table, parts, q, c, params, base)
          : atGames
            ? gameCte(alias(table), table, parts, c, base)
            : // A table that adds rows answers for them too; every other table for the lines only.
              publishedCte(
                alias(table),
                table,
                parts,
                q,
                c,
                params,
                adding && c.adds.includes(table) ? rows : base
              )
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
  if (league) {
    const dims = c.groupBy.map((d) => `s.g_${d}`)
    const values = c.metrics.flatMap((m, i) =>
      league[i]
        ? [`(${m.value.replace(TOKEN, (_, n: string) => `sum(${sumOf(m, n)})`)})::DOUBLE AS lv${i}`]
        : []
    )
    ctes.push(`${p}league AS (
      SELECT ${[...dims, ...values].join(', ')}
      FROM ${p}sums s ${joins.join(' ')}
      ${dims.length > 0 ? `GROUP BY ${dims.join(', ')}` : ''})`)
    return ctes.join(',\n')
  }
  if (own) {
    const by = c.groupBy.map((d) => ` AND o.g_${d} IS NOT DISTINCT FROM s.g_${d}`).join('')
    joins.push(`LEFT JOIN ${p}own o ON o.id = s.id${by}`)
  }
  ctes.push(`${p}agg AS (
    SELECT s.id, ${c.groupBy.map((d) => `s.g_${d}, `).join('')} s.team_id, s.last_season, s.position,
           ${adding ? 's.no_line, s.added_name,' : ''}${own ? ` ${ownGamesOf(q, c, params)} AS team_games,` : ''}
           s.games::DOUBLE AS games, ${metricColumns(q, c, sumOf).join(', ')}
    FROM ${p}sums s ${joins.join(' ')})`)
  return ctes.join(',\n')
}

/**
 * The rows a table that adds rows lists (Plan T1206): each player it counts something this query
 * reads for, in the seasons and season types in scope, with no box-score line in that season and
 * type. "No line" is read from the whole season (`player_season`'s row of no team), not from the rows
 * in scope, so a filter never turns a player who played into one who did not. The filters on rows
 * hold by what the table says of the player: their team, their position, their id. A row's columns
 * are the box-score rows' (`base`), its sums NULL.
 */
function addedCte(
  name: string,
  q: StatsQuery,
  c: Checked,
  params: Params,
  seasons: string,
  types: string
): string {
  const player = q.entity === 'player'
  const key = player ? 'player_id' : 'team_id'
  const s = q.scope
  const divisors: readonly string[] = PUBLISHED_DIVISORS
  const selects = c.adds.map((table) => {
    // The counts this query reads from the table: a player with none of them is not listed.
    const counts = [
      ...new Set(
        c.metrics.flatMap((m, i) =>
          m.published === table && c.gaps[i] === null
            ? componentsOf(m).filter((x) => !divisors.includes(x))
            : []
        )
      )
    ]
    // A player's position: the roster's that season, else their own line's in the season's other
    // type (out of the whole playoff run after a regular season played), else NULL.
    const position = player ? 'coalesce(w.row_position, ps.position)' : 'NULL::VARCHAR'
    const where = [
      `w.season IN ${seasons}`,
      `w.game_type IN ${types}`,
      `(${counts.map((x) => `w.${x} > 0`).join(' OR ') || 'false'})`
    ]
    if (s.teams) where.push(`w.row_team_id IN ${params.list(s.teams.map(Number))}`)
    if (s.positions) where.push(`${position} IN ${params.list(s.positions)}`)
    if (s.players) where.push(`w.${key} IN ${params.list(s.players.map(Number))}`)
    const seasonPosition = player
      ? `LEFT JOIN (
          SELECT player_id, season, mode(position) AS position FROM player_season
          WHERE team_id IS NULL AND season IN ${seasons} GROUP BY 1, 2
        ) ps ON ps.player_id = w.player_id AND ps.season = w.season`
      : ''
    return `SELECT w.${key} AS id, w.season, NULL::DATE AS ord, w.row_team_id AS team_id,
             ${position} AS position, w.game_type, w.row_team_id AS row_team,
             w.row_name AS added_name, true AS no_line
      FROM ${table} w ${seasonPosition}
      WHERE ${where.join(' AND ')}
        AND NOT EXISTS (
          SELECT 1 FROM ${q.entity}_season o
          WHERE o.${key} = w.${key} AND o.season = w.season AND o.game_type = w.game_type
            ${player ? 'AND o.team_id IS NULL' : ''})`
  })
  return `${name} AS (${selects.join('\nUNION ALL BY NAME\n')})`
}

/** What narrows the rows rather than the games: the league leaves it out. */
const NOT_LEAGUE = ['positions', 'teams', 'players', 'starter', 'lastN', 'lastNOf', 'qualifiedOnly']

/**
 * The league in the same scope, for the indexes and `shrunk` (Plan T1006): every player (or team) over
 * the same seasons, season types and games (dates, opponents, home or road, a split), whatever the
 * query's rows are narrowed to (a position, a team, the players compared, the last games). Grouped by
 * the query's season and month, so a row by season reads its own season's league. `want` marks the
 * metrics that need it.
 */
function leagueCte(q: StatsQuery, c: Checked, params: Params, want: readonly boolean[]): string {
  const scope = Object.fromEntries(
    Object.entries(q.scope).filter(([k]) => !NOT_LEAGUE.includes(k))
  ) as StatsQuery['scope']
  const groupBy = c.groupBy.filter((d) => d === 'season' || d === 'month')
  const lq: StatsQuery = { ...q, scope, groupBy }
  // A metric not wanted reads as a gap, so none of its parts is summed.
  // Rows without a line never enter the league's sums (Plan T1206).
  const lc: Checked = {
    ...c,
    groupBy,
    gaps: c.gaps.map((g, i) => (want[i] ? g : 'not wanted')),
    adds: []
  }
  return aggregate(lq, lc, params, 'l_', want)
}

/** The caveats the answer depends on. */
function notesOf(q: StatsQuery, c: Checked): string[] {
  const notes = new Set<string>()
  const s = q.scope
  for (const m of c.metrics) {
    if (s.seasons.some((x) => x < m.firstSeason)) {
      notes.add(`${m.label}: starts in ${seasonLabel(c.league, m.firstSeason)}.`)
    }
    const gaps = (m.missingSeasons ?? []).filter((x) => s.seasons.includes(x))
    if (gaps.length > 0) {
      notes.add(
        m.missingReason
          ? `${m.label}: ${m.missingReason}`
          : `${m.label}: not in the source for ${gaps.map((x) => seasonLabel(c.league, x)).join(', ')}.`
      )
    }
    for (const n of m.seasonNotes ?? []) {
      const held = n.seasons.filter((x) => s.seasons.includes(x))
      if (held.length > 0) {
        notes.add(`${m.label}: ${held.map((x) => seasonLabel(c.league, x)).join(', ')}: ${n.note}`)
      }
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
    notes.add(`${split.label}: ${split.rule} Counted from the ${c.league.name}'s play by play.`)
    const halves = halvesNote(c.league, s.seasons)
    if (halves) notes.add(halves)
    if (s.seasons.some((x) => x < SPLITS_FIRST_SEASON)) {
      notes.add(`${splitsFrom(c.league)} Earlier seasons are left out.`)
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
  // The prior each shrunk rate is pulled by: only a rate (a ratio of sums) with one measured.
  const priors = c.metrics.map((m, i) =>
    q.shrunk && c.gaps[i] === null && m.aggregation === 'ratio' && !isState(m)
      ? ctx.priors?.get(m.id)
      : undefined
  )
  const shrunk = priors.map((k) => k !== undefined)
  // The league in the same scope, for an index and a shrunk rate.
  const want = c.metrics.map((m, i) => c.gaps[i] === null && (m.index !== undefined || shrunk[i]))
  const withLeague = want.some(Boolean)
  const ctes = [aggregate(q, c, params), ...(withLeague ? [leagueCte(q, c, params, want)] : [])]
  const dims = c.groupBy
  const leagueDims = dims.filter((d) => d === 'season' || d === 'month')
  if (withLeague) {
    // An index replaces the value with 100 × value / league (mirrored where lower is better).
    const indexed = c.metrics.flatMap((m, i) => {
      if (!want[i] || m.index === undefined) return []
      const of = `a.v${i} / nullif(l.lv${i}, 0)`
      const mirrored = METRICS.get(m.index)?.direction === 'lower'
      return [`100.0 * ${mirrored ? `(2 - ${of})` : of} AS v${i}`]
    })
    const replace = indexed.length > 0 ? ` REPLACE (${indexed.join(', ')})` : ''
    const leagueValues = want.flatMap((w, i) => (w ? [`l.lv${i}`] : []))
    const on = leagueDims.map((d) => `l.g_${d} IS NOT DISTINCT FROM a.g_${d}`).join(' AND ')
    ctes.push(`withleague AS (
      SELECT a.*${replace}, ${leagueValues.join(', ')}
      FROM agg a LEFT JOIN l_league l ON ${on || 'true'})`)
  }
  const rowsFrom = withLeague ? 'withleague' : 'agg'
  // A shrunk rate: (sample × value + prior × league) / (sample + prior). An index is pulled to 100,
  // its league; a row whose league has no value keeps its own.
  const pulled = c.metrics.flatMap((m, i) => {
    const k = priors[i]
    if (k === undefined) return []
    const pk = params.add(k)
    const lg = m.index !== undefined ? '100.0' : `lv${i}`
    return [
      `CASE WHEN v${i} IS NULL OR ${lg} IS NULL THEN v${i}
         ELSE (s${i} * v${i} + ${pk} * ${lg}) / nullif(s${i} + ${pk}, 0) END AS u${i}`
    ]
  })
  // The value a metric is ranked and shown by, and the rows it ranks among: a shrunk rate ranks every
  // row with a sample, since that is what shrinking is for.
  const val = (i: number): string => (shrunk[i] ? `u${i}` : `v${i}`)
  const okOf = (i: number): string =>
    shrunk[i] ? `s${i} > 0 AND u${i} IS NOT NULL` : `q${i} AND v${i} IS NOT NULL`
  // Percentiles and ranks among qualified rows of the same position (players) and group.
  const group = [...(q.entity === 'player' ? ['position'] : []), ...dims.map((d) => `g_${d}`)]
  const over = (i: number, order: string): string =>
    `OVER (PARTITION BY ${[...group, `(${okOf(i)})`].join(', ')} ORDER BY ${val(i)} ${order})`
  const among = group.length > 0 ? `PARTITION BY ${group.join(', ')}` : ''
  const ranked = c.metrics.flatMap((m, i) => {
    const ok = okOf(i)
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
        return `${val(i)} AS t${i}`
    }
  })
  // A row with a sample qualifies when its qualifying count (`k`: makes for the NBA's shooting
  // leaders, else the sample itself) reaches the minimum scaled to the games in scope, rounded to a
  // whole count as the NBA rounds a shortened season's: 300 × 66 / 82 is 241.5, and it asked 241.
  // A row without a box-score line never qualifies, for any metric (Plan T1206): it is never ranked,
  // never in a league mean or percentile, and its sample is a count with nothing to qualify.
  const adding = c.adds.length > 0
  const ownGames = ownGamesRule(q, c)
  const flags = c.metrics.map((m, i) => {
    const count =
      m.qualifyBy !== undefined && m.qualifyBy !== m.sample ? `coalesce(k${i}, 0)` : `s${i}`
    // A minimum counted in minutes is stated in the minimums' game length: a 40-minute league scales
    // it by 40 over that. Where the lengths agree (the NBA) the SQL is as it was.
    const counted = m.qualifyBy ?? m.sample
    const minutes = counted === 'minutes' ? c.league.gameMinutes / c.league.minimumsMinutes : 1
    const scale = minutes === 1 ? '' : ` * ${minutes.toFixed(6)}`
    return `(s${i} > 0 AND ${count} >= ${minimumSql(m, c.league, ownGames)}${scale})${adding ? ' AND NOT no_line' : ''}) AS q${i}`
  })
  const sort = q.sort ? q.metrics.indexOf(q.sort.metric) : 0
  const lower = c.metrics[sort].direction === 'lower' && c.transform !== 'percentile'
  const dir = q.sort?.dir ?? (lower ? 'asc' : 'desc')
  const player = q.entity === 'player'
  // Ranked rows first: the qualified ones, or every row with a sample when the sort is shrunk or is
  // a count of a table that adds rows, whose rows without a line are listed in order with the rest.
  const sortAdds =
    adding && !!c.metrics[sort].published && c.adds.includes(c.metrics[sort].published)
  const first = shrunk[sort] || sortAdds ? `(s${sort} > 0 AND t${sort} IS NOT NULL)` : `q${sort}`
  const sql = `WITH ${ctes.join(',\n')},
    flagged AS (SELECT a.*, ${[...flags, ...pulled].join(', ')} FROM ${rowsFrom} a),
    ranked AS (SELECT *, ${ranked.join(', ')} FROM flagged),
    shaped AS (SELECT *, ${shaped.join(', ')} FROM ranked)
    SELECT x.*, ${player ? `coalesce(pl.name, ${adding ? 'x.added_name, ' : ''}x.id::VARCHAR)` : 'coalesce(tm.name, x.id::VARCHAR)'} AS name,
           tm.code AS team_code, count(*) OVER () AS total
    FROM shaped x
    ${player ? 'LEFT JOIN player pl ON pl.player_id = x.id' : ''}
    LEFT JOIN team tm ON tm.team_id = x.team_id AND tm.season = x.last_season
    ${q.scope.qualifiedOnly && c.gaps[sort] === null ? `WHERE q${sort}` : ''}
    ORDER BY ${first} DESC, t${sort} ${dir.toUpperCase()} NULLS LAST, name
    ${ctx.internal?.unlimited ? '' : `LIMIT ${q.limit ?? DEFAULT_LIMIT}`}`

  const bySeason =
    c.groupBy.includes('season') && !c.groupBy.includes('game') && q.scope.lastN === undefined
  const gp = new Params()
  const gamesWhere = [
    `w.season IN ${gp.list(q.scope.seasons)}`,
    `w.game_type IN ${gp.list(c.gameTypes)}`,
    ...gameWhere(q, gp)
  ]
  if (q.scope.teams) gamesWhere.push(`w.team_id IN ${gp.list(q.scope.teams.map(Number))}`)
  // A college season's team games are its Division I teams': the 300 and more teams outside it play
  // one to three games each against them, and would halve the average the makes minimums scale by.
  else if (ctx.league.divisionIOnly) gamesWhere.push(divisionIOf('w.team_id'))
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
    shrunk,
    adds: c.adds,
    // The games a team played in scope, on average: teams can be a game or two apart mid-season.
    gamesSql: `SELECT ${bySeason ? 'w.season, ' : ''}
                 count(*)::DOUBLE / nullif(count(DISTINCT (w.team_id, w.season)), 0) * ${bySeason ? '1' : 'count(DISTINCT w.season)'} AS games,
                 ${share}::DOUBLE AS share
               FROM team_game w ${shareJoin} WHERE ${gamesWhere.join(' AND ')}${bySeason ? ' GROUP BY w.season' : ''}`,
    gamesParams: gp.values,
    bySeason,
    sql,
    params: params.values,
    fullSeason: ctx.league.minimumsGames,
    rowGames: (games, seasons) => {
      if (last !== undefined) return Math.min(games, last)
      if (c.groupBy.includes('game')) return 1
      // A half of a season is half its games, so it qualifies at half the sample.
      if (c.groupBy.includes(HALF)) return games / 2
      const bySeasons = c.groupBy.includes('season')
      const perSeason = bySeasons ? games : games / Math.max(1, seasons)
      const span = bySeasons ? 1 : seasons
      // A season's games spread over the league's opponents and months: the NBA meets 29 about
      // three times each over about six months.
      const shape = ctx.league.seasonShape
      if (c.groupBy.includes('opponent')) return (perSeason / shape.opponents) * span
      if (c.groupBy.includes('month')) return (perSeason / shape.months) * span
      return perSeason * span
    },
    notes: [...notesOf(q, c), ...shrunkNotes(q, c, shrunk)]
  }
}

const isState = (m: MetricDef): boolean => modelTable(m.model)?.kind === 'state'

/** SQL: the row's team (`column`, with `w.season`) is in the season's Division I list (D40). */
const divisionIOf = (column: string): string =>
  `EXISTS (SELECT 1 FROM team dt WHERE dt.team_id = ${column} AND dt.season = w.season AND dt.division_i)`

/**
 * Whether a query's per-game leaders qualify on each row's own team games: a player query in a league
 * whose games rule is a share (D43), with such a metric answered. The NBA's and the WNBA's rule scales
 * a count by the scope's games (`$factor`), and their SQL does not change.
 */
function ownGamesRule(q: StatsQuery, c: Checked): boolean {
  return (
    q.entity === 'player' &&
    c.league.gamesRule.kind === 'share' &&
    c.metrics.some((m, i) => m.qualifyBy === 'games' && c.gaps[i] === null)
  )
}

/**
 * The team games each output row's own teams played in scope (D43: "75 percent of the team's games").
 * Every filter on a game holds as it does for the box-score rows, and a row grouped by opponent, month
 * or game counts the team's games against that opponent, in that month or that game. A game with no
 * box score (a forfeit: ESPN's 2-0 row) is no game a player could appear in, so it is not counted.
 * A player who played for two teams in one season takes the team with more games in scope, so the
 * rule never asks less than either team's share; across seasons the seasons' games add up, so a
 * transfer between seasons reads each season's team. Under a split, each team's games scale by its
 * share of the time in the split, as `$factor` does.
 */
function ownGamesCte(
  name: string,
  q: StatsQuery,
  c: Checked,
  params: Params,
  base: string,
  split: string | null
): string {
  const s = q.scope
  const where = [
    `w.season IN ${params.list(s.seasons)}`,
    `w.game_type IN ${params.list(c.gameTypes)}`,
    ...(c.grain === 'game' ? gameWhere(q, params) : [])
  ]
  if (s.teams) where.push(`w.team_id IN ${params.list(s.teams.map(Number))}`)
  if (c.grain === 'season') {
    // At the season grain no filter splits a season, so the season tables answer: each player's teams
    // of the seasons and types in scope, and each team's games with a box score. Read from them, not
    // from the rows in scope, it costs a few milliseconds where the game rows cost a second (T1302.5).
    const players = s.players ? ` AND w.player_id IN ${params.list(s.players.map(Number))}` : ''
    return `${name} AS (
      WITH team_games AS (
        SELECT w.team_id, w.season, sum(w.box_games)::DOUBLE AS n
        FROM team_season w WHERE ${where.join(' AND ')} GROUP BY 1, 2
      ), per_season AS (
        SELECT r.player_id AS id, r.season, max(t.n) AS n
        FROM (SELECT DISTINCT w.player_id, w.season, w.team_id FROM player_season w
              WHERE ${where.join(' AND ')} AND w.team_id IS NOT NULL${players}) r
        JOIN team_games t ON t.team_id = r.team_id AND t.season = r.season
        GROUP BY 1, 2
      )
      SELECT id${c.groupBy.includes('season') ? ', season AS g_season' : ''}, sum(n) AS team_games
      FROM per_season GROUP BY id${c.groupBy.includes('season') ? ', season' : ''})`
  }
  const columns: Partial<Record<GroupBy, string>> = {
    opponent: 'w.opponent_id',
    month: 'month(w.game_date)',
    game: 'w.game_id'
  }
  const by = c.groupBy.filter((d) => columns[d] !== undefined)
  const shareJoin =
    split === null
      ? ''
      : `LEFT JOIN ${SPLIT_TEAM} st ON st.team_id = w.team_id AND st.game_id = w.game_id AND st.split = ${split}`
  const share = split === null ? '' : ' * coalesce(sum(st.seconds) / nullif(sum(w.seconds), 0), 0)'
  // The row's teams at the game grain: each line's own.
  const others = c.groupBy.filter((d) => d !== 'season')
  const teams = `SELECT DISTINCT id, season, team_id${others.map((d) => `, ${d}`).join('')} FROM ${base}`
  const outer = c.groupBy.map((d) => (d === 'season' ? 'season' : d))
  return `${name} AS (
    WITH team_games AS (
      SELECT w.team_id, w.season${by.map((d) => `, ${columns[d]} AS ${d}`).join('')},
             sum(w.box_games)::DOUBLE${share} AS n
      FROM team_game w ${shareJoin} WHERE ${where.join(' AND ')}
      GROUP BY w.team_id, w.season${by.map((d) => `, ${columns[d]}`).join('')}
    ), per_season AS (
      SELECT r.id, r.season${others.map((d) => `, r.${d}`).join('')}, max(t.n) AS n
      FROM (${teams}) r
      JOIN team_games t ON t.team_id = r.team_id AND t.season = r.season${by.map((d) => ` AND t.${d} = r.${d}`).join('')}
      GROUP BY r.id, r.season${others.map((d) => `, r.${d}`).join('')}
    )
    SELECT id${outer.map((d) => `, ${d} AS g_${d}`).join('')}, sum(n) AS team_games
    FROM per_season GROUP BY id${outer.map((d) => `, ${d}`).join('')})`
}

/** The row's own team games as its minimum reads them: half of them for a half, at most the last N. */
function ownGamesOf(q: StatsQuery, c: Checked, params: Params): string {
  let games = 'coalesce(o.team_games, 0)'
  if (c.groupBy.includes(HALF)) games = `${games} / 2`
  if (q.scope.lastN !== undefined) games = `least(${games}, ${params.add(q.scope.lastN)})`
  return games
}

/**
 * A metric's minimum in SQL, less a minutes scale and its closing bracket: the catalogue's count scaled
 * to the games in scope (`$factor` is the row's team games over `minimumsGames`), rounded as the NBA
 * rounds a shortened season's. A per-game leader in a league whose games rule is a share (D43's 75
 * percent) asks that share of the row's team games instead, rounded up: 75 percent of 31 games is 24.
 * The share is the same `$factor` times `minimumsGames`, rounded to three places first so the factor's
 * six decimals cannot lift a whole count (24.000006) to the next.
 */
function minimumSql(m: MetricDef, league: League, ownGames: boolean): string {
  const rule = league.gamesRule
  if (m.qualifyBy === 'games' && rule.kind === 'share') {
    // The row's own team games (`ownGamesCte`) where the query has them: a player's rows.
    if (ownGames) return `ceil(round(${rule.share} * team_games, 3)`
    return `ceil(round(${rule.share * league.minimumsGames} * $factor, 3)`
  }
  return `round(${m.minSample ?? 0} * $factor`
}

/** What `shrunk` did, and the rates it could not shrink. */
function shrunkNotes(q: StatsQuery, c: Checked, shrunk: boolean[]): string[] {
  if (!q.shrunk) return []
  const left = c.metrics.filter(
    (m, i) => c.gaps[i] === null && m.aggregation === 'ratio' && !shrunk[i]
  )
  return [
    "Shrunk: each rate is pulled toward the league's rate in the same scope by its prior, the sample at which it is half signal. Counts are not shrunk.",
    ...(left.length > 0
      ? [`Not shrunk, no prior measured: ${left.map((m) => m.label).join(', ')}.`]
      : [])
  ]
}
