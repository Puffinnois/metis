import { LEAGUE_PAIRS, type LeagueId, type LeaguePair } from '@shared/leagues'
import type { StatsDb } from '../db'
import { bookkeepingBootstrap } from '../schema'
import { PAIRED_SOURCES_BY_LEAGUE } from '../sources'
import { COLLEGE_PLAYER_COLUMNS, DRAFT_COLUMNS, PRO_PLAYER_COLUMNS, type PairTables } from './sql'

/**
 * The links file's tables (D47). Each league's side as its worker last handed it over, kept when the
 * league is removed: `side_<league>_players` and a professional league's `side_<league>_draft`. The
 * paired files as loaded, `paired_<league>_<table>` (`PAIRED_SOURCES_BY_LEAGUE`). Metis's own lines of
 * linked players, `kept_<league>_season` and `kept_<league>_team`, every column as the league's file
 * has them. And `player_link`, the links of every pair.
 */
export const sidePlayersTable = (league: LeagueId): string => `side_${league}_players`
export const sideDraftTable = (league: LeagueId): string => `side_${league}_draft`
export const keptSeasonTable = (league: LeagueId): string => `kept_${league}_season`
export const keptTeamTable = (league: LeagueId): string => `kept_${league}_team`

export const PLAYER_LINK_COLUMNS = `college VARCHAR NOT NULL, pro VARCHAR NOT NULL,
  college_id BIGINT NOT NULL, college_espn BIGINT, college_name VARCHAR,
  pro_id BIGINT, pro_espn BIGINT, pro_name VARCHAR, method VARCHAR NOT NULL, draft_label INTEGER`

/** Created on every open: the bookkeeping a league's file has, the sides and the links. */
export function linksBootstrap(): string[] {
  const out = [...bookkeepingBootstrap()]
  for (const pair of LEAGUE_PAIRS) {
    out.push(
      `CREATE TABLE IF NOT EXISTS ${sidePlayersTable(pair.pro)} (${PRO_PLAYER_COLUMNS})`,
      `CREATE TABLE IF NOT EXISTS ${sideDraftTable(pair.pro)} (${DRAFT_COLUMNS})`,
      `CREATE TABLE IF NOT EXISTS ${sidePlayersTable(pair.college)} (${COLLEGE_PLAYER_COLUMNS})`
    )
  }
  out.push(`CREATE TABLE IF NOT EXISTS player_link (${PLAYER_LINK_COLUMNS})`)
  return out
}

export async function tableExists(db: StatsDb, table: string): Promise<boolean> {
  return !!(await db.get(
    "SELECT 1 AS yes FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
    [table]
  ))
}

/** The paired file of a kind a league brings, when it has been loaded. */
async function pairedTable(
  db: StatsDb,
  bringer: LeagueId,
  kind: 'season-stats' | 'draft'
): Promise<string | null> {
  const source = PAIRED_SOURCES_BY_LEAGUE[bringer].find((s) => s.kind === kind)
  if (!source) return null
  return (await tableExists(db, source.table)) ? source.table : null
}

/**
 * What the links file holds of a pair. ESPN's lines of the professional league are brought by the
 * college league, and the other way round; the draft by the college league.
 */
export async function pairTables(db: StatsDb, pair: LeaguePair): Promise<PairTables> {
  return {
    proSide: sidePlayersTable(pair.pro),
    proDraft: sideDraftTable(pair.pro),
    collegeSide: sidePlayersTable(pair.college),
    proEspn: await pairedTable(db, pair.college, 'season-stats'),
    collegeEspn: await pairedTable(db, pair.pro, 'season-stats'),
    pairedDraft: await pairedTable(db, pair.college, 'draft')
  }
}
