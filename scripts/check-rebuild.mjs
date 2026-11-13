#!/usr/bin/env node
// Checks that two builds of the same code and data give the same tables: the identity tables, the
// game and season tables and every table built from the plays, compared row by row, per season,
// between two profiles. A difference means a build depends on row order (a tie in an ORDER BY, a
// window without a full key, a join that can match twice), as the link of ESPN's duplicated 1998-99
// and 1999-00 games did. Doubles are compared to the fourth decimal, since a sum's last bits depend on
// the order DuckDB adds in.
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
  'play_team_game'
]

const { read, close } = openStatsWorker(a)
await read(`ATTACH '${join(b, 'stats.duckdb').replaceAll("'", "''")}' AS other (READ_ONLY)`)

const out = [
  '# Two builds compared',
  '',
  `\`${a}\` against \`${b}\`: rows in one and not the other (as multisets), per table and season. 0 everywhere is the check.`,
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
  const list = cols
    .map((c) =>
      c.data_type === 'DOUBLE' || c.data_type === 'FLOAT'
        ? `round(${c.column_name}, 4) AS ${c.column_name}`
        : c.column_name
    )
    .join(', ')
  const bySeason = cols.some((c) => c.column_name === 'season')
  const key = bySeason ? 'season' : "'all' AS season"
  const diff = await read(`
    WITH x AS (SELECT ${list} FROM main.${t}), y AS (SELECT ${list} FROM other.main.${t}),
    only_a AS (SELECT * FROM x EXCEPT ALL SELECT * FROM y),
    only_b AS (SELECT * FROM y EXCEPT ALL SELECT * FROM x)
    SELECT season, sum(a)::INTEGER AS a, sum(b)::INTEGER AS b FROM (
      SELECT ${key}, 1 AS a, 0 AS b FROM only_a UNION ALL SELECT ${key}, 0, 1 FROM only_b)
    GROUP BY season ORDER BY season`)
  const total = await read(`SELECT count(*)::BIGINT AS n FROM main.${t}`)
  if (diff.length === 0) rows.push([t, 'all', '0', '0', String(total[0].n)])
  for (const d of diff) rows.push([t, String(d.season), String(d.a), String(d.b), ''])
}
await close()

out.push('| Table | Season | Only in A | Only in B | Rows |', '| --- | --- | ---: | ---: | ---: |')
for (const r of rows) out.push(`| ${r.join(' | ')} |`)
const text = out.join('\n')
console.log(text)
if (mdFile) writeFileSync(mdFile, `${text}\n`)
const differs = rows.some((r) => r[2] !== '0' || r[3] !== '0')
process.exit(differs ? 1 : 0)
