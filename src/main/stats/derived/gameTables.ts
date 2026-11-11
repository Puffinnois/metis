import type { Entity } from '@shared/stats/types'
import { GAME_MATCHUP_COMPONENTS, GAME_MATCHUP_KEY, GAME_MATCHUPS } from './gameMatchups'
import { PLAYER_ON_COURT, PLAYER_ON_COURT_COMPONENTS } from './onCourt'

/**
 * A built table at game grain that answers published metrics under a filter that splits a season. The
 * engine joins it to the box-score rows in scope by player and game, so every filter on a game holds.
 * A metric names it in `publishedGames`; the table holds `game_id` and its `key`, and counts named as
 * the metric's `published` table names them. `docs/reference/stats-database.md`, "Game tables".
 */
export interface GameTable {
  table: string
  entity: Entity
  /** The column holding the player or team the engine sums by. */
  key: string
  /** What the engine can read from it; `games` is counted as the games with a row, not summed. */
  components: readonly string[]
}

export const GAME_TABLES: readonly GameTable[] = [
  {
    table: GAME_MATCHUPS,
    entity: 'player',
    key: GAME_MATCHUP_KEY,
    components: GAME_MATCHUP_COMPONENTS
  },
  // Built from the plays, so it answers whole seasons too: metrics name it as their `gameTable`.
  {
    table: PLAYER_ON_COURT,
    entity: 'player',
    key: 'player_id',
    components: PLAYER_ON_COURT_COMPONENTS
  }
]

export const gameTable = (name: string | undefined): GameTable | undefined =>
  name === undefined ? undefined : GAME_TABLES.find((t) => t.table === name)
