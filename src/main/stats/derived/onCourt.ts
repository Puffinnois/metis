import type { PlayBuilder } from './playBuilders'
import { column, type Have } from './sql'

/**
 * Who was on the floor, and what happened while they were: the on-court layer (Plan T904, reference
 * sections 4, 5 and 12). Two tables, both counts only, so any group of games adds up exactly and a
 * rate is divided when read (data policy 3):
 *
 * - `unit_game`: one row per team, game and set of players on the floor together, with the counts
 *   for the team and against it while they were. Everything else is summed from it: a player's
 *   on-court line, two- to four-man groups, with-or-without.
 * - `player_on_court`: one row per player and game, the team's and the opponent's counts with the
 *   player on and off the floor, and the player's own counts, so the engine answers on-court ratings
 *   and the actual on-court rates at the player-game grain, under any filter on a game.
 *
 * How a play is credited, measured against the box score's minutes and plus-minus
 * (`nba-data-sources.md`, "On court"):
 * - The players are SportsDataverse's lineup of each play (`nba_stats_game_lineups`), which moves at
 *   the play where a substitution happens. The possessions file carries one lineup per possession,
 *   its first, so a player who comes in during a possession (between free throws, after a foul) would
 *   be missed: with it, on-court plus-minus matches the box score's on about a third of player-games.
 *   A play the lineup file has no row for takes the lineup of the play before it in the period.
 * - Free throws count for the players on the floor at the foul, as the official plus-minus counts
 *   them: a substitute who comes in between two free throws is not credited with the second.
 * - Time is the clock between a play and the one before it in the period, credited to the players
 *   on the floor at the play; a period's first play starts from the period's start.
 * - Possessions are the possessions file's (those it counts), each credited to the players on the
 *   floor at the play that ends it. They are SportsDataverse's derivation, not the NBA's count.
 * - Rebounds and turnovers are those of a player, as in the box score: team rebounds and team
 *   turnovers are left out (`play_nba`'s rule).
 */

/** The counts kept for each side: `pts` for the team, `opp_pts` against it. */
export const ON_COURT_COUNTS = [
  'poss',
  'pts',
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf'
] as const
export type OnCourtCount = (typeof ON_COURT_COUNTS)[number]

/** A player's own counts, from the plays, so a share of the team's on-court line is consistent. */
export const OWN_COUNTS = [
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'pts',
  'oreb',
  'dreb',
  'ast',
  'stl',
  'blk',
  'tov',
  'pf'
] as const

export const UNIT_GAME = 'unit_game'
export const PLAYER_ON_COURT = 'player_on_court'

/** The first season of the NBA's play by play, and of its lineups. */
export const ON_COURT_FIRST_SEASON = 1997

type Columns = ReadonlyArray<readonly [string, string]>

const SIDE_COUNTS: Columns = [
  ...ON_COURT_COUNTS.map((c) => [c, 'INTEGER'] as const),
  ...ON_COURT_COUNTS.map((c) => [`opp_${c}`, 'INTEGER'] as const)
]

const KEYS: Columns = [
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['game_id', 'VARCHAR'],
  ['game_date', 'DATE'],
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ['home', 'BOOLEAN']
]

const PLAYERS = ['p1', 'p2', 'p3', 'p4', 'p5'] as const

export const UNIT_GAME_COLUMNS: Columns = [
  ...KEYS,
  // The players, distinct, in ascending order; NULL past the players known.
  ...PLAYERS.map((p) => [p, 'BIGINT'] as const),
  // Five distinct players known: only such a row is a five-man unit.
  ['complete', 'BOOLEAN'],
  ['secs', 'DOUBLE'],
  ...SIDE_COUNTS
]

/** The parts of the team's and the opponent's line on and off the floor. */
const ON_OFF = (side: 'on' | 'off'): string[] => [
  `${side}_secs`,
  ...ON_COURT_COUNTS.map((c) => `${side}_${c}`),
  ...ON_COURT_COUNTS.map((c) => `${side}_opp_${c}`)
]

export const PLAYER_ON_COURT_COLUMNS: Columns = [
  ...KEYS,
  ['player_id', 'BIGINT'],
  ...ON_OFF('on').map((c) => [c, c.endsWith('secs') ? 'DOUBLE' : 'INTEGER'] as const),
  ...ON_OFF('off').map((c) => [c, c.endsWith('secs') ? 'DOUBLE' : 'INTEGER'] as const),
  ...OWN_COUNTS.map((c) => [`p_${c}`, 'INTEGER'] as const),
  // Minutes on the floor: what an On court count divides by per 36 or per 48, through `built`, in
  // place of the box score's minutes. Per 100 divides by `on_poss`, the possessions on the floor.
  ['minutes', 'DOUBLE']
]

/**
 * What the engine reads from `player_on_court` through a metric's `built`: every count and the
 * on-court minutes. The keys are not components, and games come from the box scores in scope.
 */
export const PLAYER_ON_COURT_COMPONENTS: readonly string[] = PLAYER_ON_COURT_COLUMNS.slice(
  KEYS.length + 1
).map(([n]) => n)

const createSql = (table: string, columns: Columns): string =>
  `CREATE TABLE IF NOT EXISTS ${table} (${columns.map(([n, t]) => `${n} ${t}`).join(', ')})`

/** The tables, empty, for a database the build has not reached: a read gets no rows. */
export const onCourtBootstrap = (): string[] => [
  createSql(UNIT_GAME, UNIT_GAME_COLUMNS),
  createSql(PLAYER_ON_COURT, PLAYER_ON_COURT_COLUMNS)
]

/** Seconds since the tip-off: 720 a quarter, 300 an overtime. */
const elapsed = (period: string, clock: string): string =>
  `CASE WHEN ${period} <= 4 THEN (${period} - 1) * 720 + 720 - ${clock}
        ELSE 2880 + (${period} - 5) * 300 + 300 - ${clock} END`

const periodStart = (period: string): string =>
  `CASE WHEN ${period} <= 4 THEN (${period} - 1) * 720 ELSE 2880 + (${period} - 5) * 300 END`

/** A list of ids as a unit's key: the distinct players known, ascending. */
const known = (list: string): string =>
  `list_sort(list_distinct(list_filter(${list}, x -> x IS NOT NULL)))`

/**
 * One season's units, from `play_nba`, the lineup file and the possessions file. What the sources
 * lack reads NULL: no lineup file, no units; no possessions file, no possessions.
 */
export function unitGameSql(have: Have, season: number): string {
  const lt = 'src_nba_game_lineups'
  const pt = 'src_nba_pbp'
  const st = 'src_nba_possessions'
  const lc = (n: string, type = 'BIGINT'): string => column(have, lt, 'l', n, type)
  const pc = (n: string, type = 'BIGINT'): string => column(have, pt, 'p', n, type)
  const sc = (n: string, type = 'BIGINT'): string => column(have, st, 's', n, type)
  const from = (t: string, alias: string): string =>
    have.tables.has(t) ? `${t} ${alias}` : `(SELECT 1) ${alias}`
  const side = (i: string): string =>
    `[${[1, 2, 3, 4, 5].map((n) => lc(`${i}_player_${n}`)).join(', ')}]`
  const s = Number(season)
  // A count for side `t` against side `o`, from the acting team of each play.
  const counts = (t: string, o: string): string => {
    const own = (flag: string, who: string, player = false): string =>
      `coalesce(sum(${flag}) FILTER (WHERE team_id = ${who}${player ? ' AND player_id IS NOT NULL' : ''}), 0)::INTEGER`
    const by = (who: string, them: string): Record<OnCourtCount, string> => ({
      poss: `count(*) FILTER (WHERE poss_off = ${who})::INTEGER`,
      pts: own('pts', who),
      fgm: own('fgm', who),
      fga: own('fga', who),
      fg3m: own('fg3m', who),
      fg3a: own('fg3a', who),
      ftm: own('ftm', who),
      fta: own('fta', who),
      oreb: own('oreb', who, true),
      dreb: own('dreb', who, true),
      ast: own('ast', who),
      // A steal or a block sits on the other team's turnover or miss.
      stl: own('stl', them),
      blk: own('blk', them),
      tov: own('tov', who, true),
      pf: own('pf', who)
    })
    const mine = by(t, o)
    const theirs = by(o, t)
    return [
      ...ON_COURT_COUNTS.map((c) => `${mine[c]} AS ${c}`),
      ...ON_COURT_COUNTS.map((c) => `${theirs[c]} AS opp_${c}`)
    ].join(',\n           ')
  }
  const games = `(SELECT game_id, nba_game_id, home_team_id, away_team_id FROM game WHERE season = ${s})`
  const unit = (sideFive: string, team: string, opp: string, home: string): string => `
    SELECT season, game_type, game_id, game_date, ${team} AS team_id, ${opp} AS opponent_id,
           ${home} AS home, ${known(sideFive)} AS five, sum(secs) AS secs,
           ${counts(team, opp)}
    FROM credited GROUP BY ALL`
  return `WITH g AS ${games},
    lu AS (
      SELECT ${lc('game_id', 'VARCHAR')} AS nba_game_id, ${lc('action_number')} AS action_number,
             any_value(${side('home')}) AS h, any_value(${side('away')}) AS a
      FROM ${from(lt, 'l')}
      WHERE ${have.tables.has(lt) ? `${lc('game_id', 'VARCHAR')} IN (SELECT nba_game_id FROM g)` : 'false'}
      GROUP BY 1, 2
    ),
    pbp AS (
      SELECT ${pc('game_id', 'VARCHAR')} AS nba_game_id, ${pc('order_index', 'INTEGER')} AS seq,
             any_value(${pc('action_number')}) AS action_number
      FROM ${from(pt, 'p')}
      WHERE ${have.tables.has(pt) ? `${pc('game_id', 'VARCHAR')} IN (SELECT nba_game_id FROM g)` : 'false'}
      GROUP BY 1, 2
    ),
    ends AS (
      SELECT g.game_id, ${sc('end_order_index', 'INTEGER')} AS seq, any_value(${sc('offense_team_id')}) AS poss_off
      FROM ${from(st, 's')} JOIN g ON g.nba_game_id = ${sc('game_id', 'VARCHAR')}
      WHERE coalesce(${sc('count_as_possession', 'BOOLEAN')}, true)
      GROUP BY 1, 2
    ),
    plays AS (
      SELECT x.season, x.game_type, x.game_id, x.game_date, x.seq, x.period, x.kind,
             x.team_id, x.player_id, g.home_team_id, g.away_team_id, e.poss_off,
             ${[
               'pts',
               'fgm',
               'fga',
               'fg3m',
               'fg3a',
               'ftm',
               'fta',
               'oreb',
               'dreb',
               'ast',
               'stl',
               'blk',
               'tov',
               'pf'
             ]
               .map((f) => `x.${f}::INTEGER AS ${f}`)
               .join(', ')},
             ${elapsed('x.period', 'x.clock')} AS el, ${periodStart('x.period')} AS p0,
             lu.h, lu.a
      FROM play_nba x JOIN g ON g.game_id = x.game_id
      LEFT JOIN pbp ON pbp.nba_game_id = g.nba_game_id AND pbp.seq = x.seq
      LEFT JOIN lu ON lu.nba_game_id = g.nba_game_id AND lu.action_number = pbp.action_number
      LEFT JOIN ends e ON e.game_id = x.game_id AND e.seq = x.seq
      WHERE x.season = ${s}
    ),
    filled AS (
      SELECT *,
             el - coalesce(lag(el) OVER w, p0) AS secs,
             coalesce(last_value(h IGNORE NULLS) OVER upto, first_value(h IGNORE NULLS) OVER w) AS hl,
             coalesce(last_value(a IGNORE NULLS) OVER upto, first_value(a IGNORE NULLS) OVER w) AS al
      FROM plays
      WINDOW w AS (PARTITION BY game_id, period ORDER BY seq),
             upto AS (PARTITION BY game_id, period ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    ),
    credited AS (
      SELECT *,
             CASE WHEN kind = 'free_throw'
                  THEN coalesce(last_value(CASE WHEN kind = 'foul' THEN hl END IGNORE NULLS) OVER upto, hl)
                  ELSE hl END AS home_five,
             CASE WHEN kind = 'free_throw'
                  THEN coalesce(last_value(CASE WHEN kind = 'foul' THEN al END IGNORE NULLS) OVER upto, al)
                  ELSE al END AS away_five
      FROM filled
      WINDOW upto AS (PARTITION BY game_id, period ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    ),
    units AS (
      ${unit('home_five', 'home_team_id', 'away_team_id', 'true')}
      UNION ALL
      ${unit('away_five', 'away_team_id', 'home_team_id', 'false')}
    )
    SELECT season, game_type, game_id, game_date, team_id, opponent_id, home,
           ${PLAYERS.map((p, i) => `five[${i + 1}] AS ${p}`).join(', ')}, len(five) = 5 AS complete,
           secs, ${SIDE_COUNTS.map(([n]) => n).join(', ')}
    FROM units WHERE team_id IS NOT NULL`
}

/**
 * One season's player-games, from `unit_game` (built first) and the player's own plays. Off the
 * floor is the team's line in the game less the player's on-court line, so on and off add up to the
 * team's exactly. A player the lineups never put on the floor has no row.
 */
export function playerOnCourtSql(_have: Have, season: number): string {
  const s = Number(season)
  const parts = ['secs', ...SIDE_COUNTS.map(([n]) => n)]
  const sums = parts.map((p) => `sum(${p}) AS ${p}`).join(', ')
  const own = OWN_COUNTS.map((c) => {
    // An assist, a steal or a block belongs to the player named for it.
    const who =
      c === 'ast' ? 'assist_id' : c === 'stl' ? 'steal_id' : c === 'blk' ? 'block_id' : 'player_id'
    return `sum(x.${c}::INTEGER) FILTER (WHERE x.${who} = o.player_id) AS ${c}`
  })
  return `WITH u AS (SELECT * FROM ${UNIT_GAME} WHERE season = ${s}),
    team AS (SELECT game_id, team_id, ${sums} FROM u GROUP BY 1, 2),
    onc AS (
      SELECT season, game_type, game_id, game_date, team_id, opponent_id, home, player_id, ${sums}
      FROM (SELECT *, unnest([${PLAYERS.join(', ')}]) AS player_id FROM u)
      WHERE player_id IS NOT NULL GROUP BY ALL
    ),
    plays AS (
      SELECT game_id, player_id, assist_id, steal_id, block_id, ${OWN_COUNTS.join(', ')}
      FROM play_nba WHERE season = ${s}
        AND (player_id IS NOT NULL OR assist_id IS NOT NULL OR steal_id IS NOT NULL OR block_id IS NOT NULL)
    ),
    own AS (
      SELECT o.game_id, o.player_id, ${own.join(', ')}
      FROM (SELECT DISTINCT game_id, player_id FROM onc) o
      JOIN plays x ON x.game_id = o.game_id
        AND o.player_id IN (x.player_id, x.assist_id, x.steal_id, x.block_id)
      GROUP BY 1, 2
    )
    SELECT o.season, o.game_type, o.game_id, o.game_date, o.team_id, o.opponent_id, o.home, o.player_id,
           ${parts.map((p) => `o.${p} AS on_${p}`).join(', ')},
           ${parts.map((p) => `t.${p} - o.${p} AS off_${p}`).join(', ')},
           ${OWN_COUNTS.map((c) => `coalesce(w.${c}, 0) AS p_${c}`).join(', ')},
           o.secs / 60.0 AS minutes
    FROM onc o JOIN team t ON t.game_id = o.game_id AND t.team_id = o.team_id
    LEFT JOIN own w ON w.game_id = o.game_id AND w.player_id = o.player_id`
}

/** In build order: `player_on_court` reads `unit_game`. */
export const ON_COURT_BUILDERS: PlayBuilder[] = [
  {
    table: UNIT_GAME,
    columns: UNIT_GAME_COLUMNS,
    select: unitGameSql,
    order: 'game_id, team_id, p1, p2, p3, p4, p5'
  },
  {
    table: PLAYER_ON_COURT,
    columns: PLAYER_ON_COURT_COLUMNS,
    select: playerOnCourtSql,
    order: 'game_id, team_id, player_id'
  }
]
