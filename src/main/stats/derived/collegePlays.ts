import type { League } from '@shared/leagues'
import { LINEUP_STORED } from '@shared/stats/lineups'
import {
  espnShotsSql,
  POSSESSION_COLUMNS,
  POSSESSIONS_VIEW,
  SHOT_COLUMNS,
  SHOT_VIEWS,
  selectColumns
} from './events'
import { LINEUPS } from './lineups'
import {
  ON_COURT_COUNTS,
  OWN_COUNTS,
  PLAYER_ON_COURT,
  PLAYER_ON_COURT_COLUMNS,
  UNIT_GAME,
  UNIT_GAME_COLUMNS,
  type OnCourtCount
} from './onCourt'
import type { PlayBuilder } from './playBuilders'
import { COLLEGE_OFFICIALS_VIEW, COLLEGE_PLAYS } from './playsRecipe'
import { column, type Have } from './sql'

/**
 * The college leagues' tables from stats.ncaa.org's event files (D40, `ncaa-data-sources.md`), keyed
 * to ESPN's games, teams and players through the identity tables (T1302.4): its located shots, its
 * five-player lineups and ten-player stints, its possessions, and ESPN's officials and shots beside
 * them. The play by play's own tables come with T1302.7 (`League.playTables`).
 *
 * - **Games:** a file's `contest_id` is `game.ncaa_game_id`. A contest with no game row (a repeat, an
 *   exhibition left out at T1302.4) has no rows here.
 * - **Teams:** stats.ncaa.org names a team in its short form (`Eastern Ill.`), mapped by the season's
 *   team list (`src_ncaa_team_ids`) to its id and so to `team`; a name it does not map is the game's
 *   other side when the opponent's name maps.
 * - **Players:** through `ncaa_player_ids`, by the file's player id within the season where it has one,
 *   else by name within the team and season. A player no row matches keeps a key of D28's kind (a
 *   negative id), so their lines are kept and counted, never dropped.
 */

type Columns = ReadonlyArray<readonly [string, string]>

/** A person's name as a key: lower case, no accents, no suffix (Jr., III), letters only. */
export const nameKeySql = (n: string): string =>
  `regexp_replace(regexp_replace(trim(regexp_replace(lower(strip_accents(${n})), '[^a-z ]', '', 'g')), ' (jr|sr|ii|iii|iv|v)$', ''), '[^a-z]', '', 'g')`

/** "Fisher, Nazareth" (the lineup file's form) as "Nazareth Fisher"; a name with no comma as it is. */
const lastFirst = (n: string): string =>
  `CASE WHEN ${n} LIKE '%,%' THEN trim(split_part(${n}, ',', 2)) || ' ' || trim(split_part(${n}, ',', 1)) ELSE ${n} END`

/**
 * The shot file's code for a player it gives no id (`AuPace`: two letters of the first name, then the
 * last), from a play-by-play name (`AUSTIN.PACE`), lower case and letters only, to match the code.
 */
const shooterCodeSql = (player: string): string =>
  `lower(left(split_part(${player}, '.', 1), 2) || regexp_replace(substr(${player}, strpos(${player}, '.') + 1), '[^A-Za-z]', '', 'g'))`

/** A key of D28's kind for a player no row of `ncaa_player_ids` names: negative, past every id. */
const fallbackKey = (season: string, team: string, name: string): string =>
  `-(1000000000000 + hash(${season}, ${team}, lower(trim(${name}))) % 1000000000000)::BIGINT`

/**
 * stats.ncaa.org's team names, each with every key in `team` it may be (a season, or every season):
 * the season's team list, and the names `ncaa_player_ids` resolved (T1302.4), which hold the schools
 * the list lacks (FDU, Saint Francis in 2022-23). A name can be two schools' (East Texas A&M's), so
 * each name holds every key it may be (`ids`), and `nameSide` reads it as one of the game's sides.
 */
const teamNamesSql = (
  season?: string
): string => `SELECT season, name, list(DISTINCT team_id) AS ids FROM (
      SELECT i.season, i.team AS name, t.team_id
      FROM src_ncaa_team_ids i JOIN team t ON t.season = i.season AND t.ncaa_team_id = TRY_CAST(i.id AS BIGINT)
      UNION ALL
      SELECT season, ncaa_team, team_id FROM ncaa_player_ids WHERE team_id IS NOT NULL)
    WHERE name IS NOT NULL${season === undefined ? '' : ` AND season = ${season}`}
    GROUP BY 1, 2`

/** The game's side a name's keys (`ids` of `teamNamesSql`) point to, when they point to one alone. */
const nameSide = (ids: string): string => `CASE
      WHEN list_contains(${ids}, g.home_team_id) AND NOT list_contains(${ids}, g.away_team_id) THEN g.home_team_id
      WHEN list_contains(${ids}, g.away_team_id) AND NOT list_contains(${ids}, g.home_team_id) THEN g.away_team_id END`

/** A season's players by name within their team: the row with the most lines where two share one. */
const playersByNameSql = (
  season: string,
  key: string
): string => `SELECT team_id, k, arg_max(player_id, lines) AS player_id
    FROM (SELECT team_id, ${key} AS k, player_id, lines FROM ncaa_player_ids WHERE season = ${season})
    WHERE k IS NOT NULL AND k <> '' GROUP BY 1, 2`

/** The game's side a stats.ncaa.org team is, from its own name and its opponent's. */
const sideSql = (own: string, opp: string): string => `CASE
      WHEN ${own} = g.home_team_id THEN g.home_team_id WHEN ${own} = g.away_team_id THEN g.away_team_id
      WHEN ${opp} = g.home_team_id THEN g.away_team_id WHEN ${opp} = g.away_team_id THEN g.home_team_id END`

/** An empty SELECT of these columns, for a source the file does not hold. */
const none = (columns: Columns): string =>
  `SELECT ${columns.map(([n, t]) => `NULL::${t} AS ${n}`).join(', ')} WHERE false`

const PLAYERS = [1, 2, 3, 4, 5] as const

// ----- Shots ----------------------------------------------------------------------------------------

/**
 * stats.ncaa.org's shots keyed to the game, every season or one, in the shot charts' frame: its
 * coordinates are feet from the basket (`dist_ft` is their distance), so tenths are ten times them.
 * Every shot is located (`ncaa-data-sources.md`, "Coverage"). It gives no shot type and no assist, and
 * a period and clock only from 2026-27, so those read NULL where it has none.
 */
export function collegeShotsSelect(have: Have, season?: number): string {
  const t = COLLEGE_PLAYS.shots
  if (!have.tables.has(t)) return none(SHOT_COLUMNS)
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 's', name, type)
  const one = season === undefined ? '' : `WHERE s.season = ${season}`
  // By the file's stats.ncaa.org id, its ESPN id, then the season's name for it (`teamNamesSql`).
  const team = `CASE WHEN tm.team_id IN (g.home_team_id, g.away_team_id) THEN tm.team_id
                     WHEN te.team_id IN (g.home_team_id, g.away_team_id) THEN te.team_id
                     ELSE ${nameSide('tn.ids')} END`
  return `SELECT ${selectColumns(SHOT_COLUMNS, {
    game_id: 'g.game_id',
    season: 's.season',
    game_type: 'g.game_type',
    game_date: 'g.game_date',
    period: c('period'),
    clock: c('sec_left', 'DOUBLE'),
    // The file's season, the game's: a read of one season filters the file before anything is joined.
    team_id: 's.team',
    opponent_id: `CASE s.team WHEN g.home_team_id THEN g.away_team_id WHEN g.away_team_id THEN g.home_team_id END`,
    home: 's.team = g.home_team_id',
    // By id where the file gives one (a negative id of D28's kind where no row names it), by name
    // within the team where it gives none.
    player_id: `CASE WHEN ${c('shooter_player_id', 'VARCHAR')} IS NOT NULL
                     THEN coalesce(pi.player_id, -TRY_CAST(${c('shooter_player_id', 'VARCHAR')} AS BIGINT))
                     ELSE coalesce(pn.player_id, ${fallbackKey('g.season', 's.team', c('shooter_id', 'VARCHAR'))}) END`,
    free_throw: 'false',
    made: c('made', 'BOOLEAN'),
    value: c('point_value'),
    distance: `round(${c('dist_ft', 'DOUBLE')})`,
    x: `${c('shot_x', 'DOUBLE')} * 10`,
    y: `${c('shot_y', 'DOUBLE')} * 10`,
    action: c('shot_zone', 'VARCHAR')
  })}
    FROM (
      -- A team the file gives no id (a school outside Division I) is the game's other side, where every
      -- other shot of the game is one team's.
      SELECT s.*, coalesce(s.mapped, CASE WHEN min(s.mapped) OVER w = max(s.mapped) OVER w
                                          THEN CASE max(s.mapped) OVER w WHEN s.gh THEN s.ga WHEN s.ga THEN s.gh END
                                     END) AS team
      FROM (SELECT s.*, g.home_team_id AS gh, g.away_team_id AS ga, ${team} AS mapped
            FROM (SELECT * FROM ${t} s ${one}) s
            JOIN game g ON g.ncaa_game_id = ${c('contest_id', 'VARCHAR')}
            LEFT JOIN team tm ON tm.season = g.season AND tm.ncaa_team_id = ${c('ncaa_team_id')}
            LEFT JOIN team te ON te.season = g.season AND te.espn_team_id = ${c('espn_team_id', 'INTEGER')}
            LEFT JOIN (${teamNamesSql()}) tn
              ON tn.season = g.season AND tn.name = ${c('team_id', 'VARCHAR')}) s
      WINDOW w AS (PARTITION BY s.season, s.contest_id)) s
    JOIN game g ON g.ncaa_game_id = ${c('contest_id', 'VARCHAR')}
    LEFT JOIN ncaa_player_ids pi ON pi.season = g.season
      AND pi.ncaa_player_id = ${c('shooter_player_id', 'VARCHAR')}
    LEFT JOIN (SELECT season, team_id, k, arg_max(player_id, lines) AS player_id
               FROM (SELECT season, team_id, player_id, lines, ${shooterCodeSql('player')} AS k
                     FROM ncaa_player_ids)
               WHERE k <> '' GROUP BY 1, 2, 3) pn
      ON pn.season = g.season AND pn.team_id = s.team
      AND pn.k = lower(regexp_replace(${c('shooter_id', 'VARCHAR')}, '[^A-Za-z]', '', 'g'))`
}

// ----- Units on the floor -----------------------------------------------------------------------------

/** Each on-court count and the lineup file's column for it; the opponent's are `opp_` before it. */
const LINEUP_COUNTS: Record<OnCourtCount, string> = {
  poss: 'poss',
  pts: 'pts',
  fgm: 'fgm',
  fga: 'fga',
  fg3m: 'tpm',
  fg3a: 'tpa',
  ftm: 'ftm',
  fta: 'fta',
  oreb: 'orb',
  dreb: 'drb',
  ast: 'ast',
  stl: 'stl',
  blk: 'blk',
  tov: 'to',
  pf: 'foul'
}

/**
 * One season's units, from stats.ncaa.org's lineup file: each row is a team's stint with five players,
 * its minutes and its counts for and against (`ncaa-data-sources.md`, "Lineups, stints and
 * possessions"). A unit is the distinct players known, in ascending order, as the NBA's are; a row
 * whose team maps to neither side of the game is left out, and counted in the check.
 */
export function collegeUnitGameSql(have: Have, season: number): string {
  const t = COLLEGE_PLAYS.gameLineups
  if (!have.tables.has(t)) return none(UNIT_GAME_COLUMNS)
  const s = Number(season)
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 'l', name, type)
  // The same columns read through `x`, which holds every column of the file and the game's.
  const xc = (name: string, type = 'BIGINT'): string => column(have, t, 'x', name, type)
  const slot = (i: number): string => xc(`player_${i}`, 'VARCHAR')
  const ids = (i: number): string =>
    `CASE WHEN ${slot(i)} IS NOT NULL THEN coalesce(n${i}.player_id, ${fallbackKey(String(s), 'x.team_id', slot(i))}) END`
  const count = (k: string): string => `coalesce(sum(v_${k}), 0)::INTEGER`
  return `WITH g AS (SELECT game_id, ncaa_game_id, season, game_type, game_date, home_team_id, away_team_id
                     FROM game WHERE season = ${s} AND ncaa_game_id IS NOT NULL),
    tn AS (${teamNamesSql(String(s))}),
    pn AS (${playersByNameSql(String(s), nameKeySql("coalesce(name, replace(player, '.', ' '))"))}),
    x AS (
      SELECT l.*, g.game_id, g.season AS g_season, g.game_type, g.game_date, g.home_team_id, g.away_team_id,
             ${sideSql(nameSide('tt.ids'), nameSide('ot.ids'))} AS team_id
      FROM ${t} l JOIN g ON g.ncaa_game_id = ${c('contest_id', 'VARCHAR')}
      LEFT JOIN tn tt ON tt.name = ${c('team', 'VARCHAR')}
      LEFT JOIN tn ot ON ot.name = ${c('opponent', 'VARCHAR')}
      WHERE ${have.columns.get(t)?.has('season') ? `l.season = ${s}` : 'true'}
    ),
    units AS (
      SELECT x.g_season AS season, x.game_type, x.game_id, x.game_date, x.team_id,
             CASE x.team_id WHEN x.home_team_id THEN x.away_team_id ELSE x.home_team_id END AS opponent_id,
             x.team_id = x.home_team_id AS home,
             list_sort(list_distinct(list_filter([${PLAYERS.map(ids).join(', ')}], v -> v IS NOT NULL))) AS five,
             ${xc('duration_mins', 'DOUBLE')} * 60 AS v_secs,
             ${ON_COURT_COUNTS.map((k) => `${xc(LINEUP_COUNTS[k])} AS v_${k}, ${xc(`opp_${LINEUP_COUNTS[k]}`)} AS v_opp_${k}`).join(', ')}
      FROM x ${PLAYERS.map(
        (i) =>
          `LEFT JOIN pn n${i} ON n${i}.team_id = x.team_id AND n${i}.k = ${nameKeySql(lastFirst(slot(i)))}`
      ).join(' ')}
      WHERE x.team_id IS NOT NULL
    )
    SELECT season, game_type, game_id, game_date, team_id, opponent_id, home,
           ${PLAYERS.map((i) => `five[${i}] AS p${i}`).join(', ')}, len(five) = 5 AS complete,
           coalesce(sum(v_secs), 0) AS secs,
           ${ON_COURT_COUNTS.map((k) => `${count(k)} AS ${k}`).join(', ')},
           ${ON_COURT_COUNTS.map((k) => `${count(`opp_${k}`)} AS opp_${k}`).join(', ')}
    FROM units
    GROUP BY season, game_type, game_id, game_date, team_id, opponent_id, home, five`
}

/**
 * One season's player-games from `unit_game` (built first), as the NBA's: off the floor is the team's
 * line less the player's on-court line. The player's own counts are their box-score line in
 * `player_game`; a player kept under D28's key has none there, so theirs read 0.
 */
export function collegePlayerOnCourtSql(_have: Have, season: number): string {
  const s = Number(season)
  const parts = ['secs', ...ON_COURT_COUNTS, ...ON_COURT_COUNTS.map((c) => `opp_${c}`)]
  const sums = parts.map((p) => `sum(${p}) AS ${p}`).join(', ')
  return `WITH u AS (SELECT * FROM ${UNIT_GAME} WHERE season = ${s}),
    team AS (SELECT game_id, team_id, ${sums} FROM u GROUP BY 1, 2),
    onc AS (
      SELECT season, game_type, game_id, game_date, team_id, opponent_id, home, player_id, ${sums}
      FROM (SELECT *, unnest([p1, p2, p3, p4, p5]) AS player_id FROM u)
      WHERE player_id IS NOT NULL GROUP BY ALL
    ),
    own AS (SELECT game_id, player_id, ${OWN_COUNTS.join(', ')} FROM player_game WHERE season = ${s})
    SELECT o.season, o.game_type, o.game_id, o.game_date, o.team_id, o.opponent_id, o.home, o.player_id,
           ${parts.map((p) => `o.${p} AS on_${p}`).join(', ')},
           ${parts.map((p) => `t.${p} - o.${p} AS off_${p}`).join(', ')},
           ${OWN_COUNTS.map((c) => `coalesce(w.${c}, 0) AS p_${c}`).join(', ')},
           o.secs / 60.0 AS minutes
    FROM onc o JOIN team t ON t.game_id = o.game_id AND t.team_id = o.team_id
    LEFT JOIN own w ON w.game_id = o.game_id AND w.player_id = o.player_id`
}

// ----- The lineups tab ------------------------------------------------------------------------------

/** The lineups table's columns, as `lineupsBootstrap` creates them. */
export const COLLEGE_LINEUP_COLUMNS: Columns = [
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['team_id', 'BIGINT'],
  ...PLAYERS.map((i) => [`p${i}`, 'BIGINT'] as const),
  ['names', 'VARCHAR'],
  ...['games', 'minutes', ...LINEUP_STORED.map((c) => c.id)].map((c) => [c, 'DOUBLE'] as const)
]

/**
 * What the lineups tab reads of a college unit, summed over its games from `unit_game`: the counts
 * of the base and opponent groups and the possessions. The NBA's dashboards publish the other measures
 * (ratings, four factors, wins), which no college file has: they read NULL.
 */
const LINEUP_VALUES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [
      'fgm',
      'fga',
      'fg3m',
      'fg3a',
      'ftm',
      'fta',
      'oreb',
      'dreb',
      'ast',
      'tov',
      'stl',
      'blk',
      'pf',
      'pts'
    ].flatMap((k) => [
      [k, `sum(u.${k})`],
      [`opp_${k}`, `sum(u.opp_${k})`]
    ])
  ),
  reb: 'sum(u.oreb + u.dreb)',
  opp_reb: 'sum(u.opp_oreb + u.opp_dreb)',
  plus_minus: 'sum(u.pts - u.opp_pts)',
  possessions: 'sum(u.poss)'
}

/** One season's units for the lineups tab: the complete five-player units of `unit_game`. */
export function collegeLineupsSql(_have: Have, season: number): string {
  const s = Number(season)
  const stored = LINEUP_STORED.map((c) => `${LINEUP_VALUES[c.id] ?? 'NULL'}::DOUBLE AS ${c.id}`)
  return `WITH k AS (
      SELECT u.season, u.game_type, u.team_id, ${PLAYERS.map((i) => `u.p${i}`).join(', ')},
             count(DISTINCT u.game_id)::DOUBLE AS games, sum(u.secs) / 60.0 AS minutes,
             ${stored.join(', ')}
      FROM ${UNIT_GAME} u WHERE u.season = ${s} AND u.complete
      GROUP BY u.season, u.game_type, u.team_id, ${PLAYERS.map((i) => `u.p${i}`).join(', ')}
    )
    SELECT k.season, k.game_type, k.team_id, ${PLAYERS.map((i) => `k.p${i}`).join(', ')},
           concat_ws(' - ', ${PLAYERS.map((i) => `coalesce(n${i}.name, 'Unknown')`).join(', ')}) AS names,
           k.games, k.minutes, ${LINEUP_STORED.map((c) => `k.${c.id}`).join(', ')}
    FROM k ${PLAYERS.map((i) => `LEFT JOIN player n${i} ON n${i}.player_id = k.p${i}`).join(' ')}`
}

/** The builders the plays step runs for the college leagues after the shot tables, in order. */
export const COLLEGE_UNIT_BUILDERS: readonly PlayBuilder[] = [
  {
    table: UNIT_GAME,
    columns: UNIT_GAME_COLUMNS,
    select: collegeUnitGameSql,
    order: 'game_id, team_id, p1, p2, p3, p4, p5'
  },
  {
    table: PLAYER_ON_COURT,
    columns: PLAYER_ON_COURT_COLUMNS,
    select: collegePlayerOnCourtSql,
    order: 'game_id, team_id, player_id'
  },
  {
    table: LINEUPS,
    columns: COLLEGE_LINEUP_COLUMNS,
    select: collegeLineupsSql,
    order: 'team_id, game_type, p1, p2, p3, p4, p5'
  }
]

// ----- Views ----------------------------------------------------------------------------------------

/** The ten-player stints, stats.ncaa.org's, keyed to the game; read by the checks. */
export const STINTS_VIEW = 'stint'

export const STINT_COLUMNS: Columns = [
  ['game_id', 'VARCHAR'],
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['game_date', 'DATE'],
  ['period', 'INTEGER'],
  ['stint', 'INTEGER'],
  // Seconds since the tip-off, as the file gives them.
  ['start_seconds', 'DOUBLE'],
  ['end_seconds', 'DOUBLE'],
  ['secs', 'DOUBLE'],
  ['home_team_id', 'BIGINT'],
  ['away_team_id', 'BIGINT'],
  ['home_pts', 'INTEGER'],
  ['away_pts', 'INTEGER'],
  ['possessions', 'INTEGER'],
  ...PLAYERS.map((i) => [`home_${i}`, 'BIGINT'] as const),
  ...PLAYERS.map((i) => [`away_${i}`, 'BIGINT'] as const)
]

/**
 * The stints: stats.ncaa.org's home and away are its own (a neutral game may list them the other way
 * from ESPN), so each side is placed by its team's name. Players are named as its play by play names
 * them (`AJ.DYBANTSA`), `ncaa_player_ids.player`.
 */
function stintsSql(have: Have): string {
  const t = 'src_ncaa_matchup_stints'
  if (!have.tables.has(t)) return `CREATE OR REPLACE VIEW ${STINTS_VIEW} AS ${none(STINT_COLUMNS)}`
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 's', name, type)
  const who = (side: 'home' | 'away', i: number): string => {
    const team = side === 'home' ? 'x.h_team' : 'x.a_team'
    return `(SELECT coalesce(arg_max(p.player_id, p.lines), ${fallbackKey('x.season', team, `x.${side}_${i}`)})
             FROM ncaa_player_ids p WHERE p.season = x.season AND p.team_id = ${team} AND p.player = x.${side}_${i})`
  }
  return `CREATE OR REPLACE VIEW ${STINTS_VIEW} AS
    WITH tn AS (${teamNamesSql()}),
    x AS (
      SELECT s.*, g.game_id, g.season AS g_season, g.game_type, g.game_date AS g_date,
             ${sideSql(nameSide('h.ids'), nameSide('a.ids'))} AS h_team,
             ${sideSql(nameSide('a.ids'), nameSide('h.ids'))} AS a_team
      FROM ${t} s JOIN game g ON g.ncaa_game_id = ${c('contest_id', 'VARCHAR')}
      LEFT JOIN tn h ON h.season = g.season AND h.name = ${c('home', 'VARCHAR')}
      LEFT JOIN tn a ON a.season = g.season AND a.name = ${c('away', 'VARCHAR')}
    )
    SELECT ${selectColumns(STINT_COLUMNS, {
      game_id: 'x.game_id',
      season: 'x.g_season',
      game_type: 'x.game_type',
      game_date: 'x.g_date',
      period: 'x.period',
      stint: 'x.game_stint_num',
      start_seconds: 'x.start_seconds',
      end_seconds: 'x.end_seconds',
      secs: 'x.duration_seconds',
      home_team_id: 'x.h_team',
      away_team_id: 'x.a_team',
      home_pts: 'x.home_pts',
      away_pts: 'x.away_pts',
      possessions: 'x.n_possessions',
      ...Object.fromEntries(PLAYERS.map((i) => [`home_${i}`, who('home', i)])),
      ...Object.fromEntries(PLAYERS.map((i) => [`away_${i}`, who('away', i)]))
    })}
    FROM x`
}

/**
 * stats.ncaa.org's possessions under the columns the NBA's view has (`POSSESSION_COLUMNS`): each
 * possession's team, points, flags and the ten players by its player ids. It counts no shots or
 * rebounds per possession, so those read NULL; each row is a possession (`counted`).
 */
function possessionsSql(have: Have): string {
  const t = 'src_ncaa_possessions'
  if (!have.tables.has(t)) {
    return `CREATE OR REPLACE VIEW ${POSSESSIONS_VIEW} AS ${none(POSSESSION_COLUMNS)}`
  }
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 's', name, type)
  const team = (ncaa: string): string =>
    `(SELECT any_value(t.team_id) FROM team t WHERE t.season = g.season AND t.ncaa_team_id = TRY_CAST(${ncaa} AS BIGINT))`
  // By the file's player id; else by its play-by-play name within the team (`AJ.DYBANTSA`); else D28's.
  const who = (side: 'home' | 'away', i: number): string => {
    const team = side === 'home' ? 'x.h' : 'x.a'
    return `coalesce((SELECT any_value(p.player_id) FROM ncaa_player_ids p
               WHERE p.season = g.season AND p.ncaa_player_id = s.${side}_${i}_player_id),
              -TRY_CAST(s.${side}_${i}_player_id AS BIGINT),
              (SELECT arg_max(p.player_id, p.lines) FROM ncaa_player_ids p
               WHERE p.season = g.season AND p.team_id = ${team} AND p.player = s.${side}_${i}),
              CASE WHEN s.${side}_${i} IS NOT NULL THEN ${fallbackKey('g.season', team, `s.${side}_${i}`)} END)`
  }
  const offense = `CASE WHEN s.poss_team = s.home THEN x.h ELSE x.a END`
  return `CREATE OR REPLACE VIEW ${POSSESSIONS_VIEW} AS
    SELECT ${selectColumns(POSSESSION_COLUMNS, {
      game_id: 'g.game_id',
      season: 'g.season',
      game_type: 'g.game_type',
      game_date: 'g.game_date',
      period: c('period'),
      possession: c('poss_num'),
      team_id: offense,
      opponent_id: `CASE WHEN s.poss_team = s.home THEN x.a ELSE x.h END`,
      home: `${offense} = g.home_team_id`,
      start_type: c('start_event_type', 'VARCHAR'),
      counted: 'true',
      transition: `${c('is_transition')} = 1`,
      garbage_time: `${c('is_garbage_time')} = 1`,
      seconds_to_first_shot: c('first_shot_time', 'DOUBLE'),
      points: c('pts'),
      ...Object.fromEntries(
        PLAYERS.map((i) => [
          `off_${i}`,
          `CASE WHEN s.poss_team = s.home THEN ${who('home', i)} ELSE ${who('away', i)} END`
        ])
      ),
      ...Object.fromEntries(
        PLAYERS.map((i) => [
          `def_${i}`,
          `CASE WHEN s.poss_team = s.home THEN ${who('away', i)} ELSE ${who('home', i)} END`
        ])
      ),
      lineup_source: "'stats.ncaa.org'"
    })}
    FROM ${t} s JOIN game g ON g.ncaa_game_id = ${c('contest_id', 'VARCHAR')}
    CROSS JOIN LATERAL (
      SELECT ${sideSql(team('s.home_ncaa_team_id'), team('s.away_ncaa_team_id'))} AS h,
             ${sideSql(team('s.away_ncaa_team_id'), team('s.home_ncaa_team_id'))} AS a
    ) x
    WHERE s.poss_team IS NOT NULL`
}

/**
 * ESPN's officials under the columns the officials reads take (`officialsReads.ts`). ESPN gives a
 * name and no id, so an official is their name: two officials of one name would read as one, which no
 * season of the window was checked for beyond the names' count.
 */
function officialsSql(have: Have): string {
  const t = 'src_espn_officials'
  const c = (name: string, type = 'VARCHAR'): string => column(have, t, 'o', name, type)
  const name = `trim(${c('official_full_name')})`
  return `CREATE OR REPLACE VIEW ${COLLEGE_OFFICIALS_VIEW} AS
    SELECT (hash(lower(${name})) % 1000000000000)::BIGINT AS official_id,
           ${c('game_id')} AS game_id, ${name} AS first_name, NULL::VARCHAR AS last_name,
           NULL::VARCHAR AS jersey_num, ${c('official_position')} AS position,
           ${column(have, t, 'o', 'season')} AS season
    FROM ${have.tables.has(t) ? t : '(SELECT 1)'} o
    WHERE ${have.tables.has(t) ? `nullif(${name}, '') IS NOT NULL` : 'false'}`
}

/** The views the college leagues' plays step makes after its builders. */
export const collegeEventsSql = (have: Have, league: League): string[] => [
  `CREATE OR REPLACE VIEW ${SHOT_VIEWS.nba} AS ${collegeShotsSelect(have)}`,
  espnShotsSql(have, league),
  possessionsSql(have),
  stintsSql(have),
  officialsSql(have)
]
