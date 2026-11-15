import type { MetricDef } from '@shared/stats/types'
import { DERIVED_NEEDS } from './derived/build'
import { gameTable } from './derived/gameTables'
import { publishedTable } from './derived/published'
import { SPLIT_SOURCES } from './derived/splits'
import { IDENTITY_NEEDS } from './identity'
import { LEFT_OUT_RELEASES, SOURCES, type SourceFile } from './sources'

/**
 * A source family left out of a build (`LEFT_OUT_RELEASES` in `sources.ts`): which tags may be
 * listed, which sources and tables that leaves, and the reason a metric that read it gives.
 * `docs/reference/stats-database.md`, "Leaving a source out".
 */

/** What a metric reads when its source is not in this build. */
export const LEFT_OUT_REASON = 'Not included in this version.'

/**
 * The releases that can never be left out: the game, team and player tables are built from them, and
 * every other table is keyed to those (D13, D28). Read from what the builds need, not typed again.
 */
export function requiredReleases(sources: readonly SourceFile[] = SOURCES): string[] {
  const tables = new Set<string>([...IDENTITY_NEEDS, ...DERIVED_NEEDS])
  return [...new Set(sources.filter((s) => tables.has(s.table)).map((s) => s.release))].sort()
}

/** Why a list of tags cannot be built, in plain words; null when it can. */
export function leftOutProblem(
  list: readonly string[] = LEFT_OUT_RELEASES,
  sources: readonly SourceFile[] = SOURCES
): string | null {
  if (list.length === 0) return null
  const known = new Set(sources.map((s) => s.release))
  const unknown = list.filter((tag) => !known.has(tag))
  if (unknown.length > 0) {
    return `LEFT_OUT_RELEASES names a release Metis does not load: ${unknown.join(', ')}.`
  }
  const required = new Set(requiredReleases(sources))
  const core = list.filter((tag) => required.has(tag))
  if (core.length > 0) {
    return `LEFT_OUT_RELEASES names a release the game, team and player tables are built from, which cannot be left out: ${core.join(', ')}.`
  }
  return null
}

/** The source files this build loads. */
export function includedSources(
  list: readonly string[] = LEFT_OUT_RELEASES,
  sources: readonly SourceFile[] = SOURCES
): SourceFile[] {
  return sources.filter((s) => !list.includes(s.release))
}

/** The source files this build leaves out. */
export function leftOutSources(
  list: readonly string[] = LEFT_OUT_RELEASES,
  sources: readonly SourceFile[] = SOURCES
): SourceFile[] {
  return sources.filter((s) => list.includes(s.release))
}

/** A source table every file of which is left out. */
export function isTableLeftOut(
  table: string,
  list: readonly string[] = LEFT_OUT_RELEASES,
  sources: readonly SourceFile[] = SOURCES
): boolean {
  const files = sources.filter((s) => s.table === table)
  return files.length > 0 && files.every((s) => list.includes(s.release))
}

/** The source tables to drop: every file of each is left out. */
export function leftOutTables(
  list: readonly string[] = LEFT_OUT_RELEASES,
  sources: readonly SourceFile[] = SOURCES
): string[] {
  const tables = new Set(leftOutSources(list, sources).map((s) => s.table))
  return [...tables].filter((t) => isTableLeftOut(t, list, sources)).sort()
}

/**
 * The reason a metric has no answer because its source is not in this build; null when it is. A
 * published metric reads its published table's source, a built one its game table's sources, and any
 * metric under a split the play by play the splits are counted from. A box-score metric reads the
 * box scores, which are always in.
 */
export function leftOutGap(
  m: MetricDef,
  split: boolean,
  list: readonly string[] = LEFT_OUT_RELEASES
): string | null {
  if (list.length === 0) return null
  const tables = [
    ...(m.published ? [publishedTable(m.published)?.source] : []),
    ...(m.built ? (gameTable(m.built)?.sources ?? []) : []),
    ...(split ? SPLIT_SOURCES : [])
  ]
  return tables.some((t) => t !== undefined && isTableLeftOut(t, list)) ? LEFT_OUT_REASON : null
}
