import { seasonLabel } from '@shared/stats/seasons'
import { SHOT_CHART_LIMIT, SHOT_ZONES, SHOTS_FIRST_SEASON } from '@shared/stats/shots'
import {
  GAME_TYPES,
  type StatsShotChart,
  type StatsShotRequest,
  type StatsShotZone
} from '@shared/stats/types'
import type { StatsDb } from './db'
import { SHOT_VIEWS } from './derived/events'
import { EXPECTED_SCALE, SHOT_PLAYER_GAME, SHOT_TEAM_GAME, zoneSql } from './derived/shots'
import { inspect } from './derived/sql'

/**
 * The shots a chart draws, beside the engine: a chart needs rows, not sums. A player's shots, a team's,
 * or the shots taken against a team, over the seasons and the games of a scope, read from `shot_nba`
 * and classified by the same rule as the shot tables, so the chart's zones and the zone metrics agree.
 * The zone counts come from the shot tables over the same games, every shot counted even when a large
 * scope draws only the newest `SHOT_CHART_LIMIT`.
 */

const ID = /^-?[0-9]{1,12}$/
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

const empty = (reason: string | null): StatsShotChart => ({
  shots: [],
  total: 0,
  made: 0,
  capped: false,
  zones: [],
  reason
})

/** A request the read can answer, checked before anything reaches SQL; null when it is not. */
function checked(r: StatsShotRequest): StatsShotRequest | null {
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
  if (r.side !== undefined && r.side !== 'offense' && r.side !== 'defense') return null
  return r
}

export async function readShotChart(db: StatsDb, raw: StatsShotRequest): Promise<StatsShotChart> {
  const r = checked(raw)
  if (!r) return empty(null)
  if (r.seasons.every((s) => s < SHOTS_FIRST_SEASON)) {
    return empty(`Recorded from ${seasonLabel(SHOTS_FIRST_SEASON)}.`)
  }
  const have = await inspect(db)
  const box = r.entity === 'player' ? 'player_game' : 'team_game'
  const built = r.entity === 'player' ? SHOT_PLAYER_GAME : SHOT_TEAM_GAME
  if (![box, built, SHOT_VIEWS.nba].every((t) => have.tables.has(t))) return empty(null)

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
  // The games in scope, as the engine reads them: the last N are the player's own appearances, or
  // their team's last N games, which they may have missed.
  let games: string
  if (s.lastN !== undefined && s.lastNOf === 'team' && r.entity === 'player') {
    games = `SELECT w.game_id, w.team_id FROM player_game w
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
    games = `SELECT w.game_id, w.team_id FROM ${box} w WHERE w.${key} = ${id} AND ${inScope} ${last}`
  }
  const defense = r.entity === 'team' && r.side === 'defense'
  const who =
    r.entity === 'player'
      ? `v.player_id = ${id}`
      : defense
        ? `v.opponent_id = ${id}`
        : `v.team_id = ${id}`
  const p = defense ? 'opp_' : ''
  const zoneKeys = SHOT_ZONES.map((z) => z.key)

  // One statement at a time: the reader's connection runs them in turn.
  const rows = await db.all<{
    x: number
    y: number
    made: boolean
    value: number | null
    zone: string
  }>(
    `WITH g AS (${games})
       SELECT v.x, v.y, coalesce(v.made, false) AS made, v.value, ${zoneSql('v.x', 'v.y', 'v.value')} AS zone
       FROM ${SHOT_VIEWS.nba} v SEMI JOIN g ON g.game_id = v.game_id
       WHERE ${who} AND v.season IN (${r.seasons.join(', ')})
       ORDER BY v.game_date DESC, v.game_id DESC, v.period DESC, v.clock ASC
       LIMIT ${SHOT_CHART_LIMIT}`,
    params
  )
  const sums = await db.get<Record<string, number | null>>(
    `WITH g AS (${games})
       SELECT ${zoneKeys
         .flatMap((z) => [
           `coalesce(sum(t.${p}${z}_fga), 0)::INTEGER AS ${z}_fga`,
           `coalesce(sum(t.${p}${z}_fgm), 0)::INTEGER AS ${z}_fgm`,
           `sum(t.${p}${z}_xfgm)::DOUBLE / ${EXPECTED_SCALE} AS ${z}_x`
         ])
         .join(', ')},
              coalesce(sum(t.${p}shots_fga), 0)::INTEGER AS total,
              coalesce(sum(t.${p}shots_fgm), 0)::INTEGER AS made
       FROM ${built} t SEMI JOIN g ON g.game_id = t.game_id
       WHERE t.${key} = ${id}`,
    params
  )
  const zones: StatsShotZone[] = zoneKeys.map((z) => ({
    zone: z,
    fga: Number(sums?.[`${z}_fga`] ?? 0),
    fgm: Number(sums?.[`${z}_fgm`] ?? 0),
    expected:
      sums?.[`${z}_x`] === null || sums?.[`${z}_x`] === undefined ? null : Number(sums[`${z}_x`])
  }))
  const total = Number(sums?.total ?? 0)
  return {
    shots: rows.map((s) => ({
      x: Number(s.x),
      y: Number(s.y),
      made: Boolean(s.made),
      value: s.value === null ? null : Number(s.value),
      zone: s.zone
    })),
    total,
    made: Number(sums?.made ?? 0),
    capped: total > SHOT_CHART_LIMIT,
    zones,
    reason: null
  }
}
