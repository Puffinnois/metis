import { gamesShareWords, type League } from '@shared/leagues'
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

/**
 * What a leaderboard says of who qualifies. In a league whose games rule is a share (D43), its per-game
 * leaders ask that share and only the shooting leaders the NBA's makes.
 */
/**
 * Whose minimum the leader stats qualify by, in the Explore chart's notes: the NBA's (D33, D37), or
 * where a league's own rules set them (the college leagues' games share and makes per game, D43),
 * that league's. The NBA's and the WNBA's words are as they were.
 */
export function leaderRuleWords(league: League = currentLeague()): {
  note: string
  clause: string
} {
  return league.madePerGame
    ? {
        note: 'the leader stats need only the league’s own rule',
        clause: 'or the league’s own rule alone for its leader stats'
      }
    : {
        note: 'the NBA’s leader stats need only their own minimum',
        clause: 'or the NBA’s own minimum alone for its leader stats'
      }
}

export function leaderboardQualifier(league: League = currentLeague()): string {
  const note = league.minimumsNote ? `, ${league.minimumsNote}` : ''
  const share = gamesShareWords(league)
  if (share && league.madePerGame) {
    return `Qualified: ${rowQualifier(league)}, scaled to the games in range; per-game leaders by ${share} of the team's games, the league's own rule; shooting leaders and the assist-to-turnover ratio by made per game in ${share} of the team's games, ${league.madePerGame.note}`
  }
  if (share) {
    return `Qualified: ${rowQualifier(league)}, scaled to the games in range; per-game leaders by ${share} of the team's games, the league's own rule; shooting leaders by the NBA's makes${note}`
  }
  return `Qualified: ${rowQualifier(league)}, scaled to the games in range; the NBA's leader stats by their own minimum${note}`
}
