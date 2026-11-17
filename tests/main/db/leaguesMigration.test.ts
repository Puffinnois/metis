import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { migrations } from '@main/db/migrations'
import { getLeagueSetting, getSetting, setLeagueSetting, setSetting } from '@main/db/repos/settings'
import { deleteStatsView, listStatsViews, saveStatsView } from '@main/db/repos/statsViews'
import type { LeaderboardBoard } from '@shared/stats/types'

const board = (over: Partial<LeaderboardBoard> = {}): LeaderboardBoard => ({
  entity: 'player',
  tab: 'G',
  columns: ['pts', 'ast'],
  sort: { by: 'pts', dir: 'desc' },
  mode: 'perGame',
  qualifiedOnly: true,
  team: null,
  ...over
})

let dir: string | null = null
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = null
})

/** `metis.db` as 1.0 left it, on disk: the first two migrations, two saved views and the dev mode. */
function fixtureOf10(): { db: Db; path: string } {
  dir = mkdtempSync(join(tmpdir(), 'metis-db-'))
  const path = join(dir, 'metis.db')
  const db = openDatabase(path)
  expect(migrate(db, migrations.slice(0, 2))).toBe(2)
  const insert = db.prepare(
    'INSERT INTO stats_views (id, name, board_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
  insert.run(7, 'Scoring guards', JSON.stringify(board()), 't0', 't1')
  insert.run(9, 'Fast teams', JSON.stringify(board({ entity: 'team', tab: 'offense' })), 't0', 't2')
  setSetting(db, 'dev_mode', '1')
  return { db, path }
}

describe('metis.db keyed by league', () => {
  it('gives every view saved before leagues to the NBA, ids and all', () => {
    const { db, path } = fixtureOf10()
    db.close()
    const upgraded = openDatabase(path)
    expect(migrate(upgraded)).toBe(3)
    expect(listStatsViews(upgraded, 'nba')).toEqual([
      {
        id: 9,
        name: 'Fast teams',
        board: board({ entity: 'team', tab: 'offense' }),
        updatedAt: 't2'
      },
      { id: 7, name: 'Scoring guards', board: board(), updatedAt: 't1' }
    ])
    expect(listStatsViews(upgraded, 'wnba')).toEqual([])
    // App-wide settings stay app-wide.
    expect(getSetting(upgraded, 'dev_mode')).toBe('1')
    upgraded.close()
  })

  it('keeps each league’s views apart: a name per league, a delete within one', () => {
    const { db } = fixtureOf10()
    migrate(db)
    const wnba = saveStatsView(db, 'wnba', 'Scoring guards', board({ mode: 'per40' }), 't3')
    expect(listStatsViews(db, 'nba').map((v) => v.name)).toEqual(['Fast teams', 'Scoring guards'])
    expect(listStatsViews(db, 'wnba')).toEqual([
      { id: wnba.id, name: 'Scoring guards', board: board({ mode: 'per40' }), updatedAt: 't3' }
    ])
    // The same name in any case replaces within its league only.
    saveStatsView(db, 'nba', 'SCORING GUARDS', board({ mode: 'raw' }), 't4')
    expect(listStatsViews(db, 'nba').find((v) => v.id === 7)?.board.mode).toBe('raw')
    expect(listStatsViews(db, 'wnba')[0].board.mode).toBe('per40')
    // An NBA view's id deletes nothing from the WNBA's list.
    deleteStatsView(db, 'wnba', 7)
    expect(listStatsViews(db, 'nba')).toHaveLength(2)
    deleteStatsView(db, 'nba', 7)
    expect(listStatsViews(db, 'nba').map((v) => v.name)).toEqual(['Fast teams'])
  })

  it('stores a league’s own settings apart from the app’s', () => {
    const { db } = fixtureOf10()
    migrate(db)
    setLeagueSetting(db, 'nba', 'scope', '{"season":2026}')
    setLeagueSetting(db, 'wnba', 'scope', '{"season":2026}')
    setLeagueSetting(db, 'wnba', 'scope', '{"season":2025}')
    expect(getLeagueSetting(db, 'nba', 'scope')).toBe('{"season":2026}')
    expect(getLeagueSetting(db, 'wnba', 'scope')).toBe('{"season":2025}')
    expect(getLeagueSetting(db, 'wnba', 'nope')).toBeNull()
    expect(getSetting(db, 'scope')).toBeNull()
  })
})
