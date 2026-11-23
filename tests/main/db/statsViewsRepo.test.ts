import { describe, expect, it } from 'vitest'
import { openDatabase } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { deleteStatsView, listStatsViews, saveStatsView } from '@main/db/repos/statsViews'
import type { LeaderboardBoard } from '@shared/stats/types'

const board = (over: Partial<LeaderboardBoard> = {}): LeaderboardBoard => ({
  entity: 'player',
  tab: 'G',
  columns: ['pts', 'ast', 'ts_pct'],
  sort: { by: 'ts_pct', dir: 'desc' },
  mode: 'raw',
  qualifiedOnly: true,
  team: null,
  ...over
})

describe('stats views repo', () => {
  it('saves, lists by name and deletes', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const guards = saveStatsView(db, 'nba', '  Scoring guards ', board(), 't1')
    saveStatsView(
      db,
      'nba',
      'Fast teams',
      board({ entity: 'team', tab: 'offense', columns: ['team_pace'] }),
      't1'
    )
    expect(guards).toEqual({
      id: guards.id,
      name: 'Scoring guards',
      board: board(),
      updatedAt: 't1'
    })
    expect(listStatsViews(db, 'nba').map((v) => v.name)).toEqual(['Fast teams', 'Scoring guards'])
    deleteStatsView(db, 'nba', guards.id)
    expect(listStatsViews(db, 'nba').map((v) => v.name)).toEqual(['Fast teams'])
  })

  it('replaces a view of the same name, whatever its case', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const first = saveStatsView(db, 'nba', 'Shooters', board(), 't1')
    const second = saveStatsView(db, 'nba', 'shooters', board({ mode: 'per36' }), 't2')
    expect(second.id).toBe(first.id)
    expect(listStatsViews(db, 'nba')).toEqual([
      { id: first.id, name: 'shooters', board: board({ mode: 'per36' }), updatedAt: 't2' }
    ])
  })

  it('rejects an empty or long name', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(() => saveStatsView(db, 'nba', '  ', board(), 't')).toThrow('A view needs a name')
    expect(() => saveStatsView(db, 'nba', 'x'.repeat(61), board(), 't')).toThrow('at most 60')
  })

  it('refuses a malformed board and skips a corrupt row', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const bad =
      (b: unknown): (() => unknown) =>
      () =>
        saveStatsView(db, 'nba', 'x', b as LeaderboardBoard, 't')
    expect(bad(undefined)).toThrow('This view cannot be saved')
    expect(bad({ ...board(), entity: 'coach' })).toThrow('This view cannot be saved')
    expect(bad({ ...board(), columns: 'pts' })).toThrow('This view cannot be saved')
    expect(bad({ ...board(), columns: Array(41).fill('pts') })).toThrow('This view cannot be saved')
    expect(bad({ ...board(), sort: { by: 'pts', dir: 'up' } })).toThrow('This view cannot be saved')
    expect(bad({ ...board(), mode: 'perWeek' })).toThrow('This view cannot be saved')
    saveStatsView(db, 'nba', 'Good', board(), 't')
    db.prepare(
      "INSERT INTO stats_views (league, name, board_json, created_at, updated_at) VALUES ('nba', 'Broken', '{not json', 't', 't'), ('nba', 'Odd', '{}', 't', 't')"
    ).run()
    expect(listStatsViews(db, 'nba').map((v) => v.name)).toEqual(['Good'])
  })
})

describe('a view saved with the favourites filter (T1601.3)', () => {
  it('keeps the flag, never the ids, and reads an older view as off', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const saved = saveStatsView(
      db,
      'nba',
      'My favourites: shooting',
      board({ favourites: true }),
      't1'
    )
    expect(saved.board.favourites).toBe(true)
    expect(listStatsViews(db, 'nba')[0].board.favourites).toBe(true)
    // A view saved before the filter has no flag: it opens with the filter off.
    saveStatsView(db, 'nba', 'Older', board(), 't2')
    expect(
      listStatsViews(db, 'nba').find((v) => v.name === 'Older')?.board.favourites
    ).toBeUndefined()
    // Only a true or false is a flag.
    expect(() =>
      saveStatsView(
        db,
        'nba',
        'Bad',
        { ...board(), favourites: 'yes' } as unknown as LeaderboardBoard,
        't3'
      )
    ).toThrow('invalid')
    const json = (
      db
        .prepare('SELECT board_json FROM stats_views WHERE name = ?')
        .get('My favourites: shooting') as { board_json: string }
    ).board_json
    expect(JSON.parse(json)).toMatchObject({ favourites: true })
    expect(json).not.toMatch(/\d{5,}/)
  })

  it('keeps a board’s filters (T1701.2), and opens a board saved before them', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const filters: LeaderboardBoard['filters'] = [
      { attribute: 'age', op: 'atMost', value: 25 },
      { attribute: 'birthCountry', op: 'noneOf', value: ['USA'] },
      { metric: 'ts_pct', op: 'between', value: [0.55, 0.7] },
      { attribute: 'undrafted', op: 'is' },
      // Not finished yet: kept as it was left.
      { attribute: 'height', op: 'atLeast' }
    ]
    saveStatsView(db, 'nba', 'Young', board({ filters }), 't1')
    saveStatsView(db, 'nba', 'Before filters', board(), 't1')
    const views = listStatsViews(db, 'nba')
    expect(views.find((v) => v.name === 'Young')?.board.filters).toEqual(filters)
    expect(views.find((v) => v.name === 'Before filters')?.board.filters).toBeUndefined()
  })

  it('refuses filters of another shape', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const bad: unknown[] = [
      [{ op: 'atLeast', value: 1 }],
      [{ attribute: 'age', metric: 'pts', op: 'atLeast', value: 1 }],
      [{ attribute: 'age', op: 'roughly', value: 1 }],
      [{ attribute: 'age', op: 'anyOf', value: [{}] }],
      Array.from({ length: 21 }, () => ({ attribute: 'age', op: 'hasValue' }))
    ]
    for (const filters of bad) {
      expect(() =>
        saveStatsView(
          db,
          'nba',
          'Bad',
          board({ filters: filters as LeaderboardBoard['filters'] }),
          't1'
        )
      ).toThrow(/invalid/)
    }
  })
})
