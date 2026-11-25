import { GAME_COUNTS } from '@shared/stats/highs'
import type { GameType, StatsPlayerGame, StatsPlayerGames } from '@shared/stats/types'
import type { StatsDb } from './db'
import { BUILT_AT_NEXT_REFRESH } from './engine/compile'

/**
 * Every game a player has a box-score line in, oldest first, with the counts their highs, streaks and
 * threshold games are worked out from (`@shared/stats/highs`, Plan T1703.3): a read of `player_game`,
 * nothing stored. A count the line lacks is null. Two games of one day stand in the order of their ids.
 * A file without the table answers no games and the engine's reason, never an error (#145).
 */
export async function readPlayerGames(db: StatsDb, player: string): Promise<StatsPlayerGames> {
  const held = new Set(
    (
      await db.all<{ name: string }>(
        "SELECT column_name AS name FROM duckdb_columns() WHERE schema_name = 'main' AND table_name = 'player_game'"
      )
    ).map((r) => r.name)
  )
  if (!held.has('player_id')) return { playerId: player, games: [], reason: BUILT_AT_NEXT_REFRESH }
  const counts = GAME_COUNTS.map((c) => (held.has(c) ? `p.${c}::INTEGER` : 'NULL::INTEGER'))
  const rows = await db.all<{
    game_id: string
    date: string
    season: number
    game_type: string
    team: string | null
    opponent_id: string | null
    opponent: string | null
    home: boolean | null
    won: boolean | null
    counts: (number | null)[]
  }>(
    `SELECT p.game_id, strftime(p.game_date, '%Y-%m-%d') AS date, p.season, p.game_type,
            t.code AS team, p.opponent_id::VARCHAR AS opponent_id, o.code AS opponent, p.home,
            CASE WHEN p.wins = 1 THEN true WHEN p.losses = 1 THEN false END AS won,
            [${counts.join(', ')}] AS counts
     FROM player_game p
     LEFT JOIN team t ON t.team_id = p.team_id AND t.season = p.season
     LEFT JOIN team o ON o.team_id = p.opponent_id AND o.season = p.season
     WHERE p.player_id = TRY_CAST(? AS BIGINT)
     ORDER BY p.game_date, p.game_id`,
    [player]
  )
  const games: StatsPlayerGame[] = rows.map((r) => ({
    gameId: r.game_id,
    date: r.date,
    season: Number(r.season),
    gameType: r.game_type as GameType,
    team: r.team,
    opponentId: r.opponent_id,
    opponent: r.opponent,
    home: r.home,
    won: r.won,
    counts: r.counts.map((x) => (x === null ? null : Number(x)))
  }))
  return { playerId: player, games, reason: null }
}
