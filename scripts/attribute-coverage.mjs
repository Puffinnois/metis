#!/usr/bin/env node
// Measures the attribute tables (D51) on a loaded league: for each column, the share of the rows a
// board lists that hold a value, season by season. Players: each player with a counted game in the
// season (a college player of a Division I team); teams: each team with a season line (Division I in
// the colleges). Build first; the worker opens the file, so use a copy, never the app's profile.
//
// usage: node scripts/attribute-coverage.mjs <folder holding stats-<league>.duckdb> [--league=<id>]
//        [--seasons=1994,2004,2026]   (the columns printed; every season when not given)
import { resolve } from 'node:path'
import { leagueArg, openStatsWorker, positional } from './lib/stats-worker.mjs'

const folder = resolve(positional()[0] ?? '')
if (!positional()[0]) {
  console.error('usage: node scripts/attribute-coverage.mjs <folder> [--league=<id>] [--seasons=…]')
  process.exit(2)
}
const league = leagueArg()
const only = process.argv
  .find((a) => a.startsWith('--seasons='))
  ?.slice('--seasons='.length)
  .split(',')
  .map(Number)

const w = openStatsWorker(folder, { league })
try {
  const columns = await w.read(
    `SELECT table_name AS t, column_name AS c FROM duckdb_columns()
     WHERE schema_name = 'main'
       AND table_name IN ('player_attributes', 'player_season_attributes', 'team_attributes')
       AND column_name NOT IN ('player_id', 'team_id', 'season', 'name')
     ORDER BY table_name, column_index`
  )
  const divisionI = (
    await w.read(
      `SELECT count(*) AS n FROM duckdb_columns() WHERE table_name = 'team' AND column_name = 'division_i'`
    )
  )[0].n
  const college = Number(divisionI) > 0
  const of = (t) => columns.filter((x) => x.t === t).map((x) => x.c)
  const pct = (c, alias) =>
    `round(100.0 * count(${alias}.${c}) / count(*))::INTEGER AS "${alias}.${c}"`
  const players = await w.read(
    `WITH rows AS (
       SELECT DISTINCT ps.player_id, ps.season FROM player_season ps
       WHERE ps.team_id IS NULL AND ps.game_type NOT IN ('preseason', 'all-star')
       ${college ? 'AND EXISTS (SELECT 1 FROM team t WHERE t.team_id = ps.last_team_id AND t.season = ps.season AND t.division_i)' : ''}
     )
     SELECT r.season, count(*) AS n,
            ${[...of('player_attributes').map((c) => pct(c, 'a')), ...of('player_season_attributes').map((c) => pct(c, 's'))].join(', ')}
     FROM rows r JOIN player_attributes a ON a.player_id = r.player_id
     LEFT JOIN player_season_attributes s ON s.player_id = r.player_id AND s.season = r.season
     GROUP BY 1 ORDER BY 1`
  )
  const teams = await w.read(
    `SELECT t.season, count(*) AS n, ${of('team_attributes')
      .map((c) => pct(c, 't'))
      .join(', ')}
     FROM team_attributes t
     WHERE EXISTS (SELECT 1 FROM team_season s WHERE s.team_id = t.team_id AND s.season = t.season)
     ${college ? 'AND t.division_i' : ''}
     GROUP BY 1 ORDER BY 1`
  )
  const print = (title, rows) => {
    const shown = rows.filter((r) => !only || only.includes(Number(r.season)))
    const keys = Object.keys(rows[0] ?? {}).filter((k) => k !== 'season')
    console.log(`\n${title}\n`)
    console.log(`| Column | ${shown.map((r) => r.season).join(' | ')} |`)
    console.log(`| --- | ${shown.map(() => '---').join(' | ')} |`)
    for (const k of keys) {
      console.log(`| ${k === 'n' ? 'rows' : k} | ${shown.map((r) => r[k]).join(' | ')} |`)
    }
  }
  print(`${league}: players, % of rows with a value (a. who they are, s. that season)`, players)
  print(`${league}: teams, % of team seasons with a value`, teams)
} finally {
  await w.close()
}
