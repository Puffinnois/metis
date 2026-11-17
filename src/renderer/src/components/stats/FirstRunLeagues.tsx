import { useEffect, useState } from 'react'
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
import { errorMessage } from '@/lib/format'
import { defaultChoice, firstRunRows, fmtBytes, roomProblem } from '@/lib/stats/data'
import type { LeagueId } from '@shared/leagues'
import type { LeagueDownloads } from '@shared/stats/types'

/**
 * The first run's question (D35): which leagues to download, before anything is fetched. Shown only on
 * a clean profile, where the main process has no choice saved and no stats file; an existing profile
 * has its answer already (the NBA on, the WNBA off). Each league states its measured size and whether
 * the free space covers it; the answer can be changed later in the Data panel.
 */
export function FirstRunLeagues(): React.JSX.Element | null {
  const [downloads, setDownloads] = useState<LeagueDownloads | null>(null)
  const [choice, setChoice] = useState<Record<LeagueId, boolean>>(defaultChoice)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api.leagues
      .downloads()
      .then(setDownloads)
      .catch((err) => setError(errorMessage(err)))
  }, [])

  if (!downloads || downloads.decided) return null
  const rows = firstRunRows(downloads)
  const problem = roomProblem(choice, downloads)
  const none = !Object.values(choice).some(Boolean)
  const start = (): void => {
    setSaving(true)
    void api.leagues
      .setDownloads(choice)
      .then(setDownloads)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setSaving(false))
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Which leagues should Metis download?</DialogTitle>
          <DialogDescription>
            Each league’s stats are downloaded once to this computer and kept up to date. Nothing
            downloads until you choose. You can change this later in the Data panel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((row) => (
            <label key={row.league.id} className="flex items-start gap-3 text-[13px]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={choice[row.league.id]}
                onChange={(e) => setChoice((c) => ({ ...c, [row.league.id]: e.target.checked }))}
              />
              <span>
                <span className="font-medium">{row.league.name}</span>
                <span className="text-fg-3"> · {row.league.fullName}</span>
                <span className="block text-[12px] text-fg-3">
                  About {fmtBytes(row.downloadBytes)} to download, {fmtBytes(row.fileBytes)} on
                  disk.{' '}
                  {row.fits
                    ? `Needs ${fmtBytes(row.roomNeeded)} free while it loads.`
                    : `Needs ${fmtBytes(row.roomNeeded)} free while it loads, more than is free.`}
                </span>
              </span>
            </label>
          ))}
        </div>
        {downloads.freeBytes !== null && (
          <p className="text-[12px] text-fg-3">{fmtBytes(downloads.freeBytes)} free.</p>
        )}
        {problem && <p className="text-[12.5px] text-bad">{problem}</p>}
        {error && <p className="text-[12.5px] text-bad">{error}</p>}
        <DialogFooter>
          <Button onClick={start} disabled={saving || none || problem !== null}>
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
