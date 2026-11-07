import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { parsePeriods, readGame, readGames, readPlayer, readStandings } from '@main/stats/reads'
import { openTestDb } from '../../fixtures/stats'

const BOS = 1610612738
const OKC = 1610612760

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
})

/** `game`, `team` and `team_game`, as a build leaves them. */
async function addSchedule(): Promise<void> {
  await db.exec(`CREATE TABLE game (game_id VARCHAR, nba_game_id VARCHAR, espn_game_id BIGINT,
    season INTEGER, game_type VARCHAR, game_date DATE, home_team_id BIGINT, away_team_id BIGINT,
    home_score BIGINT, away_score BIGINT, played BOOLEAN)`)
  await db.exec(`CREATE TABLE team (season INTEGER, team_id BIGINT, code VARCHAR, name VARCHAR)`)
  await db.exec(`CREATE TABLE team_game (game_id VARCHAR, season INTEGER, box_games INTEGER,
    seconds INTEGER)`)
  await db.exec(`INSERT INTO team VALUES
    (2026, ${BOS}, 'BOS', 'Boston Celtics'), (2026, ${OKC}, 'OKC', 'Oklahoma City Thunder')`)
  await db.exec(`INSERT INTO game VALUES
    ('late', 'late', 11, 2026, 'regular', DATE '2026-01-05', ${BOS}, ${OKC}, 100, 90, true),
    ('ot', 'ot', 12, 2026, 'regular', DATE '2026-01-03', ${OKC}, ${BOS}, 120, 118, true),
    ('pre', 'pre', 13, 2026, 'preseason', DATE '2025-10-02', ${BOS}, 99, 80, 70, true),
    ('next', 'next', 14, 2026, 'regular', DATE '2026-03-01', ${BOS}, ${OKC}, 0, 0, false),
    ('other', 'other', 15, 2025, 'regular', DATE '2025-01-01', ${BOS}, ${OKC}, 1, 2, true)`)
  await db.exec(`INSERT INTO team_game VALUES
    ('late', 2026, 1, 14400), ('late', 2026, 1, 14400),
    ('ot', 2026, 1, 17400), ('ot', 2026, 1, 17400),
    ('pre', 2026, 0, NULL)`)
}

describe('a season’s games', () => {
  it('lists them by date, with the score only once played', async () => {
    await addSchedule()
    const games = await readGames(db, 2026)
    expect(games.map((g) => g.id)).toEqual(['pre', 'ot', 'late', 'next'])
    expect(games[2]).toMatchObject({
      date: '2026-01-05',
      type: 'regular',
      played: true,
      hasBox: true,
      overtimes: 0,
      home: { id: String(BOS), code: 'BOS', name: 'Boston Celtics', score: 100 },
      away: { id: String(OKC), code: 'OKC', score: 90 }
    })
    expect(games[3]).toMatchObject({ played: false, hasBox: false, overtimes: null })
    expect(games[3].home.score).toBeNull()
  })

  it('reads overtime from the team’s minutes: 240 in regulation, 25 more per period', async () => {
    await addSchedule()
    const games = await readGames(db, 2026)
    expect(games.find((g) => g.id === 'ot')?.overtimes).toBe(2)
  })

  it('has no box score for a preseason game, and names a side no team row knows', async () => {
    await addSchedule()
    await db.exec(`CREATE TABLE src_nba_schedule (game_id VARCHAR, season INTEGER,
      home_team_abbreviation VARCHAR, home_team_name VARCHAR, away_team_abbreviation VARCHAR,
      away_team_name VARCHAR)`)
    await db.exec(
      `INSERT INTO src_nba_schedule VALUES ('pre', 2026, 'BOS', 'Celtics', 'RMD', 'Real Madrid')`
    )
    const pre = (await readGames(db, 2026)).find((g) => g.id === 'pre')
    expect(pre).toMatchObject({
      hasBox: false,
      overtimes: null,
      away: { id: '99', code: 'RMD', name: 'Real Madrid' }
    })
  })

  it('says a side not known yet is to be decided', async () => {
    await addSchedule()
    await db.exec(`INSERT INTO game VALUES
      ('tbd', 'tbd', 16, 2026, 'cup-final', DATE '2026-02-01', NULL, NULL, NULL, NULL, false)`)
    const tbd = (await readGames(db, 2026)).find((g) => g.id === 'tbd')
    expect(tbd?.home).toEqual({ id: null, code: 'TBD', name: 'To be decided', score: null })
  })

  it('is empty before the tables are built', async () => {
    await expect(readGames(db, 2026)).resolves.toEqual([])
  })
})

describe('a game’s facts', () => {
  const addEspn = async (home: string | null, away: string | null): Promise<void> => {
    await db.exec(`CREATE TABLE src_espn_schedule (game_id BIGINT, attendance DOUBLE,
      venue_full_name VARCHAR, venue_address_city VARCHAR, notes_headline VARCHAR,
      home_linescores VARCHAR, away_linescores VARCHAR)`)
    await db.exec(
      `INSERT INTO src_espn_schedule VALUES (11, 18984, 'TD Garden', 'Boston', 'NBA Cup', ?, ?)`,
      [home ?? '', away ?? '']
    )
  }

  it('reads the periods from ESPN’s text', () => {
    expect(
      parsePeriods(`[{'displayValue': '23', 'period': 1, 'value': 23.0}
 {'displayValue': '19', 'period': 2, 'value': 19.0}]`)
    ).toEqual([23, 19])
    expect(parsePeriods(null)).toEqual([])
  })

  it('keeps periods that add up to the final score', async () => {
    await addSchedule()
    await addEspn(`[{'value': 60.0} {'value': 40.0}]`, `[{'value': 50.0} {'value': 40.0}]`)
    await expect(readGame(db, 'late')).resolves.toEqual({
      id: 'late',
      venue: 'TD Garden',
      city: 'Boston',
      attendance: 18984,
      note: 'NBA Cup',
      periods: { home: [60, 40], away: [50, 40] }
    })
  })

  it('drops periods that do not, and those the source does not have', async () => {
    await addSchedule()
    await addEspn(`[{'value': 60.0}]`, `[{'value': 50.0}]`)
    expect((await readGame(db, 'late'))?.periods).toBeNull()
    await db.exec(`UPDATE src_espn_schedule SET home_linescores = '', away_linescores = ''`)
    expect((await readGame(db, 'late'))?.periods).toBeNull()
  })

  it('reads nothing for a game ESPN does not have', async () => {
    await addSchedule()
    await addEspn(null, null)
    await expect(readGame(db, 'other')).resolves.toBeNull()
  })
})

describe('a player', () => {
  const addPlayer = async (): Promise<void> => {
    await addSchedule()
    await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR)`)
    await db.exec(`INSERT INTO player VALUES (1, 'Ana Traded'), (-5, 'Old Timer')`)
    await db.exec(`CREATE TABLE player_season (player_id BIGINT, season INTEGER, game_type VARCHAR,
      team_id BIGINT, last_team_id BIGINT, last_date DATE, position VARCHAR)`)
    await db.exec(`INSERT INTO player_season VALUES
      (1, 2025, 'regular', NULL, ${BOS}, DATE '2025-04-01', 'G'),
      (1, 2026, 'regular', NULL, ${OKC}, DATE '2026-04-01', 'F'),
      (1, 2026, 'regular', ${OKC}, ${OKC}, DATE '2026-04-01', 'F'),
      (1, 2026, 'all-star', NULL, 91, DATE '2026-02-15', NULL)`)
  }

  it('reads their seasons, latest position and team', async () => {
    await addPlayer()
    await expect(readPlayer(db, '1')).resolves.toMatchObject({
      id: '1',
      name: 'Ana Traded',
      position: 'F',
      team: { id: String(OKC), code: 'OKC' },
      seasons: [2025, 2026],
      height: null,
      school: null
    })
  })

  it('reads the latest roster line, as published', async () => {
    await addPlayer()
    await db.exec(`CREATE TABLE src_nba_rosters (player_id BIGINT, season INTEGER, num VARCHAR,
      height VARCHAR, weight VARCHAR, birth_date VARCHAR, school VARCHAR)`)
    await db.exec(`INSERT INTO src_nba_rosters VALUES
      (1, 2025, '7', '6-5', '200', 'JAN 2, 1999', 'Old School'),
      (1, 2026, '23', '6-6', '210', 'JAN 2, 1999', '')`)
    await expect(readPlayer(db, '1')).resolves.toMatchObject({
      number: '23',
      height: '6-6',
      weight: '210',
      birthDate: 'JAN 2, 1999',
      school: null
    })
  })

  it('knows a player only ESPN knows, and nobody for an id nobody has', async () => {
    await addPlayer()
    await expect(readPlayer(db, '-5')).resolves.toMatchObject({ name: 'Old Timer', seasons: [] })
    await expect(readPlayer(db, '999')).resolves.toBeNull()
    await expect(readPlayer(db, 'not a number')).resolves.toBeNull()
  })
})

describe('the standings', () => {
  const COLUMNS = `team_id BIGINT, season INTEGER, team_city VARCHAR, team_name VARCHAR,
    conference VARCHAR, division VARCHAR, playoff_rank BIGINT, division_rank BIGINT, wins BIGINT,
    losses BIGINT, win_pct DOUBLE, conference_games_back DOUBLE, division_games_back DOUBLE,
    home VARCHAR, road VARCHAR, conference_record VARCHAR, division_record VARCHAR, l10 VARCHAR,
    str_current_streak VARCHAR, points_pg DOUBLE, opp_points_pg DOUBLE, diff_points_pg DOUBLE`

  it('reads the NBA’s file, trimming what it pads', async () => {
    await addSchedule()
    await db.exec(`CREATE TABLE src_nba_standings (${COLUMNS})`)
    await db.exec(`INSERT INTO src_nba_standings VALUES
      (${BOS}, 2026, 'Boston', 'Celtics', 'East', 'Atlantic', 2, 1, 56, 26, 0.683, 4, 0, '30-11',
       '26-15', '36-16  ', '10-6', '8-2', 'W 2', 114.9, 107.2, 7.7)`)
    await expect(readStandings(db, 2026)).resolves.toEqual([
      {
        teamId: String(BOS),
        code: 'BOS',
        name: 'Boston Celtics',
        conference: 'East',
        division: 'Atlantic',
        conferenceRank: 2,
        divisionRank: 1,
        wins: 56,
        losses: 26,
        winPct: 0.683,
        conferenceGamesBack: 4,
        divisionGamesBack: 0,
        home: '30-11',
        road: '26-15',
        conferenceRecord: '36-16',
        divisionRecord: '10-6',
        last10: '8-2',
        streak: 'W 2',
        pointsPerGame: 114.9,
        allowedPerGame: 107.2,
        differential: 7.7
      }
    ])
  })

  it('falls back to the dashboards’ file for the season only it reaches', async () => {
    await addSchedule()
    await db.exec(`CREATE TABLE src_nba_standings (${COLUMNS})`)
    await db.exec(`CREATE TABLE src_dash_standings (${COLUMNS})`)
    await db.exec(`INSERT INTO src_dash_standings VALUES
      (${BOS}, 1996, 'Boston', 'Celtics', 'East', 'Atlantic', 11, 5, 33, 49, 0.402, 39, 27, '18-23',
       '15-26', '22-32', '10-18', NULL, NULL, 107.0, 110.0, -3.0)`)
    const rows = await readStandings(db, 1996)
    expect(rows[0]).toMatchObject({ wins: 33, code: null, last10: null, streak: null })
  })

  it('reads a record that only repeats the overall one, on every team, as not published', async () => {
    await addSchedule()
    await db.exec(`CREATE TABLE src_nba_standings (team_id BIGINT, season INTEGER, wins BIGINT,
      losses BIGINT, record VARCHAR, conference_record VARCHAR, division_record VARCHAR)`)
    await db.exec(`INSERT INTO src_nba_standings VALUES
      (${BOS}, 2004, 36, 46, '36-46', '36-46', '36-46'),
      (${OKC}, 2004, 37, 45, '37-45', '37-45', '37-45'),
      (${BOS}, 2027, 8, 1, '8-1', '8-1', '2-0'),
      (${OKC}, 2027, 6, 2, '6-2', '5-2', '3-1')`)
    expect((await readStandings(db, 2004))[0]).toMatchObject({
      conferenceRecord: null,
      divisionRecord: null
    })
    // Early in a season a team can truly have played only its conference.
    const now = await readStandings(db, 2027)
    expect(now.map((r) => r.conferenceRecord).sort()).toEqual(['5-2', '8-1'])
  })

  it('is empty before they start, and with no file loaded', async () => {
    await expect(readStandings(db, 2026)).resolves.toEqual([])
    await db.exec(`CREATE TABLE src_nba_standings (${COLUMNS})`)
    await addSchedule()
    await expect(readStandings(db, 1994)).resolves.toEqual([])
  })

  it('reads a column the source has dropped as NULL, and does not fail', async () => {
    await addSchedule()
    await db.exec(`CREATE TABLE src_nba_standings (team_id BIGINT, season INTEGER, wins BIGINT,
      losses BIGINT, team_city VARCHAR, team_name VARCHAR)`)
    await db.exec(`INSERT INTO src_nba_standings VALUES (${BOS}, 2026, 1, 2, 'Boston', 'Celtics')`)
    const rows = await readStandings(db, 2026)
    expect(rows[0]).toMatchObject({ wins: 1, losses: 2, streak: null, conferenceGamesBack: null })
  })
})
