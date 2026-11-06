import { describe, expect, it } from 'vitest'
import { BOARD_ROWS, BOARDS, boardQuery, boardView } from '@/lib/stats/boards'
import type { StatsScope } from '@/lib/stats/scope'
import type { StatsResult, StatsRow } from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const BY_ID = new Map(catalogueFixture().map((m) => [m.id, m]))
const SCOPE: StatsScope = { season: 2026, seasonType: 'playoffs', range: { kind: 'season' } }

const row = (id: string, value: number | null, games: number): StatsRow => ({
  id,
  name: `Player ${id}`,
  team: 'BOS',
  position: 'G',
  group: {},
  games,
  values: {
    pts: { value, raw: value, sample: games, qualified: true, percentile: null, rank: null }
  }
})

const result = (rows: StatsRow[]): StatsResult => ({
  grain: 'season',
  columns: [
    {
      id: 'pts',
      label: 'Points',
      short: 'PTS',
      unit: 'count',
      decimals: 0,
      direction: 'higher',
      seasons: [2026],
      reason: null
    }
  ],
  rows,
  total: rows.length,
  notes: [],
  ms: 1
})

const pts = BY_ID.get('pts')!

describe('the home boards', () => {
  it('reads metrics the catalogue has, of the right entity', () => {
    expect(BOARDS).toHaveLength(8)
    for (const b of BOARDS) expect(BY_ID.get(b.metric)?.entity, b.key).toBe(b.entity)
    expect(new Set(BOARDS.map((b) => b.key)).size).toBe(8)
  })

  it('asks for the qualified rows of the scope, per game when asked', () => {
    const q = boardQuery(BOARDS[0], SCOPE, true)
    expect(q).toMatchObject({
      entity: 'player',
      metrics: ['pts'],
      transform: 'perGame',
      scope: { seasons: [2026], gameTypes: ['playoffs'], qualifiedOnly: true }
    })
    expect(boardQuery(BOARDS[0], SCOPE, false).transform).toBe('raw')
  })
})

describe('a board’s rows', () => {
  it('holds a per-game leader to 70 % of the games anyone played', () => {
    const r = result([row('a', 40, 10), row('b', 30, 60), row('c', 20, 82)])
    const view = boardView(r, pts, true)
    // 70 % of 82 is 58 games: the player with ten great ones does not lead.
    expect(view.rows.map((x) => x.id)).toEqual(['b', 'c'])
    expect(view.rows[0]).toMatchObject({ rank: 1, lead: true, fraction: 1, value: '30.0' })
    expect(view.rows[1]).toMatchObject({ rank: 2, lead: false })
    expect(view.rows[1].fraction).toBeCloseTo(20 / 30, 6)
    expect(view.sub).toBe('per game')
  })

  it('needs no games for a total', () => {
    const view = boardView(result([row('a', 400, 10), row('b', 300, 82)]), pts, false)
    expect(view.rows.map((x) => x.id)).toEqual(['a', 'b'])
    expect(view.rows[0].value).toBe('400')
    expect(view.sub).toBe('total')
  })

  it('needs no games for a rate, which has its own sample', () => {
    const view = boardView(
      result([row('a', 0.65, 10), row('b', 0.6, 82)]),
      BY_ID.get('ts_pct')!,
      true
    )
    expect(view.rows).toHaveLength(2)
    expect(view.sub).toBe('')
  })

  it('leaves out a row with no value, and stops at six', () => {
    const rows = [
      row('none', null, 82),
      ...Array.from({ length: 9 }, (_, i) => row(`${i}`, 9 - i, 82))
    ]
    const view = boardView(result(rows), pts, true)
    expect(view.rows).toHaveLength(BOARD_ROWS)
    expect(view.rows.map((x) => x.id)).not.toContain('none')
  })

  it('draws a negative value as no bar, and survives an empty result', () => {
    const rating = BY_ID.get('team_nrtg')!
    const view = boardView(result([row('a', 5, 82), row('b', -5, 82)]), rating, true)
    expect(view.rows[1].fraction).toBe(0)
    expect(boardView(result([]), pts, true).rows).toEqual([])
  })
})
