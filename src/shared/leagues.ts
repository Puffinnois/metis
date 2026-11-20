import type { GameType } from './stats/types'

/**
 * The league registry (D34 to D36): the one place a league's facts live. Everything that differs
 * between leagues is read from here, and the league reaches every part of the app as context: the
 * worker is started for one, the engine, the catalogue and the builders are handed its entry, and every
 * IPC call names it. No code outside this file branches on a league's id.
 * `docs/reference/stats-database.md`, "Leagues", describes the mechanism.
 */
export const LEAGUE_IDS = ['nba', 'wnba', 'ncaam', 'ncaaw'] as const
export type LeagueId = (typeof LEAGUE_IDS)[number]

/** The league the app opens on, and the one every row saved before leagues belongs to (D35). */
export const DEFAULT_LEAGUE: LeagueId = 'nba'

/** The per-minute modes, each named by its base: per 36 minutes divides minutes by 36. */
export const PER_MINUTE = { per36: 36, per40: 40, per48: 48 } as const
export type PerMinuteMode = keyof typeof PER_MINUTE

/** How a game was divided from a season on: four 12-minute quarters, two 20-minute halves. */
export interface PeriodEra {
  /** The first season of this format; it holds until the next era's first season. */
  from: number
  /** Periods in regulation. */
  periods: number
  /** Minutes in each. */
  minutes: number
  /** What a period is called on screen. */
  name: 'quarter' | 'half'
}

/**
 * The tables a refresh builds from a league's files, in the order it builds them: the game, team and
 * player tables (`identity`), the game and season tables (`derived`), the published tables, the play
 * tables and the models. Each later one reads the ones before it.
 */
export const BUILT_TABLES = ['identity', 'derived', 'published', 'plays', 'models'] as const
export type BuiltTables = (typeof BUILT_TABLES)[number]

/**
 * The identity recipes, named for the sources they read: the NBA's schedule, the WNBA's schedule
 * and game logs, or the college leagues' ESPN schedules with stats.ncaa.org's beside them (one recipe
 * for the men and the women, D38).
 */
export type IdentityRecipeName = 'nba' | 'wnba' | 'college'

/**
 * The game and season table recipes, named for the box scores they read: the NBA's box scores, the
 * WNBA's game logs and 2026 box scores, or the college leagues' ESPN box scores with stats.ncaa.org's
 * beside them (one recipe for the men and the women, D38).
 */
export type DerivedRecipeName = 'nba' | 'wnba' | 'college'

/**
 * The published table recipes, named for the files they read: the NBA's, the WNBA's (its impact
 * file under its own name, and the 2026 Portland Fire's key), or the college leagues' SportsDataverse
 * team ratings, box-score BPM and RAPM (D44, one recipe for the men and the women).
 * `PUBLISHED_RECIPES` in `src/main/stats/derived/published.ts`.
 */
export type PublishedRecipeName = 'nba' | 'wnba' | 'college'

/**
 * The play table recipes, named for the play by play, shots, possessions and lineups they read: the
 * NBA's files, the WNBA's, or the college leagues' stats.ncaa.org shots, lineups, stints and
 * possessions with ESPN's shots and officials beside them (`PLAYS_RECIPES` in
 * `src/main/stats/derived/playsRecipe.ts`).
 */
export type PlaysRecipeName = 'nba' | 'wnba' | 'college'

/**
 * Families of stats a league's releases may not publish at all (`League.unpublished`). The last four
 * are the college leagues' (D44): the NET, its quadrants, the polls and the tournament's seeds.
 */
export type UnpublishedFamily =
  | 'tracking'
  | 'hustle'
  | 'play_types'
  | 'matchups'
  | 'availability'
  | 'combine'
  | 'net'
  | 'quadrants'
  | 'polls'
  | 'seeds'

/**
 * The three-point line from a season on, in the shot charts' frame (tenths of a foot from the basket):
 * the arc's radius, and how far from the basket it runs straight along the sides; a line that is an
 * arc down to the baseline has both the same.
 */
export interface ThreePointLine {
  from: number
  arc: number
  corner: number
}

/**
 * A season's shape, for qualifying a row grouped within it: the opponents a team meets and the months
 * it plays in, so a row by opponent or by month needs its share of the season's minimum.
 */
export interface SeasonShape {
  opponents: number
  months: number
}

/**
 * Which games of a playoff series the better side hosts, game by game; the length is the series'
 * best-of. `1-2`: the other side hosts the first game and the better side the rest.
 */
export const SERIES_PATTERNS = {
  '1': [true],
  '1-2': [false, true, true],
  '1-1-1': [true, false, true],
  '2-1': [true, true, false],
  '2-2-1': [true, true, false, false, true],
  '2-2-1-1-1': [true, true, false, false, true, false, true],
  '2-3-2': [true, true, false, false, false, true, true]
} as const
export type SeriesPattern = keyof typeof SERIES_PATTERNS

/**
 * The tie-break procedures by name (`src/main/stats/models/standings.ts`): the NBA's today, the NBA's
 * through 2003-04 (conference record before division record), and the WNBA's.
 */
export type TiebreakRecipe = 'nba' | 'nba-early' | 'wnba'

/**
 * How a season's playoffs were set, from a season on (the season simulation, Plan T1003). Seeds are
 * places in the order by record, tiebreakers applied, in the field's conference or in the league.
 */
export interface PlayoffEra {
  /** The first season of this format; it holds until the next era's first season. */
  from: number
  /** Where the field is drawn: each conference's best, or the league's whatever their conference. */
  field: 'conference' | 'league'
  /** Teams in the field, per conference or in the league, after any play-in. */
  teams: number
  /**
   * Division winners' places among the seeds: 2 (the winners seeded first and second), 3 (first to
   * third), `top4` (the winners and the best other team one to four, by record), 0 (record alone). A
   * league whose teams have no division counts each conference as one.
   */
  protectedSeeds: 0 | 2 | 3 | 'top4'
  /**
   * `bubble`, the NBA's 2019-20: the ninth, within four games of the eighth, had to beat it twice;
   * `modern`: seventh to tenth play for the last two seeds.
   */
  playIn: 'none' | 'bubble' | 'modern'
  /**
   * How the rounds pair. `slots`: the first round's places by seed in the order the series are played,
   * a bye as null, each later round pairing the winners of neighbouring places (a fixed bracket).
   * `entering`: the seeds entering at each round, the best side alive meeting the worst (reseeded).
   */
  bracket: { slots: readonly (number | null)[] } | { entering: readonly (readonly number[])[] }
  /**
   * Each round's home pattern and length, first to last; the last is the final, between the
   * conferences' champions for a conference field.
   */
  rounds: readonly SeriesPattern[]
  /** Home court by record in every round, else by seed within a conference and by record in the final. */
  homeByRecord: boolean
  tiebreak: TiebreakRecipe
  /** Teams of each conference eligible for the postseason, which the NBA's tiebreakers read. */
  eligibleTop: number
  /** Every playoff game at one site, with no home court. */
  neutral: boolean
}

/** A regular season's games a team, from a season on. */
export interface SeasonLength {
  from: number
  games: number
}

/** Elo's constants (`src/main/stats/models/elo.ts`), fitted per league. */
export interface EloConstants {
  /** Every team's rating at the start of the league's first season held. */
  start: number
  /** The mean ratings regress toward between seasons. */
  mean: number
  /** A team that enters the league (an expansion franchise). */
  newTeam: number
  k: number
  /** Home court in Elo points. */
  homeCourt: number
  /** The share of a rating's distance from the mean kept between seasons. */
  carry: number
  /** Elo points per point of margin: the expected margin is the edge over this. */
  perPoint: number
  /** The first season its metrics read: the seasons before are its burn-in. */
  firstSeason: number
}

/**
 * The league's constants and fitted values for Metis's ratings and models (Plan T1301.8): the model
 * code is shared, and everything that differs between leagues is read from here.
 */
export interface LeagueModels {
  elo: EloConstants
  /** The game types Elo rates: games between two teams of the league, counted or not. */
  eloGameTypes: readonly GameType[]
  /** The spread of a game's margin around Elo's expected margin, in points (the season simulation). */
  marginSd: number
  /** The first season forecast: Elo's metrics start there. */
  forecastFirstSeason: number
  /** The adjusted ratings' prior on each team effect, in possessions. */
  ridgePossessions: number
  /**
   * Seasons whose adjusted ratings are not shown: the season's halves disagree on the teams' order
   * (split-half reliability under 0.35, the "low" stability label's bound), so a rating would be
   * noise (`scripts/fit-league-models.mjs`, section 3).
   */
  adjustedThin: readonly number[]
  /** The exponent of the Pythagorean record on points for and against. */
  pythagoreanExponent: number
  /** The regular season's length by season, oldest first (`seasonGamesIn`). */
  seasonGames: readonly SeasonLength[]
  /**
   * The games VORP's season is scaled to: a number for a fixed scale (Basketball-Reference's 82 for the
   * NBA, every season), or `season` for the season's own length.
   */
  vorpGames: number | 'season'
  /**
   * Games with no home court beyond those ESPN's schedule marks (`neutralSitesSql`): `cities` whose
   * games all went without it, a season played at one site that no source marks (the NBA's 2020
   * restart, the WNBA's 2020 season); `types` played at a neutral site by rule (the NBA Cup final in
   * Las Vegas; the WNBA's Commissioner's Cup final is hosted from 2022); `cupSemifinals`, the NBA Cup's
   * semifinals read from ESPN's note.
   */
  neutral: { cities: readonly string[]; types: readonly GameType[]; cupSemifinals: boolean }
  /** The playoff format by season, oldest first (`playoffEraIn`). */
  playoffs: readonly PlayoffEra[]
  /**
   * Why Metis's Box Plus/Minus is not shown for the league, with VORP, OBPM, DBPM and the position and
   * role BPM estimates; null when it is. The builder still stores them, so the measure that decided it
   * can be run again (`scripts/check-wnba-models.mjs`, section 5); no metric reads them.
   */
  bpmUnavailable: string | null
}

/**
 * How a per-game leader's games minimum is set (a metric that qualifies on games alone, `qualifyBy`
 * `games`): `scaled`, the catalogue's count over `minimumsGames` scaled to the team games in scope
 * (D33, D37: 58 of 82); `share`, a share of the team games in scope, rounded up, since a share is
 * asked "at least" (D43: the NCAA's 75 percent of the team's games). Every other minimum is scaled.
 */
export type GamesRule =
  | { kind: 'scaled' }
  | {
      kind: 'share'
      share: number
      /**
       * The per-game categories the rule covers: those the league's own record book ranks per game.
       * A metric listed here qualifies on games in this league whatever the catalogue's `qualifyBy`
       * (`metricIn`); one not listed keeps the catalogue's qualifier.
       */
      perGame: readonly string[]
    }

export interface League {
  id: LeagueId
  /** As the screens write it: "NBA". */
  name: string
  /** The league's full name, for the Data panel and the credit. */
  fullName: string
  /** Minutes in a game's regulation: 48 or 40. */
  gameMinutes: number
  /**
   * The per-minute modes a board offers, in order: the NBA's per 36 and per 48, a 40-minute league's
   * per 36 and per 40 (D35). The last is the league's game length.
   */
  perMinute: readonly PerMinuteMode[]
  /** Periods by season, oldest first; the first era starts at `firstSeason`. */
  periods: readonly PeriodEra[]
  /** Minutes in an overtime. */
  overtimeMinutes: number
  /** How a season reads on screen: the data's `2026` is the NBA's `2025-26` and the WNBA's `2026`. */
  seasonLabel(season: number): string
  /** The season a date falls in, by the data's label: what is current, and what a refresh fetches. */
  currentSeason(now: Date): number
  /**
   * The year of the draft (or combine) a file of that label holds: the NBA labels its draft by the
   * season after it, the WNBA by the draft's own year (Caitlin Clark first in `draft_2024`).
   */
  eventYear(season: number): number
  /**
   * The months a season is played in, 1 to 12, first to last (the NBA's runs October to June, over
   * the new year). Outside them the league's season is complete, not stale (Plan T1301.3).
   */
  seasonMonths: { first: number; last: number }
  /** The game types the league has, in the order the screens offer them (D12 holds the set). */
  seasonTypes: readonly GameType[]
  /** The types that count as "the regular season and after". */
  countedTypes: readonly GameType[]
  /** What the screens call a type where the league's name differs (the NBA Cup final). */
  typeNames: Partial<Record<GameType, string>>
  /**
   * The short tag a game of a type carries in a list where the league's differs from the shared one
   * ("Playoffs"): the NCAA tournament's in the college leagues. None for the NBA and the WNBA.
   */
  typeTags?: Partial<Record<GameType, string>>
  /** What the screens call every counted type together: "Regular season and after" unless named. */
  countedName?: string
  /**
   * The season type a scope starts on: the regular season, or every counted game (D45: the college
   * leagues count every game, as the NCAA's statistics do).
   */
  defaultType: 'regular' | 'counted'
  /** The first season any of its data holds, by the data's label. */
  firstSeason: number
  /**
   * The qualifying minimums' base: the catalogue states each `minSample` over this many team games,
   * and a row's minimum scales by the team games in scope over it (D33).
   */
  minimumsGames: number
  /**
   * The game length the minimums are stated in: a minimum counted in minutes scales by the league's
   * `gameMinutes` over this.
   */
  minimumsMinutes: number
  /**
   * What the screens add to the qualifier while the league's own rule is not read, and its rows
   * qualify by another league's (D37).
   */
  minimumsNote?: string
  /** How the per-game leaders' games minimum is set (`GamesRule`). */
  gamesRule: GamesRule
  /**
   * The categories ranked by a rate whose minimum is a count per game played, with the games rule
   * beside it, in place of D37's counts scaled to the season (D43, added 2026-11-19: the colleges'
   * field-goal, three-point and free-throw percentages and assist-to-turnover ratio). `note` is how
   * the screens name the rule. None for the NBA and the WNBA.
   */
  madePerGame?: {
    note: string
    minimums: Readonly<Record<string, { count: string; perGame: number }>>
  }
  /**
   * Whether the seasons before `firstSeason` exist but are not loaded, by decision (D39: the college
   * leagues from 2021-22), so a metric there reads "Loaded from …" rather than "Recorded from …".
   */
  loadedWindow?: boolean
  /**
   * What the Standings screen says its table counts, where it is not the league's own regular season:
   * ESPN's college standings count every game, the postseason with it.
   */
  standingsWords?: string
  /**
   * Whether ranks, percentiles, league means and the rows a board lists keep to the season's
   * Division I teams (D40): every game counts for the Division I side, but a team outside Division I
   * and its players are never ranked. A query that names its players or teams still reads them.
   */
  divisionIOnly?: boolean
  /** A regular season's shape, for qualifying rows grouped by opponent or month. */
  seasonShape: SeasonShape
  /** The league's stats file in the data folder (D36). */
  statsFile: string
  /**
   * The file the league's stats had before files were per league; renamed to `statsFile` on start when
   * that does not exist yet (`adoptFormerStatsFile`). Only the NBA had one.
   */
  formerStatsFile?: string
  /** Where its files come from. The source registry itself stays in `src/main/stats/sources.ts`. */
  releases: {
    /** The release tags' prefixes on sportsdataverse-data. */
    prefixes: readonly string[]
    /** The source registry's entry for this league: `SOURCES_BY_LEAGUE[id]`. */
    registry: string
    /** What `docs/reference/` measured of them. */
    reference: string
  }
  /**
   * What a first load of the league takes, as measured: the files it downloads, the stats file it
   * leaves, the free space it needs with DuckDB's working files (refused below it, D22), and the size
   * past which the file counts as loaded and a refresh needs only megabytes. Whether a league loads at
   * all is the user's choice, kept in `metis.db` (`leagueDownloads` in the main process), not a fact
   * of the registry.
   */
  size: { downloadBytes: number; fileBytes: number; roomBytes: number; loadedBytes: number }
  /** What a screen says while the league has no data: it is off and has no file. */
  noData: string
  /**
   * The built tables the league has, each a step of its refresh (`BUILT_TABLES`). A step not listed
   * is not run, and a refresh says so in its log. Without `derived` (the game and season tables)
   * every question answers `notBuilt` with no error. A part that builds a league's next tables adds
   * the step here and touches nothing else of the mechanism.
   */
  builds: readonly BuiltTables[]
  /**
   * The families no release publishes for the league, each with the reason every screen gives: the
   * catalogue's metrics of the family and the reads behind its tabs (matchup pairs, a game's
   * matchups, the combine, games out) answer it instead of an empty table. None for the NBA.
   */
  unpublished: Partial<Record<UnpublishedFamily, string>>
  /**
   * The recipes below and `models` are null for a league whose tables are not built yet (the college
   * leagues' published tables, plays and models, until T1302.6 to T1302.8 name them). Each is read through an accessor
   * that throws on null (`identityRecipe`, `derivedRecipe`, `publishedRecipe`, `playsRecipe`,
   * `modelsOf`), and a refresh reaches one only for a step `builds` lists.
   *
   * The recipe that builds its `game`, `team` and `player` tables, named for the sources it reads
   * (`IDENTITY_RECIPES` in `src/main/stats/identity.ts`). The shared SQL stays shared; only what
   * differs between the leagues' sources is written per recipe.
   */
  identity: IdentityRecipeName | null
  /**
   * The recipe that builds its `player_game` and `team_game` (`DERIVED_RECIPES` in
   * `src/main/stats/derived/build.ts`): which box scores it reads. The season tables after them, and
   * the SQL the recipes share, are one for every league.
   */
  derived: DerivedRecipeName | null
  /** The recipe that builds its published tables (`PUBLISHED_RECIPES`). */
  published: PublishedRecipeName | null
  /** The recipe that builds its play, shot, split and on-court tables (`PLAYS_RECIPES`). */
  plays: PlaysRecipeName | null
  /**
   * False while the league's plays step builds its shots, on-court units, lineups and officials but
   * not yet the tables of its play by play (the college leagues until T1302.7): their metrics, the
   * splits, the assist network and the game flow read `notBuiltYet` for the plays. Absent everywhere
   * else (`buildsPlayTables`).
   */
  playTables?: false
  /**
   * Half the width of the lane in the shot charts' frame (tenths of a foot), where it is not the
   * NBA's 16 feet (`COURT.laneHalfWidth` in `stats/shots.ts`): the paint zone and the chart read it.
   */
  laneHalfWidth?: number
  /**
   * Where the league's on-court, lineup and unit numbers come from and how much of the game they
   * cover, where it is not the NBA's play by play (the college leagues' lineup file, policy 4): the
   * on-court screens and the lineups tab state it in place of the NBA's notes.
   */
  onCourtNote?: string
  /**
   * Where the college leagues' on-court screens, units and lineups tab read who was on the floor:
   * stats.ncaa.org's lineup file, or the ten its play by play names at each play, credited play by play
   * as the NBA's are. Both are built; the other is kept beside it under its own name
   * (`unit_game_plays` or `unit_game_lineups`, `onCourtTables` in `derived/collegePbp.ts`), so changing
   * this one setting is the switch, and the next refresh rebuilds the tables. Absent where the league
   * has the NBA's single source.
   */
  onCourtFrom?: 'lineups' | 'plays'
  /** The three-point line by era, oldest first (`threePointLineIn`). */
  threePointLines: readonly ThreePointLine[]
  /** The first season of the league's published five-player units (the lineup dashboards). */
  lineupsFrom: number
  /** The first season of its published standings. */
  standingsFrom: number
  /** The first season of its shot chart file. */
  shotsFrom: number
  /**
   * The first season every shot has a location: before it, shots with none sit at (0, 0) and zones,
   * distances and charts read only those placed.
   */
  shotsLocatedFrom: number
  /**
   * What a screen says while the league's tables are not built: before its first load gets that far,
   * or always while `builds` lacks `derived`.
   */
  notBuilt: string
  /**
   * Whether a metric that states nothing for this league exists in it, over the metric's own
   * `firstSeason`. True for the league the catalogue was written for; a league added later lists its
   * metrics in each one's `leagues` (`catalogueIn`).
   */
  metricsByDefault: boolean
  /**
   * Constants and fitted values of its ratings and models (Plan T1301.8); null while the league has
   * none fitted (the college leagues until T1302.8). Read through `modelsOf`.
   */
  models: LeagueModels | null
  /**
   * How the catalogue's words, written for the NBA, read on this league's metrics (`metricIn`): each
   * pair's text is replaced where it stands as whole words, in one pass, the longest first, so a pair
   * mapping a phrase to itself keeps it. A metric the league lacks keeps its words beside its reason.
   * Empty for the NBA, whose catalogue reads as written.
   */
  catalogueWords: readonly (readonly [string, string])[]
}

/** A league with every recipe and its models named: the NBA and the WNBA. */
export type BuiltLeague = League & {
  identity: IdentityRecipeName
  derived: DerivedRecipeName
  published: PublishedRecipeName
  plays: PlaysRecipeName
  models: LeagueModels
}

const MB = 1024 ** 2
const GB = 1024 ** 3

const finalYear = (season: number): string =>
  `${season - 1}-${String(season % 100).padStart(2, '0')}`

/**
 * The NBA's playoffs since 1993-94 (`nba-data-sources.md`, "The playoff field, per season"): eight
 * teams of each conference, one against eight, four against five, three against six, two against
 * seven, the series played in that order. The first round was best of five through 2001-02; the
 * Finals 2-3-2 through 2012-13; the division winners' protected seeds, home court and the
 * tiebreakers changed with the 2004-05 realignment; the play-in came in 2019-20 (the bubble's) and
 * 2020-21.
 */
const NBA_1994: PlayoffEra = {
  from: 1994,
  field: 'conference',
  teams: 8,
  protectedSeeds: 2,
  playIn: 'none',
  bracket: { slots: [1, 8, 4, 5, 3, 6, 2, 7] },
  rounds: ['2-2-1', '2-2-1-1-1', '2-2-1-1-1', '2-3-2'],
  homeByRecord: false,
  tiebreak: 'nba-early',
  eligibleTop: 8,
  neutral: false
}
const NBA_2003: PlayoffEra = {
  ...NBA_1994,
  from: 2003,
  rounds: ['2-2-1-1-1', '2-2-1-1-1', '2-2-1-1-1', '2-3-2']
}
const NBA_2005: PlayoffEra = {
  ...NBA_2003,
  from: 2005,
  protectedSeeds: 3,
  homeByRecord: true,
  tiebreak: 'nba'
}
const NBA_2007: PlayoffEra = { ...NBA_2005, from: 2007, protectedSeeds: 'top4' }
const NBA_2014: PlayoffEra = {
  ...NBA_2007,
  from: 2014,
  rounds: ['2-2-1-1-1', '2-2-1-1-1', '2-2-1-1-1', '2-2-1-1-1']
}
const NBA_2016: PlayoffEra = { ...NBA_2014, from: 2016, protectedSeeds: 0 }
const NBA_2020: PlayoffEra = { ...NBA_2016, from: 2020, playIn: 'bubble', neutral: true }
const NBA_2021: PlayoffEra = {
  ...NBA_2016,
  from: 2021,
  playIn: 'modern',
  eligibleTop: 10
}

/**
 * The WNBA's playoffs, from Wikipedia's "WNBA playoffs" (its "Format", "Tiebreaker procedures" and
 * "History" sections, read with a plain client on 2026-11-18) and the home pattern of every series
 * played, measured on the league's games (`wnba-data-sources.md`, "The playoff format, per season"):
 * four teams in 1997 and 1998, the conference winners seeded first and second, single games in 1997
 * and best of three in 1998; three of each conference in 1999, the first seed's bye to the conference
 * finals; four of each conference from 2000 to 2015, the Finals best of five from 2005; the eight best
 * records from 2016, the third and fourth seeds entering at the second round and the first and second
 * at the semifinals, single games to there and the best side meeting the worst after each round, to
 * 2021; a fixed bracket of eight from 2022, the Finals best of seven from 2025. The best of three went
 * 1-2 (the better side hosting the second and third games) to 2009, 1-1-1 from 2010, 2-1 in the first
 * round of 2022 to 2024. Its tiebreakers: the games between the tied teams, the record against teams
 * at .500 or better, the point differential between the tied teams, then in all games.
 */
const WNBA_1997: PlayoffEra = {
  from: 1997,
  field: 'league',
  teams: 4,
  protectedSeeds: 2,
  playIn: 'none',
  bracket: { slots: [1, 4, 2, 3] },
  rounds: ['1', '1'],
  homeByRecord: false,
  tiebreak: 'wnba',
  eligibleTop: 4,
  neutral: false
}
const WNBA_1998: PlayoffEra = { ...WNBA_1997, from: 1998, rounds: ['1-2', '1-2'] }
const WNBA_1999: PlayoffEra = {
  ...WNBA_1998,
  from: 1999,
  field: 'conference',
  teams: 3,
  protectedSeeds: 0,
  bracket: { slots: [1, null, 2, 3] },
  rounds: ['1', '1-2', '1-2'],
  eligibleTop: 3
}
const WNBA_2000: PlayoffEra = {
  ...WNBA_1999,
  from: 2000,
  teams: 4,
  bracket: { slots: [1, 4, 2, 3] },
  rounds: ['1-2', '1-2', '1-2'],
  eligibleTop: 4
}
const WNBA_2005: PlayoffEra = { ...WNBA_2000, from: 2005, rounds: ['1-2', '1-2', '2-2-1'] }
const WNBA_2010: PlayoffEra = { ...WNBA_2005, from: 2010, rounds: ['1-1-1', '1-1-1', '2-2-1'] }
const WNBA_2016: PlayoffEra = {
  ...WNBA_2010,
  from: 2016,
  field: 'league',
  teams: 8,
  bracket: {
    entering: [
      [5, 6, 7, 8],
      [3, 4],
      [1, 2]
    ]
  },
  rounds: ['1', '1', '2-2-1', '2-2-1'],
  homeByRecord: true,
  eligibleTop: 8
}
const WNBA_2020: PlayoffEra = { ...WNBA_2016, from: 2020, neutral: true }
const WNBA_2021: PlayoffEra = { ...WNBA_2016, from: 2021 }
const WNBA_2022: PlayoffEra = {
  ...WNBA_2016,
  from: 2022,
  bracket: { slots: [1, 8, 4, 5, 2, 7, 3, 6] },
  rounds: ['2-1', '2-2-1', '2-2-1']
}
const WNBA_2025: PlayoffEra = {
  ...WNBA_2022,
  from: 2025,
  rounds: ['1-1-1', '2-2-1', '2-2-1-1-1']
}

const NBA: BuiltLeague = {
  id: 'nba',
  name: 'NBA',
  fullName: 'National Basketball Association',
  gameMinutes: 48,
  perMinute: ['per36', 'per48'],
  periods: [{ from: 1994, periods: 4, minutes: 12, name: 'quarter' }],
  overtimeMinutes: 5,
  seasonLabel: finalYear,
  // A season is labelled by its final year (D10). The next season's schedule appears over the summer,
  // so the label turns in August; a file not published yet is skipped, not an error.
  currentSeason: (now) => now.getUTCFullYear() + (now.getUTCMonth() >= 7 ? 1 : 0),
  eventYear: (season) => season - 1,
  seasonMonths: { first: 10, last: 6 },
  seasonTypes: ['regular', 'play-in', 'playoffs', 'cup-final', 'all-star', 'preseason'],
  countedTypes: ['regular', 'play-in', 'playoffs', 'cup-final'],
  typeNames: { 'cup-final': 'NBA Cup final' },
  defaultType: 'regular',
  firstSeason: 1994,
  minimumsGames: 82,
  minimumsMinutes: 48,
  gamesRule: { kind: 'scaled' },
  // A team meets each of 29 opponents about three times a season, over about six months.
  seasonShape: { opponents: 29, months: 6 },
  statsFile: 'stats-nba.duckdb',
  formerStatsFile: 'stats.duckdb',
  releases: {
    prefixes: ['espn_nba_', 'nba_stats_', 'nba_'],
    registry: 'SOURCES_BY_LEAGUE.nba in src/main/stats/sources.ts',
    reference: 'docs/reference/nba-data-sources.md'
  },
  // Measured: 1,554 MB of files (nba-data-sources.md, "The first full load") and the 5.47 GB file of
  // the Stage 12 profile; a first load is refused under 6 GB free, and done past 4 GB.
  size: {
    downloadBytes: 1554 * MB,
    fileBytes: 5_467_811_840,
    roomBytes: 6 * GB,
    loadedBytes: 4 * GB
  },
  noData: 'No NBA stats yet: turn the NBA on in the Data panel to download it.',
  builds: BUILT_TABLES,
  unpublished: {},
  identity: 'nba',
  derived: 'nba',
  published: 'nba',
  plays: 'nba',
  // 22 feet in the corners, an arc of 23 feet 9 inches (`COURT` in `stats/shots.ts`), every season.
  threePointLines: [{ from: 1994, arc: 237.5, corner: 220 }],
  // Five-man units are published from 2007-08.
  lineupsFrom: 2008,
  // The league dashboards' standings reach 1995-96, the core file's 1996-97 (`readStandings`).
  standingsFrom: 1996,
  // The shot chart file from 1996-97, every shot located (`SHOTS_FIRST_SEASON`).
  shotsFrom: 1997,
  shotsLocatedFrom: 1997,
  notBuilt: 'No NBA stats yet: the first load has not got that far.',
  metricsByDefault: true,
  // Stage 10's values, each fitted and checked in `nba-data-sources.md` ("Elo", "Adjusted ratings",
  // "The season forecast, checked").
  models: {
    // FiveThirtyEight's NBA Elo, with home court 80 and a carry of 0.65 fitted on 1995-96 to 2009-10
    // and scored on 2010-11 on; every team at 1500 in 1993-94, so its metrics read from 1995-96.
    elo: {
      start: 1500,
      mean: 1505,
      newTeam: 1300,
      k: 20,
      homeCourt: 80,
      carry: 0.65,
      perPoint: 28,
      firstSeason: 1996
    },
    eloGameTypes: ['regular', 'play-in', 'playoffs', 'cup-final'],
    // The regular season's margins around Elo's expected margin, 1995-96 to 2025-26: 12.38.
    marginSd: 12.4,
    forecastFirstSeason: 1996,
    ridgePossessions: 250,
    adjustedThin: [],
    // Basketball-Reference's exponent for the NBA.
    pythagoreanExponent: 14,
    // Lockouts in 1998-99 and 2011-12, and 2020-21's 72; 2019-20 was scheduled for 82.
    seasonGames: [
      { from: 1994, games: 82 },
      { from: 1999, games: 50 },
      { from: 2000, games: 82 },
      { from: 2012, games: 66 },
      { from: 2013, games: 82 },
      { from: 2021, games: 72 },
      { from: 2022, games: 82 }
    ],
    // Basketball-Reference's VORP is out of 82 games in every season, shortened ones included.
    vorpGames: 82,
    // The 2020 restart near Orlando, which ESPN does not mark neutral; the Cup final in Las Vegas and
    // its semifinals, 2023-24's unmarked.
    neutral: { cities: ['Lake Buena Vista'], types: ['cup-final'], cupSemifinals: true },
    playoffs: [NBA_1994, NBA_2003, NBA_2005, NBA_2007, NBA_2014, NBA_2016, NBA_2020, NBA_2021],
    bpmUnavailable: null
  },
  catalogueWords: []
}

/**
 * Facts from `docs/reference/wnba-data-sources.md` (T1301.1). Its qualifying rule is provisional (D37):
 * the NBA's minimums scaled to the team games in scope over the NBA's 82, so 58 games of 82 asks 24 of
 * a 34-game season and 31 of a 44-game one, and a minimum in minutes scales by 40 over 48, until the
 * owner reads the league's own rule.
 */
const WNBA: BuiltLeague = {
  id: 'wnba',
  name: 'WNBA',
  fullName: "Women's National Basketball Association",
  gameMinutes: 40,
  perMinute: ['per36', 'per40'],
  // Two 20-minute halves to 2005, four 10-minute quarters from 2006.
  periods: [
    { from: 1997, periods: 2, minutes: 20, name: 'half' },
    { from: 2006, periods: 4, minutes: 10, name: 'quarter' }
  ],
  overtimeMinutes: 5,
  // A season is the year it was played: `…_2026` holds May to October 2026.
  seasonLabel: (season) => String(season),
  currentSeason: (now) => now.getUTCFullYear(),
  eventYear: (season) => season,
  seasonMonths: { first: 5, last: 10 },
  // No play-in and no preseason are published; the Commissioner's Cup final and the All-Star Game are
  // ESPN's only.
  seasonTypes: ['regular', 'playoffs', 'cup-final', 'all-star'],
  countedTypes: ['regular', 'playoffs', 'cup-final'],
  typeNames: { 'cup-final': "Commissioner's Cup final" },
  defaultType: 'regular',
  firstSeason: 1997,
  minimumsGames: 82,
  minimumsMinutes: 48,
  minimumsNote: "scaled, until the WNBA's own are read",
  gamesRule: { kind: 'scaled' },
  // Eleven opponents in the twelve-team seasons (2010 to 2024, the most of any size), over about four
  // months from mid-May to mid-September (D37).
  seasonShape: { opponents: 11, months: 4 },
  statsFile: 'stats-wnba.duckdb',
  releases: {
    prefixes: ['espn_wnba_', 'wnba_stats_', 'wnba_'],
    registry: 'SOURCES_BY_LEAGUE.wnba in src/main/stats/sources.ts',
    reference: 'docs/reference/wnba-data-sources.md'
  },
  // Measured on the first load of T1301.4 (wnba-data-sources.md, "The first load, measured"): 294 MB
  // of files and a 666 MB file in 3.7 minutes; a first load asks one and a half times the file free.
  size: {
    downloadBytes: 294 * MB,
    fileBytes: 697_839_616,
    roomBytes: 1 * GB,
    loadedBytes: 512 * MB
  },
  noData: 'No WNBA stats yet: turn the WNBA on in the Data panel to download it.',
  // Its game, team and player tables (T1301.5), its game and season tables (T1301.6), its published
  // tables and its plays (T1301.7), and Metis's ratings and models (T1301.8).
  builds: BUILT_TABLES,
  // No WNBA release publishes these (wnba-data-sources.md, "Tables"). ESPN's injury snapshots begin
  // on 2026-09-08 with the current state only: the 2026 regular season's last week and its playoffs,
  // so no season's games out can be counted from them (T1301.7).
  unpublished: {
    tracking: 'Not published for the WNBA: no release holds player tracking.',
    hustle: 'Not published for the WNBA: no release holds hustle stats.',
    play_types: 'Not published for the WNBA: no release holds play types.',
    matchups: 'Not published for the WNBA: no release holds matchups.',
    availability:
      "Not published for the WNBA: it has no official injury report, and ESPN's injury snapshots start in September 2026.",
    combine: 'Not published for the WNBA: no release holds a draft combine.'
  },
  identity: 'wnba',
  derived: 'wnba',
  published: 'wnba',
  plays: 'wnba',
  // Measured on the league's shots (wnba-data-sources.md, "Shots"): the nearest threes and the farthest
  // twos put the line at 19 feet 9 inches to 2003 and 6.25 metres (20 feet 6 inches) from 2004 to 2012,
  // both arcs down to the baseline, and from 2013 at 6.75 metres (22 feet 1.75 inches) above 22 feet in
  // the corners.
  threePointLines: [
    { from: 1997, arc: 197.5, corner: 197.5 },
    { from: 2004, arc: 205, corner: 205 },
    { from: 2013, arc: 221.5, corner: 220 }
  ],
  // The lineup dashboards list units from 1997, the playoffs from 2001 (`wnba-data-sources.md`).
  lineupsFrom: 1997,
  // The league dashboards' standings, from the first season, last ten and streaks with them.
  standingsFrom: 1997,
  // Shots from 1997; 18.6 to 30 % of them at (0, 0) before 2011 (wnba-data-sources.md, "Traps").
  shotsFrom: 1997,
  shotsLocatedFrom: 2011,
  notBuilt: 'No WNBA stats yet: the first load has not got that far.',
  metricsByDefault: false,
  models: {
    // Fitted on 1999 to 2011 and scored on 2012 to 2026 (wnba-agreement.md, "Elo"): the grid's best
    // (K 24, home court 90, a carry of 0.5) scores 0.0005 worse on the later seasons than the NBA's
    // values, within 1.3 standard errors, so the NBA's stand. Its 28 Elo points a point of margin fit
    // the WNBA's margins (27.6). Every team at 1500 in 1997: the metrics read from 2001, the first season
    // every team's rating is within 10 points whatever its start.
    elo: {
      start: 1500,
      mean: 1505,
      newTeam: 1300,
      k: 20,
      homeCourt: 80,
      carry: 0.65,
      perPoint: 28,
      firstSeason: 2001
    },
    eloGameTypes: ['regular', 'playoffs', 'cup-final'],
    // The regular season's margins around Elo's expected margin, 2001 to 2026.
    marginSd: 12.1,
    forecastFirstSeason: 2001,
    // A team-season holds about 2,700 possessions, a third of the NBA's: 100 pulls a season's final
    // ratings by the same share as the NBA's 250 (0.16 points per 100 at the mean).
    ridgePossessions: 100,
    // 2004 (0.28) and 2009 (−0.14): seasons of near parity, the spread of net ratings 3.4 and 2.3.
    adjustedThin: [2004, 2009],
    // Fitted on 1997 to 2011, scored on 2012 to 2026: 0.047 of winning percentage against 14's 0.058.
    pythagoreanExponent: 10.5,
    // Basketball-Reference's season pages (wnba-data-sources.md, "Season lengths and team counts").
    seasonGames: [
      { from: 1997, games: 28 },
      { from: 1998, games: 30 },
      { from: 1999, games: 32 },
      { from: 2003, games: 34 },
      { from: 2020, games: 22 },
      { from: 2021, games: 32 },
      { from: 2022, games: 36 },
      { from: 2023, games: 40 },
      { from: 2025, games: 44 }
    ],
    vorpGames: 'season',
    // The 2020 season at IMG Academy, which ESPN does not mark neutral. The Commissioner's Cup final
    // was at a neutral site in 2021 only, which ESPN marks, and hosted by a finalist since.
    neutral: { cities: ['Bradenton'], types: [], cupSemifinals: false },
    playoffs: [
      WNBA_1997,
      WNBA_1998,
      WNBA_1999,
      WNBA_2000,
      WNBA_2005,
      WNBA_2010,
      WNBA_2016,
      WNBA_2020,
      WNBA_2021,
      WNBA_2022,
      WNBA_2025
    ],
    // Measured (wnba-agreement.md, "BPM"): refitted on the impact file's RAPM of 1997 to 2011, Metis's
    // BPM predicted the next season's team net ratings of 2013 to 2026 with r 0.62, against the impact
    // file's own BPM's 0.69, so no refit ships, and the published BPM stays under its own name.
    bpmUnavailable:
      "Not computed for the WNBA: refitted on the league's seasons, Metis's BPM predicted the next season's team ratings no better than the impact file's BPM, which is shown under its own name."
  },
  // The league's own files are the NBA's feed for the WNBA (stats.wnba.com's dashboards, play by play
  // and shot charts), so "as the NBA publishes it" reads "as the WNBA publishes it"; the sources and
  // the notes that name the NBA's seasons say the WNBA's (wnba-data-sources.md), and a note on the
  // NBA's files alone is left out.
  catalogueWords: [
    ["The NBA's box scores from 1996-97", "The WNBA's game logs from 1997, its box scores in 2026"],
    ["ESPN's box scores before them", "ESPN's box scores beside them from 2003"],
    ["The NBA's box scores", "The WNBA's game logs and box scores"],
    ["FiveThirtyEight's NBA Elo", "FiveThirtyEight's NBA Elo"],
    ['from the published method, from 1993-94', 'from the published method, from 1997'],
    [' Before 2023-24 they are often rounded to two places.', ''],
    [' They read low before 2004-05: about 5 a game, against 11 to 15 after.', ''],
    [
      "ESPN's flag is the only source before 2017-18, and it is missing for some games, mostly in 2001-02, 2004-05 and 2005-06.",
      "ESPN's flag from 2002, and the league's box scores in 2026."
    ],
    [
      ' Who started is unknown for some games, mostly in 2001-02, 2004-05 and 2005-06, so per game counts only those known.',
      ' Who started is read from 2002, so per game counts only the games it is known.'
    ],
    [' Most lines in 2003-04 and 2004-05 are rounded to the minute.', ''],
    [
      'the fouled player from 2006-07 to 2016-17 only.',
      'the fouled player from 2006 to 2017 only.'
    ],
    ['from ESPN’s play by play, 2006-07 to 2016-17.', 'from ESPN’s play by play, 2006 to 2017.'],
    [', from 2010-11.', '.'],
    [', the rule of 2022-23 on.', ', as the play by play tags them.'],
    ['NBA', 'WNBA']
  ]
}

/**
 * NCAA Division I's college shape (D38), shared by the men's and women's leagues so neither copies the
 * other: seasons from 2021-22 (D39), labelled by their final year as the NBA's, November to April, 40
 * minutes and per-40 rates, one three-point line, the events as season types counted together (D45),
 * the NCAA's games rule (D43). What differs comes from each league's own fields below: the periods,
 * the releases, the events and the measured size. Its sources (T1302.3), its game, team and player
 * tables (T1302.4) and its game and season tables (T1302.5) are built; the published tables, the plays
 * and the models come with T1302.6 to T1302.8.
 */
const NCAA_FIRST_SEASON = 2022

/**
 * How the catalogue's words read on the college leagues' metrics: ESPN's box scores are the counts,
 * stats.ncaa.org's fill the games ESPN lacks (D40), and the NBA's eras and published figures do not
 * apply. A phrase naming the NBA's formula (the Four Factors "as the NBA counts them", PIE) stays.
 */
/**
 * The college leagues' on-court numbers come from stats.ncaa.org's lineup file, which loses time
 * (T1302.6, measured on every season of both leagues: about 97 % of minutes, a team-game short by a
 * minute or more in about four of ten), so their totals run under the box score's. Said on screen.
 */
export const COLLEGE_LINEUP_COVERAGE =
  "stats.ncaa.org's lineup file covers about 97 % of minutes and is short by a minute or more in about four team-games of ten, so on-court totals run under the box score."

/**
 * What the on-court numbers credited play by play cover (T1302.7, measured on 2021-22 to 2025-26 of both
 * leagues): every minute of every game, points on the floor equal to the score on 99.8 to 100 % of
 * team-games, a player's on-court minutes within one of the box score's on 88 to 95 % of player-games.
 */
export const COLLEGE_PLAYS_COVERAGE =
  "Credited play by play from the ten players stats.ncaa.org's play by play names at each play: every minute of a game is covered, points on the floor equal the score on 99.8 to 100 % of team-games, and a player's on-court minutes are within one of the box score's on 88 to 95 % of player-games."

/**
 * Where both college leagues' on-court screens read who was on the floor (`League.onCourtFrom`): the one
 * setting the switch is. The play by play, the manager's decision on T1302.7's comparison (players'
 * on-court minutes within one of the box score's on 88 to 95 % of player-games against the lineup file's
 * 39 to 42.5 %); the lineup file's units are kept beside them under their own name (policy 5). The
 * screens' note and the catalogue's words follow it.
 */
export const COLLEGE_ON_COURT_FROM = 'plays' as 'lineups' | 'plays'

/** What the on-court screens and the lineups tab say of the college leagues' source. */
const COLLEGE_ON_COURT_NOTE =
  COLLEGE_ON_COURT_FROM === 'lineups'
    ? `Who was on the floor, and the counts while they were, are stats.ncaa.org's lineup file (SportsDataverse's release). ${COLLEGE_LINEUP_COVERAGE} Derived, not official.`
    : `Who was on the floor, and the counts while they were, are stats.ncaa.org's play by play (SportsDataverse's release). ${COLLEGE_PLAYS_COVERAGE} Derived, not official.`

const COLLEGE_WORDS: League['catalogueWords'] = [
  ...((COLLEGE_ON_COURT_FROM === 'lineups'
    ? [
        [
          "SportsDataverse's lineups and possessions, from the NBA's play by play",
          "stats.ncaa.org's lineup file (SportsDataverse's release)"
        ],
        [
          'Derived from the play by play, not official.',
          `Derived from stats.ncaa.org's lineup file, not official: it covers about 97 % of minutes and is short by a minute or more in about four team-games of ten, so on-court totals run under the box score.`
        ]
      ]
    : [
        [
          "SportsDataverse's lineups and possessions, from the NBA's play by play",
          "stats.ncaa.org's play by play (SportsDataverse's release)"
        ],
        [
          'Derived from the play by play, not official.',
          `Derived from stats.ncaa.org's play by play, not official. ${COLLEGE_PLAYS_COVERAGE}`
        ]
      ]) as League['catalogueWords']),
  ["The NBA's box scores from 1996-97", "ESPN's box scores"],
  ["ESPN's box scores before them", "stats.ncaa.org's for the games ESPN has none of"],
  ["The NBA's box scores", "ESPN's box scores"],
  [
    "ESPN's flag is the only source before 2017-18, and it is missing for some games, mostly in 2001-02, 2004-05 and 2005-06.",
    "ESPN's flag, so none for a game whose box score is stats.ncaa.org's."
  ],
  [
    ' Who started is unknown for some games, mostly in 2001-02, 2004-05 and 2005-06, so per game counts only those known.',
    " Who started is unknown for a game whose box score is stats.ncaa.org's, so per game counts only those known."
  ],
  [' Most lines in 2003-04 and 2004-05 are rounded to the minute.', ''],
  [' They read low before 2004-05: about 5 a game, against 11 to 15 after.', ''],
  [' Published by the NBA as PCT_FGA_3PT.', ''],
  // Fouls drawn: stats.ncaa.org's play by play names the fouled player on every foul (T1302.7).
  [
    'Personal fouls drawn, from ESPN’s play by play, which names the fouled player from 2006-07 to 2016-17 only.',
    "Personal fouls drawn, from stats.ncaa.org's play by play, which names the fouled player on every foul."
  ],
  [
    'Shooting fouls drawn, from ESPN’s play by play, 2006-07 to 2016-17.',
    "Shooting fouls drawn, from stats.ncaa.org's play by play."
  ],
  ["ESPN's play by play (the fouled player)", "stats.ncaa.org's play by play (the fouled player)"],
  [' Published by the NBA as PCT_FGA_2PT.', ''],
  ["It is not the NBA's published figure.", 'It is not a published figure.'],
  [
    "Whole games: the NBA's published share counts only the minutes they were on the floor.",
    'Whole games, not only the minutes they were on the floor.'
  ]
]

const college = (
  league: Pick<
    League,
    | 'id'
    | 'name'
    | 'fullName'
    | 'periods'
    | 'seasonTypes'
    | 'releases'
    | 'size'
    | 'noData'
    | 'notBuilt'
    | 'madePerGame'
  >
): League => ({
  ...league,
  gameMinutes: 40,
  perMinute: ['per36', 'per40'],
  overtimeMinutes: 5,
  seasonLabel: finalYear,
  // Labelled by the final year, as the NBA's (D10): the season that tips off in November 2026 is
  // `2027`. The label turns in August, before the schedules appear; a file not published yet is
  // skipped, not an error.
  currentSeason: (now) => now.getUTCFullYear() + (now.getUTCMonth() >= 7 ? 1 : 0),
  // No draft or combine is held by the NCAA; the label's convention is the NBA's.
  eventYear: (season) => season - 1,
  // Early November to the Final Four in early April (ncaa-data-sources.md, "Coverage").
  seasonMonths: { first: 11, last: 4 },
  // Every event counts, as the NCAA's official statistics include conference and NCAA tournaments
  // (D45); leaving one out is a filter. Exhibitions never count: they are `preseason`, read only when
  // a query asks for them.
  countedTypes: league.seasonTypes.filter((t) => t !== 'all-star' && t !== 'preseason'),
  typeNames: { playoffs: 'NCAA tournament', preseason: 'Exhibition' },
  typeTags: { playoffs: 'NCAA tournament', preseason: 'Exhibition' },
  countedName: 'Every game',
  defaultType: 'counted',
  firstSeason: NCAA_FIRST_SEASON,
  // The makes minimums stay D37's, the NBA's per 82 team games scaled to the games in scope, and a
  // minimum in minutes by 40 over 48, until the NCAA's own are read (D43).
  minimumsGames: 82,
  minimumsMinutes: 48,
  // The other minimums are the catalogue's, over 82 team games, scaled to the games in range.
  minimumsNote: 'scaled to the games in range',
  // "To be ranked, a student-athlete must appear in 75 percent of the team's games" (D43).
  // It covers every category the NCAA's record books rank per game (D43, added 2026-11-19): scoring,
  // rebounds, assists, steals, blocks and three-pointers made. Double-doubles and triple-doubles are
  // ranked as totals, and the percentages and the assist-to-turnover ratio keep their own qualifiers.
  gamesRule: { kind: 'share', share: 0.75, perGame: ['pts', 'reb', 'ast', 'stl', 'blk', 'fg3m'] },
  // Nothing before 2021-22 is loaded (D39); Division I teams alone are ranked (D40).
  loadedWindow: true,
  divisionIOnly: true,
  standingsWords: 'Every game, the postseason with it, as ESPN publishes it',
  // Measured on ESPN's team box scores of 2021-22 to 2025-26, teams with 20 games or more: about 33
  // games a season (30 to 33 for the women) against 22.6 to 24.3 opponents (21.5 to 23.6), about 1.4
  // games an opponent, in five months, both sides alike.
  seasonShape: { opponents: 24, months: 5 },
  statsFile: `stats-${league.id}.duckdb`,
  // The game, team and player tables (T1302.4), the game and season tables (T1302.5), the published
  // tables and the shots, lineups and officials of the plays step (T1302.6), and the play by play's own
  // tables (T1302.7); the models come with T1302.8.
  builds: ['identity', 'derived', 'published', 'plays'],
  // The families no release publishes (D44, `ncaa-data-sources.md`, "Tables"), each with its reason.
  unpublished: {
    tracking: 'Not published for college basketball: no release holds player tracking.',
    hustle: 'Not published for college basketball: no release holds hustle stats.',
    play_types: 'Not published for college basketball: no release holds play types.',
    matchups: 'Not published for college basketball: no release holds matchups.',
    availability:
      'Not published for college basketball: there is no injury report, and no release lists who missed a game.',
    combine: 'Not published for college basketball: the NCAA holds no draft or combine.',
    net: "Not available: no release holds the NET, stats.ncaa.org refuses a plain client, and ncaa.com's NET page holds only the latest ranking.",
    quadrants:
      'Not available: quadrants need the NET of each opponent on each game day, which no source publishes.',
    polls: 'Not available: no release holds the polls.',
    seeds: "Not available: no release holds the NCAA tournament committee's seeds."
  },
  // ESPN's ids are the keys, stats.ncaa.org's games and players linked to them (D40).
  identity: 'college',
  // ESPN's box scores for the counts, stats.ncaa.org's splits and possessions beside them (D40).
  derived: 'college',
  // SportsDataverse's team ratings, box-score BPM and RAPM, under its name (D44).
  published: 'college',
  // stats.ncaa.org's located shots, lineups, stints and possessions, ESPN's shots and officials (D40).
  plays: 'college',
  // Who was on the floor: stats.ncaa.org's lineup file, the play-credited units beside it (T1302.7).
  onCourtFrom: COLLEGE_ON_COURT_FROM,
  // The college lane is 12 feet wide, for men and women alike (the NBA's is 16).
  laneHalfWidth: 60,
  // Who was on the floor, from stats.ncaa.org's lineup file, and how much of the game it covers.
  onCourtNote: COLLEGE_ON_COURT_NOTE,
  // The rule for both across D39's seasons (D38): "22 feet, 1¾ inches on the perimeter and 21 feet, 7⅞
  // inches in the corners" (the women's playing rules, `w_basketball_RB_PlayingRules.txt` line
  // 427-428; the men's rules history, line 1299-1300), FIBA's 6.75 and 6.6 metres. The court is drawn
  // to it. A college shot's value and zone are the file's own `point_value`, never this line
  // (`zoneSql` reads the value first; every shot has one): its charted corner threes scatter inside
  // the corner line on 1.0 to 1.7 % (T1302.6, `ncaa-data-sources.md`, "Shots").
  threePointLines: [{ from: NCAA_FIRST_SEASON, arc: 221.5, corner: 216.5 }],
  // Within the window, stats.ncaa.org's lineups and located shots and ESPN's standings cover every
  // season (D39, D40).
  lineupsFrom: NCAA_FIRST_SEASON,
  standingsFrom: NCAA_FIRST_SEASON,
  shotsFrom: NCAA_FIRST_SEASON,
  shotsLocatedFrom: NCAA_FIRST_SEASON,
  metricsByDefault: false,
  models: null,
  catalogueWords: COLLEGE_WORDS
})

/**
 * The size of a first load as T1302.3 measured it on 2026-11-18 (ncaa-data-sources.md, "The first
 * load, measured"): the files of 2021-22 on without ESPN's play by play, and the stats file of their
 * source tables, built tables to come. A load asks D22's 6 GB free, as the NBA's, and counts as done
 * past 3 GB.
 */
const collegeSize = (downloadBytes: number, fileBytes: number): League['size'] => ({
  downloadBytes,
  fileBytes,
  roomBytes: 6 * GB,
  loadedBytes: 3 * GB
})

/**
 * The NCAA's minimums for its rate categories as its champions show them (D43, added 2026-11-19): a
 * count per game played, with the 75 % games rule. Its policies leave them to the national office and
 * print none for a season; the men's record book prints "Min. 3 assists per game" on the season
 * assist-to-turnover record, and the career minimums in the same shape (4 field goals, 2.0 threes, 2.5
 * free throws made per game). Measured on the record books' champions of 2021-22 to 2025-26: 5 field
 * goals and 2.5 free throws made and 3 assists a game played name every champion of both leagues, and
 * threes made per game 2.5 for the men and 2.0 for the women (Boston University's Alex Giannaros: 50 in
 * 25 games, 2.00), except where the leader plays for a school reclassifying to Division I, which the
 * NCAA lists and does not rank (`ncaa-data-sources.md`).
 */
const collegeMinimums = (threes: number): NonNullable<League['madePerGame']> => ({
  note: "the NCAA's minimums as its champions show them",
  minimums: {
    fg_pct: { count: 'fgm', perGame: 5 },
    fg3_pct: { count: 'fg3m', perGame: threes },
    ft_pct: { count: 'ftm', perGame: 2.5 },
    ast_tov: { count: 'ast', perGame: 3 }
  }
})

const NCAAM: League = college({
  id: 'ncaam',
  name: 'NCAA Men',
  fullName: "NCAA Division I Men's Basketball",
  // Two 20-minute halves (D38).
  periods: [{ from: NCAA_FIRST_SEASON, periods: 2, minutes: 20, name: 'half' }],
  // The men's postseason events of D45's window: the NCAA tournament (as `playoffs`), the NIT, CBI
  // (2021-22 to 2024-25), CIT (2023-24), The Basketball Classic (2021-22) and the College Basketball
  // Crown (2024-25 on).
  // Then the exhibitions stats.ncaa.org lists, before opening day (D45, added 2026-11-18).
  seasonTypes: ['regular', 'playoffs', 'nit', 'cbi', 'cit', 'tbc', 'crown', 'preseason'],
  releases: {
    prefixes: ['espn_mens_college_basketball_', 'ncaa_mbb_', 'mbb_'],
    registry: 'SOURCES_BY_LEAGUE.ncaam in src/main/stats/sources.ts',
    reference: 'docs/reference/ncaa-data-sources.md'
  },
  size: collegeSize(803_921_971, 3_632_803_840),
  noData: "No NCAA men's stats yet: turn NCAA Men on in the Data panel to download them.",
  notBuilt: "No NCAA men's stats yet: the first load has not got that far.",
  madePerGame: collegeMinimums(2.5)
})

const NCAAW: League = college({
  id: 'ncaaw',
  name: 'NCAA Women',
  fullName: "NCAA Division I Women's Basketball",
  // Four 10-minute quarters (D38), the women's game since 2015-16.
  periods: [{ from: NCAA_FIRST_SEASON, periods: 4, minutes: 10, name: 'quarter' }],
  // The women's postseason events of D45's window: the NCAA tournament (as `playoffs`), the WNIT, the
  // WBI (2021-22, 2022-23) and the WBIT (2023-24 on).
  seasonTypes: ['regular', 'playoffs', 'wnit', 'wbi', 'wbit', 'preseason'],
  releases: {
    prefixes: ['espn_womens_college_basketball_', 'ncaa_wbb_', 'wbb_'],
    registry: 'SOURCES_BY_LEAGUE.ncaaw in src/main/stats/sources.ts',
    reference: 'docs/reference/ncaa-data-sources.md'
  },
  size: collegeSize(752_895_003, 3_407_097_856),
  noData: "No NCAA women's stats yet: turn NCAA Women on in the Data panel to download them.",
  notBuilt: "No NCAA women's stats yet: the first load has not got that far.",
  madePerGame: collegeMinimums(2.0)
})

/**
 * Every league by id. The NBA and the WNBA are typed with their recipes and models named, so code that
 * names one reads them without a check; a league read by id may have none (`modelsOf`).
 */
export const LEAGUES: {
  readonly nba: BuiltLeague
  readonly wnba: BuiltLeague
  readonly ncaam: League
  readonly ncaaw: League
} = { nba: NBA, wnba: WNBA, ncaam: NCAAM, ncaaw: NCAAW }

/**
 * A league's models; throws for a league with none fitted, which only a step `builds` lists may ask
 * for (the college leagues list none until T1302.8).
 */
export function modelsOf(league: League): LeagueModels {
  if (league.models === null) throw new Error(`the ${league.name} has no ratings or models yet`)
  return league.models
}

/** A league's recipe of a kind; throws for one with none named yet, as `modelsOf`. */
export function recipeOf<K extends 'identity' | 'derived' | 'published' | 'plays'>(
  league: League,
  kind: K
): NonNullable<League[K]> {
  const name = league[kind]
  if (name === null) throw new Error(`the ${league.name} has no ${kind} recipe yet`)
  return name as NonNullable<League[K]>
}

/** "75 %": a share games rule as the screens write it; null for a scaled one. */
export const gamesShareWords = (league: League): string | null =>
  league.gamesRule.kind === 'share' ? `${Math.round(league.gamesRule.share * 100)} %` : null

/** "the playoffs", or the league's own name for them: "the NCAA tournament". */
export const playoffsWords = (league: League): string =>
  league.typeNames.playoffs ? `the ${league.typeNames.playoffs}` : 'the playoffs'

/**
 * The games a row needs to qualify for a per-game leader (`GamesRule`), given the team games it covers
 * and the catalogue's count over `minimumsGames`: 58 of 82 is 31 of a 44-game season, scaled and
 * rounded as the engine rounds it; 75 percent of 31 is 24, rounded up.
 */
export function gamesToQualifyIn(league: League, teamGames: number, minimum: number): number {
  // Rounded to three places before rounding up, as the engine's SQL, so 0.75 × 32 stays 24.
  const rule = league.gamesRule
  if (rule.kind === 'share') return Math.ceil(Number((teamGames * rule.share).toFixed(3)))
  return Math.round((teamGames * minimum) / league.minimumsGames)
}

export const isLeagueId = (value: unknown): value is LeagueId =>
  typeof value === 'string' && (LEAGUE_IDS as readonly string[]).includes(value)

/** The registry's entry; throws on an id it does not know, so a bad IPC argument fails loudly. */
export function leagueOf(id: LeagueId): League {
  if (!isLeagueId(id)) throw new Error(`unknown league "${String(id)}"`)
  return LEAGUES[id]
}

/** Whether a league's refresh builds these tables. */
export const builds = (league: League, tables: BuiltTables): boolean =>
  league.builds.includes(tables)

/**
 * Whether the league's plays step builds the tables of its play by play (the plays, splits and
 * play-derived counts), not only its shots, on-court units and officials (`League.playTables`).
 */
export const buildsPlayTables = (league: League): boolean =>
  builds(league, 'plays') && league.playTables !== false

/** The NBA's lane, `COURT.laneHalfWidth` in `stats/shots.ts`, kept here so the registry needs no import. */
const NBA_LANE_HALF_WIDTH = 80

/** Half the lane's width in the shot charts' frame: the league's, else the NBA's 16 feet. */
export const laneHalfWidthOf = (league: League | undefined): number =>
  league?.laneHalfWidth ?? NBA_LANE_HALF_WIDTH

/** The playoff format of a season: the era it falls in, the first era before any. */
export function playoffEraIn(league: League, season: number): PlayoffEra {
  const { playoffs } = modelsOf(league)
  let era = playoffs[0]
  for (const e of playoffs) if (season >= e.from) era = e
  return era
}

/** A regular season's games a team, by the season's era. */
export function seasonGamesIn(league: League, season: number): number {
  const { seasonGames } = modelsOf(league)
  let length = seasonGames[0]
  for (const l of seasonGames) if (season >= l.from) length = l
  return length.games
}

/** The games VORP scales a season to: the league's fixed number, or the season's length. */
export const vorpGamesIn = (league: League, season: number): number =>
  vorpScale(modelsOf(league).vorpGames, league, season)

const vorpScale = (games: number | 'season', league: League, season: number): number =>
  games === 'season' ? seasonGamesIn(league, season) : games

/** The three-point line in a season: the era it falls in. */
export function threePointLineIn(league: League, season: number): ThreePointLine {
  let line = league.threePointLines[0]
  for (const l of league.threePointLines) if (season >= l.from) line = l
  return line
}

/** SQL: a field of the three-point line in the season `seasonSql` names, a CASE where it changed. */
export function threePointLineSql(
  league: League,
  seasonSql: string,
  field: 'arc' | 'corner'
): string {
  const lines = league.threePointLines
  if (lines.length === 1) return String(lines[0][field])
  const whens = [...lines]
    .reverse()
    .slice(0, -1)
    .map((l) => `WHEN ${seasonSql} >= ${l.from} THEN ${l[field]}`)
    .join(' ')
  return `(CASE ${whens} ELSE ${lines[0][field]} END)`
}

/** "2025-26" in the NBA, "2026" in the WNBA. */
export const seasonLabel = (league: League, season: number): string => league.seasonLabel(season)

/** The game's format in a season: the era it falls in. */
export function periodsIn(league: League, season: number): PeriodEra {
  let era = league.periods[0]
  for (const e of league.periods) if (season >= e.from) era = e
  return era
}

/**
 * What a split's note adds when some of the seasons were played in halves (the WNBA's to 2005): the
 * 4th quarter's rules read the second half there (`SplitDef.halves`). Null when none were.
 */
export function halvesNote(league: League, seasons: readonly number[]): string | null {
  const halves = league.periods.filter((e) => e.name === 'half')
  // A league in halves every season (the NCAA men) words its rules by the half (`splitRuleIn`).
  if (halves.length === league.periods.length) return null
  if (!seasons.some((s) => periodsIn(league, s).name === 'half')) return null
  const next = league.periods.find((e) => e.from > halves[halves.length - 1].from)
  const until = next ? ` to ${league.seasonLabel(next.from - 1)}` : ''
  return `Games${until} were in two halves: the 4th quarter's rules read the second half.`
}

/**
 * When a season's last month is over, as an instant: the first day of the month after `seasonMonths.last`
 * in the year of its label. Both leagues label a season by the year it ends in (the NBA's `2026` ends
 * in June 2026, the WNBA's in October 2026), so the label's year is the year of the last month.
 */
export function seasonEnd(league: League, season: number): Date {
  return new Date(Date.UTC(season, league.seasonMonths.last, 1))
}

/** Whether a date is inside the league's season months. */
export function inSeason(league: League, now: Date): boolean {
  const month = now.getUTCMonth() + 1
  const { first, last } = league.seasonMonths
  return first <= last ? month >= first && month <= last : month >= first || month <= last
}

/** Seconds from the tip-off at the end of `period` with `clock` seconds left in it. */
export function elapsedSeconds(
  league: League,
  season: number,
  period: number,
  clock: number
): number {
  const era = periodsIn(league, season)
  const regulation = era.minutes * 60
  const overtime = league.overtimeMinutes * 60
  if (period <= era.periods) return (period - 1) * regulation + regulation - clock
  return era.periods * regulation + (period - era.periods - 1) * overtime + overtime - clock
}

/** Seconds from the tip-off when `period` starts. */
export function periodStartSeconds(league: League, season: number, period: number): number {
  const era = periodsIn(league, season)
  const regulation = era.minutes * 60
  if (period <= era.periods) return (period - 1) * regulation
  return era.periods * regulation + (period - era.periods - 1) * league.overtimeMinutes * 60
}

/** A game's whole length in seconds, with `lastPeriod` periods played. */
export function gameSeconds(league: League, season: number, lastPeriod: number): number {
  const era = periodsIn(league, season)
  const regulation = era.periods * era.minutes * 60
  return regulation + Math.max(0, lastPeriod - era.periods) * league.overtimeMinutes * 60
}

/**
 * SQL for one era's expression, or a CASE over `seasonSql` when the league changed format. A league with
 * one era writes the same SQL as before leagues, so its queries are unchanged.
 */
function byEra(league: League, seasonSql: string, sql: (era: PeriodEra) => string): string {
  if (league.periods.length === 1) return sql(league.periods[0])
  const eras = [...league.periods].reverse()
  const whens = eras
    .slice(0, -1)
    .map((e) => `WHEN ${seasonSql} >= ${e.from} THEN ${sql(e)}`)
    .join(' ')
  return `(CASE ${whens} ELSE ${sql(eras[eras.length - 1])} END)`
}

/** SQL: seconds since the tip-off at `clock` seconds left in `period`, as `elapsedSeconds`. */
export function elapsedSql(
  league: League,
  seasonSql: string,
  period: string,
  clock: string
): string {
  const ot = league.overtimeMinutes * 60
  return byEra(league, seasonSql, (e) => {
    const q = e.minutes * 60
    return `CASE WHEN ${period} <= ${e.periods} THEN (${period} - 1) * ${q} + ${q} - ${clock}
        ELSE ${e.periods * q} + (${period} - ${e.periods + 1}) * ${ot} + ${ot} - ${clock} END`
  })
}

/** SQL: seconds since the tip-off when `period` starts, as `periodStartSeconds`. */
export function periodStartSql(league: League, seasonSql: string, period: string): string {
  const ot = league.overtimeMinutes * 60
  return byEra(league, seasonSql, (e) => {
    const q = e.minutes * 60
    return `CASE WHEN ${period} <= ${e.periods} THEN (${period} - 1) * ${q} ELSE ${e.periods * q} + (${period} - ${e.periods + 1}) * ${ot} END`
  })
}

/** SQL: the periods in regulation in the season `seasonSql` names: 2 halves or 4 quarters. */
export function regulationPeriodsSql(league: League, seasonSql: string): string {
  return byEra(league, seasonSql, (e) => String(e.periods))
}

/** SQL: a period's length in seconds, regulation or overtime. */
export function periodLengthSql(league: League, seasonSql: string, period: string): string {
  return byEra(
    league,
    seasonSql,
    (e) =>
      `CASE WHEN ${period} <= ${e.periods} THEN ${e.minutes * 60}.0 ELSE ${league.overtimeMinutes * 60}.0 END`
  )
}
