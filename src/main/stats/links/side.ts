import { join } from 'node:path'
import { pairOf, type League } from '@shared/leagues'
import { sqlString, type StatsDb } from '../db'
import type { LinkLinesFiles, LinkSideFiles } from './protocol'
import { COLLEGE_PLAYERS_SQL, draftSql, proPlayersSql } from './sql'

const hasTable = async (db: StatsDb, table: string): Promise<boolean> =>
  !!(await db.get(
    "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
    [table]
  ))

const copy = (db: StatsDb, select: string, path: string): Promise<void> =>
  db.exec(`COPY (${select}) TO ${sqlString(path)} (FORMAT parquet, COMPRESSION zstd)`)

/**
 * A league's side of its pair, written by its own worker from its own file as Parquet in the hand-over
 * folder, for the links worker to load (D47: no worker opens another's file). The professional side is
 * its players with their ESPN ids, birth dates and colleges, and its draft lines; the college side its
 * players with their teams. Null when the league is in no pair or its player table is not built yet.
 * Read on its own connection: it never waits behind a refresh, and writes nothing to the league's file.
 */
export async function writeLinkSide(
  db: StatsDb,
  league: League,
  dir: string,
  tag: string
): Promise<LinkSideFiles | null> {
  const pair = pairOf(league.id)
  if (!pair || !league.identity) return null
  if (!(await hasTable(db, 'player'))) return null
  const players = join(dir, `${league.id}-${tag}-players.parquet`)
  if (pair.college === league.id) {
    if (!(await hasTable(db, 'player_season')) || !(await hasTable(db, 'team'))) return null
    await copy(db, `${COLLEGE_PLAYERS_SQL} ORDER BY col_id`, players)
    return { league: league.id, side: 'college', players, draft: null }
  }
  await copy(db, `${proPlayersSql(league.identity)} ORDER BY pro_id`, players)
  let draft: string | null = null
  if (await hasTable(db, pair.proDraftTable)) {
    draft = join(dir, `${league.id}-${tag}-draft.parquet`)
    await copy(db, `${draftSql(pair.proDraftTable)} ORDER BY pro_id, label`, draft)
  }
  return { league: league.id, side: 'pro', players, draft }
}

/**
 * Metis's own season lines of the league's linked players, every column of `player_season`, every
 * season type and team, with the team rows they name: kept in the links file so a league removed later
 * still shows its linked careers (D47). The whole row is kept because it is what the league's own
 * player page reads, so a later screen shows the same numbers; it is about 300 KB for the NBA's 379
 * linked players (`player-links.md`). Null when the league's season tables are not built.
 */
export async function writeLinkedLines(
  db: StatsDb,
  league: League,
  ids: readonly number[],
  dir: string,
  tag: string
): Promise<LinkLinesFiles | null> {
  if (!(await hasTable(db, 'player_season')) || !(await hasTable(db, 'team'))) return null
  // Ids are integers from the links file, so they are written into the statement as numbers.
  const list =
    ids.length === 0 ? 'NULL' : ids.map((id) => String(Math.trunc(Number(id)))).join(', ')
  const seasons = join(dir, `${league.id}-${tag}-seasons.parquet`)
  const teams = join(dir, `${league.id}-${tag}-teams.parquet`)
  await copy(
    db,
    `SELECT * FROM player_season WHERE player_id IN (${list})
     ORDER BY player_id, season, game_type, team_id NULLS FIRST`,
    seasons
  )
  await copy(
    db,
    `SELECT * FROM team t WHERE EXISTS (SELECT 1 FROM player_season s
       WHERE s.team_id = t.team_id AND s.season = t.season AND s.player_id IN (${list}))
     ORDER BY team_id, season`,
    teams
  )
  return { league: league.id, seasons, teams }
}
