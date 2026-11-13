import { parentPort, workerData } from 'node:worker_threads'
import {
  AT_ONCE_REQUESTS,
  type StatsReply,
  type StatsRequest,
  type StatsWorkerInit
} from './protocol'
import { openStatsService, type StatsService } from './service'

/**
 * Worker entry, bundled to `out/main/statsWorker.js`: the only thread that opens `stats.duckdb`.
 * Writes run one after another, in arrival order; reads run at once, so a screen never waits behind
 * a refresh.
 */
const port = parentPort
if (!port) throw new Error('statsWorker must run as a worker thread')
const post = (reply: StatsReply): void => port.postMessage(reply)

let queue: Promise<unknown> = Promise.resolve()
let service: StatsService | null = null

async function handle(request: StatsRequest): Promise<unknown> {
  if (!service) throw new Error('the stats database is not open')
  switch (request.kind) {
    case 'refresh':
      return service.refresh(request.options)
    case 'selfTest':
      return service.selfTest()
    case 'status':
      return service.status()
    case 'data':
      return service.data()
    case 'pause':
      return service.pause()
    case 'resume':
      return service.resume()
    case 'read':
      return service.read(request.sql)
    case 'query':
      return service.query(request.query)
    case 'catalogue':
      return service.catalogue()
    case 'seasons':
      return service.seasons()
    case 'player':
      return service.player(request.player)
    case 'games':
      return service.games(request.season)
    case 'game':
      return service.game(request.game)
    case 'standings':
      return service.standings(request.season)
    case 'matchups':
      return service.matchups(request.player, request.season, request.scope)
    case 'gameMatchups':
      return service.gameMatchups(request.game)
    case 'officialsSeason':
      return service.officialsSeason(request.season, request.gameTypes)
    case 'officialCareer':
      return service.officialCareer(request.official, request.gameTypes)
    case 'profile':
      return service.profile(request.player)
    case 'lineups':
      return service.lineups(request.team, request.season, request.gameType, request.group)
    case 'availability':
      return service.availability(request.players)
    case 'coaches':
      return service.coaches(request.team, request.season)
    case 'shots':
      return service.shots(request.request)
    case 'assists':
      return service.assists(request.request)
    case 'gameFlow':
      return service.gameFlow(request.game)
    case 'close':
      await service.close()
      service = null
      return null
  }
}

async function answer(request: StatsRequest): Promise<void> {
  try {
    post({ kind: 'reply', id: request.id, ok: true, result: await handle(request) })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    post({ kind: 'reply', id: request.id, ok: false, error })
  }
}

openStatsService(workerData as StatsWorkerInit, (entry) => post({ kind: 'step', entry })).then(
  (opened) => {
    service = opened
    port.on('message', (request: StatsRequest) => {
      if (AT_ONCE_REQUESTS.has(request.kind)) {
        void answer(request)
        return
      }
      // A close must not wait behind a running write: stop it now, then close in turn.
      if (request.kind === 'close') service?.cancel()
      queue = queue.then(async () => {
        await answer(request)
        if (request.kind === 'close') port.close()
      })
    })
  },
  (err: unknown) => {
    post({ kind: 'fatal', error: err instanceof Error ? err.message : String(err) })
    port.close()
  }
)
