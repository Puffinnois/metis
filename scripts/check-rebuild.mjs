#!/usr/bin/env node
// Checks that two builds of the same code and data give the same tables: the identity tables, the
// game and season tables, every table built from the plays and the models, compared row by row, per season,
// between two profiles. A difference means a build depends on row order (a tie in an ORDER BY, a
// window without a full key, a join that can match twice), as the link of ESPN's duplicated 1998-99
// and 1999-00 games did. Every column but the doubles is compared row by row; each double by its sum
// per season, within a millionth, since a double's last bits depend on the order DuckDB adds in.
//
// usage: node scripts/check-rebuild.mjs <folder A> <folder B> [out.md]
// Build first with `npm run build`. B is attached read-only; neither may be open in the app.
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [a, b, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!a || !b) {
  console.error('usage: node scripts/check-rebuild.mjs <folder A> <folder B> [out.md]')
  process.exit(2)
}

const TABLES = [
  'team',
  'game',
  'player',
  'player_ids',
  'player_game',
  'team_game',
  'player_season',
  'team_season',
  'play_nba',
  'play_espn',
  'shot_player_game',
  'shot_team_game',
  'split_player',
  'split_team',
  'unit_game',
  'player_on_court',
  'play_player_game',
  'play_team_game',
  // The models (Stage 10): computed from the tables above, the simulation seeded, so equal too.
  'team_strength',
  'player_composite',
  'team_composite',
  'elo_game',
  'elo_wins',
  'elo_schedule',
  'adjusted_rating',
  'team_forecast',
  'metric_stability'
]

const { read, close } = openStatsWorker(a)
await read(`ATTACH '${join(b, 'stats.duckdb').replaceAll("'", "''")}' AS other (READ_ONLY)`)

const out = [
  '# Two builds compared',
  '',
  `\`${a}\` against \`${b}\`: rows in one and not the other (as multisets, doubles left out), and doubles whose sum per season differs by more than a millionth, per table and season. 0 and none everywhere is the check.`,
  ''
]
const rows = []
for (const t of TABLES) {
  const cols = await read(`SELECT column_name, data_type FROM duckdb_columns()
    WHERE database_name = 'stats' AND schema_name = 'main' AND table_name = '${t}' ORDER BY column_index`)
  const theirs = await read(`SELECT column_name, data_type FROM duckdb_columns()
    WHERE database_name = 'other' AND schema_name = 'main' AND table_name = '${t}' ORDER BY column_index`)
  if (cols.length === 0 || theirs.length === 0) {
    rows.push([t, '–', cols.length === 0 ? 'not in A' : 'not in B', '', ''])
    continue
  }
  const shape = (cs) => cs.map((c) => `${c.column_name} ${c.data_type}`).join(', ')
  if (shape(cols) !== shape(theirs)) {
    rows.push([t, '–', 'columns differ', '', ''])
    continue
  }
  // Every column but the doubles row by row; each double by its sum per season, within a millionth.
  const isDouble = (c) => c.data_type === 'DOUBLE' || c.data_type === 'FLOAT'
  const exact = cols.filter((c) => !isDouble(c)).map((c) => c.column_name)
  const doubles = cols.filter(isDouble).map((c) => c.column_name)
  const bySeason = cols.some((c) => c.column_name === 'season')
  const key = bySeason ? 'season' : "'all' AS season"
  const list = exact.join(', ')
  const diff = await read(`
    WITH x AS (SELECT ${list} FROM main.${t}), y AS (SELECT ${list} FROM other.main.${t}),
    only_a AS (SELECT * FROM x EXCEPT ALL SELECT * FROM y),
    only_b AS (SELECT * FROM y EXCEPT ALL SELECT * FROM x)
    SELECT season, sum(a)::INTEGER AS a, sum(b)::INTEGER AS b FROM (
      SELECT ${key}, 1 AS a, 0 AS b FROM only_a UNION ALL SELECT ${key}, 0, 1 FROM only_b)
    GROUP BY season ORDER BY season`)
  const sums = (db) =>
    `SELECT ${key}, ${doubles.map((d) => `sum(${d}) AS ${d}`).join(', ')} FROM ${db}.main.${t} GROUP BY 1`
  const off =
    doubles.length === 0
      ? []
      : await read(`
    SELECT x.season, list(name) AS names FROM (
      SELECT x.season, unnest([${doubles
        .map(
          (d) =>
            `CASE WHEN abs(coalesce(x.${d}, 0) - coalesce(y.${d}, 0))
                         > 1e-6 * greatest(1, abs(coalesce(x.${d}, 0))) THEN '${d}' END`
        )
        .join(', ')}]) AS name
      FROM (${sums('stats')}) x FULL JOIN (${sums('other')}) y USING (season)) x
    WHERE name IS NOT NULL GROUP BY 1 ORDER BY 1`)
  const total = await read(`SELECT count(*)::BIGINT AS n FROM main.${t}`)
  if (diff.length === 0 && off.length === 0) rows.push([t, 'all', '0', '0', '', String(total[0].n)])
  const seasons = [...new Set([...diff.map((d) => d.season), ...off.map((d) => d.season)])].sort()
  for (const s of seasons) {
    const d = diff.find((x) => x.season === s)
    const o = off.find((x) => x.season === s)
    rows.push([t, String(s), String(d?.a ?? 0), String(d?.b ?? 0), o ? o.names.join(' ') : '', ''])
  }
}
await close()

out.push(
  '| Table | Season | Only in A | Only in B | Doubles whose sum differs | Rows |',
  '| --- | --- | ---: | ---: | --- | ---: |'
)
for (const r of rows) out.push(`| ${r.join(' | ')} |`)
const text = out.join('\n')
console.log(text)
if (mdFile) writeFileSync(mdFile, `${text}\n`)
const differs = rows.some((r) => r[2] !== '0' || r[3] !== '0' || r[4] !== '')
process.exitCode = differs ? 1 : 0
