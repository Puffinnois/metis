import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  ON_COURT_BUILDERS,
  PLAYER_ON_COURT,
  PLAYER_ON_COURT_COLUMNS,
  UNIT_GAME,
  UNIT_GAME_COLUMNS
} from '@main/stats/derived/onCourt'
import { PLAY_COLUMNS } from '@main/stats/derived/plays'
import { PLAY_BUILDERS } from '@main/stats/derived/playBuilders'
import { inspect } from '@main/stats/derived/sql'
import { readOnCourtUnits, readWithOrWithout } from '@main/stats/onCourtReads'
import { openTestDb } from '../../../fixtures/stats'

/**
 * One small game, home (1) against away (2), every rule of the on-court layer in it:
 * - Period 1: a home basket, an away foul, a home free throw, a home substitution (16 for 15), a
 *   second free throw, then an away three. The second free throw belongs to the five at the foul.
 * - The away five is written in two orders, and the period's last play has no lineup row.
 * - Overtime: five minutes; the away lineup knows only four players.
 */
const H = 1
const A = 2
const NBA_GAME = '0022500001'
const HOME_A = [11, 12, 13, 14, 15]
const HOME_B = [11, 12, 13, 14, 16]
const AWAY = [21, 22, 23, 24, 25]
const AWAY_REVERSED = [25, 24, 23, 22, 21]
const AWAY_FOUR = [22, 23, 24, 25, null]

type Play = {
  seq: number
  period: number
  clock: number
  kind: string
  team?: number
  player?: number
  flags?: Partial<Record<string, number>>
  home: (number | null)[] | null
  away: (number | null)[] | null
}

const PLAYS: Play[] = [
  { seq: 1, period: 1, clock: 720, kind: 'period', home: HOME_A, away: AWAY },
  {
    seq: 2,
    period: 1,
    clock: 700,
    kind: 'field_goal',
    team: H,
    player: 11,
    flags: { fga: 1, fgm: 1, pts: 2 },
    home: HOME_A,
    away: AWAY
  },
  {
    seq: 3,
    period: 1,
    clock: 690,
    kind: 'foul',
    team: A,
    player: 21,
    flags: { pf: 1 },
    home: HOME_A,
    away: AWAY
  },
  {
    seq: 4,
    period: 1,
    clock: 690,
    kind: 'free_throw',
    team: H,
    player: 12,
    flags: { fta: 1, ftm: 1, pts: 1 },
    home: HOME_A,
    away: AWAY
  },
  {
    seq: 5,
    period: 1,
    clock: 690,
    kind: 'substitution',
    team: H,
    player: 15,
    home: HOME_A,
    away: AWAY
  },
  {
    seq: 6,
    period: 1,
    clock: 690,
    kind: 'free_throw',
    team: H,
    player: 12,
    flags: { fta: 1, ftm: 1, pts: 1 },
    home: HOME_B,
    away: AWAY
  },
  {
    seq: 7,
    period: 1,
    clock: 660,
    kind: 'field_goal',
    team: A,
    player: 22,
    flags: { fga: 1, fgm: 1, fg3a: 1, fg3m: 1, pts: 3 },
    home: HOME_B,
    away: AWAY_REVERSED
  },
  { seq: 8, period: 1, clock: 0, kind: 'period', home: null, away: null },
  { seq: 9, period: 5, clock: 300, kind: 'period', home: HOME_B, away: AWAY_FOUR },
  {
    seq: 10,
    period: 5,
    clock: 250,
    kind: 'field_goal',
    team: H,
    player: 11,
    flags: { fga: 1, fgm: 1, pts: 2 },
    home: HOME_B,
    away: AWAY_FOUR
  },
  { seq: 11, period: 5, clock: 0, kind: 'period', home: HOME_B, away: AWAY_FOUR }
]

/** Possessions by the play that ends them: home's after the free throws, away's three, home in overtime. */
const POSSESSIONS = [
  { end: 6, offense: H },
  { end: 7, offense: A },
  { end: 10, offense: H }
]

const FLAGS = [
  'fga',
  'fgm',
  'fg3a',
  'fg3m',
  'fta',
  'ftm',
  'pts',
  'oreb',
  'dreb',
  'tov',
  'pf',
  'ast',
  'stl',
  'blk'
]
const list = (xs: (number | null)[]): string =>
  `[${xs.map((x) => (x === null ? 'NULL' : x)).join(', ')}]`

async function createGame(
  db: StatsDb,
  opts: { lineups?: boolean; counted?: boolean } = {}
): Promise<void> {
  await db.exec(`CREATE OR REPLACE TABLE game AS SELECT 'G1' AS game_id, '${NBA_GAME}' AS nba_game_id, 2026 AS season,
    'regular' AS game_type, DATE '2026-01-10' AS game_date, ${H}::BIGINT AS home_team_id, ${A}::BIGINT AS away_team_id`)
  await db.exec(
    `CREATE OR REPLACE TABLE play_nba (${PLAY_COLUMNS.map(([n, t]) => `${n} ${t}`).join(', ')})`
  )
  for (const p of PLAYS) {
    const opp = p.team === H ? A : p.team === A ? H : null
    await db.exec(
      `INSERT INTO play_nba (game_id, season, game_type, game_date, seq, period, clock, team_id, opponent_id,
         player_id, kind, ${FLAGS.join(', ')})
       VALUES ('G1', 2026, 'regular', DATE '2026-01-10', ${p.seq}, ${p.period}, ${p.clock}, ${p.team ?? 'NULL'},
         ${opp ?? 'NULL'}, ${p.player ?? 'NULL'}, '${p.kind}', ${FLAGS.map((f) => p.flags?.[f] ?? 0).join(', ')})`
    )
  }
  await db.exec(`CREATE OR REPLACE TABLE src_nba_pbp AS
    SELECT '${NBA_GAME}' AS game_id, seq::BIGINT AS order_index, (seq * 10)::BIGINT AS action_number, 2026 AS season
    FROM range(1, ${PLAYS.length + 1}) t(seq)`)
  if (opts.lineups !== false) {
    const rows = PLAYS.filter((p) => p.home && p.away).map(
      (p) => `SELECT '${NBA_GAME}' AS game_id, ${p.seq * 10}::BIGINT AS action_number,
        ${[0, 1, 2, 3, 4].map((i) => `${list(p.home ?? [])}[${i + 1}]::BIGINT AS home_player_${i + 1}`).join(', ')},
        ${[0, 1, 2, 3, 4].map((i) => `${list(p.away ?? [])}[${i + 1}]::BIGINT AS away_player_${i + 1}`).join(', ')}`
    )
    await db.exec(`CREATE OR REPLACE TABLE src_nba_game_lineups AS ${rows.join(' UNION ALL ')}`)
  }
  const counted = opts.counted !== false
  await db.exec(
    `CREATE OR REPLACE TABLE src_nba_possessions AS ${POSSESSIONS.map(
      (p) =>
        `SELECT '${NBA_GAME}' AS game_id, ${p.end}::BIGINT AS end_order_index, ${p.offense}::BIGINT AS offense_team_id${counted ? ', true AS count_as_possession' : ''}`
    ).join(' UNION ALL ')}`
  )
}

/**
 * The on-court builders for the fixture's season, as the play step runs them: the fixture writes
 * `play_nba` itself, so the play tables' own builders are left out.
 */
async function buildOnCourt(db: StatsDb): Promise<void> {
  const have = await inspect(db)
  for (const b of ON_COURT_BUILDERS) {
    await db.exec(
      `CREATE OR REPLACE TABLE ${b.table} (${b.columns.map(([n, t]) => `${n} ${t}`).join(', ')})`
    )
    await db.exec(`INSERT INTO ${b.table} ${b.select(have, 2026)}`)
  }
}

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
})

type Row = Record<string, number | string | boolean | null>

const player = async (id: number): Promise<Row> =>
  (await db.get<Row>(`SELECT * FROM ${PLAYER_ON_COURT} WHERE player_id = ${id}`)) ?? {}

describe('the on-court tables', () => {
  beforeEach(async () => {
    await createGame(db)
    await buildOnCourt(db)
  })

  it('has the columns its builders declare, in order', async () => {
    for (const [table, columns] of [
      [UNIT_GAME, UNIT_GAME_COLUMNS],
      [PLAYER_ON_COURT, PLAYER_ON_COURT_COLUMNS]
    ] as const) {
      const rows = await db.all<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM duckdb_columns() WHERE table_name = '${table}' ORDER BY column_index`
      )
      expect(rows.map((r) => [r.column_name, r.data_type])).toEqual(columns.map(([n, t]) => [n, t]))
    }
    expect(ON_COURT_BUILDERS.map((b) => b.table)).toEqual([UNIT_GAME, PLAYER_ON_COURT])
    // In the play step's registry, together, after the plays they read.
    const at = PLAY_BUILDERS.findIndex((b) => b.table === UNIT_GAME)
    expect(PLAY_BUILDERS.slice(at, at + 2).map((b) => b.table)).toEqual([
      UNIT_GAME,
      PLAYER_ON_COURT
    ])
    expect(at).toBeGreaterThan(PLAY_BUILDERS.findIndex((b) => b.table === 'play_nba'))
  })

  it('credits a free throw after a substitution to the five on the floor at the foul', async () => {
    const out = await player(15)
    const sub = await player(16)
    // 15 was on for both free throws, and the possession they ended.
    expect(out).toMatchObject({ on_pts: 4, on_opp_pts: 0, on_poss: 1, on_fta: 2 })
    // 16 came in between them: only the away three and the overtime basket.
    expect(sub).toMatchObject({ on_pts: 2, on_opp_pts: 3, on_poss: 1, on_opp_poss: 1, on_fta: 0 })
  })

  it('times each play from the one before it, with five-minute overtimes', async () => {
    expect((await player(15)).on_secs).toBe(30)
    expect((await player(16)).on_secs).toBe(690 + 300)
    expect((await player(11)).on_secs).toBe(720 + 300)
    const team = await db.get<{ secs: number }>(
      `SELECT sum(secs) AS secs FROM ${UNIT_GAME} WHERE team_id = ${H}`
    )
    expect(team?.secs).toBe(1020)
  })

  it('keys a unit by its players in order, however the source writes them', async () => {
    const away = await db.all<Row>(
      `SELECT p1, p2, p3, p4, p5, complete, secs, pf FROM ${UNIT_GAME} WHERE team_id = ${A} ORDER BY secs DESC`
    )
    expect(away).toHaveLength(2)
    // The reversed lineup and the play with no lineup row are the same unit.
    expect(away[0]).toMatchObject({
      p1: 21,
      p2: 22,
      p3: 23,
      p4: 24,
      p5: 25,
      complete: true,
      secs: 720,
      pf: 1
    })
  })

  it('keeps a lineup with a player missing, as a group that is not a five-man unit', async () => {
    const away = await db.get<Row>(
      `SELECT * FROM ${UNIT_GAME} WHERE team_id = ${A} AND NOT complete`
    )
    expect(away).toMatchObject({ p1: 22, p2: 23, p3: 24, p4: 25, p5: null, secs: 300, opp_pts: 2 })
    // 21 sat out overtime: their off-court line is it.
    expect(await player(21)).toMatchObject({
      on_secs: 720,
      off_secs: 300,
      on_opp_pts: 4,
      off_opp_pts: 2
    })
  })

  it('adds on and off up to the team, and keeps the player’s own counts', async () => {
    const rows = await db.all<Row>(`SELECT * FROM ${PLAYER_ON_COURT}`)
    for (const r of rows) {
      const team = r.team_id === H ? { pts: 6, opp: 3 } : { pts: 3, opp: 6 }
      expect(Number(r.on_pts) + Number(r.off_pts)).toBe(team.pts)
      expect(Number(r.on_opp_pts) + Number(r.off_opp_pts)).toBe(team.opp)
    }
    expect(await player(12)).toMatchObject({ p_fta: 2, p_ftm: 2, p_pts: 2 })
    expect(await player(21)).toMatchObject({ p_pf: 1 })
  })
})

describe('a source that is missing', () => {
  it('builds no players without the lineup file', async () => {
    await createGame(db, { lineups: false })
    await buildOnCourt(db)
    const n = await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${PLAYER_ON_COURT}`)
    expect(n?.n).toBe(0)
  })

  it('counts every possession when the file has no count column', async () => {
    await createGame(db, { counted: false })
    await buildOnCourt(db)
    expect(await player(16)).toMatchObject({ on_poss: 1, on_opp_poss: 1 })
  })
})

describe('the on-court reads', () => {
  beforeEach(async () => {
    await createGame(db)
    await buildOnCourt(db)
    await db.exec(
      `CREATE OR REPLACE TABLE player AS SELECT 11::BIGINT AS player_id, 'Ann Able' AS name`
    )
  })

  it('lists five-man units, and smaller groups of the players known', async () => {
    const fives = await readOnCourtUnits(db, String(A), 2026, { gameTypes: ['regular'] }, 5)
    expect(fives.units.map((u) => u.players.map((p) => p.id))).toEqual([
      ['21', '22', '23', '24', '25']
    ])
    const fours = await readOnCourtUnits(db, String(A), 2026, { gameTypes: ['regular'] }, 4)
    // Five fours from the complete unit; the four known in overtime is one of them.
    expect(fours.units).toHaveLength(5)
    expect(fours.units[0].players.map((p) => p.id)).toEqual(['22', '23', '24', '25'])
    expect(fours.units[0].line.secs).toBe(1020)
    const home = await readOnCourtUnits(db, String(H), 2026, { gameTypes: ['regular'] }, 2)
    expect(home.units[0].players[0]).toEqual({ id: '11', name: 'Ann Able' })
  })

  it('reads nothing before the play by play, with the reason', async () => {
    const early = await readOnCourtUnits(db, String(A), 1996, { gameTypes: ['regular'] }, 5)
    expect(early).toEqual({
      units: [],
      reason: "Counted from 1996-97, when the NBA's play by play starts."
    })
  })

  it('splits a team by a player and a teammate on and off the floor', async () => {
    const w = await readWithOrWithout(db, '11', '15', 2026, { gameTypes: ['regular'] })
    expect(w.teamId).toBe(String(H))
    expect(w.splits?.both).toMatchObject({ secs: 30, pts: 4 })
    expect(w.splits?.playerOnly).toMatchObject({ secs: 990, pts: 2, opp_pts: 3 })
    expect(w.splits?.teammateOnly).toBeNull()
    // With no teammate named, the one they shared the most minutes with.
    const first = await readWithOrWithout(db, '11', null, 2026, { gameTypes: ['regular'] })
    expect(first.teammate).toBe('12')
    expect(first.teammates.map((t) => t.id).slice(0, 4)).toEqual(['12', '13', '14', '16'])
  })

  it('counts a unit missing a player in the split it belongs to', async () => {
    // In overtime the away lineup knows four players: 22 on, 21 off.
    const w = await readWithOrWithout(db, '22', '21', 2026, { gameTypes: ['regular'] })
    expect(w.splits?.both).toMatchObject({ secs: 720 })
    expect(w.splits?.playerOnly).toMatchObject({ secs: 300, opp_pts: 2 })
  })

  it('refuses what is not an id', async () => {
    const bad = await readOnCourtUnits(db, "1' OR 1=1", 2026, { gameTypes: ['regular'] }, 5)
    expect(bad.units).toEqual([])
  })
})
