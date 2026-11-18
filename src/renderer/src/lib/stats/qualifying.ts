import type { League } from '@shared/leagues'
import { currentLeague } from './league'

/**
 * How the screens state a row's qualifier, from the league on screen: the catalogue's 1,000 minutes
 * over the minimums' base, scaled by the league's game length (833 minutes in a 40-minute league), and
 * the note a league adds while its rule is provisional (D33, D37).
 */

/** The catalogue's row qualifier, in minutes over the minimums' base of team games. */
const ROW_MINUTES = 1000

/** The league's row minimum in minutes: 1,000 in the NBA, 833 in the WNBA. */
export const rowMinutes = (league: League = currentLeague()): number =>
  Math.round((ROW_MINUTES * league.gameMinutes) / league.minimumsMinutes)

/** "1,000 minutes over 82 games". */
export const rowQualifier = (league: League = currentLeague()): string =>
  `${rowMinutes(league).toLocaleString('en-US')} minutes over ${league.minimumsGames} games`

/** What a leaderboard says of who qualifies. */
export const leaderboardQualifier = (league: League = currentLeague()): string =>
  `Qualified: ${rowQualifier(league)}, scaled to the games in range; the NBA's leader stats by their own minimum${
    league.minimumsNote ? `, ${league.minimumsNote}` : ''
  }`
