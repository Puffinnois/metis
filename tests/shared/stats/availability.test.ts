import { describe, expect, it } from 'vitest'
import { AVAILABILITY } from '@shared/stats/catalogue/availability'
import {
  AVAILABILITY_FIRST_SEASON,
  AVAILABILITY_REASON,
  coachRole,
  isInjuryReason
} from '@shared/stats/availability'
import { coverageReason } from '@shared/stats/catalogue'

describe('whether an Out was for an injury', () => {
  it('follows the category when the report gives one', () => {
    expect(isInjuryReason('Injury/Illness', 'Left ankle sprain')).toBe(true)
    expect(isInjuryReason('Injury/Illness', '-')).toBe(true)
    expect(isInjuryReason('G League Team', '-')).toBe(false)
    expect(isInjuryReason('Rest', 'Load management')).toBe(false)
  })

  it('reads the reason when there is no category', () => {
    expect(isInjuryReason(null, 'Injury/Illness - Left Knee; Sprain')).toBe(true)
    expect(isInjuryReason(null, 'Concussion Protocol')).toBe(true)
    for (const r of [
      'G League - Two-Way',
      'G League - On Assignment',
      'Not With Team',
      'Not with Team - Self Isolating',
      'Personal Reasons',
      'Rest',
      'Rest - Left Knee Injury Management',
      "Coach's Decision",
      'League Suspension',
      'Team Suspension',
      'Trade Pending',
      'Health and Safety Protocols',
      'Return to Competition Reconditioning',
      'Ineligible To Play',
      '-'
    ]) {
      expect(isInjuryReason(null, r), r).toBe(false)
    }
  })

  it('does not count a report with no reason as an injury', () => {
    expect(isInjuryReason(null, null)).toBe(false)
    expect(isInjuryReason(null, '  ')).toBe(false)
  })
})

describe('the staff roles', () => {
  it('tells a head coach from an assistant and leaves out the trainers', () => {
    expect(coachRole('Head Coach')).toBe('head')
    expect(coachRole('Interim Head Coach')).toBe('head')
    expect(coachRole('Assistant Coach')).toBe('assistant')
    expect(coachRole('Associate Head Coach')).toBe('assistant')
    expect(coachRole('Assistant Coach for Player Development')).toBe('assistant')
    expect(coachRole('Trainer')).toBeNull()
    expect(coachRole('Assistant Trainer')).toBeNull()
    expect(coachRole('Strength and Conditioning Coach')).toBeNull()
    expect(coachRole('Director of Athletic Development')).toBeNull()
    expect(coachRole(null)).toBeNull()
  })
})

describe('the availability metrics', () => {
  it('start where the reports cover nearly every game, and say so before it', () => {
    expect(AVAILABILITY_FIRST_SEASON).toBe(2020)
    expect(AVAILABILITY_REASON).toBe('Recorded from 2019-20.')
    for (const m of AVAILABILITY) {
      expect(coverageReason(m, [2019])).toBe('Recorded from 2019-20.')
      expect(coverageReason(m, [2020])).toBeNull()
    }
  })

  it('are counts of games out that sample themselves, from the published table', () => {
    expect(AVAILABILITY.map((m) => m.id)).toEqual(['games_out_injury', 'games_out_other'])
    for (const m of AVAILABILITY) {
      expect(m).toMatchObject({
        family: 'availability',
        published: 'pub_player_availability',
        aggregation: 'sum',
        unit: 'count',
        kind: 'recorded'
      })
      expect(m.value).toBe(`{${m.id}}`)
      expect(m.sample).toBe(m.id)
      expect(m.description).toMatch(/once however many reports/)
    }
  })
})
