import { LEAGUES, pairOf, type LeagueId, type LeaguePair } from '@shared/leagues'
import type {
  GameType,
  StatsDraftLine,
  StatsLinkMethod,
  StatsOtherCareer,
  StatsOtherSeason
} from '@shared/stats/types'
import { sqlIdent, type StatsDb } from '../db'
import { draftLinesSql, type PairTables } from './sql'
import { pairTables, keptSeasonTable, keptTeamTable, tableExists } from './tables'

/** The source labels the read names (the manager's wording of 2026-11-21). */
export const ESPN_PRO_LABEL = "ESPN's season totals, regular season"
export const ESPN_COLLEGE_LABEL = "ESPN's season totals, every game"
export const METIS_LABEL = "Metis's own season lines"

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

interface LinkRow {
  college_id: number
  college_espn: number | null
  college_name: string
  pro_id: number | null
  pro_espn: number | null
  pro_name: string
  method: StatsLinkMethod
  draft_label: number | null
}

async function draftLine(
  db: StatsDb,
  pair: LeaguePair,
  t: PairTables,
  proId: number,
  label: number | null
): Promise<StatsDraftLine | null> {
  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM (${draftLinesSql(t)}) d WHERE pro_id = ? ${label === null ? '' : 'AND label = ?'}
     ORDER BY label DESC LIMIT 1`,
    label === null ? [proId] : [proId, label]
  )
  if (!row) return null
  return {
    league: pair.pro,
    draftYear: Number(row.label) - pair.proLabelAhead,
    round: num(row.round),
    roundPick: num(row.round_pick),
    overallPick: num(row.overall_pick),
    team: (row.team as string | null) ?? null,
    organization: (row.organization as string | null) ?? null,
    organizationType: (row.organization_type as string | null) ?? null
  }
}

/** Metis's own lines of a player in a league, as kept in the links file: one row a season type. */
async function keptSeasons(
  db: StatsDb,
  league: LeagueId,
  player: number
): Promise<StatsOtherSeason[]> {
  const seasons = keptSeasonTable(league)
  if (!(await tableExists(db, seasons))) return []
  const teams = keptTeamTable(league)
  const teamName = (await tableExists(db, teams))
    ? `(SELECT t.name FROM ${sqlIdent(teams)} t WHERE t.team_id = s.team_id AND t.season = s.season)`
    : 'CAST(s.team_id AS VARCHAR)'
  const rows = await db.all<Record<string, unknown>>(
    `WITH lines AS (SELECT * FROM ${sqlIdent(seasons)} WHERE player_id = ? AND game_type <> 'preseason'),
     per_team AS (
       SELECT s.season, s.game_type, list(${teamName} ORDER BY s.last_date, s.team_id) AS teams
       FROM lines s WHERE s.team_id IS NOT NULL GROUP BY 1, 2
     )
     SELECT l.*, coalesce(p.teams, []) AS team_names
     FROM lines l LEFT JOIN per_team p USING (season, game_type)
     WHERE l.team_id IS NULL ORDER BY l.season, l.game_type`,
    [player]
  )
  return rows.map((r) => ({
    season: Number(r.season),
    gameType: r.game_type as GameType,
    teams: ((r.team_names as (string | null)[]) ?? []).filter((t): t is string => t !== null),
    teamsInOrder: true,
    games: num(r.games),
    starts: num(r.starts),
    minutes: num(r.minutes),
    pts: num(r.pts),
    reb: num(r.reb),
    oreb: num(r.oreb),
    ast: num(r.ast),
    stl: num(r.stl),
    blk: num(r.blk),
    tov: num(r.tov),
    pf: num(r.pf),
    fgm: num(r.fgm),
    fga: num(r.fga),
    fg3m: num(r.fg3m),
    fg3a: num(r.fg3a),
    ftm: num(r.ftm),
    fta: num(r.fta)
  }))
}

/**
 * ESPN's season totals of a player from a paired file (one row a stat, makes and attempts as text,
 * `412-911`), a row a season. The totals category, with games, starts and minutes from the averages.
 */
async function espnSeasons(
  db: StatsDb,
  table: string | null,
  espn: number
): Promise<StatsOtherSeason[]> {
  if (!table) return []
  const total = (stat: string): string =>
    `max(value) FILTER (WHERE category = 'totals' AND stat_name = '${stat}')`
  const part = (prefix: string, i: 1 | 2): string =>
    `max(TRY_CAST(split_part(display_value, '-', ${i}) AS DOUBLE)) FILTER (WHERE category = 'totals' AND stat_name LIKE '${prefix}-%')`
  const avg = (stat: string): string =>
    `max(value) FILTER (WHERE category = 'averages' AND stat_name = '${stat}')`
  const rows = await db.all<Record<string, unknown>>(
    // Every team the file names for the season, never one picked: it gives no order between them.
    `SELECT season, list_sort(list_distinct(list(team_display_name))) AS teams,
       ${avg('gamesPlayed')} AS games, ${avg('gamesStarted')} AS starts, ${avg('avgMinutes')} AS mpg,
       ${total('points')} AS pts, ${total('totalRebounds')} AS reb, ${total('offensiveRebounds')} AS oreb,
       ${total('assists')} AS ast, ${total('steals')} AS stl, ${total('blocks')} AS blk,
       ${total('turnovers')} AS tov, ${total('fouls')} AS pf,
       ${part('fieldGoalsMade', 1)} AS fgm, ${part('fieldGoalsMade', 2)} AS fga,
       ${part('threePointFieldGoalsMade', 1)} AS fg3m, ${part('threePointFieldGoalsMade', 2)} AS fg3a,
       ${part('freeThrowsMade', 1)} AS ftm, ${part('freeThrowsMade', 2)} AS fta
     FROM ${sqlIdent(table)} WHERE athlete_id = ? GROUP BY season ORDER BY season`,
    [espn]
  )
  return rows.map((r) => {
    const games = num(r.games)
    const mpg = num(r.mpg)
    const teams = ((r.teams as (string | null)[] | null) ?? []).filter(
      (t): t is string => t !== null
    )
    return {
      season: Number(r.season),
      gameType: null,
      teams,
      // One team is the season's last (the file names the team a player ended with); several have
      // no order the file gives.
      teamsInOrder: teams.length <= 1,
      games,
      starts: num(r.starts),
      // ESPN publishes minutes a game, rounded to a tenth; the total is that times the games.
      minutes: games !== null && mpg !== null ? Math.round(games * mpg * 10) / 10 : null,
      pts: num(r.pts),
      reb: num(r.reb),
      oreb: num(r.oreb),
      ast: num(r.ast),
      stl: num(r.stl),
      blk: num(r.blk),
      tov: num(r.tov),
      pf: num(r.pf),
      fgm: num(r.fgm),
      fga: num(r.fga),
      fg3m: num(r.fg3m),
      fg3a: num(r.fg3a),
      ftm: num(r.ftm),
      fta: num(r.fta)
    }
  })
}

/** Why a professional player has no link, where the data knows it (`player-links.md`, Part 1). */
async function proReason(
  db: StatsDb,
  pair: LeaguePair,
  t: PairTables,
  player: number
): Promise<StatsOtherCareer['reason']> {
  const college = LEAGUES[pair.college]
  const before = `No ${college.name} record in Metis: its seasons start in ${college.seasonLabel(pair.collegeFrom)}.`
  const draft = await draftLine(db, pair, t, player, null)
  if (draft) {
    if (draft.organizationType === 'Other Team/Club') {
      return {
        kind: 'drafted-abroad',
        text: `Drafted from ${draft.organization ?? 'a club'}, not a college.`
      }
    }
    if (draft.organizationType === 'College/University' && draft.draftYear < pair.collegeFrom) {
      return { kind: 'college-before-window', text: before }
    }
  } else {
    const side = await db.get<{ first_season: number | null; school: string | null }>(
      `SELECT first_season, school FROM ${sqlIdent(t.proSide)} WHERE pro_id = ?`,
      [player]
    )
    if (
      side?.school &&
      side.first_season !== null &&
      side.first_season - pair.proLabelAhead < pair.collegeFrom
    ) {
      return { kind: 'college-before-window', text: before }
    }
  }
  return { kind: 'no-link', text: `No linked ${college.name} career.` }
}

/**
 * A player's other career (T1304.2's read): from the league's pair, the player's link, the draft line,
 * and the other league's seasons, Metis's own where they are kept, else ESPN's totals of the paired
 * download, with the source named; or the reason there is none. Reads only the links file.
 */
export async function readOtherCareer(
  db: StatsDb,
  league: LeagueId,
  player: string
): Promise<StatsOtherCareer> {
  const pair = pairOf(league)
  const none = (reason: StatsOtherCareer['reason'], other: LeagueId | null): StatsOtherCareer => ({
    league: other,
    link: null,
    draft: null,
    source: null,
    seasons: [],
    reason
  })
  if (!pair) {
    return none(
      { kind: 'no-pair', text: `The ${LEAGUES[league].name} is linked to no other league.` },
      null
    )
  }
  const isCollege = pair.college === league
  const other = isCollege ? pair.pro : pair.college
  const id = Number(player)
  if (!Number.isFinite(id)) {
    return none({ kind: 'no-link', text: `No linked ${LEAGUES[other].name} career.` }, other)
  }
  const t = await pairTables(db, pair)
  const link = await db.get<LinkRow>(
    isCollege
      ? 'SELECT * FROM player_link WHERE college = ? AND college_id = ?'
      : 'SELECT * FROM player_link WHERE pro = ? AND pro_id = ?',
    [league, id]
  )
  if (!link) {
    if (isCollege) {
      return none({ kind: 'no-link', text: `No linked ${LEAGUES[other].name} career.` }, other)
    }
    return {
      ...none(await proReason(db, pair, t, id), other),
      draft: await draftLine(db, pair, t, id, null)
    }
  }
  const draftId = link.pro_id
  const draft = draftId === null ? null : await draftLine(db, pair, t, draftId, link.draft_label)
  const otherId = isCollege ? link.pro_id : link.college_id
  const otherEspn = isCollege ? link.pro_espn : link.college_espn
  let seasons = otherId === null ? [] : await keptSeasons(db, other, Number(otherId))
  let source: StatsOtherCareer['source'] = { kind: 'metis', label: METIS_LABEL }
  if (seasons.length === 0) {
    seasons =
      otherEspn === null
        ? []
        : await espnSeasons(db, isCollege ? t.proEspn : t.collegeEspn, Number(otherEspn))
    source =
      seasons.length === 0
        ? null
        : { kind: 'espn', label: isCollege ? ESPN_PRO_LABEL : ESPN_COLLEGE_LABEL }
  }
  return {
    league: other,
    link: {
      method: link.method,
      playerId: otherId === null ? null : String(otherId),
      espnId: otherEspn === null ? null : Number(otherEspn),
      name: isCollege ? link.pro_name : link.college_name
    },
    draft,
    source,
    seasons,
    reason: null
  }
}
