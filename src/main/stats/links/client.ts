import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { CLOSE_TIMEOUT_MS } from '../client'
import type { LinksClient, LinksReply, LinksRequest, LinksWorkerInit } from './protocol'

/** Bundled beside the main entry by `electron.vite.config.ts`. */
export function linksWorkerPath(): string {
  return join(__dirname, 'linksWorker.js')
}

type Pending = { resolve: (value: unknown) => void; reject: (err: Error) => void }
type Body<K extends LinksRequest['kind']> = Omit<Extract<LinksRequest, { kind: K }>, 'id' | 'kind'>

/** The main process's handle on the links worker, as `startStatsWorker` is on a league's. */
export function startLinksWorker(
  init: LinksWorkerInit,
  workerPath: string = linksWorkerPath(),
  closeTimeoutMs: number = CLOSE_TIMEOUT_MS
): LinksClient {
  const worker = new Worker(workerPath, { workerData: init })
  const pending = new Map<number, Pending>()
  let nextId = 1
  let dead: Error | null = null
  const fail = (err: Error): void => {
    dead ??= err
    for (const p of pending.values()) p.reject(dead)
    pending.clear()
  }
  worker.on('message', (reply: LinksReply) => {
    if (reply.kind === 'fatal') return fail(new Error(`links file: ${reply.error}`))
    const p = pending.get(reply.id)
    if (!p) return
    pending.delete(reply.id)
    if (reply.ok) p.resolve(reply.result)
    else p.reject(new Error(reply.error))
  })
  worker.on('error', (err) => fail(err))
  worker.on('exit', (code) => fail(new Error(`the links worker stopped (exit ${code})`)))

  function request<T, K extends LinksRequest['kind']>(kind: K, body: Body<K>): Promise<T> {
    if (dead) return Promise.reject(dead)
    const id = nextId++
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      worker.postMessage({ id, kind, ...body })
    })
  }

  return {
    refreshPaired: (league, options = {}) => request('refreshPaired', { league, options }),
    ingestSide: (files) => request('ingestSide', { files }),
    ingestLines: (files) => request('ingestLines', { files }),
    failed: (league, message) => request('failed', { league, message }),
    linkedIds: (league) => request('linkedIds', { league }),
    counts: (league) => request('counts', { league }),
    otherCareer: (league, player) => request('otherCareer', { league, player }),
    otherPlayers: (league) => request('otherPlayers', { league }),
    pairedIds: (league, ids) => request('pairedIds', { league, ids }),
    pairedFamilies: (league) => request('pairedFamilies', { league }),
    read: (sql) => request('read', { sql }),
    ping: () => request('ping', {}),
    async close() {
      if (!dead) {
        let timer: NodeJS.Timeout | undefined
        await Promise.race([
          request('close', {}).catch(() => undefined),
          new Promise((resolve) => (timer = setTimeout(resolve, closeTimeoutMs)))
        ])
        clearTimeout(timer)
      }
      await worker.terminate()
    }
  }
}
