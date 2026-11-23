import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { sqlString, StatsDb } from '@main/stats/db'
import { handoverDir, openLinksService, type LinksService } from '@main/stats/links/service'
import { writeLinkedLines, writeLinkSide } from '@main/stats/links/side'
import { readPairedIds } from '@main/stats/links/read'
import { COLLEGE_PLAYERS_SQL, draftSql, proPlayersSql } from '@main/stats/links/sql'
import { PLAYER_LINK_COLUMNS } from '@main/stats/links/tables'
import { leftOutTables } from '@main/stats/leftOut'
import {
  NCAA_STATS_RELEASES,
  PAIRED_SOURCES_BY_LEAGUE,
  SOURCES_BY_LEAGUE
} from '@main/stats/sources'
import { LEAGUES, LINKS_FILE } from '@shared/leagues'
import { tempDir } from '../../../fixtures/stats'
import {
  espnSeasonStatsSql,
  insertRows,
  NBA_DRAFT,
  NBA_PLAYERS,
  NCAAM_PLAYERS
} from '../../../fixtures/links'

/**
 * The links worker's service on a real file (D47): what a league's worker hands over, loaded in turn,
 * whatever the order, never half-built; the paired files through the source registry's download path.
 */
const open: LinksService[] = []
afterEach(async () => {
  for (const s of open.splice(0)) await s.close()
})

async function service(dataDir = tempDir(), fetchImpl?: typeof fetch): Promise<LinksService> {
  const s = await openLinksService(
    { dataDir, tempDir: join(dataDir, 'stats-tmp', 'links') },
    { fetchImpl, now: () => new Date('2026-11-21T12:00:00Z') }
  )
  open.push(s)
  return s
}

/** An NBA file with the tables its side reads, from the fixtures. */
async function nbaFile(): Promise<StatsDb> {
  const db = await StatsDb.open(':memory:')
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR, espn_athlete_id BIGINT,
    method VARCHAR, first_season INTEGER, last_season INTEGER)`)
  await insertRows(
    db,
    'player',
    NBA_PLAYERS.map((p) => ({
      player_id: p.pro_id,
      name: p.name,
      espn_athlete_id: p.espn,
      first_season: p.first_season
    }))
  )
  await db.exec(`CREATE TABLE src_espn_player_core (season INTEGER, athlete_id BIGINT,
    date_of_birth VARCHAR, college_id BIGINT)`)
  await insertRows(
    db,
    'src_espn_player_core',
    NBA_PLAYERS.filter((p) => p.espn !== null).map((p) => ({
      season: 2026,
      athlete_id: p.espn,
      date_of_birth: p.dob ? `${p.dob}T07:00Z` : null,
      college_id: p.espn_college_id
    }))
  )
  await db.exec(
    'CREATE TABLE src_dash_player_bio (season INTEGER, player_id BIGINT, college VARCHAR)'
  )
  await insertRows(
    db,
    'src_dash_player_bio',
    NBA_PLAYERS.map((p) => ({ season: 2026, player_id: p.pro_id, college: p.school ?? 'None' }))
  )
  await db.exec(`CREATE TABLE src_nba_draft (person_id BIGINT, player_name VARCHAR, season INTEGER,
    round_number BIGINT, round_pick BIGINT, overall_pick BIGINT, team_id BIGINT, team_city VARCHAR,
    team_name VARCHAR, organization VARCHAR, organization_type VARCHAR)`)
  await insertRows(
    db,
    'src_nba_draft',
    NBA_DRAFT.map((d) => ({
      person_id: d.pro_id,
      player_name: d.name,
      season: d.label,
      round_number: d.round,
      round_pick: d.round_pick,
      overall_pick: d.overall_pick,
      team_id: 1,
      team_city: '',
      team_name: d.team,
      organization: d.organization ?? '',
      organization_type: d.organization_type ?? ''
    }))
  )
  await db.exec(`CREATE TABLE player_season AS SELECT * FROM (VALUES
    (9001, 2023, 'regular', NULL, 1610612753, DATE '2023-04-09', 72, 1450),
    (9001, 2023, 'regular', 1610612753, 1610612753, DATE '2023-04-09', 72, 1450)
  ) AS t(player_id, season, game_type, team_id, last_team_id, last_date, games, pts)`)
  await db.exec(
    "CREATE TABLE team AS SELECT 1610612753 AS team_id, 2023 AS season, 'ORL' AS code, 'Orlando Magic' AS name"
  )
  return db
}

/** An NCAA Men file with the tables its side reads. */
async function ncaamFile(): Promise<StatsDb> {
  const db = await StatsDb.open(':memory:')
  await db.exec(`CREATE TABLE player (player_id BIGINT, name VARCHAR, espn_athlete_id BIGINT,
    first_season INTEGER, last_season INTEGER, birth_date VARCHAR)`)
  await insertRows(
    db,
    'player',
    NCAAM_PLAYERS.map((c) => ({
      player_id: c.col_id,
      name: c.name,
      espn_athlete_id: c.espn,
      first_season: c.first_season,
      last_season: c.last_season,
      birth_date: c.dob
    }))
  )
  await db.exec(`CREATE TABLE player_season (player_id BIGINT, season INTEGER, game_type VARCHAR,
    team_id INTEGER, games INTEGER)`)
  await db.exec('CREATE TABLE team (team_id INTEGER, season INTEGER, name VARCHAR)')
  for (const c of NCAAM_PLAYERS) {
    await insertRows(db, 'player_season', [
      {
        player_id: c.col_id,
        season: c.last_season,
        game_type: 'regular',
        team_id: null,
        games: 30
      },
      {
        player_id: c.col_id,
        season: c.last_season,
        game_type: 'regular',
        team_id: c.teams[0],
        games: 30
      }
    ])
    await insertRows(db, 'team', [
      { team_id: c.teams[0], season: c.last_season, name: c.team_names[0] }
    ])
  }
  return db
}

const linkRows = (s: LinksService): Promise<unknown[]> =>
  s.read('SELECT * FROM player_link ORDER BY college, college_id')

describe('the links service', () => {
  it('ends with the same links whichever league of the pair hands over first', async () => {
    const nba = await nbaFile()
    const ncaam = await ncaamFile()
    const runs: unknown[][] = []
    for (const order of [
      ['nba', 'ncaam'],
      ['ncaam', 'nba']
    ] as const) {
      const s = await service()
      for (const league of order) {
        const db = league === 'nba' ? nba : ncaam
        const out = tempDir()
        const side = await writeLinkSide(db, LEAGUES[league], out, 't1')
        expect(side).not.toBeNull()
        await s.ingestSide(side!)
        // The hand-over files are removed once loaded.
        expect(readdirSync(out)).toEqual([])
      }
      runs.push(await linkRows(s))
    }
    expect(runs[1]).toEqual(runs[0])
    expect(runs[0].length).toBe(4)
  })

  it('leaves the links as they were when a hand-over fails', async () => {
    const s = await service()
    for (const [league, db] of [
      ['nba', await nbaFile()],
      ['ncaam', await ncaamFile()]
    ] as const) {
      await s.ingestSide((await writeLinkSide(db, LEAGUES[league], tempDir(), 'a'))!)
    }
    const before = await linkRows(s)
    const side = (await writeLinkSide(await nbaFile(), LEAGUES.nba, tempDir(), 'b'))!
    // The draft file is gone before the links worker reads it: the players load, then it fails.
    await s.ingestSide({ ...side, draft: join(tempDir(), 'missing.parquet') }).then(
      () => expect.fail('the hand-over should fail'),
      () => undefined
    )
    expect(await linkRows(s)).toEqual(before)
    expect(await s.read('SELECT count(*)::INTEGER AS n FROM side_nba_draft')).toEqual([
      { n: NBA_DRAFT.length }
    ])
  })

  it('empties its temp folder on open, so a hand-over a crash left is never read', async () => {
    const dataDir = tempDir()
    const s = await service(dataDir)
    await s.close()
    open.splice(0)
    const left = join(handoverDir(join(dataDir, 'stats-tmp', 'links')), 'nba-crash-players.parquet')
    writeFileSync(left, 'half a file')
    await service(dataDir)
    expect(existsSync(left)).toBe(false)
    expect(existsSync(join(dataDir, LINKS_FILE))).toBe(true)
  })

  it('keeps Metis’s own lines of the linked players, every column, and reads them', async () => {
    const s = await service()
    const nba = await nbaFile()
    const ncaam = await ncaamFile()
    await s.ingestSide((await writeLinkSide(nba, LEAGUES.nba, tempDir(), 'a'))!)
    await s.ingestSide((await writeLinkSide(ncaam, LEAGUES.ncaam, tempDir(), 'a'))!)
    const ids = await s.linkedIds('nba')
    expect(ids).toEqual([9001, 9002, 9003, 9004])
    const lines = (await writeLinkedLines(nba, LEAGUES.nba, ids, tempDir(), 'a'))!
    expect(await s.ingestLines(lines)).toBe(2)
    const career = await s.otherCareer('ncaam', '101')
    expect(career.source?.kind).toBe('metis')
    expect(career.seasons).toMatchObject([
      { season: 2023, gameType: 'regular', games: 72, pts: 1450, teams: ['Orlando Magic'] }
    ])
    expect(await s.counts('ncaam')).toEqual({ id: 2, 'name+birth': 1, 'name+college': 1 })
  })

  it('answers which players are linked and their ids in the paired league, for favourites', async () => {
    const s = await service()
    // Nothing handed over yet: no links, and nothing fails (a favourite stays in its league).
    expect(await s.pairedIds('nba', ['9001'])).toEqual([])
    const nba = await nbaFile()
    const ncaam = await ncaamFile()
    await s.ingestSide((await writeLinkSide(nba, LEAGUES.nba, tempDir(), 'a'))!)
    await s.ingestSide((await writeLinkSide(ncaam, LEAGUES.ncaam, tempDir(), 'a'))!)
    // Paolo Banchero, linked by ESPN's id: 101 at Duke, 9001 in the NBA, both ways.
    expect(await s.pairedIds('ncaam', ['101'])).toEqual([['101', '9001']])
    expect(await s.pairedIds('nba', ['9001'])).toEqual([['9001', '101']])
    // Every link of the pair, asked from each side, answers the same pairs turned round.
    const all = await s.read(
      "SELECT college_id::VARCHAR AS c, pro_id::VARCHAR AS p FROM player_link WHERE college = 'ncaam' AND pro_id IS NOT NULL ORDER BY 1"
    )
    const college = await s.pairedIds(
      'ncaam',
      all.map((r) => String(r.c))
    )
    expect(college).toEqual(all.map((r) => [String(r.c), String(r.p)]))
    const pro = await s.pairedIds(
      'nba',
      all.map((r) => String(r.p))
    )
    expect(new Set(pro.map(([p, c]) => `${c}:${p}`))).toEqual(
      new Set(college.map(([c, p]) => `${c}:${p}`))
    )
    // An unlinked id, a non-number and the other pair answer nothing.
    expect(await s.pairedIds('nba', ['9007', 'x; DROP TABLE player_link', ''])).toEqual([])
    expect(await s.pairedIds('wnba', ['9001'])).toEqual([])
    expect(await s.pairedIds('ncaam', [])).toEqual([])
  })

  it('follows a link whose ids are negative, the keys D28 gives players a league does not know', async () => {
    const db = await StatsDb.open(':memory:')
    await db.exec(`CREATE TABLE player_link (${PLAYER_LINK_COLUMNS})`)
    // Two NCAA Men links held a negative NBA id on the four-league profile (2026-11-23); a college
    // player with no ESPN athlete gets the same kind of key (D40).
    await insertRows(db, 'player_link', [
      { college: 'ncaam', pro: 'nba', college_id: 4433, pro_id: -4433, method: 'name+birth' },
      { college: 'ncaam', pro: 'nba', college_id: -5150, pro_id: 1630000, method: 'name+college' }
    ])
    expect(await readPairedIds(db, 'ncaam', ['4433', '-5150'])).toEqual([
      ['-5150', '1630000'],
      ['4433', '-4433']
    ])
    expect(await readPairedIds(db, 'nba', ['-4433', '1630000'])).toEqual([
      ['-4433', '4433'],
      ['1630000', '-5150']
    ])
    // Still only whole numbers are inlined: a minus alone or in the middle names nobody.
    expect(await readPairedIds(db, 'nba', ['-', '4-433', '--4433', '-4433.0'])).toEqual([])
    db.close()
  })

  it('lists the paired league’s linked players who have no page in this league, for its search', async () => {
    const s = await service()
    const nba = await nbaFile()
    const ncaam = await ncaamFile()
    await s.ingestSide((await writeLinkSide(ncaam, LEAGUES.ncaam, tempDir(), 'a'))!)
    // The NBA has handed over no players yet: nobody can be said to have no page there.
    expect(await s.otherPlayers('nba')).toEqual([])
    await s.ingestSide((await writeLinkSide(nba, LEAGUES.nba, tempDir(), 'a'))!)
    // Thomas Sorber was drafted and linked by name, class and college, and has no NBA row. The three
    // linked players the NBA holds are its own rows, never listed again.
    expect(await s.otherPlayers('nba')).toEqual([
      {
        league: 'ncaam',
        playerId: '105',
        name: 'Thomas Sorber',
        lastSeason: 2025,
        team: 'Georgetown Hoyas'
      }
    ])
    // Every link starts from a college player, so a college league's search gains no one.
    expect(await s.otherPlayers('ncaam')).toEqual([])
    // The other pair holds nothing yet.
    expect(await s.otherPlayers('wnba')).toEqual([])
  })

  it("downloads a league's paired files through the source registry's path, with their state", async () => {
    const files = tempDir()
    const db = await StatsDb.open(':memory:')
    const espn = join(files, 'espn.parquet')
    await db.exec(
      `COPY (${espnSeasonStatsSql([[101, 'Paolo Banchero', 2022, 150, 'Duke Blue Devils', 39, 672, 304, 125]])})
       TO ${sqlString(espn)} (FORMAT parquet)`
    )
    const asked: string[] = []
    const fetchImpl = (async (url: string) => {
      asked.push(url)
      return new Response(readFileSync(espn), { status: 200, headers: { etag: '"e"' } })
    }) as unknown as typeof fetch
    const s = await service(tempDir(), fetchImpl)
    const steps = await s.refreshPaired('nba', {})
    // NCAA Men's season stats from 2021-22 to the current season, 2026-27.
    expect(asked).toHaveLength(6)
    expect(asked[0]).toContain(
      'espn_mens_college_basketball_player_season_stats/player_season_stats_'
    )
    expect(steps.every((step) => step.status === 'ok')).toBe(true)
    const families = await s.pairedFamilies('nba')
    expect(families).toMatchObject([
      {
        label: 'NCAA Men player season stats (ESPN), for linked careers',
        seasonsOf: 'ncaam',
        state: 'loaded',
        filesLoaded: 6,
        filesExpected: 6
      }
    ])
    // A failed links step shows on the paired files until the next one.
    await s.failed('nba', 'disk full')
    expect((await s.pairedFamilies('nba'))[0]).toMatchObject({
      state: 'failed',
      lastError: 'Linking careers failed: disk full'
    })
  })

  it('brings the draft with a college league, from the class of 2022, as the league labels it', () => {
    expect(PAIRED_SOURCES_BY_LEAGUE.ncaam.map((s) => [s.table, s.release, s.firstSeason])).toEqual([
      ['paired_nba_espn_player_season', 'espn_nba_player_season_stats', 2023],
      ['paired_nba_nba_draft', 'nba_stats_draft', 2023]
    ])
    expect(PAIRED_SOURCES_BY_LEAGUE.ncaaw.map((s) => [s.table, s.firstSeason])).toEqual([
      ['paired_wnba_espn_player_season', 2022],
      ['paired_wnba_wnba_draft', 2022]
    ])
    expect(PAIRED_SOURCES_BY_LEAGUE.wnba.map((s) => [s.table, s.firstSeason])).toEqual([
      ['paired_ncaaw_espn_player_season', 2022]
    ])
  })
})

describe('NCAA_STATS_LEFT_OUT changes nothing for the links', () => {
  // The links read ESPN's ids and ESPN's bios (D40), never stats.ncaa.org's releases, which D41's
  // switch can leave out.
  const leftOut = (league: 'ncaam' | 'ncaaw'): string[] =>
    leftOutTables(NCAA_STATS_RELEASES, SOURCES_BY_LEAGUE[league])

  it('reads no table of the stats.ncaa.org releases on either side', () => {
    const tables = [...leftOut('ncaam'), ...leftOut('ncaaw')]
    expect(tables.length).toBeGreaterThan(10)
    const sql = [
      COLLEGE_PLAYERS_SQL,
      proPlayersSql('nba'),
      proPlayersSql('wnba'),
      draftSql('src_nba_draft')
    ].join('\n')
    for (const table of tables) expect(sql).not.toContain(table)
  })

  it('downloads no stats.ncaa.org release as a paired file', () => {
    for (const sources of Object.values(PAIRED_SOURCES_BY_LEAGUE)) {
      for (const source of sources) expect(NCAA_STATS_RELEASES).not.toContain(source.release)
    }
  })

  it('links the same with the college file built without them', async () => {
    // The college side reads `player`, `player_season` and `team`, which the identity and derived
    // recipes build from ESPN's tables with or without stats.ncaa.org's: the side is unchanged.
    const ncaam = await ncaamFile()
    const before = await ncaam.all(`${COLLEGE_PLAYERS_SQL} ORDER BY col_id`)
    for (const table of leftOut('ncaam')) await ncaam.exec(`DROP TABLE IF EXISTS ${table}`)
    expect(await ncaam.all(`${COLLEGE_PLAYERS_SQL} ORDER BY col_id`)).toEqual(before)
  })
})
