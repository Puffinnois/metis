import { describe, expect, it } from 'vitest'
import {
  coachLines,
  officialsText,
  reasonText,
  statusTag,
  tagsById
} from '@/lib/stats/availability'
import type { StatsAvailability } from '@shared/stats/types'

const ana: StatsAvailability = {
  playerId: '1',
  status: 'Out',
  reason: 'Injury/Illness - Left Ankle; Sprain',
  injury: true,
  reportDate: '2026-11-09',
  gameDate: '2026-11-10',
  gameId: '0022600200'
}

describe('a reason, said plainly', () => {
  it('drops the category and joins the parts', () => {
    expect(reasonText('Injury/Illness - Left Ankle; Sprain')).toBe('left ankle sprain')
    expect(reasonText('Injury/Illness - Low Back; Tightness')).toBe('low back tightness')
  })

  it('drops the report’s "N/a" and keeps an acronym', () => {
    expect(reasonText('Injury/Illness - N/a; Upper Respiratory Infection')).toBe(
      'upper respiratory infection'
    )
    expect(reasonText('Injury/Illness - Right Knee; ACL')).toBe('right knee ACL')
  })

  it('has none for an empty or placeholder reason', () => {
    expect(reasonText(null)).toBeNull()
    expect(reasonText('-')).toBeNull()
    expect(reasonText('Injury/Illness - N/a')).toBeNull()
  })

  it('says another reason as it is worded, lower case', () => {
    expect(reasonText('G League - Two-Way')).toBe('g league - two-way')
    expect(reasonText('Rest')).toBe('rest')
  })
})

describe('the status tag', () => {
  it('reads status, reason and the report’s date', () => {
    const tag = statusTag(ana)!
    expect(tag.text).toBe('Out · left ankle sprain · report of Nov 9')
    expect(tag.tone).toBe('bad')
    expect(tag.title).toMatch(/not a prediction/)
    expect(tag.title).toMatch(/Nov 10/)
  })

  it('leaves out the reason when the report gives none', () => {
    expect(statusTag({ ...ana, status: 'Questionable', reason: null })!.text).toBe(
      'Questionable · report of Nov 9'
    )
    expect(statusTag({ ...ana, status: 'Questionable', reason: null })!.tone).toBe('warn')
    expect(statusTag({ ...ana, status: 'Available', reason: null })!.tone).toBe('good')
  })

  it('has none for a player the latest report does not list', () => {
    expect(statusTag(undefined)).toBeNull()
    expect(statusTag(null)).toBeNull()
    expect(tagsById(null).size).toBe(0)
  })

  it('maps by player id', () => {
    const tags = tagsById([ana, { ...ana, playerId: '2', status: 'Probable' }])
    expect([...tags.keys()]).toEqual(['1', '2'])
    expect(tags.get('2')?.tone).toBe('good')
  })
})

describe('a team’s coaches', () => {
  const coach = (name: string, role: 'head' | 'assistant'): never =>
    ({ id: name, name, title: role, role }) as never

  it('names the head coach and lists the assistants', () => {
    expect(
      coachLines([
        coach('Hal Head', 'head'),
        coach('Amy Able', 'assistant'),
        coach('Zed', 'assistant')
      ])
    ).toEqual({ head: 'Hal Head', assistants: 'Amy Able, Zed' })
  })

  it('names both head coaches of a season the job changed hands', () => {
    expect(coachLines([coach('A', 'head'), coach('B', 'head')]).head).toBe('A and B')
  })

  it('has none when the file lists none', () => {
    expect(coachLines([])).toEqual({ head: null, assistants: null })
    expect(coachLines(null)).toEqual({ head: null, assistants: null })
  })
})

describe('a game’s officials', () => {
  it('lists the crew, and says nothing for a game without one', () => {
    expect(
      officialsText([
        { id: '1', name: 'Zach Zarba' },
        { id: '2', name: 'Eric Dalen' }
      ])
    ).toBe('Zach Zarba, Eric Dalen')
    expect(officialsText([])).toBeNull()
    expect(officialsText(null)).toBeNull()
  })
})
