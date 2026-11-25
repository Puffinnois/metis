import {
  AND_ONE_FOULS,
  AND_ONE_FREE_THROW,
  BONUS_FOUL_OVERTIME,
  BONUS_FOUL_QUARTER,
  BONUS_LATE_FOULS,
  BONUS_LATE_SECONDS,
  BUZZER_SECONDS,
  CHALLENGE_PREFIX,
  CHALLENGE_WON,
  DEFENSE_THREE_SECONDS,
  ESPN_DRAWN_FOUL_TYPES,
  ESPN_SHOOTING_FOUL_TYPES,
  FOUL_KINDS,
  GAME_WINNER_SECONDS,
  GO_AHEAD_SECONDS,
  NCAA_FREE_THROWS,
  NCAA_FRONT_END,
  NCAA_SHOOTING_FOULS,
  NCAA_TECHNICAL_SUBTYPES,
  NOT_A_TEAM_TIMEOUT,
  TEAM_FOUL_SUBTYPES,
  TECHNICAL_FREE_THROW,
  TECHNICAL_SUBTYPES,
  TRIP_FREE_THROWS,
  TURNOVER_KINDS,
  type PlayKind
} from '@shared/stats/playDetail'
import type { PlayBuilder } from './playBuilders'
import { elapsedSql, leagueOf, regulationPeriodsSql, type League } from '@shared/leagues'
import { PLAY_TABLES } from './plays'
import { espnFoulType, playsRecipe } from './playsRecipe'
import { column, type Have } from './sql'

/**
 * Play-derived counts (reference section 16, with section 3's technicals, flagrants, ejections and
 * fouls drawn, and section 13's game flow), per player-game and team-game, so the engine's `built`
 * mechanism reads them at both grains under any filter. Counts only; every share and rate is divided
 * when read (data policy 3). The rules are data in `src/shared/stats/playDetail.ts`.
 *
 * Read from `play_nba` of the same season (built just before by `PLAY_BUILDERS`), whose flags already
 * hold who acted, assisted and stole. Fouls drawn are the exception: the NBA's feed never names the
 * fouled player, so they come from ESPN's play by play, which does from 2005-06 to 2016-17 (read from 2006-07); ESPN's
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

/**
 * `subtype`'s kind, in SQL, as `kindOf` gives it: by the NBA's spellings, or stats.ncaa.org's where
 * the play table is the college leagues' (`spellings` `ncaa`).
 */
export function kindSql(
  kinds: readonly PlayKind[],
  subtype = 'subtype',
  spellings: 'subtypes' | 'ncaa' = 'subtypes'
): string {
  const whens = kinds
    .filter((k) => (k[spellings] ?? []).length > 0)
    .map((k) => `WHEN trim(${subtype}) IN (${list(k[spellings] ?? [])}) THEN '${k.key}'`)
  return `CASE ${whens.join(' ')} ELSE 'other' END`
}

/**
 * How a league's play table spells what the counts read: the NBA's feed (the WNBA's is the same), or
 * stats.ncaa.org's in the college play table (`collegePbp.ts`), whose fouls drawn are its own rows.
 */
interface Spellings {
  kinds: 'subtypes' | 'ncaa'
  technicals: readonly string[]
  defense3: string
  andOneFreeThrow: string
  shootingFouls: readonly string[]
  trips: { two: string; three: string }
  /** Fouls drawn: ESPN's play by play, or the play table's own "Draw Foul" rows. */
  drawn: 'espn' | 'plays'
  /** The trip of one free throw that ends a possession: a one-and-one's front end missed. */
  frontEnd: string | null
  /** A free throw of a technical foul, where the feed says which is one. */
  technicalFreeThrow: string | null
  /** A jump ball's own rows (`won Jumpball`), or a description that names the tip. */
  jumps: 'rows' | 'description'
}

const NBA_SPELLINGS: Spellings = {
  kinds: 'subtypes',
  technicals: TECHNICAL_SUBTYPES,
  defense3: DEFENSE_THREE_SECONDS,
  andOneFreeThrow: AND_ONE_FREE_THROW,
  shootingFouls: AND_ONE_FOULS,
  trips: TRIP_FREE_THROWS,
  drawn: 'espn',
  frontEnd: null,
  technicalFreeThrow: TECHNICAL_FREE_THROW,
  jumps: 'description'
}

const COLLEGE_SPELLINGS: Spellings = {
  kinds: 'ncaa',
  technicals: NCAA_TECHNICAL_SUBTYPES,
  // The college feed records no defensive three seconds: the catalogue gives the reason.
  defense3: DEFENSE_THREE_SECONDS,
  andOneFreeThrow: NCAA_FREE_THROWS.andOne,
  shootingFouls: NCAA_SHOOTING_FOULS,
  trips: { two: NCAA_FREE_THROWS.two, three: NCAA_FREE_THROWS.three },
  drawn: 'plays',
  frontEnd: NCAA_FRONT_END,
  technicalFreeThrow: null,
  jumps: 'rows'
}

const NBA = leagueOf('nba')

const spellingsOf = (league?: League): Spellings =>
  league && playsRecipe(league).builders === 'college' ? COLLEGE_SPELLINGS : NBA_SPELLINGS

/** Each counted thing: its column, and the condition on a row of `play_nba` (or on its scorer). */
interface Count {
  name: string
  /** Who it belongs to: the acting player, the passer, ESPN's fouled player, the blocker or the jumper. */
  to: 'actor' | 'passer' | 'drawn' | 'blocker' | 'jumper'
  when: string
}

/** Counts of the acting player, in the order the tables hold them. */
const actorCounts = (sp: Spellings): Count[] => [
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
    when: `kind = 'foul' AND trim(subtype) IN (${list(sp.technicals)})`
  },
  {
    name: 'def3',
    to: 'actor',
    when: `kind = 'foul' AND trim(subtype) = '${sp.defense3}'`
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
    when: `kind = 'free_throw' AND trim(subtype) = '${sp.trips.two}'`
  },
  {
    name: 'ft_trip3',
    to: 'actor',
    when: `kind = 'free_throw' AND trim(subtype) = '${sp.trips.three}'`
  },
  {
    name: 'goaltend',
    to: 'actor',
    when: "kind = 'violation' AND trim(subtype) = 'Defensive Goaltending'"
  },
  { name: 'kicked', to: 'actor', when: "kind = 'violation' AND trim(subtype) = 'Kicked Ball'" },
  // The trips and technical points of the scoring attempts (reference 372 and 428).
  {
    name: 'ft_front',
    to: 'actor',
    when: sp.frontEnd
      ? `kind = 'free_throw' AND trim(subtype) = '${sp.frontEnd}' AND ftm = 0 AND NOT at_make`
      : 'false'
  },
  {
    name: 'ft_techm',
    to: 'actor',
    when: sp.technicalFreeThrow
      ? `kind = 'free_throw' AND trim(subtype) LIKE '${sp.technicalFreeThrow}%' AND ftm = 1`
      : 'false'
  },
  // The baskets of the last minutes (reference 388), from `late`.
  { name: 'go_ahead', to: 'actor', when: 'go_ahead' },
  { name: 'game_winner', to: 'actor', when: 'game_winner' },
  { name: 'buzzer', to: 'actor', when: 'buzzer' },
  { name: 'buzzer_winner', to: 'actor', when: 'buzzer AND game_winner' }
]
const ACTOR = actorCounts(NBA_SPELLINGS)

/** Counts of the passer: assists on twos and on threes, so assist points are 2 and 3 of them. */
const PASSER: Count[] = [
  { name: 'ast2', to: 'passer', when: 'ast = 1 AND fg3m = 0' },
  { name: 'ast3', to: 'passer', when: 'ast = 1 AND fg3m = 1' }
]

/** Fouls drawn, from ESPN's play by play: all personal fouls, and shooting fouls. */
const DRAWN: Count[] = [
  { name: 'fd', to: 'drawn', when: 'true' },
  { name: 'fd_shooting', to: 'drawn', when: `type_text IN (${list(ESPN_SHOOTING_FOUL_TYPES)})` }
]

/** Blocks followed by a rebound of the ball, and those the blocker's team took it (reference 376). */
const BLOCKER: Count[] = [
  { name: 'blk_n', to: 'blocker', when: 'seen' },
  { name: 'blk_rec', to: 'blocker', when: 'rec' }
]

/** Jump balls won and lost, for a player of either side the feed resolves (reference 383). */
const JUMPER: Count[] = [
  { name: 'jump_n', to: 'jumper', when: 'true' },
  { name: 'jump_won', to: 'jumper', when: 'won' },
  { name: 'jump_lost', to: 'jumper', when: 'NOT won' }
]

/** A player's counts, as the catalogue reads them. */
export const PLAY_DETAIL_COUNTS: readonly string[] = [
  ...ACTOR,
  ...PASSER,
  ...DRAWN,
  ...BLOCKER,
  ...JUMPER
].map((c) => c.name)

/** What a team alone has: its timeouts, challenges and the fouls that count toward a bonus (references 36, 386, 387). */
const TEAM_ONLY = ['timeouts', 'challenges', 'challenges_won', 'team_fouls', 'bonus_given'] as const

/** A team's counts: its players' and its own rows (team turnovers, bench technicals), and team turnovers. */
const TEAM_COUNTS: readonly string[] = [
  ...ACTOR.map((c) => c.name),
  'tov_team',
  ...DRAWN.map((c) => c.name),
  ...BLOCKER.map((c) => c.name),
  ...JUMPER.map((c) => c.name),
  ...TEAM_ONLY
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
function playsCte(season: number, league: League, sp: Spellings = NBA_SPELLINGS): string {
  const p = PLAY_TABLES.nba
  const kinds =
    sp.kinds === 'subtypes'
      ? `${kindSql(TURNOVER_KINDS)} AS tkind, ${kindSql(FOUL_KINDS)} AS fkind`
      : `${kindSql(TURNOVER_KINDS, 'subtype', 'ncaa')} AS tkind, ${kindSql(FOUL_KINDS, 'subtype', 'ncaa')} AS fkind`
  return `p AS (
    SELECT *, ${kinds}
    FROM ${p} WHERE season = ${season}
  ), shot_fouls AS (
    SELECT DISTINCT game_id, period, clock, team_id FROM p
    WHERE kind = 'foul' AND trim(subtype) IN (${list(sp.shootingFouls)})
  ), makes AS (
    SELECT DISTINCT game_id, period, clock, player_id FROM p WHERE fgm = 1
  ), ${lateCte(season, league)}, plays AS (
    SELECT p.*, coalesce(l.go_ahead, false) AS go_ahead, coalesce(l.game_winner, false) AS game_winner,
           coalesce(l.buzzer, false) AS buzzer, m.player_id IS NOT NULL AS at_make,
           (p.kind = 'free_throw' AND trim(p.subtype) = '${sp.andOneFreeThrow}'
            AND m.player_id IS NOT NULL AND f.team_id IS NOT NULL) AS and_one
    FROM p
    LEFT JOIN late l ON l.game_id = p.game_id AND l.seq = p.seq
    LEFT JOIN makes m ON m.game_id = p.game_id AND m.period = p.period AND m.clock = p.clock
                     AND m.player_id = p.player_id
    LEFT JOIN shot_fouls f ON f.game_id = p.game_id AND f.period = p.period AND f.clock = p.clock
                          AND f.team_id = p.opponent_id
  )`
}

/**
 * The baskets of the last minutes (reference 388), by the order the game flow reads: a go-ahead basket (a
 * made field goal that takes its team from tied or behind to ahead, in the last two minutes of the fourth
 * quarter, the last half or overtime), a game winner (a go-ahead basket in its last 24 seconds after which
 * its team is never tied or behind) and a buzzer-beater (a made field goal with a second or less left in
 * any period). Free throws do not count.
 */
function lateCte(season: number, league: League): string {
  const last = regulationPeriodsSql(league, String(season))
  return `late_rows AS (
    SELECT *, home_score - away_score AS m FROM (${scoringRowsSql('p', league)})
  ), late AS (
    SELECT game_id, seq,
           fgm = 1 AND period >= ${last} AND clock <= ${GO_AHEAD_SECONDS} AND before <= 0 AND after > 0 AS go_ahead,
           fgm = 1 AND period >= ${last} AND clock <= ${GAME_WINNER_SECONDS} AND before <= 0 AND after > 0
             AND CASE WHEN home THEN low > 0 ELSE high < 0 END AS game_winner,
           fgm = 1 AND clock <= ${BUZZER_SECONDS} AS buzzer
    FROM (SELECT *, CASE WHEN home THEN m - pts ELSE -m - pts END AS before,
                 CASE WHEN home THEN m ELSE -m END AS after, min(m) OVER w AS low, max(m) OVER w AS high
          FROM late_rows
          WINDOW w AS (PARTITION BY game_id ORDER BY ord ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING))
  )`
}

/**
 * Blocks and what became of the ball (reference 376): the next thing after a blocked shot, a rebound by
 * either team, or another shot, free throw, turnover or jump ball. A block nobody rebounded (out of
 * bounds, a dead ball) is not counted in the share, which divides the recovered by the rebounded.
 */
const blockedCte = (): string => `blocked AS (
    SELECT game_id, block_id AS player_id, opponent_id AS team_id, nk = 'rebound' AND nr = 1 AS seen,
           nk = 'rebound' AND nr = 1 AND nt = opponent_id AS rec
    FROM (SELECT game_id, kind, blk, block_id, opponent_id,
                 lead(kind) OVER w AS nk, lead(team_id) OVER w AS nt, lead(oreb + dreb) OVER w AS nr
          FROM p WHERE kind IN ('field_goal', 'rebound', 'free_throw', 'turnover', 'jump_ball')
          WINDOW w AS (PARTITION BY game_id ORDER BY seq))
    WHERE kind = 'field_goal' AND blk = 1 AND block_id IS NOT NULL
  )`

/**
 * Jump balls (reference 383): who contested each and won it, `jumps` a row for each named player and
 * `jump_teams` one for each side. The college feed has a row for the winner and the loser. The NBA's names
 * A (its own row) and B, and to whom the ball was tipped: B and that player are found among the game's
 * box-score lines by the last name the feed writes, and the tip's team is the winner where the name is one
 * team's; a jump with no tip named, or a name of both teams or of neither, is not counted.
 */
function jumpsCte(have: Have, season: number, league: League, sp: Spellings): string {
  const none = `jumps AS (SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS player_id,
      NULL::BIGINT AS team_id, NULL::BOOLEAN AS won WHERE false),
    jump_teams AS (SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS team_id, NULL::BOOLEAN AS won WHERE false)`
  if (sp.jumps === 'rows') {
    return `jumps AS (
      SELECT game_id, player_id, team_id, action = 'won Jumpball' AS won
      FROM p WHERE kind = 'jump_ball' AND action IN ('won Jumpball', 'lost Jumpball') AND team_id IS NOT NULL
    ), jump_teams AS (SELECT game_id, team_id, won FROM jumps)`
  }
  const t = playsRecipe(league).pbp
  if (!have.tables.has(t) || !['player_game', 'player'].every((x) => have.tables.has(x)))
    return none
  const c = (name: string, type = 'VARCHAR'): string => column(have, t, 's', name, type)
  const norm = (x: string): string =>
    `lower(trim(regexp_replace(strip_accents(${x}), '[.''’]', '', 'g')))`
  const said = (group: number): string =>
    `regexp_extract(${c('description')}, '^Jump Ball (.+?) vs\\. (.+?)(?:: Tip to (.*))?$', ${group})`
  // A last name in the feed's words: the whole name, its last words, or an initial and the last words.
  const same = (n: string, k: string): string =>
    `(${n} = ${k} OR ends_with(${n}, ' ' || ${k})
       OR (length(${k}) > 2 AND substr(${k}, 2, 1) = ' ' AND substr(${n}, 1, 1) = substr(${k}, 1, 1)
           AND ends_with(${n}, ' ' || substr(${k}, 3))))`
  const own = have.columns.get(t)?.has('season') ? `s.season = ${season}` : 'true'
  return `jb AS (
      SELECT s.game_id, ${c('person_id', 'BIGINT')} AS a_id, ${norm(said(2))} AS b_name, ${norm(said(3))} AS tip
      FROM ${t} s WHERE ${own} AND ${c('action_type')} ILIKE 'jump%' AND ${c('person_id', 'BIGINT')} > 0
    ), jb_lines AS (
      SELECT b.game_id, b.player_id, b.team_id, ${norm('pl.name')} AS n
      FROM player_game b JOIN player pl ON pl.player_id = b.player_id WHERE b.season = ${season}
    ), jb_keyed AS (SELECT *, row_number() OVER () AS jid FROM jb),
    jb_won AS (
      SELECT k.jid, min(l.team_id) AS win_team FROM jb_keyed k JOIN jb_lines l ON l.game_id = k.game_id
      WHERE k.tip <> '' AND ${same('l.n', 'k.tip')} GROUP BY 1 HAVING count(DISTINCT l.team_id) = 1
    ), jb_sides AS (
      SELECT k.jid, k.game_id, k.a_id, a.team_id AS a_team, w.win_team,
             CASE a.team_id WHEN g.home_team_id THEN g.away_team_id WHEN g.away_team_id THEN g.home_team_id END AS b_team
      FROM jb_keyed k JOIN jb_won w ON w.jid = k.jid JOIN game g ON g.game_id = k.game_id
      JOIN jb_lines a ON a.game_id = k.game_id AND a.player_id = k.a_id
    ), jb_b AS (
      SELECT k.jid, min(l.player_id) AS b_id FROM jb_keyed k JOIN jb_sides sd ON sd.jid = k.jid
      JOIN jb_lines l ON l.game_id = k.game_id AND l.team_id = sd.b_team AND ${same('l.n', 'k.b_name')}
      GROUP BY 1 HAVING count(DISTINCT l.player_id) = 1
    ), jumps AS (
      SELECT sd.game_id, sd.a_id AS player_id, sd.a_team AS team_id, sd.win_team = sd.a_team AS won FROM jb_sides sd
      UNION ALL
      SELECT sd.game_id, b.b_id, sd.b_team, sd.win_team = sd.b_team FROM jb_sides sd JOIN jb_b b ON b.jid = sd.jid
    ), jump_teams AS (
      SELECT game_id, a_team AS team_id, win_team = a_team AS won FROM jb_sides
      UNION ALL SELECT game_id, b_team, win_team = b_team FROM jb_sides
    )`
}

/**
 * What a team alone has: its timeouts (the feed's, the officials' and the media's left out), its coach's
 * challenges and those it won (NBA from 2019-20, WNBA from 2023; the team is the one whose timeout is at
 * the same moment, since the replay row names none, and a replay with no timeout there is not counted) and
 * its fouls that count toward the bonus, with the periods in which they put the other team in it.
 */
function teamOnlyCte(season: number, league: League, sp: Spellings): string {
  const reg = regulationPeriodsSql(league, String(season))
  const rows = sp.jumps === 'rows'
  return `challenged AS (
      SELECT r.game_id, r.seq, r.won, arg_max(t.team_id, (t.subtype = '${CHALLENGE_PREFIX}', -abs(t.seq - r.seq), t.seq)) AS team_id
      FROM (SELECT game_id, seq, period, clock, subtype LIKE '%${CHALLENGE_WON}%' AS won
            FROM p WHERE kind = 'replay' AND subtype LIKE '${CHALLENGE_PREFIX}%' AND ${!rows}) r
      JOIN p t ON t.game_id = r.game_id AND t.period = r.period AND t.clock = r.clock AND t.kind = 'timeout'
             AND t.team_id IS NOT NULL
             AND coalesce(trim(t.subtype), '') NOT IN (${list(NOT_A_TEAM_TIMEOUT)})
      GROUP BY 1, 2, 3
    ), counted_fouls AS (
      SELECT game_id, team_id, period, clock,
             row_number() OVER w AS n, sum((clock <= ${BONUS_LATE_SECONDS})::INTEGER) OVER w AS late
      FROM p WHERE kind = 'foul' AND team_id IS NOT NULL AND ${!rows} AND trim(subtype) IN (${list(TEAM_FOUL_SUBTYPES)})
      WINDOW w AS (PARTITION BY game_id, team_id, period ORDER BY seq)
    ), fouls_by_team AS (
      SELECT game_id, team_id, count(*) AS team_fouls,
             count(DISTINCT period) FILTER (WHERE
               n >= CASE WHEN period > ${reg} THEN ${BONUS_FOUL_OVERTIME} ELSE ${BONUS_FOUL_QUARTER} END
               OR late >= ${BONUS_LATE_FOULS}) AS bonus_given
      FROM counted_fouls GROUP BY 1, 2
    ), timeouts_by_team AS (
      SELECT game_id, team_id, count(*) AS timeouts
      FROM p WHERE kind = 'timeout' AND team_id IS NOT NULL
        AND coalesce(trim(subtype), '') NOT IN (${list(NOT_A_TEAM_TIMEOUT)}) AND action NOT ILIKE '%media%'
      GROUP BY 1, 2
    ), challenges_by_team AS (
      SELECT game_id, team_id, count(*) AS challenges, sum(won::INTEGER) AS challenges_won
      FROM challenged WHERE team_id IS NOT NULL GROUP BY 1, 2
    ), team_only AS (
      SELECT game_id, team_id, coalesce(o.timeouts, 0) AS timeouts, coalesce(h.challenges, 0) AS challenges,
             coalesce(h.challenges_won, 0) AS challenges_won, coalesce(f.team_fouls, 0) AS team_fouls,
             coalesce(f.bonus_given, 0) AS bonus_given
      FROM (SELECT DISTINCT game_id, team_id FROM p WHERE team_id IS NOT NULL)
      LEFT JOIN timeouts_by_team o USING (game_id, team_id)
      LEFT JOIN challenges_by_team h USING (game_id, team_id)
      LEFT JOIN fouls_by_team f USING (game_id, team_id)
    )`
}

/**
 * ESPN's fouls naming the fouled player, per player and game: the player's team in that game is the
 * one their box-score line names. What ESPN lacks reads no rows.
 */
function drawnCte(have: Have, season: number, league?: League): string {
  if (spellingsOf(league).drawn === 'plays') return collegeDrawnCte()
  const t = 'src_espn_pbp'
  const c = (name: string, type = 'BIGINT'): string => column(have, t, 'e', name, type)
  if (!['player_ids', 'player_game'].every((x) => have.tables.has(x)) || !have.tables.has(t)) {
    return `drawn AS (SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS player_id,
                             NULL::BIGINT AS team_id, NULL::VARCHAR AS type_text WHERE false)`
  }
  const own = have.columns.get(t)?.has('season') ? `${c('season', 'INTEGER')} = ${season}` : 'true'
  // The league's file may spell the same types another way (its plays recipe's `espnFoulNames`).
  const espnType = espnFoulType(playsRecipe(league), c('type_text', 'VARCHAR'))
  return `drawn AS (
    SELECT g.game_id, pi.player_id, pg.team_id, ${espnType} AS type_text
    FROM ${t} e
    JOIN game g ON g.espn_game_id = ${c('game_id')}
    JOIN player_ids pi ON pi.espn_athlete_id = ${c('athlete_id_2')}
    JOIN player_game pg ON pg.game_id = g.game_id AND pg.player_id = pi.player_id
    WHERE g.season = ${season} AND ${own}
      AND ${c('season', 'INTEGER')} IS NOT DISTINCT FROM ${c('file_season', 'INTEGER')}
      AND ${espnType} IN (${list(ESPN_DRAWN_FOUL_TYPES)})
  )`
}

/**
 * The college play table's fouls drawn: each "Draw Foul" row (the fouled player, `collegePbp.ts`) with
 * the foul by the other team at the same moment nearest it in the play order, a shooting foul read as
 * ESPN's "Shooting Foul" and any other personal foul as its "Personal Foul", so the counts read the same
 * rule; a technical drawn is not a personal foul and is left out.
 */
const collegeDrawnCte = (): string => `drawn AS (
    SELECT game_id, player_id, team_id,
           CASE WHEN trim(coalesce(subtype, '')) IN (${list(NCAA_SHOOTING_FOULS)}) THEN 'Shooting Foul'
                ELSE 'Personal Foul' END AS type_text
    FROM (
      SELECT d.game_id, d.player_id, d.team_id, f.subtype,
             row_number() OVER (PARTITION BY d.game_id, d.seq ORDER BY abs(d.seq - f.seq), f.seq) AS pick
      FROM p d LEFT JOIN p f
        ON f.game_id = d.game_id AND f.period = d.period AND f.clock = d.clock
       AND f.kind = 'foul' AND f.team_id IS DISTINCT FROM d.team_id
      WHERE d.kind = 'other' AND d.action = 'Draw Foul' AND d.player_id IS NOT NULL
    )
    WHERE pick = 1 AND trim(coalesce(subtype, '')) NOT IN (${list(NCAA_TECHNICAL_SUBTYPES)})
  )`

/**
 * One season's player-game rows. A player's team is one pick for the whole row, by a total order (T1302.9):
 * the team of their own plays, then of the assists, then of the fouls they drew, the one on most rows and
 * then the smaller id. A play can name a player under the other team (a college file puts an assist on the
 * other side's basket), and an `any_value` over the three took whichever row came first, so the team was
 * wrong on 16 of the men's 646,865 rows of 2026-11-24's files and 23 of the women's, by the order they came in.
 */
export function playDetailPlayerSql(have: Have, season: number, league: League = NBA): string {
  const sp = spellingsOf(league)
  const groups = [actorCounts(sp), PASSER, DRAWN, BLOCKER, JUMPER]
  // One of the groups counted over its rows, and 0 of every other, in the columns' order.
  const counted = (of: Count[]): string =>
    groups
      .map((g) => (g === of ? g.map(sumOf) : g.map((x) => `0::UTINYINT AS ${x.name}`)).join(', '))
      .join(',\n           ')
  const [actors, passers, fouled, blockers, jumpers] = groups
  const all = PLAY_DETAIL_COUNTS.map((n) => `sum(${n})::UTINYINT AS ${n}`).join(', ')
  return `WITH ${playsCte(season, league, sp)}, ${drawnCte(have, season, league)}, ${blockedCte()}, ${jumpsCte(have, season, league, sp)},
  credits AS (
    SELECT game_id, player_id, team_id, 3 AS src, count(*) AS n, ${counted(actors)}
    FROM plays WHERE player_id IS NOT NULL GROUP BY 1, 2, 3
    UNION ALL
    SELECT game_id, assist_id, team_id, 2, count(*), ${counted(passers)}
    FROM plays WHERE assist_id IS NOT NULL GROUP BY 1, 2, 3
    UNION ALL
    SELECT game_id, player_id, team_id, 1, count(*), ${counted(fouled)}
    FROM drawn GROUP BY 1, 2, 3
    UNION ALL
    SELECT game_id, player_id, team_id, 1, count(*), ${counted(blockers)}
    FROM blocked GROUP BY 1, 2, 3
    UNION ALL
    SELECT game_id, player_id, team_id, 1, count(*), ${counted(jumpers)}
    FROM jumps WHERE player_id IS NOT NULL GROUP BY 1, 2, 3
  ), players AS (
    SELECT game_id, player_id, arg_max(team_id, (src, n, -team_id)) AS team_id, ${all}
    FROM credits GROUP BY 1, 2
  )
  SELECT c.game_id, g.season, g.game_type, g.game_date, c.player_id, c.team_id,
         CASE c.team_id WHEN g.home_team_id THEN g.away_team_id
                        WHEN g.away_team_id THEN g.home_team_id END AS opponent_id,
         ${PLAY_DETAIL_COUNTS.map((n) => `c.${n}`).join(', ')}
  FROM players c JOIN game g ON g.game_id = c.game_id
  ORDER BY c.player_id, g.game_date, c.game_id`
}

/**
 * The scoring plays of the rows `source` gives (`play_nba` or a part of it), in order, with the score
 * after each (`home_score`, `away_score`) and the seconds since the tip-off (`t`). The score is the
 * one the play table carries; on a scoring row whose score reads 0-0 it is the last score plus the
 * play's points (a guard: since the play table reads the feed's 0-0 as no score, none is left). `ord` is the order:
 * by the total score, then by row, since a score only rises and the feed lists a few rows out of
 * order (an and-one's free throw before its basket would read 76-75, then 75-75, a tie that never
 * was). Shared by the builder and the game-flow read, so the chart and the tables agree.
 */
export function scoringRowsSql(source: string, league: League): string {
  const written = 'home_after + away_after > 0'
  const before = (c: string): string =>
    `coalesce(last_value(CASE WHEN ${written} THEN ${c} END IGNORE NULLS) OVER (
       PARTITION BY game_id ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)`
  return `SELECT *, row_number() OVER (
             PARTITION BY game_id ORDER BY home_score + away_score, seq) AS ord FROM (
    SELECT game_id, seq, period, clock, home, pts, fgm, ${elapsedSql(league, 'season', 'period', 'clock')} AS t,
         CASE WHEN ${written} THEN home_after
              ELSE ${before('home_after')} + CASE WHEN home THEN pts ELSE 0 END END AS home_score,
         CASE WHEN ${written} THEN away_after
              ELSE ${before('away_after')} + CASE WHEN home THEN 0 ELSE pts END END AS away_score
    FROM ${source} WHERE pts > 0 AND home IS NOT NULL AND clock IS NOT NULL)`
}

/**
 * The flow of each game from its scoring plays, by the rules of `flowSummary` in
 * `src/shared/stats/playDetail.ts`, as one row per side (`home`).
 */
function flowCte(league: League): string {
  return `scoring AS (
    SELECT *, home_score - away_score AS m FROM (${scoringRowsSql('p', league)})
  ), ends AS (
    SELECT game_id, ${elapsedSql(league, 'any_value(season)', 'max(period)', '0')} AS len FROM p WHERE period IS NOT NULL GROUP BY 1
  ), marked AS (
    SELECT s.*, e.len,
           last_value(nullif(sign(m), 0) IGNORE NULLS) OVER (
             PARTITION BY s.game_id ORDER BY ord ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS last_leader,
           greatest(0, coalesce(lead(t) OVER (PARTITION BY s.game_id ORDER BY ord), e.len) - t) AS span,
           CASE WHEN home IS DISTINCT FROM lag(home) OVER (PARTITION BY s.game_id ORDER BY ord)
                THEN 1 ELSE 0 END AS new_run
    FROM scoring s JOIN ends e USING (game_id)
  ), runs AS (
    SELECT game_id, home, sum(pts) AS run
    FROM (SELECT *, sum(new_run) OVER (PARTITION BY game_id ORDER BY ord) AS run_id FROM marked)
    GROUP BY game_id, run_id, home
  ), gaps AS (
    SELECT game_id, home, max(greatest(gap, CASE WHEN final THEN len - t ELSE 0 END)) AS drought
    FROM (SELECT game_id, home, t, len,
                 t - coalesce(lag(t) OVER (PARTITION BY game_id, home ORDER BY ord), 0) AS gap,
                 row_number() OVER (PARTITION BY game_id, home ORDER BY ord DESC) = 1 AS final
          FROM marked)
    GROUP BY 1, 2
  ), fg_gaps AS (
    SELECT game_id, home, max(greatest(gap, CASE WHEN final THEN len - t ELSE 0 END)) AS drought
    FROM (SELECT game_id, home, t, len,
                 t - coalesce(lag(t) OVER (PARTITION BY game_id, home ORDER BY ord), 0) AS gap,
                 row_number() OVER (PARTITION BY game_id, home ORDER BY ord DESC) = 1 AS final
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
export function playDetailTeamSql(have: Have, season: number, league: League): string {
  const sp = spellingsOf(league)
  const ACTOR = actorCounts(sp)
  const actor = ACTOR.map(sumOf).join(',\n           ')
  const drawn = DRAWN.map(sumOf).join(',\n           ')
  const also = [...BLOCKER, ...JUMPER].map((x) => x.name)
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
  return `WITH ${playsCte(season, league, sp)}, ${drawnCte(have, season, league)}, ${flowCte(league)},
  ${blockedCte()}, ${jumpsCte(have, season, league, sp)}, ${teamOnlyCte(season, league, sp)},
  blocks AS (
    SELECT game_id, team_id, ${BLOCKER.map(sumOf).join(', ')} FROM blocked GROUP BY 1, 2
  ), tips AS (
    SELECT game_id, team_id, ${JUMPER.map(sumOf).join(', ')} FROM jump_teams GROUP BY 1, 2
  ),
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
           ${TEAM_COUNTS.filter(
             (n) =>
               !DRAWN.some((d) => d.name === n) &&
               !also.includes(n) &&
               !(TEAM_ONLY as readonly string[]).includes(n)
           )
             .map((n) => `coalesce(c.${n}, 0)::UTINYINT AS ${n}`)
             .join(', ')},
           ${DRAWN.map((d) => `coalesce(fd.${d.name}, 0)::UTINYINT AS ${d.name}`).join(', ')},
           ${BLOCKER.map((d) => `coalesce(bk.${d.name}, 0)::UTINYINT AS ${d.name}`).join(', ')},
           ${JUMPER.map((d) => `coalesce(tp.${d.name}, 0)::UTINYINT AS ${d.name}`).join(', ')},
           ${TEAM_ONLY.map((n) => `coalesce(tm.${n}, 0)::UTINYINT AS ${n}`).join(', ')},
           ${flow.join(', ')}
    FROM sided f
    LEFT JOIN own c ON c.game_id = f.game_id AND c.team_id = f.team_id
    LEFT JOIN fouled fd ON fd.game_id = f.game_id AND fd.team_id = f.team_id
    LEFT JOIN blocks bk ON bk.game_id = f.game_id AND bk.team_id = f.team_id
    LEFT JOIN tips tp ON tp.game_id = f.game_id AND tp.team_id = f.team_id
    LEFT JOIN team_only tm ON tm.game_id = f.game_id AND tm.team_id = f.team_id
  )
  SELECT l.*, ${opp.join(', ')}
  FROM lines l JOIN lines o ON o.game_id = l.game_id AND o.team_id = l.opponent_id
  ORDER BY l.team_id, l.game_date, l.game_id`
}

export const PLAY_DETAIL_BUILDERS: PlayBuilder[] = [
  {
    table: PLAY_DETAIL_PLAYER_GAME,
    columns: PLAY_DETAIL_PLAYER_COLUMNS,
    select: playDetailPlayerSql,
    reads: [PLAY_TABLES.nba],
    order: 'game_id, team_id, player_id'
  },
  {
    table: PLAY_DETAIL_TEAM_GAME,
    columns: PLAY_DETAIL_TEAM_COLUMNS,
    select: playDetailTeamSql,
    reads: [PLAY_TABLES.nba],
    order: 'game_id, team_id'
  }
]
