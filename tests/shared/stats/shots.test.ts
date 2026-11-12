import { describe, expect, it } from 'vitest'
import { COURT, shotBand, shotType, shotZone, SHOT_TYPES } from '@shared/stats/shots'

describe('shot zones, on their boundary points', () => {
  it('reads the restricted area to 4 feet from the basket, the line included', () => {
    expect(shotZone(0, 0, 2)).toBe('ra')
    expect(shotZone(0, 40, 2)).toBe('ra')
    expect(shotZone(24, 32, 2)).toBe('ra') // 40 exactly, off the axis
    expect(shotZone(0, 40.1, 2)).toBe('paint')
    expect(shotZone(0, -40, 2)).toBe('ra') // behind the basket
  })

  it('reads the paint to the lane lines and the free-throw line, both included', () => {
    expect(shotZone(80, 100, 2)).toBe('paint')
    expect(shotZone(80.5, 100, 2)).toBe('mid')
    expect(shotZone(0, COURT.laneTopY, 2)).toBe('paint')
    expect(shotZone(0, COURT.laneTopY + 0.5, 2)).toBe('mid')
  })

  it('takes two or three from the published value, and the corner from where it was taken', () => {
    // A long two stays a two, wherever the point is.
    expect(shotZone(230, 50, 2)).toBe('mid')
    expect(shotZone(-225, 50, 3)).toBe('c3l')
    expect(shotZone(225, 50, 3)).toBe('c3r')
    expect(shotZone(225, COURT.cornerTopY, 3)).toBe('c3r')
    expect(shotZone(225, COURT.cornerTopY + 0.5, 3)).toBe('atb3')
    expect(shotZone(0, 250, 3)).toBe('atb3')
    // 1996-97's 22-foot line: a three inside today's arc is still a three.
    expect(shotZone(0, 225, 3)).toBe('atb3')
  })

  it('reads the line when the value is missing', () => {
    expect(shotZone(0, 237.5, null)).toBe('atb3')
    expect(shotZone(0, 237, null)).toBe('mid')
    expect(shotZone(-220, 0, null)).toBe('c3l')
    expect(shotZone(-219, 0, null)).toBe('mid')
  })

  it('puts beyond half court in the backcourt, and a point off any court apart', () => {
    expect(shotZone(0, COURT.halfCourtY, 3)).toBe('atb3')
    expect(shotZone(0, COURT.halfCourtY + 0.5, 3)).toBe('back')
    expect(shotZone(-16398, -4098, 2)).toBe('unk')
    expect(shotZone(null, 10, 2)).toBe('unk')
  })
})

describe('distance bands', () => {
  it('reads the NBA’s ranges on the published distance', () => {
    expect(shotBand(0)).toBe('lt8')
    expect(shotBand(7)).toBe('lt8')
    expect(shotBand(8)).toBe('d8_16')
    expect(shotBand(15)).toBe('d8_16')
    expect(shotBand(16)).toBe('d16_24')
    expect(shotBand(23)).toBe('d16_24')
    expect(shotBand(24)).toBe('d24p')
    expect(shotBand(85)).toBe('d24p')
  })

  it('falls back on the coordinates, rounded to the foot', () => {
    expect(shotBand(null, 0, 75)).toBe('d8_16') // 7.5 feet rounds to 8
    expect(shotBand(null, 0, 74)).toBe('lt8')
    expect(shotBand(null, null, null)).toBeNull()
  })
})

describe('shot types', () => {
  it('maps every sub type the NBA’s file has used, the first rule winning', () => {
    const cases: [string, string][] = [
      ['Jump Shot', 'jumper'],
      ['Pullup Jump shot', 'jumper'],
      ['Step Back Jump shot', 'jumper'],
      ['Turnaround Fadeaway shot', 'jumper'],
      ['Fadeaway Bank shot', 'jumper'],
      ['Running Bank shot', 'jumper'],
      ['Driving Floating Jump Shot', 'floater'],
      ['Driving Floating Bank Jump Shot', 'floater'],
      ['Floating Jump shot', 'floater'],
      ['Layup Shot', 'layup'],
      ['Driving Finger Roll Layup Shot', 'layup'],
      ['Finger Roll Shot', 'layup'],
      ['Alley Oop Layup shot', 'layup'],
      ['Tip Shot', 'tip'],
      ['Tip Layup Shot', 'tip'],
      ['Running Tip Shot', 'tip'],
      ['Tip Dunk Shot', 'dunk'],
      ['Putback Slam Dunk Shot', 'dunk'],
      ['Follow Up Dunk Shot', 'dunk'],
      ['Alley Oop Dunk Shot', 'dunk'],
      ['Hook Shot', 'hook'],
      ['Driving Bank Hook Shot', 'hook'],
      ['Turnaround Hook Shot', 'hook']
    ]
    for (const [text, type] of cases) expect(shotType(text), text).toBe(type)
  })

  it('calls a text no rule matches, or none, other', () => {
    expect(shotType(null)).toBe('other')
    expect(shotType('')).toBe('other')
    expect(shotType('Something New')).toBe('other')
    expect(SHOT_TYPES.at(-1)?.key).toBe('other')
  })
})
