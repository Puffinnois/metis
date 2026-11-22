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
  // Turned on with nothing loaded yet, or loaded with its tables still to build: its pages have
  // nothing to show, so nothing may open one (T1304.5). Unread, the league's status is taken as built.
  if (!builds(league, 'derived') || download.built === false) return 'notBuilt'
  return 'ready'
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
 * Each league with something to read also says whether its tables are built, from its own status:
 * all of them at first, then the league a change names, so a load's every file costs one status read.
 */
export function useLeagueDownloads(): LeagueDownloads | null {
  const [downloads, setDownloads] = useState<LeagueDownloads | null>(null)
  useEffect(() => {
    let alive = true
    const built = new Map<LeagueId, boolean>()
    const builtOf = async (league: LeagueId): Promise<void> => {
      const status = await Promise.resolve()
        .then(() => api.stats.status(league))
        .catch(() => null)
      // A status that cannot be read leaves the league as it was read last.
      if (status) built.set(league, status.builtAt !== null)
    }
    const read = (changed?: LeagueId): void => {
      void api.leagues
        .downloads()
        .then(async (d) => {
          const ask = d.leagues.filter(
            (l) =>
              l.hasData && (changed === undefined || l.league === changed || !built.has(l.league))
          )
          await Promise.all(ask.map((l) => builtOf(l.league)))
          if (!alive) return
          setDownloads({
            ...d,
            leagues: d.leagues.map((l) =>
              built.has(l.league) ? { ...l, built: built.get(l.league) } : l
            )
          })
        })
        .catch(() => {
          // The notes stay unsaid; each screen still reads its reason from the league's status.
        })
    }
    read()
    const off = api.stats.onChanged((changed) => read(changed))
    return () => {
      alive = false
      off()
    }
  }, [])
  return downloads
}
