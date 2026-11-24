import { copyFileSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { DARKO_IMPORTS, DARKO_TABLE, importDarko, readDarkoImports } from '@main/stats/darkoImport'
import { darkoDpmSql, DARKO_DPM_TABLE, DARKO_NOT_LOADED } from '@main/stats/derived/darko'
import { publishedTable } from '@main/stats/derived/published'
import { inspect } from '@main/stats/derived/sql'
import { darkoFolderFor, readPrivateSources } from '@main/stats/privateSources'
import { readRatingHistory } from '@main/stats/ratingReads'
import { SOURCES_BY_LEAGUE } from '@main/stats/sources'
import { LEAGUE_IDS, LEAGUES } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'

/**
 * DARKO imported by hand (D55), on boards written in the shape darko.app gives them, of made-up
 * players: two dated boards, a history of many dates in one file, the same bytes under a second name,
 * a board whose date clashes with another's, and a file that is not a board.
 */
const FIXTURES = join(__dirname, '../../fixtures/darko')
const NOW = new Date('2026-11-24T12:00:00Z')

let db: StatsDb
let folder: string

beforeEach(async () => {
  db = await openTestDb()
  folder = mkdtempSync(join(tmpdir(), 'metis-darko-'))
})
afterEach(async () => {
  await db.close()
  rmSync(folder, { recursive: true, force: true })
})

const put = (fixture: string, name: string, modified?: string): void => {
  copyFileSync(join(FIXTURES, fixture), join(folder, name))
  if (modified) utimesSync(join(folder, name), new Date(modified), new Date(modified))
}

describe('the private setting (D55)', () => {
  it('is off with no file, a file that does not parse, or another league, and names a folder otherwise', () => {
    const data = mkdtempSync(join(tmpdir(), 'metis-data-'))
    expect(readPrivateSources(data).darko).toBeNull()
    expect(darkoFolderFor('nba', data)).toBeNull()
    writeFileSync(join(data, 'private-sources.json'), '{ not json')
    expect(darkoFolderFor('nba', data)).toBeNull()
    writeFileSync(join(data, 'private-sources.json'), JSON.stringify({ darko: 'imports/darko' }))
    expect(darkoFolderFor('nba', data)).toBe(join(data, 'imports/darko'))
    expect(readPrivateSources(data).darko?.written).toBe('imports/darko')
    for (const id of LEAGUE_IDS.filter((l) => l !== 'nba'))
      expect(darkoFolderFor(id, data)).toBeNull()
    rmSync(data, { recursive: true, force: true })
  })

  it('puts no darko.app address and no path among any league’s sources', () => {
    for (const id of LEAGUE_IDS) {
      for (const s of SOURCES_BY_LEAGUE[id]) {
        expect(`${s.url ?? ''} ${s.release} ${s.table}`, s.id).not.toMatch(/darko\.app|darko/i)
      }
    }
  })
})

describe('importing the boards', () => {
  it('keeps every column of every board as a snapshot dated by its column, its name or its modified time', async () => {
    put('board-a.csv', 'darko-2026-11-20.csv')
    put('board-b.csv', 'board.csv', '2026-11-22T15:00:00')
    put('history.csv', 'lebron-history.csv')
    const out = await importDarko(db, folder, NOW)
    expect(out.rows).toBe(2 + 2 + 3)
    const files = Object.fromEntries(out.files.map((f) => [f.file, f]))
    expect(files['darko-2026-11-20.csv']).toMatchObject({
      status: 'imported',
      date: '2026-11-20',
      dateFrom: 'name',
      dates: 1,
      rows: 2
    })
    expect(files['board.csv']).toMatchObject({ date: '2026-11-22', dateFrom: 'modified', rows: 2 })
    expect(files['lebron-history.csv']).toMatchObject({
      date: '2025-10-22',
      lastDate: '2026-04-12',
      dateFrom: 'column',
      dates: 3,
      rows: 3
    })
    const cols = await db.all<{ column_name: string }>(
      `SELECT column_name FROM duckdb_columns() WHERE table_name = '${DARKO_TABLE}'`
    )
    expect(cols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining([
        'nba_id',
        'dpm',
        'market_as_of',
        'x_ft_pct',
        'snapshot_date',
        'source_file'
      ])
    )
  })

  it('reads nothing new twice, counts the same bytes once, and refuses a date it cannot tell apart', async () => {
    put('board-a.csv', 'darko-2026-11-20.csv')
    await importDarko(db, folder, NOW)
    expect((await importDarko(db, folder, NOW)).rows).toBe(0)
    put('board-a.csv', 'copy of board.csv')
    put('board-b.csv', 'other-2026-11-20.csv')
    writeFileSync(join(folder, 'notes.csv'), 'a,b\n1,2\n')
    const out = await importDarko(db, folder, NOW)
    expect(out.rows).toBe(0)
    const files = Object.fromEntries(out.files.map((f) => [f.file, f]))
    expect(files['copy of board.csv']).toMatchObject({ status: 'same' })
    expect(files['copy of board.csv'].reason).toMatch(/same file as darko-2026-11-20\.csv/)
    expect(files['other-2026-11-20.csv']).toMatchObject({ status: 'refused', date: '2026-11-20' })
    expect(files['other-2026-11-20.csv'].reason).toMatch(/already holds/)
    expect(files['notes.csv'].reason).toMatch(/No nba_id column/)
    // The refused board's rows were never written.
    const n = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${DARKO_TABLE}`)
    expect(n?.n).toBe(2)
    // Once the owner removes them, the refusals are no longer listed; the import stays.
    rmSync(join(folder, 'other-2026-11-20.csv'))
    rmSync(join(folder, 'notes.csv'))
    await importDarko(db, folder, NOW)
    expect((await readDarkoImports(db)).map((f) => f.file).sort()).toEqual([
      'copy of board.csv',
      'darko-2026-11-20.csv'
    ])
    const kept = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${DARKO_IMPORTS}`)
    expect(kept?.n).toBe(2)
  })

  it('keeps the name that carries a date when the same bytes lie under two names', async () => {
    // "board copy.csv" sorts first by name, and its modified time is today, not the board's day.
    put('board-a.csv', 'board copy.csv')
    put('board-a.csv', 'darko-2026-11-20.csv')
    const out = await importDarko(db, folder, NOW)
    const files = Object.fromEntries(out.files.map((f) => [f.file, f]))
    expect(files['darko-2026-11-20.csv']).toMatchObject({ status: 'imported', date: '2026-11-20' })
    expect(files['board copy.csv']).toMatchObject({ status: 'same' })
  })
})

describe('DARKO’s metrics and history', () => {
  it('reads the season’s latest board, and every board as a snapshot series', async () => {
    put('board-a.csv', 'darko-2026-11-20.csv')
    put('board-b.csv', 'darko-2026-11-22.csv')
    put('history.csv', 'history.csv')
    await importDarko(db, folder, NOW)
    await db.exec(darkoDpmSql(await inspect(db)))
    const rows = await db.all<Record<string, number | string>>(
      `SELECT player_id, season, dk_dpm, dk_o_dpm, dk_x_pts_100, strftime(snapshot_date, '%Y-%m-%d') AS day
       FROM ${DARKO_DPM_TABLE} ORDER BY player_id, season`
    )
    expect(rows).toEqual([
      // 2025-26 from the history's last date, 2026-27 from the later board.
      {
        player_id: 1,
        season: 2026,
        dk_dpm: 3.9,
        dk_o_dpm: 2.8,
        dk_x_pts_100: null,
        day: '2026-04-12'
      },
      {
        player_id: 1,
        season: 2027,
        dk_dpm: 4.8,
        dk_o_dpm: 3.2,
        dk_x_pts_100: 30.5,
        day: '2026-11-22'
      },
      {
        player_id: 2,
        season: 2027,
        dk_dpm: -1.2,
        dk_o_dpm: -1.6,
        dk_x_pts_100: 17.8,
        day: '2026-11-22'
      }
    ])
    const history = await readRatingHistory(db, '1', LEAGUES.nba)
    const darko = history.series.find((s) => s.id === 'darko_dpm')
    expect(darko).toMatchObject({ maker: 'Kostya Medvedovsky (DARKO)', grain: 'snapshot' })
    expect(darko?.points.map((p) => [p.date, p.season, p.total])).toEqual([
      ['2025-10-22', 2026, 2.0],
      ['2025-10-24', 2026, 2.2],
      ['2026-04-12', 2026, 3.9],
      ['2026-11-20', 2027, 4.5],
      ['2026-11-22', 2027, 4.8]
    ])
  })

  it('says "Not loaded on this copy" where nothing was ever imported', () => {
    expect(publishedTable(DARKO_DPM_TABLE)?.privateReason).toBe(DARKO_NOT_LOADED)
    expect(DARKO_NOT_LOADED).toMatch(/^Not loaded on this copy/)
  })
})
