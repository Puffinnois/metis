import {
  DEFAULT_LEAGUE,
  type League,
  leagueOf,
  type PlaysRecipeName,
  recipeOf,
  threePointLineSql
} from '@shared/leagues'

/**
 * What the play builders read differently by league, on the identity and derived recipes' pattern
 * (`stats-database.md`, "How each league's tables are built"): the league's entry names its recipe
 * (`League.plays`), and the builders, the views and the reads take the league and read from it. The
 * SQL after the sources is one for every league; a recipe says only which files hold the play by play,
 * the shots, the possessions, the players on the floor and the officials, how a file's team id is the
 * game's side, and how its shots mark a missing location.
 */
export interface PlaysRecipe {
  /**
   * Bumped when this league's rows change; each recipe keeps its own, so changing one never rebuilds
   * another league's file. A change to the shared SQL bumps every recipe.
   */
  version: number
  /** The league's own play by play (the v3 feed: action types, descriptions, `order_index`). */
  pbp: string
  shots: string
  /** SportsDataverse's possessions, worked out from that play by play. */
  possessions: string
  /** SportsDataverse's ten players on the floor at each play, by `action_number`. */
  gameLineups: string
  officials: string
  /** The league's game matchups, or null where no release publishes them (the WNBA). */
  gameMatchups: string | null
  /**
   * A source's team id as the game's side: the same id, or, where the league keeps one club apart from
   * another of the same id (the 2026 Portland Fire, D28), the side whose id it is in absolute value.
   */
  side: (id: string, home: string, away: string) => string
  /**
   * A condition on a shot's coordinates that says the file gave none, or null when every shot has one:
   * such a shot keeps its attempt and its value, with no location, zone or distance.
   */
  unlocated: ((x: string, y: string) => string) | null
  /**
   * Whether a miss in ESPN's play by play is beyond the three-point line, from its raw coordinates (feet
   * across the court, 25 at the basket, and from the basket), in the season `season` names. Read only
   * where ESPN says neither the points attempted nor a make's value.
   */
  espnThree: (x: string, y: string, season: string) => string
  /**
   * ESPN's foul types as this league's file spells them, against the spellings the shared rules read
   * (`ESPN_DRAWN_FOUL_TYPES`): the fouled player is named on the same types, written another way.
   */
  espnFoulNames: Readonly<Record<string, string>>
  /**
   * Which builders the plays step runs: every one from the league's play by play (absent), or the
   * college leagues' (`collegePlays.ts`): their shots, lineups and on-court units from stats.ncaa.org's
   * files and its play by play (`collegePbp.ts`).
   */
  builders?: 'college'
  /** False where no file names a shot's assist yet: the shot tables' assisted makes read NULL. */
  assists?: false
  /**
   * ESPN's free throws in its shot file, as SQL over its `type_text`; absent, the NBA's spelling
   * ('Free Throw …'). A made free throw is never a field-goal attempt.
   */
  espnFreeThrow?: (typeText: string) => string
  /** The `game` column the officials file's `game_id` matches: the league's own id, or ESPN's. */
  officialsGame?: 'game_id'
  /** The league's ten-player stints, where a release publishes them (stats.ncaa.org's). */
  stints?: string
}

/** `type_text` read through a recipe's spellings: the column as it is when there are none. */
export const espnFoulType = (recipe: PlaysRecipe, typeText: string): string => {
  const pairs = Object.entries(recipe.espnFoulNames)
  if (pairs.length === 0) return typeText
  const q = (s: string): string => `'${s.replaceAll("'", "''")}'`
  return `(CASE ${typeText} ${pairs.map(([from, to]) => `WHEN ${q(from)} THEN ${q(to)}`).join(' ')} ELSE ${typeText} END)`
}

/**
 * ESPN's rule for a league whose line changed, from the registry's line by era: beyond the arc (a
 * quarter of a foot inside it, as the NBA's rule reads 23.5 for 23.75), or out to the corner line where
 * it runs straight.
 */
const espnThreeByEra =
  (league: League) =>
  (x: string, y: string, season: string): string => {
    const arc = threePointLineSql(league, season, 'arc')
    const corner = threePointLineSql(league, season, 'corner')
    return `sqrt(power(${x} - 25, 2) + power(${y}, 2)) >= ${arc} / 10.0 - 0.25
               OR (abs(${x} - 25) >= ${corner} / 10.0
                   AND ${y} <= sqrt(${arc} * ${arc} - ${corner} * ${corner}) / 10.0)`
  }

/** The NBA's files, as every builder read them before leagues: their SQL is unchanged. */
export const NBA_PLAYS: PlaysRecipe = {
  version: 7,
  pbp: 'src_nba_pbp',
  shots: 'src_nba_shots',
  possessions: 'src_nba_possessions',
  gameLineups: 'src_nba_game_lineups',
  officials: 'src_nba_officials',
  gameMatchups: 'src_nba_game_matchups',
  side: (id) => id,
  unlocated: null,
  espnThree: (x, y) => `sqrt(power(${x} - 25, 2) + power(${y}, 2)) >= 23.5
               OR (abs(${x} - 25) >= 22 AND ${y} <= 9)`,
  espnFoulNames: {}
}

/**
 * The WNBA's files (`wnba-data-sources.md`): the same feed and columns as the NBA's, but for the play by
 * play's possession number and ten players on each row, which it does not carry (the lineup file has
 * them). The 2026 Portland Fire are `-1611661327` in `game` and 1611661327 in every source (T1301.5).
 * Before 2011, 20 to 30 % of the shots sit at (0, 0) with a distance of 0 or 1: 95 to 99.7 % of them
 * layups and tips, placed at the basket wherever in the lane they were taken (2005 has 2.7 times
 * 2011's shots within a foot), and a few jump shots. None sits there from 2011 to 2017, 3 to 11 a
 * season after. So they keep their attempt and value, and read with no location, zone or distance.
 */
export const WNBA_PLAYS: PlaysRecipe = {
  version: 1,
  pbp: 'src_wnba_pbp',
  shots: 'src_wnba_shots',
  possessions: 'src_wnba_possessions',
  gameLineups: 'src_wnba_game_lineups',
  officials: 'src_wnba_officials',
  gameMatchups: null,
  side: (id, home, away) =>
    `(CASE ${id} WHEN abs(${home}) THEN ${home} WHEN abs(${away}) THEN ${away} END)`,
  unlocated: (x, y) => `(${x} = 0 AND ${y} = 0)`,
  espnThree: espnThreeByEra(leagueOf('wnba')),
  // ESPN's WNBA file names the fouled player from 2006 to 2017 (85 % of fouls), under these spellings
  // there, measured on every season (wnba-data-sources.md, "Play-derived stats").
  espnFoulNames: {
    ShootingFoul: 'Shooting Foul',
    PersonalFoul: 'Personal Foul',
    LooseBallFoul: 'Loose Ball Foul',
    PersonalTake: 'Personal Take Foul',
    'Shooting Block Foul': 'Shooting Block',
    PersonalBlock: 'Personal Block',
    'InBound Foul': 'Inbound Foul',
    'Away From Play Foul': 'Away from Play Foul',
    'ClearPath Foul': 'Clear Path Foul'
  }
}

/** The college leagues' officials, ESPN's, as the officials reads name the columns (`collegePlays.ts`). */
export const COLLEGE_OFFICIALS_VIEW = 'official_espn'

/**
 * The college leagues' files (`ncaa-data-sources.md`, D40): stats.ncaa.org's located shots, five-player
 * lineups, ten-player stints and possessions, and its play by play (`collegePbp.ts`); ESPN's officials.
 * Its shots name no assist and its team ids are ESPN's, so a source's id is the game's side as it is.
 * Every shot has a location from 2021-22, so none is unlocated. One recipe for the men and the women
 * (D38): their lines are the same across the window.
 */
export const COLLEGE_PLAYS: PlaysRecipe = {
  // 3: each shot's team and shooter resolved once a season (`shot_key`), a team named by its name
  // where it has no id. 4: the play by play's own tables (T1302.7), the play-credited units beside.
  // 5: every pick by a total order, so the same files always give the same rows (T1302.9).
  version: 5,
  pbp: 'src_ncaa_pbp',
  shots: 'src_ncaa_shots',
  possessions: 'src_ncaa_possessions',
  gameLineups: 'src_ncaa_lineups',
  officials: COLLEGE_OFFICIALS_VIEW,
  gameMatchups: null,
  side: (id) => id,
  unlocated: null,
  espnThree: espnThreeByEra(leagueOf('ncaam')),
  espnFoulNames: {},
  builders: 'college',
  assists: false,
  // ESPN's college shot file spells a free throw `MadeFreeThrow`, and holds no missed one.
  espnFreeThrow: (typeText) =>
    `(${typeText} ILIKE 'Free Throw%' OR ${typeText} ILIKE '%FreeThrow%')`,
  officialsGame: 'game_id',
  stints: 'src_ncaa_matchup_stints'
}

/** Every recipe, by the name a league's registry entry gives. */
export const PLAYS_RECIPES: Readonly<Record<PlaysRecipeName, PlaysRecipe>> = {
  nba: NBA_PLAYS,
  wnba: WNBA_PLAYS,
  college: COLLEGE_PLAYS
}

// A script or test that names no league reads the NBA's, the league every file was before leagues.
const NBA = leagueOf(DEFAULT_LEAGUE)

/** The recipe a league's registry entry names. */
export const playsRecipe = (league: League = NBA): PlaysRecipe =>
  PLAYS_RECIPES[recipeOf(league, 'plays')]
