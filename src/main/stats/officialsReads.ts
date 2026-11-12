import { officiatingReason } from '@shared/stats/officials'
import {
  GAME_TYPES,
  type GameType,
  type StatsCrewCoverage,
  type StatsOfficialCareer,
  type StatsOfficialLine,
  type StatsOfficialsSeason,
  type StatsOfficiatingTotals
} from '@shared/stats/types'
import type { StatsDb } from './db'
import { inspect } from './derived/sql'

/**
 * Officials' games from the NBA's officials file, with what the box scores say about those games:
 * fouls, free-throw attempts and points for each side, and whether the home side won. Kept as totals,
 * so a rate is divided on read, and always beside the league's totals over the same seasons and
 * season types, so a reader sees the ordinary spread. Nothing here ranks officials.
 *
 * A game counts once per official however many rows list them, and only a played game with both
 * sides' box scores counts toward the rates; the league's figure counts the same kind of games.
 */

const SOURCE = 'src_nba_officials'

/** The order of an official's rows, newest last: a playoff id sorts after every regular-season one. */
const LATEST = (a: string): string => `${a}.season::VARCHAR || ${a}.game_id::VARCHAR`
const ID = /^[0-9]{1,12}$/

const zero = (): StatsOfficiatingTotals => ({
  games: 0,
  homeFouls: 0,
  awayFouls: 0,
  homeFta: 0,
  awayFta: 0,
  homePts: 0,
  awayPts: 0,
  homeWins: 0
})

interface TotalsRow {
  games: number | null
  home_pf: number | null
  away_pf: number | null
  home_fta: number | null
  away_fta: number | null
  home_pts: number | null
  away_pts: number | null
  home_wins: number | null
}

const totalsOf = (r: TotalsRow | null | undefined): StatsOfficiatingTotals =>
  r
    ? {
        games: Number(r.games ?? 0),
        homeFouls: Number(r.home_pf ?? 0),
        awayFouls: Number(r.away_pf ?? 0),
        homeFta: Number(r.home_fta ?? 0),
        awayFta: Number(r.away_fta ?? 0),
        homePts: Number(r.home_pts ?? 0),
        awayPts: Number(r.away_pts ?? 0),
        homeWins: Number(r.home_wins ?? 0)
      }
    : zero()

const SUMS = `count(*)::INTEGER AS games, sum(b.home_pf)::DOUBLE AS home_pf,
  sum(b.away_pf)::DOUBLE AS away_pf, sum(b.home_fta)::DOUBLE AS home_fta,
  sum(b.away_fta)::DOUBLE AS away_fta, sum(b.home_pts)::DOUBLE AS home_pts,
  sum(b.away_pts)::DOUBLE AS away_pts, sum(b.home_win::INTEGER)::DOUBLE AS home_wins`

/** The game types asked for, or none when one is not a type. */
const typesOf = (types: GameType[]): GameType[] =>
  Array.isArray(types) && types.length > 0 && types.every((t) => GAME_TYPES.includes(t))
    ? types
    : []

/**
 * The common pieces, as CTEs over the seasons in `seasonWhere`: `played` (the games played in scope),
 * `crew` (a row per official and game), `box` (each played game with both box scores) and `names`
 * (each official's name and number as the file last lists them).
 */
function ctes(seasonWhere: string, types: string): string {
  return `played AS (
      SELECT g.game_id, g.nba_game_id, g.season, g.home_score > g.away_score AS home_win
      FROM game g WHERE g.played AND ${seasonWhere} AND g.game_type IN ${types}
    ), crew AS (
      SELECT DISTINCT TRY_CAST(o.official_id AS BIGINT) AS official_id, p.game_id, p.season
      FROM ${SOURCE} o JOIN played p ON p.nba_game_id = TRY_CAST(o.game_id AS VARCHAR)
      WHERE TRY_CAST(o.official_id AS BIGINT) IS NOT NULL
    ), box AS (
      SELECT p.game_id, p.season, p.home_win, h.pf AS home_pf, a.pf AS away_pf,
             h.fta AS home_fta, a.fta AS away_fta, h.pts AS home_pts, a.pts AS away_pts
      FROM played p
      JOIN team_game h ON h.game_id = p.game_id AND h.home
      JOIN team_game a ON a.game_id = p.game_id AND NOT a.home
    ), names AS (
      SELECT TRY_CAST(o.official_id AS BIGINT) AS official_id,
             arg_max(trim(concat_ws(' ', o.first_name, o.last_name)), ${LATEST('o')}) AS name,
             arg_max(nullif(trim(o.jersey_num::VARCHAR), ''), ${LATEST('o')}) AS jersey
      FROM ${SOURCE} o GROUP BY 1
    )`
}

/** Each season's games played, games with a crew, and crews by size. */
async function coverage(
  db: StatsDb,
  pre: string,
  params: (string | number)[]
): Promise<Map<number, StatsCrewCoverage>> {
  const rows = await db.all<{ season: number; size: number | null; games: number }>(
    `WITH ${pre}, sizes AS (SELECT game_id, count(*)::INTEGER AS size FROM crew GROUP BY 1)
     SELECT p.season, s.size, count(*)::INTEGER AS games
     FROM played p LEFT JOIN sizes s ON s.game_id = p.game_id
     GROUP BY 1, 2`,
    params
  )
  const out = new Map<number, StatsCrewCoverage>()
  for (const r of rows) {
    const c = out.get(r.season) ?? { games: 0, withCrew: 0, crewSizes: {} }
    c.games += r.games
    if (r.size !== null) {
      c.withCrew += r.games
      c.crewSizes[String(r.size)] = (c.crewSizes[String(r.size)] ?? 0) + r.games
    }
    out.set(r.season, c)
  }
  return out
}

const ready = async (db: StatsDb): Promise<boolean> => {
  const have = await inspect(db)
  const held = have.columns.get(SOURCE)
  return (
    have.tables.has('game') &&
    have.tables.has('team_game') &&
    ['official_id', 'game_id', 'first_name', 'last_name', 'jersey_num'].every((c) => held?.has(c))
  )
}

/** Every official of a season and season types, by games worked then name, and the league's totals. */
export async function readOfficialsSeason(
  db: StatsDb,
  season: number,
  gameTypes: GameType[]
): Promise<StatsOfficialsSeason> {
  const types = typesOf(gameTypes)
  const empty: StatsOfficialsSeason = {
    season,
    coverage: { games: 0, withCrew: 0, crewSizes: {} },
    league: zero(),
    officials: [],
    reason: null
  }
  if (!Number.isInteger(season) || types.length === 0 || !(await ready(db))) return empty
  const params: (string | number)[] = [season, ...types]
  const pre = ctes('g.season = $1', `(${types.map((_, i) => `$${i + 2}`).join(', ')})`)
  const cover = (await coverage(db, pre, params)).get(season) ?? empty.coverage
  const league = await db.get<TotalsRow>(`WITH ${pre} SELECT ${SUMS} FROM box b`, params)
  const rows = await db.all<TotalsRow & { id: string; name: string | null; jersey: string | null }>(
    `WITH ${pre}
     SELECT c.official_id::VARCHAR AS id, n.name, n.jersey, ${SUMS}
     FROM crew c JOIN box b ON b.game_id = c.game_id
     LEFT JOIN names n ON n.official_id = c.official_id
     GROUP BY c.official_id, n.name, n.jersey
     ORDER BY games DESC, n.name, id`,
    params
  )
  const officials: StatsOfficialLine[] = rows.map((r) => ({
    id: r.id,
    name: r.name ?? `Official ${r.id}`,
    jersey: r.jersey,
    totals: totalsOf(r)
  }))
  return {
    season,
    coverage: cover,
    league: totalsOf(league),
    officials,
    reason: officiatingReason(season, cover.games, cover.withCrew)
  }
}

/** One official's seasons, newest first, each beside the league's totals for that season. */
export async function readOfficialCareer(
  db: StatsDb,
  id: string,
  gameTypes: GameType[]
): Promise<StatsOfficialCareer | null> {
  const types = typesOf(gameTypes)
  if (!ID.test(id) || types.length === 0 || !(await ready(db))) return null
  const official = Number(id)
  const named = await db.get<{ name: string | null; jersey: string | null }>(
    `SELECT arg_max(trim(concat_ws(' ', o.first_name, o.last_name)), ${LATEST('o')}) AS name,
            arg_max(nullif(trim(o.jersey_num::VARCHAR), ''), ${LATEST('o')}) AS jersey
     FROM ${SOURCE} o WHERE TRY_CAST(official_id AS BIGINT) = $1`,
    [official]
  )
  if (!named?.name) return null
  // The seasons they worked, in any of the types asked for.
  const params: (string | number)[] = [official, ...types]
  const typeList = `(${types.map((_, i) => `$${i + 2}`).join(', ')})`
  const worked = `g.season IN (
      SELECT g2.season FROM ${SOURCE} o2 JOIN game g2 ON g2.nba_game_id = TRY_CAST(o2.game_id AS VARCHAR)
      WHERE TRY_CAST(o2.official_id AS BIGINT) = $1 AND g2.game_type IN ${typeList})`
  const pre = ctes(worked, typeList)
  const cover = await coverage(db, pre, params)
  const league = await db.all<TotalsRow & { season: number }>(
    `WITH ${pre} SELECT b.season, ${SUMS} FROM box b GROUP BY b.season`,
    params
  )
  const mine = await db.all<TotalsRow & { season: number }>(
    `WITH ${pre}
     SELECT b.season, ${SUMS}
     FROM crew c JOIN box b ON b.game_id = c.game_id
     WHERE c.official_id = $1
     GROUP BY b.season`,
    params
  )
  const leagueBy = new Map(league.map((r) => [r.season, r]))
  const mineBy = new Map(mine.map((r) => [r.season, r]))
  return {
    id,
    name: named.name,
    jersey: named.jersey,
    seasons: [...mineBy.keys()]
      .sort((a, b) => b - a)
      .map((s) => {
        const c = cover.get(s) ?? { games: 0, withCrew: 0, crewSizes: {} }
        return {
          season: s,
          totals: totalsOf(mineBy.get(s)),
          league: totalsOf(leagueBy.get(s)),
          coverage: c,
          reason: officiatingReason(s, c.games, c.withCrew)
        }
      })
  }
}
