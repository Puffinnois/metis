import { relativeTime } from '@/lib/format'
import type { StatsStatus } from '@shared/stats/types'

const DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

const COUNT = new Intl.NumberFormat('en-US')

/** "412 of 3,107 files", once a refresh knows how many it has to do. */
function filesDone(status: StatsStatus): string | null {
  if (!status.progress) return null
  return `${COUNT.format(status.progress.done)} of ${COUNT.format(status.progress.total)} files`
}

/** "Data through Nov 4, 2026 · updated 2 h ago": the nav's status line. */
export function freshness(status: StatsStatus | null, now = Date.now()): string {
  if (!status) return ''
  if (!status.available) return 'Stats unavailable'
  const files = filesDone(status)
  if (!status.through) {
    if (!status.busy) return 'No stats yet'
    return files ? `Loading the stats · ${files}` : 'Loading the stats…'
  }
  // A game date has no time of day: read at UTC, so no time zone moves it to the day before.
  const through = `Data through ${DAY.format(new Date(`${status.through.date}T00:00:00Z`))}`
  if (!status.busy) return `${through} · updated ${relativeTime(status.updatedAt, now)}`
  return files ? `${through} · updating ${files}` : `${through} · updating…`
}
