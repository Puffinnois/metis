import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { gameMatchupsSql } from '@main/stats/derived/gameMatchups'
import { inspect } from '@main/stats/derived/sql'
import { grainsOf } from '@main/stats/engine/registry'
import { runQuery } from '@main/stats/engine/run'
import { readGameMatchups } from '@main/stats/matchupReads'
import { readMatchups } from '@main/stats/reads'
import { METRICS } from '@shared/stats/catalogue'
import type { StatsQuery, StatsResult, StatsRow } from '@shared/stats/types'
import { addGame, addNbaLine, BOS, emptySources, LAL } from '../../fixtures/boxScores'
import { openTestDb } from '../../fixtures/stats'

const CTX = { currentSeason: 2027 }
let db: StatsDb

/** The game file's columns, as published, minus whatever a test leaves out. */
const COLUMNS: [string, string][] = [
  ['game_id', 'VARCHAR'],
  ['off_team_id', 'BIGINT'],
  ['def_team_id', 'BIGINT'],
  ['off_person_id', 'BIGINT'],
  ['def_person_id', 'BIGINT'],
  ['off_position', 'VARCHAR'],
  ['matchup_minutes', 'VARCHAR'],
  ['matchup_minutes_sort', 'DOUBLE'],
  ['partial_possessions', 'DOUBLE'],
  ['player_points', 'BIGINT'],
  ['team_points', 'BIGINT'],
  ['matchup_field_goals_made', 'BIGINT'],
  ['matchup_field_goals_attempted', 'BIGINT'],
  ['matchup_three_pointers_made', 'BIGINT'],
  ['matchup_three_pointers_attempted', 'BIGINT'],
  ['matchup_free_throws_made', 'BIGINT'],
  ['matchup_free_throws_attempted', 'BIGINT'],
  ['matchup_assists', 'BIGINT'],
  ['matchup_turnovers', 'BIGINT'],
  ['matchup_blocks', 'BIGINT'],
  ['shooting_fouls', 'BIGINT']
]

/** A pair in a game: who, the two clocks, then possessions, points and makes of attempts. */
type Pair = [string, number, number, string, number | null, number, number, number, number]

/**
 * Player 1 (Boston) guards player 2 (Los Angeles) in games a, b and c and a playoff game; player 2
 * guards player 1 in game a. Game a's clock comes with its seconds; b's is only printed, rounded up
 * to `9:60`; c's is printed in decimal minutes. A 2016-17 game has a row the table leaves out.
 */
const PAIRS: Pair[] = [
  ['a', 1, 2, '5:01', 300.5, 20.4, 6, 3, 5],
  ['a', 2, 1, '3:20', 200, 12, 4, 2, 4],
  ['b', 1, 2, '9:60', null, 30, 8, 4, 7],
  ['c', 1, 2, '8.3', null, 25.5, 2, 1, 6],
  ['po1', 1, 2, '2:00', 120, 8, 0, 0, 1],
  ['old', 1, 2, '4:00', 240, 10, 2, 1, 1]
]

async function addMatchups(leave: string[] = []): Promise<void> {
  const cols = COLUMNS.filter(([c]) => !leave.includes(c))
  await db.exec(
    `CREATE OR REPLACE TABLE src_nba_game_matchups (${cols.map(([c, t]) => `${c} ${t}`).join(', ')})`
  )
  for (const [game, def, off, clock, sort, poss, pts, fgm, fga] of PAIRS) {
    const value: Record<string, unknown> = {
      game_id: game,
      off_team_id: off === 1 ? BOS : LAL,
      def_team_id: def === 1 ? BOS : LAL,
      off_person_id: off,
      def_person_id: def,
      off_position: off === 2 ? 'F ' : 'G',
      matchup_minutes: clock,
      matchup_minutes_sort: sort,
      partial_possessions: poss,
      player_points: pts,
      team_points: pts + 3,
      matchup_field_goals_made: fgm,
      matchup_field_goals_attempted: fga,
      matchup_three_pointers_made: 0,
      matchup_three_pointers_attempted: 1,
      matchup_free_throws_made: 0,
      matchup_free_throws_attempted: 0,
      matchup_assists: 1,
      matchup_turnovers: 0,
      matchup_blocks: 1,
      shooting_fouls: 1
    }
    await db.exec(
      `INSERT INTO src_nba_game_matchups VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map(([c]) => value[c] as string | number | null)
    )
  }
}

const build = async (): Promise<void> => {
  await db.exec(gameMatchupsSql(await inspect(db)))
}

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Boston'), (2, 'Bea Laker')`)
  await db.exec(`INSERT INTO src_nba_rosters VALUES (1, 2026, 'G'), (2, 2026, 'F')`)
  const game = (id: string, date: string, type = 'regular', season = 2026): Promise<void> =>
    addGame(db, { id, date, home: BOS, away: LAL, season, type })
  await game('a', '2025-11-01')
  await game('b', '2025-11-03')
  await game('c', '2025-11-05')
  await game('e', '2025-11-07')
  await game('po1', '2026-04-20', 'playoffs')
  await game('old', '2016-11-01', 'regular', 2017)
  for (const g of ['a', 'b', 'c', 'e', 'po1']) {
    await addNbaLine(db, g, 1, BOS, { position: 'G' })
    await addNbaLine(db, g, 2, LAL, { position: 'F' })
  }
  await buildDerived(db)
})

const seconds = async (): Promise<Record<string, number | null>> =>
  Object.fromEntries(
    (
      await db.all<{ game_id: string; def: number; s: number | null }>(
        `SELECT game_id, def_player_id AS def, matchup_seconds AS s FROM game_matchups
         ORDER BY game_id, def_player_id`
      )
    ).map((r) => [`${r.game_id}:${r.def}`, r.s === null ? null : Math.round(r.s * 10) / 10])
  )

describe('the game matchups table', () => {
  it('reads the time from its seconds, else either printed clock, `:60` as the next minute', async () => {
    await addMatchups()
    await build()
    expect(await seconds()).toEqual({
      'a:1': 300.5,
      'a:2': 200,
      'b:1': 600,
      'c:1': 498,
      'po1:1': 120
    })
  })

  it('keys each row to the game table, and leaves out a season before the file', async () => {
    await addMatchups()
    await build()
    const rows = await db.all<{ game_id: string; season: number; game_type: string; off: string }>(
      `SELECT game_id, season, game_type, off_position AS off FROM game_matchups ORDER BY ALL`
    )
    expect(rows.map((r) => [r.game_id, r.season, r.game_type])).toContainEqual([
      'po1',
      2026,
      'playoffs'
    ])
    expect(rows.some((r) => r.game_id === 'old')).toBe(false)
    // The position as published, without the padding.
    expect(new Set(rows.map((r) => r.off))).toEqual(new Set(['F', 'G']))
  })

  it('builds empty when the file is not loaded', async () => {
    await build()
    const n = await db.get<{ n: number }>('SELECT count(*)::INTEGER AS n FROM game_matchups')
    expect(n?.n).toBe(0)
  })

  it('reads a missing column as NULL, and the printed clock when the seconds are missing', async () => {
    await addMatchups(['shooting_fouls', 'matchup_minutes_sort'])
    await build()
    expect((await seconds())['a:1']).toBe(301)
    const sfl = await db.get<{ n: number }>(
      'SELECT count(*)::INTEGER AS n FROM game_matchups WHERE sfl IS NOT NULL'
    )
    expect(sfl?.n).toBe(0)
  })
})

const run = (q: Partial<StatsQuery> & { scope: StatsQuery['scope'] }): Promise<StatsResult> =>
  runQuery(
    db,
    {
      entity: 'player',
      metrics: ['matchup_min', 'matchup_pts', 'matchup_fg_pct', 'matchup_poss'],
      ...q
    },
    CTX
  )
const row = (r: StatsResult, id: string): StatsRow | undefined => r.rows.find((x) => x.id === id)

describe('the defenders’ matchups over games, through the engine', () => {
  beforeEach(async () => {
    await addMatchups()
    await build()
  })

  it('has both grains where the game table holds every part, and the season alone otherwise', () => {
    expect(grainsOf(METRICS.get('matchup_pts')!)).toEqual(['game', 'season'])
    expect(grainsOf(METRICS.get('matchup_g_time_pct')!)).toEqual(['season'])
  })

  it('adds up a date range exactly, over the games in it', async () => {
    const r = await run({
      scope: { seasons: [2026], dates: ['2025-11-02', '2025-11-06'] },
      transform: 'perGame'
    })
    expect(r.grain).toBe('game')
    expect(r.columns.map((c) => c.reason)).toEqual([null, null, null, null])
    const one = row(r, '1')!
    // Games b and c: 10 and 8.3 minutes, 8 and 2 points, 5 of 13.
    expect(one.values.matchup_min.value).toBeCloseTo(18.3 / 2, 9)
    expect(one.values.matchup_pts.value).toBe(5)
    expect(one.values.matchup_fg_pct.value).toBeCloseTo(5 / 13, 9)
    expect(one.values.matchup_poss.value).toBeCloseTo(55.5 / 2, 9)
  })

  it('reads the last games as the player’s last appearances', async () => {
    // Player 1's last regular-season games are e (no matchup) and c.
    const r = await run({ scope: { seasons: [2026], lastN: 2 } })
    expect(row(r, '1')!.values.matchup_pts.value).toBe(2)
    expect(row(r, '1')!.values.matchup_min.value).toBeCloseTo(8.3, 9)
  })

  it('answers the playoffs, which the season pair file does not cover', async () => {
    const r = await run({
      scope: { seasons: [2026], gameTypes: ['playoffs'], dates: ['2026-04-01', '2026-06-30'] }
    })
    expect(row(r, '1')!.values.matchup_min.value).toBeCloseTo(2, 9)
    expect(row(r, '1')!.values.matchup_fg_pct.value).toBe(0)
  })

  it('groups by game, each game its own row', async () => {
    const r = await run({ scope: { seasons: [2026] }, groupBy: ['game'] })
    const byGame = r.rows
      .filter((x) => x.id === '1')
      .map((x) => [x.group?.game, x.values.matchup_pts.value])
    expect(byGame).toEqual(
      expect.arrayContaining([
        ['a', 6],
        ['b', 8],
        ['c', 2]
      ])
    )
  })

  it('keeps the reasons it cannot answer: no minutes to divide by, no game file for positions, a season before it', async () => {
    const per36 = await run({ scope: { seasons: [2026], lastN: 3 }, transform: 'per36' })
    expect(per36.columns.find((c) => c.id === 'matchup_pts')?.reason).toBe(
      'Published without minutes.'
    )
    const positions = await runQuery(
      db,
      { entity: 'player', metrics: ['matchup_g_time_pct'], scope: { seasons: [2026], lastN: 3 } },
      CTX
    )
    expect(positions.columns[0].reason).toBe('Published for whole seasons only.')
    const before = await run({ scope: { seasons: [2017], lastN: 3 } })
    expect(before.columns[0].reason).toBe('Recorded from 2017-18.')
  })
})

describe('a game’s pairs', () => {
  beforeEach(async () => {
    await addMatchups()
    await build()
  })

  it('lists who guarded whom, each defending side longest first, with names', async () => {
    const m = await readGameMatchups(db, 'a')
    expect(m.reason).toBeNull()
    expect(m.pairs.map((p) => [p.defName, p.offName, p.minutes, p.pts])).toEqual([
      ['Ana Boston', 'Bea Laker', 300.5 / 60, 6],
      ['Bea Laker', 'Ana Boston', 200 / 60, 4]
    ])
    expect(m.pairs[0].offPosition).toBe('F')
  })

  it('says why a game before 2017-18, or a game the file lacks, has none', async () => {
    expect(await readGameMatchups(db, 'old')).toEqual({
      pairs: [],
      reason: 'Tracked from 2017-18.'
    })
    expect((await readGameMatchups(db, 'e')).reason).toBe(
      'The NBA’s file has no matchups for this game.'
    )
    expect(await readGameMatchups(db, 'nope')).toEqual({ pairs: [], reason: null })
    expect(await readGameMatchups(db, "a'; DROP")).toEqual({ pairs: [], reason: null })
  })
})

describe('a player’s pairs over a scope', () => {
  beforeEach(async () => {
    await addMatchups()
    await build()
  })

  it('adds up the game matchups over a date range, the last games or the playoffs', async () => {
    const range = await readMatchups(db, '1', 2026, {
      gameTypes: ['regular'],
      dates: ['2025-11-02', '2025-11-06']
    })
    expect(range.source).toBe('games')
    expect(range.guarded.map((p) => [p.id, p.games, p.pts, p.fgm, p.fga])).toEqual([
      ['2', 2, 10, 5, 13]
    ])
    expect(range.guardedBy).toEqual([])
    const last = await readMatchups(db, '1', 2026, { gameTypes: ['regular'], lastN: 2 })
    expect(last.guarded[0].games).toBe(1)
    const team = await readMatchups(db, '1', 2026, {
      gameTypes: ['regular'],
      lastN: 4,
      lastNOf: 'team'
    })
    expect(team.guarded[0].games).toBe(3)
    expect(team.guardedBy[0].pts).toBe(4)
    const playoffs = await readMatchups(db, '1', 2026, { gameTypes: ['playoffs'] })
    expect(playoffs.guarded[0].minutes).toBeCloseTo(2, 9)
  })

  it('refuses a scope that is not one, reading nothing', async () => {
    const none = { guarded: [], guardedBy: [], source: 'games' }
    await expect(
      readMatchups(db, '1', 2026, { gameTypes: ['regular'], dates: ['x', 'y'] })
    ).resolves.toEqual(none)
    await expect(
      readMatchups(db, '1', 2026, { gameTypes: ['nope' as 'regular'], lastN: 3 })
    ).resolves.toEqual(none)
    await expect(
      readMatchups(db, '1', 2026, { gameTypes: ['regular'], lastN: 0 })
    ).resolves.toEqual(none)
  })
})
