import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  buildPlays,
  markPlaySeason,
  PLAY_BUILDERS,
  playsDue,
  seasonsToBuild,
  type PlayBuilder
} from '@main/stats/derived/playBuilders'
import { PLAY_TABLES } from '@main/stats/derived/plays'
import { openTestDb } from '../../../fixtures/stats'
import { createIdentity, createNbaPbp, GAME, HOU, OKC } from '../../../fixtures/plays'

let db: StatsDb

/** A second game a season earlier, so there are two seasons to choose from. */
async function addEarlierSeason(): Promise<void> {
  await db.exec(`INSERT INTO game VALUES ('0022400001', '0022400001', NULL, 2025, 'regular',
    DATE '2024-10-22', ${OKC}, ${HOU}, 0, 0, true, 'nba')`)
}

beforeEach(async () => {
  db = await openTestDb()
  await createIdentity(db)
  await addEarlierSeason()
  await createNbaPbp(db)
})

describe('which seasons are rebuilt', () => {
  it('every season played, on a database never built', async () => {
    expect(await seasonsToBuild(db)).toEqual({ all: true, seasons: [2025, 2026] })
  })

  it('none once built, until a file of a season writes rows', async () => {
    await buildPlays(db)
    expect(await playsDue(db)).toBe(false)
    expect(await seasonsToBuild(db)).toEqual({ all: false, seasons: [] })
    await markPlaySeason(db, 2026)
    expect(await playsDue(db)).toBe(true)
    expect(await seasonsToBuild(db)).toEqual({ all: false, seasons: [2026] })
  })

  it('every season after a file of every season, or a new version', async () => {
    await buildPlays(db)
    await markPlaySeason(db, 0)
    expect(await seasonsToBuild(db)).toEqual({ all: true, seasons: [2025, 2026] })
    await buildPlays(db)
    await db.exec("UPDATE derived_state SET version = 0 WHERE name = 'plays'")
    expect(await seasonsToBuild(db)).toEqual({ all: true, seasons: [2025, 2026] })
  })

  it('leaves the other seasons as they are when one season’s files changed', async () => {
    await buildPlays(db)
    // A row only the earlier season holds: rebuilding 2026 must not touch it.
    await db.exec(
      `INSERT INTO ${PLAY_TABLES.nba} (game_id, season, seq) VALUES ('0022400001', 2025, 1)`
    )
    await markPlaySeason(db, 2026)
    const rows = await buildPlays(db)
    // The play rows, and what the later builders made of them.
    let later = 0
    for (const b of PLAY_BUILDERS.slice(2)) {
      later +=
        (await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${b.table}`))?.n ?? 0
    }
    expect(rows).toBe(26 + later)
    expect(later).toBeGreaterThan(0)
    expect(
      await db.all(
        `SELECT season, count(*)::INTEGER AS n FROM ${PLAY_TABLES.nba} GROUP BY 1 ORDER BY 1`
      )
    ).toEqual([
      { season: 2025, n: 1 },
      { season: 2026, n: 26 }
    ])
    expect(await playsDue(db)).toBe(false)
  })

  it('rebuilds a table whose columns changed, and drops seasons no longer played', async () => {
    await buildPlays(db)
    await db.exec(`ALTER TABLE ${PLAY_TABLES.nba} DROP COLUMN possession`)
    await db.exec(`INSERT INTO ${PLAY_TABLES.nba} (game_id, season, seq) VALUES ('x', 1990, 1)`)
    expect((await seasonsToBuild(db)).all).toBe(true)
    await buildPlays(db)
    expect(await db.all(`SELECT DISTINCT season FROM ${PLAY_TABLES.nba} ORDER BY 1`)).toEqual([
      { season: 2026 }
    ])
    expect(
      await db.get(
        `SELECT count(*)::INTEGER AS n FROM duckdb_columns() WHERE table_name = '${PLAY_TABLES.nba}'
         AND column_name = 'possession'`
      )
    ).toEqual({ n: 1 })
  })
})

describe('a reader during a rebuild', () => {
  let extra: PlayBuilder | null = null
  afterEach(() => {
    if (extra) PLAY_BUILDERS.splice(PLAY_BUILDERS.indexOf(extra), 1)
    extra = null
  })

  /** A builder of many rows a season, as many as `size` says when it runs. */
  const sized = (size: { n: number }): PlayBuilder => ({
    table: 'test_counts',
    columns: [
      ['season', 'INTEGER'],
      ['n', 'BIGINT']
    ],
    select: (_, season) => `SELECT ${season} AS season, i AS n FROM range(${size.n}) t(i)`
  })

  it('keeps a season whole when its rebuild fails', async () => {
    const size = { n: 1000 }
    extra = sized(size)
    PLAY_BUILDERS.push(extra)
    await buildPlays(db)
    extra.select = (_, season) =>
      season === 2026 ? 'SELECT no_such_column FROM game' : `SELECT ${season}, 5`
    await markPlaySeason(db, 2026)
    await expect(buildPlays(db)).rejects.toThrow()
    expect(
      await db.all('SELECT season, count(*)::INTEGER AS n FROM test_counts GROUP BY 1 ORDER BY 1')
    ).toEqual([
      { season: 2025, n: 1000 },
      { season: 2026, n: 1000 }
    ])
    // The season stays due, so the next refresh tries it again.
    expect(await playsDue(db)).toBe(true)
  })

  it('sees each season old or new, never half', async () => {
    const size = { n: 50_000 }
    extra = sized(size)
    PLAY_BUILDERS.push(extra)
    await buildPlays(db)
    size.n = 200_000
    await markPlaySeason(db, 0)
    const reader = await db.connect()
    const seen = new Set<number>()
    let done = false
    const build = buildPlays(db).finally(() => {
      done = true
    })
    while (!done) {
      const rows = await reader.all<{ n: number }>(
        'SELECT count(*)::INTEGER AS n FROM test_counts WHERE season = 2025'
      )
      seen.add(rows[0].n)
    }
    await build
    seen.add(
      (await reader.get<{ n: number }>(
        'SELECT count(*)::INTEGER AS n FROM test_counts WHERE season = 2025'
      ))!.n
    )
    expect([...seen].every((n) => n === 50_000 || n === 200_000)).toBe(true)
    expect(seen.has(200_000)).toBe(true)
    await reader.close()
  })
})

describe('the game the fixtures play', () => {
  it('is the one the plays are keyed to', async () => {
    await buildPlays(db)
    expect(await db.get(`SELECT DISTINCT game_id FROM ${PLAY_TABLES.nba}`)).toEqual({
      game_id: GAME
    })
  })
})
