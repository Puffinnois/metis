import { describe as group, expect, it } from 'vitest'
import { describe, loadSourceFile, replaceRows, standardSelect, widerType } from '@main/stats/load'
import { SOURCES, type SourceFile } from '@main/stats/sources'
import { openTestDb, tempDir, writeFixture } from '../../fixtures/stats'

const sourceOf = (id: string): SourceFile => {
  const source = SOURCES.find((s) => s.id === id)
  if (!source) throw new Error(`no source ${id}`)
  return source
}

group('standardSelect', () => {
  const have = new Map([
    ['season', 'VARCHAR'],
    ['name', 'VARCHAR']
  ])

  it('replaces columns the file has and adds the others', () => {
    expect(standardSelect('t', have, { season: 'season::INTEGER', source_file: "'a'" })).toBe(
      `SELECT * REPLACE (season::INTEGER AS "season"), 'a' AS "source_file" FROM t`
    )
  })

  it('selects everything as published when nothing is standardised', () => {
    expect(standardSelect('t', have, {})).toBe('SELECT * FROM t')
  })
})

group('widerType', () => {
  it('keeps numbers numeric and falls back to text', () => {
    expect(widerType('INTEGER', 'DOUBLE')).toBe('DOUBLE')
    expect(widerType('INTEGER', 'BIGINT')).toBe('BIGINT')
    expect(widerType('BIGINT', 'DECIMAL(18,3)')).toBe('DOUBLE')
    expect(widerType('INTEGER', 'VARCHAR')).toBe('VARCHAR')
    expect(widerType('BOOLEAN', 'INTEGER')).toBe('VARCHAR')
    expect(widerType('DATE', 'VARCHAR')).toBe('VARCHAR')
  })
})

group('replaceRows', () => {
  const row = (fileSeason: number, x: number | string): string =>
    `SELECT ${fileSeason} AS file_season, ${typeof x === 'string' ? `'${x}'` : x} AS x`

  it('replaces one file and keeps the others', async () => {
    const db = await openTestDb()
    await replaceRows(db, 'src_t', { fileSeason: 2024 }, row(2024, 1))
    await replaceRows(db, 'src_t', { fileSeason: 2025 }, row(2025, 3))
    const out = await replaceRows(db, 'src_t', { fileSeason: 2024 }, row(2024, 9))
    expect(out.rows).toBe(1)
    expect(await db.all('SELECT file_season, x FROM src_t ORDER BY file_season')).toEqual([
      { file_season: 2024, x: 9 },
      { file_season: 2025, x: 3 }
    ])
  })

  it('replaces only its own file in a shared table', async () => {
    const db = await openTestDb()
    const shared = (file: string, x: number): string =>
      `SELECT 2026 AS file_season, '${file}' AS source_file, ${x} AS x`
    await replaceRows(db, 'src_t', { fileSeason: 2026, sourceFile: 'a' }, shared('a', 1))
    await replaceRows(db, 'src_t', { fileSeason: 2026, sourceFile: 'b' }, shared('b', 2))
    await replaceRows(db, 'src_t', { fileSeason: 2026, sourceFile: 'a' }, shared('a', 7))
    expect(await db.all('SELECT source_file, x FROM src_t ORDER BY source_file')).toEqual([
      { source_file: 'a', x: 7 },
      { source_file: 'b', x: 2 }
    ])
  })

  it('adds new columns and widens a column whose type changed', async () => {
    const db = await openTestDb()
    await replaceRows(
      db,
      'src_t',
      { fileSeason: 2024 },
      'SELECT 2024 AS file_season, 1::INTEGER AS x'
    )
    const out = await replaceRows(
      db,
      'src_t',
      { fileSeason: 2025 },
      "SELECT 2025 AS file_season, 1.5::DOUBLE AS x, 'new' AS y"
    )
    expect(out.widened).toEqual(['x INTEGER → DOUBLE'])
    expect(await db.all('SELECT file_season, x, y FROM src_t ORDER BY file_season')).toEqual([
      { file_season: 2024, x: 1, y: null },
      { file_season: 2025, x: 1.5, y: 'new' }
    ])
  })

  it('fits narrower types, whichever season loads first', async () => {
    const db = await openTestDb()
    await replaceRows(db, 'src_t', { fileSeason: 2026 }, row(2026, 'text'))
    const out = await replaceRows(db, 'src_t', { fileSeason: 2025 }, row(2025, 5))
    expect(out.widened).toEqual([])
    expect(await db.all('SELECT x FROM src_t ORDER BY file_season')).toEqual([
      { x: '5' },
      { x: 'text' }
    ])
  })

  it('lets an all-NULL column fit an existing one', async () => {
    const db = await openTestDb()
    await replaceRows(db, 'src_t', { fileSeason: 2024 }, "SELECT 2024 AS file_season, 'G' AS pos")
    const out = await replaceRows(
      db,
      'src_t',
      { fileSeason: 2025 },
      'SELECT 2025 AS file_season, NULL AS pos'
    )
    expect(out.widened).toEqual([])
    expect((await describe(db, 'SELECT * FROM src_t')).get('pos')).toBe('VARCHAR')
  })

  it('replaces every row when the file holds the whole table', async () => {
    const db = await openTestDb()
    await replaceRows(db, 'src_t', { fileSeason: null }, 'SELECT 1 AS season UNION ALL SELECT 2')
    await replaceRows(db, 'src_t', { fileSeason: null }, 'SELECT 3 AS season')
    expect(await db.all('SELECT season FROM src_t')).toEqual([{ season: 3 }])
  })

  it('keeps the old rows when the load fails', async () => {
    const db = await openTestDb()
    await replaceRows(db, 'src_t', { fileSeason: 2024 }, row(2024, 1))
    await expect(
      replaceRows(
        db,
        'src_t',
        { fileSeason: 2024 },
        "SELECT 2024 AS file_season, error('boom')::INTEGER AS x"
      )
    ).rejects.toThrow('boom')
    expect(await db.all('SELECT x FROM src_t')).toEqual([{ x: 1 }])
  })
})

/** One fixture per file shape the releases publish, with columns as read from the real files. */
group('loadSourceFile', () => {
  it('keeps every column of a season file and makes its season an INTEGER', async () => {
    const db = await openTestDb()
    const file = await writeFixture(
      db,
      tempDir(),
      'player_boxscores_2026.parquet',
      `SELECT '0022500001' AS game_id, 2026::BIGINT AS season, '2' AS season_type_id,
              1627759::BIGINT AS person_id, 'BOS' AS team_tricode, '34:12' AS minutes, 0 AS steals`
    )
    const out = await loadSourceFile(db, sourceOf('nba_player_box'), 2026, file)
    expect(out).toEqual({ rows: 1, notes: [] })
    expect(await db.get('SELECT * FROM src_nba_player_box')).toEqual({
      game_id: '0022500001',
      season: 2026,
      season_type_id: '2',
      person_id: 1627759,
      team_tricode: 'BOS',
      minutes: '34:12',
      steals: 0,
      file_season: 2026
    })
    expect((await describe(db, 'SELECT * FROM src_nba_player_box')).get('season')).toBe('INTEGER')
  })

  it('gives a file without a season column its label', async () => {
    const db = await openTestDb()
    const file = await writeFixture(db, tempDir(), 'x.parquet', "SELECT 'g' AS game_id, 1 AS x")
    await loadSourceFile(db, sourceOf('nba_possessions'), 2003, file)
    expect(await db.get('SELECT season, file_season, game_id FROM src_nba_possessions')).toEqual({
      season: 2003,
      file_season: 2003,
      game_id: 'g'
    })
  })

  it('keeps a season the file marks differently from its label, and says so', async () => {
    const db = await openTestDb()
    const dir = tempDir()
    const source = sourceOf('espn_team_box')
    // ESPN's 2000 file holds games of 1998-99, rightly marked 1999.
    const select = (x: number): string =>
      `SELECT * FROM (VALUES (1999, ${x}), (2000, ${x})) AS t(season, x)`
    const first = await writeFixture(db, dir, 'a.parquet', select(1))
    const out = await loadSourceFile(db, source, 2000, first)
    expect(out.notes).toEqual(["season differs from the file's label on 1 rows"])
    expect(
      await db.all('SELECT season, file_season FROM src_espn_team_box ORDER BY season')
    ).toEqual([
      { season: 1999, file_season: 2000 },
      { season: 2000, file_season: 2000 }
    ])
    // A reload replaces the whole file, including the rows marked with another season.
    const again = await writeFixture(db, dir, 'b.parquet', select(2))
    expect((await loadSourceFile(db, source, 2000, again)).rows).toBe(2)
    expect(await db.all('SELECT x FROM src_espn_team_box')).toEqual([{ x: 2 }, { x: 2 }])
  })

  it('keeps a file of all seasons as published and replaces it whole', async () => {
    const db = await openTestDb()
    const dir = tempDir()
    const select = (n: number): string =>
      `SELECT range AS game_id, 2000 + range AS season, 'NYK' AS home_abbreviation FROM range(${n})`
    const source = sourceOf('espn_schedule_master')
    await loadSourceFile(db, source, 0, await writeFixture(db, dir, 'a.parquet', select(3)))
    const out = await loadSourceFile(
      db,
      source,
      0,
      await writeFixture(db, dir, 'b.parquet', select(2))
    )
    expect(out.rows).toBe(2)
    expect(await db.get('SELECT min(season) AS first FROM src_espn_schedule_master')).toEqual({
      first: 2000
    })
  })

  it('marks the rows of a shared table with their file and keeps the files apart', async () => {
    const db = await openTestDb()
    const dir = tempDir()
    const totals = sourceOf('nba_hustle_player/regular-season_totals')
    const perGame = sourceOf('nba_hustle_player/regular-season_pergame')
    const row = (deflections: number): string =>
      `SELECT 203507::BIGINT AS player_id, 2026::BIGINT AS season, 'regular-season' AS season_type,
              ${deflections} AS deflections`
    await loadSourceFile(db, totals, 2026, await writeFixture(db, dir, 't.parquet', row(100)))
    await loadSourceFile(db, perGame, 2026, await writeFixture(db, dir, 'p.parquet', row(2)))
    await loadSourceFile(db, totals, 2026, await writeFixture(db, dir, 't2.parquet', row(120)))
    expect(
      await db.all(
        'SELECT source_file, deflections FROM src_nba_hustle_player ORDER BY deflections'
      )
    ).toEqual([
      { source_file: 'leaguehustlestatsplayer_regular-season_pergame', deflections: 2 },
      { source_file: 'leaguehustlestatsplayer_regular-season_totals', deflections: 120 }
    ])
  })

  it('leaves season types and team codes as published', async () => {
    const db = await openTestDb()
    const file = await writeFixture(
      db,
      tempDir(),
      'team_box_2026.parquet',
      "SELECT 401 AS game_id, 2026 AS season, 2 AS season_type, 'GS' AS team_abbreviation"
    )
    await loadSourceFile(db, sourceOf('espn_team_box'), 2026, file)
    expect(await db.get('SELECT season_type, team_abbreviation FROM src_espn_team_box')).toEqual({
      season_type: 2,
      team_abbreviation: 'GS'
    })
  })
})
