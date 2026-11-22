import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { LEAGUES, LINKS_FILE, pairedLeague, pairOf, type LeagueId } from '@shared/leagues'
import type { StatsFamily, StatsOtherCareer, StatsOtherPlayer } from '@shared/stats/types'
import { sqlString, StatsDb, type Row } from '../db'
import { createDownloads } from '../download'
import { summarisePairedFamilies, type FileAttempt, type HeldFile } from '../families'
import type { RefreshOptions, StatsLogEntry } from '../protocol'
import { INTERRUPTED_MESSAGE } from '../schema'
import { PAIRED_SOURCES_BY_LEAGUE } from '../sources'
import { refreshStats } from '../sync'
import type { LinkLinesFiles, LinkSideFiles, LinksWorkerInit } from './protocol'
import { readOtherCareer, readOtherPlayers } from './read'
import { matchSql, NAME_MACRO } from './sql'
import {
  keptSeasonTable,
  keptTeamTable,
  linksBootstrap,
  pairTables,
  sideDraftTable,
  sidePlayersTable
} from './tables'

/** The log step of a league's links: `links:nba`. */
export const linksStep = (league: LeagueId): string => `links:${league}`

/** The hand-over folder inside the links worker's temp folder, where league workers write their sides. */
export const handoverDir = (tempDir: string): string => join(tempDir, 'handover')

export interface LinksService {
  refreshPaired(league: LeagueId, options: RefreshOptions): Promise<StatsLogEntry[]>
  ingestSide(files: LinkSideFiles): Promise<Record<string, number>>
  ingestLines(files: LinkLinesFiles): Promise<number>
  failed(league: LeagueId, message: string): Promise<void>
  linkedIds(league: LeagueId): Promise<number[]>
  counts(league: LeagueId): Promise<Record<string, number>>
  otherCareer(league: LeagueId, player: string): Promise<StatsOtherCareer>
  otherPlayers(league: LeagueId): Promise<StatsOtherPlayer[]>
  pairedFamilies(league: LeagueId): Promise<StatsFamily[]>
  read(sql: string): Promise<Row[]>
  cancel(): void
  close(): Promise<void>
}

export interface LinksServiceDeps {
  now?: () => Date
  /** Tests pass their own; the paired files are downloaded with it. */
  fetchImpl?: typeof fetch
}

/**
 * The links worker's state: `links.duckdb` in the data folder, opened by this worker alone (D47,
 * CLAUDE.md rule 3), with writes in turn and each read on its own connection. Its temp folder is
 * emptied on open, so hand-over files a crash left are never read.
 */
export async function openLinksService(
  init: LinksWorkerInit,
  deps: LinksServiceDeps = {}
): Promise<LinksService> {
  const now = deps.now ?? ((): Date => new Date())
  rmSync(init.tempDir, { recursive: true, force: true })
  mkdirSync(handoverDir(init.tempDir), { recursive: true })
  mkdirSync(init.dataDir, { recursive: true })
  const db = await StatsDb.open(join(init.dataDir, LINKS_FILE), {
    tempDirectory: join(init.tempDir, 'duckdb'),
    // The links file is megabytes: the matcher's largest input is a college league's 43,000 players.
    memoryLimit: init.memoryLimit ?? '512MB',
    threads: 2
  })
  for (const sql of linksBootstrap()) await db.exec(sql)
  await db.exec(
    "UPDATE sync_log SET status = 'interrupted', finished_at = ?, message = ? WHERE status = 'running'",
    [now().toISOString(), INTERRUPTED_MESSAGE]
  )
  await db.exec(NAME_MACRO)

  let abort = new AbortController()
  let cancelled = false
  const read = async <T>(fn: (conn: StatsDb) => Promise<T>): Promise<T> => {
    const conn = await db.connect()
    try {
      return await fn(conn)
    } finally {
      conn.close()
    }
  }

  const logStep = async (
    league: LeagueId,
    status: 'ok' | 'error',
    message: string | null,
    rows = 0
  ): Promise<void> => {
    const at = now().toISOString()
    await db.exec(
      `INSERT INTO sync_log (source, started_at, finished_at, status, message, rows_written)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [linksStep(league), at, at, status, message, rows]
    )
  }

  /** Builds a pair's links from everything held, replacing the old ones (inside a transaction). */
  const rebuild = async (league: LeagueId): Promise<void> => {
    const pair = pairOf(league)
    if (!pair) return
    await db.exec('DELETE FROM player_link WHERE college = ?', [pair.college])
    await db.exec(`INSERT INTO player_link BY NAME ${matchSql(pair, await pairTables(db, pair))}`)
  }

  const countsOf = async (conn: StatsDb, league: LeagueId): Promise<Record<string, number>> => {
    const pair = pairOf(league)
    if (!pair) return {}
    const rows = await conn.all<{ method: string; n: number }>(
      'SELECT method, count(*)::INTEGER AS n FROM player_link WHERE college = ? GROUP BY 1 ORDER BY 1',
      [pair.college]
    )
    return Object.fromEntries(rows.map((r) => [r.method, r.n]))
  }

  const removeFiles = (paths: (string | null)[]): void => {
    for (const p of paths) if (p) rmSync(p, { force: true })
  }

  return {
    async refreshPaired(league, options) {
      const other = pairedLeague(league)
      if (!other || cancelled) return []
      abort = new AbortController()
      const result = await refreshStats(
        {
          db,
          league: LEAGUES[other],
          downloads: createDownloads({
            dir: join(init.tempDir, 'downloads'),
            signal: abort.signal,
            fetchImpl: deps.fetchImpl
          }),
          now,
          paired: true,
          cancelled: () => cancelled
        },
        options,
        PAIRED_SOURCES_BY_LEAGUE[league],
        []
      )
      if (result.fatal !== undefined) throw new Error(result.fatal)
      if (result.steps.some((s) => s.status === 'ok' && s.rowsWritten > 0)) {
        await db.transaction(() => rebuild(league))
      }
      return result.steps
    },
    async ingestSide(files) {
      try {
        // One transaction: a failed or interrupted hand-over leaves the side and the links as they were.
        await db.transaction(async () => {
          const players = sidePlayersTable(files.league)
          await db.exec(`DELETE FROM ${players}`)
          await db.exec(
            `INSERT INTO ${players} BY NAME SELECT * FROM read_parquet(${sqlString(files.players)})`
          )
          if (files.side === 'pro') {
            const draft = sideDraftTable(files.league)
            await db.exec(`DELETE FROM ${draft}`)
            if (files.draft) {
              await db.exec(
                `INSERT INTO ${draft} BY NAME SELECT * FROM read_parquet(${sqlString(files.draft)})`
              )
            }
          }
          await rebuild(files.league)
        })
      } finally {
        removeFiles([files.players, files.draft])
      }
      const counts = await countsOf(db, files.league)
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      await logStep(
        files.league,
        'ok',
        Object.entries(counts)
          .map(([m, n]) => `${n} by ${m}`)
          .join(', ') || 'no links',
        total
      )
      return counts
    },
    async ingestLines(files) {
      try {
        await db.transaction(async () => {
          await db.exec(
            `CREATE OR REPLACE TABLE ${keptSeasonTable(files.league)} AS
             SELECT * FROM read_parquet(${sqlString(files.seasons)})`
          )
          await db.exec(
            `CREATE OR REPLACE TABLE ${keptTeamTable(files.league)} AS
             SELECT * FROM read_parquet(${sqlString(files.teams)})`
          )
        })
      } finally {
        removeFiles([files.seasons, files.teams])
      }
      const n = await db.get<{ n: number }>(
        `SELECT count(*)::INTEGER AS n FROM ${keptSeasonTable(files.league)}`
      )
      return n?.n ?? 0
    },
    failed: (league, message) => logStep(league, 'error', message),
    linkedIds: (league) =>
      read(async (conn) => {
        const pair = pairOf(league)
        if (!pair) return []
        const rows = await conn.all<{ id: number }>(
          pair.college === league
            ? 'SELECT college_id AS id FROM player_link WHERE college = ? ORDER BY 1'
            : 'SELECT pro_id AS id FROM player_link WHERE pro = ? AND pro_id IS NOT NULL ORDER BY 1',
          [league]
        )
        return rows.map((r) => r.id)
      }),
    counts: (league) => read((conn) => countsOf(conn, league)),
    otherCareer: (league, player) => read((conn) => readOtherCareer(conn, league, player)),
    otherPlayers: (league) => read((conn) => readOtherPlayers(conn, league)),
    pairedFamilies: (league) =>
      read(async (conn) => {
        const other = pairedLeague(league)
        if (!other) return []
        const sources = PAIRED_SOURCES_BY_LEAGUE[league]
        const ids = sources.map((s) => s.id)
        const heldRows = await conn.all<{
          source: string
          season: number
          rows_written: number
          bytes: number | null
          fetched_at: string
        }>(
          `SELECT source, season, rows_written, bytes, fetched_at FROM source_state
           WHERE source IN (${ids.map(() => '?').join(', ')})`,
          ids
        )
        const held = new Map<string, HeldFile>(
          heldRows.map((r) => [
            `${r.source}:${r.season}`,
            { rows: r.rows_written, bytes: r.bytes, fetchedAt: r.fetched_at }
          ])
        )
        const attemptRows = await conn.all<{
          source: string
          status: string
          message: string | null
        }>(
          `SELECT source, arg_max(status, id) AS status, arg_max(message, id) AS message
           FROM sync_log WHERE status NOT IN ('running', 'interrupted') GROUP BY source`
        )
        const attempts = new Map<string, FileAttempt>(
          attemptRows.map((r) => [r.source, { status: r.status, message: r.message }])
        )
        const links = attempts.get(linksStep(league))
        return summarisePairedFamilies(
          sources,
          LEAGUES[other].currentSeason(now()),
          held,
          attempts,
          links?.status === 'error' ? `Linking careers failed: ${links.message ?? 'unknown'}` : null
        )
      }),
    read: (sql) => read((conn) => conn.all(sql)),
    cancel() {
      cancelled = true
      abort.abort()
      db.interrupt()
    },
    async close() {
      db.close()
    }
  }
}
