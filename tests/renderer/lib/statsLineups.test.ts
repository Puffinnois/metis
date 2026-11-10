import { describe, expect, it } from 'vitest'
import {
  cellText,
  DEFAULT_SORT,
  lineupGap,
  lineupGameType,
  lineupNotes,
  lineupRows,
  shortName,
  unitCount,
  unitValue
} from '@/lib/stats/lineups'
import type { StatsScope } from '@/lib/stats/scope'
import {
  lineupColumns,
  lineupReadIds,
  LINEUP_STORED,
  type LineupColumn
} from '@shared/stats/lineups'
import type { StatsLineupUnit } from '@shared/stats/types'

const scope = (over: Partial<StatsScope> = {}): StatsScope => ({
  season: 2026,
  seasonType: 'regular',
  range: { kind: 'season' },
  ...over
})

/** A unit: 4 games, 60 minutes, 120 possessions, 100 points, 40 of 90 from the field. */
const unit = (over: Partial<StatsLineupUnit> = {}, values = {}): StatsLineupUnit => ({
  players: ['1', '2', '3', '4', '5'].map((id) => ({ id, name: `Player ${id}` })),
  games: 4,
  minutes: 60,
  values: { pts: 100, fgm: 40, fga: 90, w: 3, possessions: 120, adv_off_rating: 120.5, ...values },
  ...over
})

const col = (id: string): LineupColumn => {
  const c = lineupColumns('base')
    .concat(lineupColumns('advanced'))
    .find((x) => x.id === id)
  if (!c) throw new Error(id)
  return c
}

describe('the lineups tab’s scope', () => {
  it('reads a season before 2007-08 as not recorded', () => {
    expect(lineupGap(scope({ season: 2007 }))).toBe('Recorded from 2007-08.')
    expect(lineupGap(scope({ season: 2008 }))).toBeNull()
  })

  it('wants a whole season', () => {
    expect(lineupGap(scope({ range: { kind: 'last', n: 10, of: 'team' } }))).toBe(
      'Published for whole seasons only.'
    )
    expect(
      lineupGap(scope({ range: { kind: 'dates', from: '2026-01-01', to: '2026-02-01' } }))
    ).toBe('Published for whole seasons only.')
  })

  it('answers the regular season and the playoffs, one at a time', () => {
    expect(lineupGap(scope({ seasonType: 'playoffs' }))).toBeNull()
    expect(lineupGameType(scope({ seasonType: 'playoffs' }))).toBe('playoffs')
    expect(lineupGameType(scope())).toBe('regular')
    expect(lineupGap(scope({ seasonType: 'counted' }))).toMatch(/apart/)
    expect(lineupGap(scope({ seasonType: 'play-in' }))).toMatch(/only/)
  })
})

describe('a unit’s numbers in each mode', () => {
  it('reads a total as published', () => {
    expect(unitValue(unit(), col('pts'), 'raw')).toEqual({ value: 100 })
  })

  it('divides by games, by minutes for 36 and 48, and by possessions for 100', () => {
    expect(unitValue(unit(), col('pts'), 'perGame').value).toBe(25)
    expect(unitValue(unit(), col('pts'), 'per48').value).toBe(80)
    expect(unitValue(unit(), col('pts'), 'per36').value).toBeCloseTo(60, 9)
    expect(unitValue(unit(), col('pts'), 'per100').value).toBeCloseTo((100 / 120) * 100, 9)
  })

  it('leaves a rating, a percentage and the wins as they are in any mode', () => {
    for (const mode of ['raw', 'perGame', 'per48', 'per100'] as const) {
      expect(unitValue(unit(), col('adv_off_rating'), mode).value).toBe(120.5)
      expect(unitValue(unit(), col('w'), mode).value).toBe(3)
    }
  })

  it('works a percentage out of its parts', () => {
    expect(unitValue(unit(), col('fg_pct'), 'per48').value).toBeCloseTo(40 / 90, 12)
    expect(unitValue(unit(), col('w_pct'), 'raw').value).toBe(0.75)
    const none = unitValue(unit({}, { fga: 0, fgm: 0 }), col('fg_pct'), 'raw')
    expect(none).toEqual({ value: null, reason: 'No attempts.' })
  })

  it('is blank with a reason when a file does not list the unit or the divisor is missing', () => {
    const missing = unitValue(unit({}, { pts: null }), col('pts'), 'raw')
    expect(missing.value).toBeNull()
    expect(missing.reason).toMatch(/does not list this unit/)
    const noPoss = unitValue(unit({}, { possessions: null }), col('pts'), 'per100')
    expect(noPoss).toMatchObject({ value: null, reason: expect.stringMatching(/possessions/) })
    expect(unitValue(unit({ minutes: 0 }), col('pts'), 'per48').reason).toMatch(/no minutes/)
    expect(unitValue(unit({ games: 0 }), col('pts'), 'perGame').value).toBeNull()
  })

  it('writes a rescaled count with a decimal and a percentage as a percentage', () => {
    expect(cellText(100, col('pts'), 'raw')).toBe('100')
    expect(cellText(25, col('pts'), 'perGame')).toBe('25.0')
    expect(cellText(0.4444, col('fg_pct'), 'raw')).toBe('44.4%')
    expect(cellText(null, col('pts'), 'raw')).toBe('—')
  })
})

describe('the list of units', () => {
  const units = [
    unit({ minutes: 30, games: 2 }, { pts: 50 }),
    unit({ minutes: 200, games: 9 }, { pts: 400 }),
    unit({ minutes: 90, games: 6 }, { pts: null }),
    unit({ minutes: 8, games: 1 }, { pts: 10 })
  ]
  const pts = (rows: ReturnType<typeof lineupRows>): (string | undefined)[] =>
    rows.map((r) => r.cells[lineupColumns('base').findIndex((c) => c.id === 'pts')].text)

  it('starts with the most minutes and hides the units under the minimum', () => {
    const rows = lineupRows(units, 'base', 'raw', 25, DEFAULT_SORT)
    expect(rows.map((r) => r.minutes)).toEqual(['200:00', '90:00', '30:00'])
    expect(lineupRows(units, 'base', 'raw', 0, DEFAULT_SORT)).toHaveLength(4)
    expect(lineupRows(units, 'base', 'raw', 500, DEFAULT_SORT)).toHaveLength(0)
  })

  it('sorts by a column either way, with blanks last', () => {
    const at = lineupColumns('base').findIndex((c) => c.id === 'pts') + 2
    expect(pts(lineupRows(units, 'base', 'raw', 0, { by: at, dir: 'desc' }))).toEqual([
      '400',
      '50',
      '10',
      '—'
    ])
    expect(pts(lineupRows(units, 'base', 'raw', 0, { by: at, dir: 'asc' }))).toEqual([
      '10',
      '50',
      '400',
      '—'
    ])
  })

  it('sorts a rescaled column by what it shows', () => {
    const at = lineupColumns('base').findIndex((c) => c.id === 'pts') + 2
    const rows = lineupRows(units, 'base', 'perGame', 0, { by: at, dir: 'desc' })
    // 400 over 9 games is 44.4; 50 over 2 games is 25; 10 over 1 game is 10.
    expect(pts(rows)).toEqual(['44.4', '25.0', '10.0', '—'])
  })

  it('keys a unit by its five ids, and counts what a list shows', () => {
    expect(lineupRows(units, 'base', 'raw', 0, DEFAULT_SORT)[0].key).toBe('1-2-3-4-5')
    expect(unitCount(15, 82)).toBe('15 of 82 units')
    expect(unitCount(1, 1)).toBe('1 unit')
  })
})

describe('the notes and the catalogue', () => {
  it('say the regular season is cut to 2,000 units, and the playoffs are not', () => {
    expect(lineupNotes(scope(), 11.9, 'raw').join(' ')).toMatch(/2,000 units.*11:54/)
    expect(lineupNotes(scope({ seasonType: 'playoffs' }), 0, 'raw')).toEqual([])
    expect(lineupNotes(scope({ seasonType: 'playoffs' }), 0, 'per100')).toHaveLength(1)
  })

  it('shortens a name the way the NBA does', () => {
    expect(shortName('Jayson Tatum')).toBe('J. Tatum')
    expect(shortName('Jaren Jackson Jr.')).toBe('J. Jackson Jr.')
    expect(shortName('D. Sabonis')).toBe('D. Sabonis')
    expect(shortName('Player 12')).toBe('Player 12')
    expect(shortName('Nene')).toBe('Nene')
  })

  it('stores each column once and reads the parts of its percentages', () => {
    const ids = LINEUP_STORED.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(lineupReadIds('base')).toEqual(expect.arrayContaining(['fgm', 'fga', 'w']))
    expect(lineupReadIds('base')).not.toContain('fg_pct')
    expect(lineupReadIds('opponent')).toEqual(expect.arrayContaining(['opp_fg3m', 'opp_fg3a']))
  })
})
