// Opens a loaded stats database through the built worker, which stays the only thread that opens the
// file. Shared by the scripts that measure and check a real load. Build first with `npm run build`.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * The league a script reads: `--league=wnba` anywhere among its arguments, else the NBA. Its file is
 * `stats-<league>.duckdb` in the folder (D36); the worker renames an old `stats.duckdb` first.
 */
export function leagueArg(argv = process.argv) {
  return argv.find((a) => a.startsWith('--league='))?.slice('--league='.length) ?? 'nba'
}

/**
 * A source table as the league names it: the NBA's `src_nba_pbp` is the WNBA's `src_wnba_pbp`
 * (`sources.ts`). The ESPN and dashboard tables have one name in every league.
 */
export const sourceOf = (league, name) => name.replace(/^src_nba_/, `src_${league}_`)

/**
 * A season as the league's screens write it (`League.seasonLabel`): `2025-26` in the NBA, whose
 * label is the final year, `2026` in the WNBA, whose season is one calendar year.
 */
export const seasonLabelOf = (league, season) =>
  league === 'nba' ? `${season - 1}-${String(season % 100).padStart(2, '0')}` : String(season)

/** The first season of the league's published five-player units (`League.lineupsFrom`). */
export const lineupsFromOf = (league) => (league === 'nba' ? 2008 : 1997)

/** A game's regulation minutes (`League.gameMinutes`): 48 in the NBA, 40 in the WNBA. */
export const gameMinutesOf = (league) => (league === 'nba' ? 48 : 40)

/** A script's arguments less `--league=…`, so the positional ones keep their places. */
export const positional = (argv = process.argv.slice(2)) =>
  argv.filter((a) => !a.startsWith('--league='))

export function openStatsWorker(folder, options = {}) {
  const worker = new Worker(join(ROOT, 'out/main/statsWorker.js'), {
    workerData: {
      league: options.league ?? leagueArg(),
      dataDir: folder,
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
    // Any other request the worker serves: `call('coaches', { team, season })`.
    call: (kind, args) => request((id) => ({ id, kind, ...args })),
    close: async () => {
      await request((id) => ({ id, kind: 'close' })).catch(() => undefined)
      await worker.terminate()
    }
  }
}
