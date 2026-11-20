import { COLLEGE_LINEUP_COVERAGE, COLLEGE_PLAYS_COVERAGE, LEAGUES } from '../../leagues'
import { NCAA_PLAYER_BOX, NCAA_TEAM_BOX } from '../ncaaSplits'
import { SHOT_BANDS, SHOT_TYPES, SHOT_ZONE_GROUPS, SHOT_ZONES } from '../shots'
import type { MetricCoverage, MetricDef, MetricFamily } from '../types'
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

const PYTHAGOREAN =
  "Not computed for the college leagues yet: the Pythagorean exponent is fitted on each league's own seasons with Metis's ratings and models, in a later version."

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

/**
 * Families no college release publishes (D44, `League.unpublished`), with the registry's reasons, so
 * the metrics and the reads behind their tabs say the same.
 */
const NOT_PUBLISHED: Partial<Record<MetricFamily, string>> = LEAGUES.ncaam.unpublished

/** The college leagues' own published tables (`derived/publishedCollege.ts`); none other has rows. */
const COLLEGE_PUBLISHED = new Set([
  'pub_team_sdv_ratings',
  'pub_player_sdv_bpm',
  'pub_player_ncaa_rapm',
  'pub_player_ncaa_rapm_team'
])

/** Why an NBA dashboard or model is not read for the colleges: none of their releases holds it. */
const NBA_PUBLISHED =
  'Not published for college basketball: no release holds the league dashboards this comes from.'
const NBA_IMPACT =
  "Not published for college basketball: SportsDataverse's college models are listed under their own names (its RAPM, BPM and team ratings)."

/**
 * stats.ncaa.org's shot file gives no shot type: every shot would read "other", so the counts by type
 * are not shown (`ncaa-data-sources.md`, "Shots").
 */
const NO_SHOT_TYPE = "stats.ncaa.org's shot file gives no shot type."
const TYPE_PARTS = new RegExp(
  `^(opp_)?(${SHOT_TYPES.map((t) => t.key).join('|')})_(fga|fgm|pts|ast|xfgm|xpts)$`
)

/**
 * Neither shot file names a make's assist. The play by play does (`play_nba.assist_id`), but a shot
 * carries no period or clock before 2026-27 to find its play, so assisted makes are counted by value
 * (twos and threes, the play-derived counts) and not by zone (`PlaysRecipe.assists`).
 */
const NO_ASSISTS =
  "Not counted for the college leagues: stats.ncaa.org's shot file names no assist, and its shots carry no clock to find their play before 2026-27. Assisted twos and threes are counted from the play by play."

/**
 * What stats.ncaa.org's play by play does not record (`ncaa-data-sources.md`, "Plays"): no ejection, no
 * defensive three seconds (not a rule in college basketball), no goaltending or kicked-ball violation (it
 * names turnovers, not the other side's violations), and fouls by class (personal, shooting, offensive,
 * loose ball, technical, flagrant) without the NBA's take, transition-take, clear-path or flagrant types.
 */
const NOT_IN_PLAYS: readonly [readonly string[], string][] = [
  [['ejections'], "stats.ncaa.org's play by play records no ejections."],
  [['def3'], 'College basketball has no defensive three-second rule.'],
  [
    ['goaltend', 'kicked'],
    "stats.ncaa.org's play by play does not record the defense's goaltending or kicked-ball violations."
  ],
  [
    ['pf_take', 'pf_transition_take', 'pf_clear_path'],
    "stats.ncaa.org's play by play does not tell these fouls apart: they are counted as personal fouls."
  ],
  [
    ['pf_flagrant1', 'pf_flagrant2'],
    "stats.ncaa.org's play by play flags a flagrant foul without its type (1 or 2)."
  ]
]
const ASSIST_PARTS = new RegExp(
  `^(opp_)?(${[...SHOT_ZONES, ...SHOT_ZONE_GROUPS, ...SHOT_BANDS, ...SHOT_TYPES]
    .map((b): string => b.key)
    .concat('shots')
    .join('|')})_ast$`
)

/** The metric's coverage in a college league, from the components it reads (`componentsOf`). */
export function collegeCoverage(def: MetricDef, parts: readonly string[]): MetricCoverage {
  const same = SAME_AS[def.id]
  if (same) return { firstSeason: FIRST, unavailable: same }
  const family = NOT_PUBLISHED[def.family]
  if (family) return { firstSeason: FIRST, unavailable: family }
  if (def.published && !COLLEGE_PUBLISHED.has(def.published)) {
    return { firstSeason: FIRST, unavailable: def.family === 'impact' ? NBA_IMPACT : NBA_PUBLISHED }
  }
  if (def.family === 'shots' || def.built?.startsWith('shot_')) {
    if (parts.some((p) => TYPE_PARTS.test(p)))
      return { firstSeason: FIRST, unavailable: NO_SHOT_TYPE }
    if (parts.some((p) => ASSIST_PARTS.test(p)))
      return { firstSeason: FIRST, unavailable: NO_ASSISTS }
  }
  // The exponent is the NBA's until the league's own is fitted with its models (T1302.8): shown as a
  // value, it would be the NBA's rule on college scores.
  if (def.pythagorean) return { firstSeason: FIRST, unavailable: PYTHAGOREAN }
  for (const [columns, reason] of NOT_IN_BOX) {
    if (parts.some((p) => columns.includes(p))) return { firstSeason: FIRST, unavailable: reason }
  }
  for (const [columns, reason] of NOT_IN_PLAYS) {
    if (parts.some((p) => columns.includes(p.replace(/^opp_/, '')))) {
      return { firstSeason: FIRST, unavailable: reason }
    }
  }
  let firstSeason = FIRST
  for (const [columns, from] of LATER) {
    if (parts.some((p) => columns.includes(p))) firstSeason = Math.max(firstSeason, from)
  }
  // Policy 4: what the source the on-court numbers read covers is stated wherever one is read.
  if (def.family === 'on_court') {
    const note =
      LEAGUES.ncaam.onCourtFrom === 'plays' ? COLLEGE_PLAYS_COVERAGE : COLLEGE_LINEUP_COVERAGE
    return { firstSeason, seasonNotes: [{ seasons: WINDOW, note }] }
  }
  return { firstSeason }
}

/** Every season of the window and well past it, for a note that holds in each. */
const WINDOW = Array.from({ length: 2040 - FIRST + 1 }, (_, i) => FIRST + i)
