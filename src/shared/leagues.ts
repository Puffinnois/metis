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
}

const MB = 1024 ** 2
const GB = 1024 ** 3

const finalYear = (season: number): string =>
  `${season - 1}-${String(season % 100).padStart(2, '0')}`

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
  identity: 'nba',
  derived: 'nba',
  published: 'nba',
  plays: 'nba',
  // 22 feet in the corners, an arc of 23 feet 9 inches (`COURT` in `stats/shots.ts`), every season.
  threePointLines: [{ from: 1994, arc: 237.5, corner: 220 }],
  // Five-man units are published from 2007-08.
  lineupsFrom: 2008,
  notBuilt: 'No NBA stats yet: the first load has not got that far.',
  metricsByDefault: true
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
  metricsByDefault: false
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
