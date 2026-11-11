import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * Reference section 10.2: the NBA's matchups, for defenders, from 2017-18. Tracking assigns each
 * offensive player a defender moment by moment, and these add up what the players a defender was
 * assigned did against them. A whole season reads the season files; a date range, the last games or
 * any filter that splits a season reads the game matchups (`derived/gameMatchups.ts`), added up over
 * the defender's games in scope. The shares by position have no game file behind them, so they answer
 * whole seasons only.
 *
 * Assignment is a measurement convention: help, switches and scheme sit in every number, and a small
 * sample carries the shooter's quality more than the defender's. In the regular season the totals
 * add up the NBA's pair file; the playoffs and the current season come from its rollup by defender
 * (`derived/publishedTables.ts`).
 */
const SOURCES = ["The NBA's season matchups"]
const FIRST = 2018

const TABLE = 'pub_player_matchups'
const GAMES = 'game_matchups'
const POSITIONS = 'pub_player_matchup_positions'

const CAVEAT =
  'Assignment is tracked moment by moment, so help, switches and the shooter’s own quality sit in it too.'

/** A matchup count: summed over the players guarded, per game over the games with a matchup. */
const count = (column: string, o: Partial<Opts> = {}): Opts => ({
  value: `{${column}}`,
  sample: 'games',
  family: 'matchups',
  kind: 'recorded',
  aggregation: 'sum',
  unit: 'count',
  decimals: 0,
  direction: 'neutral',
  sources: SOURCES,
  firstSeason: FIRST,
  published: TABLE,
  publishedGames: GAMES,
  ...o
})

/** A rate of two matchup counts. */
const rate = (value: string, sample: string, minSample: number, o: Partial<Opts> = {}): Opts => ({
  value,
  sample,
  minSample,
  family: 'matchups',
  unit: 'pct',
  direction: 'lower',
  sources: SOURCES,
  firstSeason: FIRST,
  published: TABLE,
  publishedGames: GAMES,
  ...o
})

/** Points per 100 of a sample of partial possessions. */
const per100 = (pts: string, poss: string): string => `100.0 * ${ratio(pts, poss)}`

const DEFENDER: MetricDef[] = [
  metric(
    'matchup_min',
    'Matchup minutes',
    'Match MIN',
    'Time the player spent assigned to an offensive player, as tracked. Not minutes played.',
    count('matchup_minutes', { unit: 'minutes', decimals: 1, perGameOnly: true })
  ),
  metric(
    'matchup_poss',
    'Matchup possessions',
    'Match Poss',
    'Partial possessions guarded: each possession is shared among the defenders assigned during it.',
    count('possessions', { decimals: 1, perGameOnly: true })
  ),
  metric(
    'matchup_pts',
    'Points allowed in matchups',
    'Match PTS',
    `Points scored by the players they were assigned to, while assigned. ${CAVEAT}`,
    count('player_pts', { direction: 'lower' })
  ),
  metric(
    'matchup_pts_per_100',
    'Matchup points allowed per 100',
    'Match PTS/100',
    `Points the players they guarded scored, per 100 partial possessions guarded. Derived, and not a defensive rating. ${CAVEAT}`,
    rate(per100('player_pts', 'possessions'), 'possessions', 2000, {
      unit: 'rating',
      decimals: 1,
      kind: 'derived'
    })
  ),
  metric(
    'matchup_team_pts',
    'Team points in matchups',
    'Match TM PTS',
    'Points the other team scored while the player was assigned to someone: not that player’s points.',
    count('team_pts')
  ),
  metric(
    'matchup_fgm',
    'Matchup field goals allowed',
    'Match FGM',
    'Field goals made by the players they were assigned to.',
    count('matchup_fgm', { direction: 'lower' })
  ),
  metric(
    'matchup_fga',
    'Matchup field-goal attempts faced',
    'Match FGA',
    'Field-goal attempts by the players they were assigned to.',
    count('matchup_fga')
  ),
  metric(
    'matchup_fg_pct',
    'Matchup FG% allowed',
    'Match FG%',
    `The field-goal percentage of the players they were assigned to. ${CAVEAT}`,
    rate(ratio('matchup_fgm', 'matchup_fga'), 'matchup_fga', 300)
  ),
  metric(
    'matchup_fg3m',
    'Matchup threes allowed',
    'Match 3PM',
    'Threes made by the players they were assigned to.',
    count('matchup_fg3_m', { direction: 'lower' })
  ),
  metric(
    'matchup_fg3a',
    'Matchup threes faced',
    'Match 3PA',
    'Three-point attempts by the players they were assigned to.',
    count('matchup_fg3_a')
  ),
  metric(
    'matchup_fg3_pct',
    'Matchup 3P% allowed',
    'Match 3P%',
    `The three-point percentage of the players they were assigned to. ${CAVEAT}`,
    rate(ratio('matchup_fg3_m', 'matchup_fg3_a'), 'matchup_fg3_a', 100)
  ),
  metric(
    'matchup_ftm',
    'Matchup free throws allowed',
    'Match FTM',
    'Free throws made by the players they were assigned to.',
    count('matchup_ftm', { direction: 'lower' })
  ),
  metric(
    'matchup_fta',
    'Matchup free throws faced',
    'Match FTA',
    'Free-throw attempts by the players they were assigned to.',
    count('matchup_fta', { direction: 'lower' })
  ),
  metric(
    'matchup_ast',
    'Matchup assists allowed',
    'Match AST',
    'Assists by the players they were assigned to.',
    count('matchup_ast', { direction: 'lower' })
  ),
  metric(
    'matchup_tov',
    'Matchup turnovers forced',
    'Match TOV',
    'Turnovers by the players they were assigned to. Not necessarily their own steals.',
    count('matchup_tov', { direction: 'higher' })
  ),
  metric(
    'matchup_blk',
    'Matchup blocks',
    'Match BLK',
    'Blocks of the shots of the players they were assigned to.',
    count('matchup_blk', { direction: 'higher' })
  ),
  metric(
    'matchup_sfl',
    'Matchup shooting fouls',
    'Match SFL',
    'Shooting fouls committed on the players they were assigned to.',
    count('sfl', { direction: 'lower' })
  )
]

const WHO = { g: 'guards', f: 'forwards', c: 'centers' } as const

/**
 * Who they guarded, by the position the NBA lists for the player guarded: shares of the rollup's own
 * time, which reproduce its published percent of time.
 */
const BY_POSITION: MetricDef[] = (['g', 'f', 'c'] as const).flatMap((p) => {
  const P = p.toUpperCase()
  return [
    metric(
      `matchup_${p}_time_pct`,
      `Matchup time on ${WHO[p]}`,
      `vs ${P} Time%`,
      `The share of their matchup time spent guarding ${WHO[p]}, by the position the NBA lists.`,
      rate(ratio(`pos_${p}_minutes`, 'pos_all_minutes'), 'pos_all_minutes', 500, {
        published: POSITIONS,
        publishedGames: undefined,
        direction: 'neutral'
      })
    ),
    metric(
      `matchup_${p}_pts_per_100`,
      `Points allowed per 100 to ${WHO[p]}`,
      `vs ${P} PTS/100`,
      `Points scored by the ${WHO[p]} they guarded, per 100 partial possessions guarding them. Derived. ${CAVEAT}`,
      rate(per100(`pos_${p}_pts`, `pos_${p}_poss`), `pos_${p}_poss`, 500, {
        published: POSITIONS,
        publishedGames: undefined,
        unit: 'rating',
        decimals: 1,
        kind: 'derived'
      })
    ),
    metric(
      `matchup_${p}_fg_pct`,
      `FG% allowed to ${WHO[p]}`,
      `vs ${P} FG%`,
      `The field-goal percentage of the ${WHO[p]} they guarded. ${CAVEAT}`,
      rate(ratio(`pos_${p}_fgm`, `pos_${p}_fga`), `pos_${p}_fga`, 100, {
        published: POSITIONS,
        publishedGames: undefined
      })
    )
  ]
})

export const MATCHUPS: MetricDef[] = [...DEFENDER, ...BY_POSITION]

/** What the matchup samples count, in words. */
export const MATCHUP_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  matchup_fga: 'field-goal attempts faced',
  matchup_fg3_a: 'threes faced',
  pos_all_minutes: 'matchup minutes',
  ...Object.fromEntries(
    (['g', 'f', 'c'] as const).flatMap((p) => [
      [`pos_${p}_poss`, `partial possessions on ${WHO[p]}`],
      [`pos_${p}_fga`, `attempts faced from ${WHO[p]}`]
    ])
  )
}
