import type { LeagueId } from '../leagues'
import type { Placement } from './categories'
import type { FlowSummary } from './playDetail'
/**
 * The one set of game types (D12). All-Star and preseason never count unless asked for. The college
 * leagues' postseason events are types of their own (D45), each league listing its own
 * (`League.seasonTypes`): the NCAA tournament is `playoffs` under its own name; the NIT, CBI, CIT, The
 * Basketball Classic (`tbc`) and the College Basketball Crown are the men's; the WNIT, WBI and WBIT the
 * women's.
 */
export const GAME_TYPES = [
  'regular',
  'play-in',
  'playoffs',
  'cup-final',
  'all-star',
  'preseason',
  'nit',
  'cbi',
  'cit',
  'tbc',
  'crown',
  'wnit',
  'wbi',
  'wbit'
] as const
export type GameType = (typeof GAME_TYPES)[number]

export type Entity = 'player' | 'team'

/** Position groups, with hybrids mapped to the first listed (`G-F` is a guard). */
export const POSITION_GROUPS = ['G', 'F', 'C'] as const
export type PositionGroup = (typeof POSITION_GROUPS)[number]

/** The sections of the statistics reference; one file each in `src/shared/stats/catalogue/`. */
export type MetricFamily =
  | 'traditional'
  | 'shooting'
  | 'possessions'
  | 'on_court'
  | 'scoring'
  | 'composite'
  | 'tracking'
  | 'hustle'
  | 'play_types'
  | 'matchups'
  | 'impact'
  | 'raptor'
  | 'darko'
  | 'availability'
  | 'shots'
  | 'plays'
  | 'ratings'
  | 'box_composites'
  | 'indexes'

/** `core` shown by default, `extended` in its family and the column picker, `stored` in queries only. */
export type MetricTier = 'core' | 'extended' | 'stored'

/** Reference section 1: an event counted, arithmetic on them, an approximation, or a fitted model. */
export type MetricKind = 'recorded' | 'derived' | 'estimated' | 'model'

/** Reference section 19.4: `sum` adds over games and can be shown per game; `ratio` is a ratio of sums. */
export type MetricAggregation = 'sum' | 'ratio'

/** Where a metric can be read from: the game tables, or the season tables. */
export type Grain = 'game' | 'season'

/**
 * How a value reads: `pct` is a fraction (0.35 = 35 %), `rating` points per 100 possessions, `pace`
 * possessions per 48 minutes.
 */
export type MetricUnit = 'count' | 'number' | 'pct' | 'minutes' | 'rating' | 'pace'

/**
 * One catalogue entry, with the fields of reference section 19.4. `value` is SQL over component sums:
 * each `{name}` is the sum of that column over the rows in scope. `sample` names the component that
 * measures the sample and qualifies a row. Descriptions are written for a person.
 */
/** Where a metric has real values in one league: its first season, gaps, or why it has none. */
export interface MetricCoverage {
  firstSeason: number
  missingSeasons?: number[]
  unavailable?: string
  /** Caveats of some seasons, which a query over any of them states (`StatsResult.notes`). */
  seasonNotes?: SeasonNote[]
  /** Why `missingSeasons` have no value, where it is not that the source lacks them. */
  missingReason?: string
  /** The league's own words for the metric, where its format differs (the WNBA's semifinals). */
  words?: Partial<Pick<MetricDef, 'label' | 'short' | 'description'>>
}

/** A caveat that holds for some seasons of a metric: a source counting it another way then. */
export interface SeasonNote {
  seasons: number[]
  note: string
}

export interface MetricDef {
  id: string
  label: string
  short: string
  description: string
  family: MetricFamily
  /**
   * Where a reader finds it, by what it measures (D52, `categories.ts`): one sub-group in each
   * category it belongs to, the primary first. Every metric but a stored one has at least one.
   */
  categories?: readonly Placement[]
  entity: Entity
  /**
   * Team metrics: mostly whose columns they are, the team's own (`offense`) or its opponents'
   * (`defense`), which the team tabs offer first; a few of the team's own read `defense` (its
   * defensive rating, defensive rebound percentage, hustle on defense). Not the end of the floor: the
   * team's steals read `offense`. The end is the categories'.
   */
  side?: 'offense' | 'defense'
  kind: MetricKind
  aggregation: MetricAggregation
  value: string
  sample: string
  unit: MetricUnit
  decimals: number
  direction: 'higher' | 'lower' | 'neutral'
  /**
   * The count a row needs to qualify over 82 games, scaled to the team games in scope: of `qualifyBy`
   * when set, else of `sample`.
   */
  minSample?: number
  /**
   * The component `minSample` counts, set on the statistics the NBA publishes leaders in (D33): makes
   * for the shooting percentages (300 field goals), games for the per-game leaders (58). Such a metric
   * qualifies by its own minimum alone: the leaderboard's row qualifier (1,000 minutes) does not gate
   * it. A rate's sample, what shrinking weighs, stays the attempts.
   */
  qualifyBy?: string
  /**
   * A minimum of `qualifyBy` per game played, with the league's games rule beside it, in place of
   * `minSample` scaled to the season: set by a league's `madePerGame` (the colleges, D43), never by
   * the catalogue.
   */
  minPerGame?: number
  /** What a total divides by to be per game, when not `games`: a box score's count, not the record's. */
  perGameBy?: string
  /** Stays a total under per game, per 36 and the rest: wins per game would read as a win rate. */
  totalOnly?: boolean
  /** Scales per game, and no other way: minutes per 36 minutes would read 36. */
  perGameOnly?: boolean
  sources: string[]
  /**
   * The source tables a box-score metric's own columns come from, beyond the box scores every build
   * has: stats.ncaa.org's player and team boxes for the college leagues' splits (D40). With every file
   * of one left out of a build (D41), the metric answers with the reason (`leftOutGap`).
   */
  reads?: string[]
  /**
   * The first season holding real values, by the data's label, in every league that takes the
   * metric's own coverage (`League.metricsByDefault`: the NBA). `leagues` states it for the others.
   */
  firstSeason: number
  /** Seasons after it that the source does not have. */
  missingSeasons?: number[]
  /** Caveats of some seasons, in a league's coverage (`MetricCoverage.seasonNotes`). */
  seasonNotes?: SeasonNote[]
  /** Why the source no longer has this metric at all; every query answers with it. */
  unavailable?: string
  /**
   * The metric's coverage in a league whose registry entry does not take the fields above
   * (`metricsByDefault` false), or `null` where the league does not have it. A league it does not
   * name: the fields above when the league takes them, else not in that league (`coverageIn`).
   */
  leagues?: Partial<Record<LeagueId, MetricCoverage | null>>
  /**
   * The formula and words hold the game's length, written in the catalogue's 48 minutes
   * (`CATALOGUE_GAME_MINUTES`): `48` minutes and `2880` seconds in `value`, `48` in the label, short
   * label and description. A league of another length reads them as its own (`metricIn`): pace per 40
   * in the WNBA. The NBA's formula and SQL are the catalogue's as written.
   */
  gameLength?: boolean
  /**
   * The formula holds the Pythagorean exponent, written as the catalogue's (the NBA's 14,
   * `CATALOGUE_PYTHAGOREAN_EXPONENT`); a league of another exponent reads its own
   * (`League.models.pythagoreanExponent`, `metricIn`).
   */
  pythagorean?: boolean
  /** Why `missingSeasons` have no value, where it is not that the source lacks them. */
  missingReason?: string
  tier: MetricTier
  /**
   * The published table a metric with no game behind it reads, from
   * `src/main/stats/derived/publishedTables.ts`. Its components are that table's columns, so a rate
   * divides by the games and minutes tracked, and it can only answer for whole seasons.
   */
  published?: string
  /**
   * A table at game grain that answers a published metric under a filter that splits a season (a date
   * range, the last games, one team's games), from `src/main/stats/derived/gameTables.ts`. Its columns
   * are named as the published table's, so the same formula reads either.
   */
  publishedGames?: string
  /**
   * A table built from the plays at game grain that holds this metric's counts, from
   * `src/main/stats/derived/gameTables.ts`: the shots by zone, the on-court lines. It answers at both grains, joined to the
   * box-score rows in scope, so a season, a team, a date range or any game filter reads exactly; what
   * it does not hold (games, minutes) comes from the box scores.
   */
  built?: string
  /**
   * A published value that is one regular season's state, not a total or a rate: a projection. It
   * answers for one regular season at a time, since an average of several would mean nothing.
   */
  oneSeason?: boolean
  /**
   * A table the models compute (Plan Stage 10), from `src/main/stats/models/build.ts`. Its kind says
   * how it reads: a `sum` table is added over the rows in scope like a box score; a `state` table
   * (a rating) holds the value after each game and reads the one at the last game in scope. What it
   * does not hold (games, minutes) comes from the box scores. `docs/reference/stats-database.md`,
   * "Models".
   */
  model?: string
  /**
   * A league index (Plan T1006): the id of the rate this entry indexes. Its `value` and `sample` are
   * that rate's; the engine reads it as 100 × the rate over the league's rate in the same scope, the
   * league's sums over the same games divided when read, so 100 is the league. A rate where lower is
   * better is mirrored, 100 × (2 − rate / league), so above 100 is still better.
   */
  index?: string
  /**
   * How an entry with `index` is read against the league (T1703.3); absent, as a share of it (100 is
   * the league). `difference`: the rate less the league's rate (`value` is the rate's). `added`: what
   * `value` counts beyond what its `weight` would bring at the league's rate, `value − weight × league`,
   * the league's rate being its own `value` over its own `weight` (points above a league-average
   * shooter: points less 2 × attempts × the league's true shooting).
   */
  relative?: 'difference' | 'added'
  /** The formula an `added` value is over, in the same components (`relative`). */
  weight?: string
  /**
   * The components of a published metric's formula that its published table does not hold and the box
   * scores do (a published numerator over the box score's points). Read from the rows in scope.
   */
  box?: readonly string[]
}

/**
 * How much a metric carries over (Plan T1006), measured on the regular seasons through the last one
 * completed. `null` figures are not measured; `reason` says why when nothing is.
 */
export interface MetricStability {
  /** Pearson r between a player's (or team's) qualified consecutive seasons, pooled across positions. */
  yearToYear: number | null
  pairs: number
  /** r between the odd and the even games of a qualified season, corrected to a season (Spearman-Brown). */
  splitHalf: number | null
  halfPairs: number
  /** The sample at which a rate is half signal, in its own sample unit: what `shrunk` gives the league. */
  prior: number | null
  /** From the year-to-year r: high at 0.6, medium at 0.35, low below; null when not measured. */
  reliability: 'high' | 'medium' | 'low' | null
  /** The seasons measured, by final year. */
  firstSeason: number | null
  lastSeason: number | null
  /** Why nothing was measured: "Fewer than 50 pairs of qualified seasons." */
  reason: string | null
}

/** A catalogue entry as the engine serves it: the formula left out, where it can be read added. */
export interface MetricInfo extends Omit<MetricDef, 'value' | 'sample'> {
  grains: Grain[]
  /** What the sample counts, in words: "field-goal attempts". */
  sampleLabel: string
  /** What `minSample` counts, in words: "field goals made" where it is not the sample. */
  qualifyLabel: string
  /** Null before the models have measured it. */
  stability: MetricStability | null
}

export type GroupBy = 'season' | 'team' | 'opponent' | 'month' | 'game'

/**
 * Totals, or a sum per game, 36, 40 or 48 minutes or 100 possessions; `percentile`, `zScore` and
 * `vsLeague` read a value against its pool. A ratio is the same in the first six. A league offers the
 * per-minute modes its registry entry lists (`League.perMinute`): per 40 is a 40-minute league's.
 */
export type Transform =
  'raw' | 'perGame' | 'per36' | 'per40' | 'per48' | 'per100' | 'percentile' | 'zScore' | 'vsLeague'

/** Every leaderboard, card, chart and comparison is one of these. */
export interface StatsQuery {
  entity: Entity
  /** Catalogue ids, at most 40. */
  metrics: string[]
  scope: {
    seasons: number[]
    /** Default: the regular season. */
    gameTypes?: GameType[]
    /** YYYY-MM-DD, both inclusive. */
    dates?: [string, string]
    lastN?: number
    /** Players: their own last N appearances (default), or their team's last N games. */
    lastNOf?: 'appearances' | 'team'
    positions?: PositionGroup[]
    /** NBA team ids. */
    teams?: string[]
    opponents?: string[]
    /** The opponent's: `east`, `west`. */
    conferences?: string[]
    /** The opponent's: `atlantic`, `pacific`. */
    divisions?: string[]
    /** 1 to 12. */
    months?: number[]
    /** Home games (true) or road games (false). */
    home?: boolean
    /** Before or after the All-Star Game. */
    allStarBreak?: 'before' | 'after'
    /** Full days off since the team's last game: 0 is a back-to-back. */
    restDays?: [number, number]
    /** Players: games they started (true) or came off the bench (false). */
    starter?: boolean
    result?: 'win' | 'loss'
    /** Player ids. */
    players?: string[]
    /** Game ids: one box score, or the games a screen names. */
    games?: string[]
    /**
     * A split of each game counted from the play by play (`src/shared/stats/splits.ts`): a quarter,
     * clutch, the score, the last minutes, garbage time. Only the moments in it count.
     */
    split?: string
    qualifiedOnly?: boolean
  }
  groupBy?: GroupBy[]
  transform?: Transform
  /**
   * Each rate with a measured prior pulled toward the league's rate in the same scope by it:
   * (sample × value + prior × league) / (sample + prior). The raw value stays in `raw`; counts and rates
   * with no prior read unchanged, and the notes name them. Every row with a sample ranks. Not with
   * `percentile`, `zScore` or `vsLeague`.
   */
  shrunk?: boolean
  /** Default: the first metric, best first. */
  sort?: { metric: string; dir: 'asc' | 'desc' }
  /** Default 100, at most 5000. */
  limit?: number
  /**
   * Only these rows, by id, each with its place in the whole ordered answer (`StatsRow.place`), past
   * any limit: what a leaderboard filtered to some rows shows as their rank (T1601.3). `standing` is
   * the metric a row must qualify for to be counted among the standing rows (the sort's own minimum,
   * or the tab's qualifier), null to count every row; `orSample` counts a row with a sample of the
   * sorted metric too (a count of games out). One row a player or team: not with `groupBy`.
   */
  places?: { ids: string[]; standing: string | null; orSample?: boolean }
  /**
   * False leaves out each value's percentile and rank (null), for a screen that shows neither: they
   * are two window functions a metric, about half of a small query's time. Not with `percentile`.
   */
  ranks?: boolean
  /**
   * Conditions every listed row must meet, all of them (D51): each on an attribute of who the player
   * or team is (`src/shared/stats/attributes.ts`) or on a catalogue metric. Applied after the rows are
   * aggregated and ranked, so a row keeps its league percentile and rank, the answer lists 1 to n of
   * those left, `total` counts them and `limit` applies after. A row with no value for a condition's
   * attribute or metric is left out and counted (`StatsResult.filtered`). At most 20.
   */
  filters?: StatsFilter[]
  /**
   * A metric of the query whose qualification every other metric's rank pool requires: a leaderboard
   * tab's qualifier (`min`). A row then counts in a metric's percentile and rank only when it also
   * qualifies on this one, unless the metric qualifies by its own minimum alone (D33) or is shrunk:
   * the rule a board applies on the client when it holds every row (`rankWithinTab`), asked of the
   * engine where it does not (the college boards, 5,000 players against a fetch of 1,000). Absent:
   * each metric ranks among its own qualified rows, as before.
   */
  rankAmong?: string
  /**
   * With `rankAmong`: each ranked value also says how many rows it is ranked among
   * (`MetricValue.pool`), for a page's "among 1,838 qualified guards". Asked only where a screen
   * shows the count: it costs a window per metric.
   */
  poolSizes?: boolean
}

/**
 * How a filter compares: `between`, `atLeast` and `atMost` for numbers and dates (both ends
 * included); `anyOf` and `noneOf` for enumerations and text (letter case ignored); `contains` for text
 * (letter case ignored); `is` and `isNot` for a flag (true or false); `hasValue` and `hasNone` for any.
 */
export type FilterOp =
  | 'between'
  | 'atLeast'
  | 'atMost'
  | 'anyOf'
  | 'noneOf'
  | 'contains'
  | 'is'
  | 'isNot'
  | 'hasValue'
  | 'hasNone'

/**
 * One condition of `StatsQuery.filters`, on an attribute or on a metric (exactly one of the two). A
 * metric's value is compared as the query's transform shows it (`MetricValue.value`): per game under
 * `perGame`, a percentile under `percentile`, a percentage as a fraction (0.4 is 40 %). A metric the
 * query does not list is computed for the condition and not shown.
 */
export interface StatsFilter {
  attribute?: string
  metric?: string
  op: FilterOp
  /**
   * `between`: [min, max]; `atLeast`, `atMost`: one bound. A date is YYYY-MM-DD. `anyOf`, `noneOf`: a
   * list of texts; `contains`: a text. None for `is`, `isNot`, `hasValue` and `hasNone`.
   */
  value?: number | string | [number, number] | [string, string] | string[]
}

/** A value an attribute holds in scope, and how many rows hold it (T1701.2). */
export interface StatsAttributeValue {
  value: string
  rows: number
}

export interface MetricValue {
  /** After the transform. */
  value: number | null
  raw: number | null
  sample: number | null
  qualified: boolean
  /** 0–100 among the qualified rows of the same position (players) and group; null otherwise. */
  percentile: number | null
  rank: number | null
  /**
   * With `StatsQuery.poolSizes`: how many rows the percentile and rank are among (the metric's pool
   * of the row's position and group); null when the row is not ranked. Absent otherwise.
   */
  pool?: number | null
}

export interface StatsRow {
  /** Player id or NBA team id. */
  id: string
  name: string
  /** The team's code: a traded player's latest in scope. */
  team: string | null
  position: string | null
  /** The `groupBy` values. */
  group: Partial<Record<GroupBy, string | number | null>>
  games: number
  values: Record<string, MetricValue>
  /**
   * The player has no box-score line in scope: a table that adds rows listed them (games out of a
   * whole season or playoff run). Their box-score stats are null and they never qualify.
   */
  noLine?: true
  /**
   * With `StatsQuery.places`: the row's place in the whole ordered answer (1 the first), and among the
   * standing rows (null when the row itself does not stand).
   */
  place?: { all: number; standing: number | null }
}

export interface StatsResultColumn {
  id: string
  label: string
  short: string
  unit: MetricUnit
  decimals: number
  direction: MetricDef['direction']
  /** The seasons in scope this metric has data for. */
  seasons: number[]
  /** Why it has none, when it has none: "Recorded from 1996-97." */
  reason: string | null
  /** Its values are shrunk toward the league (`StatsQuery.shrunk`). */
  shrunk?: boolean
  /**
   * It qualifies by its own minimum alone, the NBA's (`MetricDef.qualifyBy`): a screen ranks and keeps
   * its rows by its own `qualified` flag, not by the row qualifier.
   */
  ownQualifier?: boolean
  /**
   * Its table added rows for players with no box-score line (games out of a whole season): sorted by
   * it, a screen lists every row with a sample, since a count of games out has no minimum to reach.
   */
  addsRows?: boolean
}

export interface StatsResult {
  grain: Grain
  columns: StatsResultColumn[]
  rows: StatsRow[]
  /** Rows before `limit`. */
  total: number
  /** Caveats a screen should state: coverage, estimates. */
  notes: string[]
  /**
   * With `StatsQuery.filters`: the rows left out for having no value of a filtered attribute or
   * metric (never guessed, policy 4), among the rows the board would list; and why no row can answer,
   * when a condition is on an attribute or metric the league or the scope does not cover (no rows are
   * read then).
   */
  filtered?: { noValue: number; reason: string | null }
  ms: number
}

/** A team in a season, for the team filters. */
export interface StatsTeam {
  id: string
  code: string
  name: string
  conference: string | null
  division: string | null
}

/** What a season holds, for the scope bar. */
export interface StatsSeason {
  /** Final year: 2026 is 2025-26. */
  season: number
  /** YYYY-MM-DD: its first and last games with a box score. */
  firstDate: string
  lastDate: string
  /** The game types with box scores, and how many games. */
  types: { type: GameType; games: number }[]
  teams: StatsTeam[]
}

/** One team's side of a game. A side not named yet has no id, and a game not played no score. */
export interface GameSide {
  id: string | null
  code: string
  name: string
  score: number | null
}

/** A game on the schedule, played or not. */
export interface StatsGame {
  id: string
  season: number
  type: GameType
  /** YYYY-MM-DD. */
  date: string
  home: GameSide
  away: GameSide
  played: boolean
  /** A box score is held. Preseason games have none anywhere, and a few old games only a score. */
  hasBox: boolean
  /** Overtime periods, from the team's minutes; null without a box score. */
  overtimes: number | null
}

/** What ESPN's schedule adds about one game. */
export interface StatsGameDetail {
  id: string
  venue: string | null
  city: string | null
  attendance: number | null
  /** "NBA Finals - Game 5". */
  note: string | null
  /** Points by period, when the source has them and they add up to the final score. */
  periods: { home: number[]; away: number[] } | null
  /** The crew, from the NBA's officials file; empty when the file has no row for the game. */
  officials: StatsOfficial[]
  /** Elo before and after the game (Plan T1002); null for a game it does not rate or a burn-in season. */
  elo: StatsGameElo | null
}

/** A game's Elo (Plan T1002): played, or still to come with the latest ratings. */
export interface StatsGameElo {
  /** No home court: a game abroad, a Cup semifinal or final, the 2020 bubble. */
  neutral: boolean
  /** The home court applied, in Elo points. */
  homeCourt: number
  /** The home side's win probability and expected margin before the game. */
  homeWin: number
  homeMargin: number
  /** Before the game, and after it (null for a game not played). */
  home: { pre: number; post: number | null }
  away: { pre: number; post: number | null }
}

/** An official of a game, as the NBA's file names them. */
export interface StatsOfficial {
  id: string
  name: string
}

/**
 * A player's listing for one game on the official injury report (T1601.4): the status and reason of
 * the last report before the game, as published. What the report said, never whether they played.
 */
export interface StatsGameListing {
  gameId: string
  playerId: string
  /** "Out", "Doubtful", "Questionable", "Probable", "Available". */
  status: string
  /** "Injury/Illness - Low Back Tightness"; null when none is given. */
  reason: string | null
}

/**
 * A player's status on the latest official injury report of the current season, as published: not a
 * forecast of whether they play.
 */
export interface StatsAvailability {
  playerId: string
  /** `Out`, `Doubtful`, `Questionable`, `Probable` or `Available`. */
  status: string
  /** As the report words it ("Injury/Illness - Left Ankle; Sprain"); null when none is given. */
  reason: string | null
  /** Whether the reason is an injury or an illness rather than a G League assignment, rest and the like. */
  injury: boolean
  /** The report's date, YYYY-MM-DD. */
  reportDate: string
  /** The date of the game the report is for. */
  gameDate: string | null
  gameId: string | null
}

/**
 * How often a rating series has a point (Plan T1704): a snapshot when an import brings one (DARKO's
 * files, D55), a week (SportsDataverse's expected impact), or a game (Metis's own estimate, T1703.4).
 */
export type RatingGrain = 'snapshot' | 'weekly' | 'game'

/** One point of a rating series: the rating as its maker gave it on a date. */
export interface RatingPoint {
  /** The day the rating is as of, YYYY-MM-DD: from the games before it, where the maker says so. */
  date: string
  /** The season it belongs to, by final year (2026 = 2025-26). */
  season: number
  /** In the series' unit; null where the source has none that day. */
  total: number | null
  offense: number | null
  defense: number | null
  /** What the point was computed from, where the source says: possessions played to that date. */
  possessions: number | null
  /** The last game before the point, YYYY-MM-DD, where the source says. */
  lastGame: string | null
}

/** One maker's rating of one player over time, every point the file holds, oldest first. */
export interface RatingSeries {
  /** Stable across releases: `sdv_expected_impact`, `darko_dpm`, `metis_estimate`. */
  id: string
  /** As a screen names it: "Expected impact (SportsDataverse)". */
  label: string
  /** Whose rating it is, always named: "SportsDataverse", "Kostya Medvedovsky (DARKO)". */
  maker: string
  unit: MetricUnit
  grain: RatingGrain
  points: RatingPoint[]
  /** What the series covers and what it lacks, each a sentence ("Weekly from 2006-07 to 2025-26."). */
  notes: string[]
}

/**
 * A player's ratings over time, for the chart on the player page (Plan T1704): every series the file
 * holds for them, each named with its maker. An empty list says why (`reason`), never an error.
 */
export interface RatingHistory {
  playerId: string
  series: RatingSeries[]
  /** Why there is no series, or none of a kind: "Built at this league's next refresh." */
  reason: string | null
}

/** A count of a player's box-score line, as the game table names it. */
export type GameCount =
  | 'seconds'
  | 'fgm'
  | 'fga'
  | 'fg3m'
  | 'fg3a'
  | 'ftm'
  | 'fta'
  | 'oreb'
  | 'dreb'
  | 'reb'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'tov'
  | 'pf'
  | 'pts'
  | 'plus_minus'

/** One game a player has a line in, for their highs, streaks and threshold games (T1703.3). */
export interface StatsPlayerGame {
  gameId: string
  /** YYYY-MM-DD. */
  date: string
  season: number
  gameType: GameType
  /** The team's code that season, and the opponent's; null for a team the season's list lacks. */
  team: string | null
  opponentId: string | null
  opponent: string | null
  home: boolean | null
  won: boolean | null
  /** The line's counts, in the order of `GAME_COUNTS`; null where the line lacks one. */
  counts: (number | null)[]
}

/** Every game a player has a line in, oldest first. */
export interface StatsPlayerGames {
  playerId: string
  games: StatsPlayerGame[]
  /** The year they were drafted, where the draft lists them; null for an undrafted player or a file without the tables. */
  draftYear: number | null
  /** Why there is none, where the file cannot say: "Built at this league's next refresh." */
  reason: string | null
}

/** One member of a team's staff for a season, from the NBA's coach file. */
export interface StatsCoach {
  id: string
  name: string
  /** As the file words it: "Head Coach", "Assistant Coach". */
  title: string
  role: 'head' | 'assistant'
}

/**
 * A player with a page in the league, for the player search (T1304.5): everyone with a game in any
 * season, with the last season they played and their last team that season.
 */
export interface StatsIndexedPlayer {
  id: string
  name: string
  lastSeason: number
  /** The team's code, as the rail writes it; null where the season's team table lacks it. */
  team: string | null
}

/** Who a player is, for the dashboard's header. The roster fields are null before 1996-97. */
export interface StatsPlayerInfo {
  id: string
  name: string
  /** `G`, `F` or `C`, from their latest season. */
  position: string | null
  /** Their latest team. */
  team: { id: string; code: string | null } | null
  /** Seasons with a game that counts, by final year, oldest first. */
  seasons: number[]
  number: string | null
  /** As the NBA publishes them: "6-9", "250", "DEC 30, 1984". */
  height: string | null
  weight: string | null
  birthDate: string | null
  school: string | null
}

/** The NBA's roster line for a player, from the latest season that lists them; text as published. */
export interface StatsBio {
  season: number
  team: { id: string; code: string | null } | null
  number: string | null
  /** The roster's own label: `G`, `F-C`. */
  position: string | null
  height: string | null
  weight: string | null
  birthDate: string | null
  /** At the roster's date, as published. */
  age: number | null
  /** Seasons credited, `R` for a rookie. */
  experience: string | null
  school: string | null
  howAcquired: string | null
}

export interface StatsDraft {
  /** The draft's year: the file's label less one. */
  year: number
  round: number | null
  roundPick: number | null
  overallPick: number | null
  team: { id: string; code: string | null; name: string | null } | null
  /** Where they were drafted from, and what kind of place it is. */
  organization: string | null
  organizationType: string | null
}

export interface StatsCombineValue {
  /** Shooting reads made over attempted; null when not measured. */
  value: number | null
  made: number | null
  attempts: number | null
  /** 0–100 among the same position group at every combine, the better side higher. */
  percentile: number | null
  /** 1 for the best; null for a measurement with no better side. */
  rank: number | null
  /** How many players of the group have the measure. */
  pool: number
  /** Whether anyone has a result at this combine: if not, the test was not held. */
  held: boolean
}

export interface StatsCombine {
  /** The combine's year. */
  year: number
  /** As listed at the combine: `PG-SG`. */
  position: string | null
  group: PositionGroup | null
  /** By `COMBINE_MEASURES` id. */
  values: Record<string, StatsCombineValue>
}

export interface StatsProfile {
  bio: StatsBio | null
  draft: StatsDraft | null
  /** The years the draft files hold, so a player outside them is not called undrafted. */
  draftYears: { first: number; last: number } | null
  /** Newest first: a few players went to more than one. */
  combines: StatsCombine[]
  combineYears: { first: number; last: number } | null
}

/** A team's line in the published standings: a season's end, or today in the current one. */
export interface StatsStanding {
  teamId: string
  code: string | null
  name: string
  /** As published: `East`, `Pacific`. */
  conference: string | null
  division: string | null
  conferenceRank: number | null
  divisionRank: number | null
  wins: number
  losses: number
  winPct: number | null
  conferenceGamesBack: number | null
  divisionGamesBack: number | null
  home: string | null
  road: string | null
  conferenceRecord: string | null
  divisionRecord: string | null
  /** "8-2", from 2001-02. */
  last10: string | null
  /** "W 3", from 2001-02. */
  streak: string | null
  pointsPerGame: number | null
  allowedPerGame: number | null
  differential: number | null
}

/**
 * One pair of a player's season matchups: the other player, and what the offensive player did while
 * that defender was assigned to them. Regular season only, as published.
 */
export interface StatsMatchupPair {
  /** The other player: the one guarded, or the one guarding. */
  id: string
  name: string
  games: number | null
  minutes: number | null
  partialPoss: number | null
  pts: number | null
  fgm: number | null
  fga: number | null
  fg3m: number | null
  fg3a: number | null
  ftm: number | null
  fta: number | null
  ast: number | null
  tov: number | null
  blk: number | null
}

/** A player's matchups, each list longest first. */
export interface StatsMatchups {
  /** The players they guarded. */
  guarded: StatsMatchupPair[]
  /** The players who guarded them. */
  guardedBy: StatsMatchupPair[]
  /**
   * Where the pairs come from: the NBA's season pair file for a whole regular season, else the game
   * matchups added up over the player's games in scope. A pair's games are counted either way.
   */
  source: 'season' | 'games'
}

/**
 * The games a player's matchup pairs cover, when not a whole regular season: the season types, and a
 * date range or the last games, as the scope bar sets them.
 */
export interface StatsMatchupScope {
  gameTypes: GameType[]
  dates?: [string, string]
  lastN?: number
  lastNOf?: 'appearances' | 'team'
}

/** One pair of a game's matchups: what the player on offense did while that defender was assigned. */
export interface StatsGameMatchup {
  offId: string
  offName: string
  offTeamId: string | null
  /** The position the NBA's file lists for the player on offense in this game. */
  offPosition: string | null
  defId: string
  defName: string
  defTeamId: string | null
  minutes: number | null
  partialPoss: number | null
  pts: number | null
  fgm: number | null
  fga: number | null
  fg3m: number | null
  fg3a: number | null
  ftm: number | null
  fta: number | null
  ast: number | null
  tov: number | null
  blk: number | null
  sfl: number | null
}

/** Who guarded whom in a game, longest first, or why there is nothing to show. */
export interface StatsGameMatchups {
  pairs: StatsGameMatchup[]
  /** "Tracked from 2017-18." before the game matchups start; null when the pairs answer. */
  reason: string | null
}

/**
 * Box-score totals over a group of games, both teams', kept as parts so any rate is divided on read:
 * fouls, free-throw attempts and points by the home and the away side, and the home side's wins.
 */
export interface StatsOfficiatingTotals {
  games: number
  homeFouls: number
  awayFouls: number
  homeFta: number
  awayFta: number
  homePts: number
  awayPts: number
  homeWins: number
}

/** How many of a season's games the officials file has a crew for, and the crews' sizes. */
export interface StatsCrewCoverage {
  /** Games played in scope. */
  games: number
  withCrew: number
  /** Games by the number of officials listed: `{ 3: 1225, 4: 2 }`. */
  crewSizes: Record<string, number>
}

/** An official's games in a season, as the NBA's officials file and the box scores give them. */
export interface StatsOfficialLine {
  id: string
  name: string
  /** As published, without the file's padding. */
  jersey: string | null
  totals: StatsOfficiatingTotals
}

/**
 * Every official of a season and season types, with the league's totals over the same games. Before
 * the crews are complete the officials are still listed, but `reason` says why the rates are not read.
 */
export interface StatsOfficialsSeason {
  season: number
  coverage: StatsCrewCoverage
  league: StatsOfficiatingTotals
  officials: StatsOfficialLine[]
  /** Why rates are not read for this season; null when they are. */
  reason: string | null
}

/** One official's seasons, each beside the league's totals for the same season and season types. */
export interface StatsOfficialCareer {
  id: string
  name: string
  jersey: string | null
  seasons: {
    season: number
    totals: StatsOfficiatingTotals
    league: StatsOfficiatingTotals
    coverage: StatsCrewCoverage
    reason: string | null
  }[]
}

/**
 * One unit of two to five players of a team's season, as the NBA publishes it. `values` holds the columns of the
 * group asked for (`shared/stats/lineups.ts`) and the possessions; a measure the NBA's file for it
 * does not list for this unit is null.
 */
export interface StatsLineupUnit {
  /** The unit's players, by id. */
  players: { id: string; name: string }[]
  games: number | null
  minutes: number | null
  values: Record<string, number | null>
}

/** A team's published units for a season and season type, most minutes first. */
export interface StatsLineups {
  units: StatsLineupUnit[]
  /**
   * The fewest minutes among the units of this size the NBA's base file lists for the season,
   * league-wide, when the file reached its 2,000 units; null when it lists them all.
   */
  floorMinutes: number | null
  /** The sizes held for the team's season, largest first: five alone before the smaller groups. */
  sizes: number[]
}

/** The totals modes a table offers; a ratio reads the same in each. */
export type BoardMode = 'raw' | 'perGame' | 'per36' | 'per40' | 'per48' | 'per100'

/** A leaderboard's own settings: what a saved view keeps. */
export interface LeaderboardBoard {
  entity: Entity
  /** A position group or `ALL` for players; `offense` or `defense` for teams. */
  tab: string
  /** Catalogue ids, in display order. */
  columns: string[]
  /** A column id, or `name`. */
  sort: { by: string; dir: 'asc' | 'desc' }
  mode: BoardMode
  qualifiedOnly: boolean
  /** Rates shrunk toward the league by their priors (Plan T1006); absent in views saved before it. */
  shrunk?: boolean
  /** An NBA team id; null for every team. */
  team: string | null
  /**
   * A split within each game counted from the play by play (`src/shared/stats/splits.ts`), such as
   * clutch; null or absent for the whole game. Optional, so views saved before it still open.
   */
  split?: string | null
  /**
   * Only the league's favourites (T1601.3), each at its rank on the whole board. Saved with a view as
   * the flag, never the ids; absent in views saved before it, which open with it off.
   */
  favourites?: boolean
  /**
   * The category tab (D52, `categories.ts`); absent or empty for Overview, the tab's own columns, as
   * every view saved before categories opens.
   */
  category?: string
  /**
   * The preset of the category shown (`categoryViews`): a placement, an umbrella's heading or `key`.
   * The columns are still the board's own, so a view keeps what the user changed.
   */
  view?: string
  /**
   * Conditions on attributes and metrics (T1701.2, D51), as the engine reads them: a percentage as a
   * fraction, a metric compared in the board's mode. One not yet finished is kept and not asked for.
   * Absent in views saved before them, which open with none.
   */
  filters?: StatsFilter[]
}

/** A saved view: a named leaderboard, kept in `metis.db`. */
export interface StatsView {
  id: number
  name: string
  board: LeaderboardBoard
  updatedAt: string
}

/** The status line of the nav: what the stats database holds and whether it is being updated. */
export interface StatsStatus {
  /** The stats worker runs (DuckDB loaded). */
  available: boolean
  /** The latest game with stats; null before the first load. `date` is YYYY-MM-DD. */
  through: { season: number; date: string } | null
  /** The last step that wrote rows, ISO time. */
  updatedAt: string | null
  /** When the game and season tables were last built, ISO time; null until they are. */
  builtAt: string | null
  /** A refresh is running. */
  busy: boolean
  /** How far it has got, in files; null when none is running. */
  progress: { done: number; total: number } | null
  /** The owner paused loading; nothing downloads until they resume. */
  paused: boolean
  /** The first load did not start: too little disk space. */
  noRoom: { neededBytes: number; freeBytes: number } | null
  /** The league has no data yet (`League.hasData` false), and why; absent for one that has. */
  noData?: string
}

/** `left-out`: a release this build does not load (`src/main/stats/leftOut.ts`). */
export type StatsFamilyState = 'loaded' | 'partial' | 'waiting' | 'failed' | 'left-out'

/** One release of the dataset, as the Data panel shows it. */
export interface StatsFamily {
  release: string
  label: string
  tier: 'core' | 'published' | 'events' | 'plays'
  state: StatsFamilyState
  filesLoaded: number
  /** Files published so far: the current season's playoffs do not count before they are played. */
  filesExpected: number
  /** Seasons held, by final year; null for a family of files holding all seasons. */
  firstSeason: number | null
  lastSeason: number | null
  /** As downloaded. */
  bytes: number
  rows: number
  /** The latest file's fetch, ISO time. */
  fetchedAt: string | null
  /** The latest error still standing; a file that has since loaded clears it. */
  lastError: string | null
  /**
   * The league whose seasons the files hold, when not the panel's own: the paired league's files a
   * league brings (D48). Absent: the panel's league.
   */
  seasonsOf?: LeagueId
}

/** How a player's college and professional careers were linked (D46). */
export type StatsLinkMethod = 'id' | 'name+birth' | 'name+college'

/** A professional draft line, as the league's draft table gives it. */
export interface StatsDraftLine {
  league: LeagueId
  /** The draft's year: the class of 2024 was drafted after the 2023-24 college season. */
  draftYear: number
  round: number | null
  roundPick: number | null
  overallPick: number | null
  team: string | null
  /** The school or club the league names. */
  organization: string | null
  organizationType: string | null
}

/** One season of the other career: Metis's own line of a season type, or ESPN's season totals. */
export interface StatsOtherSeason {
  season: number
  /** Metis's own lines: the season type. ESPN's totals: null, the source's label says what they count. */
  gameType: GameType | null
  /** The teams of the season: in the order played where `teamsInOrder`, else sorted by name. */
  teams: string[]
  /**
   * Whether `teams` is in the order played, its last the team the season ended with. Metis's own lines
   * always are. ESPN's totals name one team a player-season, the last (every traded linked season
   * checked, 68 of 68, `player-links.md`); should they name several, the file does not say in what
   * order, and this is false. They can also name none (traded WNBA seasons of 2025 and 2026).
   */
  teamsInOrder: boolean
  games: number | null
  starts: number | null
  minutes: number | null
  pts: number | null
  reb: number | null
  oreb: number | null
  ast: number | null
  stl: number | null
  blk: number | null
  tov: number | null
  pf: number | null
  fgm: number | null
  fga: number | null
  fg3m: number | null
  fg3a: number | null
  ftm: number | null
  fta: number | null
}

/**
 * A player's career in the other league of their pair (T1304): the link and its method, the draft
 * line, the season rows with their source named, or the reason there is none.
 */
export interface StatsOtherCareer {
  /** The other league of the pair; null when the league is in no pair. */
  league: LeagueId | null
  link: {
    method: StatsLinkMethod
    /** The player's id in the other league; null where only ESPN's lines name them. */
    playerId: string | null
    espnId: number | null
    name: string
  } | null
  draft: StatsDraftLine | null
  /**
   * Where the rows come from: Metis's own lines, kept in the links file, or ESPN's season totals of the
   * paired download, which count the regular season in a professional league and every game in a
   * college one (`player-links.md`).
   */
  source: { kind: 'metis' | 'espn'; label: string } | null
  seasons: StatsOtherSeason[]
  /** Why there is no other career; null when there is a link. */
  reason: {
    kind: 'no-pair' | 'no-link' | 'drafted-abroad' | 'college-before-window'
    text: string
  } | null
}

/**
 * A linked player of the paired league who has no page in the league on screen (T1304.4): a draftee
 * who never played in the professional league, found by its player search and shown as the other
 * league's, never ranked among the league's own.
 */
export interface StatsOtherPlayer {
  /** Their league: the other of the pair. */
  league: LeagueId
  /** Their id in that league; null where only ESPN's lines name them. */
  playerId: string | null
  name: string
  /** Their last season in that league and its team, where a source names them. */
  lastSeason: number | null
  team: string | null
}

/**
 * One file of a source the owner imports by hand (D55), as the Data panel lists it: the date it was
 * taken as and where that date came from, so a misnamed file shows, and a refused one says why.
 */
export interface StatsImportedFile {
  file: string
  /** The snapshot's date, YYYY-MM-DD; a file of many dates gives its first and last. */
  date: string | null
  lastDate: string | null
  /** A date column in the file, a YYYY-MM-DD in its name, or its modified time. */
  dateFrom: 'column' | 'name' | 'modified' | null
  /** How many dates the file holds: one for a board, many for a history. */
  dates: number
  rows: number
  /** `same`: the same bytes as a file already imported, counted once. */
  status: 'imported' | 'same' | 'refused'
  reason: string | null
  /** When it was read, ISO time. */
  importedAt: string
}

/** A private source, listed only on the copy whose setting names it (D55). */
export interface StatsPrivateImport {
  label: string
  /** The folder the setting names, as the owner wrote it. */
  folder: string
  files: StatsImportedFile[]
}

/** What the Data panel shows. */
export interface StatsDataReport {
  families: StatsFamily[]
  databaseBytes: number
  /** Null when the system will not say. */
  freeBytes: number | null
  /** DARKO imported by hand, only where the private setting is on (D55). */
  privateImport?: StatsPrivateImport
}

/** The games an on-court read covers: the season types, and a date range or the team's last games. */
export interface StatsOnCourtScope {
  gameTypes: GameType[]
  dates?: [string, string]
  lastN?: number
}

/**
 * What a team did while a group was on the floor, counted from the plays: `secs` on the floor, the
 * games with any, and each count for the team (`pts`) and against it (`opp_pts`), possessions among
 * them. Rates are divided by the screen.
 */
export type StatsOnCourtLine = { games: number; secs: number } & Record<string, number>

/** A group of two to five players and what the team did with them on the floor together. */
export interface StatsOnCourtUnit {
  players: { id: string; name: string }[]
  line: StatsOnCourtLine
}

/** A team's groups of one size, most minutes first, or why a season has none. */
export interface StatsOnCourtUnits {
  units: StatsOnCourtUnit[]
  reason: string | null
}

/**
 * A player's team with a teammate on and off the floor, in the games both played for it: both on, the
 * player alone, the teammate alone, neither. A split with no minutes is null.
 */
export interface StatsWithOrWithout {
  teamId: string | null
  teammate: string | null
  /** The player's teammates in scope, most minutes on the floor together first. */
  teammates: { id: string; name: string; minutes: number }[]
  splits: {
    both: StatsOnCourtLine | null
    playerOnly: StatsOnCourtLine | null
    teammateOnly: StatsOnCourtLine | null
    neither: StatsOnCourtLine | null
  } | null
  reason: string | null
}

/**
 * What a shot chart reads: a player's shots, a team's, or the shots taken against a team, over the
 * seasons and the games of a scope (season types, then a date range or the last games).
 */
export interface StatsShotRequest {
  entity: Entity
  id: string
  seasons: number[]
  scope: StatsMatchupScope
  /** A team's own shots (offense) or its opponents' against it (defense). Players: offense. */
  side?: 'offense' | 'defense'
}

/** One shot as the chart draws it, in the NBA's frame: tenths of a foot from the basket. */
export interface StatsShot {
  x: number
  y: number
  made: boolean
  /** 2 or 3, as published. */
  value: number | null
  zone: string
}

/** A zone's counts over every shot in scope, and what the league's rate there would give them. */
export interface StatsShotZone {
  zone: string
  fga: number
  fgm: number
  /** Makes the league's regular-season rate in this zone would give these attempts; null before a rate. */
  expected: number | null
}

/** The shots of a scope, newest first and capped, with every shot counted by zone. */
export interface StatsShotChart {
  /** Shots in scope the league's file gives no location: counted in the total, not drawn or zoned. */
  unlocated?: number
  shots: StatsShot[]
  /** Every attempt in scope, drawn or not. */
  total: number
  made: number
  /** More shots than a chart draws: the newest are drawn, and every one is counted in the zones. */
  capped: boolean
  zones: StatsShotZone[]
  /** Why there is nothing to chart ("Recorded from 1996-97."); null when there is. */
  reason: string | null
}

/** Who assisted whom (Plan T905): a team's passers and scorers, or a player's, over a scope. */
export type StatsAssistRequest = StatsShotRequest

/** One passer and scorer pair: the makes one assisted for the other, its threes and its points. */
export interface StatsAssistPair {
  passer: string
  passerName: string
  scorer: string
  scorerName: string
  makes: number
  threes: number
  points: number
}

export interface StatsAssistNetwork {
  /** Most makes first. A player's holds the pairs where they passed or scored. */
  pairs: StatsAssistPair[]
  /** The assists in scope, every pair counted. */
  total: number
  reason: string | null
}

/** A scoring play on a game's flow chart. */
export interface StatsFlowPoint {
  /** Seconds since the tip-off. */
  t: number
  period: number
  /** Seconds left in the period. */
  clock: number
  home: boolean
  pts: number
  fg: boolean
  homeScore: number
  awayScore: number
}

/** One game's scoring, in order, with its flow worked out by `flowSummary`. */
export interface StatsGameFlow {
  points: StatsFlowPoint[]
  /** The last period played, for the chart's axis. */
  periods: number
  /** The game's season, whose format the clock is read in (halves or quarters); null with no game. */
  season?: number | null
  homeTeam: string
  awayTeam: string
  summary: FlowSummary | null
  reason: string | null
}

/** One league's download, as the main process reads it (`leagueDownloads`). */
export interface LeagueDownload {
  league: LeagueId
  /** The user's choice: its files are downloaded and kept up to date. */
  on: boolean
  /** Its stats file is in the data folder; a league turned off keeps its file until it is deleted. */
  hasFile: boolean
  /** The file with its log, as it is on disk; 0 without one. */
  fileBytes: number
  /** Something to read: on, or a file kept from before. */
  hasData: boolean
  /** The free space its first load still needs; 0 once loaded. */
  roomNeeded: number
  /**
   * Its tables are built, from the league's own status (`builtAt`): filled in by the renderer, which
   * reads it beside this (`useLeagueDownloads`); undefined where it was not read. A league turned on
   * is downloading until then, and its pages have nothing to show (T1304.5).
   */
  built?: boolean
}

/** Which leagues download, for the first run and the Data panel. */
export interface LeagueDownloads {
  /** False on a clean profile until the user has chosen; nothing is downloaded before. */
  decided: boolean
  leagues: LeagueDownload[]
  /** Free space in the data folder; null when the system will not say. */
  freeBytes: number | null
}
