import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sqlString, type StatsDb } from '@main/stats/db'
import { buildDerived } from '@main/stats/derived/build'
import {
  NCAA_POSSESSION_COUNTS,
  NCAA_SITUATION_COUNTS,
  NCAA_SITUATION_PLAYER_GAME,
  NCAA_SITUATION_TEAM_GAME
} from '@main/stats/derived/collegeSituations'
import { GAME_TABLES } from '@main/stats/derived/gameTables'
import { buildPlays } from '@main/stats/derived/playBuilders'
import { buildPublished } from '@main/stats/derived/published'
import { buildIdentity } from '@main/stats/identity'
import { LEAGUES, type League } from '@shared/leagues'
import { CATALOGUE } from '@shared/stats/catalogue'
import { openTestDb } from '../../fixtures/stats'
import { slow } from '../../fixtures/timeouts'

/**
 * The college leagues' counts by situation (T1703.2, part 4c), built by the plays step on the T1302
 * fixtures, whose games carry their own play by play and possessions as stats.ncaa.org published them.
 * Each count is worked again from the fixture's own file, per game and side, so the test holds the
 * rules (a tag counted as the play table counts the play), not a number from a run.
 */
const FIXTURES = join(__dirname, '../../fixtures')

/** The counts of the tags, beside the games they are counted in. */
const TAG_COUNTS = NCAA_SITUATION_COUNTS.filter((c) => c !== 'ncaa_tag_games')

async function built(league: League, before?: (db: StatsDb) => Promise<void>): Promise<StatsDb> {
  const db = await openTestDb()
  for (const dir of ['college-identity', 'college-derived', 'college-depth']) {
    for (const file of readdirSync(join(FIXTURES, dir, league.id))) {
      const table = `src_${file.replace(/\.parquet$/, '')}`
      const path = join(FIXTURES, dir, league.id, file)
      await db.exec(`CREATE TABLE ${table} AS SELECT * FROM read_parquet(${sqlString(path)})`)
    }
  }
  await before?.(db)
  await buildIdentity(db, league)
  await buildDerived(db, league)
  await buildPublished(db, league)
  await buildPlays(db, league)
  return db
}

type Row = Record<string, number | string | null>
const n = (x: unknown): number => Number(x)

/** The rows by game and team. */
const bySide = (rows: Row[]): Map<string, Row> =>
  new Map(rows.map((r) => [`${r.game_id} ${r.team_id}`, r]))

/** The file's tag counts per game and team, as the play table counts a play: makes only score. */
const FILE_TAGS = `
  SELECT g.game_id, i.team_id,
    sum(CASE WHEN p.is_fastbreak AND p.event_result = 'made' THEN
          CASE WHEN p.event_type = 'Free Throw' THEN 1 ELSE p.shot_value END ELSE 0 END) AS ncaa_pts_fb,
    sum(CASE WHEN p.is_from_turnover AND p.event_result = 'made' THEN
          CASE WHEN p.event_type = 'Free Throw' THEN 1 ELSE p.shot_value END ELSE 0 END) AS ncaa_pts_offtov,
    sum(CASE WHEN p.is_paint AND p.event_result = 'made' AND p.event_type <> 'Free Throw'
             THEN p.shot_value ELSE 0 END) AS ncaa_pts_paint,
    sum(CASE WHEN p.is_paint AND p.event_result = 'made' AND p.event_type <> 'Free Throw'
             THEN 1 ELSE 0 END) AS ncaa_fgm_paint,
    sum(CASE WHEN p.is_paint AND p.event_result IN ('made', 'missed') AND p.event_type <> 'Free Throw'
             AND p.shot_value IN (2, 3) THEN 1 ELSE 0 END) AS ncaa_fga_paint
  FROM src_ncaa_pbp p JOIN game g ON g.ncaa_game_id = p.contest_id
  JOIN ncaa_side i ON i.contest_id = p.contest_id AND i.team = p.event_team
  GROUP BY 1, 2`

/** The file's possession counts per game and offence. */
const FILE_POSSESSIONS = `
  SELECT g.game_id, i.team_id, count(*) AS ncaa_poss_n,
    count(*) FILTER (WHERE s.first_shot_type = 'Three Point Jumper') AS ncaa_poss_first3,
    count(*) FILTER (WHERE s.first_shot_type IN ('Layup', 'Dunk', 'Tip In')) AS ncaa_poss_first_rim,
    count(*) FILTER (WHERE s.first_shot_type IN ('Two Point Jumper', 'Hook')) AS ncaa_poss_first_two,
    count(*) FILTER (WHERE s.first_shot_type IS NULL) AS ncaa_poss_first_none,
    count(*) FILTER (WHERE s.is_assisted > 0) AS ncaa_poss_ast
  FROM src_ncaa_possessions s JOIN game g ON g.ncaa_game_id = CAST(s.contest_id AS VARCHAR)
  JOIN ncaa_side i ON i.contest_id = CAST(s.contest_id AS VARCHAR) AND i.team = s.poss_team
  GROUP BY 1, 2`

const leagues = [LEAGUES.ncaam, LEAGUES.ncaaw]
const dbs = new Map<string, StatsDb>()

beforeAll(async () => {
  for (const league of leagues) dbs.set(league.id, await built(league))
}, slow(240_000))
afterAll(async () => {
  for (const db of dbs.values()) await db.close()
})

describe.each(leagues)('the $name counts by situation', (league) => {
  const db = (): StatsDb => dbs.get(league.id)!

  it('counts each tag as the file tags the plays, for both sides of every game', async () => {
    const table = await db().all<Row>(`SELECT * FROM ${NCAA_SITUATION_TEAM_GAME}`)
    const file = await db().all<Row>(FILE_TAGS)
    expect(table.length).toBeGreaterThan(0)
    const worked = bySide(file)
    for (const r of table) {
      for (const c of TAG_COUNTS) {
        // A side with no row in the file's count had no play of it: it counted 0.
        expect(n(r[c]), `${c} ${r.game_id} ${r.team_id}`).toBe(
          n(worked.get(`${r.game_id} ${r.team_id}`)?.[c] ?? 0)
        )
      }
    }
    // Something of each kind is there to count.
    const totals = await db().get<Row>(
      `SELECT ${TAG_COUNTS.map((c) => `sum(${c}) AS ${c}`).join(', ')} FROM ${NCAA_SITUATION_TEAM_GAME}`
    )
    for (const c of TAG_COUNTS) expect(n(totals?.[c]), c).toBeGreaterThan(0)
  })

  it('gives each side the other side’s counts as its opponents’', async () => {
    const off = await db().get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM ${NCAA_SITUATION_TEAM_GAME} t
       JOIN ${NCAA_SITUATION_TEAM_GAME} o ON o.game_id = t.game_id AND o.team_id = t.opponent_id
       WHERE ${[...NCAA_SITUATION_COUNTS, ...NCAA_POSSESSION_COUNTS]
         .map((c) => `t.opp_${c} IS DISTINCT FROM o.${c}`)
         .join(' OR ')}`
    )
    expect(off?.n).toBe(0)
  })

  it('adds the players’ counts up to their team’s', async () => {
    const off = await db().all<Row>(
      `SELECT t.game_id, t.team_id FROM ${NCAA_SITUATION_TEAM_GAME} t
       LEFT JOIN (SELECT game_id, team_id, ${TAG_COUNTS.map((c) => `sum(${c}) AS ${c}`).join(', ')}
                  FROM ${NCAA_SITUATION_PLAYER_GAME} GROUP BY 1, 2) p
         ON p.game_id = t.game_id AND p.team_id = t.team_id
       WHERE ${TAG_COUNTS.map((c) => `coalesce(p.${c}, 0) <> t.${c}`).join(' OR ')}`
    )
    expect(off).toEqual([])
  })

  it('counts the possessions, their first shots and their assisted baskets per offence', async () => {
    const table = await db().all<Row>(`SELECT * FROM ${NCAA_SITUATION_TEAM_GAME}`)
    const file = await db().all<Row>(FILE_POSSESSIONS)
    expect(file.length).toBeGreaterThan(0)
    const built = bySide(table)
    for (const r of file) {
      for (const c of NCAA_POSSESSION_COUNTS) {
        expect(
          n(built.get(`${r.game_id} ${r.team_id}`)?.[c]),
          `${c} ${r.game_id} ${r.team_id}`
        ).toBe(n(r[c]))
      }
    }
    // The kinds of first shot and none add up to the possessions, apart from an unknown type.
    const over = await db().get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM ${NCAA_SITUATION_TEAM_GAME}
       WHERE ncaa_poss_first3 + ncaa_poss_first_rim + ncaa_poss_first_two + ncaa_poss_first_none > ncaa_poss_n`
    )
    expect(over?.n).toBe(0)
  })

  it('counts a game for every player with a line in it and both its teams, once each', async () => {
    const off = await db().all<Row>(
      `SELECT b.game_id, b.player_id FROM player_game b
       LEFT JOIN (SELECT game_id, player_id, sum(ncaa_tag_games)::INTEGER AS n FROM ${NCAA_SITUATION_PLAYER_GAME} GROUP BY 1, 2) p
         ON p.game_id = b.game_id AND p.player_id = b.player_id
       WHERE p.n IS DISTINCT FROM 1 AND EXISTS (SELECT 1 FROM play_nba q WHERE q.game_id = b.game_id)`
    )
    expect(off).toEqual([])
    const teams = await db().get<{ n: number; games: number }>(
      `SELECT count(*) FILTER (WHERE ncaa_tag_games IS DISTINCT FROM 1)::INTEGER AS n,
              count(DISTINCT game_id)::INTEGER AS games FROM ${NCAA_SITUATION_TEAM_GAME}`
    )
    expect(teams?.n).toBe(0)
    expect(teams?.games).toBeGreaterThan(1)
    const zero = await db().get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM ${NCAA_SITUATION_PLAYER_GAME}
       WHERE ncaa_tag_games = 1 AND ${TAG_COUNTS.map((c) => `${c} = 0`).join(' AND ')}`
    )
    expect(zero?.n).toBeGreaterThan(0)
  })
})

describe('a game whose play by play has no tag', () => {
  const league = LEAGUES.ncaam
  let db: StatsDb
  let game: string
  let odd: string

  beforeAll(async () => {
    db = await built(league, async (x) => {
      const rows = await x.all<{ c: string }>(
        `SELECT DISTINCT contest_id AS c FROM src_ncaa_pbp WHERE is_paint AND player_1_id IS NOT NULL ORDER BY 1`
      )
      game = rows[0].c
      odd = rows[1].c
      await x.exec(
        `UPDATE src_ncaa_pbp SET is_fastbreak = false, is_from_turnover = false, is_paint = false
         WHERE contest_id = ${sqlString(game)}`
      )
      // Another game whose possessions carry each other's team ids (a name decides the side), some tip-ins,
      // and a player whose one paint play is on the other team.
      await x.exec(
        `UPDATE src_ncaa_possessions SET home_ncaa_team_id = away_ncaa_team_id, away_ncaa_team_id = home_ncaa_team_id
         WHERE CAST(contest_id AS VARCHAR) = ${sqlString(odd)}`
      )
      await x.exec(
        `UPDATE src_ncaa_possessions SET first_shot_type = 'Tip In'
         WHERE first_shot_type = 'Layup' AND poss_num % 2 = 0 AND CAST(contest_id AS VARCHAR) = ${sqlString(odd)}`
      )
      await x.exec(
        `UPDATE src_ncaa_pbp SET event_team = CASE WHEN event_team = home THEN away ELSE home END
         WHERE rowid = (SELECT min(rowid) FROM src_ncaa_pbp
                        WHERE contest_id = ${sqlString(odd)} AND is_paint AND player_1_id IS NOT NULL
                          AND player_1_id = (SELECT min(player_1_id) FROM src_ncaa_pbp
                            WHERE contest_id = ${sqlString(odd)} AND is_paint AND player_1_id IS NOT NULL
                            GROUP BY player_1_id HAVING count(*) > 2 ORDER BY 1 LIMIT 1))`
      )
    })
  }, slow(240_000))
  afterAll(() => db.close())

  it('counts nothing of its tags, not zero, for either team and no player', async () => {
    const rows = await db.all<Row>(
      `SELECT s.* FROM ${NCAA_SITUATION_TEAM_GAME} s JOIN game g USING (game_id) WHERE g.ncaa_game_id = ${sqlString(game)}`
    )
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      for (const c of [...NCAA_SITUATION_COUNTS, ...NCAA_SITUATION_COUNTS.map((x) => `opp_${x}`)]) {
        expect(r[c], c).toBeNull()
      }
      // Its possessions are another file's, so they are counted.
      expect(n(r.ncaa_poss_n)).toBeGreaterThan(0)
    }
    expect(
      await db.get<{ n: number }>(
        `SELECT count(*)::INTEGER AS n FROM ${NCAA_SITUATION_PLAYER_GAME} s JOIN game g USING (game_id)
         WHERE g.ncaa_game_id = ${sqlString(game)}`
      )
    ).toEqual({ n: 0 })
  })

  it('places a possession by its name, not by the ids of its row, and counts a tip-in at the rim', async () => {
    const built = bySide(await db.all<Row>(`SELECT * FROM ${NCAA_SITUATION_TEAM_GAME}`))
    const file = await db.all<Row>(FILE_POSSESSIONS)
    for (const r of file) {
      for (const c of NCAA_POSSESSION_COUNTS) {
        expect(n(built.get(`${r.game_id} ${r.team_id}`)?.[c]), `${c} ${r.game_id}`).toBe(n(r[c]))
      }
    }
    expect(
      (
        await db.get<{ n: number }>(
          `SELECT count(*)::INTEGER AS n FROM src_ncaa_possessions WHERE first_shot_type = 'Tip In'`
        )
      )?.n
    ).toBeGreaterThan(0)
  })

  it('counts a game once for a player with a play for each team', async () => {
    const rows = await db.all<Row>(
      `SELECT s.player_id, count(*)::INTEGER AS teams, sum(s.ncaa_tag_games)::INTEGER AS games
       FROM ${NCAA_SITUATION_PLAYER_GAME} s JOIN game g USING (game_id)
       WHERE g.ncaa_game_id = ${sqlString(odd)} GROUP BY 1 HAVING count(*) > 1`
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ teams: 2, games: 1 })
  })

  it('leaves the other games as they are', async () => {
    const other = await dbs.get(league.id)!.all<Row>(
      `SELECT s.* FROM ${NCAA_SITUATION_TEAM_GAME} s JOIN game g USING (game_id)
       WHERE g.ncaa_game_id NOT IN (${sqlString(game)}, ${sqlString(odd)}) ORDER BY game_id, team_id`
    )
    expect(
      await db.all<Row>(
        `SELECT s.* FROM ${NCAA_SITUATION_TEAM_GAME} s JOIN game g USING (game_id)
         WHERE g.ncaa_game_id NOT IN (${sqlString(game)}, ${sqlString(odd)}) ORDER BY game_id, team_id`
      )
    ).toEqual(other)
  })
})

describe('what the engine makes of them', () => {
  it('reads no count as zero for a game with no row, and divides by the tagged games', () => {
    for (const table of [NCAA_SITUATION_PLAYER_GAME, NCAA_SITUATION_TEAM_GAME]) {
      const t = GAME_TABLES.find((x) => x.table === table)
      expect(t, table).toBeDefined()
      expect(t?.zero).toBeUndefined()
    }
    const counts = CATALOGUE.filter(
      (m) => m.built?.startsWith('ncaa_situation_') && m.aggregation === 'sum'
    )
    expect(counts).toHaveLength(12)
    for (const m of counts) expect(m.perGameBy, m.id).toBe('ncaa_tag_games')
  })
})
