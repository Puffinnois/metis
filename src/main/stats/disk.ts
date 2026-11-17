import { statfsSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import type { League } from '@shared/leagues'

/**
 * The room a league's first load still needs, working files included (`League.size.roomBytes`, 6 GB
 * for the NBA: D22's limit on the file). Once its file is past `loadedBytes` the load is done, and a
 * refresh only needs megabytes.
 */
export function roomNeeded(league: League, databaseBytes: number): number {
  const { roomBytes, loadedBytes } = league.size
  return databaseBytes >= loadedBytes ? 0 : Math.max(0, roomBytes - databaseBytes)
}

/** The file with its write-ahead log, which holds what a checkpoint has not moved yet. */
export function databaseBytes(path: string): number {
  let bytes = 0
  for (const file of [path, `${path}.wal`]) {
    try {
      bytes += statSync(file).size
    } catch {
      // not written yet
    }
  }
  return bytes
}

/** Free space beside the database; null if the system will not say, and then nothing is refused. */
export function freeBytes(path: string): number | null {
  try {
    const stats = statfsSync(dirname(path))
    return Number(stats.bavail) * Number(stats.bsize)
  } catch {
    return null
  }
}
