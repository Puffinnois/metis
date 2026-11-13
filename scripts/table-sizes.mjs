#!/usr/bin/env node
// Breaks a stats database down by table: rows, bytes on disk and bytes a row, from DuckDB's storage
// info. A block shared by several tables' small segments is split among them evenly, so the tables
// add up to the blocks in use. Build first.
//
// usage: node scripts/table-sizes.mjs <folder holding stats.duckdb> [table to break down by column]...
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const folder = resolve(process.argv[2] ?? '')
const byColumn = process.argv.slice(3)
if (!process.argv[2]) {
  console.error('usage: node scripts/table-sizes.mjs <folder> [table]...')
  process.exit(2)
}

const BLOCK = 262144
const { read, close } = openStatsWorker(folder)
const tables = await read(
  "SELECT table_name AS name FROM duckdb_tables() WHERE schema_name = 'main' ORDER BY table_name"
)
// Every block a table's segments sit in, with the column, so a block can be split among its users.
const uses = []
for (const { name } of tables) {
  const rows = await read(
    `SELECT column_name AS col, block_id AS b, additional_block_ids AS more
     FROM pragma_storage_info('${name}') WHERE persistent AND block_id >= 0`
  )
  for (const r of rows) {
    for (const b of [r.b, ...(r.more ?? [])]) uses.push({ table: name, col: r.col, b: Number(b) })
  }
}
const users = new Map()
for (const u of uses) {
  const set = users.get(u.b) ?? new Map()
  set.set(`${u.table}\u0000${u.col}`, (set.get(`${u.table}\u0000${u.col}`) ?? 0) + 1)
  users.set(u.b, set)
}
const tableBytes = new Map()
const colBytes = new Map()
for (const set of users.values()) {
  const total = [...set.values()].reduce((a, b) => a + b, 0)
  for (const [key, n] of set) {
    const table = key.split('\u0000')[0]
    const share = (BLOCK * n) / total
    tableBytes.set(table, (tableBytes.get(table) ?? 0) + share)
    if (byColumn.includes(table)) colBytes.set(key, (colBytes.get(key) ?? 0) + share)
  }
}
const counts = new Map()
for (const { name } of tables) {
  const [{ n }] = await read(`SELECT count(*)::BIGINT AS n FROM "${name}"`)
  counts.set(name, Number(n))
}
const [size] = await read('SELECT * FROM pragma_database_size()')
await close()

const gb = (b) => (b / 1e9).toFixed(3)
const all = [...tableBytes.values()].reduce((a, b) => a + b, 0)
console.log(
  `blocks in use ${size.used_blocks} (${gb(size.used_blocks * BLOCK)} GB), free ${size.free_blocks}`
)
console.log(`counted ${gb(all)} GB over ${tables.length} tables\n`)
console.log('| Table | Rows | MB | Bytes a row |')
console.log('| --- | --- | --- | --- |')
for (const [t, b] of [...tableBytes].sort((a, z) => z[1] - a[1])) {
  const n = counts.get(t) ?? 0
  console.log(
    `| ${t} | ${n.toLocaleString('en')} | ${(b / 1e6).toFixed(1)} | ${n ? (b / n).toFixed(1) : '-'} |`
  )
}
for (const table of byColumn) {
  const n = counts.get(table) ?? 0
  console.log(`\n${table}: by column\n\n| Column | MB | Bytes a row |\n| --- | --- | --- |`)
  for (const [key, b] of [...colBytes].sort((a, z) => z[1] - a[1])) {
    const [t, col] = key.split('\u0000')
    if (t === table) console.log(`| ${col} | ${(b / 1e6).toFixed(1)} | ${(b / n).toFixed(2)} |`)
  }
}
