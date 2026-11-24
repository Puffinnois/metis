import {
  COLLEGE_LINEUP_COVERAGE,
  COLLEGE_PLAYS_COVERAGE,
  LEAGUES,
  seasonLabel,
  type League
} from '../../leagues'
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
    {
      ...splitShare('ncaa_rimm', 'ncaa_rima', 200),
      family: 'shooting',
      categories: ['shooting.rim_paint', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_rim_rate',
    'Share of shots at the rim',
    'Rim rate',
    `Shots at the rim over all field-goal attempts.${OWN}`,
    {
      ...splitShare('ncaa_rima', 'ncaa_fga', 500),
      family: 'shooting',
      direction: 'neutral',
      categories: ['shooting.rim_paint', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_mid_pct',
    'Mid-range field-goal percentage',
    'Mid FG%',
    `Two-point shots made away from the rim over those taken.${OWN}`,
    {
      ...splitShare('ncaa_midm', 'ncaa_mida', 200),
      family: 'shooting',
      categories: ['shooting.mid_range', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_mid_rate',
    'Share of shots from mid-range',
    'Mid rate',
    `Two-point shots away from the rim over all field-goal attempts.${OWN}`,
    {
      ...splitShare('ncaa_mida', 'ncaa_fga', 500),
      family: 'shooting',
      direction: 'neutral',
      categories: ['shooting.mid_range', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_putbacks',
    'Putbacks made',
    'PUTB',
    `Shots made straight from an offensive rebound.${OWN}`,
    {
      ...splitCount('ncaa_pbackm'),
      family: 'scoring',
      categories: ['scoring.by_situation', 'rebounding.offensive', 'offense.scoring']
    }
  ),
  ...sides(
    'ncaa_putback_pct',
    'Putback field-goal percentage',
    'PUTB%',
    `Putbacks made over putbacks tried.${OWN}`,
    {
      ...splitShare('ncaa_pbackm', 'ncaa_pbacka', 50),
      family: 'scoring',
      categories: ['shooting.transition_putbacks', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_rim_blocks',
    'Blocks at the rim',
    'BLK rim',
    `Blocks made on shots at the rim.${OWN}`,
    {
      ...splitCount('ncaa_blk_rim'),
      family: 'scoring',
      categories: ['defense.steals_blocks'],
      opponents: ['offense.shooting', 'shooting.rim_paint']
    }
  ),
  ...sides(
    'ncaa_trans_rate',
    'Share of shots in transition',
    'Trans rate',
    `Field-goal attempts in transition over all of them.${OWN}`,
    {
      ...splitShare('ncaa_fga_trans', 'ncaa_fga', 500),
      family: 'scoring',
      direction: 'neutral',
      categories: ['scoring.by_situation', 'offense.scoring']
    }
  ),
  ...sides(
    'ncaa_trans_pts',
    'Points in transition',
    'Trans PTS',
    `Points scored in transition.${OWN}`,
    {
      ...splitCount('ncaa_pts_trans'),
      family: 'scoring',
      categories: ['scoring.by_situation', 'offense.scoring']
    }
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
      family: 'scoring',
      categories: ['shooting.transition_putbacks', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_assisted_pct',
    'Share of field goals assisted',
    'AST FGM%',
    `Field goals made off an assist over all made.${OWN}`,
    {
      ...splitShare('ncaa_fgm_ast', 'ncaa_fgm', 200),
      family: 'scoring',
      direction: 'neutral',
      categories: ['scoring.assisted', 'offense.scoring']
    }
  ),
  ...sides(
    'ncaa_assisted_3pm_pct',
    'Share of threes assisted',
    'AST 3PM%',
    `Threes made off an assist over all made.${OWN}`,
    {
      ...splitShare('ncaa_fg3m_ast', 'ncaa_fg3m', 82),
      family: 'scoring',
      direction: 'neutral',
      categories: ['scoring.assisted', 'offense.scoring']
    }
  ),
  ...sides(
    'ncaa_assisted_rim_pct',
    'Share of rim makes assisted',
    'AST rim%',
    `Shots made at the rim off an assist over all made there.${OWN}`,
    {
      ...splitShare('ncaa_rimm_ast', 'ncaa_rimm', 100),
      family: 'scoring',
      direction: 'neutral',
      categories: ['scoring.assisted', 'offense.scoring']
    }
  ),
  // The rest of the transition splits and the half-court ones (T1703.2, D53).
  ...sides(
    'ncaa_trans_ast',
    'Assists in transition',
    'Trans AST',
    `Assists on plays in transition. stats.ncaa.org tags a play as in transition from its play by play.${OWN}`,
    {
      ...splitCount('ncaa_ast_trans'),
      family: 'scoring',
      categories: ['playmaking.passing', 'offense.playmaking']
    }
  ),
  ...sides(
    'ncaa_trans_orb',
    'Offensive rebounds in transition',
    'Trans OREB',
    `Offensive rebounds on plays in transition. stats.ncaa.org tags a play as in transition from its play by play.${OWN}`,
    {
      ...splitCount('ncaa_orb_trans'),
      family: 'scoring',
      categories: ['rebounding.offensive', 'offense.rebounding']
    }
  ),
  ...sides(
    'ncaa_trans_drb',
    'Defensive rebounds in transition',
    'Trans DREB',
    `Defensive rebounds on plays in transition. stats.ncaa.org tags a play as in transition from its play by play.${OWN}`,
    {
      ...splitCount('ncaa_drb_trans'),
      family: 'scoring',
      categories: ['rebounding.defensive', 'defense.rebounding']
    }
  ),
  ...sides(
    'ncaa_trans_stl',
    'Steals in transition',
    'Trans STL',
    `Steals on plays in transition. stats.ncaa.org tags a play as in transition from its play by play.${OWN}`,
    {
      ...splitCount('ncaa_stl_trans'),
      family: 'scoring',
      categories: ['defense.steals_blocks'],
      opponents: ['offense.turnovers', 'playmaking.turnovers']
    }
  ),
  ...sides(
    'ncaa_trans_blk',
    'Blocks in transition',
    'Trans BLK',
    `Blocks on plays in transition. stats.ncaa.org tags a play as in transition from its play by play.${OWN}`,
    {
      ...splitCount('ncaa_blk_trans'),
      family: 'scoring',
      categories: ['defense.steals_blocks'],
      opponents: ['offense.shooting', 'shooting.field_goals']
    }
  ),
  ...sides(
    'ncaa_trans_mid_pct',
    'Mid-range field-goal percentage in transition',
    'Trans mid%',
    `Two-point shots away from the rim made in transition over those taken. stats.ncaa.org tags a play as in transition from its play by play.${OWN}`,
    {
      ...splitShare('ncaa_midm_trans', 'ncaa_mida_trans', 30),
      family: 'shooting',
      categories: ['shooting.transition_putbacks', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_half_pts',
    'Points in the half court',
    'Half PTS',
    `Points scored in the half court. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitCount('ncaa_pts_half'),
      family: 'scoring',
      categories: ['scoring.by_situation', 'offense.scoring']
    }
  ),
  ...sides(
    'ncaa_half_efg_pct',
    'Effective field-goal percentage in the half court',
    'Half eFG%',
    `Half-court field goals with a made three worth one and a half, over half-court attempts. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...split({
        value: '({ncaa_fgm_half} + 0.5 * {ncaa_fg3m_half}) / nullif({ncaa_fga_half}, 0)',
        sample: 'ncaa_fga_half',
        unit: 'pct',
        minSample: 300
      }),
      family: 'shooting',
      categories: ['shooting.field_goals', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_half_rim_pct',
    'Field-goal percentage at the rim in the half court',
    'Half rim%',
    `Shots made at the rim in the half court over those taken there. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitShare('ncaa_rimm_half', 'ncaa_rima_half', 150),
      family: 'shooting',
      categories: ['shooting.rim_paint', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_half_mid_pct',
    'Mid-range field-goal percentage in the half court',
    'Half mid%',
    `Two-point shots away from the rim made in the half court over those taken. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitShare('ncaa_midm_half', 'ncaa_mida_half', 150),
      family: 'shooting',
      categories: ['shooting.mid_range', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_half_fg3_pct',
    'Three-point percentage in the half court',
    'Half 3P%',
    `Threes made in the half court over those taken. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitShare('ncaa_fg3m_half', 'ncaa_fg3a_half', 82),
      family: 'shooting',
      categories: ['shooting.threes', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_half_ft_pct',
    'Free-throw percentage in the half court',
    'Half FT%',
    `Free throws made from half-court fouls over those taken. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitShare('ncaa_ftm_half', 'ncaa_fta_half', 50),
      family: 'shooting',
      categories: ['shooting.field_goals', 'offense.shooting']
    }
  ),
  ...sides(
    'ncaa_half_ast',
    'Assists in the half court',
    'Half AST',
    `Assists on half-court plays. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitCount('ncaa_ast_half'),
      family: 'scoring',
      categories: ['playmaking.passing', 'offense.playmaking']
    }
  ),
  ...sides(
    'ncaa_half_tov',
    'Turnovers in the half court',
    'Half TOV',
    `Turnovers on half-court plays. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitCount('ncaa_tov_half', { direction: 'lower' }),
      family: 'scoring',
      categories: ['playmaking.turnovers', 'offense.turnovers']
    }
  ),
  ...sides(
    'ncaa_half_orb',
    'Offensive rebounds in the half court',
    'Half OREB',
    `Offensive rebounds on half-court plays. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitCount('ncaa_orb_half'),
      family: 'scoring',
      categories: ['rebounding.offensive', 'offense.rebounding']
    }
  ),
  ...sides(
    'ncaa_half_drb',
    'Defensive rebounds in the half court',
    'Half DREB',
    `Defensive rebounds on half-court plays. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitCount('ncaa_drb_half'),
      family: 'scoring',
      categories: ['rebounding.defensive', 'defense.rebounding']
    }
  ),
  ...sides(
    'ncaa_half_stl',
    'Steals in the half court',
    'Half STL',
    `Steals on half-court plays. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitCount('ncaa_stl_half'),
      family: 'scoring',
      categories: ['defense.steals_blocks'],
      opponents: ['offense.turnovers', 'playmaking.turnovers']
    }
  ),
  ...sides(
    'ncaa_half_blk',
    'Blocks in the half court',
    'Half BLK',
    `Blocks on half-court plays. The half court is every play stats.ncaa.org does not tag as transition.${OWN}`,
    {
      ...splitCount('ncaa_blk_half'),
      family: 'scoring',
      categories: ['defense.steals_blocks'],
      opponents: ['offense.shooting', 'shooting.field_goals']
    }
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
      reads: [NCAA_PLAYER_BOX, NCAA_TEAM_BOX],
      categories: ['results.pace']
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
      kind: 'derived',
      categories: ['results.ratings', 'offense.ratings']
    }
  )
]

/** Metrics that say the same as another in a 40-minute league. */
const SAME_AS: Record<string, string> = {
  team_pace40: 'College pace is per 40 minutes already: see Pace.'
}

/**
 * Metis's ratings and models in a college league (T1302.8), from its registry entry's fitted values
 * (`League.models`): every rating is fitted on games between two Division I teams, of every counted
 * type, and says so; Elo reads from the season after the window's first, which settles it; the
 * forecast and BPM read the registry's reasons; the adjusted ratings skip a season too even to rate.
 */
const ELO_TABLES = ['elo_game', 'elo_wins']
const BPM_METRICS = ['bpm', 'obpm', 'dbpm', 'vorp', 'team_vorp', 'bpm_position', 'bpm_role']
const DIVISION_I =
  'Fitted on games between two Division I teams, the postseason included: a game against a team outside Division I counts in the record and the box score, not here.'

/** The descriptions that name the NBA's rules, in a college league's words. */
function modelWords(league: League): Record<string, MetricCoverage['words']> {
  const m = league.models!
  const x = m.pythagoreanExponent
  return {
    team_pyth_pct: {
      description: `The winning percentage the points scored and allowed point to: points for to the power ${x}, over points for and against each to that power (the exponent fitted on the ${league.name}'s games between Division I teams; the NBA's is 14).`
    },
    team_srs: {
      description: `Points a game better than an average Division I team on a neutral floor: the margin of victory plus the strength of schedule, as of the last game in scope. ${DIVISION_I}`
    },
    team_sos: {
      description: `The average SRS of the Division I opponents played, one term per game, so SRS is the margin of victory plus it, as of the last game in scope. ${DIVISION_I}`
    },
    team_sos_left: {
      description:
        'The average SRS, as of the last game in scope, of the Division I opponents in the games on the schedule after it, one term per game. Blank once none are left.'
    },
    team_games_left: {
      description:
        'Games against Division I teams on the schedule after the last game in scope, as far as the schedule lists them.'
    },
    team_adj_ortg: {
      description: `Points scored per 100 estimated possessions against an average Division I defense on a neutral floor: a regression on the season so far that adjusts for the defenses faced and home court. ${DIVISION_I}`
    },
    team_adj_drtg: {
      description: `Points allowed per 100 estimated possessions against an average Division I offense on a neutral floor: a regression on the season so far that adjusts for the offenses faced and home court. ${DIVISION_I}`
    },
    team_adj_nrtg: {
      description: `Adjusted offensive rating minus adjusted defensive rating: points per 100 possessions better than an average Division I team on a neutral floor. ${DIVISION_I}`
    },
    team_elo: {
      description: `A rating carried from game to game, 1500 an average Division I team of ${seasonLabel(league, league.firstSeason)}: ${m.elo.homeCourt} points is the home court. FiveThirtyEight's Elo with its constants fitted on the ${league.name}'s own seasons (K ${m.elo.k}, ${Math.round(m.elo.carry * 100)} % of a rating's distance from the mean kept between seasons), as of the last game in scope. ${DIVISION_I}`
    },
    team_elo_exp_w: {
      description: `The games against Division I teams Elo expected the team to win: its win probability before each game, added over the games in scope.`
    },
    team_elo_w_over: {
      description:
        'Wins against Division I teams less the games Elo expected the team to win in them.'
    }
  }
}

/** Why Elo's first season is not shown: it is the burn-in. */
const eloBurnIn = (league: League): string =>
  `Elo is read from ${seasonLabel(league, league.models!.elo.firstSeason)}: every team starts at ${league.models!.elo.start} in ${seasonLabel(league, league.firstSeason)}, the first season loaded, which settles the ratings.`

function modelCoverage(def: MetricDef, league: League): MetricCoverage | null {
  if (!def.model || !league.models) return null
  const m = league.models
  const words = modelWords(league)[def.id]
  const withWords = (c: MetricCoverage): MetricCoverage => (words ? { ...c, words } : c)
  if (def.model === 'team_forecast' && m.forecastUnavailable) {
    return { firstSeason: FIRST, unavailable: m.forecastUnavailable }
  }
  if (BPM_METRICS.includes(def.id) && m.bpmUnavailable) {
    return { firstSeason: FIRST, unavailable: m.bpmUnavailable }
  }
  if (ELO_TABLES.includes(def.model)) {
    const burnIn = WINDOW.filter((s) => s < m.elo.firstSeason)
    return withWords({
      firstSeason: FIRST,
      missingSeasons: burnIn,
      missingReason: eloBurnIn(league)
    })
  }
  if (def.model === 'adjusted_rating' && m.adjustedThin.length > 0) {
    return withWords({
      firstSeason: FIRST,
      missingSeasons: [...m.adjustedThin],
      missingReason: `Not shown for ${m.adjustedThin.map((s) => seasonLabel(league, s)).join(' and ')}: the teams' two halves of the season disagree on their order, so an adjusted rating would be noise.`
    })
  }
  return withWords({ firstSeason: FIRST })
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
export function collegeCoverage(
  def: MetricDef,
  parts: readonly string[],
  league: League
): MetricCoverage {
  const same = SAME_AS[def.id]
  if (same) return { firstSeason: FIRST, unavailable: same }
  const model = modelCoverage(def, league)
  if (model) return model
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
  // The league's own exponent, fitted with its models (T1302.8); the formula takes it in `metricIn`.
  const words = league.models ? modelWords(league)[def.id] : undefined
  if (words) return { firstSeason: FIRST, words }
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
