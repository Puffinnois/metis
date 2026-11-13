import { mirrorOf, SPLITS, type SplitDef, type SplitPiece } from '@shared/stats/splits'
import type { PlayBuilder } from './playBuilders'
import { BOX_COUNTS } from './game'
import { possessionsSql } from './events'
import { column, per, type Have } from './sql'

/**
 * Box-score counts by split of a game (reference section 12), from the NBA's play by play: one row
 * per player, game and split in `split_player`, and per team, game and split in `split_team`, with
 * the opponent's counts in the same moments so ratings work. The rules are in
 * `src/shared/stats/splits.ts`; how each part is counted:
 *
 * - **Counts** sum `play_nba`'s flags as the box score counts them (`scripts/check-plays.mjs`): the
 *   actor's shots, points, fouls, and rebounds and turnovers where a player is named; assists to
 *   `assist_id`, steals and blocks to `steal_id` and `block_id`. A play is in a split by the score
 *   before it, from the side of the team the stat belongs to.
 * - **Time** is the seconds between plays, in the order of the clock, with the score after the last
 *   play: a team's is five times the time elapsed, as its box-score minutes are. A player's is the
 *   part of it they were on the court, from the substitutions: the period's starters are the feed's
 *   lineup on its first row, and a substitution's player coming in is named in its text ("SUB:
 *   Eason FOR Smith Jr."), matched to that team's players in the game. The lineups the feed carries
 *   on every row are not used for time: they change minutes after the substitution.
 * - **Possessions** are SportsDataverse's derived ones (`possession`, counted only), in a split by
 *   their first play: its period, clock and the score before it. Derived, not official.
 *
 * Built a season at a time by the play layer's builders, each season in one transaction, so a
 * screen reads a season's old rows or its new ones. A missing table or column reads NULL and never fails: without the substitutions'
 * text or the lineups, players' time reads NULL rather than a guess.
 */

export const SPLIT_PLAYER = 'split_player'
export const SPLIT_TEAM = 'split_team'

/** The counts stored; rebounds are offensive plus defensive, added when read. */
export const SPLIT_COUNTS = BOX_COUNTS.filter((c) => c !== 'reb')

const RAW = 'src_nba_pbp'
const TEN = [1, 2, 3, 4, 5].flatMap((i) => [`off_player_${i}`, `def_player_${i}`])
/** What players' time needs from the feed itself, beyond `play_nba`. */
const TIMED_COLUMNS = ['game_id', 'order_index', 'description', 'player_name', ...TEN]

export const SPLIT_PLAYER_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['season', 'INTEGER'],
  ['game_id', 'VARCHAR'],
  ['team_id', 'BIGINT'],
  ['player_id', 'BIGINT'],
  ['split', 'VARCHAR'],
  ['seconds', 'DOUBLE'],
  ...SPLIT_COUNTS.map((c) => [c, 'INTEGER'] as const)
]

export const SPLIT_TEAM_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['season', 'INTEGER'],
  ['game_id', 'VARCHAR'],
  ['team_id', 'BIGINT'],
  ['split', 'VARCHAR'],
  ['seconds', 'DOUBLE'],
  ...SPLIT_COUNTS.map((c) => [c, 'INTEGER'] as const),
  ...SPLIT_COUNTS.map((c) => [`opp_${c}`, 'INTEGER'] as const),
  ['poss', 'INTEGER'],
  ['opp_poss', 'INTEGER']
]

const tableSql = (name: string, columns: ReadonlyArray<readonly [string, string]>): string =>
  `CREATE TABLE IF NOT EXISTS ${name} (${columns.map(([n, t]) => `${n} ${t}`).join(', ')})`

/** The tables, empty, so a query before the first build reads no rows instead of failing. */
export function splitsBootstrap(): string[] {
  return [tableSql(SPLIT_PLAYER, SPLIT_PLAYER_COLUMNS), tableSql(SPLIT_TEAM, SPLIT_TEAM_COLUMNS)]
}

// ---- The rules in SQL -------------------------------------------------------------------------

/** The piece's period and margin, as a condition. */
function staticCond(p: SplitPiece, period: string, margin: string): string {
  const parts: string[] = []
  if (p.periods) {
    parts.push(`${period} >= ${p.periods[0]}`)
    if (p.periods[1] !== null) parts.push(`${period} <= ${p.periods[1]}`)
  }
  if (p.margin) {
    if (p.margin[0] !== null) parts.push(`${margin} >= ${p.margin[0]}`)
    if (p.margin[1] !== null) parts.push(`${margin} <= ${p.margin[1]}`)
  }
  if (p.absMax !== undefined) parts.push(`abs(${margin}) <= ${p.absMax}`)
  if (p.absMin !== undefined) parts.push(`abs(${margin}) >= ${p.absMin}`)
  return parts.length ? parts.join(' AND ') : 'true'
}

/** A moment (a play) in a piece: its clock in `(from, to]`, or `[0, to]`. */
function pieceSql(p: SplitPiece, period: string, clock: string, margin: string): string {
  const time = p.clock
    ? p.clock[0] > 0
      ? ` AND ${clock} > ${p.clock[0]} AND ${clock} <= ${p.clock[1]}`
      : ` AND ${clock} <= ${p.clock[1]}`
    : ''
  return `(${staticCond(p, period, margin)}${time})`
}

/** Whether a play is in a split. */
export const splitWhenSql = (s: SplitDef, period: string, clock: string, margin: string): string =>
  `coalesce(${s.pieces.map((p) => pieceSql(p, period, clock, margin)).join(' OR ')}, false)`

/** Every split a play is in, as a list of ids. */
export const splitListSql = (period: string, clock: string, margin: string): string =>
  `list_filter([${SPLITS.map(
    (s) => `CASE WHEN ${splitWhenSql(s, period, clock, margin)} THEN '${s.id}' END`
  ).join(', ')}], x -> x IS NOT NULL)`

/**
 * The seconds of the stretch from `hi` down to `lo` on the clock that are in a split, its period and
 * margin fixed: the part of it inside each piece's window.
 */
export function splitSecondsSql(
  s: SplitDef,
  period: string,
  lo: string,
  hi: string,
  margin: string
): string {
  return s.pieces
    .map((p) => {
      const span = p.clock
        ? `greatest(0, least(${hi}, ${p.clock[1]}) - greatest(${lo}, ${p.clock[0]}))`
        : `(${hi} - ${lo})`
      return `CASE WHEN coalesce(${staticCond(p, period, margin)}, false) THEN ${span} ELSE 0 END`
    })
    .join(' + ')
}

/** Every split a stretch has time in, as a list of `{split, s}`. */
const secondsListSql = (period: string, lo: string, hi: string, margin: string): string =>
  `list_filter([${SPLITS.map(
    (s) => `{'split': '${s.id}', 's': (${splitSecondsSql(s, period, lo, hi, margin)})::DOUBLE}`
  ).join(', ')}], x -> x.s > 0)`

/** The split the opponent's same moments fall in. */
const mirrorSql = (split: string): string => {
  const pairs = SPLITS.filter((s) => mirrorOf(s) !== s.id)
  return `CASE ${split} ${pairs.map((s) => `WHEN '${s.id}' THEN '${mirrorOf(s)}'`).join(' ')} ELSE ${split} END`
}

/** A name without accents or a suffix: the feed's "Schroder" for Schröder, "Boston" for Boston Jr. */
const bare = (name: string): string =>
  `regexp_replace(strip_accents(${name}), '\\s+(Jr\\.?|Sr\\.?|II|III|IV)$', '')`

/** Seconds in a period: 12 minutes in regulation, 5 in overtime. */
const periodLength = (period: string): string =>
  `CASE WHEN ${period} <= 4 THEN 720.0 ELSE 300.0 END`

// ---- The season's rows ------------------------------------------------------------------------

const timedBy = (have: Have): boolean =>
  have.tables.has(RAW) && TIMED_COLUMNS.every((c) => have.columns.get(RAW)?.has(c))

/** The season's plays, with the margin before and after each, from the home side. */
const playsCte = (season: number): string => `split_plays AS (
    SELECT p.game_id, p.seq, p.period, p.clock, p.team_id, p.opponent_id, p.player_id, p.assist_id,
           p.steal_id, p.block_id, p.kind, ${['fga', 'fgm', 'fg3a', 'fg3m', 'fta', 'ftm', 'pts', 'oreb', 'dreb', 'tov', 'pf'].map((f) => `p.${f}`).join(', ')},
           g.home_team_id, g.away_team_id,
           (p.home_after - CASE WHEN p.home THEN p.pts ELSE 0 END)
             - (p.away_after - CASE WHEN NOT p.home THEN p.pts ELSE 0 END) AS mh_before,
           p.home_after - p.away_after AS mh_after
    FROM play_nba p JOIN game g ON g.game_id = p.game_id
    WHERE p.season = ${season} AND p.period IS NOT NULL AND p.clock IS NOT NULL
  )`

/**
 * The stretches between plays, in the order of the clock (a play listed late keeps its time), each
 * with the score after the last play before it.
 */
const SEGMENTS = `split_segments AS (
    SELECT game_id, period, home_team_id, away_team_id, mh_after AS mh,
           clock AS hi, coalesce(lead(clock) OVER w, 0) AS lo
    FROM split_plays
    WINDOW w AS (PARTITION BY game_id, period ORDER BY clock DESC, seq)
    QUALIFY clock > coalesce(lead(clock) OVER w, 0)
  )`

/**
 * Each player's stretches on the court, from the substitutions. A player taken off who was never
 * put on is taken as on from the period's start; one put on and never taken off stays to its end.
 */
function stintsCtes(have: Have, season: number): string {
  if (!timedBy(have)) {
    return `split_stints AS (
      SELECT NULL::VARCHAR AS game_id, NULL::INTEGER AS period, NULL::BIGINT AS team_id,
             NULL::BIGINT AS player_id, NULL::DOUBLE AS hi, NULL::DOUBLE AS lo WHERE false
    )`
  }
  const c = (name: string, type = 'BIGINT'): string => column(have, RAW, 'r', name, type)
  const initial = c('player_name_i', 'VARCHAR')
  const own = have.columns.get(RAW)?.has('season') ? `r.season = ${season}` : 'true'
  return `st_rows AS (
    SELECT p.game_id, p.seq, p.period, p.clock, p.team_id, p.player_id, p.kind,
           ${c('description', 'VARCHAR')} AS description,
           ${bare(`nullif(trim(${c('player_name', 'VARCHAR')}), '')`)} AS player_name,
           ${bare(`nullif(trim(${initial}), '')`)} AS player_initial,
           [${TEN.map((n) => c(n)).join(', ')}] AS ten
    FROM split_plays p JOIN game g ON g.game_id = p.game_id
    JOIN ${RAW} r ON ${c('game_id', 'VARCHAR')} = g.nba_game_id AND ${c('order_index', 'INTEGER')} = p.seq
    WHERE ${own}
  ), st_box AS (
    SELECT b.game_id, b.team_id, b.player_id, ${bare('pl.name')} AS full_name
    FROM player_game b LEFT JOIN player pl ON pl.player_id = b.player_id
    WHERE b.season = ${season}
  ), st_names AS (
    SELECT b.*, f.player_name, f.player_initial
    FROM st_box b LEFT JOIN (
      SELECT DISTINCT game_id, player_id, player_name, player_initial FROM st_rows
      WHERE player_id IS NOT NULL AND player_name IS NOT NULL
    ) f ON f.game_id = b.game_id AND f.player_id = b.player_id
  ), st_subs AS (
    SELECT game_id, seq, period, clock, team_id, player_id AS out_id,
           ${bare("trim(regexp_extract(description, '^SUB: (.*) FOR ', 1))")} AS in_name
    FROM st_rows WHERE kind = 'substitution' AND player_id IS NOT NULL AND team_id IS NOT NULL
  ), st_cand AS (
    SELECT s.game_id, s.seq, s.period, s.clock, n.player_id
    FROM st_subs s JOIN st_names n
      ON n.game_id = s.game_id AND n.team_id = s.team_id AND n.player_id <> s.out_id
     AND (n.player_name = s.in_name OR n.player_initial = s.in_name OR n.full_name = s.in_name
          OR n.full_name LIKE '% ' || s.in_name
          OR (s.in_name LIKE '%. %'
              AND n.full_name LIKE split_part(s.in_name, '. ', 1) || '% ' || split_part(s.in_name, '. ', 2)))
    WHERE s.in_name <> ''
  ), st_next AS (
    -- Two players of one name: the one the feed lists on the court at the next play decides.
    SELECT k.game_id, k.seq, arg_min(r.ten, r.seq) AS ten
    FROM (SELECT DISTINCT game_id, seq, period, clock FROM st_cand) k
    JOIN st_rows r ON r.game_id = k.game_id AND r.period = k.period AND r.clock < k.clock
    GROUP BY 1, 2
  ), st_matched AS (
    SELECT k.game_id, k.seq,
           CASE WHEN count(DISTINCT k.player_id) = 1 THEN any_value(k.player_id)
                WHEN count(DISTINCT k.player_id) FILTER (WHERE list_contains(t.ten, k.player_id)) = 1
                THEN any_value(k.player_id) FILTER (WHERE list_contains(t.ten, k.player_id)) END AS in_id
    FROM st_cand k LEFT JOIN st_next t ON t.game_id = k.game_id AND t.seq = k.seq
    GROUP BY 1, 2
  ), st_firsts AS (
    SELECT game_id, period, ten FROM st_rows
    QUALIFY row_number() OVER (PARTITION BY game_id, period ORDER BY seq) = 1
  ), st_starters AS (
    SELECT f.game_id, f.period, b.team_id, b.player_id
    FROM (SELECT game_id, period, unnest(ten) AS player_id FROM st_firsts) f
    JOIN st_box b ON b.game_id = f.game_id AND b.player_id = f.player_id
  ), st_ev AS (
    SELECT game_id, period, -1 AS seq, ${periodLength('period')} AS clock, team_id, player_id,
           true AS on_court
    FROM st_starters
    UNION ALL
    SELECT s.game_id, s.period, s.seq, s.clock, s.team_id, m.in_id, true
    FROM st_subs s JOIN st_matched m ON m.game_id = s.game_id AND m.seq = s.seq
    WHERE m.in_id IS NOT NULL
    UNION ALL
    SELECT game_id, period, seq, clock, team_id, out_id, false FROM st_subs
  ), st_paired AS (
    SELECT *, lag(on_court) OVER w AS was_on, lag(clock) OVER w AS was_at,
           lead(on_court) OVER w AS next_on
    FROM st_ev WINDOW w AS (PARTITION BY game_id, period, player_id ORDER BY seq)
  ), split_stints AS (
    SELECT game_id, period, team_id, player_id,
           CASE WHEN was_on THEN was_at ELSE ${periodLength('period')} END AS hi, clock AS lo
    FROM st_paired WHERE NOT on_court
    UNION ALL
    SELECT game_id, period, team_id, player_id, clock AS hi, 0.0 AS lo
    FROM st_paired WHERE on_court AND next_on IS NULL
  )`
}

/**
 * SportsDataverse's possessions of the season, read from the source as the `possession` view reads
 * it: the view is replaced only after the play tables are built, so a first build would find it
 * empty.
 */
const possessionsCte = (have: Have, season: number): string =>
  `split_poss_src AS (
    SELECT * FROM (${possessionsSql(have).replace(/^\s*CREATE OR REPLACE VIEW \w+ AS/, '')})
    WHERE season = ${season}
  )`

const countsOf = (alias = ''): string =>
  SPLIT_COUNTS.map((c) => `sum(${alias}${c})::INTEGER AS ${c}`).join(', ')

/**
 * Each credit a play gives, to the team and the player it belongs to: the actor's counts (rebounds
 * and turnovers only where a player is named, as the box score counts them), the assist, the steal
 * and the block. Tagged with every split the play is in, from that team's side.
 */
const CREDITS = `credits AS (
    SELECT game_id, period, clock, mh_before, home_team_id, team_id AS team, player_id AS player,
           fga, fgm, fg3a, fg3m, fta, ftm, pts,
           CASE WHEN player_id IS NOT NULL THEN oreb ELSE 0 END AS oreb,
           CASE WHEN player_id IS NOT NULL THEN dreb ELSE 0 END AS dreb,
           0 AS ast, 0 AS stl, 0 AS blk,
           CASE WHEN player_id IS NOT NULL THEN tov ELSE 0 END AS tov, pf
    FROM split_plays
    WHERE team_id IS NOT NULL AND fga + fta + pts + oreb + dreb + tov + pf > 0
    UNION ALL
    SELECT game_id, period, clock, mh_before, home_team_id, team_id, assist_id,
           0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0
    FROM split_plays WHERE assist_id IS NOT NULL AND team_id IS NOT NULL
    UNION ALL
    SELECT game_id, period, clock, mh_before, home_team_id, opponent_id, steal_id,
           0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0
    FROM split_plays WHERE steal_id IS NOT NULL AND opponent_id IS NOT NULL
    UNION ALL
    SELECT game_id, period, clock, mh_before, home_team_id, opponent_id, block_id,
           0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0
    FROM split_plays WHERE block_id IS NOT NULL AND opponent_id IS NOT NULL
  ), tagged AS (
    SELECT *, unnest(${splitListSql('period', 'clock', 'CASE WHEN team = home_team_id THEN mh_before ELSE -mh_before END')}) AS split
    FROM credits
  )`

/** A team's rows of one season: its counts, the opponent's in the same moments, time, possessions. */
export function splitTeamSelect(have: Have, season: number): string {
  const margin = 'CASE WHEN x.home THEN p.mh_before ELSE -p.mh_before END'
  return `WITH ${playsCte(season)}, ${SEGMENTS}, ${possessionsCte(have, season)}, ${CREDITS},
  counts AS (
    SELECT game_id, team AS team_id, split, ${countsOf()} FROM tagged GROUP BY 1, 2, 3
  ), sides AS (
    SELECT s.*, v.home, CASE WHEN v.home THEN s.home_team_id ELSE s.away_team_id END AS team_id,
           CASE WHEN v.home THEN s.mh ELSE -s.mh END AS margin
    FROM split_segments s CROSS JOIN (VALUES (true), (false)) v(home)
  ), time AS (
    SELECT game_id, team_id, t.split, 5 * sum(t.s) AS seconds
    FROM (SELECT game_id, team_id, unnest(${secondsListSql('period', 'lo', 'hi', 'margin')}) AS t FROM sides)
    GROUP BY 1, 2, 3
  ), poss AS (
    SELECT game_id, team_id, split, count(*)::INTEGER AS poss
    FROM (
      SELECT x.game_id, x.team_id,
             unnest(${splitListSql('x.period', 'x.start_clock', margin)}) AS split
      FROM split_poss_src x LEFT JOIN split_plays p ON p.game_id = x.game_id AND p.seq = x.start_seq
      WHERE coalesce(x.counted, true) AND x.team_id IS NOT NULL
    ) GROUP BY 1, 2, 3
  ), own AS (
    SELECT o.*, CASE WHEN o.team_id = g.home_team_id THEN g.away_team_id ELSE g.home_team_id END AS opp_id
    FROM (SELECT * FROM counts FULL JOIN time USING (game_id, team_id, split)
          FULL JOIN poss USING (game_id, team_id, split)) o
    JOIN game g ON g.game_id = o.game_id
  ), keys AS (
    -- A side with a row has its opponent's in the mirrored split, even one that scored at a moment
    -- with no time, so the two sides' rows always add up to each other.
    SELECT game_id, team_id, split FROM own
    UNION SELECT game_id, opp_id, ${mirrorSql('split')} FROM own
  )
  SELECT ${season} AS season, k.game_id, k.team_id, k.split, coalesce(o.seconds, 0)::DOUBLE AS seconds,
         ${SPLIT_COUNTS.map((c) => `coalesce(o.${c}, 0)::INTEGER AS ${c}`).join(', ')},
         ${SPLIT_COUNTS.map((c) => `coalesce(t.${c}, 0)::INTEGER AS opp_${c}`).join(', ')},
         o.poss::INTEGER AS poss, t.poss::INTEGER AS opp_poss
  FROM keys k
  LEFT JOIN own o ON o.game_id = k.game_id AND o.team_id = k.team_id AND o.split = k.split
  LEFT JOIN own t ON t.game_id = k.game_id AND t.opp_id = k.team_id
   AND t.split = ${mirrorSql('k.split')}
  ORDER BY k.game_id, k.team_id, k.split`
}

/** A player's rows of one season: their counts and their time on the court. */
export function splitPlayerSelect(have: Have, season: number): string {
  const timed = timedBy(have)
  return `WITH ${playsCte(season)}, ${SEGMENTS}, ${stintsCtes(have, season)}, ${CREDITS},
  counts AS (
    SELECT game_id, team AS team_id, player AS player_id, split, ${countsOf()}
    FROM tagged WHERE player IS NOT NULL GROUP BY 1, 2, 3, 4
  ), time AS (
    SELECT game_id, team_id, player_id, t.split, sum(t.s) AS seconds
    FROM (
      SELECT st.game_id, st.team_id, st.player_id,
             unnest(${secondsListSql('s.period', 's.lo', 's.hi', 'CASE WHEN st.team_id = s.home_team_id THEN s.mh ELSE -s.mh END')}) AS t
      FROM split_stints st JOIN split_segments s
        ON s.game_id = st.game_id AND s.period = st.period AND s.lo >= st.lo AND s.hi <= st.hi
    ) GROUP BY 1, 2, 3, 4
  )
  SELECT ${season} AS season, game_id, team_id, player_id, split,
         ${timed ? 'coalesce(seconds, 0)' : 'NULL'}::DOUBLE AS seconds,
         ${SPLIT_COUNTS.map((c) => `coalesce(${c}, 0)::INTEGER AS ${c}`).join(', ')}
  FROM counts FULL JOIN time USING (game_id, team_id, player_id, split)
  ORDER BY game_id, team_id, player_id, split`
}

/** What a season's rows need; without one of them the season reads no rows. */
const NEEDS = ['play_nba', 'game', 'player', 'player_game']

/** A SELECT of the columns, typed, with no rows. */
const noRows = (columns: ReadonlyArray<readonly [string, string]>): string =>
  `SELECT ${columns.map(([n, t]) => `NULL::${t} AS ${n}`).join(', ')} WHERE false`

const guarded =
  (
    columns: ReadonlyArray<readonly [string, string]>,
    select: (have: Have, season: number) => string
  ) =>
  (have: Have, season: number): string =>
    NEEDS.every((t) => have.tables.has(t)) ? select(have, season) : noRows(columns)

/**
 * The two tables as builders of the play layer (`PLAY_BUILDERS` in `playBuilders.ts`), which
 * replaces a season of each in one transaction after that season's plays. Teams first, then players.
 * Bump `PLAYS_VERSION` there when a rule or a column changes.
 */
export const SPLIT_BUILDERS: readonly PlayBuilder[] = [
  {
    table: SPLIT_TEAM,
    columns: SPLIT_TEAM_COLUMNS,
    select: guarded(SPLIT_TEAM_COLUMNS, splitTeamSelect)
  },
  {
    table: SPLIT_PLAYER,
    columns: SPLIT_PLAYER_COLUMNS,
    select: guarded(SPLIT_PLAYER_COLUMNS, splitPlayerSelect)
  }
]

// ---- How the engine reads them ----------------------------------------------------------------

/** The game's contribution, as PIE counts it, over one side's counts. */
const pieOf = (p: string): string =>
  `${p}pts + ${p}fgm + ${p}ftm - ${p}fga - ${p}fta + ${p}dreb + 0.5 * ${p}oreb + ${p}ast + ${p}stl
   + 0.5 * ${p}blk - ${p}pf - ${p}tov`

const withReb = (alias: string, prefix = ''): Record<string, string> => ({
  ...Object.fromEntries(SPLIT_COUNTS.map((c) => [c, `${alias}.${prefix}${c}`])),
  reb: `(${alias}.${prefix}oreb + ${alias}.${prefix}dreb)`
})

/**
 * One half of reference section 5's rebound-adjusted estimate, over split counts. Kept for the
 * metrics that name it, beside the counted possessions.
 */
const brefHalf = (us: string, them: string): string =>
  `${us}fga + 0.4 * ${us}fta
   - 1.07 * ${per(`${us}oreb`, `${us}oreb + ${them}dreb`)} * (${us}fga - ${us}fgm) + ${us}tov`

/**
 * What each player component reads under a split: `sp` is the player's split row, `st` their
 * team's, `w` their `player_game` line. The team's context is its counts in the same split, and
 * the on-court estimates divide by the player's share of the team's time in it, as the box-score
 * ones do over the game. Components left out have no answer under a split.
 */
export const SPLIT_PLAYER_SQL: Readonly<Record<string, string>> = (() => {
  const own = withReb('sp')
  const tm = withReb('st')
  const opp = withReb('st', 'opp_')
  const share = per('5.0 * sp.seconds', 'st.seconds')
  return {
    games: '1',
    wins: 'w.wins',
    losses: 'w.losses',
    seconds: 'sp.seconds',
    minutes: 'sp.seconds / 60.0',
    ...own,
    ...Object.fromEntries(Object.entries(tm).map(([c, sql]) => [`tm_${c}`, sql])),
    ...Object.fromEntries(Object.entries(opp).map(([c, sql]) => [`opp_${c}`, sql])),
    tm_seconds: 'st.seconds',
    pie_total: `(${pieOf('st.')}) + (${pieOf('st.opp_')})`,
    x_ast_den: `${share} * st.fgm - sp.fgm`,
    x_orb_den: `${share} * (st.oreb + st.opp_dreb)`,
    x_drb_den: `${share} * (st.dreb + st.opp_oreb)`,
    x_trb_den: `${share} * (st.oreb + st.dreb + st.opp_oreb + st.opp_dreb)`,
    x_stl_den: `${share} * 0.5 * (st.poss + st.opp_poss)`,
    x_blk_den: `${share} * (st.opp_fga - st.opp_fg3a)`,
    x_usg_den: `${share} * (st.fga + 0.44 * st.fta + st.tov)`,
    on_poss: `${share} * 0.5 * (st.poss + st.opp_poss)`
  }
})()

/** What each team component reads under a split: `st` is the team's split row, `w` its game. */
export const SPLIT_TEAM_SQL: Readonly<Record<string, string>> = (() => {
  const own = withReb('st')
  const opp = withReb('st', 'opp_')
  return {
    games: '1',
    box_games: '1',
    wins: 'w.wins',
    losses: 'w.losses',
    points_for: 'st.pts',
    points_against: 'st.opp_pts',
    seconds: 'st.seconds',
    minutes: 'st.seconds / 60.0',
    ...own,
    ...Object.fromEntries(Object.entries(opp).map(([c, sql]) => [`opp_${c}`, sql])),
    poss: 'st.poss',
    opp_poss: 'st.opp_poss',
    poss_sym: '0.5 * (st.poss + st.opp_poss)',
    poss_bref: `0.5 * (${brefHalf('st.', 'st.opp_')} + ${brefHalf('st.opp_', 'st.')})`,
    pie_total: `(${pieOf('st.')}) + (${pieOf('st.opp_')})`
  }
})()
