import type { Entity, GameType } from '@shared/stats/types'
import type { StatsDb } from '../db'
import { inspect, type Have } from '../derived/sql'
import { ADJUSTED_RATINGS } from './adjustedRatings'
import { TEAM_STRENGTH } from './teamStrength'

/**
 * The models (Plan Stage 10): tables computed in TypeScript, a solve or a sequential pass, from the
 * game tables, at the end of a refresh after the plays. `docs/reference/stats-database.md`, "Models".
 */

/**
 * How the engine reads a model table. `sum`: counts and sums, added over the rows in scope and
 * divided when read, like a box score. `state`: a value that is not a sum (a rating), one row per
 * team or player per game holding the value after that game, read at the last game in scope.
 */
export type ModelKind = 'sum' | 'state'

export interface ModelTable {
  table: string
  entity: Entity
  kind: ModelKind
  /**
   * `game`: a row per player or team and game, with `game_id` and `game_date`; any scope reads it.
   * `season`: a row per player or team, team and season type, read for whole seasons only. A state is
   * always at game grain.
   */
  grain: 'game' | 'season'
  /**
   * Every column, typed, in order. The keys come first: `season INTEGER, game_type VARCHAR,
   * team_id BIGINT`, then `player_id BIGINT` for a player table, then `game_id VARCHAR,
   * game_date DATE` at game grain. A player's row is per team, never a total of their teams.
   */
  columns: ReadonlyArray<readonly [string, string]>
  /** The columns a metric can read as `{name}`: never a key. */
  components: readonly string[]
  /** The season types it has rows for; a scope with none of them reads `typesReason`. */
  gameTypes?: readonly GameType[]
  typesReason?: string
}

export interface ModelContext {
  db: StatsDb
  have: Have
  season: number
  /** The season in progress, by final year. */
  current: number
}

/** A season's rows for each of a builder's tables, as objects keyed by column name. */
export type ModelRows = Record<string, ReadonlyArray<Record<string, unknown>>>

/**
 * One Stage 10 task's models. Each task appends one builder to `MODEL_BUILDERS` and owns its tables
 * and files. Builders run in order, so one can read a table an earlier one wrote.
 */
export interface ModelBuilder {
  name: string
  /** Bump when its rows change, so the next refresh recomputes every season of its tables. */
  version: number
  tables: readonly ModelTable[]
  /**
   * The seasons to compute, given the seasons whose data changed: a model carried from one season to
   * the next (Elo) adds the seasons after them. Default: those seasons.
   */
  seasons?: (changed: readonly number[], played: readonly number[]) => number[]
  /** One season's rows. What a missing table or column cannot give reads NULL or is left out. */
  build: (ctx: ModelContext) => Promise<ModelRows>
}

export const MODEL_BUILDERS: readonly ModelBuilder[] = [
  // Plan T1001: SRS and schedule strength as of every game day.
  TEAM_STRENGTH,
  // Plan T1004: offense and defense per 100 possessions, adjusted for opponent and site.
  ADJUSTED_RATINGS
]

/** Bump when the step itself changes how every table is written: every builder recomputes. */
export const MODELS_VERSION = 1

const STATE = 'models'
const BUILDER = 'model:'
const PENDING = 'models:'
/** A file of season 0 holds every season. */
const ALL = 0
/** The tables the models read. */
const NEEDS = ['game', 'team', 'team_game', 'player_game']

export const MODEL_TABLES: readonly ModelTable[] = MODEL_BUILDERS.flatMap((b) => b.tables)

export const modelTable = (name: string | undefined): ModelTable | undefined =>
  name === undefined ? undefined : MODEL_TABLES.find((t) => t.table === name)

const createSql = (t: ModelTable): string =>
  `${t.columns.map(([n, ty]) => `${n} ${ty}`).join(', ')}`

/** The tables, empty, so a query before the first build reads null with a reason, not an error. */
export function modelsBootstrap(): string[] {
  return MODEL_TABLES.map((t) => `CREATE TABLE IF NOT EXISTS ${t.table} (${createSql(t)})`)
}

export async function canBuildModels(db: StatsDb): Promise<boolean> {
  const have = await inspect(db)
  return NEEDS.every((t) => have.tables.has(t))
}

/**
 * Records that a file of this season wrote rows, so the models of that season are computed at the end
 * of the refresh, or on the next one if the app closes first. Season 0 recomputes them all.
 */
export async function markModelSeason(db: StatsDb, season: number): Promise<void> {
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, 0)', [`${PENDING}${season}`])
}

async function version(db: StatsDb, name: string): Promise<number> {
  const row = await db.get<{ version: number }>(
    'SELECT version FROM derived_state WHERE name = ?',
    [name]
  )
  return row?.version ?? 0
}

async function pendingSeasons(db: StatsDb): Promise<number[]> {
  const rows = await db.all<{ name: string }>(
    `SELECT name FROM derived_state WHERE name LIKE '${PENDING}%'`
  )
  return rows.map((r) => Number(r.name.slice(PENDING.length)))
}

/** Whether the table is there with exactly these columns and types, in order. */
async function shaped(db: StatsDb, t: ModelTable): Promise<boolean> {
  const rows = await db.all<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM duckdb_columns()
     WHERE schema_name = 'main' AND table_name = ? ORDER BY column_index`,
    [t.table]
  )
  return (
    rows.length === t.columns.length &&
    rows.every((r, i) => r.column_name === t.columns[i][0] && r.data_type === t.columns[i][1])
  )
}

/** Whether a builder must recompute every season: the step's or its own version, or a table's shape. */
async function wholeBuilder(db: StatsDb, b: ModelBuilder, stale: boolean): Promise<boolean> {
  if (stale || (await version(db, `${BUILDER}${b.name}`)) !== b.version) return true
  for (const t of b.tables) if (!(await shaped(db, t))) return true
  return false
}

/**
 * Whether the step is due: a season waiting (a file wrote rows, or the last run failed before it
 * finished), the step's version, or a builder that is new, of a new version or of another shape.
 */
export async function modelsDue(db: StatsDb): Promise<boolean> {
  if ((await pendingSeasons(db)).length > 0) return true
  const stale = (await version(db, STATE)) !== MODELS_VERSION
  for (const b of MODEL_BUILDERS) if (await wholeBuilder(db, b, stale)) return true
  return false
}

export interface ModelPlan {
  builder: ModelBuilder
  all: boolean
  seasons: number[]
}

/**
 * The seasons each builder computes: every season played when it must recompute all, else the seasons
 * whose files wrote rows. A season an earlier builder recomputes is recomputed by every later one
 * too, since it may read that table. A sealed season whose files did not change is never recomputed.
 */
export async function planModels(db: StatsDb): Promise<ModelPlan[]> {
  const played = (
    await db.all<{ season: number }>(
      'SELECT DISTINCT season FROM game WHERE played AND season IS NOT NULL ORDER BY season'
    )
  ).map((r) => r.season)
  const pending = await pendingSeasons(db)
  const stale = (await version(db, STATE)) !== MODELS_VERSION || pending.includes(ALL)
  const carried = new Set<number>()
  const plans: ModelPlan[] = []
  for (const b of MODEL_BUILDERS) {
    const all = await wholeBuilder(db, b, stale)
    const changed = all ? played : played.filter((s) => pending.includes(s) || carried.has(s))
    const wanted = new Set(b.seasons ? b.seasons(changed, played) : changed)
    const seasons = played.filter((s) => wanted.has(s))
    for (const s of seasons) carried.add(s)
    plans.push({ builder: b, all, seasons })
  }
  return plans
}

/** Rows written in batches of this many: one statement per row would take seconds a season. */
const BATCH = 500

async function insertRows(
  db: StatsDb,
  t: ModelTable,
  rows: ReadonlyArray<Record<string, unknown>>
): Promise<void> {
  const names = t.columns.map(([n]) => n)
  const cast = t.columns.map(([, ty]) => ty)
  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH)
    const params: (string | number | boolean | null)[] = []
    const tuples = batch.map((row) => {
      const cells = names.map((n, i) => {
        const v = row[n]
        params.push(v === undefined || v === null ? null : (v as string | number | boolean))
        return `$${params.length}::${cast[i]}`
      })
      return `(${cells.join(', ')})`
    })
    await db.exec(
      `INSERT INTO ${t.table} (${names.join(', ')}) VALUES ${tuples.join(', ')}`,
      params
    )
  }
}

/**
 * Computes what is due, builder by builder and season by season. A season of a builder is replaced in
 * one transaction (its rows deleted from each of its tables, its new rows inserted), so a reader sees
 * it whole, old or new, never half. A table of another shape is created empty first, and a builder
 * recomputing every season drops the seasons no longer played. Returns the rows written.
 */
export async function buildModels(db: StatsDb, current: number): Promise<number> {
  const plans = await planModels(db)
  const have = await inspect(db)
  let written = 0
  for (const { builder, all, seasons } of plans) {
    for (const t of builder.tables) {
      if (!(await shaped(db, t)))
        await db.exec(`CREATE OR REPLACE TABLE ${t.table} (${createSql(t)})`)
    }
    for (const season of seasons) {
      const rows = await builder.build({ db, have, season, current })
      written += await db.transaction(async () => {
        let n = 0
        for (const t of builder.tables) {
          await db.exec(`DELETE FROM ${t.table} WHERE season = ?`, [season])
          const list = rows[t.table] ?? []
          await insertRows(db, t, list)
          n += list.length
        }
        return n
      })
    }
    if (all) {
      const kept = seasons.length > 0 ? seasons.join(', ') : 'NULL'
      for (const t of builder.tables) {
        await db.exec(`DELETE FROM ${t.table} WHERE season IS NULL OR season NOT IN (${kept})`)
      }
    }
    await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', [
      `${BUILDER}${builder.name}`,
      builder.version
    ])
  }
  await db.transaction(async () => {
    await db.exec(`DELETE FROM derived_state WHERE name LIKE '${PENDING}%'`)
    await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', [STATE, MODELS_VERSION])
  })
  return written
}
