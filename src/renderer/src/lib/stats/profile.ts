import { COMBINE_MEASURES, COMBINE_SECTIONS, type CombineMeasure } from '@shared/stats/profile'
import { seasonLabel } from '@shared/stats/seasons'
import type {
  StatsBio,
  StatsCombine,
  StatsCombineValue,
  StatsDraft,
  StatsProfile
} from '@shared/stats/types'
import type { SectionView, StatLine } from './dashboard'
import { amongWords, ordinal } from './format'

/**
 * The player dashboard's Profile tab: the roster's bio, the draft, and the combine. None of it
 * depends on the season or range in scope. A test with no result reads as a blank with its reason,
 * never 0.
 */

export interface Fact {
  label: string
  value: string
}

const titleCase = (text: string): string =>
  text.toLowerCase().replace(/(^|\s)([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase())

/** The roster's bio, in the order a reader looks for it. What is unknown is left out. */
export function bioFacts(bio: StatsBio): Fact[] {
  const age =
    bio.age === null ? null : `${Math.floor(bio.age)} on the ${seasonLabel(bio.season)} roster`
  const experience =
    bio.experience === null
      ? null
      : bio.experience === 'R'
        ? 'Rookie'
        : `${bio.experience} ${bio.experience === '1' ? 'season' : 'seasons'}`
  const facts: [string, string | null][] = [
    ['Born', bio.birthDate ? titleCase(bio.birthDate) : null],
    ['Age', age],
    ['Height', bio.height],
    ['Weight', bio.weight ? `${bio.weight} lb` : null],
    ['Position', bio.position],
    ['Number', bio.number ? `#${bio.number}` : null],
    ['School', bio.school],
    ['Experience', experience],
    ['Acquired', bio.howAcquired]
  ]
  return facts
    .filter((f): f is [string, string] => f[1] !== null)
    .map(([label, value]) => ({ label, value }))
}

/** "Round 1, pick 13 (13th overall)". */
function pickWords(d: StatsDraft): string | null {
  const parts = [
    d.round !== null ? `Round ${d.round}` : null,
    d.roundPick !== null ? `pick ${d.roundPick}` : null
  ].filter(Boolean)
  if (parts.length === 0) return d.overallPick !== null ? `${ordinal(d.overallPick)} overall` : null
  const overall = d.overallPick !== null ? ` (${ordinal(d.overallPick)} overall)` : ''
  return `${parts.join(', ')}${overall}`
}

/** The draft's facts, or why there are none. */
export function draftView(profile: StatsProfile): { facts: Fact[]; note: string | null } {
  const d = profile.draft
  if (d) {
    const team = d.team ? (d.team.name ?? d.team.code) : null
    const from = d.organization
      ? d.organizationType
        ? `${d.organization} (${d.organizationType.toLowerCase()})`
        : d.organization
      : null
    const facts: [string, string | null][] = [
      ['Year', String(d.year)],
      ['Pick', pickWords(d)],
      ['By', team],
      ['From', from]
    ]
    return {
      facts: facts
        .filter((f): f is [string, string] => f[1] !== null)
        .map(([label, value]) => ({ label, value })),
      note: null
    }
  }
  const years = profile.draftYears
  // The files start with the 1996 draft, so a player drafted before it is not undrafted.
  return {
    facts: [],
    note: years
      ? `Not in the drafts of ${years.first} to ${years.last}.`
      : 'The draft is not loaded yet.'
  }
}

/** Inches as a length is spoken: 81.25 is 6′ 9.25″. */
export function fmtLength(inches: number | null): string {
  if (inches === null || !Number.isFinite(inches)) return '—'
  const quarters = Math.round(inches * 4)
  const feet = Math.floor(quarters / 48)
  const rest = (quarters - feet * 48) / 4
  return `${feet}′ ${rest}″`
}

const decimals = (x: number, n: number): string => x.toFixed(n).replace(/\.?0+$/, '')

/** A combine value as the tab shows it; a blank when there is none. */
export function fmtCombine(m: CombineMeasure, v: StatsCombineValue | undefined): string {
  const x = v?.value ?? null
  if (x === null || !Number.isFinite(x)) return '—'
  switch (m.unit) {
    case 'length':
      return fmtLength(x)
    case 'inches':
      return `${decimals(x, 2)} in`
    case 'lb':
      return `${decimals(x, 1)} lb`
    case 'body_fat':
      return `${decimals(x, 2)} %`
    case 'seconds':
      return `${x.toFixed(2)} s`
    case 'reps':
      return String(Math.round(x))
    case 'ratio':
      return x.toFixed(3)
    case 'shots':
      return `${v?.made ?? 0}-${v?.attempts ?? 0} ${Math.round(x * 100)}%`
  }
}

/** Which way a percentile reads, for a measure whose higher value is not the better one. */
const SIDE: Partial<Record<CombineMeasure['unit'], string>> = {
  seconds: 'faster is higher',
  length: 'longer is higher',
  inches: 'longer is higher',
  lb: 'heavier is higher',
  body_fat: 'more is higher',
  ratio: 'longer is higher'
}

/** One measure's line: the value, its percentile within the group, and why either is missing. */
export function combineLine(
  m: CombineMeasure,
  combine: StatsCombine,
  years: string
): StatLine & { neutral: boolean } {
  const v = combine.values[m.id]
  const value = fmtCombine(m, v)
  const among = amongWords(combine.group)
  let missing: string | null = null
  if (!v || v.value === null) {
    missing = v?.held
      ? `No result at the ${combine.year} combine.`
      : `Not held at the ${combine.year} combine.`
  } else if (combine.group === null) {
    missing = 'No position listed at the combine.'
  } else if (v.percentile === null) {
    missing = `The only result among ${among}.`
  }
  const side = m.better === null || m.better === 'lower' ? SIDE[m.unit] : null
  const title =
    v && v.percentile !== null
      ? [
          `${ordinal(v.percentile)} percentile among ${v.pool} ${among} measured at the combines of ${years}`,
          v.rank !== null ? `${ordinal(v.rank)} of ${v.pool}` : null,
          side ? `${side[0].toUpperCase()}${side.slice(1)}.` : null
        ]
          .filter(Boolean)
          .join(' · ')
      : ''
  return {
    metric: m.id,
    label: m.label,
    value,
    percentile: v?.value !== null && v?.percentile !== undefined ? v.percentile : null,
    rank: v?.rank !== null && v?.rank !== undefined ? ordinal(v.rank) : null,
    missing,
    title,
    info: undefined,
    neutral: m.better === null
  }
}

export interface CombineSectionView {
  section: SectionView | null
  /**
   * A part of the combine not held that year, or with no result for the player at all, said once
   * instead of a blank line per test.
   */
  absent: string | null
}

/**
 * The combine's sections in order. A section nobody did that year, or the player did none of, is one
 * sentence; a section they did part of keeps a blank line for each test they have no result in.
 */
export function combineSections(combine: StatsCombine, years: string): CombineSectionView[] {
  return COMBINE_SECTIONS.map((title) => {
    const measures = COMBINE_MEASURES.filter((m) => m.section === title)
    const held = measures.some((m) => combine.values[m.id]?.held)
    if (!held) {
      return { section: null, absent: `${title} was not held at the ${combine.year} combine.` }
    }
    if (!measures.some((m) => (combine.values[m.id]?.value ?? null) !== null)) {
      return {
        section: null,
        absent: `No ${title.toLowerCase()} results at the ${combine.year} combine.`
      }
    }
    return {
      section: { title, lines: measures.map((m) => combineLine(m, combine, years)) },
      absent: null
    }
  })
}

/** "2000 to 2026", the combines a percentile is ranked over. */
export const combineYears = (profile: StatsProfile): string =>
  profile.combineYears
    ? `${profile.combineYears.first} to ${profile.combineYears.last}`
    : 'every year'

/** A player with no combine: why. */
export function noCombine(profile: StatsProfile): string {
  const y = profile.combineYears
  return y ? `Not at the combines of ${y.first} to ${y.last}.` : 'The combine is not loaded yet.'
}

/** The note under the combine: what a percentile is among, and the position it used. */
export function combineNote(combine: StatsCombine, years: string): string {
  const listed = combine.position ? `Listed as ${combine.position}` : 'No position listed'
  return combine.group
    ? `${listed}: percentiles among ${amongWords(combine.group)} at every combine of ${years}, the better side higher. Measurements have no better side and are not shaded.`
    : `${listed}, so no percentiles.`
}
