/** The one set of game types (D12). All-Star and preseason never count unless asked for. */
export const GAME_TYPES = [
  'regular',
  'play-in',
  'playoffs',
  'cup-final',
  'all-star',
  'preseason'
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
  | 'scoring'
  | 'composite'
  | 'tracking'
  | 'hustle'
  | 'play_types'
  | 'matchups'
  | 'impact'
  | 'availability'
  | 'shots'

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
export interface MetricDef {
  id: string
  label: string
  short: string
  description: string
  family: MetricFamily
  entity: Entity
  /** Team metrics: which end it measures. */
  side?: 'offense' | 'defense'
  kind: MetricKind
  aggregation: MetricAggregation
  value: string
  sample: string
  unit: MetricUnit
  decimals: number
  direction: 'higher' | 'lower' | 'neutral'
  /** The sample a row needs to qualify over 82 games, scaled to the team games in scope. */
  minSample?: number
  /** What a total divides by to be per game, when not `games`: a box score's count, not the record's. */
  perGameBy?: string
  /** Stays a total under per game, per 36 and the rest: wins per game would read as a win rate. */
  totalOnly?: boolean
  /** Scales per game, and no other way: minutes per 36 minutes would read 36. */
  perGameOnly?: boolean
  sources: string[]
  /** The first season holding real values, by final year. */
  firstSeason: number
  /** Seasons after it that the source does not have. */
  missingSeasons?: number[]
  /** Why the source no longer has this metric at all; every query answers with it. */
  unavailable?: string
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
   * `src/main/stats/derived/gameTables.ts`: the shots by zone. It answers at both grains, joined to the
   * box-score rows in scope, so a season, a team, a date range or any game filter reads exactly; what
   * it does not hold (games, minutes) comes from the box scores.
   */
  built?: string
  /**
   * A published value that is one regular season's state, not a total or a rate: a projection. It
   * answers for one regular season at a time, since an average of several would mean nothing.
   */
  oneSeason?: boolean
}

/** A catalogue entry as the engine serves it: the formula left out, where it can be read added. */
export interface MetricInfo extends Omit<MetricDef, 'value' | 'sample'> {
  grains: Grain[]
  /** What the sample counts, in words: "field-goal attempts". */
  sampleLabel: string
}

export type GroupBy = 'season' | 'team' | 'opponent' | 'month' | 'game'

/**
 * Totals, or a sum per game, 36 minutes, 48 minutes or 100 possessions; `percentile`, `zScore` and
 * `vsLeague` read a value against its pool. A ratio is the same in the first five.
 */
export type Transform =
  'raw' | 'perGame' | 'per36' | 'per48' | 'per100' | 'percentile' | 'zScore' | 'vsLeague'

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
    qualifiedOnly?: boolean
  }
  groupBy?: GroupBy[]
  transform?: Transform
  /** Default: the first metric, best first. */
  sort?: { metric: string; dir: 'asc' | 'desc' }
  /** Default 100, at most 5000. */
  limit?: number
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
}

export interface StatsResult {
  grain: Grain
  columns: StatsResultColumn[]
  rows: StatsRow[]
  /** Rows before `limit`. */
  total: number
  /** Caveats a screen should state: coverage, estimates. */
  notes: string[]
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
}

/** An official of a game, as the NBA's file names them. */
export interface StatsOfficial {
  id: string
  name: string
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

/** One member of a team's staff for a season, from the NBA's coach file. */
export interface StatsCoach {
  id: string
  name: string
  /** As the file words it: "Head Coach", "Assistant Coach". */
  title: string
  role: 'head' | 'assistant'
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
 * One five-man unit of a team's season, as the NBA publishes it. `values` holds the columns of the
 * group asked for (`shared/stats/lineups.ts`) and the possessions; a measure the NBA's file for it
 * does not list for this unit is null.
 */
export interface StatsLineupUnit {
  /** The five players, by id. */
  players: { id: string; name: string }[]
  games: number | null
  minutes: number | null
  values: Record<string, number | null>
}

/** A team's published units for a season and season type, most minutes first. */
export interface StatsLineups {
  units: StatsLineupUnit[]
  /** The fewest minutes among the units the NBA's base file lists for the season, league-wide. */
  floorMinutes: number | null
}

/** The totals modes a table offers; a ratio reads the same in each. */
export type BoardMode = 'raw' | 'perGame' | 'per36' | 'per48' | 'per100'

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
  /** An NBA team id; null for every team. */
  team: string | null
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
}

export type StatsFamilyState = 'loaded' | 'partial' | 'waiting' | 'failed'

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
}

/** What the Data panel shows. */
export interface StatsDataReport {
  families: StatsFamily[]
  databaseBytes: number
  /** Null when the system will not say. */
  freeBytes: number | null
}
