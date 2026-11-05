import { relativeTime } from '@/lib/format'
import type { StatsStatus } from '@shared/stats/types'

const DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

/** "Data through Nov 4, 2026 · updated 2 h ago": the nav's status line. */
export function freshness(status: StatsStatus | null, now = Date.now()): string {
  if (!status) return ''
  if (!status.available) return 'Stats unavailable'
  if (!status.through) return status.busy ? 'Loading the stats…' : 'No stats yet'
  // A game date has no time of day: read at UTC, so no time zone moves it to the day before.
  const through = `Data through ${DAY.format(new Date(`${status.through.date}T00:00:00Z`))}`
  return status.busy
    ? `${through} · updating…`
    : `${through} · updated ${relativeTime(status.updatedAt, now)}`
}
