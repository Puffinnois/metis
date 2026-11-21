#!/usr/bin/env node
// Runs SQL against a profile's links file through the built links worker, which stays the only thread
// that opens it (D47). Build first with `npm run build`.
//
// usage: node scripts/links-sql.mjs <profile> <file of statements>
// Statements are separated by a line holding only `;`. Each result prints as one JSON row a line.
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const [profile, sqlFile] = process.argv.slice(2).map((p) => resolve(p))
if (!profile || !sqlFile) {
  console.error('usage: node scripts/links-sql.mjs <profile> <file of statements>')
  process.exit(2)
}
const worker = new Worker(join(ROOT, 'out/main/linksWorker.js'), {
  workerData: { dataDir: profile, tempDir: join(profile, 'stats-tmp', 'links') }
})
const pending = new Map()
let nextId = 1
worker.on('message', (reply) => {
  if (reply.kind === 'fatal') {
    console.error('fatal:', reply.error)
    process.exit(1)
  }
  const p = pending.get(reply.id)
  pending.delete(reply.id)
  if (reply.ok) p.res(reply.result)
  else p.rej(new Error(reply.error))
})
const call = (kind, body = {}) =>
  new Promise((res, rej) => {
    const id = nextId++
    pending.set(id, { res, rej })
    worker.postMessage({ id, kind, ...body })
  })
for (const sql of readFileSync(sqlFile, 'utf8')
  .split(/^;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean)) {
  console.log(`\n-- ${sql.split('\n')[0].slice(0, 110)}`)
  const at = Date.now()
  try {
    const rows = await call('read', { sql })
    for (const row of rows) console.log(JSON.stringify(row))
    console.log(`(${rows.length} rows, ${Date.now() - at} ms)`)
  } catch (err) {
    console.log(`ERROR ${err.message.slice(0, 400)}`)
  }
}
await call('close').catch(() => undefined)
await worker.terminate()
