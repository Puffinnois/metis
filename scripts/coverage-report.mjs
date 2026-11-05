#!/usr/bin/env node
// Measures which seasons really hold values, column by column, in a loaded stats database: a file can
// exist with rows for a season before the stat was tracked. A number holds a value when it is neither
// null nor zero, and text when it is neither null nor empty. Writes the column-level list and a table
// of what it found by source table. Later stages read each metric's first season from here.
//
// usage: node scripts/coverage-report.mjs <folder holding stats.duckdb> <out.tsv> <out.md>
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, tsvFile, mdFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder || !tsvFile || !mdFile) {
  console.error('usage: node scripts/coverage-report.mjs <folder> <out.tsv> <out.md>')
  process.exit(2)
}

// Columns the load adds, and those every row has whatever the season holds.
const BOOKKEEPING = new Set(['season', 'file_season', 'source_file', 'season_type'])
// Who and how much, not what was measured: a row before a stat was tracked still has these.
const IDENTITY =
  /(_id|_name|_slug|_abbreviation|_tricode)$|^(name|nickname|age|gp|g|w|l|w_pct|min|id_source|player_name|team_name)$/
/** A column holds values in a season when at least this share of its rows do. */
const HOLDS = 0.01

const ident = (name) => `"${name.replaceAll('"', '""')}"`
const label = (season) => `${season - 1}-${String(season % 100).padStart(2, '0')}`

function holdsValue(name, type) {
  const c = ident(name)
  if (/INT|FLOAT|DOUBLE|DECIMAL/.test(type)) return `${c} IS NOT NULL AND ${c} <> 0`
  if (type === 'VARCHAR') return `${c} IS NOT NULL AND ${c} <> ''`
  return `${c} IS NOT NULL`
}

const { read, close } = openStatsWorker(folder)
const columns = await read(
  `SELECT table_name, column_name, data_type FROM duckdb_columns()
   WHERE schema_name = 'main' AND NOT internal AND table_name LIKE 'src_%'
   ORDER BY table_name, column_index`
)
const byTable = new Map()
for (const c of columns) {
  byTable.set(c.table_name, [...(byTable.get(c.table_name) ?? []), c])
}

const tsv = ['table\tcolumn\ttype\tfirst_season\tlast_season\tseasons_with_values']
const summary = []
for (const [table, cols] of byTable) {
  const hasSeason = cols.some((c) => c.column_name === 'season')
  if (!hasSeason) {
    const [{ rows }] = await read(`SELECT count(*) AS rows FROM ${ident(table)}`)
    summary.push({ table, rows, columns: cols.length, first: null, full: null, last: null })
    continue
  }
  const measured = cols.filter((c) => !BOOKKEEPING.has(c.column_name))
  const select = measured
    .map((c, i) => `count(*) FILTER (${holdsValue(c.column_name, c.data_type)}) AS c${i}`)
    .join(', ')
  const perSeason = await read(
    `SELECT season, count(*) AS rows${select ? `, ${select}` : ''} FROM ${ident(table)}
     WHERE season IS NOT NULL GROUP BY season ORDER BY season`
  )
  const seasonsOf = measured.map((_, i) =>
    perSeason.filter((row) => row[`c${i}`] / row.rows >= HOLDS).map((row) => row.season)
  )
  measured.forEach((c, i) => {
    const held = seasonsOf[i]
    tsv.push(
      [table, c.column_name, c.data_type, held[0] ?? '', held.at(-1) ?? '', held.length].join('\t')
    )
  })
  const everHeld = seasonsOf.filter((held) => held.length > 0).length
  const stats = seasonsOf.filter((_, i) => !IDENTITY.test(measured[i].column_name))
  const statsEverHeld = stats.filter((held) => held.length > 0).length
  // The first season holding at least half of the stat columns that ever hold anything.
  const full = perSeason.find((row) => {
    const here = stats.filter((held) => held.includes(row.season)).length
    return here >= statsEverHeld / 2
  })
  summary.push({
    table,
    rows: perSeason.reduce((sum, row) => sum + row.rows, 0),
    columns: cols.length,
    empty: measured.length - everHeld,
    first: perSeason[0]?.season ?? null,
    full: full?.season ?? null,
    last: perSeason.at(-1)?.season ?? null,
    lateColumns: stats.filter((held) => held[0] > (full?.season ?? Infinity)).length
  })
  console.log(`${table}: ${perSeason.length} seasons, ${measured.length} columns`)
}
await close()

writeFileSync(tsvFile, `${tsv.join('\n')}\n`)
const COUNT = new Intl.NumberFormat('en-US')
const md = [
  '# NBA coverage: what each table really holds',
  '',
  `Written by \`scripts/coverage-report.mjs\` from a real load. Column by column, in \`nba-coverage.tsv\`: a column holds values in a season when at least ${HOLDS * 100} % of its rows hold a value that is not null, zero or empty.`,
  '',
  '- **From:** the first season with rows.',
  '- **Holds values from:** the first season where at least half of the stat columns that ever hold anything do. Names, ids, games and minutes are not stat columns: rows before this season may have those and little else.',
  '- **Empty:** columns that never hold a value in any season.',
  '- **Later:** columns that only start holding values after that season.',
  '',
  '| Table | Rows | Columns | From | Holds values from | To | Empty | Later |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...summary.map(
    (s) =>
      `| \`${s.table}\` | ${COUNT.format(s.rows)} | ${s.columns} | ${s.first ? label(s.first) : '–'} | ${s.full ? label(s.full) : '–'} | ${s.last ? label(s.last) : '–'} | ${s.empty ?? '–'} | ${s.lateColumns ?? '–'} |`
  ),
  ''
]
writeFileSync(mdFile, md.join('\n'))
console.log(`${summary.length} tables, ${tsv.length - 1} columns`)
