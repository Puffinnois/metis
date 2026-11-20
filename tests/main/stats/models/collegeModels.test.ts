import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { inspect } from '@main/stats/derived/sql'
import { runQuery } from '@main/stats/engine/run'
import { buildIdentity } from '@main/stats/identity'
import { ADJUSTED_RATINGS, ADJUSTED_TABLE } from '@main/stats/models/adjustedRatings'
import { buildModels, type ModelContext, type ModelTable } from '@main/stats/models/build'
import { COMPUTED_EVERY_GAME, NOT_RATED } from '@main/stats/models/divisionI'
import { eloShift, regress, runSeason, seasonStart, winProbability } from '@main/stats/models/elo'
import {
  addBoxes,
  possessions,
  type Box,
  type LeagueSeason,
  type TeamSeason
} from '@main/stats/models/box'
import { neutralSitesSql } from '@main/stats/models/neutral'
import type { OliverDefense, OliverOffense } from '@main/stats/models/oliver'
import { marginalPointsPerWin, winShares } from '@main/stats/models/winShares'
import { ELO_GAME_TABLE, TEAM_ELO, TEAM_ELO_TABLES } from '@main/stats/models/teamElo'
import { TEAM_STRENGTH } from '@main/stats/models/teamStrength'
import {
  COLLEGE_NO_BPM,
  COLLEGE_NO_FORECAST,
  LEAGUES,
  modelsOf,
  type League
} from '@shared/leagues'
import { CATALOGUE, metricIn } from '@shared/stats/catalogue'
import { openTestDb } from '../../../fixtures/stats'

/**
 * Plan T1302.8: the college leagues' models on their own constants. A small league worked by hand
 * (three Division I teams, a team outside the division, a forfeit, an exhibition, an NIT game at a
 * neutral site, a school joining the division the next season while another leaves it), then the
 * whole step on T1302.4's fixtures cut from the real loads, with stats.ncaa.org's releases and without.
 */
const men = LEAGUES.ncaam
const women = LEAGUES.ncaaw
const def = (id: string): (typeof CATALOGUE)[number] => CATALOGUE.find((d) => d.id === id)!

const A = 1
const B = 2
const C = 3
const D = 4
const X = 9

/** game_id, season, type, date, home, away, home score, away score, neutral, forfeit winner. */
type G = [string, number, string, string, number, number, number, number, boolean, number | null]
const GAMES: G[] = [
  // An exhibition against a team outside Division I: never rated.
  ['e', 2023, 'preseason', '2022-11-01', A, X, 90, 40, false, null],
  ['g1', 2023, 'regular', '2022-11-10', A, B, 80, 70, false, null],
  ['g2', 2023, 'regular', '2022-11-12', B, C, 75, 70, false, null],
  ['g3', 2023, 'regular', '2022-11-15', C, A, 60, 66, false, null],
  // Outside Division I: in the record, not in a rating.
  ['g4', 2023, 'regular', '2022-11-20', A, X, 100, 50, false, null],
  // A forfeit, ESPN's 2-0: no score goes into a fit.
  ['g5', 2023, 'regular', '2022-12-01', B, C, 2, 0, false, B],
  // The NIT at a neutral site, A listed at home.
  ['g6', 2023, 'nit', '2023-03-20', A, B, 64, 60, true, null],
  // The next season: C has left the division, D has joined it.
  ['h1', 2024, 'regular', '2023-11-10', D, A, 70, 72, false, null],
  ['h2', 2024, 'regular', '2023-11-12', B, D, 68, 61, false, null]
]

async function smallLeague(): Promise<StatsDb> {
  const db = await openTestDb()
  await db.exec(`CREATE OR REPLACE TABLE game (game_id VARCHAR, season INTEGER, game_type VARCHAR,
    game_date DATE, home_team_id INTEGER, away_team_id INTEGER, home_score BIGINT,
    away_score BIGINT, played BOOLEAN, neutral BOOLEAN, forfeit_winner_id INTEGER)`)
  for (const [id, season, type, date, home, away, hs, as, neutral, forfeit] of GAMES) {
    await db.exec('INSERT INTO game VALUES (?, ?, ?, ?::DATE, ?, ?, ?, ?, true, ?, ?)', [
      id,
      season,
      type,
      date,
      home,
      away,
      hs,
      as,
      neutral,
      forfeit
    ])
  }
  await db.exec(`CREATE OR REPLACE TABLE team (season INTEGER, team_id INTEGER, conference VARCHAR,
    division VARCHAR, division_i BOOLEAN)`)
  const teams: [number, number, boolean][] = [
    [2023, A, true],
    [2023, B, true],
    [2023, C, true],
    [2023, X, false],
    [2024, A, true],
    [2024, B, true],
    [2024, C, false],
    [2024, D, true]
  ]
  for (const [season, team, d1] of teams) {
    await db.exec("INSERT INTO team VALUES (?, ?, 'Conf', NULL, ?)", [season, team, d1])
  }
  // Each side's points and the game's possessions, 70 a game, for the adjusted ratings.
  await db.exec(`CREATE OR REPLACE TABLE team_game AS
    SELECT game_id, season, game_type, home_team_id AS team_id, home_score AS pts, 70.0 AS poss_sym
    FROM game WHERE forfeit_winner_id IS NULL
    UNION ALL
    SELECT game_id, season, game_type, away_team_id, away_score, 70.0 FROM game
    WHERE forfeit_winner_id IS NULL`)
  return db
}

async function context(db: StatsDb, season: number, league: League): Promise<ModelContext> {
  return { db, have: await inspect(db), season, current: 2027, changed: [season], league }
}

async function insert(
  db: StatsDb,
  t: ModelTable,
  rows: ReadonlyArray<Record<string, unknown>>
): Promise<void> {
  for (const row of rows) {
    const names = t.columns.map(([n]) => n)
    await db.exec(
      `INSERT INTO ${t.table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
      names.map((n) => (row[n] ?? null) as string | number | boolean | null)
    )
  }
}

describe("the college leagues' constants", () => {
  it('are each league’s own, fitted, and differ where the men and women differ', () => {
    const m = modelsOf(men)
    const w = modelsOf(women)
    expect(m.elo).toMatchObject({ start: 1500, mean: 1500, k: 48, homeCourt: 90, carry: 0.75 })
    expect(m.pythagoreanExponent).toBe(8.6)
    expect(w.pythagoreanExponent).toBe(6.6)
    expect(m.elo.firstSeason).toBe(2023)
    expect(w.elo.firstSeason).toBe(2023)
    expect(m.eloGameTypes).toEqual(['regular', 'playoffs', 'nit', 'cbi', 'cit', 'tbc', 'crown'])
    expect(w.solvedTypes).toEqual(['regular', 'playoffs', 'wnit', 'wbi', 'wbit'])
    for (const x of [m, w]) {
      expect(x.everyGame).toBe(true)
      expect(x.pairMoves).toBe(false)
      expect(x.neutral.fromGame).toBe(true)
      expect(x.forecastUnavailable).toBe(COLLEGE_NO_FORECAST)
      expect(x.bpmUnavailable).toBe(COLLEGE_NO_BPM)
    }
    expect(men.builds).toContain('models')
    expect(women.builds).toContain('models')
    // The NBA's and the WNBA's keep their own rules.
    expect(LEAGUES.nba.models.solvedTypes).toBeUndefined()
    expect(LEAGUES.wnba.models.everyGame).toBeUndefined()
  })

  it('reads the Pythagorean record with each league’s exponent', () => {
    const evaluate = (sql: string, pf: number, pa: number): number =>
      Function(
        'pow',
        'nullif',
        `return ${sql
          .replace(/\{points_for\}/g, String(pf))
          .replace(/\{points_against\}/g, String(pa))}`
      )(Math.pow, (x: number) => x)
    const m = metricIn(def('team_pyth_pct'), men)
    expect(m.value).toBe(
      'pow({points_for}, 8.6) / nullif(pow({points_for}, 8.6) + pow({points_against}, 8.6), 0)'
    )
    // 2,300 points for and 2,100 against: 1 / (1 + (2100 / 2300)^8.6) = 0.6862.
    expect(evaluate(m.value, 2300, 2100)).toBeCloseTo(1 / (1 + (2100 / 2300) ** 8.6), 12)
    expect(1 / (1 + (2100 / 2300) ** 8.6)).toBeCloseTo(0.6862, 4)
    // The women's 6.6 on the same scores: 0.646.
    expect(evaluate(metricIn(def('team_pyth_pct'), women).value, 2300, 2100)).toBeCloseTo(0.646, 3)
    expect(metricIn(def('team_pyth_pct'), men).description).toContain('power 8.6')
  })

  it('reads Win Shares per 40 minutes and PER over every counted game', () => {
    const ws = metricIn(def('ws_48'), men)
    expect(ws.value).toBe('40 * {ws} / nullif({cmp_minutes}, 0)')
    expect(ws.short).toBe('WS/40')
    expect(metricIn(def('per'), women).description).toContain(
      "over every game of a season, against Division I's totals"
    )
  })

  it('credits Win Shares by Sports Reference’s college constants, by hand', () => {
    expect(modelsOf(men).winShares).toEqual({ offense: 0.875, defense: 1.125, perWin: 0.5 })
    expect(modelsOf(women).winShares).toEqual(modelsOf(men).winShares)
    expect(LEAGUES.nba.models.winShares).toBeUndefined()
    const box = (o: Partial<Box>): Box => ({
      mp: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      oreb: 0,
      dreb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      pf: 0,
      pts: 0,
      ...o
    })
    // A team and its opponents alike but for the score, 30 games, the league the two of them: each
    // side's possessions 1800 + 0.4 × 600 − 1.07 × 300 / 1000 × 1000 + 400 = 2119, so the team's pace is
    // the league's and the league scores 4200 / 60 = 70 a team-game, 4200 / 4238 a possession.
    const side = { mp: 6000, fga: 1800, fgm: 800, fta: 600, oreb: 300, dreb: 700, tov: 400 }
    const ts: TeamSeason = {
      team: box({ ...side, pts: 2200 }),
      opp: box({ ...side, pts: 2000 }),
      games: 30
    }
    const l: LeagueSeason = { totals: addBoxes([ts.team, ts.opp]), teamGames: 60, poss: 4238 }
    expect(possessions(ts)).toBeCloseTo(2119, 9)
    const k = modelsOf(men).winShares!
    // A win costs 0.5 × 70 = 35 points, against the NBA's 0.32 × 70 = 22.4.
    expect(marginalPointsPerWin(ts, l, k.perWin)).toBeCloseTo(35, 9)
    expect(marginalPointsPerWin(ts, l)).toBeCloseTo(22.4, 9)
    const ppp = 4200 / 4238
    const p = box({ mp: 1000 })
    const off = { pprod: 400, totPoss: 350 } as OliverOffense
    const def = { drtg: 95 } as OliverDefense
    const ws = winShares(p, off, def, ts, l, k)
    // Offense: (400 − 0.875 × ppp × 350) / 35; defense: 1000 / 6000 × 2119 × (1.125 × ppp − 0.95) / 35.
    expect(ws.ows).toBeCloseTo((400 - 0.875 * ppp * 350) / 35, 9)
    expect(ws.dws).toBeCloseTo(((1000 / 6000) * 2119 * (1.125 * ppp - 0.95)) / 35, 9)
    expect(ws.ows).toBeCloseTo(2.757, 3)
    expect(ws.dws).toBeCloseTo(1.664, 3)
  })

  it('gives the forecast and BPM their reasons, and Elo its burn-in', () => {
    for (const league of [men, women]) {
      expect(metricIn(def('team_playoff_pct'), league).unavailable).toBe(COLLEGE_NO_FORECAST)
      expect(metricIn(def('team_proj_w'), league).unavailable).toBe(COLLEGE_NO_FORECAST)
      for (const id of ['bpm', 'obpm', 'dbpm', 'vorp', 'team_vorp']) {
        expect(metricIn(def(id), league).unavailable).toBe(COLLEGE_NO_BPM)
      }
      const elo = metricIn(def('team_elo'), league)
      expect(elo.unavailable).toBeUndefined()
      expect(elo.missingSeasons).toEqual([2022])
      expect(elo.missingReason).toBe(
        'Elo is read from 2022-23: every team starts at 1500 in 2021-22, the first season loaded, which settles the ratings.'
      )
      expect(metricIn(def('team_srs'), league).description).toContain(
        'a game against a team outside Division I counts in the record'
      )
      expect(metricIn(def('per'), league).unavailable).toBeUndefined()
      expect(metricIn(def('team_adj_nrtg'), league).unavailable).toBeUndefined()
    }
  })
})

describe('a small college league, by hand', () => {
  let db: StatsDb
  beforeAll(async () => {
    db = await smallLeague()
  })

  it('takes the neutral site from the game table', async () => {
    const rows = await db.all<{ game_id: string; neutral: boolean }>(
      `${neutralSitesSql(await inspect(db), { from: 2023, to: 2023 }, modelsOf(men).neutral)} ORDER BY 1`
    )
    expect(rows.filter((r) => r.neutral).map((r) => r.game_id)).toEqual(['g6'])
  })

  it('solves SRS on games between Division I teams alone, every counted type, tagged by type', async () => {
    const rows = (await TEAM_STRENGTH.build(await context(db, 2023, men)))!.team_strength
    // The last row of each team: after g6 for A and B, after g3 for C.
    const last = new Map<number, Record<string, unknown>>()
    for (const r of rows) last.set(Number(r.team_id), r)
    // A: +10, +6, +4 (never X's +50); B: −10, +5, −4; C: −5, −6. SRS = MOV + mean opponents'
    // SRS, centred: A 71/15, B −16/15, C −11/3.
    expect(last.get(A)!.mov).toBeCloseTo(20 / 3, 12)
    expect(last.get(A)!.srs).toBeCloseTo(71 / 15, 12)
    expect(last.get(B)!.srs).toBeCloseTo(-16 / 15, 12)
    expect(last.get(C)!.srs).toBeCloseTo(-11 / 3, 12)
    expect(last.get(A)!.srs_games).toBe(3)
    expect(last.get(A)!.game_type).toBe('nit')
    expect(last.get(C)!.game_type).toBe('regular')
    expect(rows.some((r) => r.team_id === X)).toBe(false)
    expect(rows.map((r) => r.game_id)).not.toContain('g5')
  })

  it('runs Elo on the league’s constants, carried with no team paired to the one gone', async () => {
    const k = 48
    const home = 90
    const c0 = await context(db, 2023, men)
    const first = (await TEAM_ELO.build(c0))![ELO_GAME_TABLE]
    expect([...new Set(first.map((r) => r.game_id))]).toEqual(['g1', 'g2', 'g3', 'g6'])
    // By hand: every team at 1500 in the first season.
    let a = 1500
    let b = 1500
    let c = 1500
    const play = (h: number, w: number, margin: number, court: number): [number, number] => {
      const s = eloShift(h + court - w, margin, k)
      return [h + s, w - s]
    }
    ;[a, b] = play(a, b, 10, home)
    ;[b, c] = play(b, c, 5, home)
    ;[c, a] = play(c, a, -6, home)
    ;[a, b] = play(a, b, 4, 0)
    const end = new Map(first.map((r) => [Number(r.team_id), Number(r.elo)]))
    expect(end.get(A)).toBeCloseTo(a, 9)
    expect(end.get(B)).toBeCloseTo(b, 9)
    expect(end.get(C)).toBeCloseTo(c, 9)
    const g6 = first.find((r) => r.game_id === 'g6' && r.team_id === A)!
    expect(g6.neutral).toBe(true)
    expect(g6.home_court).toBe(0)
    expect(g6.game_type).toBe('nit')
    // The first game's win probability at home court 90: 1 / (1 + 10^(−90/400)) = 0.6267.
    const g1 = first.find((r) => r.game_id === 'g1' && r.team_id === A)!
    expect(g1.win_prob).toBeCloseTo(winProbability(90), 12)
    expect(winProbability(90)).toBeCloseTo(0.6267, 4)
    // Margin 10 at an edge of 90: 48 × (13^0.8 / (7.5 + 0.54)) × (1 − 0.6267).
    expect(eloShift(90, 10, 48)).toBeCloseTo(
      48 * (Math.pow(13, 0.8) / (7.5 + 0.006 * 90)) * (1 - winProbability(90)),
      12
    )

    // The next season: A and B carried three quarters of the way, D new at 1350, never C's rating
    // (C left the division the season D joined it).
    await insert(db, TEAM_ELO_TABLES[0], first)
    const second = (await TEAM_ELO.build(await context(db, 2024, men)))![ELO_GAME_TABLE]
    const h1 = second.find((r) => r.game_id === 'h1' && r.team_id === D)!
    expect(h1.elo_pre).toBe(1350)
    expect(h1.opp_elo_pre).toBeCloseTo(regress(a, 0.75, 1500), 9)
    expect(regress(a, 0.75, 1500)).toBeCloseTo(1500 + 0.75 * (a - 1500), 12)
    const h2 = second.find((r) => r.game_id === 'h2' && r.team_id === B)!
    expect(h2.elo_pre).toBeCloseTo(regress(b, 0.75, 1500), 9)
    // The NBA's rule would have handed D C's rating.
    const last = new Map([
      [A, a],
      [B, b],
      [C, c]
    ])
    expect(seasonStart(last, [A, B, D], 0.75, 1500).get(D)).toBeCloseTo(regress(c, 0.75, 1500), 9)
    expect(seasonStart(last, [A, B, D], 0.75, 1500, false).has(D)).toBe(false)
  })

  it('fits the adjusted ratings on the same games, each row tagged by type', async () => {
    const rows = (await ADJUSTED_RATINGS.build(await context(db, 2023, men)))![ADJUSTED_TABLE]
    const last = new Map<number, Record<string, unknown>>()
    for (const r of rows) last.set(Number(r.team_id), r)
    // A's possessions: three games between Division I teams at 70, never g4's.
    expect(last.get(A)!.adj_poss).toBe(210)
    expect(last.get(A)!.game_type).toBe('nit')
    expect(rows.some((r) => r.team_id === X)).toBe(false)
  })

  it('runs Elo from the shared code: the same ratings as a season run by hand', () => {
    const { ratings } = runSeason(
      [
        { game_id: 'g1', date: '2022-11-10', home: A, away: B, neutral: false, margin: 10 },
        { game_id: 'g6', date: '2023-03-20', home: A, away: B, neutral: true, margin: 4 }
      ],
      new Map([
        [A, 1500],
        [B, 1500]
      ]),
      { k: 48, homeCourt: 90, carry: 0.75 },
      1350
    )
    const s1 = eloShift(90, 10, 48)
    const s2 = eloShift(1500 + s1 - (1500 - s1), 4, 48)
    expect(ratings.get(A)).toBeCloseTo(1500 + s1 + s2, 9)
  })
})

/** T1302.4's fixtures cut from the first loads (`college-identity`, `college-derived`). */
const FIXTURES = join(__dirname, '../../../fixtures')
async function built(league: League, without = ''): Promise<StatsDb> {
  const db = await openTestDb()
  for (const dir of ['college-identity', 'college-derived']) {
    for (const file of readdirSync(join(FIXTURES, dir, league.id))) {
      const table = `src_${file.replace(/\.parquet$/, '')}`
      if (without && table.startsWith(without)) continue
      const path = join(FIXTURES, dir, league.id, file)
      await db.exec(`CREATE TABLE ${table} AS SELECT * FROM read_parquet(${sqlString(path)})`)
    }
  }
  await buildIdentity(db, league)
  await buildDerived(db, league)
  await buildModels(db, 2027, league)
  return db
}

describe('the models step on the college fixtures', () => {
  const cases: [string, League, string][] = [
    ['men', men, ''],
    ['women', women, ''],
    ["men without stats.ncaa.org's releases", men, 'src_ncaa_'],
    ["women without stats.ncaa.org's releases", women, 'src_ncaa_']
  ]
  for (const [name, league, without] of cases) {
    it(`builds for the ${name}, on Division I games alone`, async () => {
      const db = await built(league, without)
      const rated = await db.all<{ game_id: string }>(
        `SELECT DISTINCT e.game_id FROM ${ELO_GAME_TABLE} e JOIN game g USING (game_id)
         WHERE g.game_type = 'preseason' OR g.forfeit_winner_id IS NOT NULL
            OR NOT EXISTS (SELECT 1 FROM team t WHERE t.team_id = g.home_team_id
                           AND t.season = g.season AND t.division_i)
            OR NOT EXISTS (SELECT 1 FROM team t WHERE t.team_id = g.away_team_id
                           AND t.season = g.season AND t.division_i)`
      )
      expect(rated).toEqual([])
      const n = async (sql: string): Promise<number> =>
        Number((await db.get<{ n: number }>(sql))!.n)
      expect(await n(`SELECT count(*) AS n FROM ${ELO_GAME_TABLE}`)).toBeGreaterThan(0)
      expect(await n('SELECT count(*) AS n FROM team_strength')).toBeGreaterThan(0)
      expect(await n('SELECT count(*) AS n FROM player_composite')).toBeGreaterThan(0)
      // The composites over every counted game, stored under the regular season.
      expect(
        await n("SELECT count(*) AS n FROM player_composite WHERE game_type <> 'regular'")
      ).toBe(0)
      expect(await n('SELECT count(*) AS n FROM team_forecast')).toBe(0)
      // A game against a team outside Division I has no Elo row (the fixture holds some).
      const outside = await n(`SELECT count(*) AS n FROM game g
        JOIN team t ON t.team_id = g.away_team_id AND t.season = g.season AND NOT t.division_i
        WHERE g.played AND g.game_type <> 'preseason'`)
      expect(outside).toBeGreaterThan(0)
    }, 60_000)
  }

  it('reads PER over every counted game, and gives the reason over part of them', async () => {
    const db = await built(men)
    const season = Number(
      (await db.get<{ s: number }>('SELECT max(season) AS s FROM player_composite'))!.s
    )
    const query = (gameTypes?: string[]): Promise<{ gaps: (string | null)[]; n: number }> =>
      runQuery(
        db,
        {
          entity: 'player',
          metrics: ['per'],
          scope: { seasons: [season], ...(gameTypes ? { gameTypes: gameTypes as never } : {}) },
          ranks: false
        },
        { league: men, currentSeason: 2027 }
      ).then((r) => ({
        gaps: r.columns.map((m) => m.reason),
        n: r.rows.filter((row) => row.values.per?.value != null).length
      }))
    const all = await query()
    expect(all.gaps).toEqual([null])
    expect(all.n).toBeGreaterThan(0)
    expect((await query(['regular'])).gaps).toEqual([COMPUTED_EVERY_GAME])
    const team = await runQuery(
      db,
      {
        entity: 'team',
        metrics: ['team_srs', 'team_elo'],
        scope: { seasons: [season], gameTypes: ['preseason'] },
        ranks: false
      },
      { league: men, currentSeason: 2027 }
    )
    expect(team.columns.map((m) => m.reason)).toEqual([NOT_RATED, NOT_RATED])
  }, 60_000)
})
