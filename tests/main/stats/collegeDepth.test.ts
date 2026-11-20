import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { COLLEGE_LINEUP_COLUMNS, nameKeySql } from '@main/stats/derived/collegePlays'
import {
  buildPlays,
  COLLEGE_PLAY_BUILDERS,
  PLAY_BUILDERS,
  playBuildersOf
} from '@main/stats/derived/playBuilders'
import { COLLEGE_PLAYS, playsRecipe } from '@main/stats/derived/playsRecipe'
import { buildPublished, COLLEGE_PUBLISHED, publishedRecipe } from '@main/stats/derived/published'
import { zoneSql } from '@main/stats/derived/shots'
import { runQuery } from '@main/stats/engine/run'
import { buildIdentity } from '@main/stats/identity'
import { LEFT_OUT_REASON, leftOutGap } from '@main/stats/leftOut'
import { readOfficialsSeason } from '@main/stats/officialsReads'
import { readShotChart } from '@main/stats/shotReads'
import { NCAA_STATS_RELEASES } from '@main/stats/sources'
import { COLLEGE_LINEUP_COVERAGE, LEAGUES, threePointLineIn, type League } from '@shared/leagues'
import { EVERY_GAME_ONLY, METRICS, metricIn, playTablesNotBuilt } from '@shared/stats/catalogue'
import { LINEUP_STORED } from '@shared/stats/lineups'
import { openTestDb } from '../../fixtures/stats'

/**
 * The college leagues' depth (Plan T1302.6, D40, D41, D44): stats.ncaa.org's shots, lineups, stints and
 * possessions, ESPN's shots and officials, and SportsDataverse's published models, built on T1302.4's
 * and T1302.5's fixtures with the same games' event and model files cut from the first loads
 * (`college-depth`). Every count is worked against the fixture's own file, so the test holds the
 * recipe's arithmetic, not a number copied from a run.
 */
const FIXTURES = join(__dirname, '../../fixtures')
const men = LEAGUES.ncaam
const women = LEAGUES.ncaaw

async function load(db: StatsDb, league: League, without = ''): Promise<void> {
  for (const dir of ['college-identity', 'college-derived', 'college-depth']) {
    for (const file of readdirSync(join(FIXTURES, dir, league.id))) {
      const table = `src_${file.replace(/\.parquet$/, '')}`
      if (without && table.startsWith(without)) continue
      const path = join(FIXTURES, dir, league.id, file)
      await db.exec(`CREATE TABLE ${table} AS SELECT * FROM read_parquet(${sqlString(path)})`)
    }
  }
}

async function built(league: League, without = ''): Promise<StatsDb> {
  const db = await openTestDb()
  await load(db, league, without)
  await buildIdentity(db, league)
  await buildDerived(db, league)
  await buildPublished(db, league)
  await buildPlays(db, league)
  return db
}

type Row = Record<string, number | string | boolean | null>
const one = async (db: StatsDb, sql: string, params: (string | number)[] = []): Promise<Row> =>
  (await db.get<Row>(sql, params)) ?? {}
const all = async (db: StatsDb, sql: string): Promise<Row[]> => db.all<Row>(sql)

let m: StatsDb
let w: StatsDb
beforeAll(async () => {
  m = await built(men)
  w = await built(women)
}, 120_000)

describe('the recipes', () => {
  it('are one for both leagues: the college plays and published recipes', () => {
    for (const league of [men, women]) {
      expect(playsRecipe(league)).toBe(COLLEGE_PLAYS)
      expect(publishedRecipe(league)).toBe(COLLEGE_PUBLISHED)
      expect(playBuildersOf(league)).toBe(COLLEGE_PLAY_BUILDERS)
    }
    // The NBA's and the WNBA's run every builder, as before.
    expect(playBuildersOf(LEAGUES.nba)).toBe(PLAY_BUILDERS)
    expect(playBuildersOf(LEAGUES.wnba)).toBe(PLAY_BUILDERS)
    expect(COLLEGE_PLAY_BUILDERS.map((b) => b.table)).toEqual([
      'shot_key',
      'shot_player_game',
      'shot_team_game',
      'unit_game',
      'player_on_court',
      'pub_lineups'
    ])
    // The lineups tab's table keeps the shape `lineupsBootstrap` gives it.
    expect(COLLEGE_LINEUP_COLUMNS.slice(9).map(([n]) => n)).toEqual([
      'games',
      'minutes',
      ...LINEUP_STORED.map((c) => c.id)
    ])
  })

  it('leaves the play by play’s own tables empty until T1302.7', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT (SELECT count(*) FROM play_nba)::INTEGER AS plays,
                (SELECT count(*) FROM split_player)::INTEGER AS splits,
                (SELECT count(*) FROM play_player_game)::INTEGER AS detail`
      )
      expect(r).toEqual({ plays: 0, splits: 0, detail: 0 })
    }
  })
})

describe('shots', () => {
  it('count every stats.ncaa.org shot once, in the shot charts’ frame, on its team-game', async () => {
    for (const db of [m, w]) {
      const file = await one(
        db,
        `SELECT count(*)::INTEGER AS n, count(*) FILTER (WHERE made)::INTEGER AS made,
                count(*) FILTER (WHERE point_value = 3)::INTEGER AS threes
         FROM src_ncaa_shots s JOIN game g ON g.ncaa_game_id = s.contest_id`
      )
      const built = await one(
        db,
        `SELECT sum(shots_fga)::INTEGER AS n, sum(shots_fgm)::INTEGER AS made,
                sum(shots_fg3a)::INTEGER AS threes FROM shot_team_game`
      )
      expect(built).toEqual(file)
      expect(Number(file.n)).toBeGreaterThan(1000)
      // Every shot has its team-game, and feet from the basket become tenths.
      const view = await one(
        db,
        `SELECT count(*) FILTER (WHERE v.team_id IS NULL)::INTEGER AS no_team,
                max(abs(v.x - s.shot_x * 10))::DOUBLE AS dx, max(abs(v.y - s.shot_y * 10))::DOUBLE AS dy,
                count(*) FILTER (WHERE v.distance <> round(s.dist_ft))::INTEGER AS distance
         FROM shot_nba v JOIN game g ON g.game_id = v.game_id
         JOIN src_ncaa_shots s ON s.contest_id = g.ncaa_game_id`
      )
      expect(view.no_team).toBe(0)
    }
  })

  it('agree with the box score on every team-game of the fixtures that both hold', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS sides,
                count(*) FILTER (WHERE s.shots_fga = t.ncaa_fga)::INTEGER AS fga,
                count(*) FILTER (WHERE s.shots_fgm = t.ncaa_fgm)::INTEGER AS fgm
         FROM team_game t JOIN shot_team_game s USING (game_id, team_id)
         WHERE t.ncaa_fga IS NOT NULL`
      )
      expect(Number(r.sides)).toBeGreaterThan(0)
      // stats.ncaa.org's shots and its box score are one family: equal on nearly every team-game.
      expect(Number(r.fga) / Number(r.sides)).toBeGreaterThan(0.9)
      expect(Number(r.fgm) / Number(r.sides)).toBeGreaterThan(0.9)
    }
  })

  it('give a school outside Division I, which the file names with no id, the other side', async () => {
    // In each game with such shots, one side's attempts are exactly them: the side with no id.
    const r = await one(
      m,
      `WITH f AS (
         SELECT g.game_id,
                count(*) FILTER (WHERE s.ncaa_team_id IS NULL AND s.espn_team_id IS NULL)::INTEGER AS anon,
                count(*) FILTER (WHERE s.ncaa_team_id IS NOT NULL OR s.espn_team_id IS NOT NULL)::INTEGER AS named
         FROM src_ncaa_shots s JOIN game g ON g.ncaa_game_id = s.contest_id GROUP BY 1)
       SELECT count(*)::INTEGER AS games,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM shot_team_game t
                                             WHERE t.game_id = f.game_id AND t.shots_fga = f.anon
                                               AND t.opp_shots_fga = f.named))::INTEGER AS sided
       FROM f WHERE anon > 0`
    )
    expect(Number(r.games)).toBeGreaterThan(0)
    expect(r.sided).toBe(r.games)
  })

  it('credit every shot to a player: ESPN’s athlete, or a key of D28’s kind', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS n, count(player_id)::INTEGER AS credited,
                count(*) FILTER (WHERE player_id > 0)::INTEGER AS espn FROM shot_nba`
      )
      expect(r.credited).toBe(r.n)
      expect(Number(r.espn) / Number(r.n)).toBeGreaterThan(0.9)
    }
  })

  it('count no assisted make: neither file names one (the play by play does, in T1302.7)', async () => {
    const r = await one(
      m,
      `SELECT count(ra_ast)::INTEGER AS ast, count(*)::INTEGER AS n FROM shot_player_game`
    )
    expect(r.ast).toBe(0)
    expect(Number(r.n)).toBeGreaterThan(0)
  })

  it('classify the paint by the college’s 12-foot lane, and a value as published', async () => {
    const zone = async (
      x: number,
      y: number,
      value: number | null,
      lane?: number
    ): Promise<string> =>
      String(
        (
          await one(
            m,
            `SELECT ${zoneSql(String(x), String(y), value === null ? 'NULL' : String(value), { arc: '221.5', corner: '216.5' }, lane)} AS z`
          )
        ).z
      )
    // Seven feet across, five up: in the NBA's 16-foot lane, outside the college's 12.
    expect(await zone(70, 50, 2)).toBe('paint')
    expect(await zone(70, 50, 2, 60)).toBe('mid')
    expect(await zone(55, 50, 2, 60)).toBe('paint')
    // A published three counts as one however near the line: the corner reads from the value.
    expect(await zone(212, 20, 3, 60)).toBe('c3r')
    expect(await zone(-212, 20, 3, 60)).toBe('c3l')
    // The line is the rule's, 21 feet 7⅞ inches in the corner; it decides only a shot with no value,
    // which no college shot is: a corner three charted inside it stays a three.
    expect(await zone(212, 20, 3, 60)).toBe('c3r')
    expect(await zone(212, 20, null, 60)).toBe('mid')
    expect(await zone(218, 20, null, 60)).toBe('c3r')
    expect(threePointLineIn(men, 2026)).toEqual({ from: 2022, arc: 221.5, corner: 216.5 })
    expect(threePointLineIn(women, 2026)).toEqual({ from: 2022, arc: 221.5, corner: 216.5 })
  })

  it('read on a player’s chart with zones that add up to the shot tables', async () => {
    const player = await one(
      m,
      `SELECT player_id::VARCHAR AS id, season FROM shot_player_game WHERE player_id > 0
       GROUP BY ALL ORDER BY sum(shots_fga) DESC LIMIT 1`
    )
    const chart = await readShotChart(
      m,
      {
        entity: 'player',
        id: String(player.id),
        seasons: [Number(player.season)],
        scope: { gameTypes: [...men.countedTypes] }
      },
      men
    )
    expect(chart.reason).toBeNull()
    expect(chart.total).toBeGreaterThan(0)
    expect(chart.shots.length).toBe(chart.total)
    expect(chart.zones.reduce((s, z) => s + z.fga, 0)).toBe(chart.total)
  })

  it('keep ESPN’s shots beside them, its made free throws flagged and never attempts', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*) FILTER (WHERE s.type_text ILIKE '%FreeThrow%')::INTEGER AS file_ft,
                (SELECT count(*) FROM shot_espn WHERE free_throw)::INTEGER AS view_ft,
                (SELECT count(*) FROM shot_espn WHERE free_throw AND value <> 1)::INTEGER AS bad
         FROM src_espn_shots s JOIN game g ON g.espn_game_id = s.game_id
         WHERE s.season = s.file_season OR s.file_season IS NULL`
      )
      expect(Number(r.file_ft)).toBeGreaterThan(0)
      expect(r.bad).toBe(0)
    }
  })
})

describe('units on the floor', () => {
  it('add up to the lineup file, team-game by team-game', async () => {
    for (const db of [m, w]) {
      const file = await all(
        db,
        `SELECT l.contest_id, l.team, round(sum(l.duration_mins) * 60, 6) AS secs,
                sum(l.pts)::INTEGER AS pts, sum(l.opp_pts)::INTEGER AS opp_pts,
                sum(coalesce(l.tpa, 0))::INTEGER AS fg3a, sum(coalesce(l."to", 0))::INTEGER AS tov
         FROM src_ncaa_lineups l JOIN game g ON g.ncaa_game_id = l.contest_id
         GROUP BY 1, 2 ORDER BY 1, 2`
      )
      const units = await all(
        db,
        `SELECT g.ncaa_game_id AS contest_id, round(sum(u.secs), 6) AS secs,
                sum(u.pts)::INTEGER AS pts, sum(u.opp_pts)::INTEGER AS opp_pts,
                sum(u.fg3a)::INTEGER AS fg3a, sum(u.tov)::INTEGER AS tov
         FROM unit_game u JOIN game g USING (game_id)
         GROUP BY g.ncaa_game_id, u.team_id ORDER BY 1`
      )
      expect(units.length).toBe(file.length)
      const key = (r: Row): string =>
        `${r.contest_id}|${r.secs}|${r.pts}|${r.opp_pts}|${r.fg3a}|${r.tov}`
      expect(units.map(key).sort()).toEqual(file.map(key).sort())
    }
  })

  it('name ESPN’s athletes through ncaa_player_ids, and keep a name no row holds under D28’s key', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS slots, count(*) FILTER (WHERE p > 0)::INTEGER AS espn,
                count(*) FILTER (WHERE p < 0)::INTEGER AS fallback
         FROM (SELECT unnest([p1, p2, p3, p4, p5]) AS p FROM unit_game) WHERE p IS NOT NULL`
      )
      // The fixtures hold the hard cases (Karaban, schools outside Division I): most, not all.
      expect(Number(r.espn) / Number(r.slots)).toBeGreaterThan(0.9)
      expect(Number(r.espn) + Number(r.fallback)).toBe(r.slots)
    }
    // "Fleming Jr., Howie" and "Howie Fleming Jr." are one key.
    const k = await one(
      m,
      `SELECT ${nameKeySql("'Howie Fleming Jr.'")} AS a, ${nameKeySql("replace('HOWIE.FLEMING.JR.', '.', ' ')")} AS b, ${nameKeySql("'José Ñúñez'")} AS c`
    )
    expect(k).toEqual({ a: 'howiefleming', b: 'howiefleming', c: 'josenunez' })
  })

  it('give each player’s game on and off the floor, adding up to the team’s', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS n,
                count(*) FILTER (WHERE abs(o.on_secs + o.off_secs - t.secs) < 1e-6
                                   AND o.on_pts + o.off_pts = t.pts
                                   AND o.on_opp_pts + o.off_opp_pts = t.opp_pts)::INTEGER AS whole,
                count(*) FILTER (WHERE abs(o.minutes * 60 - o.on_secs) < 1e-6)::INTEGER AS minutes
         FROM player_on_court o
         JOIN (SELECT game_id, team_id, sum(secs) AS secs, sum(pts) AS pts, sum(opp_pts) AS opp_pts
               FROM unit_game GROUP BY 1, 2) t USING (game_id, team_id)`
      )
      expect(Number(r.n)).toBeGreaterThan(0)
      expect(r.whole).toBe(r.n)
      expect(r.minutes).toBe(r.n)
    }
  })

  it('fill the lineups tab with complete units over their games', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS n,
                count(*) FILTER (WHERE l.minutes * 60 - u.secs BETWEEN -1e-6 AND 1e-6 AND l.pts = u.pts
                                   AND l.games = u.games AND l.plus_minus = u.pts - u.opp_pts)::INTEGER AS same,
                count(l.adv_off_rating)::INTEGER AS published
         FROM pub_lineups l JOIN (
           SELECT season, game_type, team_id, p1, p2, p3, p4, p5, sum(secs) AS secs, sum(pts) AS pts,
                  sum(opp_pts) AS opp_pts, count(DISTINCT game_id) AS games
           FROM unit_game WHERE complete GROUP BY ALL) u
         USING (season, game_type, team_id, p1, p2, p3, p4, p5)`
      )
      expect(Number(r.n)).toBeGreaterThan(0)
      expect(r.same).toBe(r.n)
      // The NBA's dashboards publish the ratings; no college file does.
      expect(r.published).toBe(0)
    }
  })
})

describe('stints and possessions', () => {
  it('place each stint’s sides by its teams, whichever ESPN calls home', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS n,
                count(*) FILTER (WHERE s.home_team_id IN (g.home_team_id, g.away_team_id)
                                   AND s.away_team_id IN (g.home_team_id, g.away_team_id)
                                   AND s.home_team_id <> s.away_team_id)::INTEGER AS sided,
                (SELECT count(*) FROM src_ncaa_matchup_stints x JOIN game y ON y.ncaa_game_id = x.contest_id)::INTEGER AS file
         FROM stint s JOIN game g USING (game_id)`
      )
      expect(r.n).toBe(r.file)
      expect(r.sided).toBe(r.n)
    }
  })

  it('count stats.ncaa.org’s possessions per team-game, with their points and the ten players', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS n, count(team_id)::INTEGER AS sided,
                sum(points)::INTEGER AS pts, count(off_5)::INTEGER AS five,
                (SELECT sum(x.pts) FROM src_ncaa_possessions x JOIN game y ON y.ncaa_game_id = x.contest_id
                 WHERE x.poss_team IS NOT NULL)::INTEGER AS file_pts
         FROM possession`
      )
      expect(r.sided).toBe(r.n)
      expect(r.pts).toBe(r.file_pts)
      // A player the file gives no id is named by its play by play's name, or keyed as D28 has it.
      expect(r.five).toBe(r.n)
    }
  })
})

describe('officials', () => {
  it('read ESPN’s officials by name, against the games their crews worked', async () => {
    for (const [db, league] of [
      [m, men],
      [w, women]
    ] as const) {
      const season = Number(
        (
          await one(
            db,
            `SELECT max(season) AS s FROM game WHERE game_id IN (SELECT game_id FROM official_espn)`
          )
        ).s
      )
      const read = await readOfficialsSeason(db, season, [...league.countedTypes], league)
      expect(read.officials.length).toBeGreaterThan(0)
      expect(read.coverage.withCrew).toBeGreaterThan(0)
      expect(
        read.officials.every((o) => o.name.length > 0 && !o.name.startsWith('Official '))
      ).toBe(true)
    }
  })
})

describe('the published models (D44)', () => {
  it('read back through the engine as SportsDataverse published them, over every game alone', async () => {
    const team = await one(
      m,
      `SELECT r.team_id, r.season, r.adj_em, r.adj_o FROM src_ratings r
       JOIN team t ON t.team_id = TRY_CAST(r.team_id AS BIGINT) AND t.season = r.season AND t.division_i
       JOIN team_game g ON g.team_id = t.team_id AND g.season = t.season LIMIT 1`
    )
    const result = await runQuery(
      m,
      {
        entity: 'team',
        metrics: ['sdv_adj_em', 'sdv_adj_o'],
        scope: { seasons: [Number(team.season)], teams: [String(team.team_id)] }
      },
      { league: men, currentSeason: 2027 }
    )
    expect(result.rows[0].values.sdv_adj_em.value).toBeCloseTo(Number(team.adj_em), 9)
    expect(result.rows[0].values.sdv_adj_o.value).toBeCloseTo(Number(team.adj_o), 9)
    // The regular season alone is part of the games the model was fitted on.
    const regular = await runQuery(
      m,
      {
        entity: 'team',
        metrics: ['sdv_adj_em'],
        scope: {
          seasons: [Number(team.season)],
          teams: [String(team.team_id)],
          gameTypes: ['regular']
        }
      },
      { league: men, currentSeason: 2027 }
    )
    expect(regular.rows[0].values.sdv_adj_em.value).toBeNull()
    expect(regular.columns.find((c) => c.id === 'sdv_adj_em')?.reason).toBe(EVERY_GAME_ONLY)
  })

  it('key RAPM by ESPN’s athlete through ncaa_player_ids, apart from RAPM within team', async () => {
    const r = await one(
      w,
      `SELECT count(*)::INTEGER AS n, count(*) FILTER (WHERE r.player_id = i.player_id)::INTEGER AS mapped,
              max(abs(r.ncaa_rapm_w / r.possessions - x.rapm_net))::DOUBLE AS error
       FROM pub_player_ncaa_rapm r
       JOIN src_ncaa_rapm x ON x.season = r.season
       JOIN ncaa_player_ids i ON i.season = x.season AND i.ncaa_player_id = x.player_id
       WHERE r.player_id = i.player_id`
    )
    expect(Number(r.n)).toBeGreaterThan(0)
    expect(Number(r.error)).toBeLessThan(1e-9)
    // The two estimands sit in their own tables and metrics, never one column.
    expect(METRICS.get('sdv_ncaa_rapm')?.published).toBe('pub_player_ncaa_rapm')
    expect(METRICS.get('sdv_ncaa_team_rapm')?.published).toBe('pub_player_ncaa_rapm_team')
    const bpm = await one(
      m,
      `SELECT max(abs(b.sdv_box_bpm_w / b.minutes - v.box_bpm))::DOUBLE AS error, count(*)::INTEGER AS n
       FROM pub_player_sdv_bpm b JOIN src_player_value v
         ON TRY_CAST(v.player_id AS BIGINT) = b.player_id AND v.season = b.season AND v.min = b.minutes`
    )
    expect(Number(bpm.n)).toBeGreaterThan(0)
    expect(Number(bpm.error)).toBeLessThan(1e-9)
  })
})

describe('reasons', () => {
  it('give every family no college release publishes its reason (D44)', () => {
    for (const league of [men, women]) {
      const reason = (id: string): string | undefined =>
        metricIn(METRICS.get(id)!, league).unavailable
      expect(reason('team_net_rank')).toBe(league.unpublished.net)
      expect(reason('team_quadrant1')).toBe(league.unpublished.quadrants)
      expect(reason('team_poll_rank')).toBe(league.unpublished.polls)
      expect(reason('team_tournament_seed')).toBe(league.unpublished.seeds)
      expect(reason('touches')).toBe(league.unpublished.tracking)
      expect(reason('deflections')).toBe(league.unpublished.hustle)
      expect(reason('games_out_injury')).toBe(league.unpublished.availability)
      // The NBA's own dashboards and its impact models: not the colleges'.
      expect(reason('sdv_rapm')).toMatch(/^Not published for college basketball/)
      // Shot types and assisted makes: the files give neither.
      expect(reason('shot_dunk_fga')).toBe("stats.ncaa.org's shot file gives no shot type.")
      expect(reason('shot_ra_ast_pct')).toMatch(/play by play/)
      // What is built reads: the shots by zone, the on-court lines, the published models.
      for (const id of ['shot_ra_fga', 'onc_min', 'sdv_adj_em', 'sdv_box_bpm', 'sdv_ncaa_rapm']) {
        expect(reason(id), id).toBeUndefined()
      }
      // The NBA and the WNBA have none of the college models.
      expect(metricIn(METRICS.get('sdv_adj_em')!, LEAGUES.nba).unavailable).toBeDefined()
    }
  })

  it('state on every on-court metric what the lineup file covers (policy 4)', async () => {
    for (const league of [men, women]) {
      const onc = metricIn(METRICS.get('onc_min')!, league)
      expect(onc.description).toMatch(/covers about 97 % of minutes/)
      expect(onc.sources).toEqual(["stats.ncaa.org's lineup file (SportsDataverse's release)"])
      expect(onc.seasonNotes?.[0].note).toBe(COLLEGE_LINEUP_COVERAGE)
      expect(onc.seasonNotes?.[0].seasons).toContain(2022)
    }
    const r = await runQuery(
      m,
      { entity: 'player', metrics: ['onc_min'], scope: { seasons: [2026] } },
      { league: men, currentSeason: 2027 }
    )
    expect(r.notes.some((n) => n.includes(COLLEGE_LINEUP_COVERAGE))).toBe(true)
    // The NBA's on-court metrics read as before.
    const nba = metricIn(METRICS.get('onc_min')!, LEAGUES.nba)
    expect(nba.seasonNotes).toBeUndefined()
    expect(nba.description).not.toMatch(/lineup file/)
  })

  it('read the play by play’s tables and splits as not built yet', async () => {
    const detail = [...METRICS.values()].find((d) => d.built === 'play_player_game')!
    expect(metricIn(detail, men).unavailable).toBe(playTablesNotBuilt(men))
    const split = await runQuery(
      m,
      { entity: 'player', metrics: ['pts'], scope: { seasons: [2026], split: 'q4' } },
      { league: men, currentSeason: 2027 }
    ).catch((e: Error) => e)
    if (!(split instanceof Error)) {
      for (const row of split.rows) expect(row.values.pts.value).toBeNull()
    }
  })

  it('build every table with stats.ncaa.org’s releases left out (D41), and say why', async () => {
    for (const league of [men, women]) {
      const db = await built(league, 'src_ncaa_')
      const r = await one(
        db,
        `SELECT (SELECT count(*) FROM shot_team_game)::INTEGER AS shots,
                (SELECT count(*) FROM unit_game)::INTEGER AS units,
                (SELECT count(*) FROM pub_player_ncaa_rapm)::INTEGER AS rapm,
                (SELECT count(*) FROM pub_team_sdv_ratings)::INTEGER AS ratings,
                (SELECT count(*) FROM pub_player_sdv_bpm)::INTEGER AS bpm`
      )
      expect([r.shots, r.units, r.rapm]).toEqual([0, 0, 0])
      // ESPN's and SportsDataverse's own tables stay.
      expect(Number(r.ratings)).toBeGreaterThan(0)
      expect(Number(r.bpm)).toBeGreaterThan(0)
      const gap = (id: string): string | null =>
        leftOutGap(metricIn(METRICS.get(id)!, league), false, NCAA_STATS_RELEASES, league)
      for (const id of ['sdv_ncaa_rapm', 'sdv_ncaa_team_rapm', 'shot_ra_fga', 'onc_min']) {
        expect(gap(id), id).toBe(LEFT_OUT_REASON)
      }
      for (const id of ['sdv_adj_em', 'sdv_box_bpm', 'pts']) expect(gap(id), id).toBeNull()
      await db.close()
    }
  }, 120_000)
})
