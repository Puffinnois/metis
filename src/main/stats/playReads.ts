import { flowSummary, gameLength, PLAY_DETAIL_FIRST_SEASON } from '@shared/stats/playDetail'
import { seasonLabel } from '@shared/stats/seasons'
import {
  GAME_TYPES,
  type StatsAssistNetwork,
  type StatsAssistRequest,
  type StatsFlowPoint,
  type StatsGameFlow
} from '@shared/stats/types'
import type { StatsDb } from './db'
import { scoringRowsSql } from './derived/playDetail'
import { PLAY_TABLES } from './derived/plays'
import { inspect } from './derived/sql'

/**
 * The play-derived reads beside the engine (Plan T905): a list of pairs and a game's scoring in order
 * are rows, not sums. Both read `play_nba` directly, a season's rows at a time; how fast they answer
 * on the full load, and why nothing more is stored for them, is in `docs/reference/stats-screens.md`.
 */

const ID = /^-?[0-9]{1,12}$/
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
const GAME = /^[0-9A-Za-z:_-]{1,40}$/

const none = (reason: string | null): StatsAssistNetwork => ({ pairs: [], total: 0, reason })

function checked(r: StatsAssistRequest): StatsAssistRequest | null {
  if (r.entity !== 'player' && r.entity !== 'team') return null
  if (!ID.test(r.id)) return null
  if (
    !Array.isArray(r.seasons) ||
    r.seasons.length === 0 ||
    r.seasons.length > 40 ||
    !r.seasons.every((s) => Number.isInteger(s))
  ) {
    return null
  }
  const s = r.scope
  if (!s || !Array.isArray(s.gameTypes) || s.gameTypes.length === 0) return null
  if (!s.gameTypes.every((t) => GAME_TYPES.includes(t))) return null
  if (s.dates && !(s.dates.every((d) => DATE.test(d)) && s.dates[0] <= s.dates[1])) return null
  if (s.lastN !== undefined && !(Number.isInteger(s.lastN) && s.lastN >= 1 && s.lastN <= 200)) {
    return null
  }
  if (s.lastNOf !== undefined && s.lastNOf !== 'appearances' && s.lastNOf !== 'team') return null
  return r
}

/**
 * Who assisted whom: each made field goal with an assist in `play_nba`, by passer and scorer, over the
 * games of the scope as the engine reads them (a player's own appearances, or their team's last N).
 * A team's pairs are its own players'; a player's are those where they passed or scored.
 */
export async function readAssistNetwork(
  db: StatsDb,
  raw: StatsAssistRequest
): Promise<StatsAssistNetwork> {
  const r = checked(raw)
  if (!r) return none(null)
  if (r.seasons.every((s) => s < PLAY_DETAIL_FIRST_SEASON)) {
    return none(`Recorded from ${seasonLabel(PLAY_DETAIL_FIRST_SEASON)}.`)
  }
  const have = await inspect(db)
  const box = r.entity === 'player' ? 'player_game' : 'team_game'
  if (![box, PLAY_TABLES.nba, 'player'].every((t) => have.tables.has(t))) return none(null)
  const params: (string | number)[] = []
  const add = (v: string | number): string => {
    params.push(v)
    return `$${params.length}`
  }
  const key = r.entity === 'player' ? 'player_id' : 'team_id'
  const id = add(Number(r.id))
  const s = r.scope
  const inScope = [
    `w.season IN (${r.seasons.map(add).join(', ')})`,
    `w.game_type IN (${s.gameTypes.map(add).join(', ')})`,
    ...(s.dates
      ? [`w.game_date BETWEEN ${add(s.dates[0])}::DATE AND ${add(s.dates[1])}::DATE`]
      : [])
  ].join(' AND ')
  let games: string
  if (s.lastN !== undefined && s.lastNOf === 'team' && r.entity === 'player') {
    games = `SELECT w.game_id FROM player_game w
             JOIN (SELECT w.team_id, w.game_id FROM team_game w WHERE ${inScope}
                   QUALIFY row_number() OVER (PARTITION BY w.team_id
                                              ORDER BY w.game_date DESC, w.game_id DESC) <= ${add(s.lastN)}) r
               USING (team_id, game_id)
             WHERE w.player_id = ${id} AND ${inScope}`
  } else {
    const last =
      s.lastN !== undefined
        ? `QUALIFY row_number() OVER (ORDER BY w.game_date DESC, w.game_id DESC) <= ${add(s.lastN)}`
        : ''
    games = `SELECT w.game_id FROM ${box} w WHERE w.${key} = ${id} AND ${inScope} ${last}`
  }
  const who =
    r.entity === 'player' ? `(p.assist_id = ${id} OR p.player_id = ${id})` : `p.team_id = ${id}`
  const rows = await db.all<{
    passer: number
    scorer: number
    passer_name: string | null
    scorer_name: string | null
    makes: number
    threes: number
    points: number
  }>(
    `WITH g AS (${games}),
     pairs AS (
       SELECT p.assist_id AS passer, p.player_id AS scorer, count(*)::INTEGER AS makes,
              sum(p.fg3m)::INTEGER AS threes, sum(p.pts)::INTEGER AS points
       FROM ${PLAY_TABLES.nba} p SEMI JOIN g ON g.game_id = p.game_id
       WHERE p.season IN (${r.seasons.join(', ')}) AND p.ast = 1 AND p.fgm = 1 AND ${who}
       GROUP BY 1, 2)
     SELECT pairs.*, a.name AS passer_name, b.name AS scorer_name
     FROM pairs LEFT JOIN player a ON a.player_id = pairs.passer
     LEFT JOIN player b ON b.player_id = pairs.scorer
     ORDER BY makes DESC, points DESC, passer_name, scorer_name`,
    params
  )
  const pairs = rows.map((x) => ({
    passer: String(x.passer),
    passerName: x.passer_name ?? String(x.passer),
    scorer: String(x.scorer),
    scorerName: x.scorer_name ?? String(x.scorer),
    makes: Number(x.makes),
    threes: Number(x.threes),
    points: Number(x.points)
  }))
  return { pairs, total: pairs.reduce((n, p) => n + p.makes, 0), reason: null }
}

/** A game's scoring plays in order, from `play_nba`, and its flow by the rules of `flowSummary`. */
export async function readGameFlow(db: StatsDb, gameId: string): Promise<StatsGameFlow> {
  const empty = (reason: string | null): StatsGameFlow => ({
    points: [],
    periods: 4,
    homeTeam: '',
    awayTeam: '',
    summary: null,
    reason
  })
  if (typeof gameId !== 'string' || !GAME.test(gameId)) return empty(null)
  const have = await inspect(db)
  if (![PLAY_TABLES.nba, 'game'].every((t) => have.tables.has(t))) return empty(null)
  const game = await db.get<{ season: number; home: number; away: number }>(
    'SELECT season, home_team_id AS home, away_team_id AS away FROM game WHERE game_id = $1',
    [gameId]
  )
  if (!game) return empty(null)
  const teams = { homeTeam: String(game.home), awayTeam: String(game.away) }
  const season = Number(game.season)
  if (!(season >= PLAY_DETAIL_FIRST_SEASON)) {
    return { ...empty(`Recorded from ${seasonLabel(PLAY_DETAIL_FIRST_SEASON)}.`), ...teams }
  }
  const rows = await db.all<{
    t: number
    period: number
    clock: number
    home: boolean
    pts: number
    fgm: number
    home_score: number
    away_score: number
  }>(
    `SELECT t, period, clock, home, pts, fgm, home_score, away_score
     FROM (${scoringRowsSql(`(SELECT * FROM ${PLAY_TABLES.nba} WHERE season = ${season} AND game_id = $1)`)})
     ORDER BY ord`,
    [gameId]
  )
  const last = await db.get<{ p: number | null }>(
    `SELECT max(period)::INTEGER AS p FROM ${PLAY_TABLES.nba}
     WHERE season = ${season} AND game_id = $1`,
    [gameId]
  )
  const periods = Number(last?.p ?? 0)
  if (periods === 0) return { ...empty('No play by play for this game.'), ...teams }
  const points: StatsFlowPoint[] = rows.map((x) => ({
    t: Number(x.t),
    period: Number(x.period),
    clock: Number(x.clock),
    home: Boolean(x.home),
    pts: Number(x.pts),
    fg: Number(x.fgm) === 1,
    homeScore: Number(x.home_score),
    awayScore: Number(x.away_score)
  }))
  return {
    points,
    periods,
    ...teams,
    summary: flowSummary(points, gameLength(periods)),
    reason: null
  }
}
