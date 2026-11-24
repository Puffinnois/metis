import type { StatsImportedFile } from '@shared/stats/types'

/**
 * How the Data panel words one file of a source imported by hand (D55): exactly what was taken from
 * it, so a file whose name carries the wrong date shows at a glance.
 */
export interface ImportLine {
  file: string
  /** "2026-11-24", or "2025-10-21 to 2026-04-12 (24 dates)" for a history. */
  date: string
  /** Where the date came from: "its date column", "its name", "its modified time". */
  from: string
  rows: string
  state: 'Imported' | 'Counted once' | 'Refused'
  /** Why it was refused or counted once; null for an imported file. */
  reason: string | null
}

const FROM: Record<NonNullable<StatsImportedFile['dateFrom']>, string> = {
  column: 'its date column',
  name: 'its name',
  modified: 'its modified time'
}

const STATE: Record<StatsImportedFile['status'], ImportLine['state']> = {
  imported: 'Imported',
  same: 'Counted once',
  refused: 'Refused'
}

export function importLine(f: StatsImportedFile): ImportLine {
  const date =
    f.date === null
      ? '–'
      : f.dates > 1 && f.lastDate !== null && f.lastDate !== f.date
        ? `${f.date} to ${f.lastDate} (${f.dates.toLocaleString('en-US')} dates)`
        : f.date
  return {
    file: f.file,
    date,
    from: f.dateFrom === null ? '–' : FROM[f.dateFrom],
    rows: f.status === 'imported' ? f.rows.toLocaleString('en-US') : '–',
    state: STATE[f.status],
    reason: f.reason
  }
}
