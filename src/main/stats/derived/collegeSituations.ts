import type { League } from '@shared/leagues'
import { NCAA_POSSESSION_COUNTS, NCAA_SITUATION_COUNTS } from '@shared/stats/ncaaSplits'
import { PLAY_NCAA_FLAGS } from './collegePbp'
import { sideSql } from './collegePlays'
import type { PlayBuilder } from './playBuilders'
import { PLAY_TABLES } from './plays'
import { COLLEGE_PLAYS } from './playsRecipe'
import { column, type Have } from './sql'

/**
 * The college leagues' counts by situation, from stats.ncaa.org's own tags (part 4c of T1703.2), per
 * player-game and team-game, so the engine's `built` mechanism reads them under any filter. Counts
 * only; every share is divided when read (data policy 3). Kept under their own names beside ESPN's
 * box-score points in the paint, on the fast break and off turnovers (from 2023-24 only), never mixed
 * with them (D40, policy 5).
 *
 * - **From the play by play's tags** (`play_ncaa_flags`, read through `play_nba`, so a play counts as
 *   the play table counts it): points on the fast break and off a turnover, free throws among them as
 *   the file tags them; points, makes and attempts in the paint (twos only).
 * - **From the possessions** (`src_ncaa_possessions`, a team's alone): how many there were, how each
 *   one's first shot was taken (a three, a layup, dunk or tip-in, another two, or no shot), and how many
 *   ended in an assisted basket (`is_assisted` above 0: 58 of the 2025-26 men's 878,148 say 2).
 *
 * Left unread, measured: `poss_length`, whose team means equal the team box's seconds per possession
 * (already read, `ncaa_sec_per_poss`) to 0.24 s on average, r 0.98 over the men's 726 teams of 2025-26;
 * and `challenge_outcome` (from 2025-26), which no category of D52 holds yet.
 */

export const NCAA_SITUATION_PLAYER_GAME = 'ncaa_situation_player_game'
export const NCAA_SITUATION_TEAM_GAME = 'ncaa_situation_team_game'

type Columns = ReadonlyArray<readonly [string, string]>

/** How the possessions file spells each kind of first shot. */
const FIRST_SHOT = {
  ncaa_poss_first3: ['Three Point Jumper'],
  ncaa_poss_first_rim: ['Layup', 'Dunk', 'Tip In'],
  ncaa_poss_first_two: ['Two Point Jumper', 'Hook']
} as const

export { NCAA_POSSESSION_COUNTS, NCAA_SITUATION_COUNTS }

export const NCAA_SITUATION_TEAM_COMPONENTS: readonly string[] = [
  ...NCAA_SITUATION_COUNTS,
  ...NCAA_POSSESSION_COUNTS,
  ...NCAA_SITUATION_COUNTS.map((c) => `opp_${c}`),
  ...NCAA_POSSESSION_COUNTS.map((c) => `opp_${c}`)
]

/**
 * A player or team with no tagged play in a game counted none; a game the possessions file does not
 * hold is not a game of no possessions, so those read null.
 */
export const isSituationZero = (component: string): boolean =>
  !(NCAA_POSSESSION_COUNTS as readonly string[]).includes(component.replace(/^opp_/, ''))

const KEY: Columns = [
  ['game_id', 'VARCHAR'],
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['game_date', 'DATE']
]

export const NCAA_SITUATION_PLAYER_COLUMNS: Columns = [
  ...KEY,
  ['player_id', 'BIGINT'],
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ...NCAA_SITUATION_COUNTS.map((c) => [c, 'USMALLINT'] as const)
]

export const NCAA_SITUATION_TEAM_COLUMNS: Columns = [
  ...KEY,
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ...NCAA_SITUATION_TEAM_COMPONENTS.map((c) => [c, 'USMALLINT'] as const)
]

/** The tag counts over a group of tagged plays, each with its tags (`p`). */
const TAG_COUNTS = `
  coalesce(sum(p.pts) FILTER (WHERE p.fastbreak), 0)::USMALLINT AS ncaa_pts_fb,
  coalesce(sum(p.pts) FILTER (WHERE p.off_turnover), 0)::USMALLINT AS ncaa_pts_offtov,
  coalesce(sum(p.pts) FILTER (WHERE p.paint), 0)::USMALLINT AS ncaa_pts_paint,
  coalesce(sum(p.fgm) FILTER (WHERE p.paint), 0)::USMALLINT AS ncaa_fgm_paint,
  coalesce(sum(p.fga) FILTER (WHERE p.paint), 0)::USMALLINT AS ncaa_fga_paint`

/** One season's tagged plays with the play table's own counts. */
const taggedCte = (season: number): string => `tagged AS (
    SELECT p.game_id, p.season, p.game_type, p.game_date, p.player_id, p.team_id, p.opponent_id,
           p.pts, p.fgm, p.fga, f.fastbreak, f.off_turnover, f.paint
    FROM ${PLAY_TABLES.nba} p
    JOIN ${PLAY_NCAA_FLAGS} f ON f.game_id = p.game_id AND f.seq = p.seq
    WHERE p.season = ${Number(season)} AND f.season = ${Number(season)} AND p.team_id IS NOT NULL
  )`

/**
 * The play table and its tags are made by this step before any season is built, after the file's
 * shape (`have`) was read, so only what an earlier step builds is asked for.
 */
const ready = (have: Have): boolean => have.tables.has('game')

const none = (columns: Columns): string =>
  `SELECT ${columns.map(([n, t]) => `NULL::${t} AS ${n}`).join(', ')} WHERE false`

/** One season's player-game rows: a player with a tagged play in the game. */
export function collegeSituationPlayerSql(have: Have, season: number): string {
  if (!ready(have)) return none(NCAA_SITUATION_PLAYER_COLUMNS)
  return `WITH ${taggedCte(season)}
    SELECT p.game_id, p.season, any_value(p.game_type) AS game_type,
           any_value(p.game_date) AS game_date, p.player_id, p.team_id,
           any_value(p.opponent_id) AS opponent_id, ${TAG_COUNTS}
    FROM tagged p
    WHERE p.player_id IS NOT NULL
    GROUP BY p.game_id, p.season, p.player_id, p.team_id`
}

/** One season's possessions, each with its offence as the game's side, and its first shot. */
function possessionsCte(have: Have, season: number): string {
  const t = COLLEGE_PLAYS.possessions
  if (!have.tables.has(t)) {
    return `poss AS (SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS team_id,
      NULL::VARCHAR AS first_shot, NULL::INTEGER AS assisted WHERE false)`
  }
  const c = (name: string, type = 'VARCHAR'): string => column(have, t, 's', name, type)
  const team = (ncaa: string): string =>
    `(SELECT min(tm.team_id) FROM team tm WHERE tm.season = g.season AND tm.ncaa_team_id = ${ncaa})`
  const home = team(c('home_ncaa_team_id', 'BIGINT'))
  const away = team(c('away_ncaa_team_id', 'BIGINT'))
  return `poss AS (
    SELECT g.game_id,
           CASE WHEN ${c('poss_team')} = ${c('home')} THEN x.h ELSE x.a END AS team_id,
           ${c('first_shot_type')} AS first_shot, ${c('is_assisted', 'INTEGER')} AS assisted
    FROM ${t} s JOIN game g ON g.ncaa_game_id = ${c('contest_id')} AND g.season = ${Number(season)}
    CROSS JOIN LATERAL (SELECT ${sideSql(home, away)} AS h, ${sideSql(away, home)} AS a) x
    WHERE ${c('poss_team')} IS NOT NULL
  )`
}

const list = (xs: readonly string[]): string => xs.map((x) => `'${x}'`).join(', ')

/** One season's team-game rows, each with the other team's side as `opp_*`. */
export function collegeSituationTeamSql(have: Have, season: number, _league?: League): string {
  if (!ready(have)) return none(NCAA_SITUATION_TEAM_COLUMNS)
  const s = Number(season)
  const counted = NCAA_SITUATION_COUNTS.map((n) => `coalesce(o.${n}, 0)::USMALLINT AS ${n}`)
  const possessions = NCAA_POSSESSION_COUNTS.map((n) => `q.${n}`)
  const opp = [...NCAA_SITUATION_COUNTS, ...NCAA_POSSESSION_COUNTS].map((n) => `x.${n} AS opp_${n}`)
  return `WITH ${taggedCte(s)}, ${possessionsCte(have, s)},
  own AS (
    SELECT p.game_id, p.team_id, ${TAG_COUNTS} FROM tagged p GROUP BY 1, 2
  ), shots AS (
    SELECT game_id, team_id, count(*)::USMALLINT AS ncaa_poss_n,
           ${Object.entries(FIRST_SHOT)
             .map(
               ([n, xs]) => `count(*) FILTER (WHERE first_shot IN (${list(xs)}))::USMALLINT AS ${n}`
             )
             .join(',\n           ')},
           count(*) FILTER (WHERE first_shot IS NULL)::USMALLINT AS ncaa_poss_first_none,
           count(*) FILTER (WHERE assisted > 0)::USMALLINT AS ncaa_poss_ast
    FROM poss WHERE team_id IS NOT NULL GROUP BY 1, 2
  ),
  -- Both sides of every game the play table holds this season, so a side with no tagged play counts 0.
  sided AS (
    SELECT g.game_id, g.season, g.game_type, g.game_date,
           CASE WHEN h.home THEN g.home_team_id ELSE g.away_team_id END AS team_id,
           CASE WHEN h.home THEN g.away_team_id ELSE g.home_team_id END AS opponent_id
    FROM (SELECT DISTINCT game_id FROM ${PLAY_TABLES.nba} WHERE season = ${s}) d
    JOIN game g ON g.game_id = d.game_id
    CROSS JOIN (VALUES (true), (false)) h(home)
  ), lines AS (
    SELECT l.game_id, l.season, l.game_type, l.game_date, l.team_id, l.opponent_id,
           ${[...counted, ...possessions].join(', ')}
    FROM sided l
    LEFT JOIN own o ON o.game_id = l.game_id AND o.team_id = l.team_id
    LEFT JOIN shots q ON q.game_id = l.game_id AND q.team_id = l.team_id
  )
  SELECT l.*, ${opp.join(', ')}
  FROM lines l JOIN lines x ON x.game_id = l.game_id AND x.team_id = l.opponent_id`
}

/** Built after the play table and its tags (`COLLEGE_PBP_BUILDERS`). */
export const COLLEGE_SITUATION_BUILDERS: readonly PlayBuilder[] = [
  {
    table: NCAA_SITUATION_PLAYER_GAME,
    columns: NCAA_SITUATION_PLAYER_COLUMNS,
    select: collegeSituationPlayerSql,
    order: 'game_id, team_id, player_id'
  },
  {
    table: NCAA_SITUATION_TEAM_GAME,
    columns: NCAA_SITUATION_TEAM_COLUMNS,
    select: collegeSituationTeamSql,
    order: 'game_id, team_id'
  }
]
