#!/usr/bin/env node
// Runs SQL against a loaded stats database, for measuring and checking a real load.
//
// usage: node scripts/stats-sql.mjs <folder holding stats.duckdb> <file of statements>
// Statements are separated by a line holding only `;`. Each result prints as one JSON row a line.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openStatsWorker } from './lib/stats-worker.mjs'

const [folder, sqlFile] = process.argv.slice(2).map((p) => resolve(p))
if (!folder || !sqlFile) {
  console.error('usage: node scripts/stats-sql.mjs <folder> <file of statements>')
  process.exit(2)
}

const { read, close } = openStatsWorker(folder)
const statements = readFileSync(sqlFile, 'utf8')
  .split(/^;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean)
for (const sql of statements) {
  console.log(`\n-- ${sql.split('\n')[0].slice(0, 110)}`)
  const at = Date.now()
  try {
    const rows = await read(sql)
    for (const row of rows) console.log(JSON.stringify(row))
    console.log(`(${rows.length} rows, ${Date.now() - at} ms)`)
  } catch (err) {
    console.log(`ERROR ${err.message.slice(0, 400)}`)
  }
}
await close()
