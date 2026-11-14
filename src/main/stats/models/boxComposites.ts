import type { ModelBuilder, ModelContext, ModelRows, ModelTable } from './build'
import type { Box, TeamSeason } from './box'
import { COMPOSITE_SUMS, seasonComposites, type CompositeLine } from './composites'
import { TEAM_STRENGTH_TABLE } from './teamStrength'

/**
 * Plan T1005: the box-score composites (Oliver's ratings, PER, Win Shares, BPM and VORP) of every
 * player and team, one row per team, season and season type. The regular season and the playoffs
 * are computed apart, each against its own league, as Basketball-Reference does; the play-in, the
 * Cup final, All-Star and preseason games count in neither. Team and league totals are the box-score
 * games: the same games as the player lines.
 */

export const PLAYER_COMPOSITE = 'player_composite'
export const TEAM_COMPOSITE = 'team_composite'

export const COMPOSITE_TYPES = ['regular', 'playoffs'] as const

/** Why a scope with neither has none. */
export const COMPOSITE_TYPES_REASON = 'Computed for the regular season and the playoffs only.'

const values: [string, string][] = COMPOSITE_SUMS.map((c) => [c, 'DOUBLE'])

export const COMPOSITE_TABLES: readonly ModelTable[] = [
  {
    table: PLAYER_COMPOSITE,
    entity: 'player',
    kind: 'sum',
    grain: 'season',
    columns: [
      ['season', 'INTEGER'],
      ['game_type', 'VARCHAR'],
      ['team_id', 'BIGINT'],
      ['player_id', 'BIGINT'],
      ...values
    ],
    components: COMPOSITE_SUMS,
    gameTypes: COMPOSITE_TYPES,
    typesReason: COMPOSITE_TYPES_REASON
  },
  {
    table: TEAM_COMPOSITE,
    entity: 'team',
    kind: 'sum',
    grain: 'season',
    columns: [['season', 'INTEGER'], ['game_type', 'VARCHAR'], ['team_id', 'BIGINT'], ...values],
    components: COMPOSITE_SUMS,
    gameTypes: COMPOSITE_TYPES,
    typesReason: COMPOSITE_TYPES_REASON
  }
]

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

type Row = Record<string, number | string | null>

const boxOf = (r: Row, prefix = ''): Box => ({
  mp: Number(r.mp ?? 0),
  ...(Object.fromEntries(COUNTS.map((c) => [c, Number(r[prefix + c] ?? 0)])) as Record<
    (typeof COUNTS)[number],
    number
  >)
})

/** The roster's position group as a place on BPM's scale: a guard 1.5, a forward 3.5, a center 5. */
const LISTED: Record<string, number> = { G: 1.5, F: 3.5, C: 5 }

/**
 * Team turnovers per team-game: a shot-clock violation or an eight-second call, charged to no player.
 * The box score's team turnovers are its players' sum and leave them out; Basketball-Reference's team
 * totals count them, and so do possessions. From the NBA's play by play (`tov_team`) from 1996-97,
 * and before it from ESPN's team box score, whose `team_turnovers` less `turnovers` equals the play by
 * play's count on all but 3 of 8,508 team-games of 1996-97 to 1999-2000. ESPN has no team box score
 * for 156 team-games of 1995-96; their team turnovers count as none. A missing table reads as none.
 */
function teamTurnovers(ctx: ModelContext): string {
  const parts: string[] = []
  if (ctx.have.tables.has('play_team_game')) {
    parts.push('SELECT game_id, team_id, tov_team AS team_tov FROM play_team_game')
  }
  if (ctx.have.tables.has('src_espn_team_box') && ctx.season < 1997) {
    parts.push(`SELECT g.game_id,
               CASE b.team_home_away WHEN 'home' THEN g.home_team_id ELSE g.away_team_id END,
               b.team_turnovers - b.turnovers
        FROM src_espn_team_box b JOIN game g ON g.espn_game_id = b.game_id
        WHERE b.season = b.file_season AND b.season = ${ctx.season}
          AND b.team_turnovers >= b.turnovers`)
  }
  return parts.length
    ? parts.join(' UNION ALL ')
    : 'SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS team_id, NULL::DOUBLE AS team_tov'
}

/**
 * Each team's season with team turnovers added to its own and its opponents' counts. The opponents
 * play the same minutes.
 */
async function teamSeasons(ctx: ModelContext, gameType: string): Promise<Map<number, TeamSeason>> {
  const own = COUNTS.map((c) => `coalesce(sum(t.${c}), 0)::DOUBLE AS ${c}`)
  const opp = COUNTS.map((c) => `coalesce(sum(t.opp_${c}), 0)::DOUBLE AS o_${c}`)
  const rows = await ctx.db.all<Row>(
    `WITH tt AS (${teamTurnovers(ctx)})
     SELECT t.team_id, count(*) AS games, coalesce(sum(t.minutes), 0)::DOUBLE AS mp,
            ${own.join(', ')}, ${opp.join(', ')},
            coalesce(sum(a.team_tov), 0)::DOUBLE AS team_tov,
            coalesce(sum(b.team_tov), 0)::DOUBLE AS opp_team_tov
     FROM team_game t
     LEFT JOIN tt a ON a.game_id = t.game_id AND a.team_id = t.team_id
     LEFT JOIN tt b ON b.game_id = t.game_id AND b.team_id = t.opponent_id
     WHERE t.season = ? AND t.game_type = ? AND t.box_games = 1
     GROUP BY 1`,
    [ctx.season, gameType]
  )
  const teams = new Map<number, TeamSeason>()
  for (const r of rows) {
    const team = boxOf(r)
    const o = boxOf(r, 'o_')
    teams.set(Number(r.team_id), {
      team: { ...team, tov: team.tov + Number(r.team_tov) },
      opp: { ...o, mp: team.mp, tov: o.tov + Number(r.opp_team_tov) },
      games: Number(r.games)
    })
  }
  return teams
}

/** Every player's line with each team, from the same box-score games. */
async function playerLines(ctx: ModelContext, gameType: string): Promise<CompositeLine[]> {
  const sums = COUNTS.map((c) => `coalesce(sum(${c}), 0)::DOUBLE AS ${c}`)
  const rows = await ctx.db.all<Row>(
    `SELECT player_id, team_id, mode(position) AS position, sum(minutes)::DOUBLE AS mp,
            ${sums.join(', ')}
     FROM player_game WHERE season = ? AND game_type = ?
     GROUP BY 1, 2 HAVING sum(minutes) > 0`,
    [ctx.season, gameType]
  )
  return rows.map((r) => ({
    playerId: Number(r.player_id),
    teamId: Number(r.team_id),
    box: boxOf(r),
    listed: LISTED[String(r.position)] ?? null
  }))
}

/**
 * The strength of each team's opponents, points per game: the mean, over its games of this type, of
 * each opponent's SRS at the end of the regular season (Plan T1001). For the regular season it is
 * the SOS T1001 solves; for the playoffs it weighs the opponents met. None when T1001 has no table.
 */
async function schedule(ctx: ModelContext, gameType: string): Promise<Map<number, number>> {
  // Asked, not read from `ctx.have`: the step takes that before it creates T1001's table.
  const exists = await ctx.db.get(
    "SELECT 1 FROM duckdb_tables() WHERE schema_name = 'main' AND table_name = ?",
    [TEAM_STRENGTH_TABLE]
  )
  if (!exists) return new Map()
  const rows = await ctx.db.all<{ team_id: number; sos: number }>(
    `WITH final AS (
       SELECT team_id, arg_max(srs, game_date) AS srs FROM ${TEAM_STRENGTH_TABLE}
       WHERE season = ? GROUP BY 1
     )
     SELECT t.team_id, avg(f.srs) AS sos
     FROM team_game t JOIN final f ON f.team_id = t.opponent_id
     WHERE t.season = ? AND t.game_type = ? AND t.box_games = 1
     GROUP BY 1`,
    [ctx.season, ctx.season, gameType]
  )
  return new Map(rows.map((r) => [Number(r.team_id), Number(r.sos)]))
}

const finite = (x: number): number | null => (Number.isFinite(x) ? x : null)

async function build(ctx: ModelContext): Promise<ModelRows> {
  const players: Record<string, unknown>[] = []
  const teams: Record<string, unknown>[] = []
  for (const gameType of COMPOSITE_TYPES) {
    const seasons = await teamSeasons(ctx, gameType)
    if (seasons.size === 0) continue
    const result = seasonComposites(
      await playerLines(ctx, gameType),
      seasons,
      await schedule(ctx, gameType)
    )
    const keys = { season: ctx.season, game_type: gameType }
    for (const p of result.players) {
      // The engine adds a traded player's teams itself, so only the rows per team are stored.
      if (p.teamId === null) continue
      const row: Record<string, unknown> = { ...keys, team_id: p.teamId, player_id: p.playerId }
      for (const c of COMPOSITE_SUMS) row[c] = finite(p[c])
      players.push(row)
    }
    for (const t of result.teams) {
      const row: Record<string, unknown> = { ...keys, team_id: t.teamId }
      for (const c of COMPOSITE_SUMS) row[c] = finite(t[c])
      teams.push(row)
    }
  }
  return { [PLAYER_COMPOSITE]: players, [TEAM_COMPOSITE]: teams }
}

export const COMPOSITES_BUILDER: ModelBuilder = {
  name: 'box_composites',
  version: 1,
  tables: COMPOSITE_TABLES,
  build
}
