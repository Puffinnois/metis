import {
  AND_ONE_FOULS,
  AND_ONE_FREE_THROW,
  DEFENSE_THREE_SECONDS,
  ESPN_DRAWN_FOUL_TYPES,
  FOUL_KINDS,
  TECHNICAL_SUBTYPES,
  TRIP_FREE_THROWS,
  TURNOVER_KINDS,
  type PlayKind
} from '@shared/stats/playDetail'
import type { PlayBuilder } from './playBuilders'
import { elapsedSql, PLAY_TABLES } from './plays'
import { column, type Have } from './sql'

/**
 * Play-derived counts (reference section 16, with section 3's technicals, flagrants, ejections and
 * fouls drawn, and section 13's game flow), per player-game and team-game, so the engine's `built`
 * mechanism reads them at both grains under any filter. Counts only; every share and rate is divided
 * when read (data policy 3). The rules are data in `src/shared/stats/playDetail.ts`.
 *
 * Read from `play_nba` of the same season (built just before by `PLAY_BUILDERS`), whose flags already
 * hold who acted, assisted and stole. Fouls drawn are the exception: the NBA's feed never names the
 * fouled player, so they come from ESPN's play by play, which does from 2005-06 to 2016-17; ESPN's
 * rows are counted beside the NBA's, never merged into them.
 *
 * Assisted makes: the same `ast` flag of `play_nba` that the shot tables (Plan T903) read through the
 * shot file. Here they are split two and three and counted for the scorer and the passer; the check
 * shows the two tables agree wherever the shot file has the make.
 */

export const PLAY_DETAIL_PLAYER_GAME = 'play_player_game'
export const PLAY_DETAIL_TEAM_GAME = 'play_team_game'

const list = (xs: readonly string[]): string =>
  xs.map((x) => `'${x.replaceAll("'", "''")}'`).join(', ')

/** `subtype`'s kind, in SQL, as `kindOf` gives it. */
export function kindSql(kinds: readonly PlayKind[], subtype = 'subtype'): string {
  const whens = kinds
    .filter((k) => k.subtypes.length > 0)
    .map((k) => `WHEN trim(${subtype}) IN (${list(k.subtypes)}) THEN '${k.key}'`)
  return `CASE ${whens.join(' ')} ELSE 'other' END`
}

/** Each counted thing: its column, and the condition on a row of `play_nba` (or on its scorer). */
interface Count {
  name: string
  /** Who it belongs to: the acting player, the passer (`assist_id`), or ESPN's fouled player. */
  to: 'actor' | 'passer' | 'drawn'
  when: string
}

const SHOOTING = list(AND_ONE_FOULS)

/** Counts of the acting player, in the order the tables hold them. */
const ACTOR: Count[] = [
  { name: 'tov', to: 'actor', when: 'tov = 1' },
  { name: 'tov_live', to: 'actor', when: 'tov = 1 AND steal_id IS NOT NULL' },
  { name: 'tov_dead', to: 'actor', when: 'tov = 1 AND steal_id IS NULL' },
  ...TURNOVER_KINDS.map((k) => ({
    name: `tov_${k.key}`,
    to: 'actor' as const,
    when: `tov = 1 AND tkind = '${k.key}'`
  })),
  { name: 'pf', to: 'actor', when: 'pf = 1' },
  ...FOUL_KINDS.map((k) => ({
    name: `pf_${k.key}`,
    to: 'actor' as const,
    when: `pf = 1 AND fkind = '${k.key}'`
  })),
  {
    name: 'tech',
    to: 'actor',
    when: `kind = 'foul' AND trim(subtype) IN (${list(TECHNICAL_SUBTYPES)})`
  },
  {
    name: 'def3',
    to: 'actor',
    when: `kind = 'foul' AND trim(subtype) = '${DEFENSE_THREE_SECONDS}'`
  },
  { name: 'ejections', to: 'actor', when: "kind = 'ejection'" },
  { name: 'made2_ast', to: 'actor', when: 'fgm = 1 AND fg3m = 0 AND ast = 1' },
  { name: 'made2_unast', to: 'actor', when: 'fgm = 1 AND fg3m = 0 AND ast = 0' },
  { name: 'made3_ast', to: 'actor', when: 'fg3m = 1 AND ast = 1' },
  { name: 'made3_unast', to: 'actor', when: 'fg3m = 1 AND ast = 0' },
  { name: 'and1', to: 'actor', when: 'and_one' },
  { name: 'and1_ftm', to: 'actor', when: 'and_one AND ftm = 1' },
  {
    name: 'ft_trip2',
    to: 'actor',
    when: `kind = 'free_throw' AND trim(subtype) = '${TRIP_FREE_THROWS.two}'`
  },
  {
    name: 'ft_trip3',
    to: 'actor',
    when: `kind = 'free_throw' AND trim(subtype) = '${TRIP_FREE_THROWS.three}'`
  },
  {
    name: 'goaltend',
    to: 'actor',
    when: "kind = 'violation' AND trim(subtype) = 'Defensive Goaltending'"
  },
  { name: 'kicked', to: 'actor', when: "kind = 'violation' AND trim(subtype) = 'Kicked Ball'" }
]

/** Counts of the passer: assists on twos and on threes, so assist points are 2 and 3 of them. */
const PASSER: Count[] = [
  { name: 'ast2', to: 'passer', when: 'ast = 1 AND fg3m = 0' },
  { name: 'ast3', to: 'passer', when: 'ast = 1 AND fg3m = 1' }
]

/** Fouls drawn, from ESPN's play by play: all personal fouls, and shooting fouls. */
const DRAWN: Count[] = [
  { name: 'fd', to: 'drawn', when: 'true' },
  { name: 'fd_shooting', to: 'drawn', when: "type_text = 'Shooting Foul'" }
]

/** A player's counts, as the catalogue reads them. */
export const PLAY_DETAIL_COUNTS: readonly string[] = [...ACTOR, ...PASSER, ...DRAWN].map(
  (c) => c.name
)

/** A team's counts: its players' and its own rows (team turnovers, bench technicals), and team turnovers. */
const TEAM_COUNTS: readonly string[] = [
  ...ACTOR.map((c) => c.name),
  'tov_team',
  ...DRAWN.map((c) => c.name)
]

/**
 * The game flow of each team-game. Times are in tenths of a second, as integers. `flow_games` is 1 on
 * every row, the divisor of a per-game flow average: a game with no plays has no row and no flow.
 */
const FLOW_SIDED = ['largest_lead', 'lead_ds', 'best_run', 'drought_ds', 'drought_fg_ds'] as const
const FLOW_SHARED = ['lead_changes', 'times_tied', 'tied_ds', 'game_ds', 'flow_games'] as const

/** What a team table holds, `opp_` for the other team's side. */
export const PLAY_DETAIL_TEAM_COMPONENTS: readonly string[] = [
  ...TEAM_COUNTS,
  ...FLOW_SIDED,
  ...FLOW_SHARED,
  ...TEAM_COUNTS.map((c) => `opp_${c}`),
  ...FLOW_SIDED.map((c) => `opp_${c}`)
]

/** Counts read 0 for a row in scope with no row here; the flow reads null (a game with no plays). */
export const isPlayDetailZero = (component: string): boolean =>
  !(FLOW_SIDED as readonly string[]).includes(component.replace(/^opp_/, '')) &&
  !(FLOW_SHARED as readonly string[]).includes(component)

type Columns = ReadonlyArray<readonly [string, string]>

const KEY: Columns = [
  ['game_id', 'VARCHAR'],
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['game_date', 'DATE']
]

/** Per-game counts fit in a byte; times in tenths of a second do not. */
const typeOf = (c: string): string => (/_ds$/.test(c) ? 'INTEGER' : 'UTINYINT')

export const PLAY_DETAIL_PLAYER_COLUMNS: Columns = [
  ...KEY,
  ['player_id', 'BIGINT'],
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ...PLAY_DETAIL_COUNTS.map((c) => [c, typeOf(c)] as const)
]
export const PLAY_DETAIL_TEAM_COLUMNS: Columns = [
  ...KEY,
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ...PLAY_DETAIL_TEAM_COMPONENTS.map((c) => [c, typeOf(c)] as const)
]

/** The tables, empty, created on every open so a query before the first build reads no rows. */
export function playDetailBootstrap(): string[] {
  return (
    [
      [PLAY_DETAIL_PLAYER_GAME, PLAY_DETAIL_PLAYER_COLUMNS],
      [PLAY_DETAIL_TEAM_GAME, PLAY_DETAIL_TEAM_COLUMNS]
    ] as const
  ).map(
    ([t, cs]) => `CREATE TABLE IF NOT EXISTS ${t} (${cs.map(([n, ty]) => `${n} ${ty}`).join(', ')})`
  )
}

const sumOf = (c: Count): string => `coalesce(sum((${c.when})::INTEGER), 0)::UTINYINT AS ${c.name}`

/**
 * The season's plays, each with its turnover and foul kind and whether it is an and-one's free throw.
 * A play table with no rows (a season before the feed) gives no rows.
 */
function playsCte(season: number): string {
  const p = PLAY_TABLES.nba
  return `p AS (
    SELECT *, ${kindSql(TURNOVER_KINDS)} AS tkind, ${kindSql(FOUL_KINDS)} AS fkind
    FROM ${p} WHERE season = ${season}
  ), shot_fouls AS (
    SELECT DISTINCT game_id, period, clock, team_id FROM p
    WHERE kind = 'foul' AND trim(subtype) IN (${SHOOTING})
  ), makes AS (
    SELECT DISTINCT game_id, period, clock, player_id FROM p WHERE fgm = 1
  ), plays AS (
    SELECT p.*,
           (p.kind = 'free_throw' AND trim(p.subtype) = '${AND_ONE_FREE_THROW}'
            AND m.player_id IS NOT NULL AND f.team_id IS NOT NULL) AS and_one
    FROM p
    LEFT JOIN makes m ON m.game_id = p.game_id AND m.period = p.period AND m.clock = p.clock
                     AND m.player_id = p.player_id
    LEFT JOIN shot_fouls f ON f.game_id = p.game_id AND f.period = p.period AND f.clock = p.clock
                          AND f.team_id = p.opponent_id
  )`
}

/**
 * ESPN's fouls naming the fouled player, per player and game: the player's team in that game is the
 * one their box-score line names. What ESPN lacks reads no rows.
 */
function drawnCte(have: Have, season: number): string {
  const t = 'src_espn_pbp'
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 'e', name, type)
  if (!['player_ids', 'player_game'].every((x) => have.tables.has(x)) || !have.tables.has(t)) {
    return `drawn AS (SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS player_id,
                             NULL::BIGINT AS team_id, NULL::VARCHAR AS type_text WHERE false)`
  }
  const own = have.columns.get(t)?.has('season') ? `${c('season', 'INTEGER')} = ${season}` : 'true'
  return `drawn AS (
    SELECT g.game_id, pi.player_id, pg.team_id, ${c('type_text', 'VARCHAR')} AS type_text
    FROM ${t} e
    JOIN game g ON g.espn_game_id = ${c('game_id')}
    JOIN player_ids pi ON pi.espn_athlete_id = ${c('athlete_id_2')}
    JOIN player_game pg ON pg.game_id = g.game_id AND pg.player_id = pi.player_id
    WHERE g.season = ${season} AND ${own}
      AND ${c('season', 'INTEGER')} IS NOT DISTINCT FROM ${c('file_season', 'INTEGER')}
      AND ${c('type_text', 'VARCHAR')} IN (${list(ESPN_DRAWN_FOUL_TYPES)})
  )`
}

/** One season's player-game rows. */
export function playDetailPlayerSql(have: Have, season: number): string {
  const actor = ACTOR.map(sumOf).join(',\n           ')
  const passer = PASSER.map(sumOf).join(',\n           ')
  const drawn = DRAWN.map(sumOf).join(',\n           ')
  const zero = (cs: Count[]): string => cs.map((x) => `0::UTINYINT AS ${x.name}`).join(', ')
  const all = PLAY_DETAIL_COUNTS.map((n) => `sum(${n})::UTINYINT AS ${n}`).join(', ')
  return `WITH ${playsCte(season)}, ${drawnCte(have, season)},
  credits AS (
    SELECT game_id, player_id, any_value(team_id) AS team_id, ${actor}, ${zero(PASSER)}, ${zero(DRAWN)}
    FROM plays WHERE player_id IS NOT NULL GROUP BY 1, 2
    UNION ALL
    SELECT game_id, assist_id, any_value(team_id), ${zero(ACTOR)}, ${passer}, ${zero(DRAWN)}
    FROM plays WHERE assist_id IS NOT NULL GROUP BY 1, 2
    UNION ALL
    SELECT game_id, player_id, any_value(team_id), ${zero(ACTOR)}, ${zero(PASSER)}, ${drawn}
    FROM drawn GROUP BY 1, 2
  )
  SELECT c.game_id, g.season, g.game_type, g.game_date, c.player_id,
         any_value(c.team_id) AS team_id,
         any_value(CASE c.team_id WHEN g.home_team_id THEN g.away_team_id
                                  WHEN g.away_team_id THEN g.home_team_id END) AS opponent_id,
         ${all}
  FROM credits c JOIN game g ON g.game_id = c.game_id
  GROUP BY c.game_id, g.season, g.game_type, g.game_date, c.player_id
  ORDER BY c.player_id, g.game_date, c.game_id`
}

/**
 * The flow of each game from its scoring plays, by the rules of `flowSummary` in
 * `src/shared/stats/playDetail.ts`, as one row per side (`home`).
 */
function flowCte(): string {
  const t = elapsedSql('period', 'clock')
  return `scoring AS (
    SELECT game_id, seq, home, pts, fgm, home_after - away_after AS m, ${t} AS t
    FROM p WHERE pts > 0 AND home IS NOT NULL AND clock IS NOT NULL
  ), ends AS (
    SELECT game_id, ${elapsedSql('max(period)', '0')} AS len FROM p WHERE period IS NOT NULL GROUP BY 1
  ), marked AS (
    SELECT s.*, e.len,
           last_value(nullif(sign(m), 0) IGNORE NULLS) OVER (
             PARTITION BY s.game_id ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS last_leader,
           greatest(0, coalesce(lead(t) OVER (PARTITION BY s.game_id ORDER BY seq), e.len) - t) AS span,
           CASE WHEN home IS DISTINCT FROM lag(home) OVER (PARTITION BY s.game_id ORDER BY seq)
                THEN 1 ELSE 0 END AS new_run
    FROM scoring s JOIN ends e USING (game_id)
  ), runs AS (
    SELECT game_id, home, sum(pts) AS run
    FROM (SELECT *, sum(new_run) OVER (PARTITION BY game_id ORDER BY seq) AS run_id FROM marked)
    GROUP BY game_id, run_id, home
  ), gaps AS (
    SELECT game_id, home, max(greatest(gap, CASE WHEN final THEN len - t ELSE 0 END)) AS drought
    FROM (SELECT game_id, home, t, len,
                 t - coalesce(lag(t) OVER (PARTITION BY game_id, home ORDER BY seq), 0) AS gap,
                 row_number() OVER (PARTITION BY game_id, home ORDER BY seq DESC) = 1 AS final
          FROM marked)
    GROUP BY 1, 2
  ), fg_gaps AS (
    SELECT game_id, home, max(greatest(gap, CASE WHEN final THEN len - t ELSE 0 END)) AS drought
    FROM (SELECT game_id, home, t, len,
                 t - coalesce(lag(t) OVER (PARTITION BY game_id, home ORDER BY seq), 0) AS gap,
                 row_number() OVER (PARTITION BY game_id, home ORDER BY seq DESC) = 1 AS final
          FROM marked WHERE fgm = 1)
    GROUP BY 1, 2
  ), games AS (
    SELECT e.game_id, e.len,
           count(*) FILTER (WHERE sign(m) <> 0 AND last_leader IS NOT NULL
                              AND sign(m) <> last_leader) AS lead_changes,
           count(*) FILTER (WHERE m = 0) AS times_tied,
           greatest(0, coalesce(max(m), 0)) AS home_lead, greatest(0, coalesce(max(-m), 0)) AS away_lead,
           coalesce(sum(span) FILTER (WHERE m > 0), 0) AS home_time,
           coalesce(sum(span) FILTER (WHERE m < 0), 0) AS away_time,
           coalesce(sum(span) FILTER (WHERE m = 0), 0) + coalesce(min(t), e.len) AS tied_time
    FROM ends e LEFT JOIN marked USING (game_id)
    GROUP BY e.game_id, e.len
  ), sides AS (
    SELECT f.game_id, h.home, f.lead_changes, f.times_tied, f.len,
           CASE WHEN h.home THEN f.home_lead ELSE f.away_lead END AS largest_lead,
           CASE WHEN h.home THEN f.home_time ELSE f.away_time END AS lead_time,
           f.tied_time,
           coalesce((SELECT max(run) FROM runs r WHERE r.game_id = f.game_id AND r.home = h.home), 0) AS best_run,
           coalesce((SELECT drought FROM gaps d WHERE d.game_id = f.game_id AND d.home = h.home), f.len) AS drought,
           coalesce((SELECT drought FROM fg_gaps d WHERE d.game_id = f.game_id AND d.home = h.home), f.len) AS drought_fg
    FROM games f CROSS JOIN (VALUES (true), (false)) h(home)
  )`
}

const ds = (seconds: string): string => `round(10 * (${seconds}))::INTEGER`

/** One season's team-game rows, each with the other team's side as `opp_*`. */
export function playDetailTeamSql(have: Have, season: number): string {
  const actor = ACTOR.map(sumOf).join(',\n           ')
  const drawn = DRAWN.map(sumOf).join(',\n           ')
  const flow = [
    'f.largest_lead::UTINYINT AS largest_lead',
    `${ds('f.lead_time')} AS lead_ds`,
    'least(f.best_run, 255)::UTINYINT AS best_run',
    `${ds('f.drought')} AS drought_ds`,
    `${ds('f.drought_fg')} AS drought_fg_ds`,
    'least(f.lead_changes, 255)::UTINYINT AS lead_changes',
    'least(f.times_tied, 255)::UTINYINT AS times_tied',
    `${ds('f.tied_time')} AS tied_ds`,
    `${ds('f.len')} AS game_ds`,
    '1::UTINYINT AS flow_games'
  ]
  const opp = [...TEAM_COUNTS, ...FLOW_SIDED].map((n) => `o.${n} AS opp_${n}`)
  return `WITH ${playsCte(season)}, ${drawnCte(have, season)}, ${flowCte()},
  own AS (
    SELECT game_id, team_id, ${actor},
           coalesce(sum((tov = 1 AND player_id IS NULL)::INTEGER), 0)::UTINYINT AS tov_team
    FROM plays WHERE team_id IS NOT NULL GROUP BY 1, 2
  ), fouled AS (
    SELECT game_id, team_id, ${drawn} FROM drawn GROUP BY 1, 2
  ), sided AS (
    SELECT g.game_id, g.season, g.game_type, g.game_date,
           CASE WHEN s.home THEN g.home_team_id ELSE g.away_team_id END AS team_id,
           CASE WHEN s.home THEN g.away_team_id ELSE g.home_team_id END AS opponent_id,
           s.largest_lead, s.lead_time, s.best_run, s.drought, s.drought_fg, s.lead_changes,
           s.times_tied, s.tied_time, s.len
    FROM sides s JOIN game g ON g.game_id = s.game_id
  ), lines AS (
    SELECT f.game_id, f.season, f.game_type, f.game_date, f.team_id, f.opponent_id,
           ${TEAM_COUNTS.filter((n) => !DRAWN.some((d) => d.name === n))
             .map((n) => `coalesce(c.${n}, 0)::UTINYINT AS ${n}`)
             .join(', ')},
           ${DRAWN.map((d) => `coalesce(fd.${d.name}, 0)::UTINYINT AS ${d.name}`).join(', ')},
           ${flow.join(', ')}
    FROM sided f
    LEFT JOIN own c ON c.game_id = f.game_id AND c.team_id = f.team_id
    LEFT JOIN fouled fd ON fd.game_id = f.game_id AND fd.team_id = f.team_id
  )
  SELECT l.*, ${opp.join(', ')}
  FROM lines l JOIN lines o ON o.game_id = l.game_id AND o.team_id = l.opponent_id
  ORDER BY l.team_id, l.game_date, l.game_id`
}

export const PLAY_DETAIL_BUILDERS: PlayBuilder[] = [
  {
    table: PLAY_DETAIL_PLAYER_GAME,
    columns: PLAY_DETAIL_PLAYER_COLUMNS,
    select: playDetailPlayerSql
  },
  { table: PLAY_DETAIL_TEAM_GAME, columns: PLAY_DETAIL_TEAM_COLUMNS, select: playDetailTeamSql }
]
