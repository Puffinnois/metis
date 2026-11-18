import type { GameType } from './stats/types'

/**
 * The league registry (D34 to D36): the one place a league's facts live. Everything that differs
 * between leagues is read from here, and the league reaches every part of the app as context: the
 * worker is started for one, the engine, the catalogue and the builders are handed its entry, and every
 * IPC call names it. No code outside this file branches on a league's id.
 * `docs/reference/stats-database.md`, "Leagues", describes the mechanism.
 */
export const LEAGUE_IDS = ['nba', 'wnba'] as const
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
 * The identity recipes, named for the sources they read: the NBA's schedule, or the WNBA's schedule
 * and game logs.
 */
export type IdentityRecipeName = 'nba' | 'wnba'

/**
 * The game and season table recipes, named for the box scores they read: the NBA's box scores, or the
 * WNBA's game logs and 2026 box scores.
 */
export type DerivedRecipeName = 'nba' | 'wnba'

/**
 * The published table recipes, named for the files they read: the NBA's, or the WNBA's (its impact
 * file under its own name, and the 2026 Portland Fire's key). `PUBLISHED_RECIPES` in
 * `src/main/stats/derived/published.ts`.
 */
export type PublishedRecipeName = 'nba' | 'wnba'

/**
 * The play table recipes, named for the play by play, shots, possessions and lineups they read: the
 * NBA's files or the WNBA's (`PLAYS_RECIPES` in `src/main/stats/derived/playsRecipe.ts`).
 */
export type PlaysRecipeName = 'nba' | 'wnba'

/** Families of stats a league's releases may not publish at all (`League.unpublished`). */
export type UnpublishedFamily =
  'tracking' | 'hustle' | 'play_types' | 'matchups' | 'availability' | 'combine'

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
   * Cities whose games all went without home court, a season played at one site that no source marks
   * neutral: the NBA's 2020 restart, the WNBA's 2020 season.
   */
  neutralCities: readonly string[]
  /** The playoff format by season, oldest first (`playoffEraIn`). */
  playoffs: readonly PlayoffEra[]
  /** Why Metis's Box Plus/Minus (and VORP after it) is not shown for the league; null when it is. */
  bpmUnavailable: string | null
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
   * The recipe that builds its `game`, `team` and `player` tables, named for the sources it reads
   * (`IDENTITY_RECIPES` in `src/main/stats/identity.ts`). The shared SQL stays shared; only what
   * differs between the leagues' sources is written per recipe.
   */
  identity: IdentityRecipeName
  /**
   * The recipe that builds its `player_game` and `team_game` (`DERIVED_RECIPES` in
   * `src/main/stats/derived/build.ts`): which box scores it reads. The season tables after them, and
   * the SQL the recipes share, are one for every league.
   */
  derived: DerivedRecipeName
  /** The recipe that builds its published tables (`PUBLISHED_RECIPES`). */
  published: PublishedRecipeName
  /** The recipe that builds its play, shot, split and on-court tables (`PLAYS_RECIPES`). */
  plays: PlaysRecipeName
  /** The three-point line by era, oldest first (`threePointLineIn`). */
  threePointLines: readonly ThreePointLine[]
  /** The first season of the league's published five-player units (the lineup dashboards). */
  lineupsFrom: number
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
  /** Constants and fitted values of its ratings and models (Plan T1301.8). */
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

const NBA: League = {
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
  firstSeason: 1994,
  minimumsGames: 82,
  minimumsMinutes: 48,
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
    // The 2020 restart near Orlando, which ESPN does not mark neutral.
    neutralCities: ['Lake Buena Vista'],
    playoffs: [NBA_1994, NBA_2003, NBA_2005, NBA_2007, NBA_2014, NBA_2016, NBA_2020, NBA_2021],
    bpmUnavailable: null
  }
}

/**
 * Facts from `docs/reference/wnba-data-sources.md` (T1301.1). Its qualifying rule is provisional (D37):
 * the NBA's minimums scaled to the team games in scope over the NBA's 82, so 58 games of 82 asks 24 of
 * a 34-game season and 31 of a 44-game one, and a minimum in minutes scales by 40 over 48, until the
 * owner reads the league's own rule.
 */
const WNBA: League = {
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
  firstSeason: 1997,
  minimumsGames: 82,
  minimumsMinutes: 48,
  minimumsNote: "scaled, until the WNBA's own are read",
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
  // tables and its plays (T1301.7) are built; the models come with T1301.8.
  builds: ['identity', 'derived', 'published', 'plays'],
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
  notBuilt: 'No WNBA stats yet: the first load has not got that far.',
  metricsByDefault: false,
  models: {
    // Refitted on the WNBA's own seasons (wnba-agreement.md, "Elo").
    elo: {
      start: 1500,
      mean: 1505,
      newTeam: 1300,
      k: 20,
      homeCourt: 80,
      carry: 0.65,
      perPoint: 28,
      firstSeason: 1999
    },
    eloGameTypes: ['regular', 'playoffs', 'cup-final'],
    marginSd: 12.4,
    forecastFirstSeason: 1999,
    ridgePossessions: 250,
    pythagoreanExponent: 14,
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
    // The 2020 season at IMG Academy, which ESPN does not mark neutral.
    neutralCities: ['Bradenton'],
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
    bpmUnavailable: null
  }
}

export const LEAGUES: Readonly<Record<LeagueId, League>> = { nba: NBA, wnba: WNBA }

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

/** The playoff format of a season: the era it falls in, the first era before any. */
export function playoffEraIn(league: League, season: number): PlayoffEra {
  let era = league.models.playoffs[0]
  for (const e of league.models.playoffs) if (season >= e.from) era = e
  return era
}

/** A regular season's games a team, by the season's era. */
export function seasonGamesIn(league: League, season: number): number {
  let length = league.models.seasonGames[0]
  for (const l of league.models.seasonGames) if (season >= l.from) length = l
  return length.games
}

/** The games VORP scales a season to: the league's fixed number, or the season's length. */
export const vorpGamesIn = (league: League, season: number): number =>
  league.models.vorpGames === 'season' ? seasonGamesIn(league, season) : league.models.vorpGames

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
