import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { buildIdentity } from '@main/stats/identity'
import { NCAA_SIDE } from '@main/stats/identityCollege'
import { LEAGUES, type League } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'
import { slow } from '../../fixtures/timeouts'

/**
 * Where a stats.ncaa.org row stands (`ncaa_side`, T1703.2): by its ESPN id, else, in a contest of two
 * rows of which the other was placed, the other side, else by a name of rows already placed, which means
 * one side and not the other; never by the home or away its own file lists, which can be the other way
 * round from the game's (Pittsburgh at Chicago State, NCAA Women, 2025-26, where a row with no id took
 * Pittsburgh's side). The identity decides it, the players' map follows it, and every builder reads it.
 * The fixtures of `collegeDerived`, with one contest's rows changed.
 */
const FIXTURES = join(__dirname, '../../fixtures')
const men = LEAGUES.ncaam
const women = LEAGUES.ncaaw

interface Contest {
  game_id: string
  contest_id: string
  x: number
  y: number
  x_team: string
  y_team: string
  x_secs: number
  y_secs: number
}

async function open(league: League): Promise<StatsDb> {
  const db = await openTestDb()
  for (const dir of ['college-identity', 'college-derived']) {
    for (const file of readdirSync(join(FIXTURES, dir, league.id))) {
      const path = join(FIXTURES, dir, league.id, file)
      await db.exec(
        `CREATE TABLE src_${file.replace(/\.parquet$/, '')} AS SELECT * FROM read_parquet(${sqlString(path)})`
      )
    }
  }
  return db
}

/** The identity and the game tables, as a refresh builds them after a change of the files. */
async function build(db: StatsDb, league: League): Promise<void> {
  await buildIdentity(db, league)
  await buildDerived(db, league)
}

async function loaded(): Promise<{ db: StatsDb; c: Contest }> {
  const db = await open(women)
  await buildIdentity(db, women)
  // A contest both sources cover, both rows naming a team of the game, each with lines.
  const c = await db.get<Contest>(
    `WITH n AS (
       SELECT contest_id, TRY_CAST(team_espn_team_id AS INTEGER) AS id, team, o_mins * 60 AS secs
       FROM src_ncaa_team_box)
     SELECT g.game_id, g.ncaa_game_id AS contest_id, a.id AS x, b.id AS y, a.team AS x_team,
            b.team AS y_team, a.secs AS x_secs, b.secs AS y_secs
     FROM game g JOIN n a ON a.contest_id = g.ncaa_game_id AND a.id = g.home_team_id
     JOIN n b ON b.contest_id = g.ncaa_game_id AND b.id = g.away_team_id
     WHERE g.played AND g.forfeit_winner_id IS NULL AND abs(a.secs - b.secs) > 1
       AND (SELECT count(*) FROM src_ncaa_player_box p WHERE p.contest_id = g.ncaa_game_id AND p.team = b.team) > 3
     ORDER BY g.game_id LIMIT 1`
  )
  if (!c) throw new Error('no contest in the fixtures')
  return { db, c }
}

const sides = (
  db: StatsDb,
  contest: string
): Promise<{ team: string; team_id: number | null; method: string | null }[]> =>
  db.all(`SELECT team, team_id, method FROM ${NCAA_SIDE} WHERE contest_id = ? ORDER BY team`, [
    contest
  ])
const seconds = async (db: StatsDb, game: string, team: number): Promise<number | null> =>
  (
    await db.get<{ s: number | null }>(
      'SELECT ncaa_off_seconds AS s FROM team_game WHERE game_id = ? AND team_id = ?',
      [game, team]
    )
  )?.s ?? null

describe('the side a stats.ncaa.org row stands on', () => {
  it(
    'is its ESPN id, whatever home and away its file lists',
    async () => {
      const { db, c } = await loaded()
      await db.exec(
        `UPDATE src_ncaa_team_box SET home = away, away = home WHERE contest_id = '${c.contest_id}'`
      )
      await build(db, women)
      expect((await sides(db, c.contest_id)).map((r) => r.method)).toEqual(['id', 'id'])
      expect(await seconds(db, c.game_id, c.x)).toBeCloseTo(c.x_secs, 6)
      expect(await seconds(db, c.game_id, c.y)).toBeCloseTo(c.y_secs, 6)
      db.close()
    },
    slow(60_000)
  )

  it(
    'is the name of rows already placed when its contest gives no id, and the other side’s is left to it',
    async () => {
      const db = await open(men)
      const clear = (extra = ''): Promise<void> =>
        db.exec(
          `UPDATE src_ncaa_team_box SET team_espn_team_id = NULL${extra} WHERE contest_id = '2140566' AND team = 'Pacific'`
        )
      for (const t of ['src_ncaa_team_box', 'src_ncaa_player_box'])
        await db.exec(`UPDATE ${t} SET team_espn_team_id = NULL WHERE contest_id = '2140566'`)
      await build(db, men)
      // Both names stand in other contests of the season, placed there by their ESPN ids.
      const known = await sides(db, '2140566')
      expect(known.map((r) => r.method)).toEqual(['name', 'name'])
      const hawaii = known.find((r) => r.team === 'Hawaii')?.team_id
      const pacific = known.find((r) => r.team === 'Pacific')?.team_id
      // The player lines follow their row's side, and their players' map with them.
      const on = await db.all<{ player: string; team_id: number }>(
        `SELECT DISTINCT p.team_id FROM player_game p JOIN game g USING (game_id) WHERE g.ncaa_game_id = '2140566'`
      )
      expect(on.length).toBe(2)
      // A name no row was placed by is left the other side.
      await clear(`, team = 'Nowhere St.'`)
      await db.exec(
        `UPDATE src_ncaa_player_box SET team = 'Nowhere St.' WHERE contest_id = '2140566' AND team = 'Pacific'`
      )
      await build(db, men)
      expect((await sides(db, '2140566')).map((r) => [r.team, r.team_id, r.method])).toEqual([
        ['Hawaii', hawaii, 'name'],
        ['Nowhere St.', pacific, 'elimination']
      ])
      db.close()
    },
    slow(60_000)
  )

  it(
    'is the side its contest leaves when neither id nor name tells, not the home or away it lists',
    async () => {
      const { db, c } = await loaded()
      // The row of the side that has no id or known name, in a contest listing its sides the other way
      // round: read by home or away it would stand on the other team's side.
      const q = c.y_team.replaceAll("'", "''")
      await db.exec(
        `UPDATE src_ncaa_team_box SET home = away, away = home WHERE contest_id = '${c.contest_id}'`
      )
      await db.exec(
        `UPDATE src_ncaa_team_box SET team_espn_team_id = NULL, team = 'Nowhere St.' WHERE contest_id = '${c.contest_id}' AND team = '${q}'`
      )
      await db.exec(
        `UPDATE src_ncaa_player_box SET home = away, away = home WHERE contest_id = '${c.contest_id}'`
      )
      await db.exec(
        `UPDATE src_ncaa_player_box SET team_espn_team_id = NULL, player_id = NULL, player = player || ' zz', team = 'Nowhere St.' WHERE contest_id = '${c.contest_id}' AND team = '${q}'`
      )
      // As in the game this was found in: the file's home team is the unnamed one, the game's away.
      for (const t of ['src_ncaa_team_box', 'src_ncaa_player_box'])
        await db.exec(
          `UPDATE ${t} SET home = 'Nowhere St.' WHERE contest_id = '${c.contest_id}' AND home = '${q}'`
        )
      await build(db, women)
      const row = (await sides(db, c.contest_id)).find((r) => r.team === 'Nowhere St.')
      expect([row?.method, row?.team_id]).toEqual(['elimination', c.y])
      // Its players are keyed to that side, and to no other, whatever home and away the file lists.
      expect(
        await db.all(
          `SELECT DISTINCT team_id FROM ncaa_player_ids WHERE ncaa_team = 'Nowhere St.' ORDER BY 1`
        )
      ).toEqual([{ team_id: c.y }])
      // Each team reads its own row, the named side's unchanged.
      expect(await seconds(db, c.game_id, c.x)).toBeCloseTo(c.x_secs, 6)
      expect(await seconds(db, c.game_id, c.y)).toBeCloseTo(c.y_secs, 6)
      // The lines follow the row: the team's sums are its own lines'.
      const pts = await db.all<{ team: string; n: number }>(
        `SELECT team, sum(pts)::INTEGER AS n FROM src_ncaa_player_box WHERE contest_id = '${c.contest_id}' GROUP BY 1`
      )
      const own = await db.get<{ p: number }>(
        'SELECT (ncaa_pts_half + ncaa_pts_trans)::INTEGER AS p FROM team_game WHERE game_id = ? AND team_id = ?',
        [c.game_id, c.y]
      )
      const at = await db.get<{ p: number }>(
        `SELECT sum(pts_half + pts_trans)::INTEGER AS p FROM src_ncaa_player_box WHERE contest_id = '${c.contest_id}' AND team = 'Nowhere St.'`
      )
      expect(own?.p).toBe(at?.p)
      expect(pts.map((r) => r.team)).toContain('Nowhere St.')
      db.close()
    },
    slow(60_000)
  )

  it(
    'keeps a line with no id on its team row’s side, though its player is mapped to the other team',
    async () => {
      const { db, c } = await loaded()
      const q = c.y_team.replaceAll("'", "''")
      const sums = async (): Promise<number | null> =>
        (
          await db.get<{ n: number | null }>(
            'SELECT (ncaa_pts_half + ncaa_pts_trans)::INTEGER AS n FROM team_game WHERE game_id = ? AND team_id = ?',
            [c.game_id, c.y]
          )
        )?.n ?? null
      await build(db, women)
      const own = await sums()
      expect(own).toBeGreaterThan(0)
      // The lines give no id and their players' map holds the other team, as it does in the real files.
      await db.exec(
        `UPDATE src_ncaa_player_box SET team_espn_team_id = NULL WHERE contest_id = '${c.contest_id}' AND team = '${q}'`
      )
      await db.exec(`UPDATE ncaa_player_ids SET team_id = ${c.x} WHERE ncaa_team = '${q}'`)
      await buildDerived(db, women)
      expect(await sums()).toBe(own)
      db.close()
    },
    slow(60_000)
  )

  it(
    'is nobody’s when neither row is placed, and the teams read no value',
    async () => {
      const { db, c } = await loaded()
      await db.exec(
        `UPDATE src_ncaa_team_box SET team_espn_team_id = NULL, team = CASE WHEN team = '${c.y_team.replaceAll("'", "''")}' THEN 'Nowhere St.' ELSE 'Nothere Tech' END WHERE contest_id = '${c.contest_id}'`
      )
      await build(db, women)
      expect((await sides(db, c.contest_id)).map((r) => [r.team_id, r.method])).toEqual([
        [null, null],
        [null, null]
      ])
      expect(await seconds(db, c.game_id, c.x)).toBeNull()
      expect(await seconds(db, c.game_id, c.y)).toBeNull()
      db.close()
    },
    slow(60_000)
  )

  it(
    'places nothing by elimination in a contest of three rows, or where two rows claim one side',
    async () => {
      const three = await loaded()
      const q = three.c.y_team.replaceAll("'", "''")
      await three.db.exec(
        `UPDATE src_ncaa_team_box SET team_espn_team_id = NULL, team = 'Nowhere St.' WHERE contest_id = '${three.c.contest_id}' AND team = '${q}'`
      )
      await three.db.exec(
        `INSERT INTO src_ncaa_team_box SELECT * REPLACE ('Elsewhere' AS team) FROM src_ncaa_team_box WHERE contest_id = '${three.c.contest_id}' AND team = 'Nowhere St.'`
      )
      await build(three.db, women)
      expect(
        (await sides(three.db, three.c.contest_id)).filter((r) => r.method === 'elimination')
      ).toEqual([])
      three.db.close()
      const two = await loaded()
      await two.db.exec(
        `UPDATE src_ncaa_team_box SET team_espn_team_id = CAST(${two.c.x} AS VARCHAR) WHERE contest_id = '${two.c.contest_id}'`
      )
      await build(two.db, women)
      expect((await sides(two.db, two.c.contest_id)).map((r) => r.team_id)).toEqual([null, null])
      two.db.close()
    },
    slow(90_000)
  )
})

describe('the splits of a player with two lines in one game', () => {
  const GAME = '401415936'
  /** The contest's lines with one player's line and the splits of their player_game line. */
  const setUp = async (): Promise<{
    db: StatsDb
    pid: string
    player: number
    team: string
    other: string
    pts: number
    own: () => Promise<{ pts: number; ncaa_pts: number | null; team_id: number }>
  }> => {
    const db = await open(women)
    await build(db, women)
    const row = await db.get<{
      pid: string
      player: number
      team: string
      other: string
      pts: number
    }>(
      `SELECT b.player_id::VARCHAR AS pid, i.player_id AS player, b.team, (SELECT min(o.team) FROM src_ncaa_player_box o
               WHERE o.contest_id = b.contest_id AND o.team <> b.team) AS other, b.pts::INTEGER AS pts
       FROM src_ncaa_player_box b
       JOIN ncaa_player_ids i ON i.season = b.season AND i.ncaa_player_id = b.player_id::VARCHAR
       JOIN player_game p ON p.game_id = '${GAME}' AND p.player_id = i.player_id AND p.ncaa_pts = p.pts
       JOIN game g ON g.game_id = '${GAME}' AND g.ncaa_game_id = b.contest_id
       WHERE b.pts > 3 ORDER BY b.player_id LIMIT 1`
    )
    if (!row) throw new Error('no line in the fixtures')
    const own = async (): Promise<{ pts: number; ncaa_pts: number | null; team_id: number }> => {
      const r = await db.get<{ pts: number; ncaa_pts: number | null; team_id: number }>(
        'SELECT pts, ncaa_pts, team_id FROM player_game WHERE game_id = ? AND player_id = ?',
        [GAME, row.player]
      )
      if (!r) throw new Error('no player line')
      return r
    }
    return { db, ...row, own }
  }
  /** A copy of the player's line, for the team, with the points and the attempts moved. */
  const copy = (db: StatsDb, pid: string, team: string, by: number): Promise<void> =>
    db.exec(
      `INSERT INTO src_ncaa_player_box SELECT * REPLACE ('${team.replaceAll("'", "''")}' AS team,
         (SELECT any_value(t.team_espn_team_id) FROM src_ncaa_player_box t
          WHERE t.contest_id = b.contest_id AND t.team = '${team.replaceAll("'", "''")}') AS team_espn_team_id,
         pts + ${by} AS pts, fga + ${by} AS fga, pts_half + ${by} AS pts_half)
       FROM src_ncaa_player_box b WHERE b.player_id::VARCHAR = '${pid}'
         AND b.contest_id = (SELECT ncaa_game_id FROM game WHERE game_id = '${GAME}')`
    )

  it(
    'are the line on the side their box line stands on',
    async () => {
      const t = await setUp()
      // Another person of the key, on the other team (Angel Smith of Samford and Galen Smith, 2021-22).
      await copy(t.db, t.pid, t.other, 9)
      await build(t.db, women)
      const after = await t.own()
      expect([after.pts, after.ncaa_pts]).toEqual([t.pts, t.pts])
      t.db.close()
    },
    slow(60_000)
  )

  it(
    'are, of two on one side, the line whose counts are the box’s, and none’s when neither’s are',
    async () => {
      const t = await setUp()
      // Two people of one key on one team (Weathersby, NCAA Women, 2021-22).
      await copy(t.db, t.pid, t.team, 9)
      await build(t.db, women)
      expect((await t.own()).ncaa_pts).toBe(t.pts)
      await t.db.exec(
        `UPDATE src_ncaa_player_box SET pts = pts + 2, fga = fga + 2, pts_half = pts_half + 2
         WHERE player_id::VARCHAR = '${t.pid}' AND pts = ${t.pts}
           AND contest_id = (SELECT ncaa_game_id FROM game WHERE game_id = '${GAME}')`
      )
      await build(t.db, women)
      expect((await t.own()).ncaa_pts).toBeNull()
      t.db.close()
    },
    slow(60_000)
  )

  it(
    'are a player’s only line even where it differs from the box, as the two sources’ lines do',
    async () => {
      const t = await setUp()
      await t.db.exec(
        `UPDATE src_ncaa_player_box SET pts = pts + 1, pts_half = pts_half + 1 WHERE player_id::VARCHAR = '${t.pid}'
           AND contest_id = (SELECT ncaa_game_id FROM game WHERE game_id = '${GAME}')`
      )
      await build(t.db, women)
      expect((await t.own()).ncaa_pts).toBe(t.pts + 1)
      t.db.close()
    },
    slow(60_000)
  )
})
