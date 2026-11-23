import { recipeOf, type League } from '@shared/leagues'
import { COMBINE_TABLES, eventYear } from '@shared/stats/profile'
import type { StatsDb } from '../db'
import { column, inspect, modeSql, type Have } from './sql'

/**
 * The attribute tables (D51): what Metis knows about who a player or a team is, built from the
 * columns the loaded sources publish, so a board can be filtered on any of it and the profile reads
 * the same facts. Three tables, in each league's own file:
 *
 * - `player_attributes`, one row per player of the `player` table: what never changes for a person
 *   (birth date and place, school, draft, the combine's measures, height and weight as last
 *   published, first and last season).
 * - `player_season_attributes`, one row per player and season that a box score or the league's
 *   roster lists them in: what changes by season (team, jersey, listed position, experience, a
 *   college player's class, height and weight that season), with the roster's line as published.
 * - `team_attributes`, one row per row of the `team` table (a team in a season): conference,
 *   division, city, arena, head coach and the first season in the data.
 *
 * Text is trimmed and an empty text is NULL; a value no source holds is NULL, never a guess. Where two
 * sources publish the same fact the table keeps each beside the other (`_roster`, `_espn`) and the
 * plain column reads them in a stated order, the league's own first (policy 5). Age is not stored: it
 * is worked out when read, from the birth date and the season's reference day (`ageSql`).
 */

/** Bump when a table's columns or rules change, so the next refresh builds them with nothing downloaded. */
export const ATTRIBUTES_VERSION = 1

export const ATTRIBUTE_TABLES = [
  'player_attributes',
  'player_season_attributes',
  'team_attributes'
] as const

/** Each league's file holds its own roster, draft, bio and coach files under its own source name (D36). */
const ROSTERS = ['src_nba_rosters', 'src_wnba_rosters']
const DRAFTS = ['src_nba_draft', 'src_wnba_draft']
const COACHES = ['src_nba_coaches', 'src_wnba_coaches']
const BIO = 'src_dash_player_bio'
const CORE = 'src_espn_player_core'
const ESPN_ROSTERS = 'src_espn_rosters'
const NCAA_ROSTERS = 'src_ncaa_team_rosters'
const SCHEDULE = 'src_espn_schedule'
const XWALK_TEAM = 'src_xwalk_team'

const firstOf = (have: Have, tables: readonly string[]): string | undefined =>
  tables.find((t) => have.tables.has(t))

/** A published text column, trimmed, NULL when empty or when the table or column is not loaded. */
const text = (have: Have, table: string, alias: string, name: string): string =>
  `nullif(trim(${column(have, table, alias, name, 'VARCHAR')}), '')`

/** The league's roster height, "6-11", in inches. */
const dashInches = (x: string): string =>
  `(TRY_CAST(split_part(${x}, '-', 1) AS INTEGER) * 12 + TRY_CAST(split_part(${x}, '-', 2) AS INTEGER))`
/** ESPN's roster height, `6' 5"`, in inches. */
const feetInches = (x: string): string =>
  `(TRY_CAST(regexp_extract(${x}, '^\\s*(\\d+)''', 1) AS INTEGER) * 12 + TRY_CAST(regexp_extract(${x}, '''\\s*(\\d+)', 1) AS INTEGER))`
/** A weight as published, "220" or "205 lbs", in pounds. */
const pounds = (x: string): string => `TRY_CAST(regexp_extract(${x}, '(\\d+)', 1) AS INTEGER)`
/** The league's roster date, "MAR 30, 2003". */
const rosterDate = (x: string): string => `try_strptime(${x}, '%b %d, %Y')::DATE`
/**
 * ESPN's date of birth, "1984-12-30T08:00Z": midnight in the United States written in UTC, so the
 * date part is the birth date.
 */
const espnDate = (x: string): string => `TRY_CAST(left(${x}, 10) AS DATE)`
/** A positive number as published, NULL for 0 or less (ESPN writes 0 for none in its draft columns). */
const positive = (x: string): string => `CASE WHEN ${x} > 0 THEN ${x} END`

/**
 * The latest non-NULL value of `x` over `season`, ties broken on the value so two builds of the same
 * rows agree (T1302.9).
 */
const latest = (x: string, season = 'season'): string =>
  `arg_max(${x}, (${season}, ${x})) FILTER (WHERE ${x} IS NOT NULL)`

/** An empty row of the given columns, for a source not loaded. */
const none = (columns: Record<string, string>): string =>
  `SELECT ${Object.entries(columns)
    .map(([name, type]) => `NULL::${type} AS ${name}`)
    .join(', ')} WHERE false`

/** Whether the league is a college one: ESPN's experience there is a class year, not seasons played. */
const isCollege = (league: League): boolean => recipeOf(league, 'derived') === 'college'

/** ESPN athletes to the league's player key (D13, D28, D40): the `player_ids` identity table. */
const ESPN_KEY = 'JOIN player_ids k ON k.espn_athlete_id = TRY_CAST(c.athlete_id AS BIGINT)'

/** ESPN's athlete file, one row per player and season, before the per-player and per-season reads. */
function espnCore(have: Have): string {
  if (!have.tables.has(CORE) || !have.tables.has('player_ids')) {
    return none({
      player_id: 'BIGINT',
      season: 'INTEGER',
      birth_date: 'DATE',
      birth_city: 'VARCHAR',
      birth_state: 'VARCHAR',
      birth_country: 'VARCHAR',
      height_in: 'INTEGER',
      weight_lb: 'INTEGER',
      jersey: 'VARCHAR',
      position: 'VARCHAR',
      experience: 'INTEGER',
      draft_year: 'INTEGER',
      draft_round: 'INTEGER',
      draft_pick: 'INTEGER'
    })
  }
  const t = CORE
  return `SELECT k.player_id, c.season,
                 max(${espnDate(text(have, t, 'c', 'date_of_birth'))}) AS birth_date,
                 max(${text(have, t, 'c', 'birth_city')}) AS birth_city,
                 max(${text(have, t, 'c', 'birth_state')}) AS birth_state,
                 max(${text(have, t, 'c', 'birth_country')}) AS birth_country,
                 max(${positive(`round(${column(have, t, 'c', 'height', 'DOUBLE')})::INTEGER`)}) AS height_in,
                 max(${positive(`round(${column(have, t, 'c', 'weight', 'DOUBLE')})::INTEGER`)}) AS weight_lb,
                 max(${text(have, t, 'c', 'jersey')}) AS jersey,
                 max(${text(have, t, 'c', 'position_abbreviation')}) AS position,
                 max(${column(have, t, 'c', 'experience_years')}) AS experience,
                 max(${positive(column(have, t, 'c', 'draft_year'))}) AS draft_year,
                 max(${positive(column(have, t, 'c', 'draft_round'))}) AS draft_round,
                 max(${positive(column(have, t, 'c', 'draft_selection'))}) AS draft_pick
          FROM ${t} c ${ESPN_KEY}
          GROUP BY 1, 2`
}

/** ESPN's season rosters (the pros' from 2024-25 or 2025, every college season), one row per player and season. */
function espnRosters(have: Have): string {
  if (!have.tables.has(ESPN_ROSTERS) || !have.tables.has('player_ids')) {
    return none({
      player_id: 'BIGINT',
      season: 'INTEGER',
      birth_date: 'DATE',
      birth_city: 'VARCHAR',
      birth_state: 'VARCHAR',
      birth_country: 'VARCHAR',
      height_in: 'INTEGER',
      weight_lb: 'INTEGER',
      jersey: 'VARCHAR',
      position: 'VARCHAR',
      class: 'VARCHAR'
    })
  }
  const t = ESPN_ROSTERS
  // ESPN's college class, "Freshman", in stats.ncaa.org's words, so one class reads one way.
  const cls = `CASE ${text(have, t, 'c', 'experience_display_value')}
      WHEN 'Freshman' THEN 'Fr.' WHEN 'Sophomore' THEN 'So.' WHEN 'Junior' THEN 'Jr.'
      WHEN 'Senior' THEN 'Sr.' END`
  return `SELECT k.player_id, c.season,
                 max(${espnDate(text(have, t, 'c', 'date_of_birth'))}) AS birth_date,
                 max(${text(have, t, 'c', 'birth_place_city')}) AS birth_city,
                 max(${text(have, t, 'c', 'birth_place_state')}) AS birth_state,
                 max(${text(have, t, 'c', 'birth_place_country')}) AS birth_country,
                 max(${positive(feetInches(text(have, t, 'c', 'height')))}) AS height_in,
                 max(${positive(pounds(text(have, t, 'c', 'weight')))}) AS weight_lb,
                 max(${text(have, t, 'c', 'jersey')}) AS jersey,
                 max(${text(have, t, 'c', 'position_abbreviation')}) AS position,
                 max(${cls}) AS class
          FROM ${t} c ${ESPN_KEY}
          GROUP BY 1, 2`
}

/**
 * The league's own roster (the NBA's and WNBA's), one row per player and season: the line of the
 * season's last team where it lists them on more than one, as published and typed.
 */
function leagueRoster(have: Have): string {
  const r = firstOf(have, ROSTERS)
  const columns = {
    player_id: 'BIGINT',
    season: 'INTEGER',
    team_id: 'BIGINT',
    num: 'VARCHAR',
    position: 'VARCHAR',
    height: 'VARCHAR',
    weight: 'VARCHAR',
    birth_date: 'VARCHAR',
    age: 'DOUBLE',
    exp: 'VARCHAR',
    school: 'VARCHAR',
    how_acquired: 'VARCHAR'
  }
  if (!r) return none(columns)
  const last = have.tables.has('player_season')
    ? `LEFT JOIN (SELECT player_id, season, arg_max(last_team_id, (last_date, last_team_id)) AS team_id
                  FROM player_season WHERE team_id IS NULL GROUP BY 1, 2) l
         ON l.player_id = r.player_id AND l.season = r.season`
    : 'LEFT JOIN (SELECT NULL::BIGINT AS player_id, NULL::INTEGER AS season, NULL::BIGINT AS team_id) l ON false'
  const team = column(have, r, 'r', 'team_id', 'BIGINT')
  return `SELECT r.player_id, r.season, ${team} AS team_id,
                 ${text(have, r, 'r', 'num')} AS num, ${text(have, r, 'r', 'position')} AS position,
                 ${text(have, r, 'r', 'height')} AS height, ${text(have, r, 'r', 'weight')} AS weight,
                 ${text(have, r, 'r', 'birth_date')} AS birth_date,
                 ${column(have, r, 'r', 'age', 'DOUBLE')} AS age, ${text(have, r, 'r', 'exp')} AS exp,
                 ${text(have, r, 'r', 'school')} AS school,
                 ${text(have, r, 'r', 'how_acquired')} AS how_acquired
          FROM ${r} r ${last}
          WHERE r.player_id IS NOT NULL
          QUALIFY row_number() OVER (
            PARTITION BY r.player_id, r.season
            ORDER BY (${team} = l.team_id) DESC NULLS LAST, ${team} DESC NULLS LAST) = 1`
}

/** stats.ncaa.org's team rosters (the colleges'), one row per player and season, through `ncaa_player_ids`. */
function ncaaRosters(have: Have): string {
  const columns = {
    player_id: 'BIGINT',
    season: 'INTEGER',
    jersey: 'VARCHAR',
    class: 'VARCHAR',
    position: 'VARCHAR',
    height_in: 'INTEGER',
    hometown: 'VARCHAR',
    high_school: 'VARCHAR'
  }
  if (!have.tables.has(NCAA_ROSTERS) || !have.tables.has('ncaa_player_ids')) return none(columns)
  const t = NCAA_ROSTERS
  // "---" is the roster's mark for no class, not a class.
  return `SELECT i.player_id, r.season,
                 max(${text(have, t, 'r', 'jersey')}) AS jersey,
                 max(nullif(${text(have, t, 'r', 'class')}, '---')) AS class,
                 max(${text(have, t, 'r', 'position')}) AS position,
                 max(${positive(column(have, t, 'r', 'ht_inches'))}) AS height_in,
                 max(${text(have, t, 'r', 'hometown')}) AS hometown,
                 max(${text(have, t, 'r', 'high_school')}) AS high_school
          FROM ${t} r
          JOIN ncaa_player_ids i ON i.season = r.season AND i.ncaa_player_id = r.player_id::VARCHAR
          GROUP BY 1, 2`
}

/** The league's dashboard bio (the NBA's and WNBA's), one row per player: their latest line. */
function bio(have: Have): string {
  const columns = {
    player_id: 'BIGINT',
    country: 'VARCHAR',
    college: 'VARCHAR',
    said_undrafted: 'BOOLEAN'
  }
  if (!have.tables.has(BIO)) return none(columns)
  const country = text(have, BIO, 'b', 'country')
  const college = text(have, BIO, 'b', 'college')
  const draft = text(have, BIO, 'b', 'draft_year')
  return `SELECT b.player_id, ${latest(country)} AS country, ${latest(college)} AS college,
                 ${latest(draft)} = 'Undrafted' AS said_undrafted
          FROM ${BIO} b WHERE b.player_id IS NOT NULL GROUP BY 1`
}

/** The league's draft (the NBA's and WNBA's), one row per player: the latest that lists them, as the profile reads it. */
function draft(have: Have, league: League): string {
  const d = firstOf(have, DRAFTS)
  const columns = {
    player_id: 'BIGINT',
    draft_year: 'INTEGER',
    draft_round: 'INTEGER',
    draft_round_pick: 'INTEGER',
    draft_overall_pick: 'INTEGER',
    draft_team_id: 'BIGINT',
    draft_team_code: 'VARCHAR',
    draft_team_name: 'VARCHAR',
    draft_organization: 'VARCHAR',
    draft_organization_type: 'VARCHAR'
  }
  if (!d) return none(columns)
  // The NBA labels a draft by the season after it, the WNBA by its own year (`League.eventYear`).
  const lag = 2000 - eventYear(2000, league)
  // A file can list one pick more than once, the rows differing only in the team (the WNBA's 2024:
  // Caitlin Clark with no team and with Indiana, Celeste Taylor under three teams). The team is the
  // one the rows with a team agree on, and none where they disagree: which drafted them is not known.
  const agreed = (x: string): string =>
    `CASE WHEN count(DISTINCT team_id) FILTER (WHERE team_id IS NOT NULL) = 1
          THEN max(${x}) FILTER (WHERE team_id IS NOT NULL) END`
  return `SELECT player_id, draft_year, min(draft_round) AS draft_round,
                 min(draft_round_pick) AS draft_round_pick, min(draft_overall_pick) AS draft_overall_pick,
                 ${agreed('team_id')} AS draft_team_id, ${agreed('code')} AS draft_team_code,
                 ${agreed('team_name')} AS draft_team_name,
                 max(organization) AS draft_organization,
                 max(organization_type) AS draft_organization_type
          FROM (SELECT d.person_id AS player_id, d.season - ${lag} AS draft_year,
                       ${column(have, d, 'd', 'round_number')} AS draft_round,
                       ${column(have, d, 'd', 'round_pick')} AS draft_round_pick,
                       ${column(have, d, 'd', 'overall_pick')} AS draft_overall_pick,
                       ${column(have, d, 'd', 'team_id', 'BIGINT')} AS team_id,
                       ${text(have, d, 'd', 'team_abbreviation')} AS code,
                       nullif(trim(concat_ws(' ', ${text(have, d, 'd', 'team_city')}, ${text(have, d, 'd', 'team_name')})), '') AS team_name,
                       ${text(have, d, 'd', 'organization')} AS organization,
                       ${text(have, d, 'd', 'organization_type')} AS organization_type
                FROM ${d} d WHERE d.person_id IS NOT NULL)
          GROUP BY player_id, draft_year
          QUALIFY row_number() OVER (PARTITION BY player_id ORDER BY draft_year DESC) = 1`
}

/** The draft file's first draft year, by the draft's own year; NULL without one. */
function draftFirstYear(have: Have, league: League): string {
  const d = firstOf(have, DRAFTS)
  if (!d) return 'NULL::INTEGER'
  return `(SELECT min(season) - ${2000 - eventYear(2000, league)} FROM ${d})`
}

/** The combine's measures (the NBA's), one row per player: their latest combine, from the tables the profile reads. */
function combine(have: Have, league: League): string {
  const a = COMBINE_TABLES.anthro
  const d = COMBINE_TABLES.drills
  const measures: [string, string, string][] = [
    [a, 'height_wo_shoes', 'DOUBLE'],
    [a, 'height_w_shoes', 'DOUBLE'],
    [a, 'weight', 'DOUBLE'],
    [a, 'wingspan', 'DOUBLE'],
    [a, 'standing_reach', 'DOUBLE'],
    [a, 'body_fat_pct', 'DOUBLE'],
    [a, 'hand_length', 'DOUBLE'],
    [a, 'hand_width', 'DOUBLE'],
    [d, 'standing_vertical_leap', 'DOUBLE'],
    [d, 'max_vertical_leap', 'DOUBLE'],
    [d, 'lane_agility_time', 'DOUBLE'],
    [d, 'modified_lane_agility_time', 'DOUBLE'],
    [d, 'three_quarter_sprint', 'DOUBLE'],
    [d, 'bench_press', 'INTEGER']
  ]
  const out = (name: string): string => `combine_${name === 'weight' ? 'weight_lb' : name}`
  const columns = {
    player_id: 'BIGINT',
    combine_year: 'INTEGER',
    combine_position: 'VARCHAR',
    ...Object.fromEntries(measures.map(([, name, type]) => [out(name), type]))
  }
  const parts = [a, d].filter((t) => have.tables.has(t))
  if (parts.length === 0) return none(columns)
  // Every attendee with an id once a combine, from whichever tables are loaded; `-1` stands for
  // several without one, so they are left out.
  const keys = parts
    .map((t) => `SELECT season, player_id FROM ${t} WHERE player_id > 0`)
    .join(' UNION ')
  const alias = (t: string): string => (t === a ? 'an' : 'dr')
  const joins = parts
    .map(
      (t) =>
        `LEFT JOIN (SELECT * FROM ${t} WHERE player_id > 0
                    QUALIFY row_number() OVER (PARTITION BY season, player_id ORDER BY player_name) = 1) ${alias(t)}
           ON ${alias(t)}.season = k.season AND ${alias(t)}.player_id = k.player_id`
    )
    .join('\n')
  const value = (t: string, name: string, type: string): string =>
    have.tables.has(t) ? column(have, t, alias(t), name, type) : `NULL::${type}`
  const position = parts
    .map((t) => text(have, t, alias(t), 'position'))
    .reduce((x, y) => `coalesce(${x}, ${y})`)
  return `SELECT k.player_id, ${eventYearSql('k.season', league)} AS combine_year,
                 ${position} AS combine_position,
                 ${measures.map(([t, name, type]) => `${value(t, name, type)} AS ${out(name)}`).join(',\n')}
          FROM (${keys}) k ${joins}
          QUALIFY row_number() OVER (PARTITION BY k.player_id ORDER BY k.season DESC) = 1`
}

const eventYearSql = (season: string, league: League): string =>
  `${season} - ${2000 - eventYear(2000, league)}`

/** The seasons each player has a counted game in, from the season table's row of no team. */
function playedSql(have: Have, league: League): string {
  if (!have.tables.has('player_season')) {
    return none({ player_id: 'BIGINT', season: 'INTEGER', team_id: 'BIGINT' })
  }
  const types = league.countedTypes.map((t) => `'${t}'`).join(', ')
  return `SELECT player_id, season, arg_max(last_team_id, (last_date, last_team_id)) AS team_id
          FROM player_season WHERE team_id IS NULL AND game_type IN (${types}) GROUP BY 1, 2`
}

/** The SQL that builds `player_attributes`. */
export function playerAttributesSql(have: Have, league: League): string {
  const roster = leagueRoster(have)
  return `CREATE OR REPLACE TABLE player_attributes AS
  WITH core AS (${espnCore(have)}),
  espn_roster AS (${espnRosters(have)}),
  roster AS (${roster}),
  ncaa AS (${ncaaRosters(have)}),
  played AS (${playedSql(have, league)}),
  espn AS (
    SELECT player_id, ${latest('birth_date')} AS birth_date, ${latest('birth_city')} AS birth_city,
           ${latest('birth_state')} AS birth_state, ${latest('birth_country')} AS birth_country,
           ${latest('height_in')} AS height_in, ${latest('weight_lb')} AS weight_lb,
           ${latest('draft_year')} AS draft_year, ${latest('draft_round')} AS draft_round,
           ${latest('draft_pick')} AS draft_pick
    FROM (SELECT player_id, season, birth_date, birth_city, birth_state, birth_country, height_in,
                 weight_lb, draft_year, draft_round, draft_pick FROM core
          UNION ALL BY NAME
          SELECT player_id, season, birth_date, birth_city, birth_state, birth_country, height_in,
                 weight_lb FROM espn_roster)
    GROUP BY 1
  ),
  own AS (
    SELECT player_id, ${latest(rosterDate('birth_date'))} AS birth_date, ${latest('school')} AS school,
           ${latest(`${positive(dashInches('height'))}`)} AS height_in,
           ${latest(`${positive(pounds('weight'))}`)} AS weight_lb
    FROM roster GROUP BY 1
  ),
  college AS (
    SELECT player_id, ${latest('hometown')} AS hometown, ${latest('high_school')} AS high_school,
           ${latest('height_in')} AS height_in
    FROM ncaa GROUP BY 1
  ),
  bio AS (${bio(have)}),
  draft AS (${draft(have, league)}),
  combine AS (${combine(have, league)}),
  seasons AS (SELECT player_id, count(*) AS seasons_played FROM played GROUP BY 1)
  SELECT p.player_id, p.name,
         coalesce(o.birth_date, e.birth_date) AS birth_date,
         o.birth_date AS birth_date_roster, e.birth_date AS birth_date_espn,
         e.birth_city, e.birth_state, e.birth_country,
         b.country,
         coalesce(o.school, b.college) AS school,
         c.hometown, c.high_school,
         coalesce(o.height_in, c.height_in, e.height_in) AS height_in,
         coalesce(o.height_in, c.height_in) AS height_in_roster, e.height_in AS height_in_espn,
         coalesce(o.weight_lb, e.weight_lb) AS weight_lb,
         o.weight_lb AS weight_lb_roster, e.weight_lb AS weight_lb_espn,
         -- The league's draft, else ESPN's athlete file, whose pick is the overall pick: it holds the
         -- drafts before the league's file starts.
         coalesce(d.draft_year, e.draft_year) AS draft_year,
         coalesce(d.draft_round, e.draft_round) AS draft_round,
         d.draft_round_pick, coalesce(d.draft_overall_pick, e.draft_pick) AS draft_overall_pick,
         d.draft_team_id,
         d.draft_team_code, d.draft_team_name, d.draft_organization, d.draft_organization_type,
         e.draft_year AS draft_year_espn, e.draft_round AS draft_round_espn,
         e.draft_pick AS draft_pick_espn,
         -- Drafted where a draft lists them; undrafted where the league's bio says so, or where
         -- their first season comes after the draft file's first draft and it does not list them;
         -- unknown before the file's first draft.
         CASE WHEN d.player_id IS NOT NULL OR e.draft_year IS NOT NULL THEN false
              WHEN b.said_undrafted THEN true
              WHEN p.first_season - 1 >= ${draftFirstYear(have, league)} THEN true END AS undrafted,
         ${Object.keys(COMBINE_COLUMNS)
           .map((name) => `x.${name}`)
           .join(', ')},
         p.first_season, p.last_season, coalesce(s.seasons_played, 0)::INTEGER AS seasons_played
  FROM player p
  LEFT JOIN own o ON o.player_id = p.player_id
  LEFT JOIN espn e ON e.player_id = p.player_id
  LEFT JOIN college c ON c.player_id = p.player_id
  LEFT JOIN bio b ON b.player_id = p.player_id
  LEFT JOIN draft d ON d.player_id = p.player_id
  LEFT JOIN combine x ON x.player_id = p.player_id
  LEFT JOIN seasons s ON s.player_id = p.player_id
  ORDER BY p.player_id`
}

/** The combine's columns in `player_attributes`, with their types. */
export const COMBINE_COLUMNS: Readonly<Record<string, string>> = {
  combine_year: 'INTEGER',
  combine_position: 'VARCHAR',
  combine_height_wo_shoes: 'DOUBLE',
  combine_height_w_shoes: 'DOUBLE',
  combine_weight_lb: 'DOUBLE',
  combine_wingspan: 'DOUBLE',
  combine_standing_reach: 'DOUBLE',
  combine_body_fat_pct: 'DOUBLE',
  combine_hand_length: 'DOUBLE',
  combine_hand_width: 'DOUBLE',
  combine_standing_vertical_leap: 'DOUBLE',
  combine_max_vertical_leap: 'DOUBLE',
  combine_lane_agility_time: 'DOUBLE',
  combine_modified_lane_agility_time: 'DOUBLE',
  combine_three_quarter_sprint: 'DOUBLE',
  combine_bench_press: 'INTEGER'
}

/** The SQL that builds `player_season_attributes`. */
export function playerSeasonAttributesSql(have: Have, league: League): string {
  const college = isCollege(league)
  const team = have.tables.has('team')
  return `CREATE OR REPLACE TABLE player_season_attributes AS
  WITH core AS (${espnCore(have)}),
  espn_roster AS (${espnRosters(have)}),
  roster AS (${leagueRoster(have)}),
  ncaa AS (${ncaaRosters(have)}),
  played AS (${playedSql(have, league)}),
  rows AS (
    SELECT player_id, season FROM played
    UNION SELECT player_id, season FROM roster
    UNION SELECT player_id, season FROM ncaa
  ),
  numbered AS (
    -- The season's place in the player's career in the data: 1 for their first season with a
    -- counted game. Unknown for a player whose first such season is the league's first loaded one,
    -- who may have played before it.
    SELECT player_id, season,
           CASE WHEN min(season) OVER (PARTITION BY player_id) > ${league.firstSeason}
                THEN row_number() OVER (PARTITION BY player_id ORDER BY season)::INTEGER END AS season_number
    FROM played
  )
  SELECT w.player_id, w.season::INTEGER AS season,
         coalesce(pl.team_id, r.team_id) AS team_id,
         ${team ? 't.code' : 'NULL::VARCHAR'} AS team_code,
         coalesce(r.num, n.jersey, er.jersey, c.jersey) AS jersey,
         coalesce(r.position, n.position, er.position, c.position) AS position,
         -- The league's roster alone: ESPN counts a season's experience another way (LeBron James
         -- reads 21, 23, 23 over three seasons mixed), and in college its count is a class year.
         CASE WHEN r.exp = 'R' THEN 0 ELSE TRY_CAST(r.exp AS INTEGER) END AS experience,
         ${college ? 'NULL::INTEGER' : 'c.experience'} AS experience_espn,
         coalesce(n.class, er.class) AS class,
         coalesce(${positive(dashInches('r.height'))}, n.height_in, er.height_in, c.height_in) AS height_in,
         coalesce(${positive(pounds('r.weight'))}, er.weight_lb, c.weight_lb) AS weight_lb,
         r.how_acquired,
         nb.season_number,
         -- The league's roster line as published, which the profile shows (T708).
         r.player_id IS NOT NULL AS on_roster, r.team_id AS roster_team_id, r.num AS roster_number, r.position AS roster_position,
         r.height AS roster_height, r.weight AS roster_weight, r.birth_date AS roster_birth_date,
         r.age AS roster_age, r.exp AS roster_experience, r.school AS roster_school
  FROM rows w
  LEFT JOIN played pl ON pl.player_id = w.player_id AND pl.season = w.season
  LEFT JOIN roster r ON r.player_id = w.player_id AND r.season = w.season
  LEFT JOIN ncaa n ON n.player_id = w.player_id AND n.season = w.season
  LEFT JOIN espn_roster er ON er.player_id = w.player_id AND er.season = w.season
  LEFT JOIN core c ON c.player_id = w.player_id AND c.season = w.season
  LEFT JOIN numbered nb ON nb.player_id = w.player_id AND nb.season = w.season
  ${team ? 'LEFT JOIN team t ON t.team_id = coalesce(pl.team_id, r.team_id) AND t.season = w.season' : ''}
  ORDER BY w.player_id, w.season`
}

/** The SQL that builds `team_attributes`. */
export function teamAttributesSql(have: Have, league: League): string {
  const coaches = firstOf(have, COACHES)
  const s = SCHEDULE
  const home = have.tables.has(s)
    ? `SELECT t.team_id, t.season, ${text(have, s, 's', 'venue_full_name')} AS venue,
              ${text(have, s, 's', 'venue_address_city')} AS city,
              ${text(have, s, 's', 'venue_address_state')} AS state,
              ${column(have, s, 's', 'venue_capacity', 'DOUBLE')} AS capacity,
              ${text(have, s, 's', 'home_location')} AS location
       FROM ${s} s JOIN team t ON t.espn_team_id = s.home_id AND t.season = s.season
       WHERE NOT coalesce(${column(have, s, 's', 'neutral_site', 'BOOLEAN')}, false)`
    : none({
        team_id: 'BIGINT',
        season: 'INTEGER',
        venue: 'VARCHAR',
        city: 'VARCHAR',
        state: 'VARCHAR',
        capacity: 'DOUBLE',
        location: 'VARCHAR'
      })
  const coach = coaches
    ? `SELECT team_id, season,
              string_agg(${text(have, coaches, 'c', 'coach_name')}, ' / '
                         ORDER BY ${column(have, coaches, 'c', 'sort_sequence')}, coach_id) AS head_coach
       FROM ${coaches} c WHERE ${text(have, coaches, 'c', 'coach_type')} = 'Head Coach'
       GROUP BY 1, 2`
    : none({ team_id: 'BIGINT', season: 'INTEGER', head_coach: 'VARCHAR' })
  // The league's own city for its teams (the NBA's and WNBA's crosswalk), else ESPN's location; a
  // college's ESPN location is the school's name, not a city, so the colleges read none.
  const city =
    have.tables.has(XWALK_TEAM) && !isCollege(league)
      ? `SELECT t.team_id, t.season, max(${text(have, XWALK_TEAM, 'x', 'nba_team_city')}) AS city
         FROM ${XWALK_TEAM} x JOIN team t ON t.espn_team_id = x.espn_team_id AND t.season = x.season
         GROUP BY 1, 2`
      : none({ team_id: 'BIGINT', season: 'INTEGER', city: 'VARCHAR' })
  const location = isCollege(league) ? 'NULL::VARCHAR' : 'l.location'
  const division1 = have.columns.get('team')?.has('division_i') ? 't.division_i' : 'NULL::BOOLEAN'
  return `CREATE OR REPLACE TABLE team_attributes AS
  WITH home AS (${home}),
  arena AS (
    SELECT team_id, season, ${modeSql('venue')} AS arena, ${modeSql('location')} AS location
    FROM home GROUP BY 1, 2
  ),
  place AS (
    SELECT h.team_id, h.season, ${modeSql('h.city')} AS arena_city, ${modeSql('h.state')} AS arena_state,
           max(h.capacity)::INTEGER AS arena_capacity
    FROM home h JOIN arena a ON a.team_id = h.team_id AND a.season = h.season AND h.venue = a.arena
    GROUP BY 1, 2
  ),
  coach AS (${coach}),
  city AS (${city})
  SELECT t.team_id, t.season, t.code, t.name, t.conference, t.division,
         coalesce(c.city, ${location}) AS city,
         l.arena, p.arena_city, p.arena_state, p.arena_capacity,
         h.head_coach,
         min(t.season) OVER (PARTITION BY t.team_id) AS first_season,
         ${division1} AS division_i
  FROM team t
  LEFT JOIN arena l ON l.team_id = t.team_id AND l.season = t.season
  LEFT JOIN place p ON p.team_id = t.team_id AND p.season = t.season
  LEFT JOIN coach h ON h.team_id = t.team_id AND h.season = t.season
  LEFT JOIN city c ON c.team_id = t.team_id AND c.season = t.season
  ORDER BY t.team_id, t.season`
}

/** The tables the attributes cannot be built without: the identity tables. */
const NEEDS = ['player', 'team']

/** Whether the tables the attributes are built from are there: the identity tables. */
export async function canBuildAttributes(db: StatsDb): Promise<boolean> {
  const row = await db.get<{ n: number }>(
    `SELECT count(*) AS n FROM duckdb_tables()
     WHERE schema_name = 'main' AND table_name IN (${NEEDS.map((t) => `'${t}'`).join(', ')})`
  )
  return Number(row?.n ?? 0) === NEEDS.length
}

export async function attributesStale(db: StatsDb): Promise<boolean> {
  const row = await db.get<{ version: number }>(
    "SELECT version FROM derived_state WHERE name = 'attributes'"
  )
  return (row?.version ?? 0) < ATTRIBUTES_VERSION
}

/**
 * Builds the three attribute tables from what is loaded. Each replaces the old one in its own
 * statement, so a screen reading it sees the old rows or the new ones. A source not loaded reads as
 * NULL and does not fail the build (policy 4). Returns the player rows.
 */
export async function buildAttributes(db: StatsDb, league: League): Promise<number> {
  const have = await inspect(db)
  if (!NEEDS.every((t) => have.tables.has(t))) return 0
  await db.exec(playerAttributesSql(have, league))
  await db.exec(playerSeasonAttributesSql(have, league))
  await db.exec(teamAttributesSql(have, league))
  await db.exec('INSERT OR REPLACE INTO derived_state VALUES (?, ?)', [
    'attributes',
    ATTRIBUTES_VERSION
  ])
  const row = await db.get<{ n: number }>('SELECT count(*) AS n FROM player_attributes')
  return Number(row?.n ?? 0)
}
