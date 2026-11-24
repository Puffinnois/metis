/**
 * Every file Metis loads from the sportsdataverse-data releases. The file names follow a rule, so
 * the app generates them and never lists a release: GitHub's API allows 60 anonymous calls an hour.
 * `scripts/inventory-sources.mjs` lists the releases at development time, and a test compares that
 * list with this one. The one exception is FiveThirtyEight's RAPTOR (D54): four CSV files read from
 * its own repository by their address (`SourceFile.url`), once.
 */
import { LEAGUES, pairOf, type LeagueId } from '@shared/leagues'

export const RELEASES_URL =
  'https://github.com/sportsdataverse/sportsdataverse-data/releases/download'

/**
 * FiveThirtyEight's archived RAPTOR files (D54): CC BY 4.0, no longer updated since 2021-22. Read
 * from GitHub's raw file host, the address its repository's own links give.
 */
export const RAPTOR_URL = 'https://raw.githubusercontent.com/fivethirtyeight/data/master/nba-raptor'
/** The release name the RAPTOR files are listed and left out under; not a SportsDataverse tag. */
export const RAPTOR_RELEASE = 'fivethirtyeight_nba_raptor'

/** The first load runs in this order (D21), so the app is usable long before the last file. */
export const LOAD_TIERS = ['core', 'published', 'events', 'plays'] as const
export type LoadTier = (typeof LOAD_TIERS)[number]

export interface SourceFile {
  /** `<id>` in `source_state`, `stats:<id>:<season>` in `sync_log`. */
  id: string
  table: string
  release: string
  /** The file's name without its season and extension. */
  stem: string
  tier: LoadTier
  /** What one row is, as measured. */
  grain: string
  /** Bump to fetch sealed seasons again after a change to how the source is stored. */
  version: number
  firstSeason: number
  /** One file holding every season, fetched as season 0. */
  allSeasons: boolean
  /** The table holds several files of a season, so its rows carry `source_file`. */
  shared: boolean
  /**
   * The league's game, team and player keys are built from it, so its release can never be left out
   * (`requiredReleases`). The NBA's are read from what its builders need; a league whose builders do
   * not exist yet names them here. Absent means no.
   */
  keys?: boolean
  /**
   * A file of every season keeps only its rows from this season on, read from its `season` column; a
   * file with no such column is kept whole. The college leagues start at 2021-22 (D39), and their
   * schedule masters hold every season from 2002-03. Absent: every row.
   */
  fromSeason?: number
  /** `season` is published as text, `2025-26`, and read as its final year, `2026` (`seasonSql`). */
  seasonSpan?: boolean
  /**
   * Its rows are inserted in the file's order, so `rowid` follows it: stats.ncaa.org's play by play
   * has no play number, and a play's place among those of the same second is its row's (T1302.7).
   * Loaded in parallel, the rows of two of the file's row groups could swap from one load to the next
   * (T1302.9). Absent: any order.
   */
  ordered?: boolean
  /**
   * The file's own address, for a source that is not a SportsDataverse release (D54). Absent: the
   * release's file by the naming rule (`fileUrl`).
   */
  url?: string
  /** The file is a CSV with a header row, read with every row scanned for its types. Absent: Parquet. */
  format?: 'csv'
  /**
   * Fetched once and sealed: the publisher stopped updating it, so a refresh asks for it again only
   * when Metis holds no copy, or a new `version` asks for it to be read again (D54).
   */
  once?: boolean
}

type Options = Partial<
  Pick<SourceFile, 'allSeasons' | 'shared' | 'id' | 'keys' | 'fromSeason' | 'seasonSpan'>
>

function source(
  table: string,
  release: string,
  stem: string,
  tier: LoadTier,
  grain: string,
  firstSeason: number,
  options: Options = {}
): SourceFile {
  return {
    id: table.slice('src_'.length),
    table,
    release,
    stem,
    tier,
    grain,
    version: 1,
    firstSeason,
    allSeasons: false,
    shared: false,
    ...options
  }
}

const allSeasons = { allSeasons: true }

const espn = (
  name: string,
  stem: string,
  tier: LoadTier,
  grain: string,
  firstSeason: number,
  release = name
): SourceFile => source(`src_espn_${name}`, `espn_nba_${release}`, stem, tier, grain, firstSeason)

const nba = (
  name: string,
  stem: string,
  tier: LoadTier,
  grain: string,
  firstSeason: number,
  release = name
): SourceFile => source(`src_nba_${name}`, `nba_stats_${release}`, stem, tier, grain, firstSeason)

const ESPN: SourceFile[] = [
  espn('schedule', 'nba_schedule', 'core', 'game', 1994, 'schedules'),
  source(
    'src_espn_schedule_master',
    'espn_nba_schedules',
    'nba_schedule_master',
    'core',
    'game',
    1994,
    allSeasons
  ),
  source(
    'src_espn_games_in_repo',
    'espn_nba_schedules',
    'nba_games_in_data_repo',
    'core',
    'game',
    1994,
    allSeasons
  ),
  espn('player_box', 'player_box', 'core', 'player-game', 1994, 'player_boxscores'),
  espn('team_box', 'team_box', 'core', 'team-game', 1994, 'team_boxscores'),
  espn('player_core', 'player_core', 'core', 'player-season', 1994),
  espn(
    'player_season',
    'player_season_stats',
    'core',
    'player-season-stat',
    1994,
    'player_season_stats'
  ),
  espn('team_season', 'team_season_stats', 'core', 'team-season-stat', 2002, 'team_season_stats'),
  espn('game_rosters', 'game_rosters', 'core', 'player-game', 2002),
  espn('standings', 'standings', 'core', 'team-season-stat', 2002),
  espn('officials', 'officials', 'core', 'official-game', 2002),
  espn('draft', 'draft', 'core', 'pick', 2003),
  espn('rosters', 'rosters', 'core', 'player-team', 2025),
  espn('injuries', 'injuries', 'core', 'player-report', 2027),
  espn('depth_charts', 'depthcharts', 'core', 'player-slot', 2027, 'depthcharts'),
  espn('shots', 'shots', 'events', 'shot', 2002),
  espn('pbp', 'play_by_play', 'plays', 'play', 2002)
]

const NBA: SourceFile[] = [
  nba('schedule', 'nba_schedule', 'core', 'game', 1997, 'schedules'),
  nba('player_box', 'player_boxscores', 'core', 'player-game', 1997, 'player_boxscores'),
  nba('team_box', 'team_boxscores', 'core', 'team-game', 1997, 'team_boxscores'),
  // Published as player game logs, but measured to hold team rows.
  nba('team_game_logs', 'player_game_logs', 'core', 'team-game', 1997, 'player_game_logs'),
  nba('game_rosters', 'game_rosters', 'core', 'player-game', 1997),
  nba(
    'player_season',
    'player_season_stats',
    'core',
    'player-season-measure',
    1997,
    'player_season_stats'
  ),
  nba('team_season', 'team_season_stats', 'core', 'team-season-measure', 1997, 'team_season_stats'),
  nba('rosters', 'rosters', 'core', 'player-team', 1997),
  nba('standings', 'standings', 'core', 'team-season', 1997),
  nba('coaches', 'coaches', 'core', 'coach-team', 1997),
  nba('officials', 'officials', 'core', 'official-game', 1997),
  nba('draft', 'draft', 'core', 'pick', 1997),
  nba('injury_report', 'injury_report', 'core', 'player-report', 2019),
  source(
    'src_nba_impact',
    'nba_player_impact',
    'nba_player_impact',
    'published',
    'player-season-type',
    1997
  ),
  // SportsDataverse's weekly current impact (T1703.2): one row per player per as-of date, 2006-07 on.
  source(
    'src_nba_current_impact',
    'nba_current_impact',
    'nba_current_impact',
    'published',
    'player-asof',
    2007
  ),
  nba('metric_curves', 'metric_curves', 'published', 'entity-metric-bin', 1997),
  nba('rolling_windows', 'rolling_windows', 'published', 'entity-metric-window', 1997),
  nba('combine_stats', 'draftcombinestats', 'published', 'player', 2001, 'draft_combine'),
  nba('combine_drills', 'draftcombinedrillresults', 'published', 'player', 2001, 'draft_combine'),
  nba('combine_anthro', 'draftcombineplayeranthro', 'published', 'player', 2001, 'draft_combine'),
  nba('combine_spot_up', 'draftcombinespotshooting', 'published', 'player', 2001, 'draft_combine'),
  nba(
    'combine_on_the_move',
    'draftcombinenonstationaryshooting',
    'published',
    'player',
    2001,
    'draft_combine'
  ),
  nba('shots', 'shots', 'events', 'shot', 1997),
  nba('possessions', 'nba_possessions', 'events', 'possession', 1997, 'possessions'),
  nba('game_lineups', 'nba_lineups', 'events', 'play', 1997, 'game_lineups'),
  nba('lineups', 'lineups', 'events', 'lineup-season-measure', 2008),
  nba('game_matchups', 'game_matchups', 'events', 'matchup-game', 2018),
  nba('pbp', 'nba_play_by_play', 'plays', 'play', 1997, 'pbp')
]

/** Each family in the league dashboards is its own table: their columns differ. */
function dashboard(stem: string, grain: string, firstSeason: number): SourceFile {
  return source(`src_dash_${stem}`, 'nba_stats_leaguedash', stem, 'published', grain, firstSeason)
}

/**
 * `player_master`, `team_master` and `lineups_master` are not loaded (D23). They join the families
 * below into one wide file, and every column was measured to match, with no differences, so they add
 * 138 MB and nothing else. At up to 625 columns they are also what a checkpoint struggles with most.
 */
const LINEUP_MEASURES = ['advanced', 'base', 'fourfactors', 'misc', 'opponent', 'scoring']
const PLAYER_MEASURES = ['advanced', 'base', 'defense', 'misc', 'scoring', 'usage']
const TEAM_MEASURES = ['advanced', 'base', 'defense', 'fourfactors', 'misc', 'opponent', 'scoring']
/** Tracking began in 2013-14; these two files go back further, whatever they hold (Plan T406). */
const TRACKING_FROM_1997 = ['catchshoot', 'pullupshot']
const TRACKING_FROM_2014 = [
  'defense',
  'drives',
  'efficiency',
  'elbowtouch',
  'painttouch',
  'passing',
  'possessions',
  'posttouch',
  'rebounding',
  'speeddistance'
]

const DASHBOARDS: SourceFile[] = [
  ...LINEUP_MEASURES.map((m) => dashboard(`lineups_${m}`, 'lineup-season-type', 2008)),
  ...PLAYER_MEASURES.map((m) => dashboard(`player_stats_${m}`, 'player-season-type', 1997)),
  ...TEAM_MEASURES.map((m) => dashboard(`team_stats_${m}`, 'team-season-type', 1997)),
  ...TRACKING_FROM_1997.map((m) => dashboard(`player_tracking_${m}`, 'player-season-type', 1997)),
  ...TRACKING_FROM_2014.map((m) => dashboard(`player_tracking_${m}`, 'player-season-type', 2014)),
  dashboard('player_bio', 'player-season-type', 1997),
  dashboard('standings', 'team-season', 1996)
]

/** Several files of one season in one table: `suffix` tells them apart. */
function sharedTable(
  table: string,
  release: string,
  prefix: string,
  suffixes: string[],
  grain: string,
  firstSeason: number
): SourceFile[] {
  return suffixes.map((suffix) =>
    source(table, release, `${prefix}${suffix}`, 'published', grain, firstSeason, {
      shared: true,
      id: `${table.slice('src_'.length)}/${suffix}`
    })
  )
}

const MODES = ['pergame', 'totals']
const SEASON_TYPES = ['regular-season', 'playoffs']
const cross = (left: string[], right: string[]): string[] =>
  left.flatMap((l) => right.map((r) => `${l}_${r}`))

const OFFENSE_ONLY = ['cut', 'misc', 'offrebound', 'transition']
const BOTH_SIDES = [
  'handoff',
  'isolation',
  'offscreen',
  'postup',
  'prballhandler',
  'prrollman',
  'spotup'
]
const PLAY_TYPE_FILES = [
  ...cross(OFFENSE_ONLY, ['offensive']),
  ...cross(BOTH_SIDES, ['offensive', 'defensive'])
]

const SHARED: SourceFile[] = [
  ...sharedTable(
    'src_nba_play_types',
    'nba_stats_synergy',
    '',
    cross(SEASON_TYPES, cross(PLAY_TYPE_FILES, MODES)),
    'player-type-side-mode',
    2016
  ),
  ...sharedTable(
    'src_nba_hustle_player',
    'nba_stats_hustle',
    'leaguehustlestatsplayer_',
    cross(SEASON_TYPES, MODES),
    'player-type-mode',
    2016
  ),
  ...sharedTable(
    'src_nba_hustle_team',
    'nba_stats_hustle',
    'leaguehustlestatsteam_',
    cross(SEASON_TYPES, MODES),
    'team-type-mode',
    2016
  ),
  // Pair matchups are published for the regular season only.
  ...sharedTable(
    'src_nba_season_matchups',
    'nba_stats_matchups',
    'leagueseasonmatchups_',
    cross(['regular-season'], MODES),
    'pair-mode',
    2018
  ),
  ...sharedTable(
    'src_nba_matchup_rollups',
    'nba_stats_matchups',
    'matchupsrollup_',
    cross(SEASON_TYPES, MODES),
    'player-position-type-mode',
    2018
  )
]

const IDS: SourceFile[] = [
  source('src_xwalk_player', 'nba_crosswalk', 'nba_player_crosswalk', 'core', 'player-team', 2002),
  source('src_xwalk_team', 'nba_crosswalk', 'nba_team_crosswalk', 'core', 'team', 2002),
  source('src_xwalk_game', 'nba_crosswalk', 'nba_schedule_crosswalk', 'core', 'game', 2002),
  source('src_groups', 'nba_groups', 'nba_groups', 'core', 'group', 1971, allSeasons),
  source('src_group_aliases', 'nba_groups', 'nba_group_aliases', 'core', 'alias', 1971, allSeasons),
  source(
    'src_group_seasons',
    'nba_groups',
    'nba_group_seasons',
    'core',
    'group-season',
    1971,
    allSeasons
  ),
  source(
    'src_player_aliases',
    'nba_groups',
    'nba_player_aliases',
    'core',
    'alias',
    1971,
    allSeasons
  ),
  source('src_team_aliases', 'nba_groups', 'nba_team_aliases', 'core', 'alias', 1971, allSeasons),
  source('src_team_groups', 'nba_groups', 'nba_team_group_seasons', 'core', 'team-season', 1971),
  source(
    'src_team_groups_all',
    'nba_groups',
    'nba_team_group_seasons',
    'core',
    'team-season',
    1971,
    allSeasons
  )
]

const NBA_LABELS: Record<string, string> = {
  espn_nba_schedules: 'Schedules (ESPN)',
  espn_nba_player_boxscores: 'Player box scores (ESPN)',
  espn_nba_team_boxscores: 'Team box scores (ESPN)',
  espn_nba_player_core: 'Player details (ESPN)',
  espn_nba_player_season_stats: 'Player season stats (ESPN)',
  espn_nba_team_season_stats: 'Team season stats (ESPN)',
  espn_nba_game_rosters: 'Game rosters (ESPN)',
  espn_nba_standings: 'Standings (ESPN)',
  espn_nba_officials: 'Officials (ESPN)',
  espn_nba_draft: 'Draft (ESPN)',
  espn_nba_rosters: 'Rosters (ESPN)',
  espn_nba_injuries: 'Injuries (ESPN)',
  espn_nba_depthcharts: 'Depth charts (ESPN)',
  espn_nba_shots: 'Shots (ESPN)',
  espn_nba_pbp: 'Play by play (ESPN)',
  nba_stats_schedules: 'Schedules (NBA)',
  nba_stats_player_boxscores: 'Player box scores (NBA)',
  nba_stats_team_boxscores: 'Team box scores (NBA)',
  nba_stats_player_game_logs: 'Team game logs (NBA)',
  nba_stats_game_rosters: 'Game rosters (NBA)',
  nba_stats_player_season_stats: 'Player season stats (NBA)',
  nba_stats_team_season_stats: 'Team season stats (NBA)',
  nba_stats_rosters: 'Rosters (NBA)',
  nba_stats_standings: 'Standings (NBA)',
  nba_stats_coaches: 'Coaches (NBA)',
  nba_stats_officials: 'Officials (NBA)',
  nba_stats_draft: 'Draft (NBA)',
  nba_stats_injury_report: 'Injury reports (NBA)',
  nba_stats_draft_combine: 'Draft combine (NBA)',
  nba_stats_leaguedash: 'League dashboards and tracking (NBA)',
  nba_stats_synergy: 'Play types (NBA)',
  nba_stats_hustle: 'Hustle (NBA)',
  nba_stats_matchups: 'Season matchups (NBA)',
  nba_stats_lineups: 'Lineups (NBA)',
  nba_stats_game_matchups: 'Game matchups (NBA)',
  nba_stats_shots: 'Shots (NBA)',
  nba_stats_pbp: 'Play by play (NBA)',
  nba_player_impact: 'Impact models (SportsDataverse)',
  nba_current_impact: 'Current impact (SportsDataverse)',
  nba_stats_metric_curves: 'Shooting by distance (SportsDataverse)',
  nba_stats_rolling_windows: 'Recent shooting (SportsDataverse)',
  nba_stats_possessions: 'Possessions (SportsDataverse)',
  nba_stats_game_lineups: 'Lineups on court (SportsDataverse)',
  nba_crosswalk: 'Id crosswalks (SportsDataverse)',
  nba_groups: 'Aliases and divisions (SportsDataverse)',
  [RAPTOR_RELEASE]: 'RAPTOR (FiveThirtyEight)'
}

/**
 * FiveThirtyEight's four RAPTOR files (D54), each a file of every season from 1976-77 to 2021-22, kept
 * from 1993-94 on, Metis's first season (D9). Every column as published, in tables of their own
 * (`nba-data-sources.md`, "RAPTOR"). The by-team files are what the published table reads, since their
 * rows add up to any scope; the by-player files are kept as published, and checked against it.
 */
const raptor = (name: string, stem: string, grain: string): SourceFile => ({
  ...source(`src_raptor_${name}`, RAPTOR_RELEASE, stem, 'published', grain, 1994, {
    allSeasons: true,
    fromSeason: 1994
  }),
  url: `${RAPTOR_URL}/${stem}.csv`,
  format: 'csv',
  once: true
})

const RAPTOR: SourceFile[] = [
  raptor('historical_player', 'historical_RAPTOR_by_player', 'player-season'),
  raptor('historical_team', 'historical_RAPTOR_by_team', 'player, season, season type and team'),
  raptor('modern_player', 'modern_RAPTOR_by_player', 'player-season'),
  raptor('modern_team', 'modern_RAPTOR_by_team', 'player, season, season type and team')
]

export const SOURCES: SourceFile[] = [...IDS, ...ESPN, ...NBA, ...DASHBOARDS, ...SHARED, ...RAPTOR]

/**
 * The WNBA's files, as `docs/reference/wnba-data-sources.md` measured them on 2026-11-17: 37 releases,
 * 1,586 Parquet files, of which 1,492 load. Tables carry no league column, since each league has its
 * own file (D36), so a table is named by its source as the NBA's are: `src_espn_*` for ESPN's,
 * `src_wnba_*` for the league's own stats site (the NBA's `src_nba_*`), `src_dash_*` for the league
 * dashboards, and the dataset's crosswalks and groups under the NBA's names. Left out (D23), each
 * proven to repeat other files in that document and again in `tests/main/stats/wnbaLoad.test.ts`:
 * - the 90 `*_master` files of the dashboards, which join their parts (as for the NBA);
 * - `wnba_stats_schedules/wnba_stats_schedule_<season>` (2025, 2026) and `…_master`: the game logs
 *   under a schedule's name, holding the same player and team rows;
 * - `wnba_stats_pbp/play_by_play_2026`: the same 149,921 plays as `wnba_play_by_play_2026`, with 25
 *   columns of its 38.
 * The game, team and player keys will be built from both schedules, the game logs, ESPN's player box
 * scores, the crosswalk and the groups (T1301.5), so those six releases are marked `keys`.
 */
const keys = { keys: true }
const wEspn = (
  name: string,
  stem: string,
  tier: LoadTier,
  grain: string,
  firstSeason: number,
  release = name,
  options: Options = {}
): SourceFile =>
  source(`src_espn_${name}`, `espn_wnba_${release}`, stem, tier, grain, firstSeason, options)

const wnba = (
  name: string,
  stem: string,
  tier: LoadTier,
  grain: string,
  firstSeason: number,
  release = name,
  options: Options = {}
): SourceFile =>
  source(`src_wnba_${name}`, `wnba_stats_${release}`, stem, tier, grain, firstSeason, options)

const WNBA_ESPN: SourceFile[] = [
  wEspn('schedule', 'wnba_schedule', 'core', 'game', 1997, 'schedules', keys),
  source(
    'src_espn_schedule_master',
    'espn_wnba_schedules',
    'wnba_schedule_master',
    'core',
    'game',
    1997,
    { ...allSeasons, ...keys }
  ),
  source(
    'src_espn_games_in_repo',
    'espn_wnba_schedules',
    'wnba_games_in_data_repo',
    'core',
    'game',
    1997,
    { ...allSeasons, ...keys }
  ),
  // 2002's lines are all zeros, as published; they load as they are (wnba-data-sources.md, "Traps").
  wEspn('player_box', 'player_box', 'core', 'player-game', 2002, 'player_boxscores', keys),
  wEspn('team_box', 'team_box', 'core', 'team-game', 2003, 'team_boxscores'),
  wEspn('player_core', 'player_core', 'core', 'player-season', 2002),
  wEspn(
    'player_season',
    'player_season_stats',
    'core',
    'player-season-stat',
    1997,
    'player_season_stats'
  ),
  wEspn('team_season', 'team_season_stats', 'core', 'team-season-stat', 1997, 'team_season_stats'),
  wEspn('game_rosters', 'game_rosters', 'core', 'player-game', 2002),
  wEspn('standings', 'standings', 'core', 'team-season-stat', 2002),
  wEspn('officials', 'officials', 'core', 'official-game', 2003),
  wEspn('draft', 'draft', 'core', 'pick', 2018),
  wEspn('rosters', 'rosters', 'core', 'player-team', 2024),
  wEspn('injuries', 'injuries', 'core', 'player-day', 2026),
  wEspn('shots', 'shots', 'events', 'shot', 2002),
  wEspn('pbp', 'play_by_play', 'plays', 'play', 2002)
]

const WNBA_STATS: SourceFile[] = [
  wnba('schedule', 'wnba_schedule', 'core', 'game', 1997, 'schedules', keys),
  // Player rows and team rows (`player_id` null on the team rows), every season.
  wnba(
    'game_logs',
    'player_game_logs',
    'core',
    'player-game and team-game',
    1997,
    'player_game_logs',
    keys
  ),
  // The only full 2026 player lines: the 2026 game logs hold players for 202 of 352 games.
  wnba('player_box', 'player_boxscores', 'core', 'player-game', 2026, 'player_boxscores'),
  wnba('team_box', 'team_boxscores', 'core', 'team-game', 2026, 'team_boxscores'),
  wnba(
    'player_season',
    'player_season_stats',
    'core',
    'player-season-measure',
    2026,
    'player_season_stats'
  ),
  wnba(
    'team_season',
    'team_season_stats',
    'core',
    'team-season-measure',
    2026,
    'team_season_stats'
  ),
  wnba('standings', 'standings', 'core', 'team-season', 2026),
  wnba('rosters', 'rosters', 'core', 'player-team', 1997),
  wnba('game_rosters', 'game_rosters', 'core', 'player-game', 1997),
  wnba('draft', 'draft', 'core', 'pick', 1997),
  // No file for 2019; the refresh logs it as not published.
  wnba('coaches', 'coaches', 'core', 'coach-team', 1997),
  wnba('officials', 'officials', 'core', 'official-game', 2004),
  wnba('lineups', 'lineups', 'published', 'lineup-season-measure', 2026),
  source(
    'src_wnba_impact',
    'wnba_player_impact',
    'wnba_player_impact',
    'published',
    'player-season-type',
    1997
  ),
  source(
    'src_wnba_impact_averages',
    'wnba_player_impact',
    'wnba_player_impact_league_averages',
    'published',
    'season-type',
    1997
  ),
  wnba('metric_curves', 'metric_curves', 'published', 'entity-metric-bin', 1997),
  wnba('rolling_windows', 'rolling_windows', 'published', 'entity-metric-window', 1997),
  wnba('shots', 'shots', 'events', 'shot', 1997),
  wnba('possessions', 'wnba_possessions', 'events', 'possession', 1997),
  wnba('game_lineups', 'wnba_lineups', 'events', 'play', 1997),
  wnba('pbp', 'wnba_play_by_play', 'plays', 'play', 1997)
]

const wDashboard = (stem: string, grain: string): SourceFile =>
  source(`src_dash_${stem}`, 'wnba_stats_leaguedash', stem, 'published', grain, 1997)

/** The same families as the NBA's, every one from 1997; no tracking is published for the WNBA. */
const WNBA_DASHBOARDS: SourceFile[] = [
  ...LINEUP_MEASURES.map((m) => wDashboard(`lineups_${m}`, 'lineup-season-type')),
  ...PLAYER_MEASURES.map((m) => wDashboard(`player_stats_${m}`, 'player-season-type')),
  ...TEAM_MEASURES.map((m) => wDashboard(`team_stats_${m}`, 'team-season-type')),
  wDashboard('player_bio', 'player-season-type'),
  wDashboard('standings', 'team-season')
]

const wIds = (
  table: string,
  stem: string,
  grain: string,
  firstSeason: number,
  all = false
): SourceFile =>
  source(
    table,
    table.startsWith('src_xwalk') ? 'wnba_crosswalk' : 'wnba_groups',
    stem,
    'core',
    grain,
    firstSeason,
    {
      ...keys,
      ...(all ? allSeasons : {})
    }
  )

const WNBA_IDS: SourceFile[] = [
  wIds('src_xwalk_player', 'wnba_player_crosswalk', 'player-team', 2002),
  wIds('src_xwalk_team', 'wnba_team_crosswalk', 'team', 2002),
  wIds('src_xwalk_game', 'wnba_schedule_crosswalk', 'game', 2002),
  wIds('src_groups', 'wnba_groups', 'group', 1997, true),
  wIds('src_group_aliases', 'wnba_group_aliases', 'alias', 1997, true),
  wIds('src_group_seasons', 'wnba_group_seasons', 'group-season', 1997, true),
  wIds('src_player_aliases', 'wnba_player_aliases', 'alias', 1997, true),
  wIds('src_team_aliases', 'wnba_team_aliases', 'alias', 1997, true),
  wIds('src_team_groups', 'wnba_team_group_seasons', 'team-season', 1997),
  wIds('src_team_groups_all', 'wnba_team_group_seasons', 'team-season', 1997, true)
]

export const WNBA_SOURCES: SourceFile[] = [
  ...WNBA_IDS,
  ...WNBA_ESPN,
  ...WNBA_STATS,
  ...WNBA_DASHBOARDS
]

const WNBA_LABELS: Record<string, string> = {
  espn_wnba_schedules: 'Schedules (ESPN)',
  espn_wnba_player_boxscores: 'Player box scores (ESPN)',
  espn_wnba_team_boxscores: 'Team box scores (ESPN)',
  espn_wnba_player_core: 'Player details (ESPN)',
  espn_wnba_player_season_stats: 'Player season stats (ESPN)',
  espn_wnba_team_season_stats: 'Team season stats (ESPN)',
  espn_wnba_game_rosters: 'Game rosters (ESPN)',
  espn_wnba_standings: 'Standings (ESPN)',
  espn_wnba_officials: 'Officials (ESPN)',
  espn_wnba_draft: 'Draft (ESPN)',
  espn_wnba_rosters: 'Rosters (ESPN)',
  espn_wnba_injuries: 'Injuries (ESPN)',
  espn_wnba_shots: 'Shots (ESPN)',
  espn_wnba_pbp: 'Play by play (ESPN)',
  wnba_stats_schedules: 'Schedules (WNBA)',
  wnba_stats_player_game_logs: 'Game logs (WNBA)',
  wnba_stats_player_boxscores: 'Player box scores (WNBA)',
  wnba_stats_team_boxscores: 'Team box scores (WNBA)',
  wnba_stats_player_season_stats: 'Player season stats (WNBA)',
  wnba_stats_team_season_stats: 'Team season stats (WNBA)',
  wnba_stats_standings: 'Standings (WNBA)',
  wnba_stats_rosters: 'Rosters (WNBA)',
  wnba_stats_game_rosters: 'Game rosters (WNBA)',
  wnba_stats_draft: 'Draft (WNBA)',
  wnba_stats_coaches: 'Coaches (WNBA)',
  wnba_stats_officials: 'Officials (WNBA)',
  wnba_stats_leaguedash: 'League dashboards (WNBA)',
  wnba_stats_lineups: 'Lineups (WNBA)',
  wnba_stats_shots: 'Shots (WNBA)',
  wnba_stats_pbp: 'Play by play (WNBA)',
  wnba_player_impact: 'Impact models (SportsDataverse)',
  wnba_stats_metric_curves: 'Shooting by distance (SportsDataverse)',
  wnba_stats_rolling_windows: 'Recent shooting (SportsDataverse)',
  wnba_stats_possessions: 'Possessions (SportsDataverse)',
  wnba_stats_game_lineups: 'Lineups on court (SportsDataverse)',
  wnba_crosswalk: 'Id crosswalks (SportsDataverse)',
  wnba_groups: 'Aliases and conferences (SportsDataverse)'
}

/**
 * NCAA Division I, men and women (D38), as `docs/reference/ncaa-data-sources.md` measured them on
 * 2026-11-18: 29 releases a side, the same tables in both, so one shape names them. Seasons from
 * 2021-22 (`2022`, D39); a file of every season keeps its rows from then on (`fromSeason`). Tables are
 * named by source as the WNBA's are: `src_espn_*` for ESPN's, `src_ncaa_*` for stats.ncaa.org's, and
 * the dataset's crosswalks and groups under the NBA's names, with its team ratings and player values
 * beside them. Left out:
 * - `*_team_group_seasons.parquet`, the combined group file: its season files row for row (D23);
 * - `*_games_in_data_repo.parquet`: from 2021-22 on, every row of it is a row of the schedule master,
 *   every column equal (30,507 men's rows of the master's 31,103, 28,313 women's of 28,987; D23);
 * - ESPN's play by play, which no metric reads (D42), listed in `LEFT_OUT_RELEASES` so the Data panel
 *   names it.
 * The keys will be built from ESPN's schedules and player box scores, the crosswalk and the groups
 * (D40), so those four releases are marked `keys`. The `ncaa_*` releases are not: each league must run
 * without them (D41, `NCAA_STATS_LEFT_OUT`).
 */
const NCAA_FIRST_SEASON = 2022
const IN_WINDOW = { fromSeason: NCAA_FIRST_SEASON }

interface College {
  /** `espn_mens_college_basketball`: ESPN's releases. */
  espn: string
  /** `ncaa_mbb`: stats.ncaa.org's releases, and the stem of their files. */
  ncaa: string
  /** `mbb`: the dataset's crosswalk, groups and models. */
  short: string
  /** ESPN's rosters start later than its other files: 2024-25 for the men, 2025-26 for the women. */
  rostersFrom: number
}

function collegeSources({ espn, ncaa, short, rostersFrom }: College): SourceFile[] {
  const first = NCAA_FIRST_SEASON
  const e = (
    name: string,
    stem: string,
    tier: LoadTier,
    grain: string,
    release = name,
    options: Options = {},
    firstSeason = first
  ): SourceFile =>
    source(`src_espn_${name}`, `${espn}_${release}`, stem, tier, grain, firstSeason, options)
  const n = (name: string, tier: LoadTier, grain: string): SourceFile =>
    source(`src_ncaa_${name}`, `${ncaa}_${name}`, `${ncaa}_${name}`, tier, grain, first)
  const ids = (
    table: string,
    release: 'crosswalk' | 'groups',
    stem: string,
    grain: string,
    options: Options = {}
  ): SourceFile =>
    source(table, `${short}_${release}`, stem, 'core', grain, first, { ...keys, ...options })
  const every = { ...allSeasons, ...IN_WINDOW }
  return [
    ids('src_xwalk_player', 'crosswalk', `${short}_player_crosswalk`, 'player-team'),
    ids('src_xwalk_team', 'crosswalk', `${short}_team_crosswalk`, 'team'),
    ids('src_xwalk_game', 'crosswalk', `${short}_schedule_crosswalk`, 'game'),
    // ESPN's team ids against stats.ncaa.org's, which change every season; the same two schools files
    // in both leagues' releases, loaded into each league's own file (D36).
    ids('src_xwalk_schools', 'crosswalk', 'ncaa_espn_schools', 'school', every),
    ids('src_xwalk_school_seasons', 'crosswalk', 'ncaa_espn_school_seasons', 'school-season', {
      ...every,
      seasonSpan: true
    }),
    ids('src_xwalk_ncaa_teams', 'crosswalk', 'ncaa_espn_team_crosswalk', 'team-season', {
      ...every,
      seasonSpan: true
    }),
    ids('src_groups', 'groups', `${short}_groups`, 'group', every),
    ids('src_group_aliases', 'groups', `${short}_group_aliases`, 'alias', every),
    ids('src_group_seasons', 'groups', `${short}_group_seasons`, 'group-season', every),
    ids('src_player_aliases', 'groups', `${short}_player_aliases`, 'alias', every),
    ids('src_team_aliases', 'groups', `${short}_team_aliases`, 'alias', every),
    // The season's Division I list (D40).
    ids('src_team_groups', 'groups', `${short}_team_group_seasons`, 'team-season'),

    // Each game once a season in the window. The master has the same games to 2025-26 but is not a
    // repeat: two men's rows and the women's team names differ (ncaa-data-sources.md, "Traps").
    e('schedule', `${short}_schedule`, 'core', 'game', 'schedules', keys),
    e('schedule_master', `${short}_schedule_master`, 'core', 'game', 'schedules', {
      ...every,
      ...keys
    }),
    e('player_box', 'player_box', 'core', 'player-game', 'player_boxscores', keys),
    e('team_box', 'team_box', 'core', 'team-game', 'team_boxscores'),
    e('player_core', 'player_core', 'core', 'player-season'),
    e('player_season', 'player_season_stats', 'core', 'player-season-stat', 'player_season_stats'),
    e('team_season', 'team_season_stats', 'core', 'team-season-stat', 'team_season_stats'),
    e('game_rosters', 'game_rosters', 'core', 'player-game'),
    e('standings', 'standings', 'core', 'team-season-stat'),
    e('officials', 'officials', 'core', 'official-game'),
    e('rosters', 'rosters', 'core', 'player-team', 'rosters', {}, rostersFrom),
    e('shots', 'shots', 'events', 'shot'),
    e('pbp', 'play_by_play', 'plays', 'play'),

    n('schedule', 'core', 'game'),
    n('team_ids', 'core', 'team-season'),
    n('rosters', 'core', 'player-team-season'),
    n('team_rosters', 'core', 'player-team-season'),
    n('team_box', 'core', 'team-game'),
    n('player_box', 'core', 'player-game'),
    // The dataset's RAPM from stats.ncaa.org's plays, published once a season is over.
    n('rapm', 'published', 'player-season'),
    n('rapm_within_team', 'published', 'player-season'),
    n('shots', 'events', 'shot'),
    n('possessions', 'events', 'possession'),
    n('lineups', 'events', 'lineup-stint'),
    n('matchup_stints', 'events', 'stint'),
    { ...n('pbp', 'plays', 'play'), ordered: true },

    source(
      'src_ratings',
      `${short}_ratings`,
      `${short}_ratings`,
      'published',
      'team-season',
      first
    ),
    source(
      'src_player_value',
      `${short}_player_value`,
      `${short}_player_value`,
      'published',
      'player-season',
      first
    )
  ]
}

const MEN: College = {
  espn: 'espn_mens_college_basketball',
  ncaa: 'ncaa_mbb',
  short: 'mbb',
  rostersFrom: 2025
}
const WOMEN: College = {
  espn: 'espn_womens_college_basketball',
  ncaa: 'ncaa_wbb',
  short: 'wbb',
  rostersFrom: 2026
}

export const NCAAM_SOURCES: SourceFile[] = collegeSources(MEN)
export const NCAAW_SOURCES: SourceFile[] = collegeSources(WOMEN)

function collegeLabels({ espn, ncaa, short }: College): Record<string, string> {
  return {
    [`${espn}_schedules`]: 'Schedules (ESPN)',
    [`${espn}_player_boxscores`]: 'Player box scores (ESPN)',
    [`${espn}_team_boxscores`]: 'Team box scores (ESPN)',
    [`${espn}_player_core`]: 'Player details (ESPN)',
    [`${espn}_player_season_stats`]: 'Player season stats (ESPN)',
    [`${espn}_team_season_stats`]: 'Team season stats (ESPN)',
    [`${espn}_game_rosters`]: 'Game rosters (ESPN)',
    [`${espn}_standings`]: 'Standings (ESPN)',
    [`${espn}_officials`]: 'Officials (ESPN)',
    [`${espn}_rosters`]: 'Rosters (ESPN)',
    [`${espn}_shots`]: 'Shots (ESPN)',
    [`${espn}_pbp`]: 'Play by play (ESPN)',
    [`${ncaa}_schedule`]: 'Schedules (stats.ncaa.org)',
    [`${ncaa}_team_ids`]: 'Team ids (stats.ncaa.org)',
    [`${ncaa}_rosters`]: 'Rosters (stats.ncaa.org)',
    [`${ncaa}_team_rosters`]: 'Team rosters (stats.ncaa.org)',
    [`${ncaa}_team_box`]: 'Team box scores (stats.ncaa.org)',
    [`${ncaa}_player_box`]: 'Player box scores (stats.ncaa.org)',
    [`${ncaa}_shots`]: 'Shots (stats.ncaa.org)',
    [`${ncaa}_pbp`]: 'Play by play (stats.ncaa.org)',
    [`${ncaa}_possessions`]: 'Possessions (SportsDataverse)',
    [`${ncaa}_lineups`]: 'Lineups (SportsDataverse)',
    [`${ncaa}_matchup_stints`]: 'Lineups on court (SportsDataverse)',
    [`${ncaa}_rapm`]: 'RAPM (SportsDataverse)',
    [`${ncaa}_rapm_within_team`]: 'RAPM within team (SportsDataverse)',
    [`${short}_ratings`]: 'Team ratings (SportsDataverse)',
    [`${short}_player_value`]: 'Player value (SportsDataverse)',
    [`${short}_crosswalk`]: 'Id crosswalks (SportsDataverse)',
    [`${short}_groups`]: 'Aliases and conferences (SportsDataverse)'
  }
}

/** Each release as the Data panel names it. SportsDataverse's are its own calculations. */
export const RELEASE_LABELS: Readonly<Record<string, string>> = {
  ...NBA_LABELS,
  ...WNBA_LABELS,
  ...collegeLabels(MEN),
  ...collegeLabels(WOMEN)
}

/** Each league's files, the registry's `releases.registry`. */
export const SOURCES_BY_LEAGUE: Readonly<Record<LeagueId, readonly SourceFile[]>> = {
  nba: SOURCES,
  wnba: WNBA_SOURCES,
  ncaam: NCAAM_SOURCES,
  ncaaw: NCAAW_SOURCES
}

/**
 * The files a league's download brings of its paired league (D48), loaded into the links file
 * (`LINKS_FILE`) by the links worker, never into the league's own: ESPN's player season stats of the
 * other league from its first linkable season, and for a college league the professional draft table,
 * which names the draftees who have not played (the manager's decision of 2026-11-21, D48's addition).
 * Each is the paired league's own source with a table and id of its own, `paired_<league>_<table>`, so
 * the two directions of a pair never share rows. Listed in the Data panel under the league that brings
 * them, with the paired league's seasons.
 */
export interface PairedSource extends SourceFile {
  /** The league whose files these are, whose seasons they hold. */
  of: LeagueId
  /** The table's kind, for the links worker. */
  kind: 'season-stats' | 'draft'
}

function pairedSources(league: LeagueId): PairedSource[] {
  const pair = pairOf(league)
  if (!pair) return []
  const other = pair.college === league ? pair.pro : pair.college
  const own = SOURCES_BY_LEAGUE[other]
  const take = (table: string, kind: PairedSource['kind'], firstSeason: number): PairedSource => {
    const source = own.find((s) => s.table === table)
    if (!source) throw new Error(`the ${other} registry has no ${table}`)
    const name = `paired_${other}_${table.slice('src_'.length)}`
    return { ...source, id: name, table: name, firstSeason, keys: false, of: other, kind }
  }
  const lines = take(
    pair.seasonStatsTable,
    'season-stats',
    other === pair.pro ? pair.proFrom : pair.collegeFrom
  )
  // The draft of the class of the college window's first season on, labelled as the league labels it.
  return other === pair.pro
    ? [lines, take(pair.proDraftTable, 'draft', pair.collegeFrom + pair.proLabelAhead)]
    : [lines]
}

/** What each league's download brings of its paired league. */
export const PAIRED_SOURCES_BY_LEAGUE: Readonly<Record<LeagueId, readonly PairedSource[]>> = {
  nba: pairedSources('nba'),
  wnba: pairedSources('wnba'),
  ncaam: pairedSources('ncaam'),
  ncaaw: pairedSources('ncaaw')
}

/** "NCAA Men player season stats (ESPN), for linked careers": the Data panel's name of a paired file. */
export function pairedLabel(source: PairedSource): string {
  const what = RELEASE_LABELS[source.release] ?? source.release
  return `${LEAGUES[source.of].name} ${what.charAt(0).toLowerCase()}${what.slice(1)}, for linked careers`
}

/**
 * The stats.ncaa.org releases of both college leagues, 13 a side: the box scores with their shot-zone
 * splits, the play by play with the ten players, possessions, lineups, stints, located shots and RAPM.
 */
export const NCAA_STATS_RELEASES: readonly string[] = [MEN.ncaa, WOMEN.ncaa].flatMap((ncaa) =>
  [
    'schedule',
    'team_ids',
    'rosters',
    'team_rosters',
    'team_box',
    'player_box',
    'rapm',
    'rapm_within_team',
    'shots',
    'possessions',
    'lineups',
    'matchup_stints',
    'pbp'
  ].map((name) => `${ncaa}_${name}`)
)

/**
 * The switch D41 asks for: true ships both college leagues without the stats.ncaa.org releases, on
 * ESPN's tables alone, within a day, through `LEFT_OUT_RELEASES` as any release is left out. Those
 * releases state no licence and their upstream refuses plain clients (`data-rights.md`). False: they
 * load. Leaving them out drops their tables on the next refresh, and the metrics that read them give
 * their reasons (Plan T1302.5 on).
 */
export const NCAA_STATS_LEFT_OUT: boolean = false

/**
 * ESPN's college play by play, the one table of D39's seasons not loaded (D42): no metric reads it,
 * since stats.ncaa.org's holds every game with the ten players on the floor, and it would cost about
 * 1.45 GB a league against D22's 6 GB. Revisited only if a metric needs it.
 */
const COLLEGE_ESPN_PBP = [`${MEN.espn}_pbp`, `${WOMEN.espn}_pbp`]

/**
 * Release tags left out of this build, named exactly (`nba_stats_synergy`, `nba_player_impact`). A tag
 * listed here is not downloaded; the next refresh drops what it had loaded and rebuilds from the rest,
 * its metrics read null with a reason, and the Data panel lists it as not in this version. The
 * releases the game, team and player tables are built from cannot be listed (`leftOut.ts`). Every NBA
 * and WNBA release loads; the college leagues leave out ESPN's play by play (D42), and stats.ncaa.org's
 * releases when `NCAA_STATS_LEFT_OUT` is set (D41).
 * `docs/reference/stats-database.md`, "Leaving a source out".
 */
export const LEFT_OUT_RELEASES: readonly string[] = [
  ...COLLEGE_ESPN_PBP,
  ...(NCAA_STATS_LEFT_OUT ? NCAA_STATS_RELEASES : [])
]

/**
 * A file's season as an INTEGER, as SQL over its `season` column: cast, or for a span published as
 * text (`2025-26`) its final year, so a season reads as every other file's (D27).
 */
export function seasonSql(source: SourceFile): string {
  return source.seasonSpan
    ? "CASE WHEN regexp_full_match(CAST(season AS VARCHAR), '\\d{4}-\\d{2}') THEN TRY_CAST(left(CAST(season AS VARCHAR), 4) AS INTEGER) + 1 END"
    : 'TRY_CAST(season AS INTEGER)'
}

/** The file of one season (0 for a file of all seasons). */
export function fileName(source: SourceFile, season: number): string {
  const extension = source.format ?? 'parquet'
  return source.allSeasons ? `${source.stem}.${extension}` : `${source.stem}_${season}.${extension}`
}

export function fileUrl(source: SourceFile, season: number): string {
  return source.url ?? `${RELEASES_URL}/${source.release}/${fileName(source, season)}`
}

/** The seasons a source can have up to `current`; `[0]` for a file of all seasons. */
export function seasonsOf(source: SourceFile, current: number): number[] {
  if (source.allSeasons) return [0]
  const seasons: number[] = []
  for (let s = source.firstSeason; s <= current; s++) seasons.push(s)
  return seasons
}
