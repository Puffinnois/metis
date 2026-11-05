import type { StatsFamily } from '@shared/stats/types'
import { LOAD_TIERS, RELEASE_LABELS, seasonsOf, type SourceFile } from './sources'
import { stepLogName } from './sync'

export interface HeldFile {
  rows: number
  bytes: number | null
  fetchedAt: string
}

export interface FileAttempt {
  status: string
  message: string | null
}

/**
 * What each release holds, for the Data panel, from what the sync has recorded. A file that is not
 * published yet (the current season's playoffs) is not counted as missing.
 */
export function summariseFamilies(
  sources: SourceFile[],
  current: number,
  held: Map<string, HeldFile>,
  attempts: Map<string, FileAttempt>
): StatsFamily[] {
  const families = new Map<string, StatsFamily>()
  for (const source of sources) {
    const family = families.get(source.release) ?? {
      release: source.release,
      label: RELEASE_LABELS[source.release] ?? source.release,
      tier: source.tier,
      state: 'waiting',
      filesLoaded: 0,
      filesExpected: 0,
      firstSeason: null,
      lastSeason: null,
      bytes: 0,
      rows: 0,
      fetchedAt: null,
      lastError: null
    }
    families.set(source.release, family)
    for (const season of seasonsOf(source, current)) {
      const file = held.get(`${source.id}:${season}`)
      const attempt = attempts.get(stepLogName({ source, season }))
      if (attempt?.status === 'skipped' && !file) continue
      family.filesExpected++
      if (attempt?.status === 'error') family.lastError = attempt.message
      if (!file) continue
      family.filesLoaded++
      family.bytes += file.bytes ?? 0
      family.rows += file.rows
      if (season !== 0) {
        family.firstSeason = Math.min(family.firstSeason ?? season, season)
        family.lastSeason = Math.max(family.lastSeason ?? season, season)
      }
      if (family.fetchedAt === null || file.fetchedAt > family.fetchedAt) {
        family.fetchedAt = file.fetchedAt
      }
    }
  }
  for (const family of families.values()) {
    if (family.lastError !== null) family.state = 'failed'
    else if (family.filesExpected > 0 && family.filesLoaded === family.filesExpected) {
      family.state = 'loaded'
    } else if (family.filesLoaded > 0) family.state = 'partial'
  }
  return [...families.values()].sort(
    (a, b) => LOAD_TIERS.indexOf(a.tier) - LOAD_TIERS.indexOf(b.tier)
  )
}
