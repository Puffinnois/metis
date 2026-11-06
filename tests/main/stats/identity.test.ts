import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  buildIdentity,
  canBuildIdentity,
  IDENTITY_VERSION,
  identityStale,
  markIdentityStale
} from '@main/stats/identity'
import { openTestDb } from '../../fixtures/stats'

const ATL = 1610612737
const BOS = 1610612738
const HORNETS_OLD = 1610612766
const PELICANS = 1610612740

/** Everything identity reads, empty, in the shape of the real files. */
async function emptySources(db: StatsDb): Promise<void> {
  await db.exec(`CREATE TABLE src_nba_schedule (game_id VARCHAR, season INTEGER, game_date VARCHAR,
    home_team_id BIGINT, home_team_abbreviation VARCHAR, away_team_id BIGINT, home_pts BIGINT, away_pts BIGINT)`)
  await db.exec(`CREATE TABLE src_espn_schedule (game_id INTEGER, season INTEGER, file_season INTEGER,
    season_type INTEGER, game_date DATE, home_id INTEGER, away_id INTEGER, home_score INTEGER,
    away_score INTEGER, status_type_completed BOOLEAN)`)
  await db.exec(`CREATE TABLE src_nba_player_box (game_id VARCHAR, season INTEGER, person_id BIGINT,
    first_name VARCHAR, family_name VARCHAR, points BIGINT, rebounds_total BIGINT, assists BIGINT,
    field_goals_attempted BIGINT, fouls_personal BIGINT)`)
  await db.exec(`CREATE TABLE src_espn_player_box (game_id INTEGER, season INTEGER, file_season INTEGER,
    athlete_id INTEGER, athlete_display_name VARCHAR, points INTEGER, rebounds INTEGER, assists INTEGER,
    field_goals_attempted INTEGER, fouls INTEGER)`)
  await db.exec(`CREATE TABLE src_team_aliases (team_id VARCHAR, source VARCHAR, source_id VARCHAR,
    valid_from INTEGER, valid_to INTEGER)`)
  await db.exec(`INSERT INTO src_team_aliases VALUES
    ('1', 'nba_stats', '${ATL}', 1997, 2027),
    ('2', 'nba_stats', '${BOS}', 1997, 2027),
    ('3', 'nba_stats', '${HORNETS_OLD}', 1997, 2002),
    ('3', 'nba_stats', '${PELICANS}', 2003, 2027),
    ('1', 'fox', '99', 2002, 2027)`)
  await db.exec(`CREATE TABLE src_team_groups (season INTEGER, team_id VARCHAR, team_name VARCHAR,
    conference_id VARCHAR, division_id VARCHAR)`)
  await db.exec(`INSERT INTO src_team_groups
    SELECT s, t, 'Team ' || t, 'nba:east', 'nba:atlantic'
    FROM (VALUES (1990), (1994), (2002), (2003), (2026)) AS seasons(s), (VALUES ('1'), ('2'), ('3')) AS teams(t)`)
  await db.exec(
    `CREATE TABLE src_xwalk_game (nba_game_id VARCHAR, espn_game_id VARCHAR, match_confidence DOUBLE)`
  )
  await db.exec(`CREATE TABLE src_xwalk_player (espn_athlete_id VARCHAR, nba_player_id VARCHAR)`)
}

/** Keeps the ESPN schedule from limiting `team`, which starts at its first season. */
const anchorEspn = (db: StatsDb): Promise<void> =>
  db.exec(
    `INSERT INTO src_espn_schedule VALUES (9000, 1994, 1994, 2, DATE '1993-11-05', 1, 2, 100, 90, true)`
  )

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
  await emptySources(db)
})

describe('whether identity can be built', () => {
  it('waits for every table it reads', async () => {
    expect(await canBuildIdentity(db)).toBe(true)
    await db.exec('DROP TABLE src_xwalk_player')
    expect(await canBuildIdentity(db)).toBe(false)
  })

  it('is stale until built at the current version', async () => {
    expect(await identityStale(db)).toBe(true)
    await buildIdentity(db)
    expect(await identityStale(db)).toBe(false)
    await db.exec('UPDATE derived_state SET version = ? WHERE name = ?', [
      IDENTITY_VERSION - 1,
      'identity'
    ])
    expect(await identityStale(db)).toBe(true)
  })
})

describe('a build the app never got to', () => {
  it('is still due on the next refresh', async () => {
    await buildIdentity(db)
    await markIdentityStale(db)
    expect(await identityStale(db)).toBe(true)
  })
})

describe('team', () => {
  it('maps ESPN ids to NBA ids by season, across a move', async () => {
    await anchorEspn(db)
    await buildIdentity(db)
    expect(
      await db.all('SELECT season, team_id FROM team WHERE espn_team_id = 3 ORDER BY season')
    ).toEqual([
      { season: 1994, team_id: HORNETS_OLD },
      { season: 2002, team_id: HORNETS_OLD },
      { season: 2003, team_id: PELICANS },
      { season: 2026, team_id: PELICANS }
    ])
  })

  it('takes a season before the alias table starts from its first row', async () => {
    await anchorEspn(db)
    await buildIdentity(db)
    expect(
      await db.get('SELECT team_id FROM team WHERE season = 1994 AND espn_team_id = 1')
    ).toEqual({ team_id: ATL })
  })

  it('starts when the games start, and names conference and division plainly', async () => {
    await anchorEspn(db)
    await buildIdentity(db)
    expect(await db.get('SELECT min(season) AS first FROM team')).toEqual({ first: 1994 })
    expect(
      await db.get('SELECT conference, division FROM team WHERE season = 2026 LIMIT 1')
    ).toEqual({ conference: 'east', division: 'atlantic' })
  })

  it("uses the NBA's code, and the team's earliest before the NBA's data starts", async () => {
    await anchorEspn(db)
    await db.exec(`INSERT INTO src_nba_schedule VALUES
      ('0022500001', 2026, '2025-10-21', ${ATL}, 'ATL', ${BOS}, 100, 90),
      ('0020100001', 2002, '2001-11-01', ${HORNETS_OLD}, 'CHH', ${ATL}, 100, 90)`)
    await buildIdentity(db)
    expect(
      await db.all(`SELECT season, code FROM team WHERE team_id = ${HORNETS_OLD} ORDER BY season`)
    ).toEqual([
      { season: 1994, code: 'CHH' },
      { season: 2002, code: 'CHH' }
    ])
  })
})

describe('game', () => {
  const nbaGame = (id: string, season: number, date: string, home = ATL, away = BOS): string =>
    `('${id}', ${season}, '${date}', ${home}, 'H', ${away}, 100, 90)`

  it('takes the type from the prefix of the NBA game id', async () => {
    await db.exec(`INSERT INTO src_nba_schedule VALUES
      ${nbaGame('0012500001', 2026, '2025-10-02')},
      ${nbaGame('0022500001', 2026, '2025-10-21')},
      ${nbaGame('0032500001', 2026, '2026-02-15')},
      ${nbaGame('0042500001', 2026, '2026-04-18')},
      ${nbaGame('0052500001', 2026, '2026-04-14')},
      ${nbaGame('0062500001', 2026, '2025-12-16')}`)
    await buildIdentity(db)
    expect(await db.all('SELECT game_id, game_type FROM game ORDER BY game_id')).toEqual([
      { game_id: '0012500001', game_type: 'preseason' },
      { game_id: '0022500001', game_type: 'regular' },
      { game_id: '0032500001', game_type: 'all-star' },
      { game_id: '0042500001', game_type: 'playoffs' },
      { game_id: '0052500001', game_type: 'play-in' },
      { game_id: '0062500001', game_type: 'cup-final' }
    ])
  })

  it('does not call a cancelled or future game played', async () => {
    await db.exec(`INSERT INTO src_nba_schedule VALUES
      ('0021201214', 2013, '2013-04-16', ${BOS}, 'BOS', ${ATL}, 0, 0),
      ('0022600001', 2027, '2027-01-01', ${BOS}, 'BOS', 0, NULL, NULL)`)
    await buildIdentity(db)
    expect(await db.all('SELECT game_id, played, away_team_id FROM game ORDER BY game_id')).toEqual(
      [
        { game_id: '0021201214', played: false, away_team_id: ATL },
        { game_id: '0022600001', played: false, away_team_id: null }
      ]
    )
  })

  it('links ESPN ids through the crosswalk', async () => {
    await db.exec(
      `INSERT INTO src_nba_schedule VALUES ${nbaGame('0022500001', 2026, '2025-10-21')}`
    )
    await db.exec(`INSERT INTO src_xwalk_game VALUES ('0022500001', '401809234', 1)`)
    await buildIdentity(db)
    expect(await db.get('SELECT espn_game_id FROM game')).toEqual({ espn_game_id: 401809234 })
  })

  it('links by the same teams within a day when the crosswalk has none', async () => {
    await anchorEspn(db)
    await db.exec(
      `INSERT INTO src_nba_schedule VALUES ${nbaGame('0029900001', 2000, '1999-11-02')}`
    )
    await db.exec(
      `INSERT INTO src_espn_schedule VALUES (5001, 2000, 2000, 2, DATE '1999-11-03', 1, 2, 100, 90, true)`
    )
    await db.exec(`INSERT INTO src_team_groups
      SELECT s, t, 'Team', 'nba:east', 'nba:atlantic' FROM (VALUES (2000)) AS a(s), (VALUES ('1'), ('2')) AS b(t)`)
    await buildIdentity(db)
    expect(await db.get("SELECT espn_game_id FROM game WHERE game_id = '0029900001'")).toEqual({
      espn_game_id: 5001
    })
  })

  it('does not link the same teams two days apart', async () => {
    await anchorEspn(db)
    await db.exec(
      `INSERT INTO src_nba_schedule VALUES ${nbaGame('0029900001', 2000, '1999-11-02')}`
    )
    await db.exec(
      `INSERT INTO src_espn_schedule VALUES (5001, 2000, 2000, 2, DATE '1999-11-04', 1, 2, 100, 90, true)`
    )
    await db.exec(`INSERT INTO src_team_groups
      SELECT s, t, 'Team', 'nba:east', 'nba:atlantic' FROM (VALUES (2000)) AS a(s), (VALUES ('1'), ('2')) AS b(t)`)
    await buildIdentity(db)
    expect(await db.get("SELECT espn_game_id FROM game WHERE game_id = '0029900001'")).toEqual({
      espn_game_id: null
    })
  })

  it('reads ESPN games only before the NBA data starts, and counts the league only', async () => {
    await db.exec(
      `INSERT INTO src_nba_schedule VALUES ${nbaGame('0029600001', 1997, '1996-11-01')}`
    )
    await db.exec(`INSERT INTO src_espn_schedule VALUES
      (1, 1994, 1994, 2, DATE '1993-11-05', 1, 2, 100, 90, true),
      (2, 1994, 1994, 3, DATE '1994-04-28', 1, 2, 100, 90, true),
      (3, 1994, 1994, 2, DATE '1994-01-05', 75, 1, 100, 90, true),
      (4, 1997, 1997, 2, DATE '1996-11-05', 1, 2, 100, 90, true)`)
    await db.exec(`INSERT INTO src_team_groups
      SELECT 1997, t, 'Team', 'nba:east', 'nba:atlantic' FROM (VALUES ('1'), ('2')) AS b(t)`)
    await buildIdentity(db)
    expect(
      await db.all("SELECT game_id, game_type FROM game WHERE source = 'espn' ORDER BY game_id")
    ).toEqual([
      { game_id: 'espn:1', game_type: 'regular' },
      { game_id: 'espn:2', game_type: 'playoffs' },
      // A touring team is not in the league.
      { game_id: 'espn:3', game_type: 'preseason' }
    ])
  })

  it('reads an ESPN game in two files once, and leaves out postponed rows', async () => {
    await db.exec(
      `INSERT INTO src_nba_schedule VALUES ${nbaGame('0029600001', 1997, '1996-11-01')}`
    )
    await db.exec(`INSERT INTO src_espn_schedule VALUES
      (1, 1994, 1995, 2, DATE '1993-11-05', 1, 2, 100, 90, true),
      (1, 1994, 1994, 2, DATE '1993-11-05', 1, 2, 100, 90, true),
      (2, 1994, 1994, 2, DATE '1993-11-06', 1, 2, NULL, NULL, false)`)
    await buildIdentity(db)
    expect(await db.all("SELECT game_id FROM game WHERE source = 'espn'")).toEqual([
      { game_id: 'espn:1' }
    ])
  })
})

describe('player_ids', () => {
  const nbaLine = (game: string, person: number, name: [string, string], pts: number): string =>
    `('${game}', 2000, ${person}, '${name[0]}', '${name[1]}', ${pts}, 3, 2, 10, 1)`
  const espnLine = (game: number, athlete: number, name: string, pts: number): string =>
    `(${game}, 2000, 2000, ${athlete}, '${name}', ${pts}, 3, 2, 10, 1)`

  beforeEach(async () => {
    await db.exec(`INSERT INTO src_nba_schedule VALUES
      ('0029900001', 2000, '1999-11-02', ${ATL}, 'ATL', ${BOS}, 100, 90),
      ('0029900002', 2000, '1999-11-05', ${ATL}, 'ATL', ${BOS}, 100, 90),
      ('0029900003', 2000, '1999-11-08', ${ATL}, 'ATL', ${BOS}, 100, 90)`)
    await db.exec(`INSERT INTO src_xwalk_game VALUES
      ('0029900001', '1', 1), ('0029900002', '2', 1), ('0029900003', '3', 1)`)
  })

  it('takes the crosswalk first', async () => {
    await db.exec(`INSERT INTO src_xwalk_player VALUES ('50', '500')`)
    await db.exec(`INSERT INTO src_espn_player_box VALUES ${espnLine(1, 50, 'Some Player', 20)}`)
    await buildIdentity(db)
    expect(await db.all('SELECT * FROM player_ids')).toEqual([
      { espn_athlete_id: 50, player_id: 500, method: 'crosswalk' }
    ])
  })

  it('matches box-score lines when the names differ', async () => {
    await db.exec(`INSERT INTO src_nba_player_box VALUES
      ${nbaLine('0029900001', 73, ['Muggsy', 'Bogues'], 12)},
      ${nbaLine('0029900002', 73, ['Muggsy', 'Bogues'], 7)}`)
    await db.exec(`INSERT INTO src_espn_player_box VALUES
      ${espnLine(1, 900, 'Tyrone Bogues', 12)},
      ${espnLine(2, 900, 'Tyrone Bogues', 7)}`)
    await buildIdentity(db)
    expect(await db.all('SELECT * FROM player_ids')).toEqual([
      { espn_athlete_id: 900, player_id: 73, method: 'box score' }
    ])
  })

  it('does not trust a single matching line', async () => {
    await db.exec(
      `INSERT INTO src_nba_player_box VALUES ${nbaLine('0029900001', 73, ['Muggsy', 'Bogues'], 12)}`
    )
    await db.exec(`INSERT INTO src_espn_player_box VALUES ${espnLine(1, 900, 'Tyrone Bogues', 12)}`)
    await buildIdentity(db)
    expect(await db.get('SELECT method FROM player_ids')).toEqual({ method: 'espn only' })
  })

  it('wants a clear winner, not two players with similar lines', async () => {
    await db.exec(`INSERT INTO src_nba_player_box VALUES
      ${nbaLine('0029900001', 73, ['A', 'One'], 12)},
      ${nbaLine('0029900002', 73, ['A', 'One'], 7)},
      ${nbaLine('0029900001', 74, ['B', 'Two'], 12)},
      ${nbaLine('0029900002', 74, ['B', 'Two'], 7)}`)
    await db.exec(`INSERT INTO src_espn_player_box VALUES
      ${espnLine(1, 900, 'Tyrone Bogues', 12)},
      ${espnLine(2, 900, 'Tyrone Bogues', 7)}`)
    await buildIdentity(db)
    expect(await db.get('SELECT method FROM player_ids')).toEqual({ method: 'espn only' })
  })

  it('does not count lines of all zeros', async () => {
    await db.exec(`INSERT INTO src_nba_player_box VALUES
      ('0029900001', 2000, 73, 'Muggsy', 'Bogues', 0, 0, 0, 0, 1),
      ('0029900002', 2000, 73, 'Muggsy', 'Bogues', 0, 0, 0, 0, 1)`)
    await db.exec(`INSERT INTO src_espn_player_box VALUES
      (1, 2000, 2000, 900, 'Tyrone Bogues', 0, 0, 0, 0, 1),
      (2, 2000, 2000, 900, 'Tyrone Bogues', 0, 0, 0, 0, 1)`)
    await buildIdentity(db)
    expect(await db.get('SELECT method FROM player_ids')).toEqual({ method: 'espn only' })
  })

  it('falls back to the same name in the same season, ignoring accents and suffixes', async () => {
    await db.exec(`INSERT INTO src_nba_player_box VALUES
      ('0029900001', 2000, 80, 'José', 'Calderón Jr.', 1, 1, 1, 1, 1)`)
    await db.exec(`INSERT INTO src_espn_player_box VALUES
      (9, 2000, 2000, 901, 'Jose Calderon', 5, 5, 5, 5, 5)`)
    await buildIdentity(db)
    expect(await db.all('SELECT * FROM player_ids')).toEqual([
      { espn_athlete_id: 901, player_id: 80, method: 'name' }
    ])
  })

  it('does not match a name two players share', async () => {
    await db.exec(`INSERT INTO src_nba_player_box VALUES
      ('0029900001', 2000, 80, 'Mike', 'James', 1, 1, 1, 1, 1),
      ('0029900001', 2000, 81, 'Mike', 'James', 2, 2, 2, 2, 2)`)
    await db.exec(`INSERT INTO src_espn_player_box VALUES
      (9, 2000, 2000, 901, 'Mike James', 5, 5, 5, 5, 5)`)
    await buildIdentity(db)
    expect(await db.get('SELECT method FROM player_ids')).toEqual({ method: 'espn only' })
  })

  it('gives a player only ESPN knows a negative id', async () => {
    await db.exec(`INSERT INTO src_espn_player_box VALUES
      (9, 1994, 1994, 901, 'Old Timer', 5, 5, 5, 5, 5)`)
    await buildIdentity(db)
    expect(await db.all('SELECT * FROM player_ids')).toEqual([
      { espn_athlete_id: 901, player_id: -901, method: 'espn only' }
    ])
  })

  it('reads a line in two files once', async () => {
    await db.exec(`INSERT INTO src_nba_player_box VALUES
      ${nbaLine('0029900001', 73, ['Muggsy', 'Bogues'], 12)},
      ${nbaLine('0029900002', 73, ['Muggsy', 'Bogues'], 7)}`)
    await db.exec(`INSERT INTO src_espn_player_box VALUES
      ${espnLine(1, 900, 'Tyrone Bogues', 12)},
      (1, 2000, 2001, 900, 'Tyrone Bogues', 12, 3, 2, 10, 1),
      ${espnLine(2, 900, 'Tyrone Bogues', 7)}`)
    await buildIdentity(db)
    expect(await db.get('SELECT method FROM player_ids')).toEqual({ method: 'box score' })
  })
})

describe('player', () => {
  it('holds everyone once, across both sources', async () => {
    await db.exec(`INSERT INTO src_xwalk_player VALUES ('50', '500'), ('51', '500')`)
    await db.exec(`INSERT INTO src_nba_player_box VALUES
      ('g', 2005, 500, 'Same', 'Person', 1, 1, 1, 1, 1),
      ('g', 2006, 500, 'Same', 'Person Jr.', 1, 1, 1, 1, 1),
      ('g', 2006, 600, 'Only', 'Nba', 1, 1, 1, 1, 1)`)
    await db.exec(`INSERT INTO src_espn_player_box VALUES
      (1, 2003, 2003, 50, 'Same Person', 1, 1, 1, 1, 1),
      (1, 2004, 2004, 51, 'Same Person', 1, 1, 1, 1, 1),
      (1, 1995, 1995, 70, 'Only Espn', 1, 1, 1, 1, 1)`)
    await buildIdentity(db)
    expect(
      await db.all(
        `SELECT player_id, name, espn_athlete_id, method, first_season, last_season
         FROM player ORDER BY player_id`
      )
    ).toEqual([
      {
        player_id: -70,
        name: 'Only Espn',
        espn_athlete_id: 70,
        method: 'espn only',
        first_season: 1995,
        last_season: 1995
      },
      {
        player_id: 500,
        name: 'Same Person Jr.',
        espn_athlete_id: 50,
        method: 'crosswalk',
        first_season: 2003,
        last_season: 2006
      },
      {
        player_id: 600,
        name: 'Only Nba',
        espn_athlete_id: null,
        method: 'nba only',
        first_season: 2006,
        last_season: 2006
      }
    ])
  })
})

describe("a player's name", () => {
  const line = (person: number, first: string, family: string): Promise<void> =>
    db.exec('INSERT INTO src_nba_player_box VALUES (?, 2026, ?, ?, ?, 10, 5, 5, 8, 1)', [
      `g${person}`,
      person,
      first,
      family
    ])

  const nameOf = async (person: number): Promise<string | undefined> =>
    (await db.get<{ name: string }>('SELECT name FROM player WHERE player_id = ?', [person]))?.name

  it("takes the box score's when there are no rosters", async () => {
    await line(1, 'Ming', 'Yao')
    await buildIdentity(db)
    expect(await nameOf(1)).toBe('Ming Yao')
  })

  describe('with rosters', () => {
    beforeEach(async () => {
      await db.exec(
        'CREATE TABLE src_nba_rosters (player_id BIGINT, season INTEGER, player VARCHAR)'
      )
    })

    const roster = (person: number, name: string | null, season = 2026): Promise<void> =>
      db.exec('INSERT INTO src_nba_rosters VALUES (?, ?, ?)', [person, season, name])

    it('takes the same words in the order the player goes by', async () => {
      await line(1, 'Ming', 'Yao')
      await roster(1, 'Yao Ming')
      await buildIdentity(db)
      expect(await nameOf(1)).toBe('Yao Ming')
    })

    it('takes the one name a player goes by', async () => {
      await line(1, 'Nene', 'Hilario')
      await roster(1, 'Nene')
      await buildIdentity(db)
      expect(await nameOf(1)).toBe('Nene')
    })

    it('reads the latest roster', async () => {
      await line(1, 'Ming', 'Yao')
      await roster(1, 'Ming Yao', 2003)
      await roster(1, 'Yao Ming', 2011)
      await buildIdentity(db)
      expect(await nameOf(1)).toBe('Yao Ming')
    })

    it('refuses a roster name that repeats a word', async () => {
      await line(1, 'Seung-Jin', 'Ha')
      await roster(1, 'Ha Ha')
      await buildIdentity(db)
      expect(await nameOf(1)).toBe('Seung-Jin Ha')
    })

    it('refuses a roster name with a word the box score does not have', async () => {
      await line(1, 'Brandon', 'Boston')
      await roster(1, 'Brandon Boston Jr.')
      await line(2, 'Anzejs', 'Pasecniks')
      await roster(2, 'Anžejs Pasečņiks')
      await buildIdentity(db)
      expect(await nameOf(1)).toBe('Brandon Boston')
      expect(await nameOf(2)).toBe('Anzejs Pasecniks')
    })

    it('keeps the box score when the player is on no roster, or the roster has no name', async () => {
      await line(1, 'Cui', 'Yongxi')
      await line(2, 'Jane', 'Doe')
      await roster(2, null)
      await buildIdentity(db)
      expect(await nameOf(1)).toBe('Cui Yongxi')
      expect(await nameOf(2)).toBe('Jane Doe')
    })
  })
})
