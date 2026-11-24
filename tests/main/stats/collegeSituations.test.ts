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
import { buildPlays } from '@main/stats/derived/playBuilders'
import { buildPublished } from '@main/stats/derived/published'
import { buildIdentity } from '@main/stats/identity'
import { LEAGUES, type League } from '@shared/leagues'
import { openTestDb } from '../../fixtures/stats'
import { slow } from '../../fixtures/timeouts'

/**
 * The college leagues' counts by situation (T1703.2, part 4c), built by the plays step on the T1302
 * fixtures, whose games carry their own play by play and possessions as stats.ncaa.org published them.
 * Each count is worked again from the fixture's own file, per game and side, so the test holds the
 * rules (a tag counted as the play table counts the play), not a number from a run.
 */
const FIXTURES = join(__dirname, '../../fixtures')

async function built(league: League): Promise<StatsDb> {
  const db = await openTestDb()
  for (const dir of ['college-identity', 'college-derived', 'college-depth']) {
    for (const file of readdirSync(join(FIXTURES, dir, league.id))) {
      const table = `src_${file.replace(/\.parquet$/, '')}`
      const path = join(FIXTURES, dir, league.id, file)
      await db.exec(`CREATE TABLE ${table} AS SELECT * FROM read_parquet(${sqlString(path)})`)
    }
  }
  await buildIdentity(db, league)
  await buildDerived(db, league)
  await buildPublished(db, league)
  await buildPlays(db, league)
  return db
}

type Row = Record<string, number | string | null>
const n = (x: unknown): number => Number(x)

/** Each game's two values of a count, smallest first, so sides are compared without naming them. */
const pairs = (rows: Row[], key: string, value: string): Map<string, number[]> => {
  const out = new Map<string, number[]>()
  for (const r of rows) {
    const k = String(r[key])
    out.set(
      k,
      [...(out.get(k) ?? []), n(r[value])].sort((a, b) => a - b)
    )
  }
  return out
}

/** The file's tag counts per game and team, as the play table counts a play: makes only score. */
const FILE_TAGS = `
  SELECT g.game_id, p.event_team,
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
  WHERE p.event_team IS NOT NULL
  GROUP BY 1, 2`

/** The file's possession counts per game and offence. */
const FILE_POSSESSIONS = `
  SELECT g.game_id, s.poss_team, count(*) AS ncaa_poss_n,
    count(*) FILTER (WHERE s.first_shot_type = 'Three Point Jumper') AS ncaa_poss_first3,
    count(*) FILTER (WHERE s.first_shot_type IN ('Layup', 'Dunk', 'Tip In')) AS ncaa_poss_first_rim,
    count(*) FILTER (WHERE s.first_shot_type IN ('Two Point Jumper', 'Hook')) AS ncaa_poss_first_two,
    count(*) FILTER (WHERE s.first_shot_type IS NULL) AS ncaa_poss_first_none,
    count(*) FILTER (WHERE s.is_assisted > 0) AS ncaa_poss_ast
  FROM src_ncaa_possessions s JOIN game g ON g.ncaa_game_id = CAST(s.contest_id AS VARCHAR)
  WHERE s.poss_team IS NOT NULL
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
    for (const c of NCAA_SITUATION_COUNTS) {
      const built = pairs(table, 'game_id', c)
      const worked = pairs(file, 'game_id', c)
      for (const [game, values] of built) {
        // A side with no tagged play has no row in the file's count: it counted 0.
        const expected = worked.get(game) ?? []
        expect(values, `${c} ${game}`).toEqual(
          [...Array(2 - expected.length).fill(0), ...expected].sort((a, b) => a - b)
        )
      }
    }
    // Something of each kind is there to count.
    const totals = await db().get<Row>(
      `SELECT ${NCAA_SITUATION_COUNTS.map((c) => `sum(${c}) AS ${c}`).join(', ')} FROM ${NCAA_SITUATION_TEAM_GAME}`
    )
    for (const c of NCAA_SITUATION_COUNTS) expect(n(totals?.[c]), c).toBeGreaterThan(0)
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
       LEFT JOIN (SELECT game_id, team_id, ${NCAA_SITUATION_COUNTS.map((c) => `sum(${c}) AS ${c}`).join(', ')}
                  FROM ${NCAA_SITUATION_PLAYER_GAME} GROUP BY 1, 2) p
         ON p.game_id = t.game_id AND p.team_id = t.team_id
       WHERE ${NCAA_SITUATION_COUNTS.map((c) => `coalesce(p.${c}, 0) <> t.${c}`).join(' OR ')}`
    )
    expect(off).toEqual([])
  })

  it('counts the possessions, their first shots and their assisted baskets per offence', async () => {
    const table = await db().all<Row>(`SELECT * FROM ${NCAA_SITUATION_TEAM_GAME}`)
    const file = await db().all<Row>(FILE_POSSESSIONS)
    expect(file.length).toBeGreaterThan(0)
    for (const c of NCAA_POSSESSION_COUNTS) {
      const built = pairs(table, 'game_id', c)
      for (const [game, values] of pairs(file, 'game_id', c)) {
        expect(built.get(game), `${c} ${game}`).toEqual(values)
      }
    }
    // The kinds of first shot and none add up to the possessions, apart from an unknown type.
    const over = await db().get<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM ${NCAA_SITUATION_TEAM_GAME}
       WHERE ncaa_poss_first3 + ncaa_poss_first_rim + ncaa_poss_first_two + ncaa_poss_first_none > ncaa_poss_n`
    )
    expect(over?.n).toBe(0)
  })
})
