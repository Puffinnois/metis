import { elapsedSql, periodLengthSql, periodStartSql, type League } from '@shared/leagues'
import { fallbackKey, nameSide, teamNamesSql } from './collegePlays'
import { PLAYER_ON_COURT, UNIT_GAME, unitTailSql } from './onCourt'
import type { PlayBuilder } from './playBuilders'
import { finalColumns, flag, PLAY_COLUMNS, PLAY_TABLES } from './plays'
import { COLLEGE_PLAYS } from './playsRecipe'
import { column, type Have } from './sql'

/**
 * The college leagues' play table from stats.ncaa.org's play by play (D40, D42; `ncaa-data-sources.md`,
 * "Plays"), in `play_nba`'s columns so the splits, the play-derived counts and the game flow read it as
 * they read the NBA's, and the ten players on the floor at each play beside it (`play_lineup`), which
 * the splits' players' time and the play-credited units read. Both are built a season at a time by the
 * plays step (`COLLEGE_PLAY_BUILDERS`). How the feed is read, measured on every season of both leagues:
 *
 * - **Order:** the file has no play number. Its rows are in the play order within a game, and the load
 *   keeps that order within each of DuckDB's row groups but not between them (the stats file is written
 *   with `preserve_insertion_order` off), so a game that spans two row groups can come back in two parts
 *   the wrong way round (22 of the men's 6,297 games of 2025-26 are not contiguous, 11 of them out of
 *   order). A play's `seq` is its place in its game by period, then the file's seconds since the tip-off
 *   (`game_seconds`), then the row (DuckDB's `rowid`), which keeps the file's order within a second.
 * - **Games and sides:** `contest_id` is `game.ncaa_game_id`. stats.ncaa.org's home and away are its
 *   own, and a neutral game may list them the other way from ESPN's: its home team is placed by its
 *   stats.ncaa.org id, then its ESPN id, then its name (`teamNamesSql`), then as the side its away team
 *   is not; a game none of them places keeps ESPN's sides. The score and the ten follow the placing.
 * - **Players:** through `ncaa_player_ids` by the file's player id, else the negative of that id, else
 *   by the play by play's name (`AJ.DYBANTSA`) within the team, else D28's key, as the possessions view
 *   reads them, so the same player has one key in both. A team's own row (`TEAM`) names no player.
 * - **Event names:** the event's type as published (`event_type`, kept in `action`), its result
 *   (`event_result`), its value (`shot_value`). In 2021-22 to 2024-25 a few hundred types carry the
 *   player's name or "null" before them ("PIERCE,D'#393aAUNTRAY Enters Game", "null made Layup"), read
 *   without it. Every spelling and what it maps to is in `ncaa-data-sources.md`, "Plays".
 * - **Steals and blocks** are rows of their own, at the same second as the turnover or the miss they
 *   belong to (every steal and 99.8 % of blocks of 2025-26); each is put on the nearest such row of the
 *   other team, as the NBA's are on theirs, and its own row keeps the player but no flag.
 * - **Assists** are the make's second player (`player_2`), of the shooter's team.
 * - **Fouls drawn** are rows of their own ("Draw Foul"), kept as `other` with the fouled player: the
 *   play-derived counts read them (`playDetail.ts`).
 */

type Columns = ReadonlyArray<readonly [string, string]>

const SLOTS = [1, 2, 3, 4, 5] as const

/** The ten players on the floor at a play, beside `play_nba`, by its `seq`: the game's home five first. */
export const PLAY_LINEUP = 'play_lineup'

export const PLAY_LINEUP_COLUMNS: Columns = [
  ['season', 'INTEGER'],
  ['game_id', 'VARCHAR'],
  ['seq', 'INTEGER'],
  // The team with the ball at the play, as the file gives it (`poss_team`), as the game's side.
  ['poss_team_id', 'BIGINT'],
  ...SLOTS.map((i) => [`home_${i}`, 'BIGINT'] as const),
  ...SLOTS.map((i) => [`away_${i}`, 'BIGINT'] as const)
]

/** An empty SELECT of these columns, for a source the file does not hold. */
const none = (columns: Columns): string =>
  `SELECT ${columns.map(([n, t]) => `NULL::${t} AS ${n}`).join(', ')} WHERE false`

/** The file's ten as it names them: its own home five, then its away five. */
const TEN = [...SLOTS.map((i) => `home_${i}`), ...SLOTS.map((i) => `away_${i}`)]

/**
 * The shot types the file spells, each a field goal: the jumpers, layups, dunks and hooks of every
 * season, and the tip-ins and the unknown type of 2021-22 to 2023-24's older format.
 */
export const NCAA_SHOT_TYPES: readonly string[] = [
  'Three Point Jumper',
  'Two Point Jumper',
  'Layup',
  'Dunk',
  'Hook',
  'Tip In',
  'Unk'
]

/** Foul classes that are technical fouls, which the box score leaves out of PF. */
export const NCAA_TECHNICAL_CLASSES: readonly string[] = ['technical', 'adminTechnical']

const list = (xs: readonly string[]): string =>
  xs.map((x) => `'${x.replaceAll("'", "''")}'`).join(', ')

/**
 * The season's rows of the play by play, each placed in its game with its `seq`, its team and the
 * team with the ball as the game's sides, and every person it names resolved once (`nb_who`). Shared
 * by both builders, so a play's `seq` is the same in both tables: the ten's builder reads the ten
 * (`ten`), the play table's the event's columns, so neither carries the other's.
 *
 * The rows are read again where they are used (`NOT MATERIALIZED`) rather than held: a season is three
 * million rows, and DuckDB keeps a CTE read twice in memory, past the app's 1 GB on 2021-22's men's.
 */
function rowsCtes(have: Have, season: number, ten: boolean): string {
  const t = COLLEGE_PLAYS.pbp
  const s = Number(season)
  const c = (name: string, type = 'VARCHAR'): string => column(have, t, 'p', name, type)
  const own = have.columns.get(t)?.has('season') ? `p.season = ${s}` : 'true'
  const placed = (ncaa: string, espn: string, names: string): string =>
    `CASE WHEN ${ncaa}.team_id IN (g.home_team_id, g.away_team_id) THEN ${ncaa}.team_id
          WHEN ${espn}.team_id IN (g.home_team_id, g.away_team_id) THEN ${espn}.team_id
          ELSE ${nameSide(`${names}.ids`)} END`
  const person = (team: string, id: string, name: string): string =>
    `{'team': ${team}, 'id': ${id}, 'name': ${name}}`
  const people = ten
    ? TEN.map((n) => person(n.startsWith('home') ? 'fh' : 'fa', `f_${n}_id`, `f_${n}`))
    : [person('team_id', 'player_1_id', 'player_1'), person('team_id', 'player_2_id', 'player_2')]
  return `nb_g AS (
      SELECT game_id, ncaa_game_id, season, game_type, game_date, home_team_id, away_team_id
      FROM game WHERE season = ${s} AND ncaa_game_id IS NOT NULL
    ),
    nb_tn AS (${teamNamesSql(String(s))}),
    nb_src AS NOT MATERIALIZED (
      SELECT p.rowid AS r, ${c('contest_id')} AS contest_id, ${c('home')} AS fh_name, ${c('away')} AS fa_name,
             ${c('period', 'INTEGER')} AS period, ${c('game_seconds', 'INTEGER')} AS game_seconds,
             ${c('event_team')} AS event_team, ${c('poss_team')} AS poss_team,
             ${c('home_ncaa_team_id', 'BIGINT')} AS fh_ncaa, ${c('home_espn_team_id', 'BIGINT')} AS fh_espn,
             ${c('away_ncaa_team_id', 'BIGINT')} AS fa_ncaa, ${c('away_espn_team_id', 'BIGINT')} AS fa_espn,
             ${
               ten
                 ? TEN.map((n) => `${c(n)} AS f_${n}, ${c(`${n}_player_id`)} AS f_${n}_id`).join(
                     ',\n             '
                   )
                 : `${c('clock')} AS clock_text, ${c('poss_num', 'INTEGER')} AS poss_num,
             ${c('home_score', 'INTEGER')} AS fh_score, ${c('away_score', 'INTEGER')} AS fa_score,
             coalesce(${c('event_type')}, '') AS event_type, ${c('event_result')} AS event_result,
             -- What the plays read of the description: an older row's result and value, a free throw's number.
             nullif(regexp_extract(${c('event_description')}, ' (made|missed) ', 1), '') AS desc_result,
             nullif(regexp_extract(${c('event_description')}, '([23])PTR', 1), '') AS ptr,
             nullif(regexp_extract(${c('event_description')}, '(\\d+of\\d+)', 1), '') AS ft_of,
             ${c('shot_value', 'INTEGER')} AS shot_value,
             ${c('player_1')} AS player_1, ${c('player_1_id')} AS player_1_id,
             ${c('player_2')} AS player_2, ${c('player_2_id')} AS player_2_id,
             ${c('turnover_type')} AS turnover_type, ${c('foul_class')} AS foul_class,
             ${c('foul_tech_class')} AS foul_tech_class,
             coalesce(${c('is_shooting_foul', 'BOOLEAN')}, false) AS shooting_foul,
             coalesce(${c('is_looseball_foul', 'BOOLEAN')}, false) AS looseball_foul,
             coalesce(${c('is_flagrant', 'BOOLEAN')}, false) AS flagrant,
             ${c('timeout_type')} AS timeout_type`
             }
      FROM ${t} p
      WHERE ${own}
    ),
    nb_side AS (
      SELECT s.contest_id, any_value(g.game_id) AS game_id, any_value(g.game_type) AS game_type,
             any_value(g.game_date) AS game_date,
             any_value(g.home_team_id) AS gh, any_value(g.away_team_id) AS ga,
             any_value(${placed('hn', 'he', 'tnh')}) AS h0,
             any_value(${placed('an', 'ae', 'tna')}) AS a0
      FROM (SELECT DISTINCT contest_id, fh_name, fa_name, fh_ncaa, fh_espn, fa_ncaa, fa_espn FROM nb_src) s
      JOIN nb_g g ON g.ncaa_game_id = s.contest_id
      LEFT JOIN team hn ON hn.season = g.season AND hn.ncaa_team_id = s.fh_ncaa
      LEFT JOIN team he ON he.season = g.season AND he.espn_team_id = s.fh_espn
      LEFT JOIN nb_tn tnh ON tnh.name = s.fh_name
      LEFT JOIN team an ON an.season = g.season AND an.ncaa_team_id = s.fa_ncaa
      LEFT JOIN team ae ON ae.season = g.season AND ae.espn_team_id = s.fa_espn
      LEFT JOIN nb_tn tna ON tna.name = s.fa_name
      GROUP BY s.contest_id
    ),
    nb_placed AS (
      SELECT *, CASE WHEN fh = gh THEN ga ELSE gh END AS fa
      FROM (SELECT *, coalesce(h0, CASE a0 WHEN gh THEN ga WHEN ga THEN gh END, gh) AS fh FROM nb_side)
    ),
    -- The play order on the narrow columns alone, so the sort holds a few bytes a row, not the whole row.
    nb_seq AS (
      SELECT r, row_number() OVER (PARTITION BY contest_id ORDER BY period, game_seconds, r)::INTEGER AS seq
      FROM nb_src
    ),
    nb_rows AS NOT MATERIALIZED (
      SELECT x.*, q.seq, d.game_id, d.game_type, d.game_date, d.gh AS home_team_id, d.ga AS away_team_id,
             d.fh, d.fa, d.fh <> d.gh AS flipped,
             CASE x.event_team WHEN x.fh_name THEN d.fh WHEN x.fa_name THEN d.fa END AS team_id,
             CASE x.poss_team WHEN x.fh_name THEN d.fh WHEN x.fa_name THEN d.fa END AS poss_team_id
      FROM nb_src x JOIN nb_seq q USING (r) JOIN nb_placed d USING (contest_id)
    ),
    nb_people AS (
      SELECT DISTINCT u.team, u.id, u.name
      FROM (SELECT unnest([${people.join(', ')}]) AS u FROM nb_rows)
      WHERE u.name IS NOT NULL AND upper(u.name) <> 'TEAM'
    ),
    nb_who AS (
      SELECT k.team, k.id, k.name,
             coalesce(i.player_id, -TRY_CAST(k.id AS BIGINT), n.player_id,
                      ${fallbackKey(String(s), 'k.team', 'k.name')}) AS player_id
      FROM nb_people k
      LEFT JOIN (SELECT ncaa_player_id, any_value(player_id) AS player_id FROM ncaa_player_ids
                 WHERE season = ${s} AND ncaa_player_id IS NOT NULL GROUP BY 1) i ON i.ncaa_player_id = k.id
      LEFT JOIN (SELECT team_id, player, arg_max(player_id, lines) AS player_id FROM ncaa_player_ids
                 WHERE season = ${s} AND player IS NOT NULL GROUP BY 1, 2) n
        ON n.team_id = k.team AND n.player = k.name
    )`
}

/** A LEFT JOIN to `nb_who` for one person a row names: by team, the file's id and the name. */
const whoJoin = (alias: string, team: string, id: string, name: string): string =>
  `LEFT JOIN nb_who ${alias} ON ${alias}.team IS NOT DISTINCT FROM ${team}
       AND ${alias}.id IS NOT DISTINCT FROM ${id} AND ${alias}.name = ${name}`

/** What the plays step needs before it can read the play by play. */
const NEEDS = ['game', 'team', 'ncaa_player_ids', 'src_ncaa_team_ids']

const ready = (have: Have): boolean =>
  have.tables.has(COLLEGE_PLAYS.pbp) && NEEDS.every((t) => have.tables.has(t))

/**
 * One season's ten players on the floor at each play, as the game's sides: the file's own home five
 * become the game's away five where its sides are the other way from ESPN's.
 */
export function collegePlayLineupSql(have: Have, season: number): string {
  if (!ready(have)) return none(PLAY_LINEUP_COLUMNS)
  const slot = (side: 'home' | 'away', i: number): string =>
    `${side === 'home' ? 'h' : 'a'}${i}.player_id`
  return `WITH ${rowsCtes(have, season, true)}
    SELECT ${Number(season)} AS season, r.game_id, r.seq, r.poss_team_id,
           ${SLOTS.map((i) => `CASE WHEN r.flipped THEN ${slot('away', i)} ELSE ${slot('home', i)} END AS home_${i}`).join(', ')},
           ${SLOTS.map((i) => `CASE WHEN r.flipped THEN ${slot('home', i)} ELSE ${slot('away', i)} END AS away_${i}`).join(', ')}
    FROM nb_rows r
    ${SLOTS.map((i) => whoJoin(`h${i}`, 'r.fh', `r.f_home_${i}_id`, `r.f_home_${i}`)).join('\n    ')}
    ${SLOTS.map((i) => whoJoin(`a${i}`, 'r.fa', `r.f_away_${i}_id`, `r.f_away_${i}`)).join('\n    ')}`
}

/**
 * One season's plays in `play_nba`'s columns. The flags count as the box score counts: a make's
 * value from the file's `shot_value` (or the older format's "3PTR"), a made free throw 1, rebounds
 * offensive and defensive as the file names them (a team's own rebound counted for the team, a dead-ball
 * rebound not at all), turnovers, and personal fouls, the technical classes left out.
 */
export function collegePlaysSql(have: Have, season: number): string {
  if (!ready(have)) return none(PLAY_COLUMNS)
  const shots = list(NCAA_SHOT_TYPES)
  const techs = list(NCAA_TECHNICAL_CLASSES)
  return `WITH ${rowsCtes(have, season, false)},
    nb_read AS (
      SELECT r.* EXCLUDE (fh_name, fa_name, fh_ncaa, fh_espn, fa_ncaa, fa_espn, event_team, poss_team,
                          player_1, player_1_id, player_2, player_2_id),
             w1.player_id AS actor_id, w2.player_id AS second_id,
             -- A type with the player's name or "null" before it, read without it.
             regexp_replace(r.event_type, '^(null|[A-Z][^ ,]*,[^ ]*) ', '') AS et,
             TRY_CAST(split_part(r.clock_text, ':', 1) AS DOUBLE) * 60
               + TRY_CAST(split_part(r.clock_text, ':', 2) AS DOUBLE) AS clock
      FROM nb_rows r
      ${whoJoin('w1', 'r.team_id', 'r.player_1_id', 'r.player_1')}
      ${whoJoin('w2', 'r.team_id', 'r.player_2_id', 'r.player_2')}
    ),
    nb_typed AS (
      SELECT *,
             coalesce(nullif(event_result, ''), nullif(regexp_extract(et, '^(made|missed) ', 1), ''),
                      desc_result) AS res,
             regexp_replace(et, '^(made|missed) ', '') AS etype
      FROM nb_read
    ),
    nb_kind AS (
      SELECT *,
             CASE
               WHEN (etype IN (${shots}) OR (etype = '' AND ptr IS NOT NULL)) AND res IN ('made', 'missed')
                 THEN 'field_goal'
               WHEN etype = 'Free Throw' AND res IN ('made', 'missed') THEN 'free_throw'
               WHEN etype IN ('Offensive Rebound', 'Defensive Rebound', 'Deadball Rebound') THEN 'rebound'
               WHEN etype = 'Turnover' THEN 'turnover'
               WHEN etype = 'Commits Foul' THEN 'foul'
               WHEN etype = 'Steal' THEN 'steal'
               WHEN etype = 'Blocked Shot' THEN 'block'
               WHEN etype ILIKE '%jumpball%' THEN 'jump_ball'
               WHEN etype IN ('Enters Game', 'Leaves Game') THEN 'substitution'
               WHEN etype ILIKE '%timeout%' THEN 'timeout'
               WHEN etype LIKE 'Challenge%' THEN 'replay'
               ELSE 'other' END AS kind,
             coalesce(shot_value, CASE WHEN etype = 'Three Point Jumper' THEN 3 END,
                      TRY_CAST(ptr AS INTEGER), 2) AS value,
             coalesce(foul_class IN (${techs}), foul_class IS NULL AND foul_tech_class IS NOT NULL) AS technical
      FROM nb_typed
    ),
    -- The file's score columns follow its home and away in most games, and run the other way in a few
    -- (62 of the men's 2025-26 games): each is read as the side whose points it tracks.
    nb_orient AS (
      SELECT game_id, abs(fh_pts - fa_final) < abs(fh_pts - fh_final) AS swap
      FROM (SELECT game_id, max(fh_score) AS fh_final, max(fa_score) AS fa_final,
                   coalesce(sum(CASE WHEN kind = 'field_goal' AND res = 'made' THEN value
                                     WHEN kind = 'free_throw' AND res = 'made' THEN 1 END)
                              FILTER (WHERE team_id = fh), 0) AS fh_pts
            FROM nb_kind GROUP BY 1)
    ),
    nb_steal AS (
      SELECT s.game_id, t.seq, s.actor_id AS steal_id, abs(s.seq - t.seq) AS gap,
             row_number() OVER (PARTITION BY s.game_id, s.seq ORDER BY abs(s.seq - t.seq), t.seq) AS pick
      FROM nb_kind s JOIN nb_kind t
        ON t.game_id = s.game_id AND t.period = s.period AND t.clock = s.clock
       AND t.kind = 'turnover' AND t.team_id IS DISTINCT FROM s.team_id
      WHERE s.kind = 'steal' AND s.actor_id IS NOT NULL
    ),
    nb_block AS (
      SELECT s.game_id, t.seq, s.actor_id AS block_id, abs(s.seq - t.seq) AS gap,
             row_number() OVER (PARTITION BY s.game_id, s.seq ORDER BY abs(s.seq - t.seq), t.seq) AS pick
      FROM nb_kind s JOIN nb_kind t
        ON t.game_id = s.game_id AND t.period = s.period AND t.clock = s.clock
       AND t.kind = 'field_goal' AND t.res = 'missed' AND t.team_id IS DISTINCT FROM s.team_id
      WHERE s.kind = 'block' AND s.actor_id IS NOT NULL
    ),
    nb_joined AS (
      SELECT k.*, st.steal_id, bl.block_id,
             CASE WHEN k.kind = 'field_goal' AND k.res = 'made' THEN k.second_id END AS assist_id,
             CASE k.team_id WHEN k.home_team_id THEN k.away_team_id WHEN k.away_team_id THEN k.home_team_id END AS opponent_id,
             k.team_id = k.home_team_id AS home,
             CASE WHEN k.flipped <> coalesce(o.swap, false) THEN k.fa_score ELSE k.fh_score END AS h_score,
             CASE WHEN k.flipped <> coalesce(o.swap, false) THEN k.fh_score ELSE k.fa_score END AS a_score
      FROM nb_kind k
      LEFT JOIN nb_orient o ON o.game_id = k.game_id
      LEFT JOIN (SELECT game_id, seq, arg_min(steal_id, gap) AS steal_id FROM nb_steal WHERE pick = 1 GROUP BY 1, 2) st
        ON st.game_id = k.game_id AND st.seq = k.seq
      LEFT JOIN (SELECT game_id, seq, arg_min(block_id, gap) AS block_id FROM nb_block WHERE pick = 1 GROUP BY 1, 2) bl
        ON bl.game_id = k.game_id AND bl.seq = k.seq
    ),
    scored AS (
      SELECT *, ${Number(season)} AS season, actor_id AS player_id, event_type AS action, poss_num AS possession,
             coalesce(last_value(h_score IGNORE NULLS) OVER upto, 0) AS home_after,
             coalesce(last_value(a_score IGNORE NULLS) OVER upto, 0) AS away_after,
             CASE kind
               WHEN 'turnover' THEN turnover_type
               WHEN 'foul' THEN concat_ws(' ',
                 CASE WHEN technical THEN coalesce(foul_class, 'technical')
                      WHEN shooting_foul THEN 'shooting' WHEN looseball_foul THEN 'looseball'
                      ELSE foul_class END,
                 CASE WHEN flagrant THEN 'flagrant' END)
               WHEN 'free_throw' THEN ft_of
               WHEN 'timeout' THEN timeout_type
             END AS subtype
      FROM nb_joined
      WINDOW upto AS (PARTITION BY game_id ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    )
  SELECT ${finalColumns({
    fga: flag("kind = 'field_goal'"),
    fgm: flag("kind = 'field_goal' AND res = 'made'"),
    fg3a: flag("kind = 'field_goal' AND value = 3"),
    fg3m: flag("kind = 'field_goal' AND res = 'made' AND value = 3"),
    fta: flag("kind = 'free_throw'"),
    ftm: flag("kind = 'free_throw' AND res = 'made'"),
    pts: `CASE WHEN kind = 'field_goal' AND res = 'made' THEN value
               WHEN kind = 'free_throw' AND res = 'made' THEN 1 ELSE 0 END`,
    oreb: flag("etype = 'Offensive Rebound'"),
    dreb: flag("etype = 'Defensive Rebound'"),
    tov: flag("kind = 'turnover'"),
    // The box score counts a player's technical fouls in PF (99.5 % of 2025-26's men's player-games
    // with them, 98.2 % without); administrative technicals, on a coach or the bench, it does not.
    pf: flag("kind = 'foul' AND coalesce(foul_class, '') <> 'adminTechnical'"),
    ast: flag('assist_id IS NOT NULL'),
    stl: flag('steal_id IS NOT NULL'),
    blk: flag('block_id IS NOT NULL')
  })}
  FROM scored`
}

// ----- What the splits and the units read of the ten -------------------------------------------------

const homeFive = (alias: string): string => `[${SLOTS.map((i) => `${alias}.home_${i}`).join(', ')}]`
const awayFive = (alias: string): string => `[${SLOTS.map((i) => `${alias}.away_${i}`).join(', ')}]`

/**
 * Each player's stretches on the floor in a season, for the splits' players' time (`split_stints` of
 * `splits.ts`): the time between a play and the one before it in the period is credited to the ten the
 * file names at the play, as the play-credited units credit it, so a player's consecutive plays on the
 * floor make one stretch, from the clock of the play before the first to the clock of the last. The
 * file writes no row at a period's end (its last play is at 0:02 or 0:05), so the time after a period's
 * last play goes to the ten on the floor at it, as the period's start goes to the ten of its first.
 */
export function collegeStintsCte(season: number, league: League): string {
  const s = Number(season)
  const periodLength = periodLengthSql(league, String(s), 'p.period')
  return `split_on AS (
    SELECT p.game_id, p.period,
           CASE WHEN lead(p.seq) OVER w IS NULL THEN 0 ELSE p.clock END AS lo,
           coalesce(lag(p.clock) OVER w, ${periodLength}) AS hi,
           row_number() OVER w AS rn, p.home_team_id, p.away_team_id,
           ${homeFive('l')} AS h, ${awayFive('l')} AS a
    FROM split_plays p JOIN ${PLAY_LINEUP} l ON l.season = ${s} AND l.game_id = p.game_id AND l.seq = p.seq
    WINDOW w AS (PARTITION BY p.game_id, p.period ORDER BY p.seq)
  ), split_on_each AS (
    SELECT DISTINCT game_id, period, rn, hi, lo, team_id, player_id FROM (
      SELECT game_id, period, rn, hi, lo, home_team_id AS team_id, unnest(h) AS player_id FROM split_on
      UNION ALL
      SELECT game_id, period, rn, hi, lo, away_team_id, unnest(a) FROM split_on
    ) WHERE player_id IS NOT NULL
  ), split_stints AS (
    SELECT game_id, period, team_id, player_id, arg_min(hi, rn) AS hi, arg_max(lo, rn) AS lo
    FROM (SELECT *, rn - row_number() OVER (PARTITION BY game_id, period, team_id, player_id ORDER BY rn) AS island
          FROM split_on_each)
    GROUP BY game_id, period, team_id, player_id, island
  )`
}

/**
 * The stretches between plays for the splits' time, as the NBA's (`SEGMENTS` of `splits.ts`), and the
 * stretch from each period's start to its first play: the NBA's feed writes a row at the start of every
 * period, stats.ncaa.org's starts at the first play (the tip at 19:59), which would leave a second or so
 * of each period out of every split.
 */
export const collegeSegmentsCte = (season: number, league: League): string => `split_segments AS (
    SELECT game_id, period, home_team_id, away_team_id, mh_after AS mh,
           clock AS hi, coalesce(lead(clock) OVER w, 0) AS lo
    FROM split_plays
    WINDOW w AS (PARTITION BY game_id, period ORDER BY clock DESC, seq)
    QUALIFY clock > coalesce(lead(clock) OVER w, 0)
    UNION ALL
    SELECT * FROM (
      SELECT game_id, period, any_value(home_team_id), any_value(away_team_id), arg_min(mh_before, seq),
             any_value(${periodLengthSql(league, String(Number(season)), 'period')}) AS hi, max(clock) AS lo
      FROM split_plays GROUP BY game_id, period
    ) WHERE hi > lo
  )`

/**
 * The season's possessions for the splits' counts, from the file's own numbering (`poss_num`): each
 * possession's team (the file's `poss_team` at its last play), its first play and that play's period and
 * clock, which place it in a split. stats.ncaa.org's possession file is the same derivation, kept as the
 * `possession` view.
 */
export const collegePossessionsCte = (season: number): string => `split_poss_src AS (
    SELECT *, team_id = home_team_id AS home FROM (
      SELECT n.game_id, n.possession, arg_max(l.poss_team_id, n.seq) AS team_id,
             any_value(g.home_team_id) AS home_team_id, min(n.seq) AS start_seq,
             arg_min(n.period, n.seq) AS period, arg_min(n.clock, n.seq) AS start_clock, true AS counted
      FROM ${PLAY_TABLES.nba} n
      JOIN ${PLAY_LINEUP} l ON l.season = n.season AND l.game_id = n.game_id AND l.seq = n.seq
      JOIN game g ON g.game_id = n.game_id
      WHERE n.season = ${Number(season)} AND n.possession IS NOT NULL
      GROUP BY n.game_id, n.possession)
  )`

/**
 * One season's units credited play by play, as the NBA's builder credits them (`unitGameSql`): each
 * play's time to the ten the file names at it, free throws to the players on the floor at the foul, and
 * each possession to the players on the floor at its last play. The file writes no row at a period's end,
 * so each period gets one with no counts at its last second (`kind` `period`), the ten of its last play
 * on the floor until then. A free throw goes to the players on the floor at the foul, as the NBA's do,
 * only where a foul precedes it at the same moment: in 2021-22 to 2023-24's older format a free throw is
 * sometimes listed before its foul, and the period's last foul before it would be minutes old. Kept
 * beside the lineup file's units under its own name, or under `unit_game` when the league's entry reads
 * it (`League.onCourtFrom`).
 */
export function collegePlayUnitsSql(_have: Have, season: number, league: League): string {
  const s = Number(season)
  const counts = [
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
  return `WITH g AS (SELECT game_id, home_team_id, away_team_id FROM game WHERE season = ${s}),
    ends AS (
      SELECT n.game_id, max(n.seq) AS seq, arg_max(l.poss_team_id, n.seq) AS poss_off
      FROM ${PLAY_TABLES.nba} n
      JOIN ${PLAY_LINEUP} l ON l.season = n.season AND l.game_id = n.game_id AND l.seq = n.seq
      WHERE n.season = ${s} AND n.possession IS NOT NULL
      GROUP BY n.game_id, n.possession
    ),
    played AS (
      SELECT x.season, x.game_type, x.game_id, x.game_date, x.seq, x.period, x.kind,
             x.team_id, x.player_id, g.home_team_id, g.away_team_id, e.poss_off,
             ${counts.map((c) => `x.${c}::INTEGER AS ${c}`).join(', ')},
             ${elapsedSql(league, String(s), 'x.period', 'x.clock')} AS el,
             ${periodStartSql(league, String(s), 'x.period')} AS p0,
             ${homeFive('l')} AS h, ${awayFive('l')} AS a
      FROM ${PLAY_TABLES.nba} x JOIN g ON g.game_id = x.game_id
      LEFT JOIN ${PLAY_LINEUP} l ON l.season = x.season AND l.game_id = x.game_id AND l.seq = x.seq
      LEFT JOIN ends e ON e.game_id = x.game_id AND e.seq = x.seq
      WHERE x.season = ${s}
    ),
    plays AS (
      SELECT * REPLACE (
               CASE WHEN kind = 'free_throw' AND NOT coalesce(bool_or(kind = 'foul') OVER (
                      PARTITION BY game_id, period, el ORDER BY seq
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), false)
                    THEN 'free_throw_alone' ELSE kind END AS kind)
      FROM played
      UNION ALL
      SELECT season, game_type, game_id, game_date, max(seq) + 1, period, 'period', NULL, NULL,
             any_value(home_team_id), any_value(away_team_id), NULL,
             ${counts.map(() => '0').join(', ')},
             ${elapsedSql(league, String(s), 'period', '0')}, any_value(p0),
             arg_max(h, seq), arg_max(a, seq)
      FROM played GROUP BY season, game_type, game_id, game_date, period
    ),
    ${unitTailSql()}`
}

/** Where the college leagues' on-court numbers come from: stats.ncaa.org's lineup file, or the plays. */
export type OnCourtSource = 'lineups' | 'plays'

/**
 * The tables each source's units and player-games are built into: the source the league's entry reads
 * (`League.onCourtFrom`, the lineup file unless it says otherwise) under the names every read uses, the
 * other beside it under its own (`unit_game_plays`, or `unit_game_lineups` once the plays are read), so
 * both are kept and named (policy 5) and switching is that one setting: the next refresh finds the other
 * name missing and rebuilds every season.
 */
export function onCourtTables(
  league: League,
  source: OnCourtSource
): { units: string; players: string } {
  const read = league.onCourtFrom ?? 'lineups'
  return source === read
    ? { units: UNIT_GAME, players: PLAYER_ON_COURT }
    : { units: `${UNIT_GAME}_${source}`, players: `${PLAYER_ON_COURT}_${source}` }
}

/** The play table and the ten beside it, in build order: the play table reads nothing of the ten. */
export const COLLEGE_PBP_BUILDERS: readonly PlayBuilder[] = [
  {
    table: PLAY_LINEUP,
    columns: PLAY_LINEUP_COLUMNS,
    select: collegePlayLineupSql,
    order: 'game_id, seq',
    // An intermediate (the manager's decision at T1302.7): 104 MB a league kept, a few seconds a
    // season rebuilt on each refresh.
    intermediate: true
  },
  {
    table: PLAY_TABLES.nba,
    columns: PLAY_COLUMNS,
    select: collegePlaysSql,
    order: 'game_id, seq'
  }
]

/** The college recipe reads its own feed: what a league's plays step names as the play builder. */
export const isCollege = (league: League): boolean => league.plays === 'college'
