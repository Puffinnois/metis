import type { League } from '@shared/leagues'
import type { GameType } from '@shared/stats/types'

/**
 * What the college leagues' models rate (Plan T1302.8): games between two Division I teams of the
 * season, of every counted type, never an exhibition or a forfeit. A game against a team outside
 * Division I counts in a team's record and box-score totals and in no rating. A league whose
 * `divisionIOnly` is not set (the NBA, the WNBA) keeps its own rules, and its SQL is unchanged.
 */

/** Why a college scope of exhibitions alone has no rating. */
export const NOT_RATED = 'Rated on counted games between Division I teams, never an exhibition.'

/** Why a college composite has none over part of a season's games. */
export const COMPUTED_EVERY_GAME = 'Computed for every game of a season together.'

/** The game types SRS and the adjusted ratings are solved on (`LeagueModels.solvedTypes`). */
export const solvedTypesOf = (league: League): readonly GameType[] =>
  league.models?.solvedTypes ?? ['regular']

/** `ModelTable.typesIn` for a table solved on the league's `solvedTypes`; null keeps the table's. */
export function solvedTypesIn(
  league: League
): { types: readonly GameType[]; reason: string } | null {
  const types = league.models?.solvedTypes
  return types ? { types, reason: NOT_RATED } : null
}

/** `ModelTable.typesIn` for Elo's tables in a league rated on Division I games alone. */
export function eloTypesIn(league: League): { types: readonly GameType[]; reason: string } | null {
  return league.divisionIOnly && league.models
    ? { types: league.models.eloGameTypes, reason: NOT_RATED }
    : null
}

/** `ModelTable.typesIn` for the composites of a league that computes them over every game together. */
export function everyGameIn(
  league: League
): { types: readonly GameType[]; reason: string; every: true } | null {
  return league.models?.everyGame
    ? { types: league.countedTypes, reason: COMPUTED_EVERY_GAME, every: true }
    : null
}

/**
 * SQL conditions on a game aliased `g` that keep the games between two Division I teams of its season
 * and leave out forfeits (no score goes into a fit), to follow a `WHERE`; empty for a league that rates
 * every team's games.
 */
export function divisionIGamesSql(league: League, g = 'g'): string {
  if (!league.divisionIOnly) return ''
  const inDivision = (side: string): string =>
    `EXISTS (SELECT 1 FROM team d WHERE d.team_id = ${g}.${side} AND d.season = ${g}.season AND d.division_i)`
  return ` AND ${g}.forfeit_winner_id IS NULL AND ${inDivision('home_team_id')} AND ${inDivision('away_team_id')}`
}

/** The game types as a SQL list. */
export const typesSql = (types: readonly GameType[]): string =>
  types.map((t) => `'${t}'`).join(', ')
