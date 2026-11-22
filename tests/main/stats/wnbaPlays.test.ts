import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import { buildPlays, playsStale } from '@main/stats/derived/playBuilders'
import { NBA_PLAYS, PLAYS_RECIPES, playsRecipe, WNBA_PLAYS } from '@main/stats/derived/playsRecipe'
import { buildPublished, publishedRecipe, publishedStale } from '@main/stats/derived/published'
import { lineIn, zoneSql } from '@main/stats/derived/shots'
import { buildIdentity } from '@main/stats/identity'
import { IDENTITY_LATE } from '@main/stats/identityLate'
import { readOfficials } from '@main/stats/availabilityReads'
import { readShotChart } from '@main/stats/shotReads'
import { LEAGUES, threePointLineIn, threePointLineSql } from '@shared/leagues'
import { splitAnswersIn, splitById, splitPiecesIn } from '@shared/stats/splits'
import { openTestDb } from '../../fixtures/stats'
import { slow } from '../../fixtures/timeouts'

/**
 * The WNBA's published tables, plays, shots, splits and on-court tables on fixtures cut from the real
 * load of 2026-11-17: the identity and derived fixtures of T1301.5 and T1301.6, and beside them
 * (`wnba-plays`) every row of the league's play by play, shots, possessions, lineups and officials of
 * five games chosen for a trap each: 1029700001 (1997, halves, the season before the play by play's
 * overtimes were in `game`, shots at (0, 0)), 1020500029 (2005, halves and an overtime), 1020600019
 * (2006, quarters and an overtime, with ESPN's play by play and its own foul spellings), 1022300004
 * (2023, the three-point line from 2013) and 1022600006 (2026, the Portland Fire at home on their
 * own key); the impact and advanced dashboard rows of those 2026 players, the advanced dashboard rows
 * of Portland in 2001 and 2026 and of Golden State in 2026, and Portland's five largest 2026 units.
 * Expected numbers are counted from the raw rows by SQL written apart from the builders, or read off
 * them by hand where a literal is written.
 */
const IDENTITY = join(__dirname, '../../fixtures/wnba-identity')
const DERIVED = join(__dirname, '../../fixtures/wnba-derived')
const PLAYS = join(__dirname, '../../fixtures/wnba-plays')
const TABLES: Record<string, string> = {
  src_wnba_schedule: 'schedule',
  src_wnba_game_logs: 'game_logs',
  src_wnba_player_box: 'player_box',
  src_espn_schedule: 'espn_schedule',
  src_espn_player_box: 'espn_player_box',
  src_espn_team_box: 'espn_team_box',
  src_xwalk_game: 'xwalk_game',
  src_xwalk_player: 'xwalk_player',
  src_team_aliases: 'team_aliases',
  src_team_groups: 'team_groups',
  src_espn_standings: 'espn_standings',
  src_wnba_rosters: 'rosters',
  src_wnba_pbp: 'pbp',
  src_wnba_shots: 'shots',
  src_wnba_possessions: 'possessions',
  src_wnba_game_lineups: 'game_lineups',
  src_wnba_officials: 'officials',
  src_espn_pbp: 'espn_pbp',
  src_wnba_impact: 'impact',
  src_dash_team_stats_advanced: 'dash_team_advanced',
  src_dash_player_stats_advanced: 'dash_player_advanced',
  src_dash_lineups_base: 'dash_lineups_base'
}

const wnba = LEAGUES.wnba
const G1997 = '1029700001'
const G2005 = '1020500029'
const G2006 = '1020600019'
const G2023 = '1022300004'
const G2026 = '1022600006'
const PORTLAND = 1611661327
const PORTLAND_2026 = -1611661327
/** An action type no rule of the parser lists, added to one game to see where it goes. */
const UNKNOWN = 'Mystery Play'

async function loadFixtures(db: StatsDb): Promise<void> {
  for (const [table, file] of Object.entries(TABLES)) {
    const parts = [IDENTITY, DERIVED, PLAYS]
      .map((dir) => join(dir, `${file}.parquet`))
      .filter((p) => existsSync(p))
    await db.exec(
      `CREATE TABLE ${table} AS SELECT * FROM read_parquet([${parts.map(sqlString).join(', ')}], union_by_name = true)`
    )
  }
  // A NaN as published: Tamika Catchings's BPM in the 2016 playoffs (one of 19 that season).
  await db.exec(
    `INSERT INTO src_wnba_impact BY NAME SELECT * FROM read_parquet(${sqlString(join(PLAYS, 'impact_nan.parquet'))})`
  )
  // An unparsed play: a copy of a 2026 timeout under a type no rule lists, with its own row key.
  await db.exec(`INSERT INTO src_wnba_pbp SELECT * REPLACE ('${UNKNOWN}' AS action_type,
      order_index + 100000 AS order_index, action_number + 100000 AS action_number)
    FROM src_wnba_pbp WHERE game_id = '${G2026}' AND action_type = 'Timeout' LIMIT 1`)
}

let db: StatsDb

beforeAll(async () => {
  db = await openTestDb()
  await loadFixtures(db)
  await buildIdentity(db, wnba)
  await buildDerived(db, wnba)
  await buildPublished(db, wnba)
  await buildPlays(db, wnba)
}, slow(60_000))

type Row = Record<string, unknown>
const one = async (sql: string, params: unknown[] = []): Promise<Row> =>
  (await db.get<Row>(sql, params as never[])) ?? {}
const all = (sql: string, params: unknown[] = []): Promise<Row[]> =>
  db.all<Row>(sql, params as never[])
const num = (v: unknown): number => Number(v)

describe('the recipes', () => {
  it('are the ones the registry names, the NBA’s reading its files as before', () => {
    expect(wnba.builds).toEqual(['identity', 'derived', 'published', 'plays', 'models'])
    expect(playsRecipe(wnba)).toBe(WNBA_PLAYS)
    expect(playsRecipe(LEAGUES.nba)).toBe(NBA_PLAYS)
    expect(PLAYS_RECIPES.wnba.pbp).toBe('src_wnba_pbp')
    expect(NBA_PLAYS.pbp).toBe('src_nba_pbp')
    expect(NBA_PLAYS.side('s.team_id', 'h', 'a')).toBe('s.team_id')
    expect(NBA_PLAYS.unlocated).toBeNull()
    expect(publishedRecipe(LEAGUES.nba).team('t', 's')).toBe('t')
    expect(publishedRecipe(wnba).sources).toEqual({ src_nba_impact: 'src_wnba_impact' })
    expect(IDENTITY_LATE.wnba).toEqual(['src_wnba_pbp'])
    expect(IDENTITY_LATE.nba).toEqual([])
  })

  it('record their own versions, so the tables are not built again', async () => {
    expect(await playsStale(db, wnba)).toBe(false)
    expect(await publishedStale(db, wnba)).toBe(false)
    expect(await one("SELECT version FROM derived_state WHERE name = 'plays'")).toEqual({
      version: WNBA_PLAYS.version
    })
  })
})

describe('the three-point line by era', () => {
  it('is the registry’s: 19 feet 9 to 2003, 6.25 metres to 2012, 6.75 metres above 22 feet after', () => {
    expect(threePointLineIn(wnba, 1997)).toMatchObject({ arc: 197.5, corner: 197.5 })
    expect(threePointLineIn(wnba, 2003)).toMatchObject({ arc: 197.5 })
    expect(threePointLineIn(wnba, 2004)).toMatchObject({ arc: 205, corner: 205 })
    expect(threePointLineIn(wnba, 2012)).toMatchObject({ arc: 205 })
    expect(threePointLineIn(wnba, 2013)).toMatchObject({ arc: 221.5, corner: 220 })
    expect(threePointLineIn(wnba, 2026)).toMatchObject({ arc: 221.5 })
    expect(threePointLineIn(LEAGUES.nba, 2026)).toMatchObject({ arc: 237.5, corner: 220 })
    // One era: a number, as before; several: a CASE over the season.
    expect(threePointLineSql(LEAGUES.nba, 'season', 'arc')).toBe('237.5')
    expect(threePointLineSql(wnba, 'season', 'arc')).toMatch(/^\(CASE WHEN season >= 2013/)
  })

  it('decides a shot with no published value: 21 feet out is a three in 1997, a two in 2023', async () => {
    const zone = async (season: number): Promise<unknown> =>
      (await one(`SELECT ${zoneSql('0', '210', 'NULL::INTEGER', lineIn(wnba, season))} AS z`)).z
    expect(await zone(1997)).toBe('atb3')
    expect(await zone(2005)).toBe('atb3')
    expect(await zone(2023)).toBe('mid')
    // The published value decides when there is one, whatever the era.
    expect((await one(`SELECT ${zoneSql('0', '210', '2', lineIn(wnba, 1997))} AS z`)).z).toBe('mid')
  })
})

describe('the play table', () => {
  it('keys every play of the five games to the game, the 2026 Fire on their own key', async () => {
    const raw = await all(`SELECT game_id::VARCHAR AS g, count(*)::INTEGER AS n FROM src_wnba_pbp
                           GROUP BY 1 ORDER BY 1`)
    const built = await all(
      `SELECT game_id AS g, count(*)::INTEGER AS n FROM play_nba GROUP BY 1 ORDER BY 1`
    )
    expect(built).toEqual(raw)
    const sides = await all(
      `SELECT DISTINCT team_id FROM play_nba WHERE game_id = '${G2026}' AND team_id IS NOT NULL ORDER BY 1`
    )
    expect(sides.map((r) => num(r.team_id))).toEqual([PORTLAND_2026, 1611661329])
  })

  it('reads an action type no rule lists as other, with no count', async () => {
    const r = await one(
      `SELECT kind, fga + fta + pts + tov + pf + oreb + dreb AS counts FROM play_nba
       WHERE game_id = '${G2026}' AND action = '${UNKNOWN}'`
    )
    expect(r).toEqual({ kind: 'other', counts: 0 })
  })

  it('rebuilds each player’s points and rebounds from the flags as the box score has them', async () => {
    const off = await one(`WITH p AS (
        SELECT game_id, player_id, sum(pts) AS pts, sum(oreb + dreb) AS reb FROM play_nba
        WHERE player_id IS NOT NULL GROUP BY 1, 2)
      SELECT count(*)::INTEGER AS n, count(*) FILTER (WHERE b.pts = p.pts AND b.reb = p.reb)::INTEGER AS same
      FROM player_game b JOIN p USING (game_id, player_id)`)
    expect(num(off.n)).toBeGreaterThan(80)
    expect(off.same).toBe(off.n)
  })

  it('finds the passer of every assist the feed writes, through the lineup file where a name misses', async () => {
    const r = await one(`SELECT count(*)::INTEGER AS written FROM src_wnba_pbp
                         WHERE action_type = 'Made Shot' AND description LIKE '% AST)%'`)
    const a = await one('SELECT sum(ast)::INTEGER AS matched FROM play_nba')
    expect(a.matched).toBe(r.written)
  })
})

describe('overtimes before 2002, from the play by play', () => {
  it('fill the game the game logs and ESPN cannot tell', async () => {
    const last = await one(
      `SELECT max(period)::INTEGER AS p FROM src_wnba_pbp WHERE game_id = '${G1997}'`
    )
    const g = await one(`SELECT periods, overtimes FROM game WHERE game_id = '${G1997}'`)
    expect(g.periods).toBe(2)
    expect(g.overtimes).toBe(num(last.p) - 2)
  })

  it('agree with the game logs and ESPN where those tell them', async () => {
    for (const id of [G2005, G2006]) {
      const last = await one(
        `SELECT max(period)::INTEGER AS p FROM src_wnba_pbp WHERE game_id = $1`,
        [id]
      )
      const g = await one('SELECT periods, overtimes FROM game WHERE game_id = $1', [id])
      expect(num(g.periods) + num(g.overtimes)).toBe(last.p)
    }
  })
})

describe('splits in halves before 2006', () => {
  const pts = async (game: string, split: string): Promise<number | null> => {
    const r = await one(
      `SELECT sum(pts)::INTEGER AS p FROM split_team WHERE game_id = $1 AND split = $2`,
      [game, split]
    )
    return r.p === null || r.p === undefined ? null : num(r.p)
  }
  /** Both sides' points in a game's periods, counted from the raw score text. */
  const rawPts = async (game: string, from: number, to: number): Promise<number> => {
    const r = await one(
      `WITH s AS (SELECT period, TRY_CAST(nullif(score_home, '') AS INTEGER) + TRY_CAST(nullif(score_away, '') AS INTEGER) AS t
                  FROM src_wnba_pbp WHERE game_id = $1),
       e AS (SELECT period, max(t) AS t FROM s GROUP BY 1)
       SELECT (SELECT max(t) FROM e WHERE period <= ${to}) - coalesce((SELECT max(t) FROM e WHERE period < ${from}), 0) AS p`,
      [game]
    )
    return num(r.p)
  }

  it('read the halves and the overtime, and no quarter, in a game of 2005', async () => {
    expect(await pts(G2005, 'h1')).toBe(await rawPts(G2005, 1, 1))
    expect(await pts(G2005, 'h2')).toBe(await rawPts(G2005, 2, 2))
    expect(await pts(G2005, 'ot')).toBe(await rawPts(G2005, 3, 3))
    for (const q of ['q1', 'q2', 'q3', 'q4']) expect(await pts(G2005, q)).toBeNull()
    // The score is the game's: 68 to 66 after one overtime.
    expect(
      num(await pts(G2005, 'h1')) + num(await pts(G2005, 'h2')) + num(await pts(G2005, 'ot'))
    ).toBe(68 + 66)
  })

  it('read four quarters from 2006, which add up to the halves', async () => {
    const q = await Promise.all(['q1', 'q2', 'q3', 'q4'].map((s) => pts(G2006, s)))
    expect(q.every((v) => v !== null)).toBe(true)
    expect(num(q[0]) + num(q[1])).toBe(await pts(G2006, 'h1'))
    expect(num(q[2]) + num(q[3])).toBe(await pts(G2006, 'h2'))
    expect(await pts(G2006, 'ot')).toBe(await rawPts(G2006, 5, 5))
  })

  it('take the 4th quarter’s rules as the second half’s, from the shared rules', () => {
    const q1 = splitById('q1')!
    const clutch = splitById('clutch')!
    expect(splitAnswersIn(q1, 2)).toBe(false)
    expect(splitAnswersIn(q1, 4)).toBe(true)
    expect(splitPiecesIn(clutch, 2)).toEqual([{ periods: [2, null], clock: [0, 300], absMax: 5 }])
    expect(splitPiecesIn(clutch, 4)).toBe(clutch.pieces)
    // A split whose pieces name no period reads the same in both.
    expect(splitPiecesIn(splitById('ahead')!, 2)).toBe(splitById('ahead')!.pieces)
  })

  it('give players time from the lineup file’s starters and the substitutions', async () => {
    const t = await one(
      `SELECT sum(seconds)::DOUBLE AS s FROM split_player WHERE game_id = $1 AND split IN ('h1', 'h2', 'ot')`,
      [G2005]
    )
    // Ten players on the floor through two 20-minute halves and a 5-minute overtime.
    expect(num(t.s)).toBeCloseTo(10 * (2400 + 300), 0)
  })
})

describe('on the floor across an overtime', () => {
  it('credits every second of a halves game and its overtime to five players a side', async () => {
    const u = await all(
      `SELECT team_id, sum(secs)::DOUBLE AS s FROM unit_game WHERE game_id = $1 GROUP BY 1`,
      [G2005]
    )
    expect(u).toHaveLength(2)
    for (const r of u) expect(num(r.s)).toBeCloseTo(2400 + 300, 0)
    const p = await all(
      `SELECT team_id, sum(on_secs)::DOUBLE AS s FROM player_on_court WHERE game_id = $1 GROUP BY 1`,
      [G2005]
    )
    for (const r of p) expect(num(r.s)).toBeCloseTo(5 * (2400 + 300), 0)
  })

  it('keys the 2026 Fire’s units and possessions on their own key', async () => {
    const units = await all(
      `SELECT DISTINCT team_id FROM unit_game WHERE game_id = '${G2026}' ORDER BY 1`
    )
    expect(units.map((r) => num(r.team_id))).toEqual([PORTLAND_2026, 1611661329])
    const poss = await all(
      `SELECT DISTINCT team_id FROM possession WHERE game_id = '${G2026}' ORDER BY 1`
    )
    expect(poss.map((r) => num(r.team_id))).toEqual([PORTLAND_2026, 1611661329])
  })
})

describe('shots', () => {
  it('keep a shot at (0, 0) before 2011 with no location, its attempt and value kept', async () => {
    const raw = await one(
      `SELECT count(*)::INTEGER AS n, count(*) FILTER (WHERE x_legacy = 0 AND y_legacy = 0)::INTEGER AS z,
              count(*) FILTER (WHERE x_legacy = 0 AND y_legacy = 0 AND shot_value = 2)::INTEGER AS z2
       FROM src_wnba_shots WHERE game_id = $1`,
      [G1997]
    )
    expect(num(raw.z)).toBeGreaterThan(0)
    const v = await one(
      `SELECT count(*)::INTEGER AS n, count(*) FILTER (WHERE x IS NULL AND y IS NULL AND distance IS NULL)::INTEGER AS z,
              count(*) FILTER (WHERE x IS NULL AND value = 2)::INTEGER AS z2
       FROM shot_nba v JOIN game g USING (game_id) WHERE g.game_id = $1`,
      [G1997]
    )
    expect(v).toEqual(raw)
    const t = await one(
      `SELECT sum(unk_fga)::INTEGER AS unk, sum(shots_fga)::INTEGER AS fga FROM shot_team_game WHERE game_id = $1`,
      [G1997]
    )
    expect(t).toEqual({ unk: raw.z, fga: raw.n })
  })

  it('give every shot of 2023 a location and a zone', async () => {
    const t = await one(
      'SELECT sum(unk_fga)::INTEGER AS unk, sum(shots_fga)::INTEGER AS fga FROM shot_team_game WHERE game_id = $1',
      [G2023]
    )
    expect(t.unk).toBe(0)
    expect(num(t.fga)).toBeGreaterThan(100)
  })

  it('chart the located shots and say how many have no location', async () => {
    const team = await one(`SELECT home_team_id AS t FROM game WHERE game_id = '${G1997}'`)
    const chart = await readShotChart(
      db,
      { entity: 'team', id: String(team.t), seasons: [1997], scope: { gameTypes: ['regular'] } },
      wnba
    )
    expect(chart.unlocated).toBeGreaterThan(0)
    expect(chart.shots).toHaveLength(chart.total - num(chart.unlocated))
    expect(chart.shots.every((s) => Number.isFinite(s.x) && !(s.x === 0 && s.y === 0))).toBe(true)
  })
})

describe('fouls drawn from ESPN’s play by play, under its WNBA spellings', () => {
  it('count the fouls ESPN names a fouled player on, by the shared types', async () => {
    const raw = await one(`SELECT count(*)::INTEGER AS n FROM src_espn_pbp
      WHERE athlete_id_2 IS NOT NULL AND type_text IN ('ShootingFoul', 'PersonalFoul', 'LooseBallFoul',
        'Offensive Foul', 'Offensive Charge', 'Shooting Block Foul', 'PersonalBlock', 'PersonalTake',
        'InBound Foul', 'Away From Play Foul', 'ClearPath Foul', 'Flagrant Foul Type 1', 'Flagrant Foul Type 2')`)
    const built = await one(
      `SELECT sum(fd)::INTEGER AS fd FROM play_player_game WHERE game_id = '${G2006}'`
    )
    expect(num(raw.n)).toBeGreaterThan(20)
    // Every fouled player ESPN names is a player of the game's box score.
    expect(built.fd).toBe(raw.n)
  })
})

describe('the published tables', () => {
  it('read the impact file under the WNBA’s name, as published', async () => {
    const raw = await one(
      'SELECT count(*)::INTEGER AS n, sum(rapm * (off_poss + def_poss)) / sum(off_poss + def_poss) AS rapm FROM src_wnba_impact'
    )
    const built = await one(
      'SELECT count(*)::INTEGER AS n, sum(rapm) / sum(impact_poss) AS rapm FROM pub_player_impact'
    )
    expect(built.n).toBe(raw.n)
    expect(num(built.rapm)).toBeCloseTo(num(raw.rapm), 9)
  })

  it('key the 2026 Fire’s rows apart from the 2000-2002 club’s', async () => {
    const teams = await all(
      `SELECT season, team_id FROM pub_team_advanced WHERE abs(team_id) = ${PORTLAND} ORDER BY 1`
    )
    expect(teams.map((r) => [r.season, num(r.team_id)])).toEqual([
      [2001, PORTLAND],
      [2026, PORTLAND_2026]
    ])
    const units = await all('SELECT DISTINCT team_id FROM pub_lineups')
    expect(units.map((r) => num(r.team_id))).toEqual([PORTLAND_2026])
  })

  it('build the tables the WNBA publishes nothing for empty, and DARKO with no value', async () => {
    for (const t of ['pub_player_hustle', 'pub_player_matchups', 'pub_player_pt_iso']) {
      expect(await one(`SELECT count(*)::INTEGER AS n FROM ${t}`)).toEqual({ n: 0 })
    }
    // The impact file's rows are there; the WNBA's file has no `darko_*` column to read.
    expect(
      await one(`SELECT count(*)::INTEGER AS n, count(darko_filtered_skill)::INTEGER AS valued
                 FROM pub_player_darko`)
    ).toEqual({ n: 20, valued: 0 })
  })
})

describe('a team row against its players', () => {
  /** The team-game's turnovers in `team_game`, the team row's, its players' sum and the plays' own. */
  const tov = async (game: string, team: number): Promise<Row> =>
    one(
      `SELECT t.tov AS built,
              (SELECT tov FROM src_wnba_game_logs WHERE game_id = $1 AND team_id = $2 AND player_id IS NULL) AS row,
              (SELECT sum(tov) FROM src_wnba_game_logs WHERE game_id = $1 AND team_id = $2 AND player_id IS NOT NULL)::INTEGER AS players,
              (SELECT count(*) FROM src_wnba_pbp p JOIN game g ON g.nba_game_id = p.game_id::VARCHAR
                WHERE p.game_id = $1 AND p.action_type = 'Turnover' AND coalesce(p.team_id, 0) = 0
                  AND p.location = CASE WHEN abs(g.home_team_id) = $2 THEN 'h' ELSE 'v' END)::INTEGER AS own
       FROM team_game t JOIN game g ON g.game_id = t.game_id
       WHERE g.nba_game_id = $1 AND abs(t.team_id) = $2`,
      [game, team]
    )

  it('reads the players and the plays’ own where the row falls short (1997: 0 against 19 and 25)', async () => {
    for (const team of [1611661313, 1611661320]) {
      const r = await tov(G1997, team)
      expect(r.row).toBe(0)
      expect(num(r.players)).toBeGreaterThan(0)
      expect(r.built).toBe(num(r.players) + num(r.own))
    }
  })

  it('reads the players alone where the play by play is not loaded (2003: 0 against 12 and 18)', async () => {
    const r = await tov('1020300006', 1611661328)
    expect(r).toMatchObject({ row: 0, players: 12, built: 12, own: 0 })
  })

  it('keeps the row where it is at least its players (2023: 22 with the team’s own, 19)', async () => {
    const r = await tov(G2023, 1611661317)
    expect(r).toMatchObject({ row: 22, players: 19, built: 22 })
    // The opponent's turnovers are the other row's, by the same rule.
    const o = await one(
      `SELECT t.opp_tov FROM team_game t JOIN game g ON g.game_id = t.game_id
       WHERE g.nba_game_id = '${G2023}' AND t.team_id = 1611661320`
    )
    expect(o.opp_tov).toBe(22)
  })

  it('keeps the row’s points, which equal the score', async () => {
    const r = await all(
      `SELECT t.pts, CASE WHEN t.home THEN g.home_score ELSE g.away_score END AS score
       FROM team_game t JOIN game g ON g.game_id = t.game_id WHERE t.box_games = 1`
    )
    expect(r.length).toBeGreaterThan(40)
    expect(r.every((x) => x.pts === x.score)).toBe(true)
  })
})

describe('a NaN as published', () => {
  it('reads as no value in the published table; the source keeps it', async () => {
    const src = await one(
      `SELECT isnan(bpm) AS nan FROM src_wnba_impact WHERE player_id = 100646 AND season = 2016`
    )
    expect(src.nan).toBe(true)
    const built = await one(
      `SELECT bpm, obpm, rapm IS NOT NULL AS rapm FROM pub_player_impact
       WHERE player_id = 100646 AND season = 2016 AND game_type = 'playoffs'`
    )
    expect(built).toEqual({ bpm: null, obpm: null, rapm: true })
    expect(
      await one(
        'SELECT count(*)::INTEGER AS n FROM pub_player_impact WHERE isnan(bpm) OR isnan(rapm)'
      )
    ).toEqual({ n: 0 })
  })
})

describe('officials', () => {
  it('read the league’s own file', async () => {
    const raw = await all(
      `SELECT trim(first_name) || ' ' || trim(last_name) AS name FROM src_wnba_officials
       WHERE game_id = '${G2023}' ORDER BY 1`
    )
    const read = await readOfficials(db, G2023, wnba)
    expect(read.map((o) => o.name)).toEqual(raw.map((r) => r.name))
    expect(read.length).toBeGreaterThanOrEqual(3)
    // 1997 has none: the league's file starts in 2004.
    expect(await readOfficials(db, G1997, wnba)).toEqual([])
  })
})
