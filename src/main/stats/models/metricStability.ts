import { CATALOGUE, covers } from '@shared/stats/catalogue'
import type { Entity, MetricDef, MetricStability, StatsQuery } from '@shared/stats/types'
import type { StatsDb } from '../db'
import type { ModelBuilder, ModelContext, ModelRows, ModelTable } from './build'
import { stabilityFrom, unmeasured, type StabilityRow } from './stability'

/**
 * The engine, loaded when a measure runs. `build.ts` lists this builder and the engine reads
 * `build.ts`'s tables, so a static import would be a cycle that breaks whichever module loads first.
 */
async function engine(): Promise<{
  compileQuery: typeof import('../engine/compile').compileQuery
  MAX_METRICS: number
  grainsOf: typeof import('../engine/registry').grainsOf
  qualificationFactor: typeof import('../engine/run').qualificationFactor
  modelTable: typeof import('./build').modelTable
}> {
  const [compile, registry, run, build] = await Promise.all([
    import('../engine/compile'),
    import('../engine/registry'),
    import('../engine/run'),
    import('./build')
  ])
  return {
    compileQuery: compile.compileQuery,
    MAX_METRICS: compile.MAX_METRICS,
    grainsOf: registry.grainsOf,
    qualificationFactor: run.qualificationFactor,
    modelTable: build.modelTable
  }
}
type Engine = Awaited<ReturnType<typeof engine>>

/**
 * Plan T1006: how much each metric carries over, measured through the engine on the regular seasons
 * through the last one completed (`stability.ts` has the maths). One row per catalogue metric, keyed to
 * the latest season played; measured again only when a completed season's data, the catalogue's
 * formulas or this builder change, never on a daily refresh of the season in progress.
 */

export const STABILITY_TABLE = 'metric_stability'

/** Bump when the measure changes. */
const BUILDER_VERSION = 1

/** The leaderboard's player qualifier, which every player metric is measured under as well. */
const QUALIFIER = 'min'

export const STABILITY_TABLES: readonly ModelTable[] = [
  {
    table: STABILITY_TABLE,
    // Not read by a metric: the service serves it with the catalogue.
    entity: 'player',
    kind: 'meta',
    grain: 'season',
    columns: [
      // The latest season played when it was measured: the rows of the highest are the ones read.
      ['season', 'INTEGER'],
      ['game_type', 'VARCHAR'],
      ['metric_id', 'VARCHAR'],
      // The last completed season measured.
      ['through', 'INTEGER'],
      ['year_to_year', 'DOUBLE'],
      ['pairs', 'INTEGER'],
      ['split_half', 'DOUBLE'],
      ['half_pairs', 'INTEGER'],
      ['prior', 'DOUBLE'],
      ['reliability', 'VARCHAR'],
      ['first_season', 'INTEGER'],
      ['last_season', 'INTEGER'],
      ['reason', 'VARCHAR']
    ],
    components: []
  }
]

/** Why a metric is not measured at all. */
export const NOT_MEASURED = {
  gone: 'No longer in the source.',
  oneSeason: 'Published for one season at a time, so it has no seasons to pair.',
  noSeason: 'Cannot be read for whole seasons.',
  playerState: 'A rating as of a game: not measured for players.',
  coverage: 'Fewer than two completed seasons in its coverage.',
  failed: 'Could not be read for the measure.',
  noValue: 'No value at the end of a season to compare.'
}

/** A metric's qualified rows, or why it has none to measure. */
type Measured = { rows: StabilityRow[]; reason: string | null }

/** A rating read at the last game in scope: year to year, but no halves. */
const isState = (e: Engine, m: MetricDef): boolean => e.modelTable(m.model)?.kind === 'state'

/** Why a metric cannot be measured, or null when it can. */
function notMeasurable(e: Engine, m: MetricDef, through: number): string | null {
  if (m.unavailable) return NOT_MEASURED.gone
  if (m.oneSeason) return NOT_MEASURED.oneSeason
  if (!e.grainsOf(m).includes('season')) return NOT_MEASURED.noSeason
  if (m.entity === 'player' && isState(e, m)) return NOT_MEASURED.playerState
  if (m.firstSeason > through - 1) return NOT_MEASURED.coverage
  return null
}

/** A count is measured per game, so a season cut short by injury reads like a whole one. */
const transformOf = (m: MetricDef): StatsQuery['transform'] =>
  m.aggregation === 'sum' ? 'perGame' : 'raw'

/** Metrics measured in one query: the same entity, transform, table and first season. */
function batches(metrics: readonly MetricDef[], max: number): MetricDef[][] {
  const groups = new Map<string, MetricDef[]>()
  for (const m of metrics) {
    const table = m.model ?? m.built ?? m.published ?? 'box'
    const key = `${m.entity}|${transformOf(m)}|${table}|${m.firstSeason}`
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  const out: MetricDef[][] = []
  for (const group of groups.values()) {
    // Players keep a slot for the qualifier.
    const size = group[0].entity === 'player' ? max - 1 : max
    for (let i = 0; i < group.length; i += size) out.push(group.slice(i, i + size))
  }
  return out
}

/**
 * A batch's qualified rows per metric, whole seasons or their halves: through the engine, so each
 * metric reads exactly what a screen reads, qualified by its own sample (scaled to the row's games)
 * and, for a player, by the leaderboard's minutes as well.
 */
async function rowsOf(
  e: Engine,
  db: StatsDb,
  batch: readonly MetricDef[],
  seasons: number[],
  current: number,
  halves: boolean
): Promise<Measured[]> {
  const entity: Entity = batch[0].entity
  const ids = batch.map((m) => m.id)
  const withQualifier = entity === 'player' && !ids.includes(QUALIFIER)
  const query: StatsQuery = {
    entity,
    metrics: withQualifier ? [...ids, QUALIFIER] : ids,
    scope: { seasons, gameTypes: ['regular'] },
    groupBy: ['season'],
    transform: transformOf(batch[0]),
    ranks: false
  }
  const compiled = e.compileQuery(query, {
    currentSeason: current,
    internal: { unlimited: true, halves }
  })
  const factor = await e.qualificationFactor(db, compiled, query)
  const qi = query.metrics.indexOf(QUALIFIER)
  // Only what the measure reads, and only the players the leaderboard would rank: carrying every
  // column of every row back took 2 s a batch, the query itself 50 ms.
  const columns = [
    'id',
    'g_season',
    ...(halves ? ['g_half'] : []),
    ...batch.flatMap((_, i) => [`v${i}`, `s${i}`, `q${i}`])
  ]
  const raw = await db.all<Record<string, unknown>>(
    `SELECT ${columns.join(', ')} FROM (${compiled.sql.replaceAll('$factor', factor)})
     ${entity === 'player' ? `WHERE q${qi}` : ''}`,
    compiled.params
  )
  return batch.map((m, i): Measured => {
    // The engine's own reason, such as a published table without games played: no row qualifies.
    if (compiled.gaps[i] !== null) return { rows: [], reason: compiled.gaps[i] }
    let values = 0
    const rows = raw.flatMap((r) => {
      const v = r[`v${i}`]
      const season = Number(r.g_season)
      if (typeof v !== 'number' || !Number.isFinite(v)) return []
      values++
      return r[`q${i}`] === true && covers(m, season)
        ? [
            {
              id: String(r.id),
              season,
              half: halves ? Number(r.g_half) : null,
              value: v,
              sample: Number(r[`s${i}`] ?? 0)
            }
          ]
        : []
    })
    return { rows, reason: values === 0 && !halves ? NOT_MEASURED.noValue : null }
  })
}

/** One metric's stability from its whole seasons and halves, or the reason it has none. */
function measuredOf(m: MetricDef, full: Measured, halves: Measured | null): MetricStability {
  if (full.reason) return unmeasured(full.reason)
  return stabilityFrom(
    full.rows,
    halves && !halves.reason ? halves.rows : null,
    m.aggregation === 'ratio'
  )
}

/** Measures every catalogue metric on the regular seasons up to `through`. */
export async function measureStability(
  db: StatsDb,
  through: number,
  current: number,
  /** Each batch as it is measured, for a script timing the measure. */
  onBatch?: (ids: string[], ms: number) => void
): Promise<Map<string, MetricStability>> {
  const e = await engine()
  const out = new Map<string, MetricStability>()
  const measurable: MetricDef[] = []
  for (const m of CATALOGUE) {
    const why = notMeasurable(e, m, through)
    if (why) out.set(m.id, unmeasured(why))
    else measurable.push(m)
  }
  for (const batch of batches(measurable, e.MAX_METRICS)) {
    const first = Math.min(...batch.map((m) => m.firstSeason))
    const seasons: number[] = []
    for (let s = first; s <= through; s++) seasons.push(s)
    const halved = batch.filter((m) => e.grainsOf(m).includes('game') && !isState(e, m))
    const started = Date.now()
    try {
      const full = await rowsOf(e, db, batch, seasons, current, false)
      const halves = halved.length > 0 ? await rowsOf(e, db, halved, seasons, current, true) : []
      batch.forEach((m, i) => {
        const h = halved.indexOf(m)
        out.set(m.id, measuredOf(m, full[i], h >= 0 ? halves[h] : null))
      })
    } catch {
      // One metric the engine refuses should not cost the batch: measure each alone.
      for (const m of batch) {
        try {
          const full = await rowsOf(e, db, [m], seasons, current, false)
          const halves = halved.includes(m)
            ? (await rowsOf(e, db, [m], seasons, current, true))[0]
            : null
          out.set(m.id, measuredOf(m, full[0], halves))
        } catch {
          out.set(m.id, unmeasured(NOT_MEASURED.failed))
        }
      }
    }
    onBatch?.(
      batch.map((m) => m.id),
      Date.now() - started
    )
  }
  return out
}

/**
 * The catalogue's formulas, in one number: a change to what any metric reads or how it qualifies
 * measures again (it is part of the builder's version), a change of words does not.
 */
export function catalogueSignature(catalogue: readonly MetricDef[] = CATALOGUE): number {
  const text = JSON.stringify(
    catalogue.map((m) => [
      m.id,
      m.entity,
      m.value,
      m.sample,
      m.minSample ?? null,
      m.aggregation,
      m.firstSeason,
      m.missingSeasons ?? null,
      m.published ?? m.built ?? m.model ?? null,
      m.unavailable ?? null,
      m.oneSeason ?? null,
      m.perGameBy ?? null,
      m.totalOnly ?? null,
      m.index ?? null,
      m.direction
    ])
  )
  // FNV-1a, folded to fit `derived_state`'s INTEGER beside the builder's own version.
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 1_000_000
}

async function playedSeasons(db: StatsDb): Promise<number[]> {
  const rows = await db.all<{ season: number }>(
    `SELECT DISTINCT season FROM game
     WHERE played AND game_type = 'regular' AND season IS NOT NULL ORDER BY season`
  )
  return rows.map((r) => r.season)
}

/**
 * Measures again when its rows do not stand: none for this key season, measured through another
 * season (a season was completed), or a completed season's data changed. Null keeps them.
 */
async function build(ctx: ModelContext): Promise<ModelRows | null> {
  const played = await playedSeasons(ctx.db)
  // The last completed season: the one before the season in progress.
  const through = Math.min(ctx.current - 1, played[played.length - 1] ?? 0)
  const stored = await ctx.db.get<{ through: number | null }>(
    `SELECT max(through) AS through FROM ${STABILITY_TABLE} WHERE season = ?`,
    [ctx.season]
  )
  const due = (stored?.through ?? null) !== through || ctx.changed.some((s) => s <= through)
  if (!due) return null
  const measured =
    played.filter((s) => s <= through).length >= 2
      ? await measureStability(ctx.db, through, ctx.current)
      : new Map(CATALOGUE.map((m) => [m.id, unmeasured(NOT_MEASURED.coverage)]))
  return {
    [STABILITY_TABLE]: [...measured].map(([id, s]) => ({
      season: ctx.season,
      game_type: 'regular',
      metric_id: id,
      through,
      year_to_year: s.yearToYear,
      pairs: s.pairs,
      split_half: s.splitHalf,
      half_pairs: s.halfPairs,
      prior: s.prior,
      reliability: s.reliability,
      first_season: s.firstSeason,
      last_season: s.lastSeason,
      reason: s.reason
    }))
  }
}

export const STABILITY_BUILDER: ModelBuilder = {
  name: 'metric_stability',
  version: BUILDER_VERSION * 1_000_000 + catalogueSignature(),
  tables: STABILITY_TABLES,
  // Keyed to the latest season played; `build` decides whether anything changed.
  seasons: (changed, played) => (changed.length > 0 && played.length > 0 ? [played.at(-1)!] : []),
  build
}

/** The measured priors, by metric id, for the compiler's `shrunk`. */
export function priorsOf(stability: ReadonlyMap<string, MetricStability>): Map<string, number> {
  const out = new Map<string, number>()
  for (const [id, s] of stability) if (s.prior !== null) out.set(id, s.prior)
  return out
}

/** The stability of every metric measured, from the latest rows; empty before the first measure. */
export async function readStability(db: StatsDb): Promise<Map<string, MetricStability>> {
  const exists = await db.get(
    `SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = '${STABILITY_TABLE}'`
  )
  if (!exists) return new Map()
  const rows = await db.all<{
    metric_id: string
    year_to_year: number | null
    pairs: number
    split_half: number | null
    half_pairs: number
    prior: number | null
    reliability: MetricStability['reliability']
    first_season: number | null
    last_season: number | null
    reason: string | null
  }>(
    `SELECT * FROM ${STABILITY_TABLE}
     WHERE season = (SELECT max(season) FROM ${STABILITY_TABLE})`
  )
  return new Map(
    rows.map((r) => [
      r.metric_id,
      {
        yearToYear: r.year_to_year,
        pairs: r.pairs,
        splitHalf: r.split_half,
        halfPairs: r.half_pairs,
        prior: r.prior,
        reliability: r.reliability,
        firstSeason: r.first_season,
        lastSeason: r.last_season,
        reason: r.reason
      }
    ])
  )
}
