import type { League } from '@shared/leagues'
import { BOX_COUNTS, espnLines, NBA_NAMES, type DerivedRecipe } from './game'
import { column, type Have } from './sql'

/**
 * The WNBA's recipe for `player_game` and `team_game`, from what `docs/reference/wnba-data-sources.md`
 * measured ("Traps"):
 *
 * - the player lines are the league's game logs (every player-game to 2025, 202 of 2026's games) and
 *   its 2026 box scores, which hold every game of 2026 and agree with the game logs on every line
 *   both have; a game the box scores hold reads from them, any other from the game logs;
 * - the team lines are the game logs' team rows, every team-game from 1997; the two games the
 *   schedule lacks (2007, 2009) have none, so their players are summed;
 * - ESPN's lines stand beside them, read only where the league has no line: the Commissioner's Cup
 *   finals (2021 on) are ESPN's alone. ESPN's 2002 lines are all zeros, so its counts are read from
 *   2003, and its starters from 2002, since the flags are there;
 * - the game logs print whole minutes, so seconds before 2026 are minutes times 60. A team's minutes
 *   read 0 before 2005 (12 in 2004), so its seconds then are its regulation and overtimes where the
 *   game knows them, else its players' summed;
 * - the 2018 forfeit has team rows of zeros: not a box score.
 *
 * Source tables keep their names (D27); `nba_game_id` holds the league's own game id (T1301.5).
 */

/** ESPN's first season with real box-score counts in the WNBA's files: its 2002 lines are zeros. */
export const ESPN_COUNTS_FROM = 2003

/** The game logs' plus-minus: null on every line before 2008 but 0 to 62 a season, so not read then. */
export const PLUS_MINUS_FROM = 2008

const LOGS = 'src_wnba_game_logs'
const BOX = 'src_wnba_player_box'
/**
 * The league's play by play, for the turnovers charged to no player where a team row falls short. In
 * the plays tier: a refresh that writes it builds the game tables again at its end (`IDENTITY_LATE`).
 */
const PBP = 'src_wnba_pbp'
/** A play by play row whose person is a team (its turnover is the team's own): the league's team ids. */
const TEAM_IDS_FROM = 1611661300

/** The game's key for a source row's team: the 2026 Portland Fire are `-id` in `team` (T1301.5). */
const teamKey = (teamId: string): string =>
  `CASE WHEN abs(g.home_team_id) = ${teamId} THEN g.home_team_id
        WHEN abs(g.away_team_id) = ${teamId} THEN g.away_team_id END`

/** ESPN's starter flags, from every line it lists, its 2002 zeros included. */
const espnStarters = (have: Have): string => {
  const t = 'src_espn_player_box'
  return have.tables.has(t)
    ? `CREATE OR REPLACE TEMP TABLE espn_starters AS
       SELECT g.game_id, i.player_id, bool_or(${column(have, t, 'b', 'starter', 'BOOLEAN')}) AS starter
       FROM ${t} b
       JOIN game g ON g.espn_game_id = b.game_id AND g.played
       JOIN player_ids i ON i.espn_athlete_id = b.athlete_id
       WHERE b.season = b.file_season
       GROUP BY 1, 2`
    : `CREATE OR REPLACE TEMP TABLE espn_starters AS
       SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS player_id, NULL::BOOLEAN AS starter WHERE false`
}

/**
 * One line per player per game they appeared in. The 2026 box scores list everyone, with `minutes`
 * blank for a player who did not play, and a position for the five starters only (all 704
 * team-games). The game logs list only players who played (a few at 0 minutes, which still count).
 * Who started: the box scores' positions in 2026, ESPN's flags before; unless a team has exactly
 * five, its game reads as unknown, as for the NBA.
 */
function lines(have: Have): string {
  const box = have.tables.has(BOX)
  const counts = (
    alias: string,
    names: (c: (typeof BOX_COUNTS)[number]) => string,
    t: string
  ): string => BOX_COUNTS.map((c) => `${column(have, t, alias, names(c))} AS ${c}`).join(', ')
  const fromBox = box
    ? `SELECT g.game_id, b.person_id AS player_id, ${teamKey('b.team_id')} AS team_id,
              'wnba' AS source, clock_seconds(b.minutes) AS seconds,
              ${counts('b', (c) => NBA_NAMES[c], BOX)},
              ${column(have, BOX, 'b', 'plus_minus_points')} AS plus_minus,
              nullif(trim(${column(have, BOX, 'b', 'position', 'VARCHAR')}), '') IS NOT NULL AS listed
       FROM ${BOX} b JOIN game g ON g.nba_game_id = b.game_id AND g.played
       WHERE nullif(trim(b.minutes), '') IS NOT NULL`
    : `SELECT NULL::VARCHAR AS game_id, NULL::BIGINT AS player_id, NULL::BIGINT AS team_id,
              NULL::VARCHAR AS source, NULL::INTEGER AS seconds,
              ${BOX_COUNTS.map((c) => `NULL::INTEGER AS ${c}`).join(', ')},
              NULL::INTEGER AS plus_minus, NULL::BOOLEAN AS listed WHERE false`
  return `CREATE OR REPLACE TEMP TABLE lines AS
    WITH boxed AS (${fromBox}
    ), logged AS (
      SELECT g.game_id, l.player_id, ${teamKey('l.team_id')} AS team_id, 'wnba' AS source,
             (l.min * 60)::INTEGER AS seconds, ${counts('l', (c) => c, LOGS)},
             CASE WHEN g.season >= ${PLUS_MINUS_FROM} THEN ${column(have, LOGS, 'l', 'plus_minus')} END
               AS plus_minus,
             NULL::BOOLEAN AS listed
      FROM ${LOGS} l JOIN game g ON g.nba_game_id = l.game_id AND g.played
      WHERE l.player_id IS NOT NULL AND g.game_id NOT IN (SELECT game_id FROM boxed)
    ), league AS (
      SELECT * FROM boxed UNION ALL BY NAME SELECT * FROM logged
    ), together AS (
      SELECT n.* EXCLUDE (listed), coalesce(n.listed, s.starter) AS flagged
      FROM league n
      LEFT JOIN espn_starters s ON s.game_id = n.game_id AND s.player_id = n.player_id
      WHERE n.team_id IS NOT NULL
      UNION ALL BY NAME
      SELECT e.* EXCLUDE (starter), e.starter AS flagged FROM espn_lines e
      WHERE e.team_id IS NOT NULL AND e.game_id NOT IN (SELECT game_id FROM league)
    )
    SELECT * EXCLUDE (flagged),
           CASE WHEN count(*) FILTER (WHERE flagged) OVER (PARTITION BY game_id, team_id) = 5
                THEN coalesce(flagged, false) END AS starter
    FROM together`
}

/**
 * A player's position group in a season: the league's roster (`G`, `F`, `C`, `G-F`, `F-C`, `F-G`,
 * `C-F`, the first listed being the group), then ESPN's (`NA` reads as none).
 */
function positions(have: Have): string {
  const none =
    'SELECT NULL::BIGINT AS player_id, NULL::INTEGER AS season, NULL::VARCHAR AS position'
  const roster = have.tables.has('src_wnba_rosters')
    ? `SELECT player_id, season, mode(position_group(position)) AS position
       FROM src_wnba_rosters WHERE player_id IS NOT NULL GROUP BY 1, 2`
    : none
  const espn = have.columns.get('src_espn_player_box')?.has('athlete_position_abbreviation')
    ? `SELECT i.player_id, b.season, mode(position_group(b.athlete_position_abbreviation)) AS position
       FROM src_espn_player_box b JOIN player_ids i ON i.espn_athlete_id = b.athlete_id
       WHERE b.season = b.file_season GROUP BY 1, 2`
    : none
  return `CREATE OR REPLACE TEMP TABLE player_position AS
    WITH roster AS (${roster}), espn AS (${espn}),
    seen AS (
      SELECT DISTINCT l.player_id, g.season FROM lines l JOIN game g USING (game_id)
    )
    SELECT s.player_id, s.season, coalesce(r.position, e.position) AS position
    FROM seen s
    LEFT JOIN roster r ON r.player_id = s.player_id AND r.season = s.season
    LEFT JOIN espn e ON e.player_id = s.player_id AND e.season = s.season`
}

/**
 * The game logs' team rows. Their minutes are the team's (200 in regulation, 25 more an overtime)
 * from 2005; before, they read 0 or 12, so the seconds come from the game's regulation and overtimes
 * where it knows them (most games from 2002), else NULL and the players' are summed. A team row with
 * no field-goal attempt and no point is no box score: the 2018 forfeit's two rows.
 */
function teamBox(have: Have, league: League): string {
  const regulation = league.gameMinutes * 5
  const overtime = league.overtimeMinutes * 5
  const overtimes = column(have, 'game', 'g', 'overtimes')
  // A count where the team row falls short of its players reads the players' sum, per team-game
  // (`teamCount`); turnovers then add the team's own from the play by play, where it is loaded.
  const pbp = have.tables.has(PBP)
    ? `SELECT game_id::VARCHAR AS nba_game_id, location, count(*)::INTEGER AS tov FROM ${PBP}
       WHERE action_type = 'Turnover' AND coalesce(description, '') NOT ILIKE 'No Turnover%'
         AND (coalesce(team_id, 0) = 0 OR person_id = 0 OR person_id >= ${TEAM_IDS_FROM})
       GROUP BY 1, 2`
    : 'SELECT NULL::VARCHAR AS nba_game_id, NULL::VARCHAR AS location, NULL::INTEGER AS tov'
  return `SELECT b.nba_game_id, b.team_id, b.seconds,
           ${BOX_COUNTS.map((c) => `${teamCount(c)} AS ${c}`).join(', ')}
    FROM (
      SELECT g.game_id, g.nba_game_id, g.home_team_id, ${teamKey('l.team_id')} AS team_id,
             (CASE WHEN l.min >= ${regulation} THEN l.min
                   WHEN ${overtimes} IS NOT NULL THEN ${regulation} + ${overtime} * ${overtimes}
              END * 60)::INTEGER AS seconds,
             ${BOX_COUNTS.map((c) => `${column(have, LOGS, 'l', c)} AS ${c}`).join(', ')}
      FROM ${LOGS} l JOIN game g ON g.nba_game_id = l.game_id AND g.played
      WHERE l.player_id IS NULL AND NOT (coalesce(l.fga, 0) = 0 AND coalesce(l.pts, 0) = 0)
    ) b
    LEFT JOIN (
      SELECT game_id, team_id, ${BOX_COUNTS.map((c) => `sum(${c}) AS ${c}`).join(', ')}
      FROM lines WHERE source = 'wnba' GROUP BY 1, 2
    ) p ON p.game_id = b.game_id AND p.team_id = b.team_id
    LEFT JOIN (${pbp}) t
      ON t.nba_game_id = b.nba_game_id
     AND t.location = CASE WHEN b.team_id = b.home_team_id THEN 'h' ELSE 'v' END`
}

/**
 * A team-game's count: the game logs' team row where it is at least its players' sum, else the
 * players' sum (the row falls short on turnovers in most games of 1997, 2000 and 2003, and on a few
 * counts in one game of 1999, 2006 and 2008; `wnba-agreement.md`). Short turnovers add the team's own,
 * charged to no player in the play by play, as the team row counts them from 2004 (equal on 99.3 to
 * 100 % of team-games). Points stay the team row's: it equals the score in every game, and where the
 * players differ they are the long side.
 */
const teamCount = (c: (typeof BOX_COUNTS)[number]): string => {
  if (c === 'pts') return 'b.pts'
  const players = c === 'tov' ? 'p.tov + coalesce(t.tov, 0)' : `p.${c}`
  return `CASE WHEN b.${c} < p.${c} THEN ${players} ELSE b.${c} END`
}

export const WNBA_DERIVED: DerivedRecipe = {
  // 2: a team row short of its players reads their sum, turnovers with the team's own (T1301.7).
  version: 2,
  needs: ['game', 'team', 'player_ids', LOGS],
  lines: (have) => [
    espnLines(have, ESPN_COUNTS_FROM),
    espnStarters(have),
    lines(have),
    positions(have)
  ],
  temps: ['espn_lines', 'espn_starters'],
  teamBox,
  boxSource: 'wnba',
  // Players summed are the league's lines (the two games the schedule lacks), or ESPN's (the Cup final).
  summedSource: 'p.source',
  // The league's team rows count the team's own turnovers from 2004, and in 1997, 2000 and 2003 the
  // build adds them where a row falls short of its players; 1998, 1999, 2001 and 2002 lack them.
  teamTurnovers: 'own',
  // ESPN publishes the WNBA's points in the paint, off turnovers and on the fast break from 2023 only.
  espnKinds: { paint: 2023, fastBreak: 2023, turnover: 2023 },
  breaks: []
}
