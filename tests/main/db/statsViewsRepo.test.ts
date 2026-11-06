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
    const guards = saveStatsView(db, '  Scoring guards ', board(), 't1')
    saveStatsView(
      db,
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
    expect(listStatsViews(db).map((v) => v.name)).toEqual(['Fast teams', 'Scoring guards'])
    deleteStatsView(db, guards.id)
    expect(listStatsViews(db).map((v) => v.name)).toEqual(['Fast teams'])
  })

  it('replaces a view of the same name, whatever its case', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const first = saveStatsView(db, 'Shooters', board(), 't1')
    const second = saveStatsView(db, 'shooters', board({ mode: 'per36' }), 't2')
    expect(second.id).toBe(first.id)
    expect(listStatsViews(db)).toEqual([
      { id: first.id, name: 'shooters', board: board({ mode: 'per36' }), updatedAt: 't2' }
    ])
  })

  it('rejects an empty or long name', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(() => saveStatsView(db, '  ', board(), 't')).toThrow('A view needs a name')
    expect(() => saveStatsView(db, 'x'.repeat(61), board(), 't')).toThrow('at most 60')
  })

  it('refuses a malformed board and skips a corrupt row', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const bad =
      (b: unknown): (() => unknown) =>
      () =>
        saveStatsView(db, 'x', b as LeaderboardBoard, 't')
    expect(bad(undefined)).toThrow('This view cannot be saved')
    expect(bad({ ...board(), entity: 'coach' })).toThrow('This view cannot be saved')
    expect(bad({ ...board(), columns: 'pts' })).toThrow('This view cannot be saved')
    expect(bad({ ...board(), columns: Array(41).fill('pts') })).toThrow('This view cannot be saved')
    expect(bad({ ...board(), sort: { by: 'pts', dir: 'up' } })).toThrow('This view cannot be saved')
    expect(bad({ ...board(), mode: 'perWeek' })).toThrow('This view cannot be saved')
    saveStatsView(db, 'Good', board(), 't')
    db.prepare(
      "INSERT INTO stats_views (name, board_json, created_at, updated_at) VALUES ('Broken', '{not json', 't', 't'), ('Odd', '{}', 't', 't')"
    ).run()
    expect(listStatsViews(db).map((v) => v.name)).toEqual(['Good'])
  })
})
