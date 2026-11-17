#!/usr/bin/env node
// Counts each source table of a loaded league against the raw files' own row counts: what every file
// of the registry holds, read with DuckDB straight from a folder of downloaded files, beside what the
// table holds and what the load recorded. Prints a Markdown table, one row per table.
// Build first with `npm run build`. The stats file is opened only through the built worker.
//
// usage: node scripts/check-source-rows.mjs <folder> <raw folder> [--league=wnba] [--through=2026]
//   <raw folder> holds one folder per release, as `~/.cache/metis-dev/wnba-raw` does.
//   --through  the last season the raw files were taken in (2026 by default)
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DuckDBInstance } from '@duckdb/node-api'
import ts from 'typescript'
import { leagueArg, openStatsWorker } from './lib/stats-worker.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const [folder, rawDir] = args.filter((a) => !a.startsWith('--')).map((p) => resolve(p))
const through = Number(args.find((a) => a.startsWith('--through='))?.split('=')[1] ?? 2026)
const league = leagueArg()
if (!folder || !rawDir) {
  console.error('usage: node scripts/check-source-rows.mjs <folder> <raw folder> [--league=wnba]')
  process.exit(2)
}

// The registry has no imports, so it can be read here without bundling.
const registry = ts.transpileModule(readFileSync(join(ROOT, 'src/main/stats/sources.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const { SOURCES_BY_LEAGUE, fileName, seasonsOf } = await import(
  `data:text/javascript,${encodeURIComponent(registry)}`
)
const sources = SOURCES_BY_LEAGUE[league]

const raw = await (await DuckDBInstance.create(':memory:')).connect()
const stats = openStatsWorker(folder, { league })
const num = (v) => (typeof v === 'bigint' ? Number(v) : v)

const byTable = new Map()
for (const source of sources) {
  const t = byTable.get(source.table) ?? { files: 0, missing: 0, raw: 0 }
  for (const season of seasonsOf(source, through)) {
    const path = join(rawDir, source.release, fileName(source, season))
    if (!existsSync(path)) {
      t.missing++
      continue
    }
    const rows = (await raw.runAndReadAll(`SELECT count(*) AS n FROM read_parquet('${path}')`))
      .getRowObjects()
      .map((r) => num(r.n))[0]
    t.files++
    t.raw += rows
  }
  byTable.set(source.table, t)
}

const recorded = new Map(
  (
    await stats.read(
      'SELECT source, sum(rows_written)::BIGINT AS rows, count(*)::INTEGER AS files FROM source_state GROUP BY source'
    )
  ).map((r) => [r.source, { rows: num(r.rows), files: num(r.files) }])
)
const lines = [
  '| Table | Files | Raw rows | Table rows | Recorded | Equal |',
  '| ----- | ----- | -------- | ---------- | -------- | ----- |'
]
let equal = 0
for (const [table, t] of [...byTable].sort()) {
  const exists = (
    await stats.read(
      `SELECT count(*)::INTEGER AS n FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = '${table}'`
    )
  )[0].n
  const rows = exists
    ? num((await stats.read(`SELECT count(*)::BIGINT AS n FROM ${table}`))[0].n)
    : null
  const ids = sources.filter((s) => s.table === table).map((s) => s.id)
  const rec = ids.reduce((sum, id) => sum + (recorded.get(id)?.rows ?? 0), 0)
  const ok = rows === t.raw && rec === t.raw
  if (ok) equal++
  const fmt = (n) => (n === null ? '–' : n.toLocaleString('en-US'))
  lines.push(
    `| \`${table}\` | ${t.files} | ${fmt(t.raw)} | ${fmt(rows)} | ${fmt(rec)} | ${ok ? 'yes' : '**no**'} |`
  )
}
await stats.close()
console.log(lines.join('\n'))
console.log(`\n${equal} of ${byTable.size} tables equal to their files.`)
