import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { errorMessage, relativeTime } from '@/lib/format'
import { CREDIT_LEAD, CREDIT_NOTES, CREDIT_TITLE, CREDIT_WHOSE } from '@/lib/stats/credit'
import {
  byTier,
  fmtBytes,
  fmtCount,
  leagueState,
  seasonRange,
  STATE_LABELS,
  totals
} from '@/lib/stats/data'
import { cn } from '@/lib/utils'
import { LEAGUES, leagueOf, type League, type LeagueId } from '@shared/leagues'
import type {
  LeagueDownload,
  LeagueDownloads,
  StatsDataReport,
  StatsFamily,
  StatsStatus
} from '@shared/stats/types'

function FamilyRow({ family, league }: { family: StatsFamily; league: League }): React.JSX.Element {
  return (
    <tr className="border-t border-line align-top">
      <td className="py-1.5 pr-4 text-fg">{family.label}</td>
      <td className="py-1.5 pr-4 text-fg-2">
        {family.filesLoaded > 0 ? seasonRange(
              family.firstSeason,
              family.lastSeason,
              // A paired league's files are labelled by that league's seasons (D48).
              family.seasonsOf ? leagueOf(family.seasonsOf) : league
            ) : '–'}
      </td>
      <td className="py-1.5 pr-4 text-right text-fg-2 tabular-nums">
        {fmtCount(family.filesLoaded)} of {fmtCount(family.filesExpected)}
      </td>
      <td className="py-1.5 pr-4 text-right text-fg-2 tabular-nums">{fmtBytes(family.bytes)}</td>
      <td className="py-1.5 pr-4 text-fg-2">
        {family.fetchedAt ? relativeTime(family.fetchedAt) : '–'}
      </td>
      <td className={cn('py-1.5', family.state === 'failed' ? 'text-bad' : 'text-fg-2')}>
        {STATE_LABELS[family.state]}
        {family.lastError && (
          <div className="mt-0.5 max-w-[320px] text-[11.5px] break-words">{family.lastError}</div>
        )}
      </td>
    </tr>
  )
}

interface LeagueRead {
  report: StatsDataReport | null
  status: StatsStatus | null
  error: string | null
}

interface LeagueSectionProps {
  league: League
  download: LeagueDownload
  read: LeagueRead
  onTurn: (on: boolean) => void
  onDelete: () => void
}

/** One league: whether it downloads, what it is doing, its disk, and its releases by tier. */
function LeagueSection({
  league,
  download,
  read,
  onTurn,
  onDelete
}: LeagueSectionProps): React.JSX.Element {
  const { report, status, error } = read
  const { filesLoaded, filesExpected } = totals(report?.families ?? [])
  const paused = status?.paused ?? false
  return (
    <section aria-label={league.name} className="mt-6 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-[14px] font-semibold">{league.name}</h2>
        <p className="text-[12.5px] text-fg-3">
          {leagueState(download, status)} · {fmtCount(filesLoaded)} of {fmtCount(filesExpected)}{' '}
          files · {download.hasFile ? fmtBytes(download.fileBytes) : 'nothing'} on disk
        </p>
        <div className="ml-auto flex gap-2">
          {download.on && (paused || status?.busy) && (
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                void (paused ? api.stats.resume(league.id) : api.stats.pause(league.id))
              }
            >
              {paused ? 'Resume' : 'Pause'}
            </Button>
          )}
          {!download.on && download.hasFile && (
            <Button variant="outline" size="xs" onClick={onDelete}>
              Delete its data
            </Button>
          )}
          <Button variant="outline" size="xs" onClick={() => onTurn(!download.on)}>
            {download.on ? `Turn the ${league.name} off` : `Turn the ${league.name} on`}
          </Button>
        </div>
      </div>
      {!download.on && (
        <p className="mt-2 text-[12.5px] text-fg-2">
          {download.hasFile
            ? 'Not refreshed. Its stats stay on this computer until you delete them.'
            : `Not downloaded. Turning it on downloads about ${fmtBytes(league.size.downloadBytes)} and takes about ${fmtBytes(league.size.fileBytes)} on disk.`}
        </p>
      )}
      {status?.noRoom && (
        <p className="mt-2 text-[13px] text-bad">
          Not enough disk space to load the {league.name}: it needs{' '}
          {fmtBytes(status.noRoom.neededBytes)}, and {fmtBytes(status.noRoom.freeBytes)} is free.
        </p>
      )}
      {download.on && paused && (
        <p className="mt-2 text-[13px] text-fg-2">Paused. Nothing downloads until you resume.</p>
      )}
      {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
      {byTier(report?.families ?? []).map((group) => (
        <div key={group.tier} className="mt-4">
          <h3 className="text-[12.5px] font-medium text-fg-2">{group.label}</h3>
          <table className="mt-1.5 w-full table-fixed text-[12.5px]">
            <thead className="text-left text-[11px] font-normal text-fg-3">
              <tr>
                <th className="w-[36%] py-1 pr-4 font-normal">Family</th>
                <th className="w-[20%] py-1 pr-4 font-normal">Seasons</th>
                <th className="w-[10%] py-1 pr-4 text-right font-normal">Files</th>
                <th className="w-[9%] py-1 pr-4 text-right font-normal">Size</th>
                <th className="w-[10%] py-1 pr-4 font-normal">Fetched</th>
                <th className="w-[15%] py-1 font-normal">State</th>
              </tr>
            </thead>
            <tbody>
              {group.families.map((family) => (
                <FamilyRow key={family.release} family={family} league={league} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}

const EMPTY: LeagueRead = { report: null, status: null, error: null }

/**
 * Every league's data, whichever is on screen (D35): whether it downloads, what is loaded and how big
 * it is, a way to pause a load or turn a league off, deleting a league's file as its own confirmed
 * action, and where the data comes from: the credit the dataset's licence asks for.
 */
export function StatsData(): React.JSX.Element {
  const [downloads, setDownloads] = useState<LeagueDownloads | null>(null)
  const [reads, setReads] = useState<Partial<Record<LeagueId, LeagueRead>>>({})
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<LeagueId | null>(null)

  const readLeague = useCallback((league: LeagueId) => {
    void Promise.all([api.stats.data(league), api.stats.status(league)]).then(
      ([report, status]) => setReads((r) => ({ ...r, [league]: { report, status, error: null } })),
      (err) => setReads((r) => ({ ...r, [league]: { ...EMPTY, error: errorMessage(err) } }))
    )
  }, [])
  const readDownloads = useCallback(() => {
    void api.leagues
      .downloads()
      .then(setDownloads)
      .catch((err) => setError(errorMessage(err)))
  }, [])

  useEffect(() => {
    readDownloads()
    for (const league of Object.values(LEAGUES)) readLeague(league.id)
    return api.stats.onChanged((changed) => {
      readDownloads()
      readLeague(changed)
    })
  }, [readDownloads, readLeague])

  const settle = (league: LeagueId, change: Promise<LeagueDownloads>): void => {
    void change
      .then((d) => {
        setDownloads(d)
        readLeague(league)
      })
      .catch((err) => setError(errorMessage(err)))
  }

  if (error) return <div className="py-20 text-center text-[13px] text-bad">{error}</div>
  if (!downloads) return <div className="py-20" />

  const used = downloads.leagues.reduce((sum, d) => sum + d.fileBytes, 0)
  const doomed = deleting ? downloads.leagues.find((d) => d.league === deleting) : undefined
  return (
    <div className="mx-auto w-full max-w-[1000px] px-6 py-6">
      <div className="flex items-center gap-4">
        <h1 className="text-[15px] font-semibold">Data</h1>
        <p className="text-[12.5px] text-fg-3">
          {fmtBytes(used)} on disk
          {downloads.freeBytes !== null && ` · ${fmtBytes(downloads.freeBytes)} free`}
        </p>
      </div>
      {downloads.leagues.map((download) => (
        <LeagueSection
          key={download.league}
          league={leagueOf(download.league)}
          download={download}
          read={reads[download.league] ?? EMPTY}
          onTurn={(on) =>
            settle(download.league, api.leagues.setDownloads({ [download.league]: on }))
          }
          onDelete={() => setDeleting(download.league)}
        />
      ))}
      <Dialog open={doomed !== undefined} onOpenChange={(open) => !open && setDeleting(null)}>
        {doomed && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete the {leagueOf(doomed.league).name}’s data?</DialogTitle>
              <DialogDescription>
                This removes {leagueOf(doomed.league).statsFile} ({fmtBytes(doomed.fileBytes)}) from
                this computer. Turning the {leagueOf(doomed.league).name} on again downloads it all
                again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Keep it
              </Button>
              <Button
                onClick={() => {
                  setDeleting(null)
                  settle(doomed.league, api.leagues.deleteFile(doomed.league))
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      <section aria-label={CREDIT_TITLE} className="mt-8 max-w-[760px] text-[12px] text-fg-3">
        <h2 className="text-[12.5px] font-medium text-fg-2">{CREDIT_TITLE}</h2>
        <p className="mt-1.5">
          {CREDIT_LEAD.map((s, i) =>
            typeof s === 'string' ? (
              s
            ) : (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="underline">
                {s.text}
              </a>
            )
          )}
        </p>
        <dl className="mt-2 space-y-1">
          {CREDIT_WHOSE.map((w) => (
            <div key={w.label}>
              <dt className="inline text-fg-2">{w.label}: </dt>
              <dd className="inline">{w.text}</dd>
            </div>
          ))}
        </dl>
        {CREDIT_NOTES.map((note) => (
          <p key={note} className="mt-2">
            {note}
          </p>
        ))}
      </section>
    </div>
  )
}
