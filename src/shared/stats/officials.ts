import { seasonLabel, type League } from '../leagues'

/**
 * The NBA's officials file has a crew for every game from 2003-04, and for 0 to 8.6 % of a season's
 * games before it (measured): too few to read a rate from, so those seasons answer with a reason.
 */
export const OFFICIATING_FIRST_SEASON = 2004

/** Why an official's rates are not read for a season; null from 2003-04. */
export function officiatingReason(
  season: number,
  games: number,
  withCrew: number,
  league: League
): string | null {
  if (season >= OFFICIATING_FIRST_SEASON) return null
  const n = (x: number): string => x.toLocaleString('en-US')
  const label = (s: number): string => seasonLabel(league, s)
  return `Crews are listed for ${n(withCrew)} of ${n(games)} games in ${label(season)}; rates start in ${label(OFFICIATING_FIRST_SEASON)}.`
}
