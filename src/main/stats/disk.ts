import { statfsSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

const GB = 1024 ** 3
/**
 * The room a first load needs, working files included: D22's limit on the file, which measured 4.3 GB.
 * Once the file is this large the load is done, and a refresh only needs megabytes.
 */
export const FIRST_LOAD_BYTES = 6 * GB
export const LOADED_BYTES = 4 * GB

/** The room still needed before loading: nothing once the first load is done. */
export function roomNeeded(databaseBytes: number): number {
  return databaseBytes >= LOADED_BYTES ? 0 : FIRST_LOAD_BYTES - databaseBytes
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
