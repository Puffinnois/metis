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
    `The points per 100 possessions the player’s box score predicts, which SportsDataverse’s REML RAPM is pulled toward instead of zero. ${PRIOR_OWN} ${REGULAR_ONLY} ${BY_POSS}`,
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
  ...DARKO_METRICS
].map((m) => (CORE.has(m.id) ? { ...m, tier: 'core' } : m))

/** What the impact samples count, in words. */
export const IMPACT_SAMPLE_LABELS: Readonly<Record<string, string>> = {
  impact_poss: 'possessions on offense and defense',
  off_poss: 'offensive possessions',
  def_poss: 'defensive possessions',
  prior_poss: 'regular-season possessions on offense and defense',
  prior_off_poss: 'regular-season offensive possessions',
  prior_def_poss: 'regular-season defensive possessions'
}
