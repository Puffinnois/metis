#!/usr/bin/env node
// Runs T1304.2's links step on a real profile through the built workers, as the app's main process
// does after a league's refresh (`src/main/stats/links/control.ts`), and measures it: the paired
// downloads, each hand-over, the links by method, the links worker's memory and a player's read.
// Every league worker opens only its own file and the links worker only `links.duckdb` (D47).
// Build first with `npm run build`.
//
// usage: node scripts/check-links.mjs <profile> --out=<dir> [--order=nba,ncaam,wnba,ncaaw]
//   [--force] (fetches the paired files again even if tried within the day)
//   [--reads=<league>:<player>,...] (times the other-career read of each)
// Writes <out>/links-<label>.json, where --label= names the run (default "run").
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAIRS = { nba: 'ncaam', ncaam: 'nba', wnba: 'ncaaw', ncaaw: 'wnba' }
const COLLEGE = { nba: 'ncaam', ncaam: 'ncaam', wnba: 'ncaaw', ncaaw: 'ncaaw' }
const PRO = { nba: 'nba', ncaam: 'nba', wnba: 'wnba', ncaaw: 'wnba' }

const args = process.argv.slice(2)
const opt = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const profile = resolve(args.find((a) => !a.startsWith('--')) ?? '')
const out = resolve(opt('out', join(profile, 'check-links')))
const label = opt('label', 'run')
const order = opt('order', 'nba,ncaam,wnba,ncaaw').split(',').filter(Boolean)
const force = args.includes('--force')
const reads = opt('reads', '')
  .split(',')
  .filter(Boolean)
  .map((r) => r.split(':'))
mkdirSync(out, { recursive: true })

function start(file, workerData) {
  const worker = new Worker(join(ROOT, 'out/main', file), { workerData })
  const pending = new Map()
  let nextId = 1
  let fatal = null
  worker.on('message', (reply) => {
    if (reply.kind === 'step') return
    if (reply.kind === 'fatal') {
      fatal = reply.error
      for (const p of pending.values()) p.rej(new Error(reply.error))
      return
    }
    const p = pending.get(reply.id)
    if (!p) return
    pending.delete(reply.id)
    if (reply.ok) p.res(reply.result)
    else p.rej(new Error(reply.error))
  })
  const call = (kind, body = {}) =>
    fatal
      ? Promise.reject(new Error(fatal))
      : new Promise((res, rej) => {
          const id = nextId++
          pending.set(id, { res, rej })
          worker.postMessage({ id, kind, ...body })
        })
  return {
    call,
    close: async () => {
      await call('close').catch(() => undefined)
      await worker.terminate()
    }
  }
}

const timed = async (fn) => {
  const at = performance.now()
  const result = await fn()
  return { result, ms: Math.round(performance.now() - at) }
}

const leagues = {}
for (const league of Object.keys(PAIRS)) {
  if (!existsSync(join(profile, `stats-${league}.duckdb`))) continue
  leagues[league] = start('statsWorker.js', {
    league,
    dataDir: profile,
    tempDir: join(profile, 'stats-tmp', league)
  })
}
const tempDir = join(profile, 'stats-tmp', 'links')
const handover = join(tempDir, 'handover')
const opened = await timed(async () => {
  const links = start('linksWorker.js', { dataDir: profile, tempDir })
  await links.call('ping')
  return links
})
const links = opened.result

// The links worker's DuckDB memory, sampled every 100 ms while the steps run (reads run at once).
const memory = async () =>
  Number(
    (
      await links.call('read', { sql: 'SELECT sum(memory_usage_bytes) AS b FROM duckdb_memory()' })
    )[0].b
  )
let peak = 0
let sampling = true
const sampler = (async () => {
  while (sampling) {
    peak = Math.max(peak, await memory().catch(() => 0))
    await new Promise((r) => setTimeout(r, 100))
  }
})()
const report = {
  profile,
  label,
  at: new Date().toISOString(),
  leagues: Object.keys(leagues),
  openMs: opened.ms,
  idleBytesAtOpen: await memory(),
  steps: []
}

for (const league of order) {
  const own = leagues[league]
  if (!own) continue
  const tag = `${label}-${league}`
  const step = { league }
  const paired = await timed(() => links.call('refreshPaired', { league, options: { force } }))
  step.paired = {
    ms: paired.ms,
    files: paired.result.length,
    loaded: paired.result.filter((s) => s.status === 'ok' && s.rowsWritten > 0).length,
    unchanged: paired.result.filter((s) => s.message === 'unchanged').length,
    errors: paired.result
      .filter((s) => s.status === 'error')
      .map((s) => `${s.source}: ${s.message}`)
  }
  const side = await timed(() => own.call('linkSide', { dir: handover, tag }))
  step.sideMs = side.ms
  if (side.result) {
    const ingest = await timed(() => links.call('ingestSide', { files: side.result }))
    step.ingestMs = ingest.ms
    step.links = ingest.result
  }
  step.lines = []
  for (const each of [COLLEGE[league], PRO[league]]) {
    const worker = leagues[each]
    if (!worker) continue
    const ids = await links.call('linkedIds', { league: each })
    const written = await timed(() =>
      worker.call('linkLines', { ids, dir: handover, tag: `${tag}-lines` })
    )
    const ingested = written.result
      ? await timed(() => links.call('ingestLines', { files: written.result }))
      : { result: 0, ms: 0 }
    step.lines.push({
      league: each,
      players: ids.length,
      rows: ingested.result,
      writeMs: written.ms,
      ingestMs: ingested.ms
    })
  }
  step.totalMs =
    paired.ms +
    side.ms +
    (step.ingestMs ?? 0) +
    step.lines.reduce((a, l) => a + l.writeMs + l.ingestMs, 0)
  report.steps.push(step)
  console.log(JSON.stringify(step))
}
sampling = false
await sampler
report.peakBytes = peak
report.idleBytesAfter = await memory()

// The paired files a league brings, as its Data panel lists them.
report.paired = {}
for (const league of Object.keys(PAIRS)) {
  report.paired[league] = (await links.call('pairedFamilies', { league })).map((f) => ({
    label: f.label,
    state: f.state,
    files: `${f.filesLoaded} of ${f.filesExpected}`,
    seasons: [f.firstSeason, f.lastSeason],
    bytes: f.bytes,
    rows: f.rows,
    error: f.lastError
  }))
}
report.counts = {
  nba: await links.call('counts', { league: 'nba' }),
  wnba: await links.call('counts', { league: 'wnba' })
}
report.reads = []
for (const [league, player] of reads) {
  const first = await timed(() => links.call('otherCareer', { league, player }))
  const again = await timed(() => links.call('otherCareer', { league, player }))
  report.reads.push({
    league,
    player,
    firstMs: first.ms,
    againMs: again.ms,
    link: first.result.link,
    source: first.result.source,
    seasons: first.result.seasons.length,
    draft: first.result.draft,
    reason: first.result.reason
  })
}
// Against the research's own links (`scripts/player-links/12-export-nba.sql`, `22-export-wnba.sql`):
// the same pairs, those it had that the app lacks, those the app adds (to read by hand), and the
// rates per draft class.
const compare = opt('compare', null)
if (compare) {
  report.compare = {}
  for (const pro of ['nba', 'wnba']) {
    const file = join(resolve(compare), `research-${pro}.parquet`)
    if (!existsSync(file)) continue
    const r = `read_parquet('${file}')`
    const q = (sql) => links.call('read', { sql })
    const college = PAIRS[pro]
    report.compare[pro] = {
      summary: (
        await q(`WITH r AS (SELECT * FROM ${r} WHERE col_id IS NOT NULL),
          m AS (SELECT * FROM player_link WHERE pro = '${pro}')
          SELECT (SELECT count(*) FROM r) AS research_links,
            (SELECT count(*) FROM r JOIN m ON m.pro_id = r.pro_id AND m.college_id = r.col_id) AS same,
            (SELECT count(*) FROM r JOIN m ON m.pro_id = r.pro_id AND m.college_id = r.col_id AND m.method = r.method) AS same_method,
            (SELECT count(*) FROM m) AS app_links,
            (SELECT count(*) FROM m WHERE m.pro_id IN (SELECT pro_id FROM ${r})) AS app_in_universe`)
      )[0],
      researchOnly:
        await q(`SELECT r.*, (SELECT college_id FROM player_link m WHERE m.pro = '${pro}' AND m.pro_id = r.pro_id) AS app_col
        FROM ${r} r WHERE r.col_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM player_link m WHERE m.pro = '${pro}' AND m.pro_id = r.pro_id AND m.college_id = r.col_id)`),
      appOnly:
        await q(`SELECT m.pro_id, m.pro_espn, m.pro_name, m.college_id, m.college_name, m.method, m.draft_label,
          c.first_season, c.last_season, c.dob AS college_dob, p.dob AS pro_dob, p.first_season AS pro_first,
          array_to_string(c.team_names, '/') AS teams, d.organization
        FROM player_link m
        LEFT JOIN side_${college}_players c ON c.col_id = m.college_id
        LEFT JOIN side_${pro}_players p ON p.pro_id = m.pro_id
        LEFT JOIN side_${pro}_draft d ON d.pro_id = m.pro_id AND d.label = m.draft_label
        WHERE m.pro = '${pro}' AND NOT EXISTS (
          SELECT 1 FROM ${r} r WHERE r.pro_id = m.pro_id AND r.col_id = m.college_id)
        ORDER BY m.method, m.pro_name`),
      byClass: await q(`SELECT r.class, r.organization_type AS kind, count(*) AS players,
          count(*) FILTER (WHERE r.col_id IS NOT NULL) AS research_linked,
          count(m.college_id) AS app_linked,
          count(*) FILTER (WHERE m.method = 'id') AS by_id,
          count(*) FILTER (WHERE m.method = 'name+birth') AS by_birth,
          count(*) FILTER (WHERE m.method = 'name+college') AS by_college
        FROM ${r} r LEFT JOIN player_link m ON m.pro = '${pro}' AND m.pro_id = r.pro_id
        GROUP BY ALL ORDER BY 1, 2`)
    }
  }
}
writeFileSync(join(out, `links-${label}.json`), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ counts: report.counts, peakBytes: peak, idle: report.idleBytesAfter }))
await links.close()
for (const w of Object.values(leagues)) await w.close()
