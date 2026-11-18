import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import {
  buildDerived,
  canDerive,
  DERIVED_NEEDS,
  DERIVED_RECIPES,
  derivedStale
} from '@main/stats/derived/build'
import { buildIdentity } from '@main/stats/identity'
import { LEAGUES } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'

/**
 * The WNBA's game and season tables on fixtures cut from the real load of 2026-11-17: the identity
 * fixtures (`wnba-identity`, 21 games of the league's schedule and game logs chosen for a trap each,
 * ESPN's rows for them, its Cup finals of 2021 and 2022 and All-Star Games), and beside them
 * (`wnba-derived`) the two 2023 games of Liz Dixon's season with Phoenix and with Connecticut, every
 * row of both, and ESPN's lines of the 2002 Portland-New York game, all zeros. Every expected number
 * is read off the raw rows by hand.
 */
const IDENTITY = join(__dirname, '../../fixtures/wnba-identity')
const DERIVED = join(__dirname, '../../fixtures/wnba-derived')
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
  src_wnba_rosters: 'rosters'
}

const wnba = LEAGUES.wnba
const LIZ_DIXON = 1641700
const PHOENIX = 1611661317
const CONNECTICUT = 1611661323
const WASHINGTON = 1611661322
const LAS_VEGAS = 1611661319
const NEW_YORK = 1611661313
const LOS_ANGELES = 1611661320
const PORTLAND_2026 = -1611661327
const FORFEIT = '1021800162'

async function loadFixtures(db: StatsDb): Promise<void> {
  for (const [table, file] of Object.entries(TABLES)) {
    const parts = [IDENTITY, DERIVED]
      .map((dir) => join(dir, `${file}.parquet`))
      .filter((p) => existsSync(p))
    await db.exec(
      `CREATE TABLE ${table} AS SELECT * FROM read_parquet([${parts.map(sqlString).join(', ')}], union_by_name = true)`
    )
  }
}

let db: StatsDb

beforeAll(async () => {
  db = await openTestDb()
  await loadFixtures(db)
  await buildIdentity(db, wnba)
  await buildDerived(db, wnba)
}, 30_000)

type Row = Record<string, unknown>
const one = async (sql: string, params: unknown[] = []): Promise<Row> =>
  (await db.get<Row>(sql, params as never[])) ?? {}
const all = (sql: string, params: unknown[] = []): Promise<Row[]> =>
  db.all<Row>(sql, params as never[])

describe('the recipe', () => {
  it('is the one the registry names, with its own needs and version', async () => {
    const recipe = DERIVED_RECIPES[wnba.derived]
    expect(recipe.needs).toContain('src_wnba_game_logs')
    expect(recipe.needs).not.toContain('src_nba_player_box')
    expect(DERIVED_NEEDS).toEqual(expect.arrayContaining([...recipe.needs]))
    expect(await canDerive(db, wnba)).toBe(true)
    expect(await derivedStale(db, wnba)).toBe(false)
    // The NBA's recipe is another, at its own version: this file says nothing about it.
    expect(DERIVED_RECIPES.nba.needs).toContain('src_nba_player_box')
  })

  it('keys every line to a side of its game, the 2026 Portland Fire included', async () => {
    const stray = await one(
      `SELECT count(*) AS n FROM player_game p JOIN game g USING (game_id)
       WHERE p.team_id IS NULL OR p.team_id NOT IN (g.home_team_id, g.away_team_id)`
    )
    expect(Number(stray.n)).toBe(0)
    const portland = await one(
      `SELECT count(*) AS n, sum(pts) AS pts FROM player_game WHERE game_id = '1022600006' AND team_id = ?`,
      [PORTLAND_2026]
    )
    expect(Number(portland.pts)).toBe(83)
  })
})

describe('a traded player', () => {
  it('has a row per team and a whole-season row, never the two added together', async () => {
    const rows = await all(
      `SELECT team_id, games, minutes, pts, plus_minus FROM player_season
       WHERE player_id = ? AND season = 2023 AND game_type = 'regular' ORDER BY team_id NULLS LAST`,
      [LIZ_DIXON]
    )
    // 5 minutes, 0 points, -1 for Phoenix; 4 minutes, 2 points, -3 for Connecticut.
    expect(rows).toEqual([
      { team_id: PHOENIX, games: 1, minutes: 5, pts: 0, plus_minus: -1 },
      { team_id: CONNECTICUT, games: 1, minutes: 4, pts: 2, plus_minus: -3 },
      { team_id: null, games: 2, minutes: 9, pts: 2, plus_minus: -4 }
    ])
    const last = await one(
      `SELECT last_team_id FROM player_season WHERE player_id = ? AND season = 2023 AND team_id IS NULL`,
      [LIZ_DIXON]
    )
    // Of the two games here, her later one (2023-06-22) was Connecticut's.
    expect(last.last_team_id).toBe(CONNECTICUT)
  })
})

describe('the 2018 forfeit', () => {
  it('is a win and a loss with no box score and no player lines', async () => {
    const sides = await all(
      `SELECT team_id, games, box_games, wins, losses, points_for, points_against, source
       FROM team_game WHERE game_id = ? ORDER BY team_id`,
      [FORFEIT]
    )
    expect(sides).toEqual([
      {
        team_id: LAS_VEGAS,
        games: 1,
        box_games: 0,
        wins: 0,
        losses: 1,
        points_for: 0,
        points_against: 0,
        source: null
      },
      {
        team_id: WASHINGTON,
        games: 1,
        box_games: 0,
        wins: 1,
        losses: 0,
        points_for: 0,
        points_against: 0,
        source: null
      }
    ])
    const lines = await one(`SELECT count(*) AS n FROM player_game WHERE game_id = ?`, [FORFEIT])
    expect(Number(lines.n)).toBe(0)
  })

  it('counts in the season’s record, and its zeros in no total', async () => {
    const w = await one(
      `SELECT sum(wins) AS wins, sum(losses) AS losses, sum(box_games) AS box, sum(games) AS games
       FROM team_game WHERE team_id = ? AND season = 2018 AND game_type = 'regular'`,
      [WASHINGTON]
    )
    const s = await one(
      `SELECT wins, losses, box_games, games FROM team_season
       WHERE team_id = ? AND season = 2018 AND game_type = 'regular'`,
      [WASHINGTON]
    )
    expect([s.wins, s.losses, s.box_games, s.games]).toEqual([w.wins, w.losses, w.box, w.games])
    expect(Number(s.games) - Number(s.box_games)).toBeGreaterThanOrEqual(1)
  })
})

describe('minutes and overtimes', () => {
  it('reads a team’s seconds from its minutes from 2005, overtime included', async () => {
    // 2005, halves, one overtime: 225 team minutes. 2006, quarters, one overtime: the same.
    for (const id of ['1020500029', '1020600019']) {
      const rows = await all(`SELECT seconds FROM team_game WHERE game_id = ?`, [id])
      expect(rows.map((r) => r.seconds)).toEqual([225 * 60, 225 * 60])
    }
  })

  it('reads them from the game’s overtimes before, else its players’ minutes summed', async () => {
    // 2002: the game logs' team minutes read 0, the game knows no overtime was played: 200 minutes.
    const y2002 = await all(`SELECT seconds FROM team_game WHERE game_id = '1020200006'`)
    expect(y2002.map((r) => r.seconds)).toEqual([12000, 12000])
    // 1997, the league's first game: no overtime known, so the players' whole minutes summed (New
    // York's 200, Los Angeles's 202).
    const y1997 = await all(
      `SELECT team_id, seconds, source FROM team_game WHERE game_id = '1029700001' ORDER BY team_id`
    )
    expect(y1997).toEqual([
      { team_id: NEW_YORK, seconds: 200 * 60, source: 'wnba' },
      { team_id: LOS_ANGELES, seconds: 202 * 60, source: 'wnba' }
    ])
  })

  it('reads a player’s seconds from whole minutes in the game logs, to the second in 2026', async () => {
    const logged = await one(
      `SELECT seconds FROM player_game WHERE player_id = ? AND game_id = '1022300004'`,
      [LIZ_DIXON]
    )
    expect(logged.seconds).toBe(300)
    // Michaela Onyenwere, 31:01 in the 2026 box score.
    const boxed = await one(
      `SELECT seconds, pts, plus_minus, starter, source FROM player_game
       WHERE player_id = 1630446 AND game_id = '1022600203'`
    )
    expect(boxed).toEqual({ seconds: 1861, pts: 6, plus_minus: 8, starter: true, source: 'wnba' })
  })
})

describe('which source a line comes from', () => {
  it('reads a 2026 game from the box scores alone, each line once', async () => {
    // 1022600203 is in the box scores only; 1022600006 in both, its 20 lines read once.
    for (const [id, played] of [
      ['1022600203', 19],
      ['1022600006', 20]
    ] as const) {
      const n = await one(`SELECT count(*) AS n FROM player_game WHERE game_id = ?`, [id])
      const box = await one(
        `SELECT count(*) AS n FROM src_wnba_player_box WHERE game_id = ? AND minutes <> ''`,
        [id]
      )
      expect(Number(n.n)).toBe(Number(box.n))
      expect(Number(box.n)).toBe(played)
    }
    const starters = await all(
      `SELECT team_id, count(*) FILTER (WHERE starter) AS starters FROM player_game
       WHERE game_id = '1022600203' GROUP BY 1`
    )
    expect(starters.map((r) => Number(r.starters))).toEqual([5, 5])
  })

  it('reads 2002 from the game logs, ESPN’s zeros never as stats, its starters as flagged', async () => {
    const lines = await all(
      `SELECT team_id, count(*) AS n, sum(pts) AS pts, count(*) FILTER (WHERE starter) AS starters,
              count(*) FILTER (WHERE source = 'wnba') AS league
       FROM player_game WHERE game_id = '1020200006' GROUP BY 1 ORDER BY 1`
    )
    // New York 84 points from 9 players, Portland 62 from 11: the game logs'. ESPN lists the game
    // with every count 0, and five starters a side. Portland's fifth is ESPN's LaQuanda Barksdale,
    // whom no source links to the league's LaQuanda Quick (T1301.5), so only four of Portland's lines
    // are flagged and its starters read unknown, not as four starters and a bench.
    expect(lines.map((r) => [r.team_id, Number(r.n), Number(r.pts), Number(r.starters)])).toEqual([
      [NEW_YORK, 9, 84, 5],
      [1611661327, 11, 62, 0]
    ])
    const known = await all(
      `SELECT team_id, starts_known FROM team_game WHERE game_id = '1020200006' ORDER BY team_id`
    )
    expect(known.map((r) => r.starts_known)).toEqual([1, 0])
    expect(lines.every((r) => r.n === r.league)).toBe(true)
    const espnZeros = await one(
      `SELECT count(*) AS n, sum(points) AS pts FROM src_espn_player_box WHERE game_id = 220529012`
    )
    expect(Number(espnZeros.n)).toBeGreaterThan(0)
    expect(Number(espnZeros.pts)).toBe(0)
  })

  it('knows no starter, and no plus-minus, before the sources have them', async () => {
    const y1997 = await one(
      `SELECT count(starter) AS starter, count(plus_minus) AS pm, count(*) AS n
       FROM player_game WHERE game_id = '1029700001'`
    )
    expect([Number(y1997.starter), Number(y1997.pm), Number(y1997.n)]).toEqual([0, 0, 19])
    const starts = await one(
      `SELECT sum(starts_known) AS known FROM team_game WHERE game_id = '1029700001'`
    )
    expect(Number(starts.known)).toBe(0)
  })

  it('reads the Commissioner’s Cup final from ESPN alone, as its own season type', async () => {
    const finals = await all(
      `SELECT game_id, game_type, source, count(*) AS sides FROM team_game
       WHERE game_type = 'cup-final' GROUP BY 1, 2, 3 ORDER BY 1`
    )
    expect(finals).toEqual([
      { game_id: 'espn:401353913', game_type: 'cup-final', source: 'espn', sides: 2 },
      { game_id: 'espn:401430112', game_type: 'cup-final', source: 'espn', sides: 2 }
    ])
    // Seattle 79, Connecticut 57: the players' points add up to the score.
    const seattle = await one(
      `SELECT pts, points_for FROM team_game WHERE game_id = 'espn:401353913' AND team_id = 1611661328`
    )
    expect(seattle).toEqual({ pts: 79, points_for: 79 })
    const regular = await one(
      `SELECT count(*) AS n FROM team_season WHERE season = 2021 AND game_type = 'cup-final'`
    )
    expect(Number(regular.n)).toBe(2)
  })

  it('sums the players of a game the schedule lacks, and counts no All-Star side', async () => {
    const lacked = await all(
      `SELECT team_id, source, pts, points_for, box_games FROM team_game
       WHERE game_id = '1020700070' ORDER BY team_id`
    )
    expect(lacked).toEqual([
      { team_id: NEW_YORK, source: 'wnba', pts: 76, points_for: 76, box_games: 1 },
      { team_id: CONNECTICUT, source: 'wnba', pts: 73, points_for: 73, box_games: 1 }
    ])
    const allStar = await one(
      `SELECT count(*) AS n FROM team_game t JOIN game g USING (game_id) WHERE g.game_type = 'all-star'`
    )
    expect(Number(allStar.n)).toBe(0)
  })

  it('reads ESPN’s points by kind from 2023 only', async () => {
    const y2023 = await all(
      `SELECT paint_pts FROM team_game WHERE game_id = '1022300004' ORDER BY team_id`
    )
    expect(y2023.every((r) => typeof r.paint_pts === 'number' && r.paint_pts > 0)).toBe(true)
    const y2021 = await one(
      `SELECT count(paint_pts) AS n FROM team_game WHERE season < 2023 AND season > 2002`
    )
    expect(Number(y2021.n)).toBe(0)
  })
})
