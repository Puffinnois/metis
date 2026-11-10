import { describe, expect, it } from 'vitest'
import {
  bioFacts,
  combineLine,
  combineNote,
  combineSections,
  combineYears,
  draftView,
  fmtCombine,
  fmtLength,
  noCombine
} from '@/lib/stats/profile'
import { PLAYER_DASH_TABS } from '@/lib/stats/player'
import { COMBINE_BY_ID } from '@shared/stats/profile'
import type { StatsBio, StatsCombine, StatsCombineValue, StatsProfile } from '@shared/stats/types'

const measure = (id: string): NonNullable<ReturnType<typeof COMBINE_BY_ID.get>> => {
  const m = COMBINE_BY_ID.get(id)
  if (!m) throw new Error(id)
  return m
}

const value = (v: Partial<StatsCombineValue>): StatsCombineValue => ({
  value: null,
  made: null,
  attempts: null,
  percentile: null,
  rank: null,
  pool: 0,
  held: true,
  ...v
})

/** Grayson Allen's 2018 combine, in part: no bench press, though it was held. */
const COMBINE: StatsCombine = {
  year: 2018,
  position: 'SG',
  group: 'G',
  values: {
    lane_agility_time: value({ value: 10.31, percentile: 99.3, rank: 6, pool: 689 }),
    bench_press: value({ pool: 466 }),
    height_wo_shoes: value({ value: 75, percentile: 50.1, pool: 779 }),
    college: value({ value: 0.76, made: 19, attempts: 25, percentile: 93.3, rank: 10, pool: 201 })
  }
}

const PROFILE: StatsProfile = {
  bio: null,
  draft: null,
  draftYears: { first: 1996, last: 2026 },
  combines: [COMBINE],
  combineYears: { first: 2000, last: 2026 }
}

describe('the profile tab', () => {
  it('is the last of the player dashboard’s tabs', () => {
    expect(PLAYER_DASH_TABS.at(-1)).toEqual({ id: 'profile', label: 'Profile' })
  })
})

describe('combine values', () => {
  it('write lengths in feet and inches, to the quarter inch', () => {
    expect(fmtLength(81.25)).toBe('6′ 9.25″')
    expect(fmtLength(72)).toBe('6′ 0″')
    expect(fmtLength(null)).toBe('—')
  })

  it('write each unit as it is measured, and a blank for no result', () => {
    expect(fmtCombine(measure('lane_agility_time'), value({ value: 10.5 }))).toBe('10.50 s')
    expect(fmtCombine(measure('weight'), value({ value: 201.2 }))).toBe('201.2 lb')
    expect(fmtCombine(measure('body_fat_pct'), value({ value: 5.55 }))).toBe('5.55 %')
    expect(fmtCombine(measure('hand_width'), value({ value: 10 }))).toBe('10 in')
    expect(fmtCombine(measure('bench_press'), value({ value: 0 }))).toBe('0')
    expect(fmtCombine(measure('wingspan_to_height'), value({ value: 80 / 75 }))).toBe('1.067')
    expect(fmtCombine(measure('college'), value({ value: 0.76, made: 19, attempts: 25 }))).toBe(
      '19-25 76%'
    )
    expect(fmtCombine(measure('bench_press'), value({}))).toBe('—')
    expect(fmtCombine(measure('bench_press'), undefined)).toBe('—')
  })
})

describe('a combine line', () => {
  it('ranks a time with the faster side higher, and says so', () => {
    const line = combineLine(measure('lane_agility_time'), COMBINE, '2000 to 2026')
    expect(line).toMatchObject({
      value: '10.31 s',
      percentile: 99.3,
      rank: '6th',
      missing: null,
      neutral: false
    })
    expect(line.title).toBe(
      '99th percentile among 689 guards measured at the combines of 2000 to 2026 · 6th of 689 · Faster is higher.'
    )
  })

  it('leaves a skipped test blank, with why', () => {
    const line = combineLine(measure('bench_press'), COMBINE, '2000 to 2026')
    expect(line).toMatchObject({
      value: '—',
      percentile: null,
      missing: 'No result at the 2018 combine.'
    })
    expect(combineLine(measure('max_vertical_leap'), COMBINE, '').missing).toBe(
      'Not held at the 2018 combine.'
    )
  })

  it('shades a measurement as having no better side, and gives it no rank', () => {
    const line = combineLine(measure('height_wo_shoes'), COMBINE, '2000 to 2026')
    expect(line).toMatchObject({ value: '6′ 3″', rank: null, neutral: true })
    expect(line.title).toContain('Longer is higher.')
  })

  it('has no percentile without a position, or alone in the group', () => {
    const none = { ...COMBINE, group: null }
    expect(combineLine(measure('lane_agility_time'), none, '').missing).toBe(
      'No position listed at the combine.'
    )
    const alone = { ...COMBINE, values: { bench_press: value({ value: 12, pool: 1 }) } }
    expect(combineLine(measure('bench_press'), alone, '').missing).toBe(
      'The only result among guards.'
    )
  })
})

describe('the combine’s sections', () => {
  it('says once that a part of the combine was not held', () => {
    const parts = combineSections(COMBINE, '2000 to 2026')
    expect(parts.map((p) => p.section?.title ?? p.absent)).toEqual([
      'Measurements',
      'Proportions was not held at the 2018 combine.',
      'Athletic testing',
      'Spot-up shooting',
      'Shooting off the dribble was not held at the 2018 combine.',
      'Shooting on the move was not held at the 2018 combine.'
    ])
    expect(parts[2].section?.lines.map((l) => l.label)).toEqual([
      'Standing vertical leap',
      'Max vertical leap',
      'Lane agility',
      'Shuttle run',
      'Three-quarter-court sprint',
      'Bench press'
    ])
  })

  it('says once that the player has no result in a part that was held', () => {
    const shotNothing = {
      ...COMBINE,
      values: { ...COMBINE.values, college: value({ pool: 201 }) }
    }
    expect(combineSections(shotNothing, '').map((p) => p.absent)[3]).toBe(
      'No spot-up shooting results at the 2018 combine.'
    )
  })

  it('notes what the percentiles are among', () => {
    expect(combineYears(PROFILE)).toBe('2000 to 2026')
    expect(combineNote(COMBINE, '2000 to 2026')).toMatch(
      /^Listed as SG: percentiles among guards at every combine of 2000 to 2026/
    )
    expect(combineNote({ ...COMBINE, position: null, group: null }, '')).toBe(
      'No position listed, so no percentiles.'
    )
  })

  it('says why there is no combine', () => {
    expect(noCombine(PROFILE)).toBe('Not at the combines of 2000 to 2026.')
    expect(noCombine({ ...PROFILE, combineYears: null })).toBe('The combine is not loaded yet.')
  })
})

describe('the bio and the draft', () => {
  const BIO: StatsBio = {
    season: 2027,
    team: { id: '1610612766', code: 'CHA' },
    number: '8',
    position: 'G',
    height: '6-4',
    weight: '218',
    birthDate: 'OCT 08, 1995',
    age: 31,
    experience: 'R',
    school: 'Duke',
    howAcquired: null
  }

  it('lists what the roster knows, in reading order', () => {
    expect(bioFacts(BIO)).toEqual([
      { label: 'Born', value: 'Oct 08, 1995' },
      { label: 'Age', value: '31 on the 2026-27 roster' },
      { label: 'Height', value: '6-4' },
      { label: 'Weight', value: '218 lb' },
      { label: 'Position', value: 'G' },
      { label: 'Number', value: '#8' },
      { label: 'School', value: 'Duke' },
      { label: 'Experience', value: 'Rookie' }
    ])
    expect(bioFacts({ ...BIO, experience: '1' }).at(-1)?.value).toBe('1 season')
  })

  it('writes the pick and where it came from', () => {
    const view = draftView({
      ...PROFILE,
      draft: {
        year: 2018,
        round: 1,
        roundPick: 21,
        overallPick: 21,
        team: { id: '1610612762', code: 'UTA', name: 'Utah Jazz' },
        organization: 'Duke',
        organizationType: 'College/University'
      }
    })
    expect(view).toEqual({
      facts: [
        { label: 'Year', value: '2018' },
        { label: 'Pick', value: 'Round 1, pick 21 (21st overall)' },
        { label: 'By', value: 'Utah Jazz' },
        { label: 'From', value: 'Duke (college/university)' }
      ],
      note: null
    })
  })

  it('says which drafts a player is not in, rather than calling them undrafted', () => {
    expect(draftView(PROFILE)).toEqual({ facts: [], note: 'Not in the drafts of 1996 to 2026.' })
    expect(draftView({ ...PROFILE, draftYears: null }).note).toBe('The draft is not loaded yet.')
  })
})
