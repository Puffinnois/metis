import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

/**
 * Sources read only on the copy whose owner names them (D55), off for everyone else: a file of
 * private settings in the data folder, `private-sources.json`, that no screen writes and no release
 * ships. With no file, or no entry, nothing is read.
 *
 *     { "darko": "imports/darko" }
 *
 * names the folder DARKO files are dropped in, relative to the data folder or absolute. No address is
 * ever named here: a private source is read from the owner's own files, never fetched.
 */
export const PRIVATE_SOURCES_FILE = 'private-sources.json'

export interface PrivateSources {
  /** The DARKO folder as the owner wrote it, and where it is. Null when the setting is off. */
  darko: { written: string; folder: string } | null
}

export const NO_PRIVATE_SOURCES: PrivateSources = { darko: null }

export function readPrivateSources(dataDir: string): PrivateSources {
  const path = join(dataDir, PRIVATE_SOURCES_FILE)
  if (!existsSync(path)) return NO_PRIVATE_SOURCES
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    const written =
      parsed && typeof parsed === 'object' && 'darko' in parsed
        ? (parsed as { darko: unknown }).darko
        : null
    if (typeof written !== 'string' || written.trim() === '') return NO_PRIVATE_SOURCES
    return { darko: { written, folder: isAbsolute(written) ? written : join(dataDir, written) } }
  } catch {
    // A file that does not parse names nothing: the source stays off, as with no file.
    return NO_PRIVATE_SOURCES
  }
}

/**
 * The folder a league's refresh reads DARKO files from: the NBA's, where the setting names one; null
 * for every other league and wherever the setting is off.
 */
export function darkoFolderFor(league: string, dataDir: string): string | null {
  return league === 'nba' ? (readPrivateSources(dataDir).darko?.folder ?? null) : null
}
