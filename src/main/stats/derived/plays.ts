import { eventsBootstrap } from './events'
import { column, type Have } from './sql'

/**
 * The play layer: every play of both play-by-play sources keyed to the `game` and `team` tables,
 * with counting flags, so later work sums flags instead of parsing text. The two sources sit side by
 * side in their own tables and are never merged (data policy 5); `plays` is a view over both with a
 * `source` column. Measured choices (view or table, the default source) are in
 * `docs/reference/nba-data-sources.md`, "Plays". The tables are built season by season, through
 * `PLAY_BUILDERS` in `playBuilders.ts`: each function here is the SELECT of one season.
 *
 * Who a flag belongs to:
 * - `fga` to `pf` (all but `ast`, `stl` and `blk`): the acting player `player_id` and team `team_id`.
 *   A row with a team and no player is the team's own: a team rebound, a team turnover.
 * - `ast`: `assist_id`, of the same team. `stl` and `blk`: `steal_id` and `block_id`, of
 *   `opponent_id`. They sit on the turnover, the made shot or the missed shot they belong to, in
 *   both sources: the NBA writes a steal or a block as its own row, which keeps its row but no flag.
 */

export const PLAY_TABLES = { nba: 'play_nba', espn: 'play_espn' } as const
export type PlaySource = keyof typeof PLAY_TABLES

/** The view over both sources. */
export const PLAYS_VIEW = 'plays'

/**
 * The source later metrics read unless they need the other: the NBA's. It starts five seasons
 * earlier (1996-97), carries the possession number and is the source of the box scores the app
 * trusts; its match rate against them is in `nba-data-sources.md`.
 */
export const DEFAULT_PLAY_SOURCE: PlaySource = 'nba'

/** The counting flags, in the order the tables hold them. Each is 0 or 1, except `pts`. */
export const PLAY_FLAGS = [
  'fga',
  'fgm',
  'fg3a',
  'fg3m',
  'fta',
  'ftm',
  'pts',
  'oreb',
  'dreb',
  'tov',
  'pf',
  'ast',
  'stl',
  'blk'
] as const
export type PlayFlag = (typeof PLAY_FLAGS)[number]

/** What a play is, in one set for both sources. */
export const PLAY_KINDS = [
  'field_goal',
  // An end-of-period shot from far out: from 2025-26 the NBA leaves it out of field-goal attempts.
  'heave',
  'free_throw',
  'rebound',
  'turnover',
  'foul',
  'steal',
  'block',
  'violation',
  'jump_ball',
  'substitution',
  'timeout',
  'period',
  'replay',
  'ejection',
  'other'
] as const

/** Every column of a play table, typed. Both sources have all of them; what one lacks is NULL. */
export const PLAY_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['game_id', 'VARCHAR'],
  ['season', 'INTEGER'],
  ['game_type', 'VARCHAR'],
  ['game_date', 'DATE'],
  // The order within the game, and with `game_id` the source's own key for the row: the NBA's
  // `order_index`, ESPN's `game_play_number`.
  ['seq', 'INTEGER'],
  ['period', 'INTEGER'],
  // Seconds left in the period when the play happened.
  ['clock', 'DOUBLE'],
  // The score after the play. The view adds the score before and the seconds since the tip-off.
  ['home_after', 'INTEGER'],
  ['away_after', 'INTEGER'],
  ['team_id', 'BIGINT'],
  ['opponent_id', 'BIGINT'],
  ['home', 'BOOLEAN'],
  ['player_id', 'BIGINT'],
  ['assist_id', 'BIGINT'],
  ['steal_id', 'BIGINT'],
  ['block_id', 'BIGINT'],
  ['kind', 'VARCHAR'],
  // The source's own type, as published: the NBA's `action_type` and `sub_type`, ESPN's `type_text`.
  ['action', 'VARCHAR'],
  ['subtype', 'VARCHAR'],
  // The NBA's possession number; ESPN has none.
  ['possession', 'INTEGER'],
  ...PLAY_FLAGS.map((f) => [f, 'UTINYINT'] as const)
]

/** Seconds of a period: 12 minutes in regulation, 5 in overtime. */
export const elapsedSql = (period: string, clock: string): string =>
  `CASE WHEN ${period} <= 4 THEN (${period} - 1) * 720 + 720 - ${clock}
        ELSE 2880 + (${period} - 5) * 300 + 300 - ${clock} END`

/** "PT11M36.00S", the NBA's clock, in seconds. */
const isoClock = (c: string): string =>
  `TRY_CAST(regexp_extract(${c}, 'PT(\\d+)M', 1) AS DOUBLE) * 60
   + TRY_CAST(regexp_extract(${c}, 'M([\\d.]+)S', 1) AS DOUBLE)`

/**
 * Fouls that are not personal fouls: technicals of every kind, which the box score does not count
 * in `pf`. Defensive three seconds is a technical too.
 */
const NBA_TECHNICALS = [
  'Technical',
  'Double Technical',
  'Defense 3 Second',
  'Delay Technical',
  'Hanging Technical',
  'Taunting Technical',
  'Non-Unsportsmanlike Technical',
  'Excess Timeout Technical',
  'Too Many Players Technical',
  'Flopping',
  'Bench'
]

const list = (xs: string[]): string => xs.map((x) => `'${x.replaceAll("'", "''")}'`).join(', ')

/** A name without accents or a suffix: "Butler III" and "Butler", "Schröder" and "Schroder". */
const bare = (name: string): string =>
  `regexp_replace(strip_accents(${name}), '\\s+(Jr\\.?|Sr\\.?|II|III|IV)$', '')`

/**
 * The source's own season, beside the game's: the files are loaded a season at a time, so a filter
 * on it lets DuckDB skip the other seasons' row groups. A source without the column reads every row.
 */
const sourceSeason = (have: Have, table: string, alias: string, season: number): string =>
  have.columns.get(table)?.has('season') ? `${alias}.season = ${season}` : 'true'

const flag = (cond: string): string => `coalesce((${cond})::UTINYINT, 0)`

/** The final SELECT both sources share: the columns in order, with the flags worked out. */
function finalColumns(flags: Record<PlayFlag, string>): string {
  return PLAY_COLUMNS.map(([name, type]) =>
    name in flags ? `${flags[name as PlayFlag]}::${type} AS ${name}` : `${name}::${type} AS ${name}`
  ).join(',\n         ')
}

/** Running scores: the source writes a score on scoring rows only, so it is carried forward. */
const SCORES = `
    coalesce(last_value(sh IGNORE NULLS) OVER upto, 0) AS home_after,
    coalesce(last_value(sa IGNORE NULLS) OVER upto, 0) AS away_after`
const WINDOWS = `WINDOW upto AS (PARTITION BY game_id ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
         before AS (PARTITION BY game_id ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)`

/**
 * The NBA's play by play (stats.nba.com's v3 feed). What it writes and how it is read:
 * - Teams: `team_id` is 0 on a team's own row (a team rebound, a shot-clock turnover), where
 *   `person_id` holds the team's id; `location` (`h`, `v`) names the side either way.
 * - Steals and blocks are rows of their own with no `action_type`, named in the description
 *   ("Sengun STEAL (1 STL)"), with the `action_number` of the turnover or the miss they belong to.
 * - Assists are only in the made shot's description, by the name the feed uses for the player
 *   ("(Dort 1 AST)"): matched to a teammate of the shooter with that name in the same game. The name
 *   is the player's `player_name`, or an initial where two share it ("J. Brown", "Jal. Williams"),
 *   or the full name, always without accents ("Schroder" for Schröder) or a suffix ("Boston" for
 *   "Boston Jr."). Old descriptions keep
 *   the name of the time while `player_name` is today's ("Butler" for "Butler III", "World Peace"),
 *   so failing that, the one teammate on the floor whose name holds the description's last word.
 * - Rebounds carry the player's running counts ("Off:1 Def:0"), so a player's rebound is offensive
 *   when their offensive count went up. The feed lists some rebounds out of order (Off:3 before
 *   Off:2), so a player's rebounds are put in order by their running total, not by row; and it
 *   writes some twice with the same counts, the jump on the first (Off:1, then Off:3 and Off:3), so
 *   the rows of equal counts share the jump, offensive first. A team rebound is offensive when its
 *   team took the last miss.
 * - 2000-01 pads `action_type` with spaces, so it is trimmed.
 */
export function nbaPlaysSql(have: Have, season: number): string {
  const t = 'src_nba_pbp'
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 'p', name, type)
  const from = have.tables.has(t) ? t : '(SELECT 1)'
  return `WITH raw AS (
    SELECT g.game_id, g.season, g.game_type, g.game_date, g.home_team_id, g.away_team_id,
           ${c('order_index', 'INTEGER')} AS seq,
           ${c('action_number')} AS action_number, ${c('period', 'INTEGER')} AS period,
           coalesce(${c('seconds_remaining', 'DOUBLE')}, ${isoClock(c('clock', 'VARCHAR'))}) AS clock,
           ${c('team_id')} AS src_team, ${c('person_id')} AS person, ${c('location', 'VARCHAR')} AS location,
           coalesce(trim(${c('action_type', 'VARCHAR')}), '') AS action,
           nullif(trim(${c('sub_type', 'VARCHAR')}), '') AS subtype,
           coalesce(${c('description', 'VARCHAR')}, '') AS description,
           nullif(trim(${c('player_name', 'VARCHAR')}), '') AS player_name,
           nullif(trim(${c('player_name_i', 'VARCHAR')}), '') AS player_initial,
           ${c('shot_value', 'INTEGER')} AS shot_value,
           TRY_CAST(nullif(${c('score_home', 'VARCHAR')}, '') AS INTEGER) AS sh,
           TRY_CAST(nullif(${c('score_away', 'VARCHAR')}, '') AS INTEGER) AS sa,
           ${c('possession_number', 'INTEGER')} AS possession,
           [${[1, 2, 3, 4, 5].map((i) => c(`off_player_${i}`)).join(', ')}] AS on_offense
    FROM ${from} p JOIN game g ON g.nba_game_id = ${c('game_id', 'VARCHAR')}
    WHERE g.season = ${season} AND ${sourceSeason(have, t, 'p', season)}
  ), typed AS (
    SELECT *,
           CASE WHEN src_team > 0 THEN src_team
                WHEN person IN (home_team_id, away_team_id) THEN person
                WHEN location = 'h' THEN home_team_id WHEN location = 'v' THEN away_team_id END AS team_id,
           CASE WHEN src_team > 0 AND person > 0 THEN person END AS player_id,
           CASE
             WHEN action IN ('Made Shot', 'Missed Shot') THEN 'field_goal'
             WHEN action = 'Heave' THEN 'heave'
             WHEN action = 'Free Throw' THEN 'free_throw'
             WHEN action = 'Rebound' THEN 'rebound'
             WHEN action = 'Turnover' THEN 'turnover'
             WHEN action = 'Foul' THEN 'foul'
             WHEN action = '' AND description LIKE '% STEAL (%' THEN 'steal'
             WHEN action = '' AND description LIKE '% BLOCK (%' THEN 'block'
             WHEN action = 'Violation' THEN 'violation'
             WHEN action = 'Jump Ball' THEN 'jump_ball'
             WHEN action = 'Substitution' THEN 'substitution'
             WHEN action = 'Timeout' THEN 'timeout'
             WHEN action = 'period' THEN 'period'
             WHEN action = 'Instant Replay' THEN 'replay'
             WHEN action = 'Ejection' THEN 'ejection'
             ELSE 'other' END AS kind,
           ${bare(`nullif(regexp_extract(description, '\\(([^()]*?) \\d+ AST\\)', 1), '')`)} AS assist_name,
           TRY_CAST(regexp_extract(description, 'Off:(\\d+)', 1) AS INTEGER) AS off_count,
           TRY_CAST(regexp_extract(description, 'Def:(\\d+)', 1) AS INTEGER) AS def_count
    FROM raw
  ), marked AS (
    SELECT *,
           (kind = 'field_goal' AND action = 'Missed Shot')
             OR (kind = 'free_throw' AND description LIKE 'MISS%') AS missed,
           row_number() OVER (PARTITION BY game_id, action_number, kind ORDER BY seq) AS nth
    FROM typed
  ), credits AS (
    SELECT game_id, action_number,
           any_value(person) FILTER (WHERE kind = 'steal') AS steal_id,
           any_value(person) FILTER (WHERE kind = 'block') AS block_id
    FROM marked WHERE kind IN ('steal', 'block') GROUP BY 1, 2
  ), names AS (
    SELECT DISTINCT m.game_id, m.team_id, ${bare('m.player_name')} AS player_name,
           ${bare('m.player_initial')} AS player_initial, m.player_id,
           ${bare('pl.name')} AS full_name
    FROM marked m LEFT JOIN player pl ON pl.player_id = m.player_id
    WHERE m.player_id IS NOT NULL AND m.player_name IS NOT NULL
  ), named AS (
    SELECT m.game_id, m.seq, any_value(n.player_id) AS assist_id
    FROM marked m JOIN names n
      ON n.game_id = m.game_id AND n.team_id = m.team_id AND n.player_id <> m.player_id
     AND (n.player_name = m.assist_name OR n.player_initial = m.assist_name OR n.full_name = m.assist_name
          OR (m.assist_name = split_part(m.assist_name, '. ', 1) || '. ' || n.player_name
              AND starts_with(n.full_name, split_part(m.assist_name, '. ', 1))))
    WHERE m.assist_name IS NOT NULL AND m.action = 'Made Shot'
    GROUP BY 1, 2 HAVING count(DISTINCT n.player_id) = 1
  ), on_floor AS (
    SELECT m.game_id, m.seq, any_value(o.player_id) AS assist_id
    FROM (SELECT game_id, seq, player_id, assist_name, unnest(on_offense) AS id
          FROM marked WHERE assist_name IS NOT NULL AND action = 'Made Shot') m
    JOIN player o ON o.player_id = m.id
    WHERE m.id <> m.player_id
      AND contains(${bare('o.name')}, regexp_extract(m.assist_name, '(\\S+)$', 1))
    GROUP BY 1, 2 HAVING count(DISTINCT o.player_id) = 1
  ), assists AS (
    SELECT game_id, seq, coalesce(n.assist_id, f.assist_id) AS assist_id
    FROM named n FULL JOIN on_floor f USING (game_id, seq)
  ), joined AS (
    SELECT m.*,
           CASE WHEN m.kind = 'turnover' AND m.nth = 1 THEN cr.steal_id END AS steal_id,
           CASE WHEN m.kind IN ('field_goal', 'heave') AND m.action <> 'Made Shot' AND m.nth = 1
                THEN cr.block_id END AS block_id,
           a.assist_id,
           CASE m.team_id WHEN m.home_team_id THEN m.away_team_id WHEN m.away_team_id THEN m.home_team_id END AS opponent_id,
           m.team_id = m.home_team_id AS home
    FROM marked m
    LEFT JOIN credits cr ON cr.game_id = m.game_id AND cr.action_number = m.action_number
    LEFT JOIN assists a ON a.game_id = m.game_id AND a.seq = m.seq
  ), ran AS (
    SELECT *,
           last_value(CASE WHEN missed THEN team_id END IGNORE NULLS) OVER before AS miss_team,
           off_count - coalesce(lag(off_count) OVER (
             PARTITION BY game_id, player_id, kind ORDER BY off_count + def_count, seq), 0) AS off_gain,
           row_number() OVER (
             PARTITION BY game_id, player_id, kind, off_count, def_count ORDER BY seq) AS in_group,
           ${SCORES}
    FROM joined
    ${WINDOWS}
  ), scored AS (
    SELECT *,
           kind = 'rebound' AND coalesce(
             CASE WHEN player_id IS NOT NULL THEN
               in_group <= first_value(off_gain) OVER (
                 PARTITION BY game_id, player_id, kind, off_count, def_count ORDER BY seq) END,
             team_id = miss_team) AS offensive
    FROM ran
  )
  SELECT ${finalColumns({
    fga: flag("kind = 'field_goal'"),
    fgm: flag("action = 'Made Shot'"),
    fg3a: flag("kind = 'field_goal' AND shot_value = 3"),
    fg3m: flag("action = 'Made Shot' AND shot_value = 3"),
    fta: flag("kind = 'free_throw'"),
    ftm: flag("kind = 'free_throw' AND NOT missed"),
    pts: `CASE WHEN action = 'Made Shot' THEN coalesce(shot_value, 0)
               WHEN kind = 'free_throw' AND NOT missed THEN 1 ELSE 0 END`,
    oreb: flag("kind = 'rebound' AND offensive"),
    dreb: flag("kind = 'rebound' AND NOT offensive"),
    tov: flag("kind = 'turnover' AND description NOT ILIKE 'No Turnover%'"),
    pf: flag(`kind = 'foul' AND coalesce(subtype, '') NOT IN (${list(NBA_TECHNICALS)}, '')`),
    ast: flag('assist_id IS NOT NULL'),
    stl: flag('steal_id IS NOT NULL'),
    blk: flag('block_id IS NOT NULL')
  })}
  FROM scored`
}

/**
 * ESPN's play by play. Every row names its type (`type_text`) and up to three athletes by ESPN id,
 * matched to the app's players through `player_ids`. The second athlete is the assist on a made
 * shot, the blocker on a missed one and the stealer on a turnover; the description says which.
 * Scores are on every row. A rebound or turnover with a team and no athlete is the team's.
 * - Teams are matched by ESPN id through `team`: in some games ESPN's home side is the `game`
 *   table's away side, so its home and away scores are swapped to match.
 * - `score_value` is 0 on made free throws from 2012-13 into 2019-20, so a made free throw is 1.
 * - `points_attempted` is filled only from 2023-24. Before, a made shot's value says whether it was
 *   a three; a miss is a three when the description says so ("three point") or its raw coordinates
 *   (feet across the court and from the basket) are beyond the line: 23.5 feet out, or 22 to the
 *   side in the corner. That rule agrees with `points_attempted` on 99.8 % of 2025-26's shots.
 */
export function espnPlaysSql(have: Have, season: number): string {
  const t = 'src_espn_pbp'
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 'e', name, type)
  const from = have.tables.has(t) ? t : '(SELECT 1)'
  const type = 'type_text'
  return `WITH raw AS (
    SELECT g.game_id, g.season, g.game_type, g.game_date, g.home_team_id, g.away_team_id,
           ${c('game_play_number', 'INTEGER')} AS seq,
           ${c('period_number', 'INTEGER')} AS period,
           ${c('clock_minutes', 'DOUBLE')} * 60 + ${c('clock_seconds', 'DOUBLE')} AS clock,
           coalesce(tm.team_id,
             CASE ${c('team_id')} WHEN ${c('home_team_id')} THEN g.home_team_id
                                  WHEN ${c('away_team_id')} THEN g.away_team_id END) AS team_id,
           coalesce(th.team_id = g.away_team_id, false) AS flipped,
           p1.player_id, p2.player_id AS second_id,
           coalesce(replace(${c(type, 'VARCHAR')}, chr(10), ' '), '') AS action,
           ${c('type_id', 'INTEGER')} AS type_id,
           coalesce(${c('text', 'VARCHAR')}, '') AS description,
           coalesce(${c('shooting_play', 'BOOLEAN')}, false) AS shooting,
           coalesce(${c('scoring_play', 'BOOLEAN')}, false) AS scoring,
           ${c('score_value', 'INTEGER')} AS score_value,
           ${c('points_attempted', 'INTEGER')} AS points_attempted,
           ${c('coordinate_x_raw', 'DOUBLE')} AS x_raw, ${c('coordinate_y_raw', 'DOUBLE')} AS y_raw,
           ${c('home_score', 'INTEGER')} AS espn_home_score, ${c('away_score', 'INTEGER')} AS espn_away_score
    FROM ${from} e
    JOIN game g ON g.espn_game_id = ${c('game_id')}
    LEFT JOIN team tm ON tm.espn_team_id = ${c('team_id')} AND tm.season = g.season
    LEFT JOIN team th ON th.espn_team_id = ${c('home_team_id')} AND th.season = g.season
    LEFT JOIN player_ids p1 ON p1.espn_athlete_id = ${c('athlete_id_1')}
    LEFT JOIN player_ids p2 ON p2.espn_athlete_id = ${c('athlete_id_2')}
    WHERE ${c('season', 'INTEGER')} = ${c('file_season', 'INTEGER')}
      AND g.season = ${season} AND ${sourceSeason(have, t, 'e', season)}
  ), typed AS (
    SELECT *,
           CASE
             WHEN shooting AND (action ILIKE 'Free Throw%' OR description ILIKE '%free throw%')
               THEN 'free_throw'
             WHEN shooting AND action ILIKE 'Heave%' THEN 'heave'
             WHEN shooting THEN 'field_goal'
             WHEN action IN ('Offensive Rebound', 'Defensive Rebound', 'Rebound') THEN 'rebound'
             WHEN (action ILIKE '%turnover%' AND action <> 'No Turnover') OR action = 'Traveling'
               THEN 'turnover'
             WHEN (action ILIKE '%foul%' AND action <> 'No Foul') OR action ILIKE '%technical%'
               OR action IN ('Shooting Block', 'Personal Block', 'Offensive Charge') THEN 'foul'
             WHEN action IN ('Kicked Ball', 'Defensive Goaltending', 'Delay of Game', 'Lane',
                             'Double Lane', 'No Violation') THEN 'violation'
             WHEN action IN ('Jump Ball', 'Jumpball') THEN 'jump_ball'
             WHEN action = 'Substitution' THEN 'substitution'
             WHEN action ILIKE '%timeout%' OR action ILIKE '%time out%' THEN 'timeout'
             WHEN action IN ('Start Period', 'End Period', 'End Game') THEN 'period'
             WHEN action ILIKE '%challenge%' OR action ILIKE '%review%' THEN 'replay'
             WHEN action ILIKE '%ejection%' THEN 'ejection'
             ELSE 'other' END AS kind
    FROM raw
  ), ran AS (
    SELECT *,
           kind = 'field_goal' AND coalesce(
             points_attempted = 3,
             CASE WHEN scoring AND score_value IN (2, 3) THEN score_value = 3 END,
             description ILIKE '%three point%'
               OR sqrt(power(x_raw - 25, 2) + power(y_raw, 2)) >= 23.5
               OR (abs(x_raw - 25) >= 22 AND y_raw <= 9)) AS three,
           CASE WHEN kind = 'field_goal' AND scoring AND description ILIKE '%assist%' THEN second_id END AS assist_id,
           CASE WHEN kind IN ('field_goal', 'heave') AND NOT scoring AND description ILIKE '%block%' THEN second_id END AS block_id,
           CASE WHEN kind = 'turnover' AND description ILIKE '%steal%' THEN second_id END AS steal_id,
           CASE team_id WHEN home_team_id THEN away_team_id WHEN away_team_id THEN home_team_id END AS opponent_id,
           team_id = home_team_id AS home,
           coalesce(CASE WHEN flipped THEN espn_away_score ELSE espn_home_score END, 0) AS home_after,
           coalesce(CASE WHEN flipped THEN espn_home_score ELSE espn_away_score END, 0) AS away_after,
           NULL::VARCHAR AS subtype, NULL::INTEGER AS possession
    FROM typed
  ), scored AS (SELECT * FROM ran)
  SELECT ${finalColumns({
    fga: flag("kind = 'field_goal'"),
    fgm: flag("kind = 'field_goal' AND scoring"),
    fg3a: flag('three'),
    fg3m: flag('three AND scoring'),
    fta: flag("kind = 'free_throw'"),
    ftm: flag("kind = 'free_throw' AND scoring"),
    pts: `CASE WHEN scoring AND kind = 'free_throw' THEN 1
               WHEN scoring AND kind = 'field_goal' THEN
                 CASE WHEN score_value IN (2, 3) THEN score_value WHEN three THEN 3 ELSE 2 END
               ELSE 0 END`,
    oreb: flag("action = 'Offensive Rebound'"),
    dreb: flag("action = 'Defensive Rebound'"),
    tov: flag("kind = 'turnover'"),
    pf: flag("kind = 'foul' AND action NOT ILIKE '%technical%'"),
    ast: flag('assist_id IS NOT NULL'),
    stl: flag('steal_id IS NOT NULL'),
    blk: flag('block_id IS NOT NULL')
  })}
  FROM scored`
}

/**
 * Both sources in one view, each row marked with its source, with what is cheap to work out instead
 * of stored: the seconds since the tip-off, and the score before the play (the score after, less
 * the points the play scored).
 */
export const playsViewSql = (): string => {
  const extra = `${elapsedSql('period', 'clock')} AS elapsed,
     home_after - CASE WHEN home THEN pts ELSE 0 END AS home_before,
     away_after - CASE WHEN NOT home THEN pts ELSE 0 END AS away_before`
  return `CREATE OR REPLACE VIEW ${PLAYS_VIEW} AS
   SELECT 'nba' AS source, *, ${extra} FROM ${PLAY_TABLES.nba}
   UNION ALL
   SELECT 'espn' AS source, *, ${extra} FROM ${PLAY_TABLES.espn}`
}

/**
 * The tables, empty, and the views, for whatever a build has not reached: a read gets no rows rather
 * than a missing table. Created on every open; an existing table or view is left as it is.
 */
export function playsBootstrap(): string[] {
  const columns = PLAY_COLUMNS.map(([n, ty]) => `${n} ${ty}`).join(', ')
  return [
    ...Object.values(PLAY_TABLES).map((t) => `CREATE TABLE IF NOT EXISTS ${t} (${columns})`),
    playsViewSql().replace('CREATE OR REPLACE VIEW', 'CREATE VIEW IF NOT EXISTS'),
    ...eventsBootstrap()
  ]
}
