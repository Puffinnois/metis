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
  'traditional' | 'shooting' | 'possessions' | 'scoring' | 'composite' | 'tracking' | 'hustle'

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
  tier: MetricTier
  /**
   * The published table a metric with no game behind it reads, from
   * `src/main/stats/derived/publishedTables.ts`. Its components are that table's columns, so a rate
   * divides by the games and minutes tracked, and it can only answer for whole seasons.
   */
  published?: string
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
