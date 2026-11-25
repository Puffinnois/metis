import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  buildPlays,
  insertSql,
  markPlaySeason,
  planPlays,
  PLAY_BUILDERS,
  playBuildersOf,
  playsDue,
  rebuildSet,
  signature,
  type PlayBuilder
} from '@main/stats/derived/playBuilders'
import { inspect } from '@main/stats/derived/sql'
import { bootstrapStatsDb } from '@main/stats/schema'
import { PLAY_TABLES } from '@main/stats/derived/plays'
import { openTestDb } from '../../../fixtures/stats'
import { createIdentity, createNbaPbp, GAME, HOU, OKC } from '../../../fixtures/plays'
import { LEAGUES } from '@shared/leagues'

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
    expect(await planPlays(db)).toMatchObject({ all: true, seasons: [2025, 2026], partial: [] })
  })

  it('none once built, until a file of a season writes rows', async () => {
    await buildPlays(db, LEAGUES.nba)
    expect(await playsDue(db)).toBe(false)
    expect(await planPlays(db)).toMatchObject({ all: false, seasons: [], partial: [] })
    await markPlaySeason(db, 2026)
    expect(await playsDue(db)).toBe(true)
    expect(await planPlays(db)).toMatchObject({ all: false, seasons: [2026], partial: [] })
  })

  it('every season after a file of every season, or a new version', async () => {
    await buildPlays(db, LEAGUES.nba)
    await markPlaySeason(db, 0)
    expect(await planPlays(db)).toMatchObject({ all: true, seasons: [2025, 2026] })
    await buildPlays(db, LEAGUES.nba)
    await db.exec("UPDATE derived_state SET version = 0 WHERE name = 'plays'")
    expect(await planPlays(db)).toMatchObject({ all: true, seasons: [2025, 2026], partial: [] })
  })

  it('leaves the other seasons as they are when one season’s files changed', async () => {
    await buildPlays(db, LEAGUES.nba)
    // A row only the earlier season holds: rebuilding 2026 must not touch it.
    await db.exec(
      `INSERT INTO ${PLAY_TABLES.nba} (game_id, season, seq) VALUES ('0022400001', 2025, 1)`
    )
    await markPlaySeason(db, 2026)
    const rows = await buildPlays(db, LEAGUES.nba)
    // The NBA's 26 plays and what the later builders made of them: the on-court tables' rows of the
    // season (one unit a team: the fixture has no lineup file, so no players), and the rest.
    const onCourt = await db.get<{ n: number }>(
      `SELECT (SELECT count(*) FROM unit_game WHERE season = 2026)
            + (SELECT count(*) FROM player_on_court WHERE season = 2026) AS n`
    )
    expect(Number(onCourt?.n)).toBe(2)
    let later = 0
    for (const b of PLAY_BUILDERS.slice(2)) {
      later +=
        (await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${b.table}`))?.n ?? 0
    }
    expect(rows).toBe(26 + later)
    expect(later).toBeGreaterThan(2)
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
    await buildPlays(db, LEAGUES.nba)
    await db.exec(`ALTER TABLE ${PLAY_TABLES.nba} DROP COLUMN possession`)
    await db.exec(`INSERT INTO ${PLAY_TABLES.nba} (game_id, season, seq) VALUES ('x', 1990, 1)`)
    // Every builder reads the play table, so all of them are rebuilt for every season, not only it.
    const plan = await planPlays(db)
    expect(plan.all).toBe(false)
    expect(plan.partial.map((b) => b.table)).toEqual(PLAY_BUILDERS.map((b) => b.table))
    await buildPlays(db, LEAGUES.nba)
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
    reads: [],
    select: (_, season) => `SELECT ${season} AS season, i AS n FROM range(${size.n}) t(i)`
  })

  it('keeps a season whole when its rebuild fails', async () => {
    const size = { n: 1000 }
    extra = sized(size)
    PLAY_BUILDERS.push(extra)
    await buildPlays(db, LEAGUES.nba)
    extra.select = (_, season) =>
      season === 2026 ? 'SELECT no_such_column FROM game' : `SELECT ${season}, 5`
    await markPlaySeason(db, 2026)
    await expect(buildPlays(db, LEAGUES.nba)).rejects.toThrow()
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
    await buildPlays(db, LEAGUES.nba)
    size.n = 200_000
    await markPlaySeason(db, 0)
    const reader = await db.connect()
    const seen = new Set<number>()
    let done = false
    const build = buildPlays(db, LEAGUES.nba).finally(() => {
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

describe('a builder rebuilt alone', () => {
  const added: PlayBuilder[] = []
  afterEach(() => {
    // One a test replaced by another is not in the list any more.
    for (const b of added.splice(0)) {
      if (PLAY_BUILDERS.includes(b)) PLAY_BUILDERS.splice(PLAY_BUILDERS.indexOf(b), 1)
    }
  })
  const add = (b: PlayBuilder): PlayBuilder => {
    added.push(b)
    PLAY_BUILDERS.push(b)
    return b
  }
  /** A builder of one row a season, named after its table, and what it reads. */
  const counting = (
    table: string,
    reads: string[],
    extra: Partial<PlayBuilder> = {}
  ): PlayBuilder => ({
    table,
    columns: [
      ['season', 'INTEGER'],
      ['n', 'BIGINT']
    ],
    reads,
    select: (_, season) => `SELECT ${season} AS season, 1::BIGINT AS n`,
    ...extra
  })
  /** A sentinel of a season no build would write, so a rewrite of the table shows. */
  const sentinel = (table: string, season = 2025): Promise<void> =>
    db.exec(`INSERT INTO ${table} (season) VALUES (${season})`)
  const sentinels = async (table: string): Promise<number> =>
    (
      await db.get<{ n: number }>(
        `SELECT count(*)::INTEGER AS n FROM ${table} WHERE season = 2025 AND game_id IS NULL`
      )
    )?.n ?? 0

  it('is built for every season when it is new, and the rest are not rewritten', async () => {
    await buildPlays(db, LEAGUES.nba)
    await sentinel('play_nba')
    await sentinel('split_team')
    const fresh = add(counting('new_counts', ['play_nba']))
    expect(await playsDue(db)).toBe(true)
    const plan = await planPlays(db)
    expect(plan).toMatchObject({ all: false, seasons: [] })
    expect(plan.partial).toEqual([fresh])
    await buildPlays(db, LEAGUES.nba)
    expect(await db.all('SELECT season, n FROM new_counts ORDER BY 1')).toEqual([
      { season: 2025, n: 1 },
      { season: 2026, n: 1 }
    ])
    // The other tables kept their rows, the sentinels among them: nothing was written over.
    expect(await sentinels('play_nba')).toBe(1)
    expect(await sentinels('split_team')).toBe(1)
    expect(await playsDue(db)).toBe(false)
  })

  it('is found though opening the file made its table, empty', async () => {
    await buildPlays(db, LEAGUES.nba)
    add(counting('new_counts', []))
    await db.exec('CREATE TABLE new_counts (season INTEGER, n BIGINT)')
    await bootstrapStatsDb(db, new Date(), LEAGUES.nba)
    expect(await playsDue(db)).toBe(true)
    expect((await planPlays(db)).partial.map((b) => b.table)).toEqual(['new_counts'])
  })

  it('takes the builders that read it, and those that read them, in build order', async () => {
    const a = add(counting('a_counts', []))
    const b = add(counting('b_counts', ['a_counts']))
    const c = add(counting('c_counts', ['b_counts']))
    const other = add(counting('other_counts', ['play_nba']))
    await buildPlays(db, LEAGUES.nba)
    await sentinel('other_counts')
    const reshaped: PlayBuilder = { ...a, columns: [...a.columns, ['more', 'BIGINT']] }
    reshaped.select = (_, season) => `SELECT ${season} AS season, 1::BIGINT AS n, 2::BIGINT AS more`
    PLAY_BUILDERS.splice(PLAY_BUILDERS.indexOf(a), 1, reshaped)
    added.push(reshaped)
    const plan = await planPlays(db)
    expect(plan.partial.map((x) => x.table)).toEqual(['a_counts', 'b_counts', 'c_counts'])
    await buildPlays(db, LEAGUES.nba)
    expect(await db.all('SELECT season, more FROM a_counts ORDER BY 1')).toEqual([
      { season: 2025, more: 2 },
      { season: 2026, more: 2 }
    ])
    expect(await db.all('SELECT count(*)::INTEGER AS n FROM other_counts')).toEqual([{ n: 3 }])
    expect([b, c, other].every((x) => PLAY_BUILDERS.includes(x))).toBe(true)
  })

  it('makes the intermediate it reads again, and leaves its other readers', async () => {
    const runs: string[] = []
    const logged = (b: PlayBuilder): PlayBuilder => {
      const inner = b.select
      b.select = (h, season, l) => {
        runs.push(`${b.table}:${season}`)
        return inner(h, season, l)
      }
      return b
    }
    const mid = add(logged(counting('mid', [], { intermediate: true })))
    add(logged(counting('reader_one', ['mid'])))
    await buildPlays(db, LEAGUES.nba)
    runs.length = 0
    add(logged(counting('reader_two', ['mid'])))
    const plan = await planPlays(db)
    expect(plan.partial.map((b) => b.table)).toEqual(['mid', 'reader_two'])
    await buildPlays(db, LEAGUES.nba)
    expect(runs.sort()).toEqual(['mid:2025', 'mid:2026', 'reader_two:2025', 'reader_two:2026'])
    expect(await db.get("SELECT 1 AS yes FROM duckdb_tables() WHERE table_name = 'mid'")).toBeNull()
    expect(mid.intermediate).toBe(true)
  })

  it('rebuilds the readers of an intermediate whose columns changed, though it is not in the file', async () => {
    const mid = add(counting('mid', [], { intermediate: true }))
    add(counting('reader', ['mid']))
    await buildPlays(db, LEAGUES.nba)
    expect(await playsDue(db)).toBe(false)
    const changed: PlayBuilder = { ...mid, columns: [...mid.columns, ['more', 'BIGINT']] }
    changed.select = (_, season) => `SELECT ${season} AS season, 1::BIGINT AS n, 2::BIGINT AS more`
    PLAY_BUILDERS.splice(PLAY_BUILDERS.indexOf(mid), 1, changed)
    added.push(changed)
    expect((await planPlays(db)).partial.map((b) => b.table)).toEqual(['mid', 'reader'])
  })

  it('is filled from another source by its origin, whatever its columns', async () => {
    const one = add(counting('source_counts', [], { origin: 'lineups' }))
    await buildPlays(db, LEAGUES.nba)
    expect(await playsDue(db)).toBe(false)
    const other = counting('source_counts', [], { origin: 'plays' })
    PLAY_BUILDERS.splice(PLAY_BUILDERS.indexOf(one), 1, other)
    added.push(other)
    expect((await planPlays(db)).partial.map((b) => b.table)).toEqual(['source_counts'])
  })

  it('runs every builder in a season that waits, and only the changed one in the others', async () => {
    await buildPlays(db, LEAGUES.nba)
    await sentinel('split_team')
    add(counting('new_counts', []))
    await markPlaySeason(db, 2026)
    const plan = await planPlays(db)
    expect(plan).toMatchObject({ all: false, seasons: [2026] })
    expect(plan.partial.map((b) => b.table)).toEqual(['new_counts'])
    await buildPlays(db, LEAGUES.nba)
    expect(await db.all('SELECT season FROM new_counts ORDER BY 1')).toEqual([
      { season: 2025 },
      { season: 2026 }
    ])
    expect(await sentinels('split_team')).toBe(1)
  })

  it('is done again when the app closed in the middle', async () => {
    await buildPlays(db, LEAGUES.nba)
    const fresh = add(counting('new_counts', []))
    const good = fresh.select
    fresh.select = (h, season, l) =>
      season === 2026 ? 'SELECT no_such_column FROM game' : good(h, season, l)
    await expect(buildPlays(db, LEAGUES.nba)).rejects.toThrow()
    // The table is there, half filled, and still not built.
    expect(
      await db.get("SELECT 1 AS yes FROM duckdb_tables() WHERE table_name = 'new_counts'")
    ).toEqual({
      yes: 1
    })
    expect(await playsDue(db)).toBe(true)
    fresh.select = good
    await buildPlays(db, LEAGUES.nba)
    expect(await db.all('SELECT season FROM new_counts ORDER BY 1')).toEqual([
      { season: 2025 },
      { season: 2026 }
    ])
    expect(await playsDue(db)).toBe(false)
  })

  it('finds a file from before the signatures built, and a newer builder in it not', async () => {
    await buildPlays(db, LEAGUES.nba)
    await db.exec("DELETE FROM derived_state WHERE name LIKE 'playtable:%'")
    expect(await playsDue(db)).toBe(false)
    add(counting('new_counts', []))
    // Its table made empty by opening the file, as the app does with some: still not built.
    await db.exec('CREATE TABLE new_counts (season INTEGER, n BIGINT)')
    expect((await planPlays(db)).partial.map((b) => b.table)).toEqual(['new_counts'])
    await db.exec(`ALTER TABLE split_team DROP COLUMN opp_pts`)
    expect((await planPlays(db)).partial.map((b) => b.table).sort()).toEqual([
      'new_counts',
      'split_team'
    ])
  })

  it('is built again when it left the list for a build and came back', async () => {
    const b = add(counting('new_counts', []))
    await buildPlays(db, LEAGUES.nba)
    PLAY_BUILDERS.splice(PLAY_BUILDERS.indexOf(b), 1)
    // The build without it may have replaced a season it has not seen.
    await markPlaySeason(db, 2026)
    await buildPlays(db, LEAGUES.nba)
    PLAY_BUILDERS.push(b)
    expect((await planPlays(db)).partial.map((x) => x.table)).toEqual(['new_counts'])
  })

  it('loses the seasons no longer played, and the tables left alone keep theirs', async () => {
    const one = add(counting('source_counts', [], { origin: 'lineups' }))
    await buildPlays(db, LEAGUES.nba)
    await sentinel('source_counts', 1990)
    await sentinel('split_team', 1990)
    const other = counting('source_counts', [], { origin: 'plays' })
    PLAY_BUILDERS.splice(PLAY_BUILDERS.indexOf(one), 1, other)
    added.push(other)
    await buildPlays(db, LEAGUES.nba)
    const of1990 = (t: string): Promise<unknown> =>
      db.get(`SELECT count(*)::INTEGER AS n FROM ${t} WHERE season = 1990`)
    expect(await of1990('source_counts')).toEqual({ n: 0 })
    expect(await of1990('split_team')).toEqual({ n: 1 })
    // A full rebuild drops them everywhere.
    await db.exec("UPDATE derived_state SET version = 0 WHERE name = 'plays'")
    await buildPlays(db, LEAGUES.nba)
    expect(await of1990('split_team')).toEqual({ n: 0 })
  })

  it('rebuilds every builder of every season after a new recipe version, and only then', async () => {
    await buildPlays(db, LEAGUES.nba)
    await sentinel('split_team')
    await db.exec("UPDATE derived_state SET version = 0 WHERE name = 'plays'")
    expect(await planPlays(db)).toMatchObject({ all: true, partial: [] })
    await buildPlays(db, LEAGUES.nba)
    expect(await sentinels('split_team')).toBe(0)
  })

  it('never reaches a table nothing it reads has changed', () => {
    const b = playBuildersOf(LEAGUES.ncaam)
    const named = (t: string): PlayBuilder => b.find((x) => x.table === t)!
    const set = (...t: string[]): string[] => rebuildSet(b, t.map(named)).map((x) => x.table)
    // A play-derived table is alone; the play table takes everything that reads it, its units with it.
    expect(set('play_team_game')).toEqual(['play_team_game'])
    expect(set('shot_key')).toEqual(['shot_key', 'shot_player_game', 'shot_team_game'])
    // The ten at each play are made again for the splits, not the other way round.
    expect(set('split_team')).toEqual(['play_lineup', 'split_team'])
    expect(set('unit_game')).toEqual(['play_lineup', 'unit_game', 'player_on_court', 'pub_lineups'])
    expect(set('unit_game_lineups')).toEqual(['unit_game_lineups', 'player_on_court_lineups'])
    const plays = set('play_nba')
    expect(plays).toContain('split_player')
    expect(plays).not.toContain('shot_key')
    expect(plays).not.toContain('unit_game_lineups')
    expect(plays).not.toContain('shot_player_game')
  })
})

describe('what each builder reads', () => {
  it.each(['nba', 'wnba', 'ncaam', 'ncaaw'] as const)(
    'is declared on it, all of it and nothing more: %s',
    async (id) => {
      const league = LEAGUES[id]
      // Every table the sources and the identity can have, with every column the builders name.
      const all = await inspect(db)
      const have = { tables: new Set(all.tables), columns: new Map(all.columns) }
      for (const t of [
        'src_nba_pbp',
        'src_wnba_pbp',
        'src_ncaa_pbp',
        'src_ncaa_lineups',
        'src_ncaa_shots',
        'src_ncaa_possessions',
        'src_ncaa_matchup_stints',
        'src_nba_game_lineups',
        'src_nba_possessions',
        'src_nba_shots',
        'src_wnba_shots',
        'src_wnba_game_lineups',
        'src_wnba_possessions',
        'src_espn_pbp',
        'player_ids',
        'ncaa_player_ids',
        'src_ncaa_team_ids',
        'team',
        'player_game',
        'game',
        'ncaa_side',
        'player'
      ])
        have.tables.add(t)
      const builders = playBuildersOf(league)
      const names = builders.map((b) => b.table)
      for (const [i, b] of builders.entries()) {
        const sql = b.select(have as never, 2026, league)
        const named = names.filter(
          (t) => t !== b.table && new RegExp(`(?<![A-Za-z0-9_])${t}(?![A-Za-z0-9_])`).test(sql)
        )
        const declared = b.reads.filter((t) => names.includes(t))
        // All it names is declared; and it is declared no more than the league's builders fill, in order.
        for (const t of named) expect(declared, `${b.table} reads ${t}`).toContain(t)
        for (const t of declared) expect(names.indexOf(t), `${b.table} after ${t}`).toBeLessThan(i)
      }
      // Nothing is declared that no league reads.
      const everywhere = new Set(
        (['nba', 'wnba', 'ncaam', 'ncaaw'] as const).flatMap((l) =>
          playBuildersOf(LEAGUES[l]).map((b) => b.table)
        )
      )
      for (const b of builders) for (const t of b.reads) expect(everywhere.has(t)).toBe(true)
    }
  )

  it('is in its signature: a column or its source changes it, its SELECT or order does not', () => {
    const b = PLAY_BUILDERS[0]
    expect(signature(b)).toBe(signature({ ...b, order: 'x' }))
    expect(signature(b)).not.toBe(signature({ ...b, origin: 'plays' }))
    expect(signature(b)).not.toBe(signature({ ...b, columns: [...b.columns, ['x', 'INTEGER']] }))
  })
})

describe('the order rows are written in', () => {
  it('sorts a season by the builder’s order, and leaves a builder without one as selected', () => {
    const have = { tables: new Set<string>(), columns: new Map() }
    const sorted: PlayBuilder = {
      table: 't',
      columns: [['season', 'INTEGER']],
      select: (_h, s) => `SELECT ${s} AS season`,
      reads: [],
      order: 'game_id, seq'
    }
    expect(insertSql(sorted, have, 2026, LEAGUES.nba)).toBe(
      'INSERT INTO t SELECT * FROM (SELECT 2026 AS season) AS s(season) ORDER BY game_id, seq'
    )
    expect(insertSql({ ...sorted, order: undefined }, have, 2026, LEAGUES.nba)).toBe(
      'INSERT INTO t SELECT 2026 AS season'
    )
  })

  it('writes every play table in game order', async () => {
    await buildPlays(db, LEAGUES.nba)
    const rows = await db.all<{ game_id: string; seq: number }>(
      `SELECT game_id, seq FROM ${PLAY_TABLES.nba}`
    )
    const sorted = [...rows].sort((a, b) =>
      a.game_id === b.game_id ? a.seq - b.seq : a.game_id < b.game_id ? -1 : 1
    )
    expect(rows.length).toBeGreaterThan(10)
    expect(rows).toEqual(sorted)
    for (const b of PLAY_BUILDERS) expect(b.order, b.table).toMatch(/^game_id\b/)
  })
})

describe('the game the fixtures play', () => {
  it('is the one the plays are keyed to', async () => {
    await buildPlays(db, LEAGUES.nba)
    expect(await db.get(`SELECT DISTINCT game_id FROM ${PLAY_TABLES.nba}`)).toEqual({
      game_id: GAME
    })
  })
})
