import type { MetricDef } from '../types'
import { AVAILABILITY_FIRST_SEASON, AVAILABILITY_SOURCES } from '../availability'
import { metric, type Opts } from './define'

/**
 * Reference section 18.3: games missed, counted by game and not by report. A game counts once for a
 * player however many reports listed it, by the last report that lists them before the game. Counted
 * from 2019-20, for the regular season and the playoffs, for every player listed: one who missed every
 * game has no box-score line and is still listed (the table adds rows, Plan T1206). A status is a
 * published listing, not a statement that the player did or did not play: the box scores agree with an
 * Out on all but four games in ten thousand (`nba-data-sources.md`).
 */
const TABLE = 'pub_player_availability'

const LAST_REPORT =
  'A game counts once however many reports listed the player, by the last report that lists them before tip-off.'
const WHOLE_SEASONS =
  'A player who missed every game is listed too, with no stats, and does not qualify.'

/**
 * A count of games, summed; its own sample, so a player with none has no rank among those with some.
 * It is a total whatever the mode: games out per game would read as a rate the reports do not give.
 * Neither way is better or worse, so the leaderboard sorts it from most.
 */
const games = (column: string, o: Partial<Opts> = {}): Opts => ({
  value: `{${column}}`,
  sample: column,
  family: 'availability',
  kind: 'recorded',
  aggregation: 'sum',
  unit: 'count',
  decimals: 0,
  direction: 'neutral',
  totalOnly: true,
  sources: AVAILABILITY_SOURCES,
  firstSeason: AVAILABILITY_FIRST_SEASON,
  published: TABLE,
  ...o
})

export const AVAILABILITY: MetricDef[] = [
  metric(
    'games_out_injury',
    'Games out, injury or illness',
    'Out INJ',
    `Games the player was listed Out for an injury or an illness. ${LAST_REPORT} ${WHOLE_SEASONS}`,
    { ...games('games_out_injury'), categories: ['playing_time.games_missed'] }
  ),
  metric(
    'games_out_other',
    'Games out, other reasons',
    'Out OTH',
    `Games the player was listed Out for any other reason: a G League assignment, rest, a suspension, personal reasons, health and safety protocols, a trade pending, or none given. ${LAST_REPORT} ${WHOLE_SEASONS}`,
    { ...games('games_out_other'), categories: ['playing_time.games_missed'] }
  )
]
