import type { MetricDef } from '../types'
import { count, metric, NBA_FIRST_SEASON, type Opts } from './define'

/**
 * Reference section 18.1: fantasy points and combined counts, as ordinary metrics of a player's box
 * score (D4, T1201): one metric a scoring system, nothing about rosters, lineups or advice. Each is a
 * weighted sum of counts, so it adds up over games exactly and reads per game, per minute or as a
 * total like any count.
 */
const f = { family: 'composite' } as const

/** A weighted sum of box-score counts, kept to a tenth for the fractional weights. */
const sum = (value: string, o: Partial<Opts> = {}): Opts => ({
  ...count('pts', { ...f, kind: 'derived', decimals: 1, ...o }),
  value
})

/**
 * The NBA's scoring: what its dashboards publish as fantasy points, equal on every player-season of
 * both leagues' files (1996-97 to 2026-27) to this sum of the same rows' counts. FanDuel lists the
 * same weights for its ordinary basketball scoring (`nba-statistics.md`, 18.1).
 */
const NBA_SCORING = '{pts} + 1.2 * {reb} + 1.5 * {ast} + 3 * {stl} + 3 * {blk} - {tov}'
/**
 * The WNBA's scoring, as its dashboards publish it: worked out from the published column, which
 * equals this sum on every player-season of the WNBA's file (1997 to 2026). Turnovers do not count.
 */
const WNBA_SCORING = '{pts} + {fg3m} + {reb} + {ast} + 2 * {stl} + 2 * {blk}'
/**
 * DraftKings' NBA Classic scoring as the reference states it, its bonuses a game each: 1.5 for a
 * double-double, 3 more for a triple-double. DraftKings' rules page refused a plain client
 * (2026-11-23), so whether a triple-double also takes the double-double bonus is the reference's
 * reading, not read from DraftKings; Metis's double-doubles count a triple-double too.
 */
const DK_SCORING =
  '{pts} + 0.5 * {fg3m} + 1.25 * {reb} + 1.5 * {ast} + 2 * {stl} + 2 * {blk} - 0.5 * {tov} + 1.5 * {dd2} + 3 * {td3}'

const POINTS: MetricDef[] = [
  metric(
    'fp_nba',
    'Fantasy points (NBA scoring)',
    'FP',
    'Points plus 1.2 a rebound, 1.5 an assist, 3 a steal and 3 a block, less a point a turnover: the NBA’s fantasy scoring, which FanDuel also lists for its ordinary scoring. From the box scores.',
    { ...sum(NBA_SCORING), categories: ['fantasy.points'] }
  ),
  metric(
    'fp_wnba',
    'Fantasy points (WNBA scoring)',
    'FP WNBA',
    'Points plus a point a three made, a rebound and an assist, and 2 a steal and a block; turnovers do not count. The WNBA’s fantasy scoring, worked out from what its dashboards publish. From the box scores.',
    { ...sum(WNBA_SCORING), categories: ['fantasy.points'] }
  ),
  metric(
    'fp_dk',
    'Fantasy points (DraftKings scoring)',
    'FP DK',
    'Points plus half a point a three made, 1.25 a rebound, 1.5 an assist, 2 a steal and a block, less half a point a turnover, with 1.5 for a double-double and 3 more for a triple-double: DraftKings’ NBA Classic scoring as the reference states it. From the box scores.',
    { ...sum(DK_SCORING), categories: ['fantasy.points'] }
  )
]

const PUBLISHED_TABLE = 'pub_player_fantasy'
const PUBLISHED = (column: string): Opts => ({
  ...sum(`{${column}}`),
  kind: 'recorded',
  sources: ["The NBA's league dashboards"],
  firstSeason: NBA_FIRST_SEASON,
  published: PUBLISHED_TABLE
})

const AS_PUBLISHED: MetricDef[] = [
  metric(
    'nba_fantasy_pts',
    'Fantasy points, published (NBA scoring)',
    'FP pub',
    'The fantasy points the league’s dashboards publish under the NBA’s scoring, over their own counts. Fantasy points (NBA scoring) is the same sum over the box scores, and reads for any range of games.',
    { ...PUBLISHED('nba_fantasy_pts'), categories: ['fantasy.points'] }
  ),
  metric(
    'nba_wnba_fantasy_pts',
    'Fantasy points, published (WNBA scoring)',
    'FP WNBA pub',
    'The fantasy points the league’s dashboards publish under the WNBA’s scoring, over their own counts. Fantasy points (WNBA scoring) is the same sum over the box scores, and reads for any range of games.',
    { ...PUBLISHED('wnba_fantasy_pts'), categories: ['fantasy.points'] }
  )
]

/** Combined counts: informal sums a reader asks for, not anyone’s scoring. */
const COMBINED: MetricDef[] = [
  metric('pra', 'Points, rebounds and assists', 'PRA', 'Points plus rebounds plus assists.', {
    ...sum('{pts} + {reb} + {ast}', { decimals: 0 }),
    categories: ['impact.all_around']
  }),
  metric('pts_reb', 'Points and rebounds', 'P+R', 'Points plus rebounds.', {
    ...sum('{pts} + {reb}', { decimals: 0 }),
    categories: ['impact.all_around']
  }),
  metric('pts_ast', 'Points and assists', 'P+A', 'Points plus assists.', {
    ...sum('{pts} + {ast}', { decimals: 0 }),
    categories: ['impact.all_around']
  }),
  metric('reb_ast', 'Rebounds and assists', 'R+A', 'Rebounds plus assists.', {
    ...sum('{reb} + {ast}', { decimals: 0 }),
    categories: ['impact.all_around']
  }),
  metric('stocks', 'Steals and blocks', 'STL+BLK', 'Steals plus blocks, informally “stocks”.', {
    ...sum('{stl} + {blk}', { decimals: 0 }),
    categories: ['defense.steals_blocks']
  })
]

export const FANTASY: MetricDef[] = [...POINTS, ...AS_PUBLISHED, ...COMBINED]
