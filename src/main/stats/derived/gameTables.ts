import type { Entity } from '@shared/stats/types'
import { GAME_MATCHUP_COMPONENTS, GAME_MATCHUP_KEY, GAME_MATCHUPS } from './gameMatchups'
import {
  isPlayDetailZero,
  PLAY_DETAIL_COUNTS,
  PLAY_DETAIL_PLAYER_GAME,
  PLAY_DETAIL_TEAM_COMPONENTS,
  PLAY_DETAIL_TEAM_GAME
} from './playDetail'
import {
  isZeroCount,
  OPP_SHOT_COMPONENTS,
  SHOT_COMPONENTS,
  SHOT_PLAYER_GAME,
  SHOT_TEAM_GAME
} from './shots'
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
  /**
   * The source tables it is built from. With one of them left out of a build, its metrics read null
   * with a reason, not the zeros an empty table would give (`leftOut.ts`).
   */
  sources: readonly string[]
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
    sources: ['src_nba_game_matchups'],
    key: GAME_MATCHUP_KEY,
    components: GAME_MATCHUP_COMPONENTS
  },
  {
    table: SHOT_PLAYER_GAME,
    entity: 'player',
    sources: ['src_nba_shots'],
    key: 'player_id',
    components: SHOT_COMPONENTS,
    zero: isZeroCount
  },
  {
    table: SHOT_TEAM_GAME,
    entity: 'team',
    sources: ['src_nba_shots'],
    key: 'team_id',
    components: [...SHOT_COMPONENTS, ...OPP_SHOT_COMPONENTS],
    zero: isZeroCount
  },
  // Who was on the floor (Plan T904): the On court metrics' counts and their own divisors.
  {
    table: PLAYER_ON_COURT,
    entity: 'player',
    sources: ['src_nba_game_lineups', 'src_nba_pbp', 'src_nba_possessions'],
    key: 'player_id',
    components: PLAYER_ON_COURT_COMPONENTS
  },
  {
    table: PLAY_DETAIL_PLAYER_GAME,
    entity: 'player',
    sources: ['src_nba_pbp'],
    key: 'player_id',
    components: PLAY_DETAIL_COUNTS,
    zero: isPlayDetailZero
  },
  {
    table: PLAY_DETAIL_TEAM_GAME,
    entity: 'team',
    sources: ['src_nba_pbp'],
    key: 'team_id',
    components: PLAY_DETAIL_TEAM_COMPONENTS,
    zero: isPlayDetailZero
  }
]

export const gameTable = (name: string | undefined): GameTable | undefined =>
  name === undefined ? undefined : GAME_TABLES.find((t) => t.table === name)
