import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { nbaShotsSql } from '@main/stats/derived/events'
import { PLAY_BUILDERS } from '@main/stats/derived/playBuilders'
import { PLAY_TABLES } from '@main/stats/derived/plays'
import {
  bandSql,
  SHOT_BUILDERS,
  SHOT_PLAYER_GAME,
  SHOT_TEAM_GAME,
  typeSql,
  zoneSql
} from '@main/stats/derived/shots'
import { inspect } from '@main/stats/derived/sql'
import { runQuery } from '@main/stats/engine/run'
import { readShotChart } from '@main/stats/shotReads'
import { shotBand, shotType, shotZone, SHOT_TYPES } from '@shared/stats/shots'
import type { StatsQuery, StatsResult } from '@shared/stats/types'
import { addGame, addNbaLine, BOS, emptySources, LAL, MIA } from '../../../fixtures/boxScores'
import { openTestDb } from '../../../fixtures/stats'

const CTX = { currentSeason: 2027 }
let db: StatsDb

/** Player 1 plays for Boston in games a and b, then for Miami in c; player 2 for the Lakers. */
const SHOTS: {
  game: string
  team: number
  person: number
  sec: number
  made: boolean
  value: number
  x: number
  y: number
  sub: string
}[] = [
  // Game a, Boston at home on 2025-11-01: a dunk, a corner three, a mid-range miss.
  { game: 'a', team: BOS, person: 1, sec: 600, made: true, value: 2, x: 0, y: 5, sub: 'Dunk Shot' },
  {
    game: 'a',
    team: BOS,
    person: 1,
    sec: 500,
    made: true,
    value: 3,
    x: -230,
    y: 20,
    sub: 'Jump Shot'
  },
  {
    game: 'a',
    team: BOS,
    person: 1,
    sec: 400,
    made: false,
    value: 2,
    x: 150,
    y: 120,
    sub: 'Pullup Jump shot'
  },
  {
    game: 'a',
    team: LAL,
    person: 2,
    sec: 300,
    made: true,
    value: 2,
    x: 10,
    y: 10,
    sub: 'Layup Shot'
  },
  // Game b, 2026-01-05: a missed layup and a made three above the break.
  {
    game: 'b',
    team: BOS,
    person: 1,
    sec: 600,
    made: false,
    value: 2,
    x: 5,
    y: 20,
    sub: 'Driving Layup Shot'
  },
  {
    game: 'b',
    team: BOS,
    person: 1,
    sec: 500,
    made: true,
    value: 3,
    x: 0,
    y: 260,
    sub: 'Step Back Jump shot'
  },
  // Game c, for Miami, 2026-01-06: a paint floater, a heave from beyond half court.
  {
    game: 'c',
    team: MIA,
    person: 1,
    sec: 600,
    made: true,
    value: 2,
    x: 30,
    y: 100,
    sub: 'Floating Jump shot'
  },
  { game: 'c', team: MIA, person: 1, sec: 1, made: false, value: 3, x: 10, y: 600, sub: '' }
]

const iso = (sec: number): string => `PT${Math.floor(sec / 60)}M${sec % 60}.00S`

async function createShots(drop: string[] = []): Promise<void> {
  const cols: [string, string][] = [
    ['game_id', 'VARCHAR'],
    ['season', 'INTEGER'],
    ['period', 'BIGINT'],
    ['clock', 'VARCHAR'],
    ['team_id', 'BIGINT'],
    ['person_id', 'BIGINT'],
    ['action_type', 'VARCHAR'],
    ['sub_type', 'VARCHAR'],
    ['shot_result', 'VARCHAR'],
    ['shot_value', 'BIGINT'],
    ['shot_distance', 'BIGINT'],
    ['x_legacy', 'BIGINT'],
    ['y_legacy', 'BIGINT']
  ]
  const kept = cols.filter(([c]) => !drop.includes(c))
  await db.exec(
    `CREATE OR REPLACE TABLE src_nba_shots (${kept.map(([c, t]) => `${c} ${t}`).join(', ')})`
  )
  for (const s of SHOTS) {
    const all: Record<string, unknown> = {
      game_id: s.game,
      season: 2026,
      period: 1,
      clock: iso(s.sec),
      team_id: s.team,
      person_id: s.person,
      action_type: s.made ? 'Made Shot' : 'Missed Shot',
      sub_type: s.sub,
      shot_result: s.made ? 'Made' : 'Missed',
      shot_value: s.value,
      shot_distance: Math.round(Math.hypot(s.x, s.y) / 10),
      x_legacy: s.x,
      y_legacy: s.y
    }
    await db.exec(
      `INSERT INTO src_nba_shots VALUES (${kept.map(() => '?').join(', ')})`,
      kept.map(([c]) => all[c] as string | number)
    )
  }
}

/** The plays' rows for the makes; only the corner three in game a is assisted, by player 3. */
async function createPlays(): Promise<void> {
  let seq = 0
  for (const s of SHOTS.filter((x) => x.made)) {
    seq += 1
    const assisted = s.game === 'a' && s.value === 3
    await db.exec(
      `INSERT INTO ${PLAY_TABLES.nba} (game_id, season, seq, period, clock, team_id, player_id,
         assist_id, fga, fgm) VALUES (?, 2026, ?, 1, ?, ?, ?, ?, 1, 1)`,
      [s.game, seq, s.sec, s.team, s.person, assisted ? 3 : null]
    )
  }
}

async function build(): Promise<void> {
  const have = await inspect(db)
  for (const b of SHOT_BUILDERS) {
    await db.exec(`DELETE FROM ${b.table} WHERE season = 2026`)
    await db.exec(`INSERT INTO ${b.table} ${b.select(have, 2026)}`)
  }
  // The view the chart reads, as the play build leaves it once the builders have run.
  await db.exec(nbaShotsSql(have))
}

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 2, 'BOS', 'Boston Celtics', 'east', 'atlantic'),
    (2026, ${LAL}, 13, 'LAL', 'Los Angeles Lakers', 'west', 'pacific'),
    (2026, ${MIA}, 14, 'MIA', 'Miami Heat', 'east', 'southeast')`)
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
  await db.exec(`INSERT INTO player VALUES (1, 'Ana Traded'), (2, 'Bea Laker')`)
  await db.exec(`INSERT INTO src_nba_rosters VALUES (1, 2026, 'G'), (2, 2026, 'G')`)
  await addGame(db, { id: 'a', date: '2025-11-01', home: BOS, away: LAL })
  await addGame(db, { id: 'b', date: '2026-01-05', home: LAL, away: BOS })
  await addGame(db, { id: 'c', date: '2026-01-06', home: MIA, away: LAL })
  await addNbaLine(db, 'a', 1, BOS, { position: 'G' })
  await addNbaLine(db, 'b', 1, BOS, { position: 'G' })
  await addNbaLine(db, 'c', 1, MIA, { position: 'G' })
  await addNbaLine(db, 'a', 2, LAL, { position: 'G' })
  await buildDerived(db)
  await createShots()
  await createPlays()
})

describe('the zone, band and type rules in SQL', () => {
  it('give what the shared rules give, on the boundary points', async () => {
    const points: [number | null, number | null, number | null][] = [
      [0, 40, 2],
      [0, 40.5, 2],
      [80, 142.5, 2],
      [80.5, 142.5, 2],
      [-225, 92.5, 3],
      [225, 93, 3],
      [0, 422.5, 3],
      [0, 423, 3],
      [0, 237.5, null],
      [-220, 0, null],
      [-219, 0, null],
      [-16398, -4098, 2],
      [null, 5, 2]
    ]
    for (const [x, y, value] of points) {
      const row = await db.get<{ zone: string; band: string }>(
        `SELECT ${zoneSql('x', 'y', 'value')} AS zone, ${bandSql('NULL', 'x', 'y')} AS band
         FROM (SELECT ?::DOUBLE AS x, ?::DOUBLE AS y, ?::INTEGER AS value)`,
        [x, y, value] as never
      )
      expect(row?.zone, `${x}, ${y}, ${value}`).toBe(shotZone(x, y, value))
      expect(row?.band ?? null, `${x}, ${y}`).toBe(shotBand(null, x, y))
    }
  })

  it('maps the types as the shared rule does', async () => {
    const texts = ['Tip Dunk Shot', 'Tip Layup Shot', 'Finger Roll Shot', 'Driving Bank Hook Shot']
    for (const t of [...texts, 'Something New', '']) {
      const row = await db.get<{ type: string }>(
        `SELECT ${typeSql('t')} AS type FROM (SELECT ?::VARCHAR AS t)`,
        [t]
      )
      expect(row?.type, t).toBe(shotType(t))
    }
    expect(SHOT_TYPES.filter((t) => t.pattern !== null)).toHaveLength(6)
  })
})

describe('the shot tables', () => {
  it('count each player-game by zone, band and type, the zones adding up to the shots', async () => {
    await build()
    const rows = await db.all<Record<string, number | string>>(
      `SELECT game_id, ra_fga, ra_fgm, mid_fga, c3l_fga, c3l_fgm, c3_fga, atb3_fgm, back_fga,
              paint_fga, dunk_fga, floater_fgm, other_fga, jumper_fga, shots_fga, shots_fgm,
              shots_pts, shots_fg3a, c3l_ast, shots_ast, dist_sum, dist_n, ra_xfgm,
              lt8_fga, d24p_fga
       FROM ${SHOT_PLAYER_GAME} WHERE player_id = 1 ORDER BY game_id`
    )
    expect(rows.map((r) => r.game_id)).toEqual(['a', 'b', 'c'])
    const [a, b, c] = rows
    expect(a).toMatchObject({
      ra_fga: 1,
      ra_fgm: 1,
      mid_fga: 1,
      c3l_fga: 1,
      c3l_fgm: 1,
      c3_fga: 1,
      dunk_fga: 1,
      jumper_fga: 2,
      shots_fga: 3,
      shots_fgm: 2,
      shots_pts: 5,
      shots_fg3a: 1,
      c3l_ast: 1,
      shots_ast: 1
    })
    expect(b).toMatchObject({ ra_fga: 1, atb3_fgm: 1, shots_fga: 2, shots_ast: 0 })
    expect(c).toMatchObject({ paint_fga: 1, floater_fgm: 1, back_fga: 1, other_fga: 1 })
    // The league's rate in the restricted area this season: 2 made of 3, so 0.667 of a make expected.
    expect(Number(a.ra_xfgm)).toBe(667)
    for (const r of rows) {
      expect(Number(r.lt8_fga) + Number(r.d24p_fga)).toBeLessThanOrEqual(Number(r.shots_fga))
    }
  })

  it('give a team its shots and the shots against it', async () => {
    await build()
    const bos = await db.all<{ game_id: string; shots_fga: number; opp_shots_fga: number }>(
      `SELECT game_id, shots_fga, opp_shots_fga FROM ${SHOT_TEAM_GAME}
       WHERE team_id = ${BOS} ORDER BY game_id`
    )
    expect(bos).toEqual([
      { game_id: 'a', shots_fga: 3, opp_shots_fga: 1 },
      { game_id: 'b', shots_fga: 2, opp_shots_fga: 0 }
    ])
  })

  it('build empty with no shot file, and read a missing column as NULL', async () => {
    await db.exec('DROP TABLE src_nba_shots')
    await build()
    expect(
      (await db.get<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ${SHOT_PLAYER_GAME}`))?.n
    ).toBe(0)
    await createShots(['sub_type', 'shot_distance'])
    await build()
    const r = await db.get<{ other: number; n: number; lt8: number }>(
      `SELECT sum(other_fga)::INTEGER AS other, sum(shots_fga)::INTEGER AS n,
              sum(lt8_fga)::INTEGER AS lt8 FROM ${SHOT_PLAYER_GAME}`
    )
    // Every type is "other", and the band falls back on the coordinates.
    expect(r).toEqual({ other: 8, n: 8, lt8: 3 })
  })

  it('are built after the plays, season by season, by the play registry', () => {
    const tables = PLAY_BUILDERS.map((b) => b.table)
    expect(tables.indexOf(SHOT_PLAYER_GAME)).toBeGreaterThan(tables.indexOf(PLAY_TABLES.nba))
    expect(tables).toContain(SHOT_TEAM_GAME)
  })
})

describe('the engine over the shot tables', () => {
  const run = (q: Partial<StatsQuery> & { scope: StatsQuery['scope'] }): Promise<StatsResult> =>
    runQuery(db, { entity: 'player', metrics: ['shot_ra_fga'], ...q }, CTX)
  const value = (r: StatsResult, metric: string, id = '1'): number | null =>
    r.rows.find((x) => x.id === id)?.values[metric].value ?? null

  beforeEach(build)

  it('adds a whole season, and a traded player’s one team on its own', async () => {
    const all = await run({
      metrics: ['shot_ra_fga', 'shot_c3_fg_pct', 'shot_atb3_freq'],
      scope: { seasons: [2026] }
    })
    expect(value(all, 'shot_ra_fga')).toBe(2)
    expect(value(all, 'shot_c3_fg_pct')).toBe(1)
    expect(value(all, 'shot_atb3_freq')).toBeCloseTo(1 / 7)
    const bos = await run({ scope: { seasons: [2026], teams: [String(BOS)] } })
    expect(value(bos, 'shot_ra_fga')).toBe(2)
    const mia = await run({ scope: { seasons: [2026], teams: [String(MIA)] } })
    expect(value(mia, 'shot_ra_fga')).toBe(0)
  })

  it('answers a date range and the last games exactly', async () => {
    const jan = await run({
      metrics: ['shot_ra_fga', 'shot_back_fga'],
      scope: { seasons: [2026], dates: ['2026-01-01', '2026-01-31'] }
    })
    expect(value(jan, 'shot_ra_fga')).toBe(1)
    expect(value(jan, 'shot_back_fga')).toBe(1)
    const last = await run({ scope: { seasons: [2026], lastN: 1 } })
    expect(value(last, 'shot_ra_fga')).toBe(0)
  })

  it('reads a season before the shots start as null with its reason', async () => {
    const r = await run({ scope: { seasons: [1996] } })
    expect(r.columns.find((c) => c.id === 'shot_ra_fga')?.reason).toBe('Recorded from 1996-97.')
  })

  it('reads the shots against a team', async () => {
    const r = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_shot_ra_fga', 'opp_shot_ra_fga'],
        scope: { seasons: [2026] }
      },
      CTX
    )
    expect(value(r, 'team_shot_ra_fga', String(BOS))).toBe(2)
    expect(value(r, 'opp_shot_ra_fga', String(BOS))).toBe(1)
  })
})

describe('the shot chart read', () => {
  beforeEach(build)
  const scope = { gameTypes: ['regular' as const] }

  it('reads a player’s shots newest first, with every shot counted by zone', async () => {
    const chart = await readShotChart(db, { entity: 'player', id: '1', seasons: [2026], scope })
    expect(chart.total).toBe(7)
    expect(chart.made).toBe(4)
    expect(chart.shots).toHaveLength(7)
    // The newest: game c's heave at the end of the period, then its floater.
    expect(chart.shots[0]).toMatchObject({ x: 10, y: 600, zone: 'back' })
    expect(chart.shots[1]).toMatchObject({ x: 30, y: 100, zone: 'paint' })
    expect(chart.zones.find((z) => z.zone === 'back')).toMatchObject({ fga: 1, fgm: 0 })
    expect(chart.capped).toBe(false)
    expect(chart.reason).toBeNull()
  })

  it('keeps to a date range and the last games', async () => {
    const jan = await readShotChart(db, {
      entity: 'player',
      id: '1',
      seasons: [2026],
      scope: { ...scope, dates: ['2026-01-01', '2026-01-31'] }
    })
    expect(jan.total).toBe(4)
    const last = await readShotChart(db, {
      entity: 'player',
      id: '1',
      seasons: [2026],
      scope: { ...scope, lastN: 2 }
    })
    expect(last.total).toBe(4)
  })

  it('reads a team’s shots, or those against it', async () => {
    const own = await readShotChart(db, { entity: 'team', id: String(LAL), seasons: [2026], scope })
    const against = await readShotChart(db, {
      entity: 'team',
      id: String(LAL),
      seasons: [2026],
      scope,
      side: 'defense'
    })
    expect(own.total).toBe(1)
    expect(against.total).toBe(7)
  })

  it('says why before the shots start, and refuses a bad request quietly', async () => {
    const old = await readShotChart(db, { entity: 'player', id: '1', seasons: [1995], scope })
    expect(old.reason).toBe('Recorded from 1996-97.')
    const bad = await readShotChart(db, { entity: 'player', id: '1; DROP', seasons: [2026], scope })
    expect(bad).toMatchObject({ total: 0, shots: [] })
  })
})
