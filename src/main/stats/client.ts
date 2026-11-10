import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type {
  MetricInfo,
  StatsDataReport,
  StatsGame,
  StatsGameDetail,
  StatsMatchups,
  StatsProfile,
  StatsPlayerInfo,
  StatsQuery,
  StatsResult,
  StatsSeason,
  StatsStanding,
  StatsStatus
} from '@shared/stats/types'
import type {
  RefreshOptions,
  SelfTestResult,
  StatsLogEntry,
  StatsReply,
  StatsRequest,
  StatsSyncResult,
  StatsWorkerInit
} from './protocol'

/** The main process's handle on the stats worker. */
export interface StatsClient {
  refresh(options?: RefreshOptions): Promise<StatsSyncResult>
  selfTest(): Promise<SelfTestResult>
  status(): Promise<StatsStatus>
  data(): Promise<StatsDataReport>
  pause(): Promise<void>
  resume(): Promise<void>
  query(query: StatsQuery): Promise<StatsResult>
  catalogue(): Promise<MetricInfo[]>
  seasons(): Promise<StatsSeason[]>
  player(id: string): Promise<StatsPlayerInfo | null>
  games(season: number): Promise<StatsGame[]>
  game(id: string): Promise<StatsGameDetail | null>
  standings(season: number): Promise<StatsStanding[]>
  matchups(player: string, season: number): Promise<StatsMatchups>
  profile(player: string): Promise<StatsProfile>
  /** Closes the database and ends the worker (after `CLOSE_TIMEOUT_MS` at most). */
  close(): Promise<void>
}

/** How long `close` waits for the worker to close the database before ending it anyway. */
export const CLOSE_TIMEOUT_MS = 3_000

/** Bundled beside the main entry by `electron.vite.config.ts`. */
export function statsWorkerPath(): string {
  return join(__dirname, 'statsWorker.js')
}

type Pending = { resolve: (value: unknown) => void; reject: (err: Error) => void }

export function startStatsWorker(
  init: StatsWorkerInit,
  onStep: (entry: StatsLogEntry) => void = () => {},
  workerPath: string = statsWorkerPath(),
  closeTimeoutMs: number = CLOSE_TIMEOUT_MS
): StatsClient {
  const worker = new Worker(workerPath, { workerData: init })
  const pending = new Map<number, Pending>()
  let nextId = 1
  let dead: Error | null = null

  const fail = (err: Error): void => {
    dead ??= err
    for (const p of pending.values()) p.reject(dead)
    pending.clear()
  }
  worker.on('message', (reply: StatsReply) => {
    if (reply.kind === 'step') return onStep(reply.entry)
    if (reply.kind === 'fatal') return fail(new Error(`stats database: ${reply.error}`))
    const p = pending.get(reply.id)
    if (!p) return
    pending.delete(reply.id)
    if (reply.ok) p.resolve(reply.result)
    else p.reject(new Error(reply.error))
  })
  worker.on('error', (err) => fail(err))
  worker.on('exit', (code) => fail(new Error(`the stats worker stopped (exit ${code})`)))

  function request<T>(make: (id: number) => StatsRequest): Promise<T> {
    if (dead) return Promise.reject(dead)
    const id = nextId++
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      worker.postMessage(make(id))
    })
  }

  return {
    refresh: (options = {}) => request<StatsSyncResult>((id) => ({ id, kind: 'refresh', options })),
    selfTest: () => request<SelfTestResult>((id) => ({ id, kind: 'selfTest' })),
    status: () => request<StatsStatus>((id) => ({ id, kind: 'status' })),
    data: () => request<StatsDataReport>((id) => ({ id, kind: 'data' })),
    pause: () => request<void>((id) => ({ id, kind: 'pause' })),
    resume: () => request<void>((id) => ({ id, kind: 'resume' })),
    query: (query) => request<StatsResult>((id) => ({ id, kind: 'query', query })),
    catalogue: () => request<MetricInfo[]>((id) => ({ id, kind: 'catalogue' })),
    seasons: () => request<StatsSeason[]>((id) => ({ id, kind: 'seasons' })),
    player: (player) => request<StatsPlayerInfo | null>((id) => ({ id, kind: 'player', player })),
    games: (season) => request<StatsGame[]>((id) => ({ id, kind: 'games', season })),
    game: (game) => request<StatsGameDetail | null>((id) => ({ id, kind: 'game', game })),
    standings: (season) => request<StatsStanding[]>((id) => ({ id, kind: 'standings', season })),
    matchups: (player, season) =>
      request<StatsMatchups>((id) => ({ id, kind: 'matchups', player, season })),
    profile: (player) => request<StatsProfile>((id) => ({ id, kind: 'profile', player })),
    async close() {
      if (!dead) {
        let timer: NodeJS.Timeout | undefined
        await Promise.race([
          request((id) => ({ id, kind: 'close' })).catch(() => undefined),
          new Promise((resolve) => (timer = setTimeout(resolve, closeTimeoutMs)))
        ])
        clearTimeout(timer)
      }
      await worker.terminate()
    }
  }
}
