import { describe, expect, it } from 'vitest'
import type { StatsDb } from '@main/stats/db'
import {
  readOtherCareer,
  readOtherPlayers,
  ESPN_COLLEGE_LABEL,
  ESPN_PRO_LABEL,
  METIS_LABEL
} from '@main/stats/links/read'
import { matchSql } from '@main/stats/links/sql'
import { pairTables } from '@main/stats/links/tables'
import { LEAGUE_PAIRS, pairOf } from '@shared/leagues'
import { espnSeasonStatsSql, fillSides, openLinksDb } from '../../../fixtures/links'

/** Builds every pair's links into `player_link`, as the links worker does. */
async function build(db: StatsDb): Promise<void> {
  await db.exec('DELETE FROM player_link')
  for (const pair of LEAGUE_PAIRS) {
    await db.exec(`INSERT INTO player_link BY NAME ${matchSql(pair, await pairTables(db, pair))}`)
  }
}

interface Link {
  college: string
  college_id: number
  pro_id: number | null
  pro_espn: number | null
  method: string
  draft_label: number | null
}

const links = (db: StatsDb): Promise<Link[]> =>
  db.all<Link>(
    'SELECT college, college_id, pro_id, pro_espn, method, draft_label FROM player_link ORDER BY college, college_id'
  )

async function built(reverse = false): Promise<StatsDb> {
  const db = await openLinksDb()
  await fillSides(db, reverse)
  await build(db)
  return db
}

describe("D46's matcher", () => {
  it('links by the ESPN id first', async () => {
    const db = await built()
    const banchero = (await links(db)).find((l) => l.college_id === 101)
    expect(banchero).toMatchObject({ pro_id: 9001, method: 'id', draft_label: 2023 })
  })

  it('picks the right player among namesakes by the id, and leaves the namesake unlinked', async () => {
    const all = await links(await built())
    expect(all.find((l) => l.college_id === 102)).toMatchObject({ pro_id: 9002, method: 'id' })
    expect(all.find((l) => l.college_id === 103)).toBeUndefined()
  })

  it('links a second ESPN id by name and birth date', async () => {
    const all = await links(await built())
    expect(all.find((l) => l.pro_id === 9003)).toMatchObject({
      college_id: 5105797,
      method: 'name+birth'
    })
  })

  it('links a draftee who has not played by name, class and college', async () => {
    const all = await links(await built())
    expect(all.find((l) => l.pro_id === 9004)).toMatchObject({
      college_id: 105,
      pro_espn: null,
      method: 'name+college',
      draft_label: 2026
    })
  })

  it('links by name and class where the draft names no school', async () => {
    const all = await links(await built())
    expect(all.find((l) => l.pro_id === 8002)).toMatchObject({
      college: 'ncaaw',
      college_id: 202,
      method: 'name+college'
    })
  })

  it('leaves a player with no match unlinked: drafted from abroad, after the draft, two candidates', async () => {
    const all = await links(await built())
    // Tyler Smith (a namesake in college, another ESPN id), James Nnaji (college after the draft),
    // Kaitlyn Davis (two college players of the name end in the class), Alex Reese (before the window).
    for (const pro of [9005, 9006, 8003, 9007]) {
      expect(all.find((l) => l.pro_id === pro)).toBeUndefined()
    }
    for (const col of [106, 107, 203, 204]) {
      expect(all.find((l) => l.college_id === col)).toBeUndefined()
    }
    expect(all.map((l) => l.method).sort()).toEqual([
      'id',
      'id',
      'id',
      'name+birth',
      'name+college',
      'name+college'
    ])
  })

  it('drops a name+college link when the id later says otherwise', async () => {
    const db = await built()
    expect((await links(db)).some((l) => l.pro_id === 9004)).toBe(true)
    // Sorber plays: the professional file now has him, with an ESPN id that no college player has.
    await db.exec(`INSERT INTO side_nba_players VALUES
      (9004, 'Thomas Sorber', 9904, 2027, NULL, NULL, NULL)`)
    await build(db)
    expect((await links(db)).some((l) => l.pro_id === 9004)).toBe(false)
    // With the college id, the id link takes over.
    await db.exec('UPDATE side_nba_players SET espn = 105 WHERE pro_id = 9004')
    await build(db)
    expect((await links(db)).find((l) => l.pro_id === 9004)).toMatchObject({
      college_id: 105,
      method: 'id'
    })
  })

  it('still links a draftee who has not played when an ESPN row of the other league has no name', async () => {
    const db = await openLinksDb()
    await fillSides(db)
    // ESPN's WNBA season stats as NCAA Women brings them, with a nameless row (measured: one, 2026).
    await db.exec(
      `CREATE TABLE paired_wnba_espn_player_season AS ${espnSeasonStatsSql([
        [201, 'Caitlin Clark', 2024, 5, 'Indiana Fever', 40, 769, 228, 337]
      ])} UNION ALL SELECT 2026, 5349415, NULL, 5, 'Indiana Fever', 'averages', 'gamesPlayed', '1', 1`
    )
    await build(db)
    expect((await links(db)).find((l) => l.pro_id === 8002)).toMatchObject({
      college_id: 202,
      method: 'name+college'
    })
  })

  it('gives the same rows whatever order the sides are in', async () => {
    const a = await links(await built(false))
    const b = await links(await built(true))
    expect(b).toEqual(a)
    expect(a.length).toBeGreaterThan(0)
  })

  it('links a college league alone by the paired files: ESPN ids, and the draft for those not played', async () => {
    const db = await openLinksDb()
    // NCAA Men's own side, the NBA's ESPN season stats and its draft as a college league brings them.
    const { insertRows, NCAAM_PLAYERS, NBA_DRAFT } = await import('../../../fixtures/links')
    await insertRows(db, 'side_ncaam_players', NCAAM_PLAYERS)
    await db.exec(
      `CREATE TABLE paired_nba_espn_player_season AS ${espnSeasonStatsSql([
        [101, 'Paolo Banchero', 2023, 19, 'Orlando Magic', 72, 1450, 495, 270],
        [102, 'Brandon Miller', 2024, 30, 'Charlotte Hornets', 74, 1300, 320, 180],
        // The second ESPN id: tied to his draft line, so never matched by name.
        [4433626, 'Jalen Hood-Schifino', 2024, 13, 'Los Angeles Lakers', 9, 20, 5, 4]
      ])}`
    )
    await db.exec(
      `CREATE TABLE paired_nba_nba_draft AS SELECT person_id, player_name, season, round_number, round_pick,
         overall_pick, team_id, team_city, team_name, organization, organization_type
       FROM (VALUES ${NBA_DRAFT.map(
         (d, i) =>
           `(${d.pro_id}, '${d.name}', ${d.label}, ${d.round}, ${d.round_pick}, ${d.overall_pick}, ${i},
             '', '${d.team}', ${d.organization ? `'${d.organization}'` : 'NULL'},
             ${d.organization_type ? `'${d.organization_type}'` : 'NULL'})`
       ).join(
         ', '
       )}) AS t(person_id, player_name, season, round_number, round_pick, overall_pick, team_id,
         team_city, team_name, organization, organization_type)`
    )
    const pair = pairOf('ncaam')!
    await db.exec(`INSERT INTO player_link BY NAME ${matchSql(pair, await pairTables(db, pair))}`)
    const all = await links(db)
    // The ESPN rows are tied to their draft lines (name, and a first season the draft's label).
    expect(all.find((l) => l.college_id === 101)).toMatchObject({
      pro_espn: 101,
      pro_id: 9001,
      method: 'id',
      draft_label: 2023
    })
    expect(all.find((l) => l.college_id === 102)).toMatchObject({ pro_id: 9002, method: 'id' })
    expect(all.find((l) => l.college_id === 105)).toMatchObject({
      pro_id: 9004,
      method: 'name+college'
    })
    // No college birth date is matched without the professional bios: the second id stays unlinked.
    expect(all.find((l) => l.college_id === 5105797)).toBeUndefined()
    const career = await readOtherCareer(db, 'ncaam', '101')
    expect(career.source).toEqual({ kind: 'espn', label: ESPN_PRO_LABEL })
    expect(career.seasons).toMatchObject([
      { season: 2023, games: 72, pts: 1450, teams: ['Orlando Magic'] }
    ])
    expect(career.draft).toMatchObject({ draftYear: 2022, overallPick: 1, team: 'Orlando Magic' })
  })
})

describe('the other career read', () => {
  it('reads Metis’s own lines where they are kept, with the teams of each season', async () => {
    const db = await built()
    await db.exec(`CREATE TABLE kept_ncaam_season AS SELECT * FROM (VALUES
      (101, 2022, 'regular', NULL, DATE '2022-03-05', 33, 33, 1100.5, 580, 260, 70, 100),
      (101, 2022, 'regular', 150, DATE '2022-03-05', 33, 33, 1100.5, 580, 260, 70, 100),
      (101, 2022, 'playoffs', NULL, DATE '2022-04-02', 6, 6, 190.0, 100, 50, 10, 20)
    ) AS t(player_id, season, game_type, team_id, last_date, games, starts, minutes, pts, reb, oreb, ast)`)
    await db.exec(
      `CREATE TABLE kept_ncaam_team AS SELECT 150 AS team_id, 2022 AS season, 'Duke Blue Devils' AS name`
    )
    const career = await readOtherCareer(db, 'nba', '9001')
    expect(career.league).toBe('ncaam')
    expect(career.link).toMatchObject({ method: 'id', playerId: '101', name: 'Paolo Banchero' })
    expect(career.source).toEqual({ kind: 'metis', label: METIS_LABEL })
    expect(career.seasons).toMatchObject([
      { season: 2022, gameType: 'playoffs', games: 6, teams: [], teamsInOrder: true },
      {
        season: 2022,
        gameType: 'regular',
        games: 33,
        pts: 580,
        teams: ['Duke Blue Devils'],
        teamsInOrder: true
      }
    ])
    expect(career.draft).toMatchObject({ draftYear: 2022, overallPick: 1, organization: 'Duke' })
  })

  it("reads ESPN's totals where no line of Metis's is kept, named for what they count", async () => {
    const db = await built()
    await db.exec(
      `CREATE TABLE paired_ncaam_espn_player_season AS ${espnSeasonStatsSql([
        [101, 'Paolo Banchero', 2022, 150, 'Duke Blue Devils', 39, 672, 304, 125]
      ])}`
    )
    const career = await readOtherCareer(db, 'nba', '9001')
    expect(career.source).toEqual({ kind: 'espn', label: ESPN_COLLEGE_LABEL })
    expect(career.seasons).toMatchObject([
      { season: 2022, gameType: null, games: 39, pts: 672, fgm: 100, fga: 200, minutes: 1170 }
    ])
  })

  it("never picks one of several teams ESPN's totals name for a season, and keeps a single one", async () => {
    const db = await built()
    await db.exec(
      `CREATE TABLE paired_ncaam_espn_player_season AS ${espnSeasonStatsSql([
        [101, 'Paolo Banchero', 2021, 150, 'Duke Blue Devils', 30, 500, 200, 90],
        [101, 'Paolo Banchero', 2022, 160, 'Kentucky Wildcats', 20, 300, 100, 50],
        [101, 'Paolo Banchero', 2022, 150, 'Duke Blue Devils', 19, 372, 204, 75]
      ])}`
    )
    const career = await readOtherCareer(db, 'nba', '9001')
    expect(career.seasons.map((s) => [s.season, s.teams, s.teamsInOrder])).toEqual([
      [2021, ['Duke Blue Devils'], true],
      // Two names and no order between them in the file: both, sorted, and said to be unordered.
      [2022, ['Duke Blue Devils', 'Kentucky Wildcats'], false]
    ])
  })

  it("reads no team where ESPN's totals name none", async () => {
    const db = await built()
    await db.exec(
      `CREATE TABLE paired_ncaam_espn_player_season AS ${espnSeasonStatsSql([
        [101, 'Paolo Banchero', 2022, 150, 'Duke Blue Devils', 39, 672, 304, 125]
      ])}`
    )
    await db.exec(`UPDATE paired_ncaam_espn_player_season SET team_display_name = NULL`)
    const career = await readOtherCareer(db, 'nba', '9001')
    expect(career.seasons).toMatchObject([
      { season: 2022, teams: [], teamsInOrder: true, games: 39 }
    ])
  })

  it('gives the draft line of a draftee who has not played, read from the college side', async () => {
    const career = await readOtherCareer(await built(), 'ncaam', '105')
    expect(career.link).toMatchObject({ method: 'name+college', playerId: '9004', espnId: null })
    expect(career.draft).toMatchObject({
      draftYear: 2025,
      overallPick: 15,
      organization: 'Georgetown'
    })
    expect(career.seasons).toEqual([])
    expect(career.source).toBeNull()
  })

  it('says why a professional player has no link, where the data knows it', async () => {
    const db = await built()
    expect((await readOtherCareer(db, 'nba', '9005')).reason?.kind).toBe('drafted-abroad')
    expect((await readOtherCareer(db, 'nba', '9007')).reason).toEqual({
      kind: 'college-before-window',
      text: 'No NCAA Men record in Metis: its seasons start in 2021-22.'
    })
    expect((await readOtherCareer(db, 'wnba', '8003')).reason?.kind).toBe('no-link')
    expect((await readOtherCareer(db, 'ncaam', '103')).reason).toEqual({
      kind: 'no-link',
      text: 'No linked NBA career.'
    })
  })
})

describe('the paired league’s players with no page in the league on screen (T1304.4)', () => {
  it('names their last season and team from ESPN’s lines where the college league is not downloaded', async () => {
    const db = await openLinksDb()
    const { insertRows, NBA_PLAYERS, NBA_DRAFT } = await import('../../../fixtures/links')
    await insertRows(db, 'side_nba_players', NBA_PLAYERS)
    await insertRows(db, 'side_nba_draft', NBA_DRAFT)
    // The college lines the NBA brings: a transfer's two seasons, the team the last one ended with.
    await db.exec(
      `CREATE TABLE paired_ncaam_espn_player_season AS ${espnSeasonStatsSql([
        [101, 'Paolo Banchero', 2022, 150, 'Duke Blue Devils', 39, 672, 304, 125],
        [105, 'Thomas Sorber', 2024, 77, 'Other Owls', 20, 200, 100, 20],
        [105, 'Thomas Sorber', 2025, 46, 'Georgetown Hoyas', 25, 360, 200, 60]
      ])}`
    )
    const pair = pairOf('nba')!
    await db.exec(`INSERT INTO player_link BY NAME ${matchSql(pair, await pairTables(db, pair))}`)
    // Banchero has an NBA page: the search lists him as the NBA's own, never here.
    expect(await readOtherPlayers(db, 'nba')).toEqual([
      {
        league: 'ncaam',
        playerId: '105',
        name: 'Thomas Sorber',
        lastSeason: 2025,
        team: 'Georgetown Hoyas'
      }
    ])
  })

  it('lists the draftees of both pairs who never played, and no one for a college league', async () => {
    const db = await built()
    const nba = await readOtherPlayers(db, 'nba')
    expect(nba.map((p) => p.name)).toEqual(['Thomas Sorber'])
    // Linked by name and class (the draft names no school), with no WNBA row.
    expect(await readOtherPlayers(db, 'wnba')).toMatchObject([
      { league: 'ncaaw', name: 'Monika Czinano' }
    ])
    expect(await readOtherPlayers(db, 'ncaam')).toEqual([])
    expect(await readOtherPlayers(db, 'ncaaw')).toEqual([])
  })
})
