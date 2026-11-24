import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import { buildDerived, DERIVED_RECIPES, derivedRecipe } from '@main/stats/derived/build'
import { NBA_DERIVED, PLAYER_SUMS, TEAM_SUMS } from '@main/stats/derived/game'
import { NCAA_PLAYER_SUMS, NCAA_TEAM_SUMS } from '@main/stats/derived/ncaaSplits'
import { runQuery } from '@main/stats/engine/run'
import { buildIdentity } from '@main/stats/identity'
import { LEAGUES, type League } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'
import { slow } from '../../fixtures/timeouts'

/**
 * The college recipe for the game and season tables (Plan T1302.5, D40), on T1302.4's fixtures cut from
 * the first loads (`college-identity`), with ESPN's team box for the same games (`college-derived`).
 * They hold every trap of the build: a forfeit (Albany against Vermont's 2-0, men, and a women's one),
 * an exhibition only stats.ncaa.org has (Clemson against Georgia Southwestern), a counted game only it
 * has (Alabama State against Tuskegee), the women's WNIT final, a WBIT game and a regular-season game
 * ESPN lacks, Alex Karaban's lines the crosswalk lacks, a game of every event.
 */
const FIXTURES = join(__dirname, '../../fixtures')
const men = LEAGUES.ncaam
const women = LEAGUES.ncaaw
const CLEMSON_EXHIBITION = 'ncaa:2139618'
const TUSKEGEE = 'ncaa:2142614'
const MEN_FORFEIT = '401370817'
const WOMEN_FORFEIT = '401369584'
const WNIT_FINAL = '401762436'
const KARABAN = 4917149

async function load(db: StatsDb, league: League, without = ''): Promise<void> {
  for (const dir of ['college-identity', 'college-derived']) {
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
  return db
}

type Row = Record<string, number | string | boolean | null>
const one = async (db: StatsDb, sql: string, params: (string | number)[] = []): Promise<Row> =>
  (await db.get<Row>(sql, params)) ?? {}

let m: StatsDb
let w: StatsDb
beforeAll(async () => {
  m = await built(men)
  w = await built(women)
}, slow(60_000))

describe('the recipe', () => {
  it('is one for both leagues, keyed by the game, reading ESPN for the counts', () => {
    expect(derivedRecipe(men)).toBe(DERIVED_RECIPES.college)
    expect(derivedRecipe(women)).toBe(DERIVED_RECIPES.college)
    const recipe = DERIVED_RECIPES.college
    expect(recipe.teamBoxKey).toBe('game_id')
    expect(recipe.needs.some((t) => t.startsWith('src_ncaa_'))).toBe(false)
    expect(recipe.extras?.player).toEqual(NCAA_PLAYER_SUMS)
    // The NBA's and the WNBA's recipes carry none of the college columns.
    expect(NBA_DERIVED.extras).toBeUndefined()
    expect(DERIVED_RECIPES.wnba.extras).toBeUndefined()
    expect(PLAYER_SUMS.some((c) => c.startsWith('ncaa_'))).toBe(false)
    expect(TEAM_SUMS.some((c) => c.includes('ncaa_'))).toBe(false)
  })

  it('writes the shared columns, then stats.ncaa.org’s beside them, in the season tables too', async () => {
    const columns = async (db: StatsDb, table: string): Promise<string[]> =>
      (
        await db.all<{ c: string }>(
          `SELECT column_name AS c FROM duckdb_columns() WHERE table_name = '${table}'`
        )
      ).map((r) => r.c)
    for (const db of [m, w]) {
      expect(await columns(db, 'player_game')).toEqual(
        expect.arrayContaining([...PLAYER_SUMS, ...NCAA_PLAYER_SUMS])
      )
      expect(await columns(db, 'team_game')).toEqual(
        expect.arrayContaining([...TEAM_SUMS, ...NCAA_TEAM_SUMS])
      )
      expect(await columns(db, 'player_season')).toEqual(
        expect.arrayContaining([...NCAA_PLAYER_SUMS])
      )
      expect(await columns(db, 'team_season')).toEqual(expect.arrayContaining([...NCAA_TEAM_SUMS]))
    }
  })
})

describe('the box scores', () => {
  it('reads each team-game’s lines from one source, ESPN’s where it has any', async () => {
    for (const db of [m, w]) {
      const mixed = await one(
        db,
        `SELECT count(*)::INTEGER AS n FROM (
           SELECT game_id, team_id FROM player_game GROUP BY 1, 2 HAVING count(DISTINCT source) > 1)`
      )
      expect(mixed.n).toBe(0)
      // ESPN's team-games read ESPN's lines; the games ESPN lacks, stats.ncaa.org's.
      const wrong = await one(
        db,
        `SELECT count(*)::INTEGER AS n FROM player_game p JOIN game g USING (game_id)
         WHERE (g.source = 'ncaa') <> (p.source = 'ncaa')`
      )
      expect(wrong.n).toBe(0)
    }
    // The women's WNIT final of 2024-25, which ESPN lacks: stats.ncaa.org's lines and team box.
    const final = await w.all<Row>(
      `SELECT t.source, t.pts, n.pts AS ncaa_pts, (SELECT sum(pts) FROM player_game p
         WHERE p.game_id = t.game_id AND p.team_id = t.team_id) AS players
       FROM team_game t JOIN game g USING (game_id)
       JOIN src_ncaa_team_box n ON n.contest_id = g.ncaa_game_id
        AND TRY_CAST(n.team_espn_team_id AS INTEGER) = t.team_id
       WHERE t.game_id = ?`,
      [WNIT_FINAL]
    )
    expect(final).toHaveLength(2)
    for (const r of final)
      expect([r.source, r.pts, r.players]).toEqual(['ncaa', r.ncaa_pts, r.ncaa_pts])
  })

  it(
    'reads a game from one source when ESPN files both sides’ players under one team',
    async () => {
      // NCAA Women's Lamar against Texas College (2023-11-08): ESPN listed all 25 players as Lamar's and
      // had no line for Texas College, whose 12 stats.ncaa.org lines were then read too, so those 12 were
      // counted twice, under both teams. Here a fixture game both sources cover is given ESPN's mistake.
      const db = await openTestDb()
      await load(db, women)
      await buildIdentity(db, women)
      await buildDerived(db, women)
      const game = await one(
        db,
        `SELECT g.game_id, g.espn_game_id, g.home_team_id, g.away_team_id FROM game g
       WHERE g.source = 'espn' AND g.played AND g.game_id IN (
         SELECT game_id FROM player_game WHERE source = 'espn' AND ncaa_seconds IS NOT NULL
         GROUP BY 1 HAVING count(DISTINCT team_id) = 2)
       ORDER BY g.game_id LIMIT 1`
      )
      expect(game.game_id).toBeTruthy()
      await db.exec(`UPDATE src_espn_player_box SET home_away = 'home' WHERE game_id = ?`, [
        game.espn_game_id as number
      ])
      await buildDerived(db, women)
      const twice = await one(
        db,
        `SELECT count(*)::INTEGER AS n FROM (
         SELECT game_id, player_id FROM player_game GROUP BY 1, 2 HAVING count(*) > 1)`
      )
      expect(twice.n).toBe(0)
      const sides = await db.all<Row>(
        `SELECT p.team_id, min(p.source) AS source, max(p.source) AS last, sum(p.pts)::INTEGER AS players,
              max(t.pts)::INTEGER AS team
       FROM player_game p JOIN team_game t USING (game_id, team_id)
       WHERE p.game_id = ? GROUP BY 1 ORDER BY 1`,
        [game.game_id as string]
      )
      // Both teams, every line stats.ncaa.org's, each team's players adding up to its own score.
      expect(sides.map((s) => s.team_id).sort()).toEqual(
        [game.home_team_id, game.away_team_id].sort()
      )
      for (const s of sides) {
        expect([s.source, s.last]).toEqual(['ncaa', 'ncaa'])
        expect(s.players).toBe(s.team)
      }
      db.close()
    },
    slow(60_000)
  )

  it('reads ESPN’s team box for a team’s counts, which hold the team rebounds and turnovers', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS n,
                count(*) FILTER (WHERE t.pts = e.team_score AND t.fga = e.field_goals_attempted
                                   AND t.reb = e.total_rebounds AND t.tov = e.turnovers)::INTEGER AS same,
                count(*) FILTER (WHERE t.reb >= p.reb AND t.tov >= p.tov)::INTEGER AS at_least
         FROM team_game t JOIN game g USING (game_id)
         JOIN src_espn_team_box e ON e.game_id = g.espn_game_id AND e.team_id = t.team_id
         JOIN (SELECT game_id, team_id, sum(reb) AS reb, sum(tov) AS tov FROM player_game GROUP BY 1, 2) p
           ON p.game_id = t.game_id AND p.team_id = t.team_id`
      )
      expect(r.n).toBeGreaterThan(10)
      expect(r.same).toBe(r.n)
      expect(r.at_least).toBe(r.n)
    }
  })

  it('keeps a forfeit in the record with no box score', async () => {
    for (const [db, game] of [
      [m, MEN_FORFEIT],
      [w, WOMEN_FORFEIT]
    ] as const) {
      const sides = await db.all<Row>(
        `SELECT t.wins, t.losses, t.box_games, t.source, t.team_id = g.forfeit_winner_id AS winner
         FROM team_game t JOIN game g USING (game_id) WHERE t.game_id = ? ORDER BY t.wins DESC`,
        [game]
      )
      expect(sides).toEqual([
        { wins: 1, losses: 0, box_games: 0, source: null, winner: true },
        { wins: 0, losses: 1, box_games: 0, source: null, winner: false }
      ])
      expect(
        (await one(db, 'SELECT count(*)::INTEGER AS n FROM player_game WHERE game_id = ?', [game]))
          .n
      ).toBe(0)
    }
  })

  it('keeps an exhibition’s box score as such, which no counted total reads (D45)', async () => {
    const ex = await m.all<Row>(
      `SELECT game_type, source, count(*)::INTEGER AS lines FROM player_game WHERE game_id = ? GROUP BY 1, 2`,
      [CLEMSON_EXHIBITION]
    )
    expect(ex).toEqual([{ game_type: 'preseason', source: 'ncaa', lines: expect.any(Number) }])
    // A Clemson player's games over every counted game leave it out; asked for, it is there.
    const player = await one(
      m,
      `SELECT player_id FROM player_game WHERE game_id = ? AND team_id = 228 ORDER BY pts DESC LIMIT 1`,
      [CLEMSON_EXHIBITION]
    )
    const games = async (gameTypes?: string[]): Promise<number> =>
      (
        await runQuery(
          m,
          {
            entity: 'player',
            metrics: ['gp'],
            scope: {
              seasons: [2022],
              players: [String(player.player_id)],
              ...(gameTypes ? { gameTypes: gameTypes as never } : {})
            }
          },
          { league: men, currentSeason: 2027 }
        )
      ).rows[0]?.games ?? 0
    expect(await games(['preseason'])).toBe(1)
    expect(await games()).toBe(
      (await games(['preseason', 'regular', 'playoffs', 'nit', 'cbi', 'tbc'])) - 1
    )
    // The counted game only stats.ncaa.org has is a regular-season game with its box score.
    const tuskegee = await one(
      m,
      `SELECT game_type, source, box_games FROM team_game WHERE game_id = ? AND team_id = 2011`,
      [TUSKEGEE]
    )
    expect(tuskegee).toEqual({ game_type: 'regular', source: 'ncaa', box_games: 1 })
  })
})

describe('stats.ncaa.org beside ESPN (D40)', () => {
  it('puts each player’s stats.ncaa.org splits on their ESPN line, never in its counts', async () => {
    // Karaban: the crosswalk lacks him in 2025-26, and his lines are matched by box score (T1302.4).
    const karaban = await m.all<Row>(
      `SELECT p.source, p.pts, p.fga, p.ncaa_games, p.ncaa_pts, p.ncaa_fga, p.ncaa_rima, p.ncaa_mida,
              p.ncaa_fg3a, e.points AS espn_pts, e.field_goals_attempted AS espn_fga
       FROM player_game p JOIN game g USING (game_id)
       JOIN src_espn_player_box e ON e.game_id = g.espn_game_id AND e.athlete_id = p.player_id
       WHERE p.player_id = ?`,
      [KARABAN]
    )
    expect(karaban.length).toBeGreaterThan(0)
    for (const r of karaban) {
      // ESPN's counts are the line's; stats.ncaa.org's sit beside them, under their own names.
      expect([r.source, r.pts, r.fga]).toEqual(['espn', r.espn_pts, r.espn_fga])
      expect(r.ncaa_games).toBe(1)
      expect(Number(r.ncaa_rima) + Number(r.ncaa_mida) + Number(r.ncaa_fg3a)).toBe(r.ncaa_fga)
    }
  })

  it('sums every stats.ncaa.org line of a team, linked to ESPN or not, and its team box’s possessions and seconds', async () => {
    for (const db of [m, w]) {
      const r = await one(
        db,
        `WITH lines AS (
           SELECT g.game_id, TRY_CAST(b.team_espn_team_id AS INTEGER) AS team_id, sum(b.fga) AS fga,
                  sum(b.pts_trans) AS pts_trans
           FROM src_ncaa_player_box b JOIN game g ON g.ncaa_game_id = b.contest_id
           WHERE g.forfeit_winner_id IS NULL GROUP BY 1, 2
         )
         SELECT count(*)::INTEGER AS n,
                count(*) FILTER (WHERE t.ncaa_fga = l.fga AND t.ncaa_pts_trans = l.pts_trans)::INTEGER AS same,
                count(*) FILTER (WHERE t.ncaa_poss = n.o_poss AND o.ncaa_poss = t.opp_ncaa_poss)::INTEGER AS poss,
                count(*) FILTER (WHERE abs(t.ncaa_off_seconds - n.o_mins * 60) < 1e-6
                  AND o.ncaa_off_seconds = t.opp_ncaa_off_seconds)::INTEGER AS seconds
         FROM team_game t JOIN lines l USING (game_id, team_id)
         JOIN game g USING (game_id)
         JOIN src_ncaa_team_box n ON n.contest_id = g.ncaa_game_id AND TRY_CAST(n.team_espn_team_id AS INTEGER) = t.team_id
         JOIN team_game o ON o.game_id = t.game_id AND o.team_id = t.opponent_id`
      )
      expect(r.n).toBeGreaterThan(10)
      expect(r.same).toBe(r.n)
      expect(r.poss).toBe(r.n)
      // The offence's time on the ball, the team box's minutes in seconds, and the opponent's beside it.
      expect(r.seconds).toBe(r.n)
    }
  })

  it('reads its splits per game of a stats.ncaa.org line, and its rates over its own counts', async () => {
    const result = await runQuery(
      w,
      {
        entity: 'team',
        metrics: ['team_ncaa_rim_pct', 'team_ncaa_poss', 'team_ncaa_rtg', 'opp_ncaa_rtg'],
        scope: { seasons: [2025] },
        transform: 'perGame'
      },
      { league: women, currentSeason: 2027 }
    )
    expect(result.rows.length).toBeGreaterThan(0)
    for (const row of result.rows) {
      const sums = await one(
        w,
        `SELECT sum(ncaa_rimm) / sum(ncaa_rima) AS rim, sum(ncaa_poss) / sum(ncaa_games) AS poss,
                100.0 * sum(ncaa_pts) / sum(ncaa_poss) AS rtg, 100.0 * sum(opp_ncaa_pts) / sum(opp_ncaa_poss) AS drtg
         FROM team_game WHERE team_id = ? AND season = 2025 AND game_type <> 'preseason'`,
        [Number(row.id)]
      )
      expect(row.values.team_ncaa_rim_pct.value).toBeCloseTo(Number(sums.rim), 9)
      expect(row.values.team_ncaa_poss.value).toBeCloseTo(Number(sums.poss), 9)
      expect(row.values.team_ncaa_rtg.value).toBeCloseTo(Number(sums.rtg), 9)
      expect(row.values.opp_ncaa_rtg.value).toBeCloseTo(Number(sums.drtg), 9)
    }
  })

  it('builds from ESPN’s tables alone when the stats.ncaa.org releases are left out (D41)', async () => {
    for (const league of [men, women]) {
      const db = await built(league, 'src_ncaa_')
      const r = await one(
        db,
        `SELECT count(*)::INTEGER AS lines, count(ncaa_games)::INTEGER AS ncaa,
                count(*) FILTER (WHERE source = 'ncaa')::INTEGER AS from_ncaa FROM player_game`
      )
      expect(r.lines).toBeGreaterThan(100)
      expect([r.ncaa, r.from_ncaa]).toEqual([0, 0])
      const t = await one(
        db,
        'SELECT count(ncaa_poss)::INTEGER AS n, count(*)::INTEGER AS all FROM team_game'
      )
      expect(t.n).toBe(0)
      expect(t.all).toBeGreaterThan(10)
      db.close()
    }
  })
})
