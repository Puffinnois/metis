/**
 * Every file Metis loads from the sportsdataverse-data releases. The file names follow a rule, so
 * the app generates them and never lists a release: GitHub's API allows 60 anonymous calls an hour.
 * `scripts/inventory-sources.mjs` lists the releases at development time, and a test compares that
 * list with this one.
 */
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
}

type Options = Partial<Pick<SourceFile, 'allSeasons' | 'shared' | 'id'>>

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

export const SOURCES: SourceFile[] = [...IDS, ...ESPN, ...NBA, ...DASHBOARDS, ...SHARED]

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

/**
 * A season is labelled by its final year (D10). The next season's schedule appears over the
 * summer, so the label turns in August; a file not published yet is skipped, not an error.
 */
export function currentSeason(now: Date): number {
  return now.getUTCFullYear() + (now.getUTCMonth() >= 7 ? 1 : 0)
}
