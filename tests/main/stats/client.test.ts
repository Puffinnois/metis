import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventEmitter } from 'node:events'
import { startStatsWorker } from '@main/stats/client'
import type { StatsRequest } from '@main/stats/protocol'

type FakeWorker = EventEmitter & { posted: StatsRequest[]; terminated: boolean; options: unknown }

const { workers } = vi.hoisted(() => ({ workers: [] as FakeWorker[] }))

/** A worker that never runs: the test answers its messages. */
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events')
  class Worker extends EventEmitter {
    posted: unknown[] = []
    terminated = false
    constructor(
      _path: string,
      public options: unknown
    ) {
      super()
      workers.push(this as unknown as FakeWorker)
    }
    postMessage(message: unknown): void {
      this.posted.push(message)
    }
    terminate(): Promise<number> {
      this.terminated = true
      return Promise.resolve(0)
    }
  }
  return { Worker }
})

beforeEach(() => {
  workers.length = 0
})

const INIT = { path: '/data/stats.duckdb', tempDir: '/data/stats-tmp' }
const STATUS = { available: true, through: null, updatedAt: null, busy: false }

describe('startStatsWorker', () => {
  it('starts the worker on the database path and answers a request by id', async () => {
    const client = startStatsWorker(INIT, undefined, '/out/statsWorker.js')
    const worker = workers[0]
    expect(worker.options).toEqual({ workerData: INIT })
    const pending = client.status()
    expect(worker.posted).toEqual([{ id: 1, kind: 'status' }])
    worker.emit('message', { kind: 'reply', id: 1, ok: true, result: STATUS })
    await expect(pending).resolves.toEqual(STATUS)
  })

  it('asks for a refresh with its options', async () => {
    const client = startStatsWorker(INIT, undefined, 'w.js')
    const pending = client.refresh({ force: true })
    expect(workers[0].posted).toEqual([{ id: 1, kind: 'refresh', options: { force: true } }])
    workers[0].emit('message', { kind: 'reply', id: 1, ok: true, result: { steps: [] } })
    await expect(pending).resolves.toEqual({ steps: [] })
  })

  it('forwards step progress and rejects a failed request', async () => {
    const steps: string[] = []
    const client = startStatsWorker(INIT, (e) => steps.push(e.source), 'w.js')
    const pending = client.selfTest()
    workers[0].emit('message', { kind: 'step', entry: { source: 'stats:pbp:2027' } })
    workers[0].emit('message', { kind: 'reply', id: 1, ok: false, error: 'disk full' })
    await expect(pending).rejects.toThrow('disk full')
    expect(steps).toEqual(['stats:pbp:2027'])
  })

  it('rejects pending and later requests once the database cannot open', async () => {
    const client = startStatsWorker(INIT, undefined, 'w.js')
    const pending = client.selfTest()
    workers[0].emit('message', { kind: 'fatal', error: 'IO Error: locked' })
    await expect(pending).rejects.toThrow('stats database: IO Error: locked')
    await expect(client.status()).rejects.toThrow('stats database: IO Error: locked')
  })

  it('rejects pending requests when the worker exits', async () => {
    const client = startStatsWorker(INIT, undefined, 'w.js')
    const pending = client.selfTest()
    workers[0].emit('exit', 1)
    await expect(pending).rejects.toThrow('the stats worker stopped (exit 1)')
  })

  it('ends the worker even when the close is never answered', async () => {
    const client = startStatsWorker(INIT, undefined, 'w.js', 10)
    await client.close()
    expect(workers[0].posted).toEqual([{ id: 1, kind: 'close' }])
    expect(workers[0].terminated).toBe(true)
  })

  it('closes the database before ending the worker', async () => {
    const client = startStatsWorker(INIT, undefined, 'w.js')
    const closing = client.close()
    expect(workers[0].posted).toEqual([{ id: 1, kind: 'close' }])
    workers[0].emit('message', { kind: 'reply', id: 1, ok: true, result: null })
    await closing
    expect(workers[0].terminated).toBe(true)
  })
})
