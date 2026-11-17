/**
 * Every file Metis loads from the sportsdataverse-data releases. The file names follow a rule, so
 * the app generates them and never lists a release: GitHub's API allows 60 anonymous calls an hour.
 * `scripts/inventory-sources.mjs` lists the releases at development time, and a test compares that
 * list with this one.
 */
import type { LeagueId } from '@shared/leagues'

export const RELEASES_URL =
  'https://github.com/sportsdataverse/sportsdataverse-data/releases/download'

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
}

type Options = Partial<Pick<SourceFile, 'allSeasons' | 'shared' | 'id' | 'keys'>>

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
  nba_stats_metric_curves: 'Shooting by distance (SportsDataverse)',
  nba_stats_rolling_windows: 'Recent shooting (SportsDataverse)',
  nba_stats_possessions: 'Possessions (SportsDataverse)',
  nba_stats_game_lineups: 'Lineups on court (SportsDataverse)',
  nba_crosswalk: 'Id crosswalks (SportsDataverse)',
  nba_groups: 'Aliases and divisions (SportsDataverse)'
}

export const SOURCES: SourceFile[] = [...IDS, ...ESPN, ...NBA, ...DASHBOARDS, ...SHARED]

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

const wIds = (table: string, stem: string, grain: string, firstSeason: number, all = false) =>
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

/** Each release as the Data panel names it. SportsDataverse's are its own calculations. */
export const RELEASE_LABELS: Readonly<Record<string, string>> = { ...NBA_LABELS, ...WNBA_LABELS }

/** Each league's files, the registry's `releases.registry`. */
export const SOURCES_BY_LEAGUE: Readonly<Record<LeagueId, readonly SourceFile[]>> = {
  nba: SOURCES,
  wnba: WNBA_SOURCES
}

/**
 * Release tags left out of this build, named exactly (`nba_stats_synergy`, `nba_player_impact`).
 * Empty: every release loads. A tag listed here is not downloaded; the next refresh drops what it had
 * loaded and rebuilds from the rest, and its metrics read null with a reason. The releases the game,
 * team and player tables are built from cannot be listed (`leftOut.ts`).
 * `docs/reference/stats-database.md`, "Leaving a source out".
 */
export const LEFT_OUT_RELEASES: readonly string[] = []

/** The file of one season (0 for a file of all seasons). */
export function fileName(source: SourceFile, season: number): string {
  return source.allSeasons ? `${source.stem}.parquet` : `${source.stem}_${season}.parquet`
}

export function fileUrl(source: SourceFile, season: number): string {
  return `${RELEASES_URL}/${source.release}/${fileName(source, season)}`
}

/** The seasons a source can have up to `current`; `[0]` for a file of all seasons. */
export function seasonsOf(source: SourceFile, current: number): number[] {
  if (source.allSeasons) return [0]
  const seasons: number[] = []
  for (let s = source.firstSeason; s <= current; s++) seasons.push(s)
  return seasons
}
