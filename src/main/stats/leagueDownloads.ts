import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '@main/db/connection'
import { getLeagueSetting, setLeagueSetting } from '@main/db/repos/settings'
import { LEAGUES, type League, type LeagueId } from '@shared/leagues'
import type { LeagueDownloads } from '@shared/stats/types'
import { databaseBytes, freeBytes, roomNeeded } from './disk'
import { statsFilePath } from './files'

/** The key in `league_settings`: `on` downloads and refreshes the league, `off` does not. */
export const DOWNLOAD_KEY = 'download'

/** The league's file in the data folder, or the one it had before files were per league. */
function fileOf(dataDir: string, league: League): string | null {
  const path = statsFilePath(dataDir, league)
  if (existsSync(path)) return path
  const former = league.formerStatsFile ? join(dataDir, league.formerStatsFile) : null
  return former !== null && existsSync(former) ? former : null
}

/**
 * Which leagues download (D35), the one helper the main process reads it through. Each league's choice
 * is a row in `league_settings`. A profile from before the choice existed has none: a league is on
 * when its file is there and off otherwise, written down once, so an existing profile keeps the NBA
 * and downloads nothing for the WNBA until the user turns it on. A clean profile, with no choice and
 * no file, is undecided: nothing downloads until the first run's question is answered.
 */
export function leagueDownloads(
  db: Db,
  dataDir: string,
  free: (path: string) => number | null = freeBytes
): LeagueDownloads {
  const leagues = Object.values(LEAGUES)
  const saved = new Map(leagues.map((l) => [l.id, getLeagueSetting(db, l.id, DOWNLOAD_KEY)]))
  let decided = [...saved.values()].some((v) => v !== null)
  if (!decided && leagues.some((l) => fileOf(dataDir, l) !== null)) {
    for (const l of leagues) {
      const on = fileOf(dataDir, l) !== null
      setLeagueSetting(db, l.id, DOWNLOAD_KEY, on ? 'on' : 'off')
      saved.set(l.id, on ? 'on' : 'off')
    }
    decided = true
  }
  return {
    decided,
    leagues: leagues.map((league) => {
      const file = fileOf(dataDir, league)
      const bytes = file === null ? 0 : databaseBytes(file)
      const on = saved.get(league.id) === 'on'
      return {
        league: league.id,
        on,
        hasFile: file !== null,
        fileBytes: bytes,
        hasData: on || file !== null,
        roomNeeded: roomNeeded(league, bytes)
      }
    }),
    freeBytes: free(join(dataDir, 'metis.db'))
  }
}

/** Saves the user's choice for the leagues named; the others keep theirs. */
export function setLeagueDownloads(db: Db, choice: Partial<Record<LeagueId, boolean>>): void {
  for (const [league, on] of Object.entries(choice) as [LeagueId, boolean][]) {
    setLeagueSetting(db, league, DOWNLOAD_KEY, on ? 'on' : 'off')
  }
}
