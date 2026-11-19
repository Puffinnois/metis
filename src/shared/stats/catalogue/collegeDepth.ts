import { LEAGUES } from '../../leagues'
import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * The college leagues' published models and the families no source publishes (D44, T1302.6):
 *
 * - SportsDataverse's team ratings, its box-score BPM, its RAPM over every Division I possession and
 *   its RAPM within team, each labelled as SportsDataverse's, never Metis's or another publisher's.
 *   The two RAPM fits are different estimands: their own tables, columns and metrics, never mixed.
 * - The NET, its quadrants, the polls and the committee's seeds: no free source publishes them, so
 *   each is listed with the reason the registry gives (`League.unpublished`) and reads nothing.
 *
 * Every value is stored times what it was fitted on (`derived/publishedCollege.ts`), so a season reads
 * as published and seasons together are weighted. They are every game of a season together, so a scope
 * of part of the games answers why not (`EVERY_GAME_ONLY`).
 */

const FIRST = LEAGUES.ncaam.firstSeason

const COLLEGE_ONLY: MetricDef['leagues'] = {
  nba: null,
  wnba: null,
  ncaam: { firstSeason: FIRST },
  ncaaw: { firstSeason: FIRST }
}

const RATINGS_SOURCES = ["SportsDataverse's team ratings (sdv-py, over ESPN's box scores)"]
const BPM_SOURCES = ["SportsDataverse's box-score BPM (sdv-py, over ESPN's box scores)"]
const RAPM_SOURCES = ["SportsDataverse's RAPM (ncaa-hoops-data, over stats.ncaa.org's possessions)"]

const WHOSE =
  'SportsDataverse’s own calculation, as it publishes it: not Metis’s, nor another publisher’s.'
const EVERY_GAME =
  'It covers every game of the season, the postseason with it; over several seasons the values are weighted by'

const sdv = (label: string): string => `${label} (SportsDataverse)`
const head = (short: string): string => `${short} SDV`

/** A published value per what it was fitted on, read back as published. */
const model = (
  table: string,
  column: string,
  sample: string,
  sources: string[],
  o: Partial<Opts> = {}
): Opts => ({
  value: ratio(column, sample),
  sample,
  family: 'impact',
  kind: 'model',
  unit: 'rating',
  decimals: 1,
  sources,
  firstSeason: FIRST,
  leagues: COLLEGE_ONLY,
  published: table,
  tier: 'extended',
  ...o
})

const RATINGS = 'pub_team_sdv_ratings'
const team = (column: string, o: Partial<Opts> = {}): Opts =>
  model(RATINGS, column, 'games', RATINGS_SOURCES, {
    entity: 'team',
    family: 'ratings',
    side: 'offense',
    ...o
  })

const TEAM_RATINGS: MetricDef[] = [
  metric(
    'sdv_adj_o',
    sdv('Adjusted offensive rating'),
    head('AdjO'),
    `Points scored per 100 possessions against an average Division I defense, adjusted for opponents and venue. ${WHOSE} ${EVERY_GAME} games.`,
    team('sdv_adj_o_w', { tier: 'core' })
  ),
  metric(
    'sdv_adj_d',
    sdv('Adjusted defensive rating'),
    head('AdjD'),
    `Points allowed per 100 possessions against an average Division I offense, adjusted for opponents and venue: lower is better. ${WHOSE} ${EVERY_GAME} games.`,
    team('sdv_adj_d_w', { direction: 'lower', side: 'defense', tier: 'core' })
  ),
  metric(
    'sdv_adj_em',
    sdv('Adjusted efficiency margin'),
    head('AdjEM'),
    `Adjusted offensive rating minus adjusted defensive rating: how many points per 100 possessions better than an average Division I team. ${WHOSE} ${EVERY_GAME} games.`,
    team('sdv_adj_em_w', { tier: 'core' })
  ),
  metric(
    'sdv_adj_tempo',
    sdv('Adjusted tempo'),
    head('AdjT'),
    `Possessions per 40 minutes against an average Division I opponent. ${WHOSE} ${EVERY_GAME} games.`,
    team('sdv_adj_tempo_w', { direction: 'neutral' })
  ),
  metric(
    'sdv_raw_o',
    sdv('Offensive rating, unadjusted'),
    head('RawO'),
    `Points scored per 100 possessions, before the adjustment for opponents. ${WHOSE} ${EVERY_GAME} games.`,
    team('sdv_raw_o_w')
  ),
  metric(
    'sdv_raw_d',
    sdv('Defensive rating, unadjusted'),
    head('RawD'),
    `Points allowed per 100 possessions, before the adjustment for opponents: lower is better. ${WHOSE} ${EVERY_GAME} games.`,
    team('sdv_raw_d_w', { direction: 'lower', side: 'defense' })
  ),
  metric(
    'sdv_adj_em_blend',
    sdv('Adjusted efficiency margin, blended with the preseason'),
    head('AdjEMb'),
    `The adjusted efficiency margin blended with a preseason prior, which weighs less as games are played. ${WHOSE} ${EVERY_GAME} games.`,
    team('sdv_adj_em_blend_w')
  )
]

const BPM = 'pub_player_sdv_bpm'
const bpm = (column: string, o: Partial<Opts> = {}): Opts =>
  model(BPM, column, 'minutes', BPM_SOURCES, { minSample: 300, ...o })

const BOX_BPM: MetricDef[] = [
  metric(
    'sdv_box_bpm',
    sdv('Box Plus/Minus'),
    head('BPM'),
    `Points per 100 possessions the player added over an average Division I player, estimated from the box score and constrained so a team's players add up to its adjusted efficiency margin. ${WHOSE} ${EVERY_GAME} minutes.`,
    bpm('sdv_box_bpm_w', { tier: 'core' })
  ),
  metric(
    'sdv_box_obpm',
    sdv('Offensive Box Plus/Minus'),
    head('OBPM'),
    `The offensive part of Box Plus/Minus. ${WHOSE} ${EVERY_GAME} minutes.`,
    bpm('sdv_box_obpm_w')
  ),
  metric(
    'sdv_box_dbpm',
    sdv('Defensive Box Plus/Minus'),
    head('DBPM'),
    `The defensive part of Box Plus/Minus. ${WHOSE} ${EVERY_GAME} minutes.`,
    bpm('sdv_box_dbpm_w')
  )
]

const RAPM = 'pub_player_ncaa_rapm'
const RAPM_TEAM = 'pub_player_ncaa_rapm_team'
const rapm = (column: string, sample: string, minSample: number, o: Partial<Opts> = {}): Opts =>
  model(RAPM, column, sample, RAPM_SOURCES, { minSample, ...o })
const teamRapm = (column: string, o: Partial<Opts> = {}): Opts =>
  model(RAPM_TEAM, column, 'ncaa_trapm_poss', RAPM_SOURCES, { minSample: 1000, ...o })
const LEAGUE_FIT =
  'One ridge regression a season over every Division I possession, on one league-wide scale.'
const TEAM_FIT =
  "Fitted within each team, against the player's own teammates: a different estimand from RAPM, never to be compared with it."

const RAPMS: MetricDef[] = [
  metric(
    'sdv_ncaa_rapm',
    sdv('RAPM'),
    head('RAPM'),
    `Regularized adjusted plus-minus: points per 100 possessions the player added, from the scores of every possession they played, each estimate pulled toward zero. ${LEAGUE_FIT} ${WHOSE} No value yet for a season in progress. Over several seasons the values are weighted by possessions.`,
    rapm('ncaa_rapm_w', 'possessions', 2000, { tier: 'core' })
  ),
  metric(
    'sdv_ncaa_orapm',
    sdv('Offensive RAPM'),
    head('ORAPM'),
    `The offensive part of RAPM: points per 100 possessions the player added at that end. ${LEAGUE_FIT} ${WHOSE}`,
    rapm('ncaa_orapm_w', 'ncaa_rapm_off_poss', 1000)
  ),
  metric(
    'sdv_ncaa_drapm',
    sdv('Defensive RAPM'),
    head('DRAPM'),
    `The defensive part of RAPM: points per 100 possessions the player saved at that end, so higher is better. ${LEAGUE_FIT} ${WHOSE}`,
    rapm('ncaa_drapm_w', 'ncaa_rapm_def_poss', 1000)
  ),
  metric(
    'sdv_ncaa_team_rapm',
    sdv('RAPM within team'),
    head('tRAPM'),
    `Points per 100 possessions the player added relative to their teammates: the offensive part less the defensive. ${TEAM_FIT} ${WHOSE}`,
    teamRapm('ncaa_trapm_w')
  ),
  metric(
    'sdv_ncaa_team_orapm',
    sdv('Offensive RAPM within team'),
    head('tORAPM'),
    `The offensive part of RAPM within team: points per 100 possessions added at that end, relative to teammates. ${TEAM_FIT} ${WHOSE}`,
    teamRapm('ncaa_trapm_off_w')
  ),
  metric(
    'sdv_ncaa_team_drapm',
    sdv('Defensive RAPM within team'),
    head('tDRAPM'),
    `The defensive part of RAPM within team: points per 100 possessions the opponents added with the player on the floor, relative to teammates, so lower is better (RAPM's defensive part has the other sign). ${TEAM_FIT} ${WHOSE}`,
    teamRapm('ncaa_trapm_def_w', { direction: 'lower' })
  )
]

const U = LEAGUES.ncaam.unpublished
/** A family no source publishes: listed in the college leagues with the registry's reason. */
const gone = (reason: string | undefined): Opts => ({
  value: '{games}',
  sample: 'games',
  entity: 'team',
  side: 'offense',
  family: 'ratings',
  kind: 'recorded',
  aggregation: 'sum',
  unit: 'count',
  decimals: 0,
  firstSeason: FIRST,
  leagues: {
    nba: null,
    wnba: null,
    ncaam: { firstSeason: FIRST, unavailable: reason },
    ncaaw: { firstSeason: FIRST, unavailable: reason }
  }
})

const NOT_PUBLISHED: MetricDef[] = [
  metric(
    'team_net_rank',
    'NET ranking',
    'NET',
    "The NCAA Evaluation Tool's ranking, which the selection committee reads.",
    gone(U.net)
  ),
  metric(
    'team_quadrant1',
    'Quadrant 1 record',
    'Q1',
    'Games against the strongest opponents by the NET and the venue.',
    gone(U.quadrants)
  ),
  metric('team_poll_rank', 'Poll ranking', 'Poll', 'The AP and coaches polls.', gone(U.polls)),
  metric(
    'team_tournament_seed',
    'NCAA tournament seed',
    'Seed',
    "The selection committee's seed for the NCAA tournament.",
    gone(U.seeds)
  )
]

/** What the college models' samples count, in words. */
export const COLLEGE_DEPTH_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  ncaa_rapm_off_poss: 'offensive possessions',
  ncaa_rapm_def_poss: 'defensive possessions',
  ncaa_trapm_poss: "the team's offensive possessions"
}

export const COLLEGE_DEPTH: MetricDef[] = [...TEAM_RATINGS, ...BOX_BPM, ...RAPMS, ...NOT_PUBLISHED]
