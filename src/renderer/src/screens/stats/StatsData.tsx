import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { errorMessage, relativeTime } from '@/lib/format'
import { byTier, fmtBytes, fmtCount, seasonRange, STATE_LABELS, totals } from '@/lib/stats/data'
import { cn } from '@/lib/utils'
import type { StatsDataReport, StatsFamily, StatsStatus } from '@shared/stats/types'

const DATASET_URL = 'https://github.com/sportsdataverse/sportsdataverse-data'

function FamilyRow({ family }: { family: StatsFamily }): React.JSX.Element {
  return (
    <tr className="border-t border-line align-top">
      <td className="py-1.5 pr-4 text-fg">{family.label}</td>
      <td className="py-1.5 pr-4 text-fg-2">
        {family.filesLoaded > 0 ? seasonRange(family.firstSeason, family.lastSeason) : '–'}
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

interface StatsDataProps {
  status: StatsStatus | null
}

/** What is loaded, how big it is, and a way to pause a load that is too much right now. */
export function StatsData({ status }: StatsDataProps): React.JSX.Element {
  const [report, setReport] = useState<StatsDataReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const read = useCallback(() => {
    void api.stats
      .data()
      .then(setReport)
      .catch((err) => setError(errorMessage(err)))
  }, [])

  useEffect(() => {
    read()
    return api.stats.onChanged(read)
  }, [read])

  if (error) return <div className="py-20 text-center text-[13px] text-bad">{error}</div>
  if (!report) return <div className="py-20" />

  const { filesLoaded, filesExpected } = totals(report.families)
  const paused = status?.paused ?? false
  return (
    <div className="mx-auto w-full max-w-[1000px] px-6 py-6">
      <div className="flex items-center gap-4">
        <h1 className="text-[15px] font-semibold">Data</h1>
        <p className="text-[12.5px] text-fg-3">
          {fmtCount(filesLoaded)} of {fmtCount(filesExpected)} files ·{' '}
          {fmtBytes(report.databaseBytes)} on disk
          {report.freeBytes !== null && ` · ${fmtBytes(report.freeBytes)} free`}
        </p>
        {(paused || status?.busy) && (
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={() => void (paused ? api.stats.resume() : api.stats.pause())}
          >
            {paused ? 'Resume' : 'Pause'}
          </Button>
        )}
      </div>
      {status?.noRoom && (
        <p className="mt-3 text-[13px] text-bad">
          Not enough disk space to load the data: it needs {fmtBytes(status.noRoom.neededBytes)},
          and {fmtBytes(status.noRoom.freeBytes)} is free.
        </p>
      )}
      {paused && (
        <p className="mt-3 text-[13px] text-fg-2">Paused. Nothing downloads until you resume.</p>
      )}
      {byTier(report.families).map((group) => (
        <section key={group.tier} className="mt-6">
          <h2 className="text-[12.5px] font-medium text-fg-2">{group.label}</h2>
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
                <FamilyRow key={family.release} family={family} />
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="mt-8 text-[12px] text-fg-3">
        NBA data comes from{' '}
        <a href={DATASET_URL} target="_blank" rel="noreferrer" className="underline">
          SportsDataverse
        </a>
        , which republishes ESPN and stats.nba.com. Metis keeps it on this computer and shares
        nothing.
      </p>
    </div>
  )
}
