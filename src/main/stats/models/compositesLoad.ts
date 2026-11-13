import type { StatsDb } from '../db'
import type { Box, TeamSeason } from './box'
import {
  COMPOSITE_SUMS,
  seasonComposites,
  type CompositeLine,
  type CompositeSums,
  type SeasonComposites
} from './composites'

/**
 * Reads the season tables the composites need and writes `player_composite` and `team_composite`
 * (Plan T1005). The regular season and the playoffs are computed apart, each against its own league,
 * as Basketball-Reference does; the play-in, the Cup final, All-Star and preseason games count in
 * neither. Team and league totals are the box-score games: the same games as the player lines.
 */

export const COMPOSITE_TYPES = ['regular', 'playoffs'] as const

const COUNTS = [
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf',
  'pts'
] as const

const box = (prefix: string): string =>
  COUNTS.map((c) => `coalesce(${prefix}${c}, 0)::DOUBLE AS ${c}`).join(', ')
const oppBox = COUNTS.map((c) => `coalesce(s.opp_${c}, 0)::DOUBLE AS o_${c}`).join(', ')

type BoxRow = Record<(typeof COUNTS)[number], number> & { mp: number }

const toBox = (r: BoxRow, prefix = ''): Box => {
  const get = (c: string): number => Number((r as Record<string, number>)[prefix + c] ?? 0)
  return {
    mp: Number(r.mp ?? 0),
    ...(Object.fromEntries(COUNTS.map((c) => [c, get(c)])) as Record<
      (typeof COUNTS)[number],
      number
    >)
  }
}

/** The roster's position group as a place on BPM's scale: a guard 1.5, a forward 3.5, a center 5. */
const LISTED: Record<string, number> = { G: 1.5, F: 3.5, C: 5 }

export interface SeasonKey {
  season: number
  gameType: (typeof COMPOSITE_TYPES)[number]
}

async function hasTable(db: StatsDb, table: string): Promise<boolean> {
  return (
    (await db.get("SELECT 1 FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?", [
      table
    ])) !== null
  )
}

export const TEAM_TURNOVERS = 'composite_team_tov'

/**
 * Team turnovers: a shot-clock violation or an eight-second call, charged to no player. The box
 * score's team turnovers are the players' sum and leave them out; Basketball-Reference's team totals
 * count them, and so do possessions. From the NBA's play by play (`tov_team`) from 1996-97, and
 * before it from ESPN's team box score, whose `team_turnovers` less `turnovers` equals the play by
 * play's count on 8,505 of 8,508 team-games of 1996-97 to 1999-2000. ESPN has no team box score for
 * 156 team-games of 1995-96; their team turnovers are not known and count as none. A missing table
 * reads as none.
 */
export async function prepareTeamTurnovers(db: StatsDb): Promise<void> {
  const parts: string[] = []
  if (await hasTable(db, 'play_team_game')) {
    parts.push('SELECT game_id, team_id, tov_team AS team_tov FROM play_team_game')
  }
  if (await hasTable(db, 'src_espn_team_box')) {
    parts.push(`SELECT g.game_id,
               CASE b.team_home_away WHEN 'home' THEN g.home_team_id ELSE g.away_team_id END,
               b.team_turnovers - b.turnovers
        FROM src_espn_team_box b JOIN game g ON g.espn_game_id = b.game_id
        WHERE b.season = b.file_season AND b.season < 1997 AND b.team_turnovers >= b.turnovers`)
  }
  const recorded = parts.length
    ? parts.join(' UNION ALL ')
    : 'SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS team_id, NULL::DOUBLE AS team_tov'
  await db.exec(`CREATE OR REPLACE TEMP TABLE ${TEAM_TURNOVERS} AS
    WITH recorded AS (${recorded})
    SELECT t.season, t.game_type, t.team_id,
           coalesce(sum(a.team_tov), 0)::DOUBLE AS team_tov,
           coalesce(sum(b.team_tov), 0)::DOUBLE AS opp_team_tov
    FROM team_game t
    LEFT JOIN recorded a ON a.game_id = t.game_id AND a.team_id = t.team_id
    LEFT JOIN recorded b ON b.game_id = t.game_id AND b.team_id = t.opponent_id
    WHERE t.box_games = 1 AND t.game_type IN ('regular', 'playoffs')
    GROUP BY 1, 2, 3`)
}

/** The lines and teams of one season and game type. Needs `prepareTeamTurnovers` first. */
export async function loadSeason(
  db: StatsDb,
  key: SeasonKey
): Promise<{ lines: CompositeLine[]; teams: Map<number, TeamSeason> }> {
  const teamRows = await db.all<
    BoxRow & { team_id: number; games: number; team_tov: number; opp_team_tov: number }
  >(
    `SELECT s.team_id, s.box_games AS games, coalesce(s.minutes, 0)::DOUBLE AS mp, ${box('s.')},
            ${oppBox}, coalesce(x.team_tov, 0) AS team_tov, coalesce(x.opp_team_tov, 0) AS opp_team_tov
     FROM team_season s
     LEFT JOIN ${TEAM_TURNOVERS} x USING (team_id, season, game_type)
     WHERE s.season = ? AND s.game_type = ? AND s.box_games > 0`,
    [key.season, key.gameType]
  )
  const teams = new Map<number, TeamSeason>()
  for (const r of teamRows) {
    const team = toBox(r)
    const opp = toBox(r, 'o_')
    teams.set(Number(r.team_id), {
      team: { ...team, tov: team.tov + Number(r.team_tov) },
      // The opponents play the same minutes.
      opp: { ...opp, tov: opp.tov + Number(r.opp_team_tov), mp: team.mp },
      games: Number(r.games)
    })
  }
  const lineRows = await db.all<BoxRow & { player_id: number; team_id: number; position: string }>(
    `SELECT player_id, team_id, position, coalesce(minutes, 0)::DOUBLE AS mp, ${box('')}
     FROM player_season
     WHERE season = ? AND game_type = ? AND team_id IS NOT NULL AND minutes > 0`,
    [key.season, key.gameType]
  )
  const lines = lineRows.map((r) => ({
    playerId: Number(r.player_id),
    teamId: Number(r.team_id),
    box: toBox(r),
    listed: LISTED[r.position] ?? null
  }))
  return { lines, teams }
}

/** The seasons and game types with box scores. */
export async function compositeSeasons(db: StatsDb): Promise<SeasonKey[]> {
  return db.all<SeasonKey>(
    `SELECT DISTINCT season, game_type AS gameType FROM team_season
     WHERE game_type IN ('regular', 'playoffs') AND box_games > 0 ORDER BY 1, 2`
  )
}

export const PLAYER_COMPOSITE = 'player_composite'
export const TEAM_COMPOSITE = 'team_composite'

const sumColumns = COMPOSITE_SUMS.map((c) => `${c} DOUBLE`).join(', ')

/** Creates both tables if they are missing. */
export async function createCompositeTables(db: StatsDb): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS ${PLAYER_COMPOSITE} (player_id BIGINT, season INTEGER,
       game_type VARCHAR, team_id BIGINT, ${sumColumns})`
  )
  await db.exec(
    `CREATE TABLE IF NOT EXISTS ${TEAM_COMPOSITE} (team_id BIGINT, season INTEGER,
       game_type VARCHAR, ${sumColumns})`
  )
}

const num = (x: number): string => (Number.isFinite(x) ? String(x) : 'NULL')

/** Inserts rows of numbers as VALUES lists, a thousand at a time. */
async function insert(db: StatsDb, table: string, rows: string[][]): Promise<void> {
  for (let i = 0; i < rows.length; i += 1000) {
    const values = rows
      .slice(i, i + 1000)
      .map((r) => `(${r.join(', ')})`)
      .join(',\n')
    await db.exec(`INSERT INTO ${table} VALUES ${values}`)
  }
}

/** Replaces one season and game type's rows in both tables. */
export async function writeSeason(
  db: StatsDb,
  key: SeasonKey,
  result: SeasonComposites
): Promise<number> {
  const type = `'${key.gameType}'`
  const where = `season = ${key.season} AND game_type = ${type}`
  await db.exec(`DELETE FROM ${PLAYER_COMPOSITE} WHERE ${where}`)
  await db.exec(`DELETE FROM ${TEAM_COMPOSITE} WHERE ${where}`)
  const sums = (r: CompositeSums): string[] => COMPOSITE_SUMS.map((c) => num(r[c]))
  await insert(
    db,
    PLAYER_COMPOSITE,
    result.players.map((p) => [
      String(p.playerId),
      String(key.season),
      type,
      p.teamId === null ? 'NULL' : String(p.teamId),
      ...sums(p)
    ])
  )
  await insert(
    db,
    TEAM_COMPOSITE,
    result.teams.map((t) => [String(t.teamId), String(key.season), type, ...sums(t)])
  )
  return result.players.length + result.teams.length
}

/** Computes and writes the given seasons (every season with box scores when none are named). */
export async function buildComposites(db: StatsDb, only?: readonly number[]): Promise<number> {
  await createCompositeTables(db)
  await prepareTeamTurnovers(db)
  const keys = (await compositeSeasons(db)).filter((k) => !only || only.includes(k.season))
  let rows = 0
  for (const key of keys) {
    const { lines, teams } = await loadSeason(db, key)
    rows += await writeSeason(db, key, seasonComposites(lines, teams))
  }
  return rows
}
