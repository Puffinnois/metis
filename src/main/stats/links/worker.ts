import { parentPort, workerData } from 'node:worker_threads'
import { LINKS_AT_ONCE, type LinksReply, type LinksRequest, type LinksWorkerInit } from './protocol'
import { openLinksService, type LinksService } from './service'

/**
 * The links worker, bundled to `out/main/linksWorker.js`: the only thread that opens `links.duckdb`
 * (D47). Writes run one after another in arrival order; reads run at once, so a player's read never
 * waits behind a refresh of the links or of any league.
 */
const port = parentPort
if (!port) throw new Error('linksWorker must run as a worker thread')
const post = (reply: LinksReply): void => port.postMessage(reply)

let queue: Promise<unknown> = Promise.resolve()
let service: LinksService | null = null

async function handle(request: LinksRequest): Promise<unknown> {
  if (!service) throw new Error('the links file is not open')
  switch (request.kind) {
    case 'refreshPaired':
      return service.refreshPaired(request.league, request.options)
    case 'ingestSide':
      return service.ingestSide(request.files)
    case 'ingestLines':
      return service.ingestLines(request.files)
    case 'failed':
      return service.failed(request.league, request.message)
    case 'linkedIds':
      return service.linkedIds(request.league)
    case 'counts':
      return service.counts(request.league)
    case 'otherCareer':
      return service.otherCareer(request.league, request.player)
    case 'otherPlayers':
      return service.otherPlayers(request.league)
    case 'pairedFamilies':
      return service.pairedFamilies(request.league)
    case 'read':
      return service.read(request.sql)
    case 'ping':
      return null
    case 'close':
      await service.close()
      service = null
      return null
  }
}

async function answer(request: LinksRequest): Promise<void> {
  try {
    post({ kind: 'reply', id: request.id, ok: true, result: await handle(request) })
  } catch (err) {
    post({
      kind: 'reply',
      id: request.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    })
  }
}

openLinksService(workerData as LinksWorkerInit).then(
  (opened) => {
    service = opened
    port.on('message', (request: LinksRequest) => {
      if (LINKS_AT_ONCE.has(request.kind)) {
        void answer(request)
        return
      }
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
