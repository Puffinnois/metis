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
import {
  NCAA_SITUATION_COUNTS,
  NCAA_SITUATION_PLAYER_GAME,
  NCAA_SITUATION_TEAM_COMPONENTS,
  NCAA_SITUATION_TEAM_GAME
} from './collegeSituations'

/**
 * A built table at game grain that answers published metrics under a filter that splits a season. The
 * engine joins it to the box-score rows in scope by player and game, so every filter on a game holds.
 * A metric names it in `publishedGames`; the table holds `game_id` and its `key`, and counts named as
 * the metric's `published` table names them. `docs/reference/stats-database.md`, "Game tables".
 */
/** The plays recipe's files a game table can be built from. */
export type PlaysFile = 'pbp' | 'shots' | 'possessions' | 'gameLineups' | 'gameMatchups'

export interface GameTable {
  table: string
  entity: Entity
  /**
   * The source files it is built from, as the league's plays recipe names them (`PlaysRecipe`), so
   * each league's own are read. With one of them left out of a build, its metrics read null with a
   * reason, not the zeros an empty table would give (`leftOut.ts`).
   */
  sources: readonly PlaysFile[]
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
    sources: ['gameMatchups'],
    key: GAME_MATCHUP_KEY,
    components: GAME_MATCHUP_COMPONENTS
  },
  {
    table: SHOT_PLAYER_GAME,
    entity: 'player',
    sources: ['shots'],
    key: 'player_id',
    components: SHOT_COMPONENTS,
    zero: isZeroCount
  },
  {
    table: SHOT_TEAM_GAME,
    entity: 'team',
    sources: ['shots'],
    key: 'team_id',
    components: [...SHOT_COMPONENTS, ...OPP_SHOT_COMPONENTS],
    zero: isZeroCount
  },
  // Who was on the floor (Plan T904): the On court metrics' counts and their own divisors.
  {
    table: PLAYER_ON_COURT,
    entity: 'player',
    sources: ['gameLineups', 'pbp', 'possessions'],
    key: 'player_id',
    components: PLAYER_ON_COURT_COMPONENTS
  },
  {
    table: PLAY_DETAIL_PLAYER_GAME,
    entity: 'player',
    sources: ['pbp'],
    key: 'player_id',
    components: PLAY_DETAIL_COUNTS,
    zero: isPlayDetailZero
  },
  {
    table: PLAY_DETAIL_TEAM_GAME,
    entity: 'team',
    sources: ['pbp'],
    key: 'team_id',
    components: PLAY_DETAIL_TEAM_COMPONENTS,
    zero: isPlayDetailZero
  },
  // The college leagues' counts by situation (`collegeSituations.ts`): empty in every other league. A row
  // is there for every player and team of a tagged game, so no count is ever read as 0 for want of one.
  {
    table: NCAA_SITUATION_PLAYER_GAME,
    entity: 'player',
    sources: ['pbp'],
    key: 'player_id',
    components: NCAA_SITUATION_COUNTS
  },
  {
    table: NCAA_SITUATION_TEAM_GAME,
    entity: 'team',
    sources: ['pbp', 'possessions'],
    key: 'team_id',
    components: NCAA_SITUATION_TEAM_COMPONENTS
  }
]

export const gameTable = (name: string | undefined): GameTable | undefined =>
  name === undefined ? undefined : GAME_TABLES.find((t) => t.table === name)
