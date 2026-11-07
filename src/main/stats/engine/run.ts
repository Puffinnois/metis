import { covers } from '@shared/stats/catalogue'
import type { GroupBy, MetricValue, StatsQuery, StatsResult } from '@shared/stats/types'
import type { StatsDb } from '../db'
import { compileQuery, FULL_SEASON, StatsQueryError, type CompileContext } from './compile'

/** A query that runs longer is interrupted and reported. */
export const QUERY_TIMEOUT_MS = 5_000

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Runs one `StatsQuery` on a read connection: compiles it, counts the team games in scope
 * (qualification scales `minSample` to them), runs it under a timeout, and shapes the rows.
 */
export async function runQuery(
  db: StatsDb,
  query: StatsQuery,
  ctx: CompileContext,
  timeoutMs = QUERY_TIMEOUT_MS
): Promise<StatsResult> {
  const started = Date.now()
  const compiled = compileQuery(query, ctx)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    db.interrupt()
  }, timeoutMs)
  let rows: Record<string, unknown>[]
  try {
    let factor: string
    if (compiled.bySeason) {
      // Each season's own games: a row reads its season's factor.
      const games = await db.all<{ season: number; games: number }>(
        compiled.gamesSql,
        compiled.gamesParams
      )
      const when = games.map(
        (g) =>
          `WHEN ${Number(g.season)} THEN ${(compiled.rowGames(g.games, 1) / FULL_SEASON).toFixed(6)}`
      )
      factor = when.length ? `(CASE a.g_season ${when.join(' ')} ELSE 0 END)` : '0'
    } else {
      const scope = await db.get<{ games: number }>(compiled.gamesSql, compiled.gamesParams)
      const seasons = new Set(query.scope.seasons).size
      factor = (compiled.rowGames(scope?.games ?? 0, seasons) / FULL_SEASON).toFixed(6)
    }
    rows = await db.all(compiled.sql.replaceAll('$factor', factor), compiled.params)
  } catch (err) {
    if (timedOut) throw new StatsQueryError(`the query took longer than ${timeoutMs / 1000} s`)
    throw err
  } finally {
    clearTimeout(timer)
  }
  const groupBy: GroupBy[] = query.groupBy ?? []
  const seasons = [...new Set(query.scope.seasons)].sort((a, b) => a - b)
  return {
    grain: compiled.grain,
    columns: compiled.metrics.map((m, i) => ({
      id: m.id,
      label: m.label,
      short: m.short,
      unit: compiled.transform === 'percentile' ? 'number' : m.unit,
      decimals: m.decimals,
      direction: m.direction,
      seasons: compiled.gaps[i] === null ? seasons.filter((s) => covers(m, s)) : [],
      reason: compiled.gaps[i]
    })),
    rows: rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      team: (r.team_code as string | null) ?? null,
      position: (r.position as string | null) ?? null,
      group: Object.fromEntries(
        groupBy.map((g) => [g, (r[`g_${g}`] as string | number | null) ?? null])
      ),
      games: num(r.games) ?? 0,
      values: Object.fromEntries(
        compiled.metrics.map((m, i): [string, MetricValue] => [
          m.id,
          {
            value: num(r[`t${i}`]),
            raw: num(r[`v${i}`]),
            sample: num(r[`s${i}`]),
            qualified: r[`q${i}`] === true,
            percentile: num(r[`p${i}`]),
            rank: num(r[`r${i}`])
          }
        ])
      )
    })),
    total: num(rows[0]?.total) ?? 0,
    notes: compiled.notes,
    ms: Date.now() - started
  }
}
