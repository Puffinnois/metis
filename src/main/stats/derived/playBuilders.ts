import type { StatsDb } from '../db'
import { eventsSql } from './events'
import { PLAY_DETAIL_BUILDERS } from './playDetail'
import { ON_COURT_BUILDERS } from './onCourt'
import { espnPlaysSql, nbaPlaysSql, PLAY_COLUMNS, PLAY_TABLES, playsViewSql } from './plays'
import { SHOT_BUILDERS } from './shots'
import { SPLIT_BUILDERS } from './splits'
import { inspect, type Have } from './sql'

/**
 * The tables built from plays, rebuilt at the end of a refresh, season by season.
 *
 * The rule for every builder: its table has a `season` column and holds counts, never rates, so a
 * season can be replaced on its own. A season is replaced in one transaction (its rows deleted, its
 * new rows inserted), so a reader sees it whole, old or new, never half. Builders run in order, so
 * one can read a table an earlier one built.
 *
 * Plan T902 to T905 add their built tables by appending one line to `PLAY_BUILDERS`.
 */
export interface PlayBuilder {
  table: string
  /** Every column, typed, `season INTEGER` among them. */
  columns: ReadonlyArray<readonly [string, string]>
  /** The rows of one season, as a SELECT of `columns` in order. What is missing reads NULL. */
  select: (have: Have, season: number) => string
}

export const PLAY_BUILDERS: PlayBuilder[] = [
  { table: PLAY_TABLES.nba, columns: PLAY_COLUMNS, select: nbaPlaysSql },
  { table: PLAY_TABLES.espn, columns: PLAY_COLUMNS, select: espnPlaysSql },
  // Shots by zone, band and type (Plan T903): they read the season's `play_nba` for assists.
  ...SHOT_BUILDERS,
  // Plan T902: the splits of each game, counted from `play_nba` of the same season.
  ...SPLIT_BUILDERS,
  // Who was on the floor (Plan T904): `unit_game`, then `player_on_court`, which reads it.
  ...ON_COURT_BUILDERS,
  // Plan T905: turnover and foul kinds, and-ones, assists by value, fouls drawn and the game flow.
  ...PLAY_DETAIL_BUILDERS
]

/** Bump when a builder's rows change, so the next refresh rebuilds every season of every table. */
export const PLAYS_VERSION = 5

/** A file of season 0 holds every season. */
const ALL = 0
const PENDING = 'plays:'

/** The identity tables the plays are keyed to. */
const NEEDS = ['game', 'team', 'player', 'player_ids']

export async function canBuildPlays(db: StatsDb): Promise<boolean> {
  const have = await inspect(db)
  return NEEDS.every((t) => have.tables.has(t))
}

export async function playsStale(db: StatsDb): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'plays'"
  )
  return (row?.version ?? 0) < PLAYS_VERSION
}

/**
 * Records that a file of this season wrote rows, so its season is rebuilt at the end of the refresh,
 * or on the next one if the app closes first. Season 0, a file of every season, rebuilds them all.
 */
export async function markPlaySeason(db: StatsDb, season: number): Promise<void> {
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, 0)', [`${PENDING}${season}`])
}

async function pendingSeasons(db: StatsDb): Promise<number[]> {
  const rows = await db.all<{ name: string }>(
    `SELECT name FROM derived_state WHERE name LIKE '${PENDING}%'`
  )
  return rows.map((r) => Number(r.name.slice(PENDING.length)))
}

/** Whether a build is due: a new version, or a season waiting. */
export async function playsDue(db: StatsDb): Promise<boolean> {
  return (await playsStale(db)) || (await pendingSeasons(db)).length > 0
}

/** Whether the table is there with exactly these columns and types, in order. */
async function shaped(db: StatsDb, b: PlayBuilder): Promise<boolean> {
  const rows = await db.all<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM duckdb_columns()
     WHERE schema_name = 'main' AND table_name = ? ORDER BY column_index`,
    [b.table]
  )
  return (
    rows.length === b.columns.length &&
    rows.every((r, i) => r.column_name === b.columns[i][0] && r.data_type === b.columns[i][1])
  )
}

/**
 * The seasons to rebuild: every season played when the version changed (a new database has none),
 * a table is of another shape, or a file of every season changed; else the seasons whose files
 * wrote rows. A table with no rows is not a reason: a source not loaded leaves one empty for good.
 */
export async function seasonsToBuild(db: StatsDb): Promise<{ all: boolean; seasons: number[] }> {
  const played = (
    await db.all<{ season: number }>(
      'SELECT DISTINCT season FROM game WHERE played AND season IS NOT NULL ORDER BY season'
    )
  ).map((r) => r.season)
  const pending = await pendingSeasons(db)
  let all = (await playsStale(db)) || pending.includes(ALL)
  for (const b of PLAY_BUILDERS) {
    if (all) break
    all = !(await shaped(db, b))
  }
  return { all, seasons: all ? played : played.filter((s) => pending.includes(s)) }
}

/**
 * Rebuilds what is due, season by season, each in one transaction per table, then the views. A
 * table of another shape is created empty first, and a full rebuild drops seasons no longer played.
 * After each season DuckDB is asked to checkpoint, so the space of the rows it deleted is reused
 * before the next season is written. Returns the rows written.
 */
export async function buildPlays(db: StatsDb): Promise<number> {
  const have = await inspect(db)
  const { all, seasons } = await seasonsToBuild(db)
  let rows = 0
  for (const b of PLAY_BUILDERS) {
    if (!(await shaped(db, b))) {
      await db.exec(
        `CREATE OR REPLACE TABLE ${b.table} (${b.columns.map(([n, t]) => `${n} ${t}`).join(', ')})`
      )
    }
  }
  for (const season of seasons) {
    for (const b of PLAY_BUILDERS) {
      rows += await db.transaction(async () => {
        await db.exec(`DELETE FROM ${b.table} WHERE season = ?`, [season])
        await db.exec(`INSERT INTO ${b.table} ${b.select(have, season)}`)
        const n = await db.get<{ n: number }>(
          `SELECT count(*)::INTEGER AS n FROM ${b.table} WHERE season = ?`,
          [season]
        )
        return n?.n ?? 0
      })
    }
    await checkpoint(db)
  }
  if (all) {
    const kept = seasons.length > 0 ? seasons.join(', ') : 'NULL'
    for (const b of PLAY_BUILDERS) {
      await db.exec(`DELETE FROM ${b.table} WHERE season IS NULL OR season NOT IN (${kept})`)
    }
  }
  await db.exec(playsViewSql())
  for (const sql of eventsSql(have)) await db.exec(sql)
  await db.transaction(async () => {
    await db.exec(`DELETE FROM derived_state WHERE name LIKE '${PENDING}%'`)
    await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', ['plays', PLAYS_VERSION])
  })
  return rows
}

async function checkpoint(db: StatsDb): Promise<void> {
  try {
    await db.exec('CHECKPOINT')
  } catch {
    // A read still running can refuse it; DuckDB checkpoints on its own later.
  }
}
