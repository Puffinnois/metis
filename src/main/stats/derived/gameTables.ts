import type { Entity } from '@shared/stats/types'
import { GAME_MATCHUP_COMPONENTS, GAME_MATCHUP_KEY, GAME_MATCHUPS } from './gameMatchups'
import {
  isZeroCount,
  OPP_SHOT_COMPONENTS,
  SHOT_COMPONENTS,
  SHOT_PLAYER_GAME,
  SHOT_TEAM_GAME
} from './shots'

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
  /**
   * The counts that read 0, not null, for a row in scope with no row here: a player who took no shot
   * took none from the corner either. Only the built tables say so.
   */
  zero?: (component: string) => boolean
}

export const GAME_TABLES: readonly GameTable[] = [
  {
    table: GAME_MATCHUPS,
    entity: 'player',
    key: GAME_MATCHUP_KEY,
    components: GAME_MATCHUP_COMPONENTS
  },
  {
    table: SHOT_PLAYER_GAME,
    entity: 'player',
    key: 'player_id',
    components: SHOT_COMPONENTS,
    zero: isZeroCount
  },
  {
    table: SHOT_TEAM_GAME,
    entity: 'team',
    key: 'team_id',
    components: [...SHOT_COMPONENTS, ...OPP_SHOT_COMPONENTS],
    zero: isZeroCount
  }
]

export const gameTable = (name: string | undefined): GameTable | undefined =>
  name === undefined ? undefined : GAME_TABLES.find((t) => t.table === name)
