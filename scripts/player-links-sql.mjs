#!/usr/bin/env node
// Runs the player-link research queries (docs/reference/player-links.md) against four loaded
// stats files at once, each attached read-only to one in-memory DuckDB, so a query can join a
// college file with a professional one. Nothing is written to the files: the stats worker is
// not used, because it bootstraps tables when it opens a file.
//
// usage: node scripts/player-links-sql.mjs <file of statements> [--json]
// The files: METIS_PRO=<folder with stats-nba.duckdb and stats-wnba.duckdb>,
// METIS_NCAAM=<folder with stats-ncaam.duckdb>, METIS_NCAAW=<folder with stats-ncaaw.duckdb>.
// They default to the clean loads of Stage 13 under ~/.cache/metis-dev.
// Attached as `nba`, `wnba`, `ncaam`, `ncaaw`. A file that is missing is skipped.
// Statements are separated by a line holding only `;`.
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'

const args = process.argv.slice(2)
const json = args.includes('--json')
const sqlFile = args.find((a) => !a.startsWith('--'))
if (!sqlFile) {
  console.error('usage: node scripts/player-links-sql.mjs <file of statements> [--json]')
  process.exit(2)
}

const cache = join(homedir(), '.cache', 'metis-dev')
const pro = process.env.METIS_PRO ?? join(cache, 'gate13')
const files = {
  nba: join(pro, 'stats-nba.duckdb'),
  wnba: join(pro, 'stats-wnba.duckdb'),
  ncaam: join(process.env.METIS_NCAAM ?? join(cache, 'gate-ncaam-full'), 'stats-ncaam.duckdb'),
  ncaaw: join(process.env.METIS_NCAAW ?? join(cache, 'gate-ncaaw-full'), 'stats-ncaaw.duckdb')
}

const db = await DuckDBInstance.create(':memory:', { threads: '4', memory_limit: '3GB' })
const con = await db.connect()
for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path)) {
    console.log(`-- ${name}: ${path} missing, not attached`)
    continue
  }
  await con.run(`ATTACH '${path}' AS ${name} (READ_ONLY)`)
}

const show = (v) => (typeof v === 'bigint' ? Number(v) : v)
const statements = readFileSync(resolve(sqlFile), 'utf8')
  .split(/^;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean)
for (const sql of statements) {
  const title = sql.split('\n').find((l) => l.startsWith('--')) ?? sql.split('\n')[0]
  console.log(`\n${title.slice(0, 140)}`)
  const at = Date.now()
  try {
    const reader = await con.runAndReadAll(sql)
    const cols = reader.columnNames()
    const rows = reader.getRowsJS().map((r) => r.map(show))
    if (json) for (const r of rows) console.log(JSON.stringify(Object.fromEntries(cols.map((c, i) => [c, r[i]]))))
    else {
      const cells = [cols, ...rows.map((r) => r.map((v) => (v === null ? '∅' : String(v))))]
      const widths = cols.map((_, i) => Math.min(40, Math.max(...cells.map((r) => r[i].length))))
      for (const r of cells) console.log(r.map((v, i) => v.slice(0, 40).padEnd(widths[i])).join(' | '))
    }
    console.log(`(${rows.length} rows, ${Date.now() - at} ms)`)
  } catch (err) {
    console.log(`ERROR ${err.message.slice(0, 600)}`)
  }
}
con.closeSync()
