import { describe, expect, it } from 'vitest'
import {
  lineNumbers,
  onCourtGap,
  onCourtScope,
  teamOnOffQuery,
  unitRows,
  wowyRows
} from '@/lib/stats/onCourt'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsOnCourtLine, StatsWithOrWithout } from '@shared/stats/types'

const line = (o: Partial<StatsOnCourtLine>): StatsOnCourtLine =>
  ({
    games: 2,
    secs: 2880,
    poss: 100,
    pts: 110,
    opp_poss: 98,
    opp_pts: 100,
    fgm: 40,
    fga: 80,
    fg3m: 10,
    opp_fgm: 38,
    opp_fga: 84,
    opp_fg3m: 8,
    tov: 12,
    oreb: 10,
    opp_dreb: 30,
    ...o
  }) as StatsOnCourtLine

const scope = (o: Partial<StatsScope> = {}): StatsScope => ({
  season: 2026,
  seasonType: 'regular',
  range: { kind: 'season' },
  ...o
})

describe('on and off the floor, on the screen', () => {
  it('divides a line on read', () => {
    const n = lineNumbers(line({}))
    expect(n.minutes).toBe(48)
    expect(n.ortg).toBe(110)
    expect(n.drtg).toBeCloseTo((100 * 100) / 98, 9)
    expect(n.net).toBeCloseTo(110 - (100 * 100) / 98, 9)
    expect(n.pace).toBe(99)
    expect(n.efg).toBeCloseTo(45 / 80, 9)
    expect(n.plusMinus).toBe(10)
    expect(n.orbPct).toBe(0.25)
  })

  it('reads a rate with nothing under it as blank, not zero', () => {
    const n = lineNumbers(line({ poss: 0, opp_poss: 0, fga: 0, secs: 0 }))
    expect([n.ortg, n.drtg, n.net, n.pace, n.efg, n.tovPct]).toEqual([
      null,
      null,
      null,
      null,
      null,
      null
    ])
  })

  it('hides units under the minimum and sorts by any column, blanks last', () => {
    const units = [
      { players: [{ id: '1', name: 'A' }], line: line({ secs: 600, poss: 20 }) },
      { players: [{ id: '2', name: 'B' }], line: line({ secs: 1200, poss: 60 }) },
      { players: [{ id: '3', name: 'C' }], line: line({ secs: 900, poss: 0, opp_poss: 0 }) }
    ]
    expect(unitRows(units, 25, { by: 1, dir: 'desc' }).map((r) => r.key)).toEqual(['2'])
    expect(unitRows(units, 0, { by: 1, dir: 'desc' }).map((r) => r.key)).toEqual(['2', '3', '1'])
    // ORtg: the unit with no possessions has none, and sorts last either way.
    expect(
      unitRows(units, 0, { by: 4, dir: 'asc' })
        .map((r) => r.key)
        .at(-1)
    ).toBe('3')
    expect(unitRows(units, 0, { by: 3, dir: 'desc' })[0].cells[3]).toBe('+10')
  })

  it('names the four with-or-without splits, a missing one blank', () => {
    const value: StatsWithOrWithout = {
      teamId: '1',
      teammate: '9',
      teammates: [{ id: '9', name: 'Bo Teammate', minutes: 300 }],
      splits: { both: line({}), playerOnly: line({}), teammateOnly: null, neither: line({}) },
      reason: null
    }
    const rows = wowyRows(value, 'Al Star')
    expect(rows.map((r) => r.label)).toEqual([
      'Al Star and Bo Teammate',
      'Al Star without Bo Teammate',
      'Bo Teammate without Al Star',
      'Neither'
    ])
    expect(rows[2].cells).toBeNull()
  })

  it('reads the scope bar, and says why an early season has nothing', () => {
    expect(onCourtScope(scope())).toEqual({ gameTypes: ['regular'] })
    expect(
      onCourtScope(scope({ range: { kind: 'dates', from: '2026-01-01', to: '2026-01-31' } }))
    ).toEqual({
      gameTypes: ['regular'],
      dates: ['2026-01-01', '2026-01-31']
    })
    expect(onCourtScope(scope({ range: { kind: 'last', n: 10, of: 'appearances' } })).lastN).toBe(
      10
    )
    expect(onCourtGap(scope({ season: 1996 }))).toBe(
      "Counted from 1996-97, when the NBA's play by play starts."
    )
    expect(onCourtGap(scope())).toBeNull()
  })

  it('asks the engine for each player’s on/off for one team', () => {
    const q = teamOnOffQuery('1610612760', scope())
    expect(q.scope.teams).toEqual(['1610612760'])
    expect(q.metrics).toContain('onoff_net')
  })
})
