import { seasonLabel, type League } from '@shared/leagues'
import {
  GAME_TYPES,
  type GameType,
  type StatsOnCourtLine,
  type StatsOnCourtScope,
  type StatsOnCourtUnit,
  type StatsOnCourtUnits,
  type StatsPlaysHeld,
  type StatsWithOrWithout
} from '@shared/stats/types'
import type { StatsDb } from './db'
import { ON_COURT_COUNTS, ON_COURT_FIRST_SEASON, UNIT_GAME } from './derived/onCourt'
import { inspect } from './derived/sql'

/**
 * Reads of `unit_game` beside the engine: a team's groups of two to five players, and a player's
 * numbers with a teammate on and off the floor. Both are sums of the unit rows of the games in scope,
 * so a date range or the last games read exactly, and rates are divided by the screen.
 */

const ID = /^-?[0-9]{1,12}$/
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
const SLOTS = ['p1', 'p2', 'p3', 'p4', 'p5']

/** Every count of both sides, as `unit_game` names them. */
const PARTS = ['secs', ...ON_COURT_COUNTS, ...ON_COURT_COUNTS.map((c) => `opp_${c}`)]

/** Why there is nothing to read for a season; null when it can be read. */
export function onCourtReason(season: number, league: League): string | null {
  return season < ON_COURT_FIRST_SEASON
    ? `Counted from ${seasonLabel(league, ON_COURT_FIRST_SEASON)}, when the ${league.name}'s play by play starts.`
    : null
}

/** The 1-based positions of every group of `size` among five players. */
export function groupsOf(size: number): number[][] {
  const out: number[][] = []
  const walk = (start: number, picked: number[]): void => {
    if (picked.length === size) {
      out.push(picked)
      return
    }
    for (let i = start; i <= 5; i++) walk(i + 1, [...picked, i])
  }
  walk(1, [])
  return out
}

interface Checked {
  season: number
  types: GameType[]
  dates?: [string, string]
  lastN?: number
}

/** The scope's fields, checked: null when one is not valid, so nothing reaches SQL unchecked. */
function check(season: number, scope: StatsOnCourtScope): Checked | null {
  if (!Number.isInteger(season)) return null
  const types = scope.gameTypes.filter((t) => GAME_TYPES.includes(t))
  if (types.length === 0 || types.length !== scope.gameTypes.length) return null
  if (scope.dates && !(scope.dates.length === 2 && scope.dates.every((d) => DATE.test(d)))) {
    return null
  }
  if (scope.lastN !== undefined && !(Number.isInteger(scope.lastN) && scope.lastN > 0)) return null
  return { season, types, dates: scope.dates, lastN: scope.lastN }
}

/** The games in scope for a team, as a SQL condition on `u` with its parameters from `$n`. */
function gamesWhere(
  c: Checked,
  team: number,
  first: number
): { sql: string; params: (string | number)[] } {
  const params: (string | number)[] = [c.season, team, ...c.types]
  const types = c.types.map((_, i) => `$${first + 2 + i}`).join(', ')
  let n = first + 2 + c.types.length
  const where = [`u.season = $${first}`, `u.team_id = $${first + 1}`, `u.game_type IN (${types})`]
  if (c.dates) {
    where.push(`u.game_date BETWEEN $${n}::DATE AND $${n + 1}::DATE`)
    params.push(c.dates[0], c.dates[1])
    n += 2
  }
  if (c.lastN !== undefined) {
    // The team's last N games in scope, which a group may have missed.
    where.push(`u.game_id IN (
      SELECT game_id FROM (SELECT DISTINCT game_id, game_date FROM ${UNIT_GAME} v
                           WHERE v.season = $${first} AND v.team_id = $${first + 1}
                             AND v.game_type IN (${types})
                             ${c.dates ? `AND v.game_date BETWEEN $${first + 2 + c.types.length}::DATE AND $${first + 3 + c.types.length}::DATE` : ''})
      ORDER BY game_date DESC, game_id DESC LIMIT $${n})`)
    params.push(c.lastN)
  }
  return { sql: where.join(' AND '), params }
}

/**
 * What the play by play holds of the games read, beside the team's box score (`StatsPlaysHeld`). `rows`
 * is the SQL of CTEs and the one of them that is the unit rows read; `mates` are the players whose
 * box-score lines a game without plays must hold to be one of these games. The last games asked for are
 * the last with plays, so none is missing from them.
 */
async function playsHeld(
  db: StatsDb,
  c: Checked,
  team: number,
  rows: { sql: string; of: string; params: (string | number)[] },
  mates: number[]
): Promise<StatsPlaysHeld | undefined> {
  if (!(await inspect(db)).tables.has('team_game')) return undefined
  const sums = await db.get<Record<string, number | null>>(
    `WITH ${rows.sql},
     g AS (SELECT game_id, sum(pts) AS pts, sum(opp_pts) AS opp FROM ${rows.of} GROUP BY game_id)
     SELECT sum(g.pts)::DOUBLE AS pts, sum(t.pts)::DOUBLE AS box, sum(g.opp)::DOUBLE AS opp,
            sum(t.opp_pts)::DOUBLE AS boxopp
     FROM g JOIN team_game t ON t.game_id = g.game_id AND t.team_id = $2
     WHERE t.pts IS NOT NULL AND t.opp_pts IS NOT NULL`,
    rows.params
  )
  const types = c.types.map((_, i) => `$${i + 3}`).join(', ')
  const at = 3 + c.types.length
  const none =
    c.lastN === undefined
      ? await db.get<{ n: number }>(
          `SELECT count(*)::INTEGER AS n FROM team_game t
           WHERE t.season = $1 AND t.team_id = $2 AND t.game_type IN (${types}) AND t.pts IS NOT NULL
             ${c.dates ? `AND t.game_date BETWEEN $${at}::DATE AND $${at + 1}::DATE` : ''}
             ${mates.map((m) => `AND EXISTS (SELECT 1 FROM player_game b WHERE b.game_id = t.game_id AND b.team_id = t.team_id AND b.player_id = ${m})`).join(' ')}
             AND NOT EXISTS (SELECT 1 FROM ${UNIT_GAME} u WHERE u.game_id = t.game_id AND u.team_id = t.team_id)`,
          [c.season, team, ...c.types, ...(c.dates ?? [])]
        )
      : undefined
  return {
    pts: Number(sums?.pts ?? 0),
    boxPts: Number(sums?.box ?? 0),
    oppPts: Number(sums?.opp ?? 0),
    boxOppPts: Number(sums?.boxopp ?? 0),
    noPlays: Number(none?.n ?? 0)
  }
}

const lineOf = (r: Record<string, unknown>): StatsOnCourtLine =>
  ({
    games: Number(r.games ?? 0),
    ...Object.fromEntries(PARTS.map((p) => [p, Number(r[p] ?? 0)]))
  }) as StatsOnCourtLine

async function names(db: StatsDb, ids: string[]): Promise<Map<string, string>> {
  const known = new Map<string, string>()
  const wanted = ids.filter((id) => ID.test(id))
  if (wanted.length === 0) return known
  const rows = await db.all<{ id: string; name: string | null }>(
    `SELECT player_id::VARCHAR AS id, name FROM player WHERE player_id IN (${wanted.join(', ')})`
  )
  for (const r of rows) if (r.name) known.set(r.id, r.name)
  return known
}

/**
 * A team's groups of `size` players (two to five) in a season and scope, every group the plays put on
 * the floor, most minutes first. A five-man unit needs five distinct players known; a smaller group is
 * any `size` of the players known together.
 */
export async function readOnCourtUnits(
  db: StatsDb,
  team: string,
  season: number,
  scope: StatsOnCourtScope,
  size: number,
  league: League
): Promise<StatsOnCourtUnits> {
  const reason = onCourtReason(season, league)
  const none: StatsOnCourtUnits = { units: [], reason }
  const c = check(season, scope)
  if (reason || !c || !ID.test(team) || ![2, 3, 4, 5].includes(size)) return none
  if (!(await inspect(db)).tables.has(UNIT_GAME)) return none
  const groups = groupsOf(size)
  const { sql, params } = gamesWhere(c, Number(team), 1)
  const rows = await db.all<Record<string, unknown>>(
    `WITH u AS (SELECT * FROM ${UNIT_GAME} u WHERE ${sql}${size === 5 ? ' AND u.complete' : ''}),
     g AS (
       SELECT u.*, list_transform(ix, i -> [${SLOTS.map((s) => `u.${s}`).join(', ')}][i]) AS grp
       FROM u, (SELECT unnest(${JSON.stringify(groups)}) AS ix)
     )
     SELECT grp::VARCHAR[] AS players, count(DISTINCT game_id) AS games,
            ${PARTS.map((p) => `sum(${p})::DOUBLE AS ${p}`).join(', ')}
     FROM g WHERE list_bool_and(list_transform(grp, x -> x IS NOT NULL))
     GROUP BY grp ORDER BY secs DESC, grp`,
    params
  )
  const known = await names(db, [...new Set(rows.flatMap((r) => r.players as string[]))])
  const units = rows.map((r): StatsOnCourtUnit => ({
    players: (r.players as string[]).map((id) => ({ id, name: known.get(id) ?? `Player ${id}` })),
    line: lineOf(r)
  }))
  const held = await playsHeld(
    db,
    c,
    Number(team),
    { sql: `u AS (SELECT * FROM ${UNIT_GAME} u WHERE ${sql})`, of: 'u', params },
    []
  )
  return { units, held, reason: null }
}

/**
 * A player's team with a teammate on and off the floor, in the games both played for it in scope:
 * both on, the player alone, the teammate alone, neither. With no teammate named, the one they shared
 * the most minutes with. The teammates, most minutes together first, come with it for a picker.
 */
export async function readWithOrWithout(
  db: StatsDb,
  player: string,
  teammate: string | null,
  season: number,
  scope: StatsOnCourtScope,
  league: League
): Promise<StatsWithOrWithout> {
  const reason = onCourtReason(season, league)
  const none: StatsWithOrWithout = {
    teamId: null,
    teammate: null,
    teammates: [],
    splits: null,
    reason
  }
  const c = check(season, scope)
  if (reason || !c || !ID.test(player) || (teammate !== null && !ID.test(teammate))) return none
  if (!(await inspect(db)).tables.has(UNIT_GAME)) return none
  const me = Number(player)
  const team = await db.get<{ team_id: number | null }>(
    `SELECT arg_max(team_id, secs)::BIGINT AS team_id FROM (
       SELECT team_id, sum(secs) AS secs FROM ${UNIT_GAME}
       WHERE season = $1 AND game_type IN (${c.types.map((_, i) => `$${i + 3}`).join(', ')})
         AND $2 IN (p1, p2, p3, p4, p5)
       GROUP BY team_id)`,
    [season, me, ...c.types]
  )
  if (team?.team_id === null || team?.team_id === undefined) return none
  const teamId = Number(team.team_id)
  const { sql, params } = gamesWhere(c, teamId, 1)
  const p = params.length + 1
  // The games of the team in scope that the player played: a unit row with them in it.
  const mine = `u AS (
    SELECT * FROM ${UNIT_GAME} u WHERE ${sql}
      AND u.game_id IN (SELECT game_id FROM ${UNIT_GAME} w
                        WHERE w.team_id = $2 AND w.season = $1 AND $${p} IN (w.p1, w.p2, w.p3, w.p4, w.p5)))`
  const mates = await db.all<{ id: string; secs: number }>(
    `WITH ${mine}
     SELECT mate::VARCHAR AS id, sum(secs)::DOUBLE AS secs
     FROM (SELECT secs, unnest([p1, p2, p3, p4, p5]) AS mate FROM u WHERE $${p} IN (p1, p2, p3, p4, p5))
     WHERE mate IS NOT NULL AND mate <> $${p}
     GROUP BY mate ORDER BY secs DESC, mate`,
    [...params, me]
  )
  const known = await names(
    db,
    mates.map((m) => m.id)
  )
  const teammates = mates.map((m) => ({
    id: m.id,
    name: known.get(m.id) ?? `Player ${m.id}`,
    minutes: Number(m.secs) / 60
  }))
  const pick = teammate ?? teammates[0]?.id ?? null
  if (pick === null)
    return { teamId: String(teamId), teammate: null, teammates, splits: null, reason: null }
  // The games both were on the floor in, by the units.
  const shared = `${mine},
     shared AS (
       SELECT * FROM u WHERE u.game_id IN (SELECT game_id FROM ${UNIT_GAME} w
         WHERE w.team_id = $2 AND w.season = $1 AND $${p + 1} IN (w.p1, w.p2, w.p3, w.p4, w.p5))
     )`
  const rows = await db.all<Record<string, unknown>>(
    `WITH ${shared}
     -- list_contains, not IN: a unit missing a player would read NULL, and drop out of both splits.
     SELECT list_contains([p1, p2, p3, p4, p5], $${p}) AS me_on,
            list_contains([p1, p2, p3, p4, p5], $${p + 1}) AS mate_on,
            count(DISTINCT game_id) AS games, ${PARTS.map((x) => `sum(${x})::DOUBLE AS ${x}`).join(', ')}
     FROM shared GROUP BY ALL`,
    [...params, me, Number(pick)]
  )
  const split = (meOn: boolean, mateOn: boolean): StatsOnCourtLine | null => {
    const r = rows.find((x) => Boolean(x.me_on) === meOn && Boolean(x.mate_on) === mateOn)
    return r ? lineOf(r) : null
  }
  const held = await playsHeld(
    db,
    c,
    teamId,
    { sql: shared, of: 'shared', params: [...params, me, Number(pick)] },
    [me, Number(pick)]
  )
  return {
    teamId: String(teamId),
    teammate: pick,
    teammates,
    splits: {
      both: split(true, true),
      playerOnly: split(true, false),
      teammateOnly: split(false, true),
      neither: split(false, false)
    },
    held,
    reason: null
  }
}
