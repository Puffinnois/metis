import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import type { League } from '@shared/leagues'

/** The league's stats file in the data folder (D36): `stats-nba.duckdb`. */
export const statsFilePath = (dataDir: string, league: League): string =>
  join(dataDir, league.statsFile)

/** DuckDB's write-ahead log beside a database file. */
const walOf = (path: string): string => `${path}.wal`

export type Adoption =
  | { kind: 'none' }
  | { kind: 'renamed'; from: string; to: string; wal: boolean }
  /** Both files exist: the old one is left untouched and the league's own is opened. */
  | { kind: 'both'; old: string; current: string }

/**
 * Gives a league the file it had before files were per league: `stats.duckdb` becomes
 * `stats-nba.duckdb`, with its WAL, so an upgrade keeps every row and downloads nothing. It runs in the
 * worker before DuckDB opens anything, in the development profile and the installer's data folder
 * alike. A failed rename throws: opening a new, empty file instead would start a full download.
 */
export function adoptFormerStatsFile(
  dataDir: string,
  league: League,
  log: (message: string) => void = (m) => console.info(m)
): Adoption {
  if (!league.formerStatsFile) return { kind: 'none' }
  const from = join(dataDir, league.formerStatsFile)
  const to = statsFilePath(dataDir, league)
  if (!existsSync(from)) return { kind: 'none' }
  if (existsSync(to)) {
    log(
      `stats: both ${league.formerStatsFile} and ${league.statsFile} are in ${dataDir}; ` +
        `${league.statsFile} is opened and ${league.formerStatsFile} is left as it is`
    )
    return { kind: 'both', old: from, current: to }
  }
  // The log first: a database renamed without its log would open without its latest writes.
  const wal = existsSync(walOf(from))
  if (wal) {
    if (existsSync(walOf(to))) {
      throw new Error(`${walOf(to)} exists without ${to}; move it away and start Metis again`)
    }
    renameSync(walOf(from), walOf(to))
  }
  try {
    renameSync(from, to)
  } catch (err) {
    if (wal) renameSync(walOf(to), walOf(from))
    throw err
  }
  log(
    `stats: renamed ${league.formerStatsFile} to ${league.statsFile}${wal ? ', with its WAL' : ''}`
  )
  return { kind: 'renamed', from, to, wal }
}
