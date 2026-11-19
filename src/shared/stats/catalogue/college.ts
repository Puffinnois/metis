import { LEAGUES } from '../../leagues'
import { NCAA_PLAYER_BOX, NCAA_TEAM_BOX } from '../ncaaSplits'
import type { MetricCoverage, MetricDef } from '../types'
import { metric, ratio, teamSides, type Opts } from './define'

/**
 * The college leagues' catalogue (D38, D40): the metrics only they have, stats.ncaa.org's splits
 * beside ESPN's box scores, and every metric's coverage in them (`MetricDef.leagues.ncaam` and
 * `.ncaaw`), written as rules over what a metric reads, as the WNBA's are (`wnba.ts`). One shared set
 * for both leagues, never a copy per league. Whether a league builds a metric's table yet is read from
 * its `builds` (`notBuiltYet`), so the parts that build the colleges' published tables, plays and
 * models (T1302.6 to T1302.8) lift those reasons by adding their step.
 */

/** The window both leagues load (D39): 2021-22 on. */
const FIRST = LEAGUES.ncaam.firstSeason

const NCAA_SOURCES = ["stats.ncaa.org's box scores (SportsDataverse's release)"]

/** In the college leagues alone, from the first season of the window. */
const COLLEGE_ONLY: MetricDef['leagues'] = {
  nba: null,
  wnba: null,
  ncaam: { firstSeason: FIRST },
  ncaaw: { firstSeason: FIRST }
}

/** Every split reads stats.ncaa.org's player box: with its releases left out (D41) it says so. */
const split = (o: Opts): Opts => ({
  sources: NCAA_SOURCES,
  firstSeason: FIRST,
  leagues: COLLEGE_ONLY,
  reads: [NCAA_PLAYER_BOX],
  tier: 'extended',
  ...o
})

/** A count, per game of a stats.ncaa.org line. */
const splitCount = (component: string, o: Partial<Opts> = {}): Opts =>
  split({
    value: `{${component}}`,
    sample: 'ncaa_games',
    perGameBy: 'ncaa_games',
    kind: 'recorded',
    aggregation: 'sum',
    unit: 'count',
    decimals: 0,
    ...o
  })

/** A share of stats.ncaa.org's own counts, never of ESPN's. */
const splitShare = (a: string, b: string, minSample: number, o: Partial<Opts> = {}): Opts =>
  split({ value: ratio(a, b), sample: b, unit: 'pct', minSample, ...o })

/** The same metric for players, teams and their opponents. */
function sides(
  id: string,
  label: string,
  short: string,
  description: string,
  o: Opts
): MetricDef[] {
  return [metric(id, label, short, description, o), ...teamSides(id, label, short, description, o)]
}

/**
 * Words every split's description ends on: whose count it is, and that it is never mixed with ESPN's.
 * The minimums are Metis's own, stated over 82 team games as every other (D43 scales them).
 */
const OWN = " stats.ncaa.org's own counts, beside ESPN's box score and never mixed with it."

export const COLLEGE: MetricDef[] = [
  ...sides(
    'ncaa_rim_pct',
    'Field-goal percentage at the rim',
    'Rim FG%',
    `Shots made at the rim over shots taken there, as stats.ncaa.org charts each shot.${OWN}`,
    { ...splitShare('ncaa_rimm', 'ncaa_rima', 200), family: 'shooting' }
  ),
  ...sides(
    'ncaa_rim_rate',
    'Share of shots at the rim',
    'Rim rate',
    `Shots at the rim over all field-goal attempts.${OWN}`,
    { ...splitShare('ncaa_rima', 'ncaa_fga', 500), family: 'shooting', direction: 'neutral' }
  ),
  ...sides(
    'ncaa_mid_pct',
    'Mid-range field-goal percentage',
    'Mid FG%',
    `Two-point shots made away from the rim over those taken.${OWN}`,
    { ...splitShare('ncaa_midm', 'ncaa_mida', 200), family: 'shooting' }
  ),
  ...sides(
    'ncaa_mid_rate',
    'Share of shots from mid-range',
    'Mid rate',
    `Two-point shots away from the rim over all field-goal attempts.${OWN}`,
    { ...splitShare('ncaa_mida', 'ncaa_fga', 500), family: 'shooting', direction: 'neutral' }
  ),
  ...sides(
    'ncaa_putbacks',
    'Putbacks made',
    'PUTB',
    `Shots made straight from an offensive rebound.${OWN}`,
    { ...splitCount('ncaa_pbackm'), family: 'scoring' }
  ),
  ...sides(
    'ncaa_putback_pct',
    'Putback field-goal percentage',
    'PUTB%',
    `Putbacks made over putbacks tried.${OWN}`,
    { ...splitShare('ncaa_pbackm', 'ncaa_pbacka', 50), family: 'scoring' }
  ),
  ...sides(
    'ncaa_rim_blocks',
    'Blocks at the rim',
    'BLK rim',
    `Blocked shots taken at the rim.${OWN}`,
    { ...splitCount('ncaa_blk_rim'), family: 'scoring' }
  ),
  ...sides(
    'ncaa_trans_rate',
    'Share of shots in transition',
    'Trans rate',
    `Field-goal attempts in transition over all of them.${OWN}`,
    { ...splitShare('ncaa_fga_trans', 'ncaa_fga', 500), family: 'scoring', direction: 'neutral' }
  ),
  ...sides(
    'ncaa_trans_pts',
    'Points in transition',
    'Trans PTS',
    `Points scored in transition.${OWN}`,
    { ...splitCount('ncaa_pts_trans'), family: 'scoring' }
  ),
  ...sides(
    'ncaa_trans_efg_pct',
    'Effective field-goal percentage in transition',
    'Trans eFG%',
    `Transition field goals with a made three worth one and a half, over transition attempts.${OWN}`,
    {
      ...split({
        value: '({ncaa_fgm_trans} + 0.5 * {ncaa_fg3m_trans}) / nullif({ncaa_fga_trans}, 0)',
        sample: 'ncaa_fga_trans',
        unit: 'pct',
        minSample: 100
      }),
      family: 'scoring'
    }
  ),
  ...sides(
    'ncaa_assisted_pct',
    'Share of field goals assisted',
    'AST FGM%',
    `Field goals made off an assist over all made.${OWN}`,
    { ...splitShare('ncaa_fgm_ast', 'ncaa_fgm', 200), family: 'scoring', direction: 'neutral' }
  ),
  ...sides(
    'ncaa_assisted_3pm_pct',
    'Share of threes assisted',
    'AST 3PM%',
    `Threes made off an assist over all made.${OWN}`,
    { ...splitShare('ncaa_fg3m_ast', 'ncaa_fg3m', 82), family: 'scoring', direction: 'neutral' }
  ),
  ...sides(
    'ncaa_assisted_rim_pct',
    'Share of rim makes assisted',
    'AST rim%',
    `Shots made at the rim off an assist over all made there.${OWN}`,
    { ...splitShare('ncaa_rimm_ast', 'ncaa_rimm', 100), family: 'scoring', direction: 'neutral' }
  ),
  // Possessions are the team box's, estimated by stats.ncaa.org from its play by play.
  ...teamSides(
    'ncaa_poss',
    'Possessions (stats.ncaa.org)',
    'POSS',
    "The team's possessions as stats.ncaa.org counts them, per game of its box score.",
    {
      ...splitCount('ncaa_poss'),
      family: 'possessions',
      kind: 'estimated',
      decimals: 1,
      direction: 'neutral',
      reads: [NCAA_PLAYER_BOX, NCAA_TEAM_BOX]
    }
  ),
  ...teamSides(
    'ncaa_rtg',
    'Points per 100 possessions (stats.ncaa.org)',
    'RTG',
    "Points per 100 of stats.ncaa.org's possessions, both from its box score: the team's offensive rating, and its opponents' for its defense.",
    {
      ...split({
        value: '100.0 * {ncaa_pts} / nullif({ncaa_poss}, 0)',
        sample: 'ncaa_poss',
        reads: [NCAA_PLAYER_BOX, NCAA_TEAM_BOX]
      }),
      family: 'possessions',
      kind: 'derived'
    }
  )
]

/** Metrics that say the same as another in a 40-minute league. */
const SAME_AS: Record<string, string> = {
  team_pace40: 'College pace is per 40 minutes already: see Pace.'
}

/** Components ESPN's college box scores do not have, and why. */
const NOT_IN_BOX: readonly [readonly string[], string][] = [
  [
    ['plus_minus'],
    "Neither ESPN's college box scores nor stats.ncaa.org's give a player's plus-minus."
  ]
]

/** Components a source has only from a later season of the window, and that season. */
const LATER: readonly [readonly string[], number][] = [
  // ESPN's points in the paint, on the fast break and off turnovers: blank before 2023-24, both leagues.
  [
    [
      'paint_pts',
      'fast_break_pts',
      'turnover_pts',
      'opp_paint_pts',
      'opp_fast_break_pts',
      'opp_turnover_pts'
    ],
    2024
  ]
]

/** The metric's coverage in a college league, from the components it reads (`componentsOf`). */
export function collegeCoverage(def: MetricDef, parts: readonly string[]): MetricCoverage {
  const same = SAME_AS[def.id]
  if (same) return { firstSeason: FIRST, unavailable: same }
  for (const [columns, reason] of NOT_IN_BOX) {
    if (parts.some((p) => columns.includes(p))) return { firstSeason: FIRST, unavailable: reason }
  }
  let firstSeason = FIRST
  for (const [columns, from] of LATER) {
    if (parts.some((p) => columns.includes(p))) firstSeason = Math.max(firstSeason, from)
  }
  return { firstSeason }
}
