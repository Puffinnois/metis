#!/usr/bin/env node
// Runs a real refresh in the built stats worker, under plain Node, and measures it: time, download
// size, database size and peak memory per load tier, and how fast a query answers during the load.
// Build first with `npm run build`. Point it at a scratch folder, never at the app's own data.
//
// usage: node scripts/load-report.mjs <folder> <report.json> [--stop-after=<steps>] [--force]
//   --stop-after  closes the worker after that many steps, as a quit does
//   --force       checks recent seasons even if tried within the day
//   --memory      DuckDB's memory limit, to measure another setting than the app's (--memory=1GB)
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const [folder, reportFile] = args.filter((a) => !a.startsWith('--')).map((p) => resolve(p))
const stopAfter = Number(args.find((a) => a.startsWith('--stop-after='))?.split('=')[1] ?? Infinity)
const force = args.includes('--force')
const memoryLimit = args.find((a) => a.startsWith('--memory='))?.split('=')[1]
if (!folder || !reportFile) {
  console.error('usage: node scripts/load-report.mjs <folder> <report.json> [--stop-after=n]')
  process.exit(2)
}
mkdirSync(folder, { recursive: true })

// The registry has no imports, so it can be read here without bundling.
const registry = ts.transpileModule(readFileSync(join(ROOT, 'src/main/stats/sources.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const { SOURCES, LOAD_TIERS } = await import(`data:text/javascript,${encodeURIComponent(registry)}`)
const tierOf = new Map(SOURCES.map((s) => [s.id, s.tier]))

const dbPath = join(folder, 'stats.duckdb')
const fileSize = () => {
  let bytes = 0
  for (const path of [dbPath, `${dbPath}.wal`]) {
    try {
      bytes += statSync(path).size
    } catch {
      // not written yet
    }
  }
  return bytes
}
const MB = 1024 * 1024
const round = (x, places = 1) => Number(x.toFixed(places))

const worker = new Worker(join(ROOT, 'out/main/statsWorker.js'), {
  workerData: { path: dbPath, tempDir: join(folder, 'tmp'), memoryLimit }
})
const pending = new Map()
let nextId = 1
const request = (make) =>
  new Promise((res, rej) => {
    const id = nextId++
    pending.set(id, { res, rej })
    worker.postMessage(make(id))
  })
const read = (sql) => request((id) => ({ id, kind: 'read', sql }))

const started = Date.now()
const tiers = Object.fromEntries(
  LOAD_TIERS.map((t) => [t, { steps: 0, rows: 0, firstMs: null, lastMs: null, dbMbAtEnd: null }])
)
const statuses = {}
const problems = []
const notes = []
let peakRss = 0
const peakByTier = Object.fromEntries(LOAD_TIERS.map((t) => [t, 0]))
let currentTier = LOAD_TIERS[0]
let stepCount = 0
let unchanged = 0
let closing = false
let close = () => {}
const finishedClosing = new Promise((res) => (close = res))

const sampler = setInterval(() => {
  const rss = process.memoryUsage().rss
  peakRss = Math.max(peakRss, rss)
  peakByTier[currentTier] = Math.max(peakByTier[currentTier], rss)
}, 250)

worker.on('message', (reply) => {
  if (reply.kind === 'fatal') {
    console.error('fatal:', reply.error)
    process.exit(1)
  }
  if (reply.kind === 'step') {
    const { source, status, message, rowsWritten } = reply.entry
    const id = source.slice('stats:'.length).split(':')[0]
    const tier = tierOf.get(id)
    stepCount++
    statuses[status] = (statuses[status] ?? 0) + 1
    if (status === 'error') problems.push({ source, message })
    else if (message === 'unchanged') unchanged++
    else if (message && status === 'ok') notes.push({ source, message })
    if (tier) {
      currentTier = tier
      const t = tiers[tier]
      t.steps++
      t.rows += rowsWritten
      const now = Date.now() - started
      t.firstMs ??= now
      t.lastMs = now
      t.dbMbAtEnd = round(fileSize() / MB)
    }
    if (stepCount % 100 === 0) {
      console.log(
        `${stepCount} steps, ${round((Date.now() - started) / 60000)} min, tier ${currentTier}, ` +
          `db ${round(fileSize() / MB)} MB, rss ${round(process.memoryUsage().rss / MB)} MB`
      )
    }
    if (stepCount >= stopAfter && !closing) {
      closing = true
      close()
    }
    return
  }
  const p = pending.get(reply.id)
  if (!p) return
  pending.delete(reply.id)
  if (reply.ok) p.res(reply.result)
  else p.rej(new Error(reply.error))
})

// What a leaderboard will ask of the worker, every 30 seconds while the load runs.
const LEADERBOARD = `SELECT athlete_id, sum(points) AS pts, sum(rebounds) AS reb, sum(assists) AS ast, count(*) AS games
  FROM src_espn_player_box WHERE season = 2026 AND season_type = 2
  GROUP BY athlete_id ORDER BY pts DESC LIMIT 25`
const probes = []
const probe = async () => {
  const at = Date.now()
  try {
    await read(LEADERBOARD)
    probes.push({ tier: currentTier, ms: Date.now() - at })
  } catch (err) {
    if (!/does not exist/.test(String(err))) probes.push({ tier: currentTier, error: String(err) })
  }
}
const prober = setInterval(() => void probe(), 30_000)

const refreshing = request((id) => ({ id, kind: 'refresh', options: { force } }))
const done = await Promise.race([
  refreshing.then((result) => ({ finished: true, result })),
  finishedClosing.then(() => ({ finished: false }))
])
clearInterval(prober)

// Size by tier, from what each file weighed when it was downloaded.
// A database DuckDB has invalidated answers nothing more; the report says so.
const fatal = done.result?.fatal ?? null
const held = fatal ? [] : await read('SELECT source, season, bytes, rows_written FROM source_state')
const downloadByTier = Object.fromEntries(LOAD_TIERS.map((t) => [t, 0]))
for (const row of held) {
  const tier = tierOf.get(row.source)
  if (tier) downloadByTier[tier] += row.bytes ?? 0
}
const tables = fatal
  ? []
  : await read(
      `SELECT table_name, estimated_size AS rows, column_count AS columns FROM duckdb_tables()
   WHERE schema_name = 'main' ORDER BY estimated_size DESC LIMIT 12`
    )

await request((id) => ({ id, kind: 'close' })).catch(() => undefined)
clearInterval(sampler)
await worker.terminate()

const latencies = (tier) =>
  probes
    .filter((p) => p.tier === tier && p.ms !== undefined)
    .map((p) => p.ms)
    .sort((a, b) => a - b)
const report = {
  finished: done.finished,
  fatal,
  memoryLimit: memoryLimit ?? 'default',
  minutes: round((Date.now() - started) / 60000),
  steps: stepCount,
  statuses,
  unchanged,
  databaseMb: round(fileSize() / MB),
  peakRssMb: round(peakRss / MB),
  tiers: Object.fromEntries(
    LOAD_TIERS.map((t) => [
      t,
      {
        ...tiers[t],
        minutes:
          tiers[t].firstMs === null ? 0 : round((tiers[t].lastMs - tiers[t].firstMs) / 60000),
        downloadMb: round(downloadByTier[t] / MB),
        peakRssMb: round(peakByTier[t] / MB),
        queryMs: latencies(t).length
          ? {
              median: latencies(t)[latencies(t).length >> 1],
              max: latencies(t).at(-1),
              n: latencies(t).length
            }
          : null
      }
    ])
  ),
  problems: problems.slice(0, 50),
  problemCount: problems.length,
  notes: notes.slice(0, 80),
  noteCount: notes.length,
  probeErrors: probes.filter((p) => p.error).slice(0, 5),
  largestTables: tables
}
writeFileSync(reportFile, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ ...report, notes: undefined, largestTables: undefined }, null, 2))
