import { covers } from '@shared/stats/catalogue'
import type { GroupBy, MetricValue, StatsQuery, StatsResult } from '@shared/stats/types'
import type { StatsDb } from '../db'
import {
  compileQuery,
  StatsQueryError,
  type CompileContext,
  type Compiled,
  type FileSchema
} from './compile'
import { ATTRIBUTES_NOT_BUILT } from './filters'

/** A query that runs longer is interrupted and reported. */
export const QUERY_TIMEOUT_MS = 5_000

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Runs one `StatsQuery` on a read connection: compiles it, counts the team games in scope
 * (qualification scales `minSample` to them), runs it under a timeout, and shapes the rows. The
 * context names the league, whose file the connection reads.
 */
export async function runQuery(
  db: StatsDb,
  query: StatsQuery,
  ctx: CompileContext,
  timeoutMs = QUERY_TIMEOUT_MS
): Promise<StatsResult> {
  const started = Date.now()
  const compiled = compileQuery(query, ctx)
  // A filter no row can answer says why, and nothing is read (D51); so does one on an attribute
  // table this file does not hold yet, which its next refresh builds.
  const gap = compiled.filterGap ?? (await missingTables(db, compiled.filterTables))
  if (gap !== null) {
    return { ...emptyResult(compiled), filtered: { noValue: 0, reason: gap }, ms: 0 }
  }
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    db.interrupt()
  }, timeoutMs)
  let rows: Record<string, unknown>[]
  let noValue = 0
  try {
    const factor = await qualificationFactor(db, compiled, query)
    rows = await db.all(compiled.sql.replaceAll('$factor', factor), compiled.params)
    // Every row carries the count of rows left out for no value; with none left it is read alone.
    if (compiled.noValueSql && rows.length === 0) {
      const left = await db.get<{ no_value: number }>(
        compiled.noValueSql.replaceAll('$factor', factor),
        compiled.noValueParams
      )
      noValue = num(left?.no_value) ?? 0
    } else if (compiled.noValueSql) {
      noValue = num(rows[0]?.no_value) ?? 0
    }
  } catch (err) {
    if (timedOut) throw new StatsQueryError(`the query took longer than ${timeoutMs / 1000} s`)
    throw err
  } finally {
    clearTimeout(timer)
  }
  const groupBy: GroupBy[] = query.groupBy ?? []
  const seasons = [...new Set(query.scope.seasons)].sort((a, b) => a - b)
  // The metrics the query lists; any after them are computed for its filters only.
  const shown = compiled.metrics.slice(0, compiled.shown)
  // A published column with a blank row says why: the source gives no value for it (a rate over
  // nothing, or a NaN as published, which the published tables read as none).
  const blanks = shown.flatMap((m, i) =>
    m.published && compiled.gaps[i] === null && rows.some((r) => num(r[`v${i}`]) === null)
      ? [`${m.label}: not published for every row; blank where the source gives no value.`]
      : []
  )
  return {
    grain: compiled.grain,
    columns: shown.map((m, i) => ({
      id: m.id,
      label: m.label,
      short: m.short,
      unit: compiled.transform === 'percentile' ? 'number' : m.unit,
      decimals: m.decimals,
      direction: m.direction,
      seasons: compiled.gaps[i] === null ? seasons.filter((s) => covers(m, s)) : [],
      reason: compiled.gaps[i],
      ...(compiled.shrunk[i] ? { shrunk: true } : {}),
      ...(m.qualifyBy !== undefined ? { ownQualifier: true } : {}),
      ...(m.published && compiled.adds.includes(m.published) ? { addsRows: true } : {})
    })),
    rows: rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      team: (r.team_code as string | null) ?? null,
      position: (r.position as string | null) ?? null,
      ...(r.no_line === true ? { noLine: true as const } : {}),
      ...(r.place_all !== undefined
        ? { place: { all: num(r.place_all) ?? 0, standing: num(r.place_standing) } }
        : {}),
      group: Object.fromEntries(
        groupBy.map((g) => [g, (r[`g_${g}`] as string | number | null) ?? null])
      ),
      games: num(r.games) ?? 0,
      values: Object.fromEntries(
        shown.map((m, i): [string, MetricValue] => [
          m.id,
          {
            value: num(r[`t${i}`]),
            raw: num(r[`v${i}`]),
            sample: num(r[`s${i}`]),
            qualified: r[`q${i}`] === true,
            percentile: num(r[`p${i}`]),
            rank: num(r[`r${i}`]),
            ...(compiled.pools ? { pool: num(r[`n${i}`]) } : {})
          }
        ])
      )
    })),
    total: num(rows[0]?.total) ?? 0,
    notes: [...compiled.notes, ...blanks],
    ...(compiled.noValueSql ? { filtered: { noValue, reason: null } } : {}),
    ms: Date.now() - started
  }
}

/** The columns of a query with no rows read: each says why it has none, or its own reason. */
function emptyResult(compiled: Compiled, reason?: string): StatsResult {
  return {
    grain: compiled.grain,
    columns: compiled.metrics.slice(0, compiled.shown).map((m, i) => ({
      id: m.id,
      label: m.label,
      short: m.short,
      unit: compiled.transform === 'percentile' ? 'number' : m.unit,
      decimals: m.decimals,
      direction: m.direction,
      seasons: [],
      reason: reason ?? compiled.gaps[i]
    })),
    rows: [],
    total: 0,
    notes: reason ? [reason] : compiled.notes,
    ms: 0
  }
}

/** Why a filter cannot be read in this file: an attribute table it does not hold yet; else null. */
async function missingTables(db: StatsDb, tables: string[]): Promise<string | null> {
  if (tables.length === 0) return null
  const row = await db.get<{ n: number }>(
    `SELECT count(*) AS n FROM duckdb_tables()
     WHERE schema_name = 'main' AND table_name IN (${tables.map((t) => `'${t}'`).join(', ')})`
  )
  return Number(row?.n ?? 0) === tables.length ? null : ATTRIBUTES_NOT_BUILT
}

/**
 * The engine's answer for a league with no stats to read: off with no file (`League.noData`, the
 * default) or with its tables not built (`League.notBuilt`). The query is still checked, so a bad one
 * is refused as it would be, and every column says why it has no value. No file is opened.
 */
export function noDataResult(
  query: StatsQuery,
  ctx: CompileContext,
  reason: string = ctx.league.noData
): StatsResult {
  return emptyResult(compileQuery(query, ctx), reason)
}

/**
 * What `$factor` reads: the share of a full season's games a row covers, which scales `minSample`.
 * By season, each season's own games (a row reads its season's factor); otherwise the scope's.
 */
export async function qualificationFactor(
  db: StatsDb,
  compiled: Compiled,
  query: StatsQuery
): Promise<string> {
  if (compiled.bySeason) {
    const games = await db.all<{ season: number; games: number; share: number | null }>(
      compiled.gamesSql,
      compiled.gamesParams
    )
    const when = games.map(
      (g) =>
        `WHEN ${Number(g.season)} THEN ${((compiled.rowGames(g.games, 1) * (num(g.share) ?? 1)) / compiled.fullSeason).toFixed(6)}`
    )
    return when.length ? `(CASE a.g_season ${when.join(' ')} ELSE 0 END)` : '0'
  }
  const scope = await db.get<{ games: number; share: number | null }>(
    compiled.gamesSql,
    compiled.gamesParams
  )
  const seasons = new Set(query.scope.seasons).size
  // Under a split, the split's share of the time scales the sample too.
  const share = num(scope?.share) ?? 1
  return ((compiled.rowGames(scope?.games ?? 0, seasons) * share) / compiled.fullSeason).toFixed(6)
}

/** The open file's tables in the main schema, each with its columns: `CompileContext.schema`. */
export async function readFileSchema(db: StatsDb): Promise<FileSchema> {
  const rows = await db.all<{ table_name: string; cols: string[]; rows: number }>(
    `SELECT c.table_name, list(c.column_name) AS cols, any_value(t.estimated_size) AS rows
     FROM duckdb_columns() c JOIN duckdb_tables() t USING (table_oid)
     WHERE c.schema_name = 'main' GROUP BY 1`
  )
  return {
    columns: new Map(rows.map((r) => [r.table_name, new Set(r.cols)])),
    empty: new Set(rows.filter((r) => Number(r.rows) === 0).map((r) => r.table_name))
  }
}
