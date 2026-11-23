import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type {
  StatsAssistRequest,
  StatsAssistNetwork,
  StatsGameFlow,
  StatsShotRequest,
  StatsShotChart,
  GameType,
  MetricInfo,
  MetricStability,
  StatsDataReport,
  StatsGame,
  StatsGameDetail,
  StatsIndexedPlayer,
  StatsPlayerInfo,
  StatsQuery,
  StatsResult,
  StatsSeason,
  StatsStanding,
  StatsLineups,
  StatsMatchups,
  StatsMatchupScope,
  StatsGameMatchups,
  StatsOfficialCareer,
  StatsOnCourtScope,
  StatsOnCourtUnits,
  StatsWithOrWithout,
  StatsOfficialsSeason,
  StatsProfile,
  StatsAvailability,
  StatsGameListing,
  StatsCoach,
  StatsStatus
} from '@shared/stats/types'
import { builds, buildsPlayTables, leagueOf, type League } from '@shared/leagues'
import { notBuiltYet, playTablesNotBuilt } from '@shared/stats/coverage'
import { sqlString, StatsDb, type Row } from './db'
import { databaseBytes, freeBytes, roomNeeded } from './disk'
import { createDownloads } from './download'
import { adoptFormerStatsFile, statsFilePath } from './files'
import { StatsQueryError } from './engine/compile'
import { catalogueInfo } from './engine/registry'
import { runQuery } from './engine/run'
import { priorsOf, readStability } from './models/metricStability'
import { summariseFamilies, type FileAttempt, type HeldFile } from './families'
import type {
  RefreshOptions,
  SelfTestResult,
  StatsLogEntry,
  StatsProgress,
  StatsSyncResult,
  StatsWorkerInit
} from './protocol'
import { readAvailability, readCoaches, readGameListings } from './availabilityReads'
import { readShotChart } from './shotReads'
import { readAssistNetwork, readGameFlow } from './playReads'
import type { LineupGroup } from '@shared/stats/lineups'
import {
  readGame,
  readGames,
  readLineups,
  readMatchups,
  readPlayer,
  readPlayerIndex,
  readProfile,
  readStandings
} from './reads'
import { readGameMatchups } from './matchupReads'
import { readOfficialCareer, readOfficialsSeason } from './officialsReads'
import { readOnCourtUnits, readWithOrWithout } from './onCourtReads'
import { offlineStats } from './offline'
import { bootstrapStatsDb } from './schema'
import { LEFT_OUT_RELEASES, SOURCES_BY_LEAGUE } from './sources'
import { refreshStats, STATS_DERIVED_STEP } from './sync'
import type { LinkLinesFiles, LinkSideFiles } from './links/protocol'
import { writeLinkedLines, writeLinkSide } from './links/side'

/**
 * The table the status line reads its date from: the last day with a played game in the league's own
 * `game` table, since that is what every screen can show. Not a source's box scores, which can run a
 * day ahead of the schedule that decides a game is played (ESPN's file had Nov 21, 2026's six NBA games
 * while the NBA's schedule had no score for them yet, so every screen stopped on Nov 20). Before the
 * tables are built there is no date, and the line says what the load is doing instead.
 */
const LATEST_GAMES_TABLE = 'game'
const PAUSED_KEY = 'paused'

/**
 * The engine answers a team query over a throwaway schema, which proves the catalogue, the compiler and
 * DuckDB's window functions in the packaged worker.
 */
async function selfTestQuery(db: StatsDb, league: League): Promise<boolean> {
  await db.exec('CREATE SCHEMA IF NOT EXISTS self_test')
  await db.exec('SET search_path = self_test')
  try {
    const line = (team: number, wins: number): string =>
      `SELECT ${team} AS team_id, 2026 AS season, 'regular' AS game_type, DATE '2026-01-10' AS last_date,
              DATE '2026-01-10' AS game_date, 1 AS games, ${wins} AS wins, ${1 - wins} AS losses`
    await db.exec(`CREATE OR REPLACE TABLE team_season AS ${line(1, 1)} UNION ALL ${line(2, 0)}`)
    await db.exec('CREATE OR REPLACE TABLE team_game AS SELECT * FROM team_season')
    await db.exec(`CREATE OR REPLACE TABLE team AS
      SELECT 1 AS team_id, 2026 AS season, 'AAA' AS code, 'A' AS name
      UNION ALL SELECT 2, 2026, 'BBB', 'B'`)
    const result = await runQuery(
      db,
      { entity: 'team', metrics: ['team_win_pct'], scope: { seasons: [2026] } },
      { league, currentSeason: 2026 }
    )
    return (
      result.rows.map((r) => `${r.team} ${r.values.team_win_pct.percentile}`).join(',') ===
      'AAA 100,BBB 0'
    )
  } finally {
    await db.exec('SET search_path = main')
    await db.exec('DROP SCHEMA self_test CASCADE')
  }
}

/** The worker's state: the open database and what a refresh needs. Runnable in-process for tests. */
export interface StatsService {
  refresh(options: RefreshOptions): Promise<StatsSyncResult>
  selfTest(): Promise<SelfTestResult>
  status(): Promise<StatsStatus>
  /** What is loaded, for the Data panel. */
  data(): Promise<StatsDataReport>
  /** Stops a running load, and holds off any other until `resume`, across launches. */
  pause(): Promise<void>
  resume(): Promise<void>
  /** One SQL statement on its own connection, for scripts measuring a real load. */
  read(sql: string): Promise<Row[]>
  /** One query of the catalogue, on its own connection: it runs while a refresh writes. */
  query(query: StatsQuery): Promise<StatsResult>
  catalogue(): Promise<MetricInfo[]>
  /** What each season holds, newest first, for the scope bar. */
  seasons(): Promise<StatsSeason[]>
  /** Who a player is, for the dashboard; null for an id nobody has. */
  player(id: string): Promise<StatsPlayerInfo | null>
  /** Everyone with a page in the league, their last season and team, for the player search. */
  playerIndex(): Promise<StatsIndexedPlayer[]>
  /** Every game on a season's schedule, played or not, by date. */
  games(season: number): Promise<StatsGame[]>
  game(id: string): Promise<StatsGameDetail | null>
  /** The published standings of a season; empty before they start. */
  standings(season: number): Promise<StatsStanding[]>
  /**
   * A player's matchups in a season: from the pair file for a whole regular season, else from the game
   * matchups over the player's games in the scope.
   */
  matchups(player: string, season: number, scope?: StatsMatchupScope): Promise<StatsMatchups>
  /** Who guarded whom in a game, from the game matchups. */
  gameMatchups(game: string): Promise<StatsGameMatchups>
  /** Every official of a season and season types, with the league's totals over the same games. */
  officialsSeason(season: number, gameTypes: GameType[]): Promise<StatsOfficialsSeason>
  /** One official's seasons, each beside the league's totals; null for an id the file lacks. */
  officialCareer(official: string, gameTypes: GameType[]): Promise<StatsOfficialCareer | null>
  /** A team's groups of two to five players on the floor, from the plays. */
  onCourtUnits(
    team: string,
    season: number,
    scope: StatsOnCourtScope,
    size: number
  ): Promise<StatsOnCourtUnits>
  /** A player's team with a teammate on and off the floor, from the plays. */
  withOrWithout(
    player: string,
    teammate: string | null,
    season: number,
    scope: StatsOnCourtScope
  ): Promise<StatsWithOrWithout>
  /** A team's five-man units for a season and season type, with one dashboard's measures. */
  lineups(team: string, season: number, gameType: string, group: LineupGroup): Promise<StatsLineups>
  /** A player's bio, draft and combines, each combine measure ranked within its position group. */
  profile(player: string): Promise<StatsProfile>
  availability(players: string[]): Promise<StatsAvailability[]>
  /** The players' listings on the injury report for these games (T1601.4). */
  gameListings(games: string[], players: string[]): Promise<StatsGameListing[]>
  coaches(team: string, season: number): Promise<StatsCoach[]>
  /** The shots a chart draws, capped, with every shot of the scope counted by zone. */
  shots(request: StatsShotRequest): Promise<StatsShotChart>
  /** Who assisted whom, for a team or a player over a scope (Plan T905). */
  assists(request: StatsAssistRequest): Promise<StatsAssistNetwork>
  /** One game's scoring in order and its flow. */
  gameFlow(game: string): Promise<StatsGameFlow>
  /** The league's side of its pair, as Parquet in `dir`, for the links worker; null when none. */
  linkSide(dir: string, tag: string): Promise<LinkSideFiles | null>
  /** Metis's own season lines of the linked players named, as Parquet in `dir`. */
  linkLines(ids: number[], dir: string, tag: string): Promise<LinkLinesFiles | null>
  /**
   * Stops a refresh now: aborts its downloads, interrupts its statement and starts no other step. A
   * process must not exit while DuckDB runs a statement (Electron aborts), so closing cancels first.
   */
  cancel(): void
  close(): Promise<void>
}

export interface StatsServiceDeps {
  /** Free space beside the database; tests pass their own. */
  freeBytes?: (path: string) => number | null
}

export async function openStatsService(
  init: StatsWorkerInit,
  onStep: (entry: StatsLogEntry) => void = () => {},
  deps: StatsServiceDeps = {}
): Promise<StatsService> {
  // The league is this worker's context: resolved once, then handed to the engine and the builders.
  const league = leagueOf(init.league)
  const sources = SOURCES_BY_LEAGUE[league.id]
  // Before DuckDB opens anything: `stats.duckdb` becomes `stats-nba.duckdb` on the first start.
  adoptFormerStatsFile(init.dataDir, league)
  const path = statsFilePath(init.dataDir, league)
  // Files a closed app left mid-step are never read again.
  rmSync(init.tempDir, { recursive: true, force: true })
  mkdirSync(init.tempDir, { recursive: true })
  const db = await StatsDb.open(path, {
    tempDirectory: join(init.tempDir, 'duckdb'),
    memoryLimit: init.memoryLimit
  })
  await bootstrapStatsDb(db, new Date(), league)
  // Each read gets its own connection, so it runs while a refresh writes, never waits behind another
  // read, and its timeout interrupts only itself.
  const reading = new Set<StatsDb>()
  let seasonTablesBuilt = false
  const inFlight = new Set<Promise<unknown>>()
  let closing = false
  const read = async <T>(fn: (conn: StatsDb) => Promise<T>): Promise<T> => {
    if (closing) throw new Error('the stats database is closing')
    const conn = await db.connect()
    reading.add(conn)
    const run = fn(conn).finally(() => {
      reading.delete(conn)
      conn.close()
    })
    inFlight.add(run)
    void run.then(
      () => inFlight.delete(run),
      () => inFlight.delete(run)
    )
    return run
  }
  // Every metric's stability (Plan T1006), read once and kept until a refresh ends: it rides with the
  // catalogue, and its priors with each shrunk query, at no cost to either.
  let stability: Promise<Map<string, MetricStability>> | null = null
  const stabilityOf = (conn: StatsDb): Promise<Map<string, MetricStability>> => {
    stability ??= readStability(conn).catch((err) => {
      stability = null
      throw err
    })
    return stability
  }
  const free = deps.freeBytes ?? freeBytes
  // A new one for each refresh: a pause aborts one refresh and leaves the next able to run.
  let abort = new AbortController()
  let cancelled = false
  let busy = false
  let progress: StatsProgress | null = null
  /** Set once DuckDB invalidates the database: nothing more can be read until the next launch. */
  let invalidated = false
  let noRoom: StatsStatus['noRoom'] = null
  const storedPause = await db.get<{ value: string | null }>(
    'SELECT value FROM stats_settings WHERE key = ?',
    [PAUSED_KEY]
  )
  let paused = storedPause?.value === '1'
  // On its own connection: the refresh's connection may be inside a transaction.
  const savePaused = (value: boolean): Promise<void> =>
    read((conn) =>
      conn.exec('INSERT OR REPLACE INTO stats_settings VALUES (?, ?)', [
        PAUSED_KEY,
        value ? '1' : '0'
      ])
    )
  const service: StatsService = {
    async refresh(options) {
      noRoom = null
      if (paused || cancelled) return { steps: [] }
      const neededBytes = roomNeeded(league, databaseBytes(path))
      const available = free(path)
      if (neededBytes > 0 && available !== null && available < neededBytes) {
        noRoom = { neededBytes, freeBytes: available }
        return { steps: [] }
      }
      busy = true
      abort = new AbortController()
      try {
        const result = await refreshStats(
          {
            db,
            league,
            downloads: createDownloads({ dir: init.tempDir, signal: abort.signal }),
            onStep,
            onProgress: (p) => {
              progress = p
            },
            cancelled: () => cancelled || paused
          },
          options,
          sources
        )
        if (result.fatal !== undefined) invalidated = true
        return result
      } finally {
        busy = false
        progress = null
        // The models may have measured stability again.
        stability = null
      }
    },
    status: async () => {
      if (invalidated) {
        return {
          available: false,
          through: null,
          updatedAt: null,
          builtAt: null,
          busy: false,
          progress: null,
          paused,
          noRoom
        }
      }
      return read(async (reader) => {
        const updated = await reader.get<{ at: string | null }>(
          "SELECT max(finished_at) AS at FROM sync_log WHERE status = 'ok' AND rows_written > 0"
        )
        const built = await reader.get<{ at: string | null }>(
          `SELECT max(finished_at) AS at FROM sync_log WHERE source = '${STATS_DERIVED_STEP}' AND status = 'ok'`
        )
        const exists = await reader.get(
          "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
          [LATEST_GAMES_TABLE]
        )
        const latest = exists
          ? await reader.get<{ season: number; date: string | null }>(
              `SELECT season::INTEGER AS season, max(game_date)::VARCHAR AS date FROM ${LATEST_GAMES_TABLE}
               WHERE played GROUP BY season ORDER BY season DESC LIMIT 1`
            )
          : null
        return {
          available: true,
          through: latest?.date ? { season: latest.season, date: latest.date } : null,
          updatedAt: updated?.at ?? null,
          builtAt: built?.at ?? null,
          busy,
          progress,
          paused,
          noRoom
        }
      })
    },
    data: () =>
      read(async (reader) => {
        const heldRows = await reader.all<{
          source: string
          season: number
          rows_written: number
          bytes: number | null
          fetched_at: string
        }>('SELECT source, season, rows_written, bytes, fetched_at FROM source_state')
        const held = new Map<string, HeldFile>(
          heldRows.map((r) => [
            `${r.source}:${r.season}`,
            { rows: r.rows_written, bytes: r.bytes, fetchedAt: r.fetched_at }
          ])
        )
        const attemptRows = await reader.all<{
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
        return {
          families: summariseFamilies(
            sources,
            league.currentSeason(new Date()),
            held,
            attempts,
            LEFT_OUT_RELEASES
          ),
          databaseBytes: databaseBytes(path),
          freeBytes: free(path)
        }
      }),
    async pause() {
      paused = true
      await savePaused(true)
      if (busy) {
        abort.abort()
        db.interrupt()
      }
    },
    async resume() {
      paused = false
      await savePaused(false)
    },
    read: (sql) => read((reader) => reader.all(sql)),
    query: (query) =>
      read(async (reader) => {
        // Once there, the season tables stay (they are replaced in place, never dropped), so the
        // check runs until it first passes: it cost 4 ms of each query, and a Splits tab asks 31.
        if (!seasonTablesBuilt) {
          seasonTablesBuilt = !!(await reader.get(
            "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = 'player_season'"
          ))
        }
        if (!seasonTablesBuilt) throw new StatsQueryError(league.notBuilt)
        const priors = query.shrunk ? priorsOf(await stabilityOf(reader)) : undefined
        return runQuery(reader, query, {
          league,
          currentSeason: league.currentSeason(new Date()),
          priors
        })
      }),
    catalogue: () => read(async (reader) => catalogueInfo(league, await stabilityOf(reader))),
    seasons: () =>
      read(async (reader) => {
        const built = await reader.get(
          "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = 'team_game'"
        )
        if (!built) return []
        const held = await reader.all<{
          season: number
          game_type: GameType
          first_date: string
          last_date: string
          games: number
        }>(
          `SELECT season, game_type, min(game_date)::VARCHAR AS first_date,
                  max(game_date)::VARCHAR AS last_date, sum(box_games)::INTEGER // 2 AS games
           FROM team_game WHERE box_games > 0 GROUP BY 1, 2`
        )
        const teams = await reader.all<{
          season: number
          team_id: number
          code: string
          name: string
          conference: string | null
          division: string | null
        }>(
          // A college league's pickers list its Division I teams (D40): the 300 and more schools
          // outside it are opponents in its games, not teams of its own.
          `SELECT season, team_id, code, name, conference, division FROM team${
            league.divisionIOnly ? ' WHERE division_i' : ''
          } ORDER BY code`
        )
        const bySeason = new Map<number, StatsSeason>()
        for (const r of held) {
          const s = bySeason.get(r.season) ?? {
            season: r.season,
            firstDate: r.first_date,
            lastDate: r.last_date,
            types: [],
            teams: teams
              .filter((t) => t.season === r.season)
              .map((t) => ({
                id: String(t.team_id),
                code: t.code,
                name: t.name,
                conference: t.conference,
                division: t.division
              }))
          }
          if (r.first_date < s.firstDate) s.firstDate = r.first_date
          if (r.last_date > s.lastDate) s.lastDate = r.last_date
          s.types.push({ type: r.game_type, games: r.games })
          bySeason.set(r.season, s)
        }
        return [...bySeason.values()].sort((a, b) => b.season - a.season)
      }),
    player: (id) => read((reader) => readPlayer(reader, id)),
    playerIndex: () => read((reader) => readPlayerIndex(reader)),
    games: (season) => read((reader) => readGames(reader, season, league)),
    game: (id) => read((reader) => readGame(reader, id, league)),
    standings: (season) => read((reader) => readStandings(reader, season)),
    matchups: (player, season, scope) =>
      read((reader) => readMatchups(reader, player, season, scope)),
    // A league that publishes no matchups answers its reason (`League.unpublished`).
    gameMatchups: (game) =>
      league.unpublished.matchups
        ? Promise.resolve({ pairs: [], reason: league.unpublished.matchups })
        : read((reader) => readGameMatchups(reader, game, league)),
    officialsSeason: (season, gameTypes) =>
      read((reader) => readOfficialsSeason(reader, season, gameTypes, league)),
    officialCareer: (official, gameTypes) =>
      read((reader) => readOfficialCareer(reader, official, gameTypes, league)),
    onCourtUnits: (team, season, scope, size) =>
      read((reader) => readOnCourtUnits(reader, team, season, scope, size, league)),
    withOrWithout: (player, teammate, season, scope) =>
      read((reader) => readWithOrWithout(reader, player, teammate, season, scope, league)),
    profile: (player) => read((reader) => readProfile(reader, player, league)),
    lineups: (team, season, gameType, group) =>
      read((reader) => readLineups(reader, team, season, gameType, group)),
    availability: (players) => read((reader) => readAvailability(reader, players)),
    gameListings: (games, players) => read((reader) => readGameListings(reader, games, players)),
    coaches: (team, season) => read((reader) => readCoaches(reader, team, season)),
    shots: (request) => read((reader) => readShotChart(reader, request, league)),
    assists: (request) => read((reader) => readAssistNetwork(reader, request, league)),
    gameFlow: (game) => read((reader) => readGameFlow(reader, game, league)),
    linkSide: (dir, tag) => read((reader) => writeLinkSide(reader, league, dir, tag)),
    linkLines: (ids, dir, tag) => read((reader) => writeLinkedLines(reader, league, ids, dir, tag)),
    /** Write, read, a Parquet round trip, `read_json` and an ICU time zone, through the real file. */
    async selfTest() {
      await db.exec('CREATE OR REPLACE TABLE self_test AS SELECT range AS x FROM range(1000)')
      const parquetPath = join(init.tempDir, 'self-test.parquet')
      await db.exec(`COPY self_test TO ${sqlString(parquetPath)} (FORMAT parquet)`)
      const back = await db.get<{ n: number }>(
        `SELECT count(*) AS n FROM read_parquet(${sqlString(parquetPath)})`
      )
      const jsonPath = join(init.tempDir, 'self-test.json')
      await db.exec(`COPY (SELECT 1 AS x) TO ${sqlString(jsonPath)} (FORMAT json)`)
      const json = await db.get<{ x: number }>(`SELECT x FROM read_json(${sqlString(jsonPath)})`)
      const icu = await db.get<{ hour: number }>(
        "SELECT hour(timezone('UTC', timezone('America/New_York', TIMESTAMP '2026-01-10 16:30'))) AS hour"
      )
      const version = await db.get<{ v: string }>('SELECT version() AS v')
      await db.exec('DROP TABLE self_test')
      return {
        duckdb: version?.v ?? '?',
        rows: back?.n ?? 0,
        parquet: back?.n === 1000,
        json: json?.x === 1,
        icu: icu?.hour === 21,
        query: await selfTestQuery(db, league)
      }
    },
    cancel() {
      cancelled = true
      abort.abort()
      db.interrupt()
      for (const conn of reading) conn.interrupt()
    },
    /** Refuses new reads, waits for the running ones (interrupted by `cancel`), then closes. */
    async close() {
      closing = true
      await Promise.allSettled([...inFlight])
      db.close()
    }
  }
  if (builds(league, 'derived')) {
    // A league whose plays or published tables are not built yet (the college leagues until
    // T1302.6) answers the reads of them with the reason, never an empty table or a recipe it lacks.
    const plays = builds(league, 'plays')
      ? null
      : offlineStats(league, notBuiltYet(league, 'plays'))
    // A league whose plays step builds its shots and lineups but not yet its play by play's tables
    // (the college leagues until T1302.7): the assists and the game flow read that reason.
    const playTables = buildsPlayTables(league)
      ? null
      : offlineStats(league, playTablesNotBuilt(league))
    const published = builds(league, 'published')
      ? null
      : offlineStats(league, notBuiltYet(league, 'published'))
    return {
      ...service,
      ...(plays && {
        officialCareer: plays.officialCareer,
        onCourtUnits: plays.onCourtUnits,
        withOrWithout: plays.withOrWithout,
        shots: plays.shots,
        assists: plays.assists,
        gameFlow: plays.gameFlow
      }),
      ...(!plays &&
        playTables && {
          assists: playTables.assists,
          gameFlow: playTables.gameFlow
        }),
      ...(published && {
        matchups: published.matchups,
        gameMatchups: published.gameMatchups,
        lineups: published.lineups,
        profile: published.profile,
        availability: published.availability,
        gameListings: published.gameListings,
        coaches: published.coaches
      })
    }
  }
  // A league whose game and season tables are not built yet loads and lists its files, and every
  // screen's read answers with the reason, never an error: its file has none of the tables they read
  // (its game, team and player tables may be there, but no screen reads them alone).
  const none = offlineStats(league, league.notBuilt)
  return {
    ...service,
    query: none.query,
    seasons: none.seasons,
    player: none.player,
    playerIndex: none.playerIndex,
    games: none.games,
    game: none.game,
    standings: none.standings,
    matchups: none.matchups,
    gameMatchups: none.gameMatchups,
    officialCareer: none.officialCareer,
    onCourtUnits: none.onCourtUnits,
    withOrWithout: none.withOrWithout,
    lineups: none.lineups,
    profile: none.profile,
    availability: none.availability,
    gameListings: none.gameListings,
    coaches: none.coaches,
    shots: none.shots,
    assists: none.assists,
    gameFlow: none.gameFlow,
    status: async () => ({ ...(await service.status()), noData: league.notBuilt })
  }
}
