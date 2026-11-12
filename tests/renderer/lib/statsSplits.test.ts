import { describe, expect, it } from 'vitest'
import { defaultBoard, leaderboardQuery } from '@/lib/stats/leaderboard'
import { splitTable } from '@/lib/stats/player'
import type { StatsScope } from '@/lib/stats/scope'
import {
  MOMENTS,
  playSplitDefs,
  playSplitNotes,
  playSplitTableNotes,
  TEAM_SPLIT_METRICS,
  teamSplitDefs,
  teamSplitQueries
} from '@/lib/stats/splits'
import { SPLITS } from '@shared/stats/splits'
import type { StatsResult, StatsRow, StatsSeason } from '@shared/stats/types'
import { catalogueFixture } from '../../fixtures/catalogue'

const byId = new Map(catalogueFixture().map((m) => [m.id, m]))
const SCOPE: StatsScope = { season: 2026, seasonType: 'regular', range: { kind: 'season' } }
const SEASON: StatsSeason = {
  season: 2026,
  firstDate: '2025-10-21',
  lastDate: '2026-04-12',
  types: [{ type: 'regular', games: 1230 }],
  teams: [{ id: '1', code: 'BOS', name: 'Boston', conference: 'east', division: 'atlantic' }]
}

const row = (games: number): StatsRow => ({
  id: '1',
  name: 'Boston',
  team: 'BOS',
  position: null,
  group: {},
  games,
  values: {
    team_pts: { value: 9, raw: 9, sample: 9, qualified: true, percentile: null, rank: null }
  }
})
const result = (rows: StatsRow[], notes: string[] = []): StatsResult => ({
  grain: 'game',
  columns: [],
  rows,
  total: rows.length,
  notes,
  ms: 1
})

describe('the play splits on the screens', () => {
  it('has a row per split, grouped, each group with its rule', () => {
    const defs = playSplitDefs()
    expect(defs).toHaveLength(SPLITS.length)
    expect(defs.find((d) => d.key === 'play-clutch')).toMatchObject({
      group: 'Clutch',
      patch: { split: 'clutch' }
    })
    expect(defs.find((d) => d.key === 'play-clutch')?.note).toMatch(/last 5 minutes/)
    expect([...new Set(defs.map((d) => d.group))]).toEqual([
      'By quarter',
      'Clutch',
      'Last minutes',
      'By the score',
      'Garbage time'
    ])
  })

  it("leaves a player's started or off the bench out of a team's splits", () => {
    const defs = teamSplitDefs(SEASON)
    expect(defs.some((d) => d.patch.starter !== undefined)).toBe(false)
    expect(defs.some((d) => d.patch.home === true)).toBe(true)
    expect(defs.some((d) => d.patch.split === 'q4')).toBe(true)
  })

  it("asks the engine for the team's splits, the months and the opponents", () => {
    const defs = teamSplitDefs(SEASON)
    const q = teamSplitQueries('1', defs, SCOPE, 'perGame')
    expect(q.size).toBe(defs.length + 3)
    expect(q.get('play-clutch')).toMatchObject({
      entity: 'team',
      metrics: TEAM_SPLIT_METRICS,
      scope: { teams: ['1'], split: 'clutch', seasons: [2026] }
    })
  })

  it('puts a group’s rule under its title, and leaves a split with no games out', () => {
    const defs = playSplitDefs()
    const results = new Map<string, StatsResult>([
      ['all', result([row(80)])],
      ['play-clutch', result([row(30)])],
      ['play-ot', result([])]
    ])
    const groups = splitTable(results, defs, SEASON, byId, 'perGame', ['team_pts'])
    expect(groups.map((g) => g.title)).toEqual(['Overall', 'Clutch'])
    expect(groups[1].note).toMatch(/^The NBA's rule/)
    expect(groups[1].rows[0]).toMatchObject({ label: 'Clutch', games: '30' })
  })

  it('says where the play splits start and what they leave out, without repeating rules', () => {
    expect(playSplitNotes({ ...SCOPE, season: 1996 })[0]).toMatch(/from 1996-97/)
    expect(playSplitNotes(SCOPE)[0]).toMatch(/Plus-minus is not/)
    const results = new Map([
      [
        'a',
        result([], ["Clutch: The NBA's rule: … Counted from the NBA's play by play.", 'Other.'])
      ]
    ])
    expect(playSplitTableNotes(results, SCOPE)).toEqual(['Other.', ...playSplitNotes(SCOPE)])
  })

  it('carries a leaderboard’s moment into its query, and the whole game by default', () => {
    const board = defaultBoard('player', 'ALL', byId)
    expect(board.split).toBeUndefined()
    expect(leaderboardQuery(board, SCOPE, byId).scope.split).toBeUndefined()
    expect(leaderboardQuery({ ...board, split: 'clutch' }, SCOPE, byId).scope.split).toBe('clutch')
    expect(MOMENTS[0]).toEqual({ value: '', label: 'Whole game' })
    expect(MOMENTS).toHaveLength(SPLITS.length + 1)
  })
})
