import type { MetricDef } from '../types'
import { metric, ratio, type Opts } from './define'

/**
 * Reference section 14: impact models as SportsDataverse calculates them, from 1996-97. They are the
 * dataset's own fits, not the numbers the models' authors publish, so every label says whose they are.
 * Play-in games are left out of them. A season reads as published; seasons together are weighted by
 * what each value was fitted on (`derived/publishedTables.ts`). DARKO's projection is read as a
 * published value, like any other column.
 */
const SOURCES = ["SportsDataverse's impact models"]
const FIRST = 1997
const DARKO_FIRST = 1998

const TABLE = 'pub_player_impact'
const DARKO = 'pub_player_darko'

const WHOSE = 'SportsDataverse’s own calculation, not the figure the model’s authors publish.'
const NO_PLAY_IN = 'Play-in games are left out.'
const BY_POSS =
  'Over more than one season, the published values are weighted by the possessions they were fitted on.'
const BY_MIN = 'Over more than one season, the published values are weighted by minutes.'

const sdv = (label: string): string => `${label} (SportsDataverse)`
const head = (short: string): string => `${short} SDV`

/** A model value per 100 possessions, stored times what it was fitted on. */
const model = (column: string, sample: string, minSample: number, o: Partial<Opts> = {}): Opts => ({
  value: ratio(column, sample),
  sample,
  minSample,
  family: 'impact',
  kind: 'model',
  unit: 'rating',
  decimals: 1,
  sources: SOURCES,
  firstSeason: FIRST,
  published: TABLE,
  ...o
})

const RAPM: MetricDef[] = [
  metric(
    'sdv_rapm',
    sdv('RAPM'),
    head('RAPM'),
    `Regularized adjusted plus-minus: points per 100 possessions the player added, from the scores of every stint they played, with each player’s estimate pulled toward zero. ${WHOSE} ${NO_PLAY_IN} ${BY_POSS}`,
    { ...model('rapm', 'impact_poss', 4000), categories: ['impact.pm_models'] }
  ),
  metric(
    'sdv_o_rapm',
    sdv('Offensive RAPM'),
    head('ORAPM'),
    `The offensive part of RAPM: points per 100 possessions the player added at that end. ${WHOSE} ${NO_PLAY_IN} ${BY_POSS}`,
    { ...model('o_rapm', 'off_poss', 2000), categories: ['impact.pm_models', 'offense.impact'] }
  ),
  metric(
    'sdv_d_rapm',
    sdv('Defensive RAPM'),
    head('DRAPM'),
    `The defensive part of RAPM: points per 100 possessions the player saved at that end. ${WHOSE} ${NO_PLAY_IN} ${BY_POSS}`,
    { ...model('d_rapm', 'def_poss', 2000), categories: ['impact.pm_models', 'defense.impact'] }
  ),
  metric(
    'sdv_adj_rapm',
    sdv('Adjusted RAPM'),
    head('aRAPM'),
    `A second RAPM fit the dataset publishes beside the first. Centred on zero like RAPM, it differs from it by about 3 points per 100 possessions on a typical player-season. ${WHOSE} ${NO_PLAY_IN} ${BY_POSS}`,
    { ...model('adj_rapm', 'impact_poss', 4000), categories: ['impact.pm_models'] }
  ),
  metric(
    'sdv_o_adj_rapm',
    sdv('Offensive adjusted RAPM'),
    head('OaRAPM'),
    `The offensive part of adjusted RAPM. It is not centred on zero: it averages about +9 a season, and the defensive part about −9, so only their sum compares with RAPM. ${WHOSE} ${NO_PLAY_IN} ${BY_POSS}`,
    {
      ...model('o_adj_rapm', 'off_poss', 2000, { direction: 'neutral' }),
      categories: ['impact.pm_models', 'offense.impact']
    }
  ),
  metric(
    'sdv_d_adj_rapm',
    sdv('Defensive adjusted RAPM'),
    head('DaRAPM'),
    `The defensive part of adjusted RAPM. It is not centred on zero: it averages about −9 a season, and the offensive part about +9, so only their sum compares with RAPM. ${WHOSE} ${NO_PLAY_IN} ${BY_POSS}`,
    {
      ...model('d_adj_rapm', 'def_poss', 2000, { direction: 'neutral' }),
      categories: ['impact.pm_models', 'defense.impact']
    }
  )
]

const BOX: MetricDef[] = [
  metric(
    'sdv_spm',
    sdv('SPM'),
    head('SPM'),
    `Statistical plus-minus: the points per 100 possessions a fitted model of the box score says the player added. ${WHOSE} ${NO_PLAY_IN} ${BY_MIN}`,
    { ...model('spm', 'minutes', 1000), categories: ['impact.box_models'] }
  ),
  metric(
    'sdv_ospm',
    sdv('Offensive SPM'),
    head('OSPM'),
    `The offensive part of SPM. ${WHOSE} ${NO_PLAY_IN} ${BY_MIN}`,
    { ...model('ospm', 'minutes', 1000), categories: ['impact.box_models', 'offense.impact'] }
  ),
  metric(
    'sdv_dspm',
    sdv('Defensive SPM'),
    head('DSPM'),
    `The defensive part of SPM. ${WHOSE} ${NO_PLAY_IN} ${BY_MIN}`,
    { ...model('dspm', 'minutes', 1000), categories: ['impact.box_models', 'defense.impact'] }
  ),
  metric(
    'sdv_bpm',
    sdv('BPM'),
    head('BPM'),
    `Box plus-minus, version 2: points per 100 possessions above an average player, from the box score, position and role, adjusted to the team’s rating. It is not Basketball-Reference’s published BPM. ${WHOSE} ${NO_PLAY_IN} ${BY_MIN}`,
    { ...model('bpm', 'minutes', 1000), categories: ['impact.box_models'] }
  ),
  metric(
    'sdv_obpm',
    sdv('Offensive BPM'),
    head('OBPM'),
    `The offensive part of BPM. ${WHOSE} ${NO_PLAY_IN} ${BY_MIN}`,
    { ...model('obpm', 'minutes', 1000), categories: ['impact.box_models', 'offense.impact'] }
  ),
  metric(
    'sdv_dbpm',
    sdv('Defensive BPM'),
    head('DBPM'),
    `The defensive part of BPM: BPM less its offensive part, not a count of stops. ${WHOSE} ${NO_PLAY_IN} ${BY_MIN}`,
    { ...model('dbpm', 'minutes', 1000), categories: ['impact.box_models', 'defense.impact'] }
  ),
  metric(
    'sdv_war',
    sdv('Wins above replacement'),
    head('WAR'),
    `Wins the player added over a replacement-level player, in the dataset’s own model. Its scale is its own: it does not match other publishers’ WAR or VORP. Added up over seasons. ${WHOSE} ${NO_PLAY_IN}`,
    {
      value: '{war}',
      sample: 'games',
      family: 'impact',
      kind: 'model',
      aggregation: 'sum',
      totalOnly: true,
      unit: 'number',
      decimals: 1,
      sources: SOURCES,
      firstSeason: FIRST,
      published: TABLE,
      categories: ['impact.box_models']
    }
  )
]

/** A DARKO value: one regular season's state, read as published. */
const darko = (column: string, o: Partial<Opts> = {}): Opts => ({
  value: ratio(column, 'games'),
  sample: 'games',
  family: 'impact',
  kind: 'model',
  unit: 'rating',
  decimals: 1,
  sources: SOURCES,
  firstSeason: DARKO_FIRST,
  published: DARKO,
  oneSeason: true,
  unavailable: GONE,
  ...o
})

const GONE =
  'The dataset dropped its DARKO columns in November 2026. BOBAN, in their place, is SportsDataverse’s own model of the same kind, not DARKO: see the BOBAN metrics.'
const DARKO_NOTE = `It reads for one regular season at a time. ${GONE}`

const DARKO_METRICS: MetricDef[] = [
  metric(
    'sdv_darko_skill',
    sdv('DARKO skill'),
    head('DARKO'),
    `DARKO’s estimate of the player’s impact at the end of the season, in points per 100 possessions, with recent games weighted most. ${WHOSE} ${DARKO_NOTE}`,
    {
      ...darko('darko_filtered_skill'),
      categories: ['impact.pm_models', 'predictive.player_projections']
    }
  ),
  metric(
    'sdv_darko_next',
    sdv('DARKO next-season projection'),
    head('DARKO Next'),
    `DARKO’s projection of the player’s impact next season, in points per 100 possessions, made at the end of this one. A published model value, not a prediction from Metis. ${WHOSE} ${DARKO_NOTE}`,
    { ...darko('darko_projected_rating'), categories: ['predictive.player_projections'] }
  ),
  metric(
    'sdv_darko_sd',
    sdv('DARKO projection spread'),
    head('DARKO SD'),
    `The standard deviation of DARKO’s next-season projection: how unsure it is. About 2 for most players and about 10 for those with little history. ${WHOSE} ${DARKO_NOTE}`,
    {
      ...darko('darko_projected_sd', { direction: 'neutral', firstSeason: 1999 }),
      categories: ['predictive.player_projections']
    }
  )
]

/**
 * BOBAN ("Bayesian Online Box-Augmented Net"): SportsDataverse's own Kalman filter over each player's
 * season-by-season RAPM, with an aging curve (`nba-data-sources.md`, "The impact file's `boban_*`
 * columns"). SportsDataverse is its maker, so it is shown as theirs and under its own name. It is one
 * regular season's state, read as DARKO was: its playoff rows repeat the regular season's.
 */
const BOBAN_OWN =
  'SportsDataverse’s own model, of the same kind as DARKO but not DARKO, published in the dataset’s impact file.'
const BOBAN_NOTE = `It reads for one regular season at a time, and from the season after a player’s first: the filter needs a season behind it. ${BOBAN_OWN}`

const boban = (column: string, o: Partial<Opts> = {}): Opts => ({
  value: ratio(column, 'games'),
  sample: 'games',
  family: 'impact',
  kind: 'model',
  unit: 'rating',
  decimals: 1,
  sources: SOURCES,
  firstSeason: DARKO_FIRST,
  published: 'pub_player_boban',
  oneSeason: true,
  ...o
})

const BOBAN_METRICS: MetricDef[] = [
  metric(
    'sdv_boban_skill',
    sdv('BOBAN skill'),
    head('BOBAN'),
    `BOBAN’s estimate of the player’s impact at the end of the season, in points per 100 possessions against an average player: a Kalman filter over their RAPM season by season, each season weighted by its possessions. ${BOBAN_NOTE}`,
    { ...boban('boban_filtered_skill'), categories: ['impact.pm_models'] }
  ),
  metric(
    'sdv_boban_next',
    sdv('BOBAN next-season projection'),
    head('BOBAN Next'),
    `BOBAN’s projection of the player’s impact next season, in points per 100 possessions: the end-of-season skill plus the aging curve’s drift at their age. A published model value, not a prediction from Metis. ${BOBAN_NOTE}`,
    { ...boban('boban_projected_rating'), categories: ['predictive.player_projections'] }
  ),
  metric(
    'sdv_boban_sd',
    sdv('BOBAN projection spread'),
    head('BOBAN SD'),
    `The standard deviation of BOBAN’s next-season projection: how unsure it is. One value a season for most players, 1.3 to 1.9, and about 10 in a player’s first season in the file. ${BOBAN_NOTE}`,
    {
      ...boban('boban_projected_sd', { direction: 'neutral', firstSeason: 1999 }),
      categories: ['predictive.player_projections']
    }
  )
]

/**
 * SportsDataverse's box-score prior, and the RAPM fitted toward it with the ridge's strength chosen
 * by REML. Published for the regular season alone, in the NBA's file only (`wnba.ts` says so there).
 */
const PRIOR_TABLE = 'pub_player_impact_prior'
const PRIOR_OWN = 'SportsDataverse’s own fit, published in the dataset’s impact file.'
const REGULAR_ONLY = 'Published for the regular season only.'
const prior = (column: string, sample: string, minSample: number, o: Partial<Opts> = {}): Opts => ({
  ...model(column, sample, minSample),
  published: PRIOR_TABLE,
  ...o
})

const PRIOR_METRICS: MetricDef[] = [
  metric(
    'sdv_box_prior',
    sdv('Box prior'),
    head('BoxPrior'),
    `The points per 100 possessions the player’s box score predicts over the whole regular season, which SportsDataverse’s REML RAPM is pulled toward instead of zero. It differs from the box prior of the latest expected impact, which is as of a date within the season. ${PRIOR_OWN} ${REGULAR_ONLY} ${BY_POSS}`,
    { ...prior('box_prior', 'prior_poss', 4000), categories: ['impact.box_models'] }
  ),
  metric(
    'sdv_o_box_prior',
    sdv('Offensive box prior'),
    head('OBoxPrior'),
    `The offensive part of the box prior. ${PRIOR_OWN} ${REGULAR_ONLY} ${BY_POSS}`,
    {
      ...prior('o_box_prior', 'prior_off_poss', 2000),
      categories: ['impact.box_models', 'offense.impact']
    }
  ),
  metric(
    'sdv_d_box_prior',
    sdv('Defensive box prior'),
    head('DBoxPrior'),
    `The defensive part of the box prior. ${PRIOR_OWN} ${REGULAR_ONLY} ${BY_POSS}`,
    {
      ...prior('d_box_prior', 'prior_def_poss', 2000),
      categories: ['impact.box_models', 'defense.impact']
    }
  ),
  metric(
    'sdv_reml_rapm',
    sdv('REML RAPM'),
    head('rRAPM'),
    `RAPM pulled toward each player’s box prior rather than toward zero, with how hard it pulls estimated from the data (REML): points per 100 possessions the player added. ${PRIOR_OWN} ${REGULAR_ONLY} ${BY_POSS}`,
    { ...prior('reml_rapm', 'prior_poss', 4000), categories: ['impact.pm_models'] }
  ),
  metric(
    'sdv_o_reml_rapm',
    sdv('Offensive REML RAPM'),
    head('OrRAPM'),
    `The offensive part of REML RAPM. ${PRIOR_OWN} ${REGULAR_ONLY} ${BY_POSS}`,
    {
      ...prior('o_reml_rapm', 'prior_off_poss', 2000),
      categories: ['impact.pm_models', 'offense.impact']
    }
  ),
  metric(
    'sdv_d_reml_rapm',
    sdv('Defensive REML RAPM'),
    head('DrRAPM'),
    `The defensive part of REML RAPM. ${PRIOR_OWN} ${REGULAR_ONLY} ${BY_POSS}`,
    {
      ...prior('d_reml_rapm', 'prior_def_poss', 2000),
      categories: ['impact.pm_models', 'defense.impact']
    }
  )
]

/**
 * SportsDataverse's current impact (`nba_current_impact`, T1703.2): each player's expected offence
 * and defence per 100 possessions, as of opening night and every 7 days after, from earlier games only:
 * a box prior with a Kalman-filtered deviation from it. Read one regular season at a time: the season's
 * last weekly estimate (early April), and the opening-night one, made before the season's first game.
 */
const CURRENT_OWN =
  'SportsDataverse’s own model, published weekly in the dataset’s current-impact file.'
const ONE_STATE = 'It reads for one regular season at a time, from 2006-07.'
const current = (
  column: string,
  rows: 'ci_rows' | 'ce_rows',
  table: string,
  o: Partial<Opts> = {}
): Opts => ({
  value: ratio(column, rows),
  sample: rows,
  // One estimate a player-season: the minimum is that it exists.
  minSample: 1,
  family: 'impact',
  kind: 'model',
  unit: 'rating',
  decimals: 1,
  sources: SOURCES,
  firstSeason: 2007,
  published: table,
  oneSeason: true,
  ...o
})
const LAST = 'pub_player_current_impact'
const OPENING = 'pub_player_expected_impact'
const LAST_WORDS =
  'its latest weekly estimate of the season, from every game before its date: early April for a finished season, the latest week for the season under way'
const OPENING_WORDS =
  'its estimate on opening night, made before the season’s first game from earlier seasons alone'

const CURRENT_METRICS: MetricDef[] = [
  metric(
    'sdv_current_impact',
    sdv('Expected impact, latest estimate'),
    head('ExpLast'),
    `The points per 100 possessions SportsDataverse expects the player to add, offence and defence together, as of ${LAST_WORDS}. ${CURRENT_OWN} ${ONE_STATE}`,
    {
      ...current('ci_total', 'ci_rows', LAST),
      categories: ['impact.pm_models', 'predictive.player_projections']
    }
  ),
  metric(
    'sdv_o_current_impact',
    sdv('Offensive expected impact, latest estimate'),
    head('OExpLast'),
    `The offensive part of the latest expected impact, as of ${LAST_WORDS}. ${CURRENT_OWN} ${ONE_STATE}`,
    {
      ...current('ci_off', 'ci_rows', LAST),
      categories: ['impact.pm_models', 'offense.impact']
    }
  ),
  metric(
    'sdv_d_current_impact',
    sdv('Defensive expected impact, latest estimate'),
    head('DExpLast'),
    `The defensive part of the latest expected impact, as of ${LAST_WORDS}. ${CURRENT_OWN} ${ONE_STATE}`,
    {
      ...current('ci_def', 'ci_rows', LAST),
      categories: ['impact.pm_models', 'defense.impact']
    }
  ),
  metric(
    'sdv_expected_impact',
    sdv('Expected impact, opening night'),
    head('ExpOpen'),
    `The points per 100 possessions SportsDataverse expected the player to add before the season began: ${OPENING_WORDS}. A published forecast, not a prediction from Metis. ${CURRENT_OWN} ${ONE_STATE}`,
    { ...current('ce_total', 'ce_rows', OPENING), categories: ['predictive.player_projections'] }
  ),
  metric(
    'sdv_o_expected_impact',
    sdv('Offensive expected impact, opening night'),
    head('OExpOpen'),
    `The offensive part of the opening-night expected impact: ${OPENING_WORDS}. ${CURRENT_OWN} ${ONE_STATE}`,
    { ...current('ce_off', 'ce_rows', OPENING), categories: ['predictive.player_projections'] }
  ),
  metric(
    'sdv_d_expected_impact',
    sdv('Defensive expected impact, opening night'),
    head('DExpOpen'),
    `The defensive part of the opening-night expected impact: ${OPENING_WORDS}. ${CURRENT_OWN} ${ONE_STATE}`,
    { ...current('ce_def', 'ce_rows', OPENING), categories: ['predictive.player_projections'] }
  ),
  metric(
    'sdv_current_prior',
    sdv('Box prior of the latest estimate'),
    head('LastPrior'),
    `The points per 100 possessions the box score predicts, which the expected impact starts from and moves away from as the games come in, as of ${LAST_WORDS}. It differs from the impact file's Box prior (SportsDataverse), which is fitted once on the whole regular season. ${CURRENT_OWN} ${ONE_STATE}`,
    { ...current('ci_prior', 'ci_rows', LAST), categories: ['impact.box_models'] }
  ),
  metric(
    'sdv_o_current_prior',
    sdv('Offensive box prior of the latest estimate'),
    head('OLastPrior'),
    `The offensive part of the latest estimate's box prior, as of ${LAST_WORDS}. ${CURRENT_OWN} ${ONE_STATE}`,
    {
      ...current('ci_o_prior', 'ci_rows', LAST),
      categories: ['impact.box_models', 'offense.impact']
    }
  ),
  metric(
    'sdv_d_current_prior',
    sdv('Defensive box prior of the latest estimate'),
    head('DLastPrior'),
    `The defensive part of the latest estimate's box prior, as of ${LAST_WORDS}. ${CURRENT_OWN} ${ONE_STATE}`,
    {
      ...current('ci_d_prior', 'ci_rows', LAST),
      categories: ['impact.box_models', 'defense.impact']
    }
  )
]

/**
 * FiveThirtyEight's RAPTOR (D54), as published in its archived files: the maker's own values, read,
 * not computed. Rates per 100 possessions, weighted by possessions over teams, season types and
 * seasons (`derived/raptor.ts`). The total and its ends from 1993-94, the box-score and on/off parts
 * from 2013-14, all through 2021-22, when FiveThirtyEight stopped.
 */
const RAPTOR_SOURCES = ['FiveThirtyEight’s RAPTOR (CC BY 4.0)']
const RAPTOR_TABLE = 'pub_player_raptor'
const RAPTOR_FIRST = 1994
const RAPTOR_MODERN_FIRST = 2014
const RAPTOR_LAST = 2022
const RAPTOR_AFTER = Array.from({ length: 2040 - RAPTOR_LAST }, (_, i) => RAPTOR_LAST + 1 + i)
const RAPTOR_THROUGH =
  'Published through 2021-22: FiveThirtyEight stopped updating RAPTOR after that season.'
const RAPTOR_WHOSE =
  'FiveThirtyEight’s published value, from its archived files; Metis did not compute it.'
const RAPTOR_ERAS =
  'Its inputs grow with the seasons: the box score alone to 2000-01, with single-year plus-minus to 2012-13, with player tracking from 2013-14.'
const RAPTOR_BY_POSS =
  'Over more than one team, season type or season, the published values are weighted by possessions.'
const p538 = (label: string): string => `${label} (FiveThirtyEight)`
const h538 = (short: string): string => `${short} 538`

/** A RAPTOR rate per 100 possessions, stored times the possessions it was measured over. */
const raptor = (column: string, modern: boolean, o: Partial<Opts> = {}): Opts => {
  const sample = modern ? 'rp_mposs' : 'rp_poss'
  return {
    value: ratio(column, sample),
    sample,
    minSample: 2000,
    family: 'impact',
    kind: 'model',
    unit: 'rating',
    decimals: 1,
    sources: RAPTOR_SOURCES,
    firstSeason: modern ? RAPTOR_MODERN_FIRST : RAPTOR_FIRST,
    missingSeasons: RAPTOR_AFTER,
    missingReason: RAPTOR_THROUGH,
    published: RAPTOR_TABLE,
    ...o
  }
}

const RAPTOR_METRICS: MetricDef[] = [
  metric(
    'raptor_total',
    p538('RAPTOR'),
    h538('RAPTOR'),
    `Points per 100 possessions the player added above an average player, offence and defence together, from the box score and the team’s margin with them on and off the floor. ${RAPTOR_ERAS} ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_total', false), categories: ['impact.pm_models'] }
  ),
  metric(
    'raptor_offense',
    p538('Offensive RAPTOR'),
    h538('ORAPTOR'),
    `The offensive part of RAPTOR: points per 100 possessions the player added at that end. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_off', false), categories: ['impact.pm_models', 'offense.impact'] }
  ),
  metric(
    'raptor_defense',
    p538('Defensive RAPTOR'),
    h538('DRAPTOR'),
    `The defensive part of RAPTOR: points per 100 possessions the player saved at that end. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_def', false), categories: ['impact.pm_models', 'defense.impact'] }
  ),
  metric(
    'raptor_box_total',
    p538('Box RAPTOR'),
    h538('BoxRAP'),
    `The part of RAPTOR from the box score and player tracking alone. From 2013-14, when tracking began. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_box_total', true), categories: ['impact.box_models'] }
  ),
  metric(
    'raptor_box_offense',
    p538('Offensive box RAPTOR'),
    h538('OBoxRAP'),
    `The offensive part of box RAPTOR. From 2013-14. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_box_off', true), categories: ['impact.box_models', 'offense.impact'] }
  ),
  metric(
    'raptor_box_defense',
    p538('Defensive box RAPTOR'),
    h538('DBoxRAP'),
    `The defensive part of box RAPTOR. From 2013-14. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_box_def', true), categories: ['impact.box_models', 'defense.impact'] }
  ),
  metric(
    'raptor_onoff_total',
    p538('On/off RAPTOR'),
    h538('OnOffRAP'),
    `The part of RAPTOR from the team’s margin with the player on the floor and off it. From 2013-14. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_onoff_total', true), categories: ['impact.pm_models'] }
  ),
  metric(
    'raptor_onoff_offense',
    p538('Offensive on/off RAPTOR'),
    h538('OOnOffRAP'),
    `The offensive part of on/off RAPTOR. From 2013-14. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_onoff_off', true), categories: ['impact.pm_models', 'offense.impact'] }
  ),
  metric(
    'raptor_onoff_defense',
    p538('Defensive on/off RAPTOR'),
    h538('DOnOffRAP'),
    `The defensive part of on/off RAPTOR. From 2013-14. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_onoff_def', true), categories: ['impact.pm_models', 'defense.impact'] }
  ),
  metric(
    'raptor_war',
    p538('RAPTOR WAR'),
    h538('WAR'),
    `Wins above replacement from RAPTOR: the wins the player added over a replacement-level player in the minutes they played. Its scale is FiveThirtyEight’s own. Added up over seasons and season types. ${RAPTOR_WHOSE}`,
    {
      value: '{rp_war}',
      sample: 'rp_poss',
      family: 'impact',
      kind: 'model',
      aggregation: 'sum',
      totalOnly: true,
      unit: 'number',
      decimals: 1,
      sources: RAPTOR_SOURCES,
      firstSeason: RAPTOR_FIRST,
      missingSeasons: RAPTOR_AFTER,
      missingReason: RAPTOR_THROUGH,
      published: RAPTOR_TABLE,
      categories: ['impact.box_models']
    }
  ),
  metric(
    'raptor_predator',
    p538('PREDATOR'),
    h538('PRED'),
    `Predictive RAPTOR: points per 100 possessions above average, with the parts weighted to predict a player’s future rather than describe the season. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_pred_total', false), categories: ['predictive.player_projections'] }
  ),
  metric(
    'raptor_predator_offense',
    p538('Offensive PREDATOR'),
    h538('OPRED'),
    `The offensive part of PREDATOR. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_pred_off', false), categories: ['predictive.player_projections'] }
  ),
  metric(
    'raptor_predator_defense',
    p538('Defensive PREDATOR'),
    h538('DPRED'),
    `The defensive part of PREDATOR. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    { ...raptor('rp_pred_def', false), categories: ['predictive.player_projections'] }
  ),
  metric(
    'raptor_pace_impact',
    p538('RAPTOR pace impact'),
    h538('PaceImp'),
    `The player’s effect on the team’s possessions per 48 minutes with them on the floor. Neither good nor bad in itself. ${RAPTOR_WHOSE} ${RAPTOR_BY_POSS}`,
    {
      ...raptor('rp_pace', false),
      unit: 'number',
      direction: 'neutral',
      categories: ['impact.on_court']
    }
  )
]

/**
 * The family's preset leads with these, so RAPM, BPM, SPM, WAR and BOBAN show before the adjusted
 * RAPM and the parts of SPM, which a label sort would put first. BOBAN's projection is not among them:
 * the preset's first column by label sorts the board, and a board of ratings should not rank by a
 * forecast. It stays one click away in the column picker.
 */
const CORE = new Set([
  'sdv_rapm',
  'sdv_o_rapm',
  'sdv_d_rapm',
  'sdv_bpm',
  'sdv_obpm',
  'sdv_dbpm',
  'sdv_spm',
  'sdv_war',
  'sdv_boban_skill'
])

export const IMPACT: MetricDef[] = [
  ...RAPM,
  ...BOX,
  ...BOBAN_METRICS,
  ...PRIOR_METRICS,
  ...CURRENT_METRICS,
  ...DARKO_METRICS,
  ...RAPTOR_METRICS
].map((m) => (CORE.has(m.id) ? { ...m, tier: 'core' } : m))

/** What the impact samples count, in words. */
export const IMPACT_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  rp_poss: 'possessions (RAPTOR)',
  rp_mposs: 'possessions with RAPTOR’s parts, from 2013-14',
  impact_poss: 'possessions on offense and defense',
  off_poss: 'offensive possessions',
  def_poss: 'defensive possessions',
  prior_poss: 'regular-season possessions on offense and defense',
  prior_off_poss: 'regular-season offensive possessions',
  prior_def_poss: 'regular-season defensive possessions',
  ci_rows: 'season-end estimate',
  ce_rows: 'opening-night estimate'
}
