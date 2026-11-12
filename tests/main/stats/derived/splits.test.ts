import { describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { PLAY_COLUMNS } from '@main/stats/derived/plays'
import {
  buildSplits,
  SPLIT_PLAYER_COLUMNS,
  SPLIT_TEAM_COLUMNS,
  splitsBootstrap
} from '@main/stats/derived/splits'
import { openTestDb } from '../../../fixtures/stats'

/**
 * One fourth quarter, made by hand so each rule meets its boundary: home 1 against away 2, tied at
 * 90. A three at exactly 5:00 left, a substitution, a basket that leaves a five-point game, free
 * throws at 7 and 6 down that are not clutch, and a steal at a five-point margin.
 */
const GAME = 'g1'
const HOME = 1
const AWAY = 2
const H = [101, 102, 103, 104, 105]
const BENCH = 106
const A = [201, 202, 203, 204, 205]

interface Play {
  seq: number
  clock: number
  kind: string
  team?: number
  player?: number
  home?: number
  away?: number
  fga?: number
  fgm?: number
  fg3a?: number
  fg3m?: number
  fta?: number
  ftm?: number
  pts?: number
  tov?: number
  assist?: number
  steal?: number
  text?: string
}

const PLAYS: Play[] = [
  { seq: 1, clock: 720, kind: 'period', home: 90, away: 90 },
  {
    seq: 2,
    clock: 400,
    kind: 'field_goal',
    team: HOME,
    player: H[0],
    fga: 1,
    fgm: 1,
    pts: 2,
    home: 92,
    away: 90
  },
  // Exactly 5:00 left, down 2: clutch.
  {
    seq: 3,
    clock: 300,
    kind: 'field_goal',
    team: AWAY,
    player: A[0],
    fga: 1,
    fgm: 1,
    fg3a: 1,
    fg3m: 1,
    pts: 3,
    home: 92,
    away: 93
  },
  {
    seq: 4,
    clock: 250,
    kind: 'substitution',
    team: HOME,
    player: H[0],
    text: 'SUB: Bench FOR One',
    home: 92,
    away: 93
  },
  {
    seq: 5,
    clock: 200,
    kind: 'field_goal',
    team: HOME,
    player: BENCH,
    fga: 1,
    fgm: 1,
    fg3a: 1,
    fg3m: 1,
    pts: 3,
    assist: H[1],
    home: 95,
    away: 93
  },
  {
    seq: 6,
    clock: 100,
    kind: 'field_goal',
    team: HOME,
    player: H[1],
    fga: 1,
    fgm: 1,
    fg3a: 1,
    fg3m: 1,
    pts: 3,
    home: 98,
    away: 93
  },
  // Up exactly 5 before the play: clutch, though it leaves a seven-point game.
  {
    seq: 7,
    clock: 90,
    kind: 'field_goal',
    team: HOME,
    player: H[2],
    fga: 1,
    fgm: 1,
    pts: 2,
    home: 100,
    away: 93
  },
  // Down 7, then down 6: not clutch.
  {
    seq: 8,
    clock: 80,
    kind: 'free_throw',
    team: AWAY,
    player: A[2],
    fta: 1,
    ftm: 1,
    pts: 1,
    home: 100,
    away: 94
  },
  {
    seq: 9,
    clock: 70,
    kind: 'free_throw',
    team: AWAY,
    player: A[2],
    fta: 1,
    ftm: 1,
    pts: 1,
    home: 100,
    away: 95
  },
  // Down 5: clutch, and the steal is clutch for the side up 5.
  {
    seq: 10,
    clock: 60,
    kind: 'turnover',
    team: AWAY,
    player: A[3],
    tov: 1,
    steal: H[3],
    home: 100,
    away: 95
  },
  { seq: 11, clock: 0, kind: 'period', home: 100, away: 95 }
]

async function seed(
  db: StatsDb,
  raw: 'full' | 'none' | 'no-text' = 'full',
  poss = true
): Promise<void> {
  await db.exec(`CREATE OR REPLACE TABLE game (game_id VARCHAR, nba_game_id VARCHAR, season INTEGER,
    game_type VARCHAR, game_date DATE, home_team_id BIGINT, away_team_id BIGINT, played BOOLEAN)`)
  await db.exec(`INSERT INTO game VALUES ('${GAME}', '${GAME}', 2026, 'regular', DATE '2026-01-10',
    ${HOME}, ${AWAY}, true)`)
  await db.exec('CREATE OR REPLACE TABLE player (player_id BIGINT, name VARCHAR)')
  const names: [number, string][] = [
    ...H.map((id, i): [number, string] => [
      id,
      `Home ${['One', 'Two', 'Three', 'Four', 'Five'][i]}`
    ]),
    [BENCH, 'Home Bench'],
    ...A.map((id, i): [number, string] => [id, `Away ${i + 1}`])
  ]
  await db.exec(`INSERT INTO player VALUES ${names.map(([id, n]) => `(${id}, '${n}')`).join(', ')}`)
  await db.exec(`CREATE OR REPLACE TABLE player_game (player_id BIGINT, game_id VARCHAR, team_id BIGINT,
    season INTEGER)`)
  await db.exec(
    `INSERT INTO player_game VALUES ${[
      ...[...H, BENCH].map((id) => `(${id}, '${GAME}', ${HOME}, 2026)`),
      ...A.map((id) => `(${id}, '${GAME}', ${AWAY}, 2026)`)
    ].join(', ')}`
  )
  await db.exec(
    `CREATE OR REPLACE TABLE play_nba (${PLAY_COLUMNS.map(([n, t]) => `${n} ${t}`).join(', ')})`
  )
  for (const p of PLAYS) {
    const opp = p.team === HOME ? AWAY : p.team === AWAY ? HOME : null
    const v: Record<string, string | number | null> = {
      game_id: `'${GAME}'`,
      season: 2026,
      game_type: "'regular'",
      game_date: "DATE '2026-01-10'",
      seq: p.seq,
      period: 4,
      clock: p.clock,
      home_after: p.home ?? null,
      away_after: p.away ?? null,
      team_id: p.team ?? null,
      opponent_id: opp,
      home: p.team === undefined ? null : p.team === HOME ? 'true' : 'false',
      player_id: p.player ?? null,
      assist_id: p.assist ?? null,
      steal_id: p.steal ?? null,
      kind: `'${p.kind}'`,
      fga: p.fga ?? 0,
      fgm: p.fgm ?? 0,
      fg3a: p.fg3a ?? 0,
      fg3m: p.fg3m ?? 0,
      fta: p.fta ?? 0,
      ftm: p.ftm ?? 0,
      pts: p.pts ?? 0,
      tov: p.tov ?? 0,
      ast: p.assist ? 1 : 0,
      stl: p.steal ? 1 : 0
    }
    await db.exec(
      `INSERT INTO play_nba VALUES (${PLAY_COLUMNS.map(([n]) => v[n] ?? (/^(fg|ft|pts|oreb|dreb|tov|pf|ast|stl|blk)/.test(n) ? 0 : 'NULL')).join(', ')})`
    )
  }
  if (raw !== 'none') {
    const ten = [
      ...H.map((_, i) => `off_player_${i + 1}`),
      ...A.map((_, i) => `def_player_${i + 1}`)
    ]
    const text = raw === 'full' ? 'description VARCHAR, ' : ''
    await db.exec(`CREATE OR REPLACE TABLE src_nba_pbp (game_id VARCHAR, order_index BIGINT, ${text}
      player_name VARCHAR, player_name_i VARCHAR, season INTEGER, ${ten.map((c) => `${c} BIGINT`).join(', ')})`)
    for (const p of PLAYS) {
      const name = p.player === BENCH ? 'Bench' : p.player === H[0] ? 'One' : null
      await db.exec(
        `INSERT INTO src_nba_pbp VALUES ('${GAME}', ${p.seq}, ${raw === 'full' ? `${p.text ? `'${p.text}'` : "''"}, ` : ''}
         ${name ? `'${name}'` : 'NULL'}, NULL, 2026, ${[...H, ...A].join(', ')})`
      )
    }
  }
  if (poss) {
    await db.exec(`CREATE OR REPLACE TABLE src_nba_possessions (game_id VARCHAR, period BIGINT,
      offense_team_id BIGINT, start_order_index BIGINT, start_seconds_remaining DOUBLE,
      count_as_possession BOOLEAN, season INTEGER)`)
    await db.exec(`INSERT INTO src_nba_possessions VALUES ('${GAME}', 4, ${HOME}, 5, 210, true, 2026),
      ('${GAME}', 4, ${AWAY}, 8, 85, true, 2026)`)
  }
  for (const sql of splitsBootstrap()) await db.exec(sql)
}

type Row = Record<string, number | null>
const playerRow = async (db: StatsDb, player: number, split: string): Promise<Row | null> =>
  db.get<Row>(`SELECT * FROM split_player WHERE player_id = ? AND split = ?`, [player, split])
const teamRow = async (db: StatsDb, team: number, split: string): Promise<Row | null> =>
  db.get<Row>(`SELECT * FROM split_team WHERE team_id = ? AND split = ?`, [team, split])

describe('the splits builder', () => {
  it('counts a play by the score before it: exactly 5:00, a margin of exactly 5, not 6', async () => {
    const db = await openTestDb()
    await seed(db)
    await buildSplits(db)
    expect((await playerRow(db, A[0], 'clutch'))?.pts).toBe(3)
    expect((await playerRow(db, BENCH, 'clutch'))?.pts).toBe(3)
    expect(await playerRow(db, H[1], 'clutch')).toMatchObject({ pts: 3, ast: 1 })
    // Up 5 before the basket, 7 after: clutch.
    expect((await playerRow(db, H[2], 'clutch'))?.pts).toBe(2)
    // Down 7, then 6: the free throws are not.
    expect((await playerRow(db, A[2], 'clutch'))?.fta ?? 0).toBe(0)
    expect((await playerRow(db, A[2], 'q4'))?.fta).toBe(2)
    expect((await playerRow(db, A[3], 'clutch'))?.tov).toBe(1)
    expect((await playerRow(db, H[3], 'clutch'))?.stl).toBe(1)
    // 6:40 left is not the last five minutes.
    expect((await playerRow(db, H[0], 'clutch'))?.pts ?? 0).toBe(0)
    expect((await playerRow(db, H[0], 'q4'))?.pts).toBe(2)
  })

  it('gives each team its opponent in the same moments, mirrored for the score', async () => {
    const db = await openTestDb()
    await seed(db)
    await buildSplits(db)
    expect(await teamRow(db, HOME, 'clutch')).toMatchObject({ pts: 8, opp_pts: 3, stl: 1 })
    expect(await teamRow(db, AWAY, 'clutch')).toMatchObject({ pts: 3, opp_pts: 8, tov: 1 })
    expect(await teamRow(db, HOME, 'q4')).toMatchObject({ pts: 10, opp_pts: 5 })
    // Home led for 300 seconds; that is away's time behind.
    expect((await teamRow(db, HOME, 'ahead'))?.seconds).toBe(5 * 300)
    expect((await teamRow(db, AWAY, 'behind'))?.seconds).toBe(5 * 300)
    expect((await teamRow(db, HOME, 'tied'))?.seconds).toBe(5 * 320)
    expect((await teamRow(db, HOME, 'behind'))?.seconds).toBe(5 * 100)
    expect((await teamRow(db, HOME, 'ahead'))?.pts).toBe(
      (await teamRow(db, AWAY, 'behind'))?.opp_pts
    )
  })

  it('times the players from the substitutions, and the clutch time within it', async () => {
    const db = await openTestDb()
    await seed(db)
    await buildSplits(db)
    expect((await playerRow(db, H[0], 'q4'))?.seconds).toBe(470)
    expect((await playerRow(db, BENCH, 'q4'))?.seconds).toBe(250)
    expect((await playerRow(db, H[1], 'q4'))?.seconds).toBe(720)
    // Clutch: 5:00 to 0:00, less 90 to 70 seconds left at a margin of 7 and 6.
    expect((await teamRow(db, HOME, 'clutch'))?.seconds).toBe(5 * 280)
    expect((await playerRow(db, H[0], 'clutch'))?.seconds).toBe(50)
    expect((await playerRow(db, BENCH, 'clutch'))?.seconds).toBe(230)
    expect((await playerRow(db, H[1], 'last1'))?.seconds).toBe(60)
  })

  it('counts possessions by their first play, for both sides', async () => {
    const db = await openTestDb()
    await seed(db)
    await buildSplits(db)
    expect(await teamRow(db, HOME, 'clutch')).toMatchObject({ poss: 1, opp_poss: null })
    // The away possession starts at 1:25, up 7 for the home side: not clutch, but late.
    expect(await teamRow(db, AWAY, 'q4')).toMatchObject({ poss: 1, opp_poss: 1 })
  })

  it('reads time as NULL without the feed or its substitutions, and keeps the counts', async () => {
    for (const raw of ['none', 'no-text'] as const) {
      const db = await openTestDb()
      await seed(db, raw)
      await buildSplits(db)
      const row = await playerRow(db, H[2], 'clutch')
      expect(row).toMatchObject({ pts: 2, seconds: null })
    }
  })

  it('reads possessions as NULL without their source', async () => {
    const db = await openTestDb()
    await seed(db, 'full', false)
    await buildSplits(db)
    expect(await teamRow(db, HOME, 'q4')).toMatchObject({ pts: 10, poss: null })
  })

  it('replaces a season on its own and has the columns its builders declare', async () => {
    const db = await openTestDb()
    await seed(db)
    await buildSplits(db)
    const first = await db.get<{ n: number }>('SELECT count(*)::INTEGER AS n FROM split_player')
    await buildSplits(db, [2026])
    const again = await db.get<{ n: number }>('SELECT count(*)::INTEGER AS n FROM split_player')
    expect(again?.n).toBe(first?.n)
    for (const [table, columns] of [
      ['split_player', SPLIT_PLAYER_COLUMNS],
      ['split_team', SPLIT_TEAM_COLUMNS]
    ] as const) {
      const held = await db.all<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM duckdb_columns() WHERE table_name = ? ORDER BY column_index`,
        [table]
      )
      expect(held.map((c) => [c.column_name, c.data_type])).toEqual(columns.map((c) => [...c]))
    }
  })
})
