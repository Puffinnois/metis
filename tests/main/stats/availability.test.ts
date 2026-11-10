import { beforeEach, describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import { readAvailability, readCoaches, readOfficials } from '@main/stats/availabilityReads'
import { buildPublished } from '@main/stats/derived/published'
import { openTestDb } from '../../fixtures/stats'

let db: StatsDb

beforeEach(async () => {
  db = await openTestDb()
})

const REPORT = `CREATE TABLE src_nba_injury_report (season INTEGER, report_datetime TIMESTAMP,
  game_date DATE, team_id BIGINT, report_player_name VARCHAR, current_status VARCHAR, reason VARCHAR,
  category VARCHAR, game_id VARCHAR, person_id BIGINT)`

const INJURY = 'Injury/Illness - Left Ankle; Sprain'

type Report = [
  game: string | null,
  team: number,
  player: number | null,
  at: string,
  status: string | null,
  reason: string | null,
  category?: string | null
]

/** Rows in the source's shape; the season and the game date come from the game. */
async function addReports(rows: Report[], season = 2026): Promise<void> {
  const q = (v: string | number | null | undefined): string =>
    v === null || v === undefined
      ? 'NULL'
      : typeof v === 'number'
        ? String(v)
        : `'${v.replace(/'/g, "''")}'`
  await db.exec(
    `INSERT INTO src_nba_injury_report VALUES ${rows
      .map(
        ([game, team, player, at, status, reason, category]) =>
          `(${season}, TIMESTAMP '${at}', DATE '${at.slice(0, 10)}', ${team}, NULL, ${q(status)}, ${q(reason)}, ${q(category)}, ${q(game)}, ${q(player)})`
      )
      .join(', ')}`
  )
}

async function addGames(): Promise<void> {
  await db.exec(`CREATE TABLE game (game_id VARCHAR, nba_game_id VARCHAR, season INTEGER,
    game_type VARCHAR, played BOOLEAN)`)
  await db.exec(`INSERT INTO game VALUES
    ('g1', 'g1', 2026, 'regular', true), ('g2', 'g2', 2026, 'regular', true),
    ('g3', 'g3', 2026, 'regular', true), ('g4', 'g4', 2026, 'playoffs', true),
    ('g5', 'g5', 2026, 'regular', false), ('g6', 'g6', 2026, 'preseason', true),
    ('g7', 'g7', 2026, 'play-in', true), ('g8', 'g8', 2019, 'regular', true)`)
}

const rows = (): Promise<
  {
    player_id: number
    season: number
    game_type: string
    games_out_injury: number
    games_out_other: number
  }[]
> =>
  db.all(
    'SELECT player_id, season, game_type, games_out_injury, games_out_other FROM pub_player_availability ORDER BY player_id, game_type'
  )

describe('games out, from the injury reports', () => {
  beforeEach(async () => {
    await db.exec(REPORT)
    await addGames()
    await addReports([
      // Player 1, game 1: the same Out in three reports. It is one game.
      ['g1', 7, 1, '2026-01-01 15:00:00', 'Out', INJURY],
      ['g1', 7, 1, '2026-01-01 19:00:00', 'Out', INJURY],
      ['g1', 7, 1, '2026-01-02 15:00:00', 'Out', INJURY],
      // Game 2: Out, then upgraded to Questionable. The last report decides: not out.
      ['g2', 7, 1, '2026-01-03 15:00:00', 'Out', INJURY],
      ['g2', 7, 1, '2026-01-04 15:00:00', 'Questionable', INJURY],
      // Game 3: Questionable, then ruled Out.
      ['g3', 7, 1, '2026-01-05 15:00:00', 'Questionable', INJURY],
      ['g3', 7, 1, '2026-01-06 15:00:00', 'Out', INJURY],
      // Player 2: a G League assignment is out for another reason; a 2018-19 style row files the
      // category apart; a concussion protocol with no category is an injury, and the playoffs count apart.
      ['g1', 7, 2, '2026-01-01 15:00:00', 'Out', 'G League - Two-Way'],
      ['g1', 7, 2, '2026-01-02 15:00:00', 'Out', 'G League - Two-Way'],
      ['g2', 7, 2, '2026-01-03 15:00:00', 'Out', 'Left knee soreness', 'Injury/Illness'],
      ['g4', 7, 2, '2026-04-20 15:00:00', 'Out', 'Concussion Protocol'],
      // Player 3: games that do not count.
      ['g5', 8, 3, '2026-02-01 15:00:00', 'Out', INJURY],
      ['g6', 8, 3, '2026-02-02 15:00:00', 'Out', INJURY],
      ['g7', 8, 3, '2026-02-03 15:00:00', 'Out', INJURY],
      ['g8', 8, 3, '2019-02-03 15:00:00', 'Out', INJURY],
      // Player 4: listed Out early and gone from the last report, which lists others: still the
      // last report that lists them.
      ['g1', 8, 4, '2026-01-01 15:00:00', 'Out', 'Injury/Illness - Back; Spasms'],
      ['g1', 8, 5, '2026-01-02 15:00:00', 'Out', '-'],
      // Rows that name no player or no game, and a report not yet submitted.
      ['g1', 8, null, '2026-01-02 15:00:00', null, 'NOT YET SUBMITTED'],
      [null, 8, 1, '2026-01-02 15:00:00', 'Out', INJURY],
      ['g1', 8, 6, '2026-01-02 15:00:00', 'Available', null]
    ])
  })

  it('counts a game once however many reports listed it, by the last report', async () => {
    await buildPublished(db)
    expect(await rows()).toMatchObject([
      { player_id: 1, season: 2026, game_type: 'regular', games_out_injury: 2, games_out_other: 0 },
      {
        player_id: 2,
        season: 2026,
        game_type: 'playoffs',
        games_out_injury: 1,
        games_out_other: 0
      },
      { player_id: 2, season: 2026, game_type: 'regular', games_out_injury: 1, games_out_other: 1 },
      { player_id: 4, season: 2026, game_type: 'regular', games_out_injury: 1, games_out_other: 0 },
      { player_id: 5, season: 2026, game_type: 'regular', games_out_injury: 0, games_out_other: 1 },
      { player_id: 6, season: 2026, game_type: 'regular', games_out_injury: 0, games_out_other: 0 }
    ])
  })

  it('leaves out games not played, other season types and seasons before the reports are complete', async () => {
    await buildPublished(db)
    expect((await rows()).some((r) => r.player_id === 3)).toBe(false)
  })

  it('publishes no games, minutes or possessions, so a rate has nothing to divide by', async () => {
    await buildPublished(db)
    const r = await db.get<{
      games: number | null
      minutes: number | null
      possessions: number | null
    }>('SELECT games, minutes, possessions FROM pub_player_availability LIMIT 1')
    expect(r).toEqual({ games: null, minutes: null, possessions: null })
  })

  it('builds empty, and does not fail, without the reports or without the games', async () => {
    await db.exec('DROP TABLE src_nba_injury_report')
    await buildPublished(db)
    expect(await rows()).toEqual([])
    await db.exec(REPORT)
    await db.exec('DROP TABLE game')
    await buildPublished(db)
    expect(await rows()).toEqual([])
  })

  it('builds empty from a report file that lost a column', async () => {
    await db.exec('DROP TABLE src_nba_injury_report')
    await db.exec('CREATE TABLE src_nba_injury_report (game_id VARCHAR, person_id BIGINT)')
    await buildPublished(db)
    expect(await rows()).toEqual([])
  })
})

describe('a status on the latest report', () => {
  beforeEach(async () => {
    await db.exec(REPORT)
    await addReports(
      [
        // 2026-27, team 101: two reports for the game. The first lists Ana (Out) and Bo (Questionable),
        // the second lists Ana as Questionable and Cy as Out, and not Bo.
        ['n1', 101, 1, '2026-11-04 15:00:00', 'Out', INJURY],
        [
          'n1',
          101,
          2,
          '2026-11-04 15:00:00',
          'Questionable',
          'Injury/Illness - Right Knee; Soreness'
        ],
        ['n1', 101, 1, '2026-11-06 15:00:00', 'Questionable', INJURY],
        ['n1', 101, 3, '2026-11-06 15:00:00', 'Out', '-'],
        ['n1', 101, 7, '2026-11-06 15:00:00', 'Out', 'G League - On Assignment'],
        // A report waiting for the team's submission lists nobody and does not hide the last real one.
        ['n2', 101, null, '2026-11-08 15:00:00', null, 'NOT YET SUBMITTED']
      ].map((r) => r as Report),
      2027
    )
    // A team with no row this season: an older season’s listing does not make a tag.
    await addReports([['o1', 102, 4, '2026-03-01 15:00:00', 'Out', INJURY]], 2026)
  })

  it('is the status on the team’s newest report that lists anyone, with the reason and the date', async () => {
    const got = await readAvailability(db, ['1', '2', '3', '4', '7', '99'])
    expect(got).toMatchObject([
      {
        playerId: '1',
        status: 'Questionable',
        reason: INJURY,
        injury: true,
        reportDate: '2026-11-06'
      },
      { playerId: '3', status: 'Out', reason: null, injury: false, reportDate: '2026-11-06' },
      { playerId: '7', status: 'Out', injury: false }
    ])
    expect(got.map((g) => g.playerId).sort()).toEqual(['1', '3', '7'])
  })

  it('has nothing for a player the latest report does not list', async () => {
    // Bo (2) was on an earlier report only; player 4 is on a past season's.
    const got = await readAvailability(db, ['2', '4'])
    expect(got).toEqual([])
  })

  it('ignores ids that are not numbers, and reads as nothing without the table', async () => {
    expect(await readAvailability(db, ['x; DROP TABLE game', ''])).toEqual([])
    await db.exec('DROP TABLE src_nba_injury_report')
    expect(await readAvailability(db, ['1'])).toEqual([])
  })
})

describe('a team’s coaches', () => {
  beforeEach(async () => {
    await db.exec(`CREATE TABLE src_nba_coaches (team_id BIGINT, season INTEGER, coach_id BIGINT,
      first_name VARCHAR, last_name VARCHAR, coach_name VARCHAR, is_assistant BIGINT,
      coach_type VARCHAR, sort_sequence BIGINT, season_type VARCHAR)`)
    await db.exec(`INSERT INTO src_nba_coaches VALUES
      (5, 2026, 11, 'Zed', 'Assist', 'Zed Assist', 2, 'Assistant Coach', NULL, '5'),
      (5, 2026, 10, 'Hal', 'Head', 'Hal Head', 1, 'Head Coach', NULL, '5'),
      (5, 2026, 12, 'Tom', 'Trainer', 'Tom Trainer', 3, 'Trainer', NULL, '5'),
      (5, 2026, 13, 'Amy', 'Able', 'Amy Able', 9, 'Associate Head Coach', 1, '5'),
      (5, 2026, 14, 'Str', 'Ength', 'Str Ength', 5, 'Strength and Conditioning Coach', NULL, '5'),
      (5, 2025, 15, 'Old', 'Head', 'Old Head', 1, 'Head Coach', NULL, '5'),
      (6, 2026, 16, 'Other', 'Team', 'Other Team', 1, 'Head Coach', NULL, '6')`)
  })

  it('lists the head coach first, then the assistants, and leaves out the trainers', async () => {
    const got = await readCoaches(db, '5', 2026)
    expect(got.map((c) => [c.name, c.role])).toEqual([
      ['Hal Head', 'head'],
      ['Amy Able', 'assistant'],
      ['Zed Assist', 'assistant']
    ])
  })

  it('is empty for a team or a season the file does not have', async () => {
    expect(await readCoaches(db, '5', 2030)).toEqual([])
    expect(await readCoaches(db, '99', 2026)).toEqual([])
    expect(await readCoaches(db, 'x', 2026)).toEqual([])
    await db.exec('DROP TABLE src_nba_coaches')
    expect(await readCoaches(db, '5', 2026)).toEqual([])
  })
})

describe('the officials of a game', () => {
  it('reads the crew by the game’s NBA id, once each', async () => {
    await db.exec(`CREATE TABLE game (game_id VARCHAR, nba_game_id VARCHAR)`)
    await db.exec(`INSERT INTO game VALUES ('G1', '0022500001'), ('espn:9', NULL)`)
    await db.exec(`CREATE TABLE src_nba_officials (official_id BIGINT, first_name VARCHAR,
      last_name VARCHAR, jersey_num VARCHAR, season INTEGER, game_id VARCHAR, season_type_id VARCHAR)`)
    await db.exec(`INSERT INTO src_nba_officials VALUES
      (2, 'Eric', 'Dalen', '37  ', 2026, '0022500001', '2'),
      (1, 'Zach', 'Zarba', '15  ', 2026, '0022500001', '2'),
      (1, 'Zach', 'Zarba', '15  ', 2026, '0022500001', '2'),
      (3, 'Other', 'Game', '1', 2026, '0022500002', '2')`)
    expect(await readOfficials(db, 'G1')).toEqual([
      { id: '2', name: 'Eric Dalen' },
      { id: '1', name: 'Zach Zarba' }
    ])
    expect(await readOfficials(db, 'espn:9')).toEqual([])
    expect(await readOfficials(db, 'nope')).toEqual([])
  })

  it('is empty without the file', async () => {
    expect(await readOfficials(db, 'G1')).toEqual([])
  })
})
