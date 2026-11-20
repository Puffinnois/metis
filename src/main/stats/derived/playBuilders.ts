import { leagueOf, type League } from '@shared/leagues'
import type { StatsDb } from '../db'
import { COLLEGE_PBP_BUILDERS, collegePlayUnitsSql, onCourtTables } from './collegePbp'
import {
  COLLEGE_LINEUPS_BUILDER,
  COLLEGE_SHOT_KEY_BUILDER,
  collegeEventsSql,
  collegePlayerOnCourtFrom,
  collegeUnitGameSql
} from './collegePlays'
import { eventsSql } from './events'
import { PLAY_DETAIL_BUILDERS } from './playDetail'
import {
  ON_COURT_BUILDERS,
  PLAYER_ON_COURT,
  PLAYER_ON_COURT_COLUMNS,
  playerOnCourtFrom,
  UNIT_GAME,
  UNIT_GAME_COLUMNS
} from './onCourt'
import { espnPlaysViewSql, nbaPlaysSql, PLAY_COLUMNS, PLAY_TABLES, playsViewSql } from './plays'
import { NBA_PLAYS, playsRecipe } from './playsRecipe'
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
  /**
   * The rows of one season, as a SELECT of `columns` in order. What is missing reads NULL. The league
   * gives what differs by league, such as a period's length in that season.
   */
  select: (have: Have, season: number, league: League) => string
  /**
   * The order a season's rows are written in, game first. Rows of a game side by side compress
   * better (Plan T907 measured 8 to 26 % on the play, split, unit and on-court tables), and a read
   * of one game skips the row groups of the others.
   */
  order?: string
}

/** A season's INSERT for a builder, in its order when it has one. */
export function insertSql(b: PlayBuilder, have: Have, season: number, league: League): string {
  const select = b.select(have, season, league)
  // The SELECT's columns are named by position, since not every builder aliases each one.
  const names = b.columns.map(([n]) => n).join(', ')
  return b.order
    ? `INSERT INTO ${b.table} SELECT * FROM (${select}) AS s(${names}) ORDER BY ${b.order}`
    : `INSERT INTO ${b.table} ${select}`
}

export const PLAY_BUILDERS: PlayBuilder[] = [
  { table: PLAY_TABLES.nba, columns: PLAY_COLUMNS, select: nbaPlaysSql, order: 'game_id, seq' },
  // ESPN's plays are not stored: `play_espn` is a view (`espnPlaysViewSql`), made after the builders.
  // Shots by zone, band and type (Plan T903): they read the season's `play_nba` for assists.
  ...SHOT_BUILDERS,
  // Plan T902: the splits of each game, counted from `play_nba` of the same season.
  ...SPLIT_BUILDERS,
  // Who was on the floor (Plan T904): `unit_game`, then `player_on_court`, which reads it.
  ...ON_COURT_BUILDERS,
  // Plan T905: turnover and foul kinds, and-ones, assists by value, fouls drawn and the game flow.
  ...PLAY_DETAIL_BUILDERS
]

const UNIT_ORDER = 'game_id, team_id, p1, p2, p3, p4, p5'
const PLAYER_ORDER = 'game_id, team_id, player_id'

/**
 * The college leagues' builders (`PlaysRecipe.builders`), one list for both, by where their on-court
 * screens read from (`League.onCourtFrom`): each shot's team and shooter (`shot_key`) and the shot
 * tables from stats.ncaa.org's shots; the ten on the floor at each play (`play_lineup`) and the play
 * table from its play by play (`collegePbp.ts`); the splits; the units and player-games from its lineup
 * file and, beside them, credited play by play (`onCourtTables` names which one the screens read); the
 * lineups tab from the units read; and the play-derived counts and game flow.
 */
function collegePlayBuilders(league: League): PlayBuilder[] {
  const lineups = onCourtTables(league, 'lineups')
  const plays = onCourtTables(league, 'plays')
  return [
    COLLEGE_SHOT_KEY_BUILDER,
    ...SHOT_BUILDERS,
    ...COLLEGE_PBP_BUILDERS,
    ...SPLIT_BUILDERS,
    {
      table: lineups.units,
      columns: UNIT_GAME_COLUMNS,
      select: collegeUnitGameSql,
      order: UNIT_ORDER
    },
    {
      table: plays.units,
      columns: UNIT_GAME_COLUMNS,
      select: collegePlayUnitsSql,
      order: UNIT_ORDER
    },
    {
      table: lineups.players,
      columns: PLAYER_ON_COURT_COLUMNS,
      select: collegePlayerOnCourtFrom(lineups.units),
      order: PLAYER_ORDER
    },
    {
      table: plays.players,
      columns: PLAYER_ON_COURT_COLUMNS,
      select: playerOnCourtFrom(plays.units),
      order: PLAYER_ORDER
    },
    COLLEGE_LINEUPS_BUILDER,
    ...PLAY_DETAIL_BUILDERS
  ]
}

/** The college leagues' builders with the on-court screens on the lineup file, as both read today. */
export const COLLEGE_PLAY_BUILDERS: readonly PlayBuilder[] = collegePlayBuilders(leagueOf('ncaam'))
const COLLEGE_ON_PLAYS: readonly PlayBuilder[] = collegePlayBuilders({
  ...leagueOf('ncaam'),
  onCourtFrom: 'plays'
})

/** The builders a league's plays step runs, in order. */
export const playBuildersOf = (league?: League): readonly PlayBuilder[] => {
  if (!league || playsRecipe(league).builders !== 'college') return PLAY_BUILDERS
  return league.onCourtFrom === 'plays' ? COLLEGE_ON_PLAYS : COLLEGE_PLAY_BUILDERS
}

/**
 * The NBA recipe's version. Each league's recipe keeps its own (`playsRecipe(league).version`): bump
 * the league's when its rows change, every recipe's when a builder's do, so the next refresh rebuilds
 * every season of every table.
 */
export const PLAYS_VERSION = NBA_PLAYS.version

/** A file of season 0 holds every season. */
const ALL = 0
const PENDING = 'plays:'

/** The identity tables the plays are keyed to. */
const NEEDS = ['game', 'team', 'player', 'player_ids']

export async function canBuildPlays(db: StatsDb): Promise<boolean> {
  const have = await inspect(db)
  return NEEDS.every((t) => have.tables.has(t))
}

export async function playsStale(db: StatsDb, league?: League): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'plays'"
  )
  return (row?.version ?? 0) < playsRecipe(league).version
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
export async function playsDue(db: StatsDb, league?: League): Promise<boolean> {
  return (await playsStale(db, league)) || (await pendingSeasons(db)).length > 0
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
export async function seasonsToBuild(
  db: StatsDb,
  league?: League
): Promise<{ all: boolean; seasons: number[] }> {
  const played = (
    await db.all<{ season: number }>(
      'SELECT DISTINCT season FROM game WHERE played AND season IS NOT NULL ORDER BY season'
    )
  ).map((r) => r.season)
  const pending = await pendingSeasons(db)
  let all = (await playsStale(db, league)) || pending.includes(ALL)
  for (const b of playBuildersOf(league)) {
    if (all) break
    all = !(await shaped(db, b))
  }
  return { all, seasons: all ? played : played.filter((s) => pending.includes(s)) }
}

/**
 * Rebuilds what is due, season by season, each in one transaction per table, then the views
 * (ESPN's plays first, which are only a view). A
 * table of another shape is created empty first, and a full rebuild drops seasons no longer played.
 * After each season DuckDB is asked to checkpoint, so the space of the rows it deleted is reused
 * before the next season is written. Returns the rows written.
 */
export async function buildPlays(db: StatsDb, league: League): Promise<number> {
  const have = await inspect(db)
  const { all, seasons } = await seasonsToBuild(db, league)
  const builders = playBuildersOf(league)
  const college = playsRecipe(league).builders === 'college'
  let rows = 0
  // A database built before Plan T907 holds ESPN's plays as a table: drop it first, and checkpoint,
  // so its blocks are free before the seasons are written into them. Then the view in its place.
  const stored = await db.get(
    "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
    [PLAY_TABLES.espn]
  )
  if (stored) {
    await db.exec(`DROP TABLE ${PLAY_TABLES.espn}`)
    await checkpoint(db)
  }
  // The college leagues load no ESPN play by play (D42): their `play_espn` stays the empty view.
  if (!college) await db.exec(espnPlaysViewSql(have, league))
  // The on-court source the screens no longer read under its own name, left from before a switch.
  if (college) {
    for (const source of ['lineups', 'plays'] as const) {
      if (onCourtTables(league, source).units !== UNIT_GAME) continue
      await db.exec(`DROP TABLE IF EXISTS ${UNIT_GAME}_${source}`)
      await db.exec(`DROP TABLE IF EXISTS ${PLAYER_ON_COURT}_${source}`)
    }
  }
  for (const b of builders) {
    if (!(await shaped(db, b))) {
      await db.exec(
        `CREATE OR REPLACE TABLE ${b.table} (${b.columns.map(([n, t]) => `${n} ${t}`).join(', ')})`
      )
    }
  }
  for (const season of seasons) {
    for (const b of builders) {
      rows += await db.transaction(async () => {
        await db.exec(`DELETE FROM ${b.table} WHERE season = ?`, [season])
        await db.exec(insertSql(b, have, season, league))
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
    for (const b of builders) {
      await db.exec(`DELETE FROM ${b.table} WHERE season IS NULL OR season NOT IN (${kept})`)
    }
  }
  if (college) {
    await db.exec(playsViewSql(league))
    for (const sql of collegeEventsSql(have, league)) await db.exec(sql)
  } else {
    await db.exec(playsViewSql(league))
    for (const sql of eventsSql(have, league)) await db.exec(sql)
  }
  await db.transaction(async () => {
    await db.exec(`DELETE FROM derived_state WHERE name LIKE '${PENDING}%'`)
    await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', [
      'plays',
      playsRecipe(league).version
    ])
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
