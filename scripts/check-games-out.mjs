#!/usr/bin/env node
// Counts games out per season and season type through the engine and against the availability
// table's own sums (Plan T1206): every season the table has, old and current. Also gives the share of
// games out held by players with no box-score line, which the engine left out before T1206.
// Build first with `npm run build`.
//
// usage: node scripts/check-games-out.mjs <folder holding stats-<league>.duckdb>
// --league=<id> anywhere picks the league (default nba).
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const folder = process.argv[2]
if (!folder) {
  console.error('usage: node scripts/check-games-out.mjs <folder>')
  process.exit(2)
}
const { read, query, close } = openStatsWorker(resolve(folder))
const COUNTS = ['games_out_injury', 'games_out_other']

// The table's own sums, and the part held by players with no line in that season and type.
const table = await read(`
  SELECT a.season, a.game_type,
         sum(a.games_out_injury)::INTEGER AS injury, sum(a.games_out_other)::INTEGER AS other,
         count(*) FILTER (WHERE a.games_out_injury + a.games_out_other > 0)::INTEGER AS players,
         coalesce(sum(a.games_out_injury + a.games_out_other) FILTER (WHERE o.player_id IS NULL), 0)::INTEGER AS no_line_games,
         count(*) FILTER (WHERE o.player_id IS NULL AND a.games_out_injury + a.games_out_other > 0)::INTEGER AS no_line_players
  FROM pub_player_availability a
  LEFT JOIN player_season o ON o.player_id = a.player_id AND o.season = a.season
    AND o.game_type = a.game_type AND o.team_id IS NULL
  GROUP BY 1, 2 ORDER BY 1, 2 DESC`)
const current = Math.max(...table.map((r) => Number(r.season)))

const rows = []
for (const t of table) {
  const season = Number(t.season)
  const r = await query({
    entity: 'player',
    metrics: COUNTS,
    scope: { seasons: [season], gameTypes: [t.game_type] },
    sort: { metric: 'games_out_injury', dir: 'desc' },
    limit: 5000
  })
  const sum = (id) => r.rows.reduce((n, x) => n + (x.values[id].value ?? 0), 0)
  const listed = r.rows.filter((x) => COUNTS.some((id) => (x.values[id].value ?? 0) > 0))
  const noLine = r.rows.filter((x) => x.noLine)
  const all = t.injury + t.other
  rows.push({
    season,
    type: t.game_type,
    tableInjury: t.injury,
    engineInjury: sum('games_out_injury'),
    tableOther: t.other,
    engineOther: sum('games_out_other'),
    tablePlayers: t.players,
    enginePlayers: listed.length,
    noLinePlayers: noLine.length,
    tableNoLinePlayers: t.no_line_players,
    noLineGames: noLine.reduce(
      (n, x) => n + COUNTS.reduce((m, id) => m + (x.values[id].value ?? 0), 0),
      0
    ),
    missingBefore: all ? Number(((100 * t.no_line_games) / all).toFixed(1)) : 0,
    ranked: noLine.filter((x) =>
      COUNTS.some((id) => x.values[id].rank !== null || x.values[id].qualified)
    ).length,
    unnamed: noLine.filter((x) => x.name === x.id).length,
    noTeam: noLine.filter((x) => x.team === null).length,
    noPosition: noLine.filter((x) => x.position === null).length,
    ms: r.ms
  })
}
console.table(rows)
const off = rows.filter(
  (r) =>
    r.tableInjury !== r.engineInjury ||
    r.tableOther !== r.engineOther ||
    r.tablePlayers !== r.enginePlayers ||
    r.noLinePlayers !== r.tableNoLinePlayers
)
console.log(`seasons and types: ${rows.length}, current season ${current}, off: ${off.length}`)
for (const type of ['regular', 'playoffs']) {
  const of = rows.filter((r) => r.type === type)
  const games = of.reduce((n, r) => n + r.tableInjury + r.tableOther, 0)
  const missing = of.reduce((n, r) => n + r.noLineGames, 0)
  console.log(
    `${type}: ${games} games out, ${missing} held by players with no line (${((100 * missing) / games).toFixed(1)} %)`
  )
}
console.log(`no-line rows ranked or qualified: ${rows.reduce((n, r) => n + r.ranked, 0)}`)
await close()
