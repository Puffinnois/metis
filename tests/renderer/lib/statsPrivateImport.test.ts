import { describe, expect, it } from 'vitest'
import { importLine } from '@/lib/stats/privateImport'

/** The Data panel's line for each file imported by hand (D55). */
describe('an imported file, as the Data panel words it', () => {
  const base = {
    file: 'darko-2026-11-24.csv',
    date: '2026-11-24',
    lastDate: '2026-11-24',
    dateFrom: 'name' as const,
    dates: 1,
    rows: 523,
    status: 'imported' as const,
    reason: null,
    importedAt: '2026-11-24T12:00:00Z'
  }

  it('says the date it was taken as and where it came from', () => {
    expect(importLine(base)).toEqual({
      file: 'darko-2026-11-24.csv',
      date: '2026-11-24',
      from: 'its name',
      rows: '523',
      state: 'Imported',
      reason: null
    })
    expect(importLine({ ...base, dateFrom: 'modified' }).from).toBe('its modified time')
  })

  it('gives a history its first and last dates', () => {
    const line = importLine({
      ...base,
      date: '2025-10-22',
      lastDate: '2026-04-12',
      dateFrom: 'column',
      dates: 1210,
      rows: 1210
    })
    expect(line.date).toBe('2025-10-22 to 2026-04-12 (1,210 dates)')
    expect(line.from).toBe('its date column')
  })

  it('shows a refused file with its reason and no rows', () => {
    const line = importLine({ ...base, status: 'refused', rows: 0, reason: 'Taken as 2026-11-24…' })
    expect(line).toMatchObject({ state: 'Refused', rows: '–', reason: 'Taken as 2026-11-24…' })
  })
})
