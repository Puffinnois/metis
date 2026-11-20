import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { collegePlayLineupSql, onCourtTables, PLAY_LINEUP } from '@main/stats/derived/collegePbp'
import { buildPlays, markPlaySeason, playBuildersOf } from '@main/stats/derived/playBuilders'
import { inspect } from '@main/stats/derived/sql'
import { buildPublished } from '@main/stats/derived/published'
import { buildIdentity } from '@main/stats/identity'
import { LEFT_OUT_REASON, leftOutGap } from '@main/stats/leftOut'
import { NCAA_STATS_RELEASES } from '@main/stats/sources'
import { LEAGUES, type League } from '@shared/leagues'
import { METRICS, metricIn } from '@shared/stats/catalogue'
import { openTestDb } from '../../fixtures/stats'

/**
 * The college leagues' play-built tables (Plan T1302.7, D40 to D42): stats.ncaa.org's play by play read
 * into the play table and the ten on the floor (`collegePbp.ts`), and the shared builders on them: the
 * splits by half (men) and quarter (women), the play-derived counts, the game flow and the units
 * credited play by play beside the lineup file's. Built on the T1302.4 to T1302.6 fixtures with the
 * same games' play by play cut from the first loads (`college-depth/<league>/ncaa_pbp.parquet`), each
 * count worked against the fixture's own file, so the test holds the rules, not a number from a run.
 */
const FIXTURES = join(__dirname, '../../fixtures')
const men = LEAGUES.ncaam
const women = LEAGUES.ncaaw

type Edit = (db: StatsDb) => Promise<void>

async function built(league: League, edit?: Edit, without = ''): Promise<StatsDb> {
  const db = await openTestDb()
  for (const dir of ['college-identity', 'college-derived', 'college-depth']) {
    for (const file of readdirSync(join(FIXTURES, dir, league.id))) {
      const table = `src_${file.replace(/\.parquet$/, '')}`
      if (without && table.startsWith(without)) continue
      const path = join(FIXTURES, dir, league.id, file)
      await db.exec(`CREATE TABLE ${table} AS SELECT * FROM read_parquet(${sqlString(path)})`)
    }
  }
  if (edit) await edit(db)
  await buildIdentity(db, league)
  await buildDerived(db, league)
  await buildPublished(db, league)
  await buildPlays(db, league)
  return db
}

type Row = Record<string, number | string | boolean | null>
const one = async (db: StatsDb, sql: string): Promise<Row> => (await db.get<Row>(sql)) ?? {}
const n = (x: unknown): number => Number(x)

let m: StatsDb
let w: StatsDb
beforeAll(async () => {
  m = await built(men)
  w = await built(women)
}, 120_000)
afterAll(async () => {
  await m.close()
  await w.close()
})

/**
 * The ten on the floor at each play, worked out again as the plays step does (`play_lineup` is an
 * intermediate, dropped once the step has built), into a temporary table `ten`.
 */
async function ten(db: StatsDb): Promise<void> {
  const have = await inspect(db)
  const seasons = await db.all<{ season: number }>('SELECT DISTINCT season FROM play_nba')
  await db.exec(
    `CREATE OR REPLACE TEMP TABLE ten AS ${seasons
      .map((s) => `SELECT * FROM (${collegePlayLineupSql(have, Number(s.season))})`)
      .join(' UNION ALL ')}`
  )
}

/** The file's rows of the games the fixtures hold, in file order, each with its game. */
const FILE = `(SELECT p.rowid AS r, p.*, g.game_id FROM src_ncaa_pbp p JOIN game g ON g.ncaa_game_id = p.contest_id)`

describe('the play table', () => {
  it('holds every row of the file, numbered in the play order within its game', async () => {
    for (const db of [m, w]) {
      await ten(db)
      const r = await one(
        db,
        `SELECT (SELECT count(*) FROM ${FILE})::INTEGER AS file,
                (SELECT count(*) FROM play_nba)::INTEGER AS plays,
                (SELECT count(*) FROM ten)::INTEGER AS ten,
                (SELECT count(*) FROM duckdb_tables() WHERE table_name = '${PLAY_LINEUP}')::INTEGER AS kept,
                (SELECT count(*) FROM (SELECT game_id FROM play_nba GROUP BY 1
                                       HAVING min(seq) <> 1 OR max(seq) <> count(*)))::INTEGER AS gaps`
      )
      expect(n(r.file)).toBeGreaterThan(5000)
      expect([r.plays, r.ten, r.gaps]).toEqual([r.file, r.file, 0])
      // The ten are an intermediate: read while the step builds, not kept in the file.
      expect(r.kept).toBe(0)
      // The n-th row of a game in the file is its play number n.
      const order = await one(
        db,
        `WITH f AS (SELECT game_id, row_number() OVER (PARTITION BY game_id ORDER BY period, game_seconds, r) AS seq,
                           event_type FROM ${FILE})
         SELECT count(*) FILTER (WHERE p.action IS DISTINCT FROM coalesce(f.event_type, ''))::INTEGER AS off
         FROM play_nba p JOIN f USING (game_id, seq)`
      )
      expect(order.off).toBe(0)
    }
  })

  it('counts the makes, attempts and points the file records, a team’s own rows named to no player', async () => {
    for (const db of [m, w]) {
      const file = await one(
        db,
        `SELECT count(*) FILTER (WHERE event_result IN ('made', 'missed') AND event_type <> 'Free Throw'
                                   AND event_type IN ('Three Point Jumper', 'Two Point Jumper', 'Layup', 'Dunk', 'Hook', 'Tip In', 'Unk'))::INTEGER AS fga,
                count(*) FILTER (WHERE event_type = 'Free Throw' AND event_result = 'made')::INTEGER AS ftm,
                count(*) FILTER (WHERE event_type = 'Offensive Rebound')::INTEGER AS oreb,
                count(*) FILTER (WHERE event_type = 'Turnover')::INTEGER AS tov,
                count(*) FILTER (WHERE event_type = 'Defensive Rebound' AND player_1 = 'TEAM')::INTEGER AS team_dreb
         FROM ${FILE}`
      )
      const plays = await one(
        db,
        `SELECT sum(fga)::INTEGER AS fga, sum(ftm)::INTEGER AS ftm, sum(oreb)::INTEGER AS oreb,
                sum(tov)::INTEGER AS tov,
                count(*) FILTER (WHERE dreb = 1 AND player_id IS NULL)::INTEGER AS team_dreb
         FROM play_nba`
      )
      expect(plays).toEqual(file)
      // A team's own row names no player, and every row has its team and the game's sides.
      const keys = await one(
        db,
        `SELECT count(*) FILTER (WHERE team_id IS NULL)::INTEGER AS no_team,
                count(*) FILTER (WHERE team_id NOT IN (g.home_team_id, g.away_team_id))::INTEGER AS foreign_team,
                count(*) FILTER (WHERE home IS DISTINCT FROM (team_id = g.home_team_id))::INTEGER AS home
         FROM play_nba p JOIN game g USING (game_id)`
      )
      expect(keys).toEqual({ no_team: 0, foreign_team: 0, home: 0 })
    }
  })

  it('puts each steal on the other team’s turnover and each block on its miss, at the same moment', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT (SELECT count(*) FROM play_nba WHERE kind = 'steal')::INTEGER AS steal_rows,
                (SELECT count(*) FROM play_nba WHERE stl = 1)::INTEGER AS steals,
                (SELECT count(*) FROM play_nba WHERE stl = 1 AND kind <> 'turnover')::INTEGER AS not_on_turnover,
                (SELECT count(*) FROM play_nba WHERE kind = 'block')::INTEGER AS block_rows,
                (SELECT count(*) FROM play_nba WHERE blk = 1)::INTEGER AS blocks,
                (SELECT count(*) FROM play_nba WHERE blk = 1 AND (fga = 0 OR fgm = 1))::INTEGER AS not_on_miss,
                (SELECT count(*) FROM play_nba WHERE kind IN ('steal', 'block') AND stl + blk > 0)::INTEGER AS own_row`
      )
      expect(n(r.steals)).toBeGreaterThan(0)
      expect([r.not_on_turnover, r.not_on_miss, r.own_row]).toEqual([0, 0, 0])
      // Every steal of 2025-26 has its turnover; a block can lack its miss (99.8 %).
      expect(r.steals).toBe(r.steal_rows)
      expect(n(r.blocks)).toBeGreaterThanOrEqual(0.98 * n(r.block_rows))
      // The stealer is of the other team: the steal's row and the turnover's are not one side.
      const sides = await one(
        db,
        `SELECT count(*)::INTEGER AS wrong FROM play_nba t JOIN play_nba s
           ON s.game_id = t.game_id AND s.kind = 'steal' AND s.player_id = t.steal_id
          AND s.period = t.period AND s.clock = t.clock
         WHERE t.stl = 1 AND s.team_id = t.team_id`
      )
      expect(sides.wrong).toBe(0)
    }
  })

  it('credits an assist to the make’s second player, of the shooter’s team', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT (SELECT count(*) FROM ${FILE} WHERE event_result = 'made' AND event_type <> 'Free Throw'
                                                 AND player_2 IS NOT NULL)::INTEGER AS file,
                (SELECT count(*) FROM play_nba WHERE ast = 1)::INTEGER AS plays,
                (SELECT count(*) FROM play_nba WHERE ast = 1 AND fgm = 0)::INTEGER AS on_miss`
      )
      expect(n(r.file)).toBeGreaterThan(0)
      expect([r.plays, r.on_miss]).toEqual([r.file, 0])
    }
  })

  it('ends every game on its final score, whichever way the file’s sides and score columns run', async () => {
    const last = `WITH l AS (SELECT game_id, max(home_after) AS h, max(away_after) AS a FROM play_nba GROUP BY 1)
      SELECT count(*)::INTEGER AS games,
             count(*) FILTER (WHERE l.h = g.home_score AND l.a = g.away_score)::INTEGER AS exact
      FROM game g JOIN l USING (game_id)`
    const r = await one(m, last)
    expect(r.exact).toBe(r.games)
    // One game with its sides swapped (names and ids), and another with only its score columns
    // swapped (62 games of the men's 2025-26 run that way): both still end on the game's score, and
    // the first game's home five are still the game's home team's.
    const games = await m.all<{ contest_id: string }>(
      'SELECT DISTINCT contest_id FROM src_ncaa_pbp ORDER BY 1 LIMIT 2'
    )
    const [a, b] = games.map((g) => sqlString(g.contest_id))
    const swapped = await built(men, async (db) => {
      const cols = ['', '_ncaa_team_id', '_espn_team_id']
      const set = cols.map((c) => `home${c} = away${c}, away${c} = home${c}`).join(', ')
      const ten = [1, 2, 3, 4, 5]
        .flatMap((i) => [`home_${i}`, `home_${i}_player_id`, `home_${i}_clean_name`])
        .map((h) => `${h} = ${h.replace('home', 'away')}, ${h.replace('home', 'away')} = ${h}`)
        .join(', ')
      await db.exec(
        `UPDATE src_ncaa_pbp SET ${set}, ${ten}, home_score = away_score, away_score = home_score
         WHERE contest_id = ${a}`
      )
      await db.exec(
        `UPDATE src_ncaa_pbp SET home_score = away_score, away_score = home_score WHERE contest_id = ${b}`
      )
    })
    const s = await one(swapped, last)
    expect(s.exact).toBe(s.games)
    const homeFive = async (db: StatsDb): Promise<number[]> => {
      await ten(db)
      return (
        await db.all<{ p: number }>(
          `SELECT DISTINCT home_1 AS p FROM ten l JOIN game g USING (game_id)
           WHERE g.ncaa_game_id = ${a} AND home_1 IS NOT NULL ORDER BY 1`
        )
      ).map((x) => Number(x.p))
    }
    expect(await homeFive(swapped)).toEqual(await homeFive(m))
    await swapped.close()
  }, 120_000)
})

describe('the splits', () => {
  it('are halves for the men and quarters for the women, and add up to the whole game', async () => {
    for (const [db, parts] of [
      [m, ['h1', 'h2', 'ot']],
      [w, ['q1', 'q2', 'q3', 'q4', 'ot']]
    ] as const) {
      const ids = (await db.all<{ split: string }>('SELECT DISTINCT split FROM split_team')).map(
        (r) => r.split
      )
      for (const p of parts.filter((x) => x !== 'ot')) expect(ids).toContain(p)
      // The women's halves are quarters added up; the men have no quarters.
      if (db === m) expect(ids).not.toContain('q1')
      const list = parts.map((p) => `'${p}'`).join(', ')
      const r = await one(
        db,
        `WITH s AS (SELECT game_id, team_id, sum(pts) AS pts, sum(fga) AS fga, sum(ast) AS ast,
                           sum(seconds) AS seconds
                    FROM split_team WHERE split IN (${list}) GROUP BY 1, 2),
              p AS (SELECT game_id, team_id, sum(pts) AS pts, sum(fga) AS fga, sum(ast) AS ast
                    FROM play_nba GROUP BY 1, 2),
              len AS (SELECT game_id, max(period) AS periods FROM play_nba GROUP BY 1)
         SELECT count(*)::INTEGER AS sides,
                count(*) FILTER (WHERE s.pts = p.pts AND s.fga = p.fga AND s.ast = p.ast)::INTEGER AS counts,
                count(*) FILTER (WHERE s.seconds = 5 * (2400 + 300 * greatest(0, len.periods - ${db === m ? 2 : 4})))::INTEGER AS time
         FROM s JOIN p USING (game_id, team_id) JOIN len USING (game_id)`
      )
      expect(n(r.sides)).toBeGreaterThan(10)
      expect([r.counts, r.time]).toEqual([r.sides, r.sides])
    }
  })

  it('give players their time from the ten the file names, as the units credited play by play do', async () => {
    for (const db of [m, w]) {
      const parts = db === m ? "'h1', 'h2', 'ot'" : "'q1', 'q2', 'q3', 'q4', 'ot'"
      const r = await one(
        db,
        `WITH s AS (SELECT game_id, player_id, sum(seconds) AS secs FROM split_player
                    WHERE split IN (${parts}) GROUP BY 1, 2),
              u AS (SELECT game_id, player_id, on_secs AS secs FROM ${onCourtTables(db === m ? men : women, 'plays').players})
         SELECT count(*)::INTEGER AS players,
                count(*) FILTER (WHERE abs(s.secs - u.secs) < 0.001)::INTEGER AS same
         FROM u JOIN s USING (game_id, player_id)`
      )
      expect(n(r.players)).toBeGreaterThan(100)
      expect(r.same).toBe(r.players)
    }
  })
})

describe('the units credited play by play', () => {
  it('cover the whole game and every point, the lineup file’s beside them under their own name', async () => {
    for (const [db, league] of [
      [m, men],
      [w, women]
    ] as const) {
      // The screens read the play by play (the manager's decision at T1302.7).
      expect(league.onCourtFrom).toBe('plays')
      const plays = onCourtTables(league, 'plays')
      expect(plays).toEqual({ units: 'unit_game', players: 'player_on_court' })
      expect(onCourtTables(league, 'lineups')).toEqual({
        units: 'unit_game_lineups',
        players: 'player_on_court_lineups'
      })
      const lineups = await one(db, 'SELECT count(*)::INTEGER AS n FROM unit_game_lineups')
      expect(n(lineups.n)).toBeGreaterThan(0)
      const r = await one(
        db,
        `WITH u AS (SELECT game_id, team_id, sum(secs) AS secs, sum(pts) AS pts FROM ${plays.units} GROUP BY 1, 2),
              p AS (SELECT game_id, team_id, sum(pts) AS pts FROM play_nba GROUP BY 1, 2),
              len AS (SELECT game_id, max(period) AS periods FROM play_nba GROUP BY 1)
         SELECT count(*)::INTEGER AS sides,
                count(*) FILTER (WHERE u.pts = p.pts)::INTEGER AS pts,
                count(*) FILTER (WHERE u.secs = 2400 + 300 * greatest(0, len.periods - ${league === men ? 2 : 4}))::INTEGER AS time
         FROM u JOIN p USING (game_id, team_id) JOIN len USING (game_id)`
      )
      expect(n(r.sides)).toBeGreaterThan(10)
      expect([r.pts, r.time]).toEqual([r.sides, r.sides])
    }
  })

  it('switch what the on-court screens read by one setting, keeping the other beside it', async () => {
    const onLineups: League = { ...men, onCourtFrom: 'lineups' }
    expect(onCourtTables(onLineups, 'lineups')).toEqual({
      units: 'unit_game',
      players: 'player_on_court'
    })
    expect(playBuildersOf(onLineups).map((b) => b.table)).toContain('unit_game_plays')
    // Rebuilt under the switch, `unit_game` holds the lineup file's units, the play-credited ones sit
    // beside them, and the old side table is dropped.
    const plays = await one(m, 'SELECT sum(secs)::DOUBLE AS secs FROM unit_game')
    const lineups = await one(m, 'SELECT sum(secs)::DOUBLE AS secs FROM unit_game_lineups')
    await buildPlays(m, onLineups)
    const after = await one(
      m,
      `SELECT (SELECT sum(secs) FROM unit_game)::DOUBLE AS lineups,
              (SELECT sum(secs) FROM unit_game_plays)::DOUBLE AS plays,
              (SELECT count(*) FROM duckdb_tables() WHERE table_name = 'unit_game_lineups')::INTEGER AS old`
    )
    expect(after).toEqual({ lineups: lineups.secs, plays: plays.secs, old: 0 })
    // And back, by the setting alone: the missing name rebuilds every season.
    await buildPlays(m, men)
    expect((await one(m, 'SELECT sum(secs)::DOUBLE AS secs FROM unit_game')).secs).toBe(plays.secs)
  }, 120_000)

  it('refresh one season to the same tables as a full build, the ten rebuilt for it alone', async () => {
    const tables = playBuildersOf(men)
      .filter((b) => !b.intermediate)
      .map((b) => b.table)
    // Every table's rows of every season, as one order-free sum per table.
    const sums = async (): Promise<Record<string, string>> => {
      const out: Record<string, string> = {}
      for (const t of tables) {
        const r = await one(
          m,
          `SELECT count(*)::VARCHAR || ':' || coalesce(sum(hash(x))::VARCHAR, '') AS h FROM ${t} x`
        )
        out[t] = String(r.h)
      }
      return out
    }
    const full = await sums()
    const season = Number((await one(m, 'SELECT max(season) AS s FROM play_nba')).s)
    await markPlaySeason(m, season)
    await buildPlays(m, men)
    expect(await sums()).toEqual(full)
    const kept = await one(
      m,
      `SELECT count(*)::INTEGER AS n FROM duckdb_tables() WHERE table_name = '${PLAY_LINEUP}'`
    )
    expect(kept.n).toBe(0)
  }, 120_000)
})

describe('the play-derived counts and the game flow', () => {
  it('split assists and makes by value, and take fouls drawn from the file’s own rows', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT (SELECT sum(ast2 + ast3) FROM play_player_game)::INTEGER AS ast,
                (SELECT sum(ast) FROM play_nba)::INTEGER AS plays_ast,
                (SELECT sum(made2_ast + made3_ast) FROM play_team_game)::INTEGER AS made_ast,
                (SELECT sum(fd) FROM play_team_game)::INTEGER AS fd,
                (SELECT sum(fd) FROM play_player_game)::INTEGER AS player_fd,
                (SELECT count(*) FROM play_nba WHERE action = 'Draw Foul' AND player_id IS NOT NULL)::INTEGER AS drawn_rows,
                (SELECT sum(opp_pf) FROM play_team_game)::INTEGER AS opp_pf,
                (SELECT sum(fd_shooting) FROM play_team_game)::INTEGER AS shooting,
                (SELECT sum(pf_shooting) FROM play_team_game)::INTEGER AS pf_shooting,
                (SELECT sum(tov_bad_pass + tov_lost_ball + tov_off_foul + tov_travel + tov_shot_clock
                            + tov_out_of_bounds + tov_violation + tov_other) FROM play_team_game)::INTEGER AS kinds,
                (SELECT sum(tov) FROM play_team_game)::INTEGER AS tov,
                (SELECT sum(tov_other) FROM play_team_game)::INTEGER AS tov_other`
      )
      expect([r.ast, r.made_ast]).toEqual([r.plays_ast, r.plays_ast])
      // Fouls drawn: a row of their own naming the fouled player, a technical left out; about the
      // other side's personal fouls, its shooting fouls among them.
      expect(r.fd).toBe(r.player_fd)
      expect(n(r.fd)).toBeLessThanOrEqual(n(r.drawn_rows))
      expect(n(r.fd)).toBeGreaterThan(0.9 * n(r.opp_pf))
      expect(n(r.shooting)).toBeGreaterThan(0.9 * n(r.pf_shooting))
      // The turnover kinds add up, stats.ncaa.org's spellings mapped (\`TURNOVER_KINDS.ncaa\`).
      expect(r.kinds).toBe(r.tov)
      expect(n(r.tov_other)).toBeLessThan(0.05 * n(r.tov))
    }
  })

  it('read the game flow on the 40-minute game, ending on the final score', async () => {
    for (const [db, periods] of [
      [m, 2],
      [w, 4]
    ] as const) {
      const r = await one(
        db,
        `WITH len AS (SELECT game_id, max(period) AS last FROM play_nba GROUP BY 1)
         SELECT count(*)::INTEGER AS sides,
                count(*) FILTER (WHERE d.game_ds = 10 * (2400 + 300 * greatest(0, len.last - ${periods})))::INTEGER AS length,
                count(*) FILTER (WHERE d.largest_lead >= 0 AND d.flow_games = 1)::INTEGER AS flow
         FROM play_team_game d JOIN len USING (game_id)`
      )
      expect(n(r.sides)).toBeGreaterThan(10)
      expect([r.length, r.flow]).toEqual([r.sides, r.sides])
    }
  })

  it('give the college reasons for what stats.ncaa.org’s play by play does not record', () => {
    const reason = (id: string): string | undefined => metricIn(METRICS.get(id)!, men).unavailable
    for (const id of ['pbp_ejections', 'pbp_def3', 'pbp_goaltend', 'pbp_kicked']) {
      expect(reason(id), id).toMatch(/stats\.ncaa\.org|College basketball/)
    }
    for (const id of ['pbp_tov_bad_pass', 'pbp_ast2', 'pbp_fd', 'pbp_and1', 'pbp_tech']) {
      expect(reason(id), id).toBeUndefined()
    }
    expect(metricIn(METRICS.get('pbp_fd')!, men).description).toMatch(/stats\.ncaa\.org/)
    expect(metricIn(METRICS.get('pbp_fd')!, LEAGUES.nba).description).toMatch(/ESPN/)
  })
})

describe('without stats.ncaa.org’s releases (D41)', () => {
  it('build with the play tables empty, and the play-built metrics and splits say why', async () => {
    for (const league of [men, women]) {
      const db = await built(league, undefined, 'src_ncaa_')
      const r = await one(
        db,
        `SELECT (SELECT count(*) FROM play_nba)::INTEGER AS plays,
                (SELECT count(*) FROM split_player)::INTEGER AS splits,
                (SELECT count(*) FROM play_player_game)::INTEGER AS detail,
                (SELECT count(*) FROM unit_game)::INTEGER AS units,
                (SELECT count(*) FROM unit_game_lineups)::INTEGER AS lineups`
      )
      expect(r).toEqual({ plays: 0, splits: 0, detail: 0, units: 0, lineups: 0 })
      const gap = (id: string, split = false): string | null =>
        leftOutGap(metricIn(METRICS.get(id)!, league), split, NCAA_STATS_RELEASES, league)
      for (const id of ['pbp_ast2', 'pbp_fd', 'team_pbp_lead_changes']) {
        if (METRICS.has(id)) expect(gap(id), id).toBe(LEFT_OUT_REASON)
      }
      expect(gap('pts', true)).toBe(LEFT_OUT_REASON)
      // Both on-court sources read stats.ncaa.org's files, so either one gives the reason.
      for (const from of ['plays', 'lineups'] as const) {
        const l: League = { ...league, onCourtFrom: from }
        for (const id of ['onc_min', 'onc_pm']) {
          if (!METRICS.has(id)) continue
          expect(leftOutGap(metricIn(METRICS.get(id)!, l), false, NCAA_STATS_RELEASES, l), id).toBe(
            LEFT_OUT_REASON
          )
        }
      }
      expect(gap('pts')).toBeNull()
      await db.close()
    }
  }, 120_000)
})
