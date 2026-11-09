import type { Entity, GameType } from '@shared/stats/types'

/**
 * A table the dataset publishes per season, with no game behind it. A traded player has one row for
 * their whole season, under their last team (measured on the league dashboards and hustle).
 */
export interface PublishedTable {
  /** The table built from the source, and what a metric's `published` names. */
  table: string
  entity: Entity
  source: string
  /** The first season holding real values: some files have earlier rows with only games and minutes. */
  firstSeason?: number
  /**
   * The source's columns for its own tracked games and minutes: they can differ from the official
   * ones, and a rate must divide by what was tracked. Null when it does not publish them. A team's
   * minutes are as published: elapsed, about 48 a game.
   */
  games: string | null
  minutes: string | null
  possessions?: string
  /** The source's columns to read, each a component of the same name. */
  columns: readonly string[]
}

/** The season types these tables hold (measured). The Cup final and the play-in have no rows. */
export const PUBLISHED_GAME_TYPES: readonly GameType[] = ['regular', 'playoffs']

/** Every published table. Each family adds its own; bump `PUBLISHED_VERSION` when one changes. */
export const PUBLISHED_TABLES: readonly PublishedTable[] = []
