import { seasonLabel } from '@shared/stats/seasons'
import {
  GAME_TYPES,
  type StatsGameMatchup,
  type StatsGameMatchups,
  type StatsMatchupPair,
  type StatsMatchups,
  type StatsMatchupScope
} from '@shared/stats/types'
import type { StatsDb } from './db'
import { GAME_MATCHUPS } from './derived/gameMatchups'
import { MATCHUPS_FIRST_SEASON } from './derived/publishedTables'
import { inspect } from './derived/sql'

/**
 * Two reads of the game matchups beside the engine: who guarded whom in one game, and a player's pairs
 * over the games of a scope that is not a whole regular season (the pair file answers that one).
 */

const ID = /^-?[0-9]{1,12}$/
const GAME_ID = /^[a-z0-9:]{1,24}$/
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

/** The pairs of a game, each defending side's longest first, or why there are none to show. */
export async function readGameMatchups(db: StatsDb, gameId: string): Promise<StatsGameMatchups> {
  const have = await inspect(db)
  if (!GAME_ID.test(gameId) || !have.tables.has('game')) return { pairs: [], reason: null }
  const game = await db.get<{ season: number; played: boolean }>(
    'SELECT season, played FROM game WHERE game_id = ?',
    [gameId]
  )
  if (!game) return { pairs: [], reason: null }
  if (game.season < MATCHUPS_FIRST_SEASON) {
    return { pairs: [], reason: `Tracked from ${seasonLabel(MATCHUPS_FIRST_SEASON)}.` }
  }
  if (!have.tables.has(GAME_MATCHUPS)) return { pairs: [], reason: null }
  const named = have.tables.has('player')
  const rows = await db.all<{
    off_id: string
    off_name: string | null
    off_team: string | null
    off_position: string | null
    def_id: string
    def_name: string | null
    def_team: string | null
    minutes: number | null
    poss: number | null
    pts: number | null
    fgm: number | null
    fga: number | null
    fg3m: number | null
    fg3a: number | null
    ftm: number | null
    fta: number | null
    ast: number | null
    tov: number | null
    blk: number | null
    sfl: number | null
  }>(
    `SELECT m.off_player_id::VARCHAR AS off_id, ${named ? 'o.name' : 'NULL::VARCHAR'} AS off_name,
            m.off_team_id::VARCHAR AS off_team, m.off_position,
            m.def_player_id::VARCHAR AS def_id, ${named ? 'd.name' : 'NULL::VARCHAR'} AS def_name,
            m.def_team_id::VARCHAR AS def_team, m.matchup_minutes AS minutes, m.possessions AS poss,
            m.player_pts AS pts, m.matchup_fgm AS fgm, m.matchup_fga AS fga,
            m.matchup_fg3_m AS fg3m, m.matchup_fg3_a AS fg3a, m.matchup_ftm AS ftm,
            m.matchup_fta AS fta, m.matchup_ast AS ast, m.matchup_tov AS tov,
            m.matchup_blk AS blk, m.sfl
     FROM ${GAME_MATCHUPS} m
     ${named ? 'LEFT JOIN player o ON o.player_id = m.off_player_id LEFT JOIN player d ON d.player_id = m.def_player_id' : ''}
     WHERE m.game_id = ?
     ORDER BY m.def_team_id, m.matchup_seconds DESC NULLS LAST, m.def_player_id, m.off_player_id`,
    [gameId]
  )
  const pairs: StatsGameMatchup[] = rows.map((r) => ({
    offId: r.off_id,
    offName: r.off_name ?? `Player ${r.off_id}`,
    offTeamId: r.off_team,
    offPosition: r.off_position,
    defId: r.def_id,
    defName: r.def_name ?? `Player ${r.def_id}`,
    defTeamId: r.def_team,
    minutes: r.minutes,
    partialPoss: r.poss,
    pts: r.pts,
    fgm: r.fgm,
    fga: r.fga,
    fg3m: r.fg3m,
    fg3a: r.fg3a,
    ftm: r.ftm,
    fta: r.fta,
    ast: r.ast,
    tov: r.tov,
    blk: r.blk,
    sfl: r.sfl
  }))
  const reason =
    pairs.length === 0 && game.played ? 'The NBA’s file has no matchups for this game.' : null
  return { pairs, reason }
}

/** A scope the game matchups can answer, checked before anything reaches SQL; null when it is not. */
function checked(scope: StatsMatchupScope): StatsMatchupScope | null {
  const types = scope.gameTypes
  if (!Array.isArray(types) || types.length === 0 || !types.every((t) => GAME_TYPES.includes(t))) {
    return null
  }
  if (
    scope.dates &&
    !(scope.dates.every((d) => DATE.test(d)) && scope.dates[0] <= scope.dates[1])
  ) {
    return null
  }
  if (
    scope.lastN !== undefined &&
    !(Number.isInteger(scope.lastN) && scope.lastN >= 1 && scope.lastN <= 200)
  ) {
    return null
  }
  return scope
}

/**
 * A player's pairs over their games in a scope, from the game matchups: the season types, then a date
 * range or their last N games (their own appearances, or their team's last N, as the engine reads
 * them). A pair's games are the games in scope where it has a row.
 */
export async function readScopedMatchups(
  db: StatsDb,
  id: string,
  season: number,
  raw: StatsMatchupScope
): Promise<StatsMatchups> {
  const none: StatsMatchups = { guarded: [], guardedBy: [], source: 'games' }
  const have = await inspect(db)
  const scope = checked(raw)
  if (
    !scope ||
    !ID.test(id) ||
    !Number.isInteger(season) ||
    !have.tables.has(GAME_MATCHUPS) ||
    !have.tables.has('player_game')
  ) {
    return none
  }
  const params: (string | number)[] = [Number(id), season]
  const add = (v: string | number): string => {
    params.push(v)
    return `$${params.length}`
  }
  const types = `(${scope.gameTypes.map(add).join(', ')})`
  const dates = scope.dates
    ? ` AND w.game_date BETWEEN ${add(scope.dates[0])}::DATE AND ${add(scope.dates[1])}::DATE`
    : ''
  const inScope = `w.season = $2 AND w.game_type IN ${types}${dates}`
  let games: string
  if (scope.lastN !== undefined && scope.lastNOf === 'team') {
    const n = add(scope.lastN)
    games = `SELECT w.game_id FROM player_game w
             JOIN (SELECT w.team_id, w.game_id FROM team_game w WHERE ${inScope}
                   QUALIFY row_number() OVER (PARTITION BY w.team_id
                                              ORDER BY w.game_date DESC, w.game_id DESC) <= ${n}) r
               ON r.team_id = w.team_id AND r.game_id = w.game_id
             WHERE w.player_id = $1 AND ${inScope}`
  } else {
    const last =
      scope.lastN !== undefined
        ? `QUALIFY row_number() OVER (ORDER BY w.game_date DESC, w.game_id DESC) <= ${add(scope.lastN)}`
        : ''
    games = `SELECT w.game_id FROM player_game w WHERE w.player_id = $1 AND ${inScope} ${last}`
  }
  const named = have.tables.has('player')
  const rows = await db.all<{
    guarded: boolean
    other: string
    name: string | null
    games: number
    minutes: number | null
    partial_poss: number | null
    pts: number | null
    fgm: number | null
    fga: number | null
    fg3m: number | null
    fg3a: number | null
    ftm: number | null
    fta: number | null
    ast: number | null
    tov: number | null
    blk: number | null
  }>(
    `WITH g AS (${games}),
     p AS (
       SELECT m.def_player_id = $1 AS guarded,
              CASE WHEN m.def_player_id = $1 THEN m.off_player_id ELSE m.def_player_id END AS other,
              count(DISTINCT m.game_id)::INTEGER AS games, sum(m.matchup_minutes) AS minutes,
              sum(m.possessions) AS partial_poss, sum(m.player_pts) AS pts,
              sum(m.matchup_fgm) AS fgm, sum(m.matchup_fga) AS fga,
              sum(m.matchup_fg3_m) AS fg3m, sum(m.matchup_fg3_a) AS fg3a,
              sum(m.matchup_ftm) AS ftm, sum(m.matchup_fta) AS fta, sum(m.matchup_ast) AS ast,
              sum(m.matchup_tov) AS tov, sum(m.matchup_blk) AS blk
       FROM ${GAME_MATCHUPS} m SEMI JOIN g ON g.game_id = m.game_id
       WHERE m.def_player_id = $1 OR m.off_player_id = $1
       GROUP BY 1, 2
     )
     SELECT p.guarded, p.other::VARCHAR AS other, ${named ? 'pl.name' : 'NULL::VARCHAR'} AS name,
            p.games, p.minutes, p.partial_poss, p.pts, p.fgm, p.fga, p.fg3m, p.fg3a, p.ftm, p.fta,
            p.ast, p.tov, p.blk
     FROM p ${named ? 'LEFT JOIN player pl ON pl.player_id = p.other' : ''}
     ORDER BY p.minutes DESC NULLS LAST, p.other`,
    params
  )
  const pair = (r: (typeof rows)[number]): StatsMatchupPair => ({
    id: r.other,
    name: r.name ?? `Player ${r.other}`,
    games: r.games,
    minutes: r.minutes,
    partialPoss: r.partial_poss,
    pts: r.pts,
    fgm: r.fgm,
    fga: r.fga,
    fg3m: r.fg3m,
    fg3a: r.fg3a,
    ftm: r.ftm,
    fta: r.fta,
    ast: r.ast,
    tov: r.tov,
    blk: r.blk
  })
  return {
    guarded: rows.filter((r) => r.guarded).map(pair),
    guardedBy: rows.filter((r) => !r.guarded).map(pair),
    source: 'games'
  }
}
