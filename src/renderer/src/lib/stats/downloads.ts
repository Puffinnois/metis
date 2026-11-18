import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { builds, type League, type LeagueId } from '@shared/leagues'
import type { LeagueDownload, LeagueDownloads } from '@shared/stats/types'

/**
 * What a league holds now, from the user's download setting and its file (`LeagueDownload`, Plan
 * T1301.4) and the registry's `builds`: off with nothing to read, its files loaded with no tables
 * built from them yet, or ready. Whether a league has data is not a fact of the registry any more.
 */
export type LeagueHolds = 'off' | 'notBuilt' | 'ready'

export function leagueHolds(league: League, download: LeagueDownload | undefined): LeagueHolds {
  if (!download?.hasData) return 'off'
  return builds(league, 'derived') ? 'ready' : 'notBuilt'
}

/** The league menu's note beside a league, or null when it reads as any league does. */
export function menuNote(holds: LeagueHolds): string | null {
  if (holds === 'off') return 'No stats yet'
  if (holds === 'notBuilt') return 'No tables yet'
  return null
}

/** One league's download state; undefined until it is read. */
export const downloadOf = (
  downloads: LeagueDownloads | null,
  league: LeagueId
): LeagueDownload | undefined => downloads?.leagues.find((d) => d.league === league)

/**
 * Every league's download state, read when mounted and again whenever a league's data changes (turning
 * one on or off, a load, a deletion all say so). The one way a screen learns whether a league is on.
 */
export function useLeagueDownloads(): LeagueDownloads | null {
  const [downloads, setDownloads] = useState<LeagueDownloads | null>(null)
  useEffect(() => {
    let alive = true
    const read = (): void => {
      void api.leagues
        .downloads()
        .then((d) => alive && setDownloads(d))
        .catch(() => {
          // The notes stay unsaid; each screen still reads its reason from the league's status.
        })
    }
    read()
    const off = api.stats.onChanged(read)
    return () => {
      alive = false
      off()
    }
  }, [])
  return downloads
}
