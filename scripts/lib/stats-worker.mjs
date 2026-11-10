// Opens a loaded stats database through the built worker, which stays the only thread that opens the
// file. Shared by the scripts that measure and check a real load. Build first with `npm run build`.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

export function openStatsWorker(folder, options = {}) {
  const worker = new Worker(join(ROOT, 'out/main/statsWorker.js'), {
    workerData: {
      path: join(folder, 'stats.duckdb'),
      tempDir: join(folder, 'tmp-script'),
      memoryLimit: options.memoryLimit
    }
  })
  const pending = new Map()
  let nextId = 1
  worker.on('message', (reply) => {
    if (reply.kind === 'fatal') {
      console.error('fatal:', reply.error)
      process.exit(1)
    }
    const p = pending.get(reply.id)
    if (!p) return
    pending.delete(reply.id)
    if (reply.ok) p.res(reply.result)
    else p.rej(new Error(reply.error))
  })
  const request = (make) =>
    new Promise((res, rej) => {
      const id = nextId++
      pending.set(id, { res, rej })
      worker.postMessage(make(id))
    })
  return {
    read: (sql) => request((id) => ({ id, kind: 'read', sql })),
    query: (query) => request((id) => ({ id, kind: 'query', query })),
    lineups: (team, season, gameType, group) =>
      request((id) => ({ id, kind: 'lineups', team, season, gameType, group })),
    close: async () => {
      await request((id) => ({ id, kind: 'close' })).catch(() => undefined)
      await worker.terminate()
    }
  }
}
