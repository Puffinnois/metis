import type { MetricDef } from '@shared/stats/types'
import { DEFAULT_LEAGUE, leagueOf, type League } from '@shared/leagues'
import { DERIVED_NEEDS } from './derived/build'
import { gameTable } from './derived/gameTables'
import { playsRecipe } from './derived/playsRecipe'
import { publishedRecipe, publishedTable } from './derived/published'
import { IDENTITY_NEEDS } from './identity'
import { LEFT_OUT_RELEASES, SOURCES, SOURCES_BY_LEAGUE, type SourceFile } from './sources'

/**
 * A source family left out of a build (`LEFT_OUT_RELEASES` in `sources.ts`): which tags may be
 * listed, which sources and tables that leaves, and the reason a metric that read it gives.
 * `docs/reference/stats-database.md`, "Leaving a source out".
 */

/** What a metric reads when its source is not in this build. */
export const LEFT_OUT_REASON = 'Not included in this version.'

/**
 * The releases that can never be left out: the game, team and player tables are built from them, and
 * every other table is keyed to those (D13, D28). Read from what the builds need, not typed again,
 * plus the files a league marks `keys` while its builders do not exist yet (the WNBA's six: both
 * schedules, the game logs, ESPN's player box scores, the crosswalk and the groups).
 */
export function requiredReleases(sources: readonly SourceFile[] = SOURCES): string[] {
  const tables = new Set<string>([...IDENTITY_NEEDS, ...DERIVED_NEEDS])
  return [
    ...new Set(sources.filter((s) => s.keys || tables.has(s.table)).map((s) => s.release))
  ].sort()
}

/**
 * The part of the list one league's refresh acts on. `LEFT_OUT_RELEASES` is one list for every league,
 * since every tag names its league (`nba_stats_shots`, `wnba_stats_shots`): a tag of another league is
 * that league's, and a tag no league loads stays, so `leftOutProblem` names it.
 */
export function leftOutIn(list: readonly string[], sources: readonly SourceFile[]): string[] {
  const all = Object.values(SOURCES_BY_LEAGUE).flat()
  return list.filter(
    (tag) => sources.some((s) => s.release === tag) || !all.some((s) => s.release === tag)
  )
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
 * metric under a split the play by play the splits are counted from, each under the league's own
 * names (its published and plays recipes). A box-score metric reads the box scores, which are always in.
 */
export function leftOutGap(
  m: MetricDef,
  split: boolean,
  list: readonly string[] = LEFT_OUT_RELEASES,
  league: League = leagueOf(DEFAULT_LEAGUE)
): string | null {
  if (list.length === 0) return null
  const plays = playsRecipe(league)
  const ownPublished = publishedRecipe(league).sources
  const published = m.published ? publishedTable(m.published)?.source : undefined
  const tables = [
    ...(published ? [ownPublished[published] ?? published] : []),
    ...(m.built ? (gameTable(m.built)?.sources ?? []).map((f) => plays[f]) : []),
    ...(split ? [plays.pbp] : [])
  ]
  const files = SOURCES_BY_LEAGUE[league.id]
  return tables.some((t) => typeof t === 'string' && isTableLeftOut(t, list, files))
    ? LEFT_OUT_REASON
    : null
}
