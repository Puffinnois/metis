/**
 * The SQL of the links (D46), ported from the research's queries (`scripts/player-links/10-match-nba.sql`
 * and `20-match-wnba.sql`, `docs/reference/player-links.md`). It runs in two places, each on its own
 * file (CLAUDE.md rule 3): a league's worker writes its side of a pair from its own tables, and the
 * links worker builds the links from the sides it keeps and the paired files it downloads. Every pick
 * is by a total order, so two builds of the same files give the same rows (T1302.9's lesson).
 */
import type { IdentityRecipeName, LeaguePair } from '@shared/leagues'
import { sqlIdent } from '../db'

/** A name compared without accents, punctuation or a final Jr., Sr., II, III, IV or V. */
export const NAME_MACRO = `CREATE OR REPLACE TEMP MACRO link_name(s) AS
  trim(regexp_replace(regexp_replace(regexp_replace(lower(strip_accents(s)), '[^a-z ]', '', 'g'), '\\s+', ' ', 'g'),
    ' (jr|sr|ii|iii|iv|v)$', ''))`

/**
 * The draft table's school, as the league writes it, against the start of ESPN's college team name,
 * where the two differ: the research's 31 NBA aliases and the WNBA's, merged (they never disagree).
 */
export const ORG_ALIASES: readonly (readonly [string, string])[] = [
  ['Connecticut', 'UConn'],
  ['California-Los Angeles', 'UCLA'],
  ['UCLA', 'UCLA'],
  ['Louisiana State', 'LSU'],
  ['LSU', 'LSU'],
  ['Southern California', 'USC'],
  ['USC', 'USC'],
  ['Brigham Young', 'BYU'],
  ['Miami (FL)', 'Miami Hurricanes'],
  ['Nevada-Reno', 'Nevada'],
  ['Southern Methodist', 'SMU'],
  ['Central Florida', 'UCF'],
  ['Virginia Commonwealth', 'VCU'],
  ["St. John's (NY)", "St. John's"],
  ['California-Santa Barbara', 'UC Santa Barbara'],
  ['Wisconsin-Milwaukee', 'Milwaukee'],
  ['Mississippi', 'Ole Miss'],
  ['Texas Christian', 'TCU'],
  ['Alabama-Birmingham', 'UAB'],
  ['Nevada-Las Vegas', 'UNLV'],
  ['North Carolina-Wilmington', 'UNC Wilmington'],
  ['Massachusetts', 'UMass'],
  ['Pennsylvania', 'Penn Quakers'],
  ['Texas-El Paso', 'UTEP'],
  ['Texas-San Antonio', 'UTSA'],
  ['Florida International', 'FIU'],
  ['Loyola (IL)', 'Loyola Chicago'],
  ['Southern Mississippi', 'Southern Miss'],
  ['Illinois-Chicago', 'UIC'],
  ['College of Charleston', 'Charleston'],
  ['North Carolina State', 'NC State'],
  ['NC State', 'NC State'],
  ['Pittsburgh', 'Pitt']
]

const literal = (s: string): string => `'${s.replaceAll("'", "''")}'`

const aliasesSql = (): string =>
  `(VALUES ${ORG_ALIASES.map(([a, b]) => `(${literal(a)}, ${literal(b)})`).join(', ')}) AS a(org, espn_prefix)`

/** The columns of a professional side's players, in the hand-over file and the links file. */
export const PRO_PLAYER_COLUMNS = `pro_id BIGINT, name VARCHAR, espn BIGINT, first_season INTEGER,
  dob VARCHAR, espn_college_id BIGINT, school VARCHAR`

/** A college side's players. */
export const COLLEGE_PLAYER_COLUMNS = `col_id BIGINT, name VARCHAR, espn BIGINT, first_season INTEGER,
  last_season INTEGER, dob VARCHAR, teams BIGINT[], team_names VARCHAR[]`

/** One draft line a player and draft. `label` is the table's season, as the league labels it. */
export const DRAFT_COLUMNS = `pro_id BIGINT, name VARCHAR, label INTEGER, round INTEGER, round_pick INTEGER,
  overall_pick INTEGER, team VARCHAR, organization VARCHAR, organization_type VARCHAR`

/**
 * A draft table as published (`nba_stats_draft`, `wnba_stats_draft`), one line a player and draft: the
 * WNBA's lists a few players twice in one draft (research, `20-match-wnba.sql`). Blank text is NULL.
 */
export function draftSql(table: string): string {
  const pick = (col: string): string =>
    `first(${col} ORDER BY overall_pick NULLS LAST, round_number NULLS LAST, team_id NULLS LAST, organization NULLS LAST)`
  return `SELECT person_id::BIGINT AS pro_id, ${pick('player_name')} AS name, season::INTEGER AS label,
      ${pick('round_number')}::INTEGER AS round, ${pick('round_pick')}::INTEGER AS round_pick,
      min(overall_pick)::INTEGER AS overall_pick,
      nullif(trim(${pick("concat_ws(' ', team_city, team_name)")}), '') AS team,
      nullif(trim(${pick('organization')}), '') AS organization,
      nullif(trim(${pick('organization_type')}), '') AS organization_type
    FROM ${sqlIdent(table)} WHERE person_id IS NOT NULL GROUP BY person_id, season`
}

/**
 * A professional league's players, from its own tables: the ESPN birth date and college (ESPN team id)
 * of the player's latest season with one, and the college the league names. Ids are the league's.
 * The NBA's bios name the school in its dashboard file; the WNBA's rosters carry it, and a birth date
 * where ESPN has none (research, `20-match-wnba.sql`).
 */
export function proPlayersSql(recipe: IdentityRecipeName): string {
  const core = `(SELECT athlete_id::BIGINT AS athlete_id,
      max(left(CAST(date_of_birth AS VARCHAR), 10)) AS dob,
      (list(college_id::BIGINT ORDER BY season DESC, college_id DESC) FILTER (WHERE college_id IS NOT NULL))[1] AS college_id
    FROM src_espn_player_core GROUP BY 1) c`
  if (recipe === 'nba') {
    return `SELECT p.player_id::BIGINT AS pro_id, p.name, p.espn_athlete_id::BIGINT AS espn,
        p.first_season::INTEGER AS first_season, c.dob, c.college_id AS espn_college_id, b.school
      FROM player p LEFT JOIN ${core} ON c.athlete_id = p.espn_athlete_id
      LEFT JOIN (SELECT player_id, (list(college ORDER BY season DESC, college)
          FILTER (WHERE nullif(trim(college), '') IS NOT NULL AND college <> 'None'))[1] AS school
        FROM src_dash_player_bio GROUP BY 1) b ON b.player_id = p.player_id`
  }
  return `SELECT p.player_id::BIGINT AS pro_id, p.name, p.espn_athlete_id::BIGINT AS espn,
      p.first_season::INTEGER AS first_season,
      coalesce(c.dob, strftime(try_strptime(p.birth_date, '%b %d, %Y'), '%Y-%m-%d')) AS dob,
      c.college_id AS espn_college_id, nullif(trim(p.school), '') AS school
    FROM player p LEFT JOIN ${core} ON c.athlete_id = p.espn_athlete_id`
}

/**
 * A college league's players, from its own tables: ids are ESPN's athlete ids where ESPN has the player
 * (D40), and their teams are ESPN team ids, with the names ESPN gives them.
 */
export const COLLEGE_PLAYERS_SQL = `SELECT c.player_id::BIGINT AS col_id, c.name, c.espn_athlete_id::BIGINT AS espn,
    c.first_season::INTEGER AS first_season, c.last_season::INTEGER AS last_season,
    left(CAST(c.birth_date AS VARCHAR), 10) AS dob,
    coalesce(list_sort(list_distinct(list(s.team_id::BIGINT) FILTER (WHERE s.team_id IS NOT NULL))), []) AS teams,
    coalesce(list_sort(list_distinct(list(t.name) FILTER (WHERE t.name IS NOT NULL))), []) AS team_names
  FROM player c
  LEFT JOIN player_season s ON s.player_id = c.player_id AND s.team_id IS NOT NULL
  LEFT JOIN team t ON t.team_id = s.team_id AND t.season = s.season
  GROUP BY c.player_id, c.name, c.espn_athlete_id, c.first_season, c.last_season, c.birth_date`

/**
 * The players of ESPN's season stats file (one row a stat), as a side of the pair where the league's
 * own file is not there: the name of the latest season, the seasons and the teams.
 */
export function espnPlayersSql(table: string): string {
  return `SELECT athlete_id::BIGINT AS espn,
      (list(athlete_display_name ORDER BY season DESC, athlete_display_name))[1] AS name,
      min(season)::INTEGER AS first_season, max(season)::INTEGER AS last_season,
      list_sort(list_distinct(list(team_id::BIGINT) FILTER (WHERE team_id IS NOT NULL))) AS teams,
      list_sort(list_distinct(list(team_display_name) FILTER (WHERE team_display_name IS NOT NULL))) AS team_names
    FROM ${sqlIdent(table)}
    -- one row a player-season: the file has a row a stat, 43 a player-season (2.4 million a college window)
    WHERE athlete_id IS NOT NULL AND category = 'averages' AND stat_name = 'gamesPlayed'
    GROUP BY athlete_id`
}

/** What the links worker holds of a pair, by table; a missing table reads as no rows. */
export interface PairTables {
  /** The professional league's players and drafts from its own file, as last handed over. */
  proSide: string
  proDraft: string
  /** The college league's players from its own file. */
  collegeSide: string
  /** The paired files, as loaded: ESPN's season stats of each side, the professional draft. */
  proEspn: string | null
  collegeEspn: string | null
  pairedDraft: string | null
}

const EMPTY_ESPN = `SELECT NULL::BIGINT AS espn, NULL::VARCHAR AS name, NULL::INTEGER AS first_season,
  NULL::INTEGER AS last_season, NULL::BIGINT[] AS teams, NULL::VARCHAR[] AS team_names WHERE false`
const EMPTY_DRAFT = `SELECT NULL::BIGINT AS pro_id, NULL::VARCHAR AS name, NULL::INTEGER AS label,
  NULL::INTEGER AS round, NULL::INTEGER AS round_pick, NULL::INTEGER AS overall_pick, NULL::VARCHAR AS team,
  NULL::VARCHAR AS organization, NULL::VARCHAR AS organization_type WHERE false`

/**
 * Every draft line of a pair: the professional league's own table where its side was handed over, and
 * the paired draft file (a college league's download) for the drafts that side lacks.
 */
export function draftLinesSql(t: PairTables): string {
  const paired = t.pairedDraft ? draftSql(t.pairedDraft) : EMPTY_DRAFT
  return `SELECT * FROM ${sqlIdent(t.proDraft)}
    UNION ALL SELECT * FROM (${paired}) d
      WHERE NOT EXISTS (SELECT 1 FROM ${sqlIdent(t.proDraft)} o WHERE o.pro_id = d.pro_id AND o.label = d.label)`
}

/**
 * D46's matcher for one pair, as one statement giving `player_link`'s rows. In order: the same ESPN
 * athlete id; else the same name and birth date, one candidate; else, for a draftee with no
 * professional ESPN id, the name with the draft class (the college's last season the class or the one
 * before) and the school where the draft names one, one candidate. A college career that starts after
 * the professional one never links; a college player is linked once, and a candidate two professional
 * players claim by the same rule links neither. Each link carries its method. The draft line of a link
 * is the professional player's own; where only ESPN's lines name the professional player (their league
 * is not downloaded), it is the one draft line of their name labelled with their first season, if there
 * is exactly one and no one else's.
 */
export function matchSql(pair: LeaguePair, t: PairTables): string {
  const ahead = pair.proLabelAhead
  const proEspn = t.proEspn ? espnPlayersSql(t.proEspn) : EMPTY_ESPN
  const collegeEspn = t.collegeEspn ? espnPlayersSql(t.collegeEspn) : EMPTY_ESPN
  return `WITH
  draft AS (${draftLinesSql(t)}),
  -- each professional player's latest draft
  last_draft AS (
    SELECT pro_id, max(label) AS label FROM draft GROUP BY pro_id
  ),
  side_pro AS (
    SELECT s.pro_id, s.espn, s.name, s.dob, s.espn_college_id, s.first_season,
      d.label AS draft_label, d.organization
    FROM ${sqlIdent(t.proSide)} s
    LEFT JOIN last_draft l ON l.pro_id = s.pro_id
    LEFT JOIN draft d ON d.pro_id = l.pro_id AND d.label = l.label
  ),
  -- draftees the professional file does not hold: those who have not played, or every one where that
  -- file is not downloaded
  draft_raw AS (
    SELECT d.pro_id, d.name, link_name(d.name) AS n, d.label, d.organization
    FROM draft d JOIN last_draft l ON l.pro_id = d.pro_id AND l.label = d.label
    WHERE d.pro_id NOT IN (SELECT pro_id FROM ${sqlIdent(t.proSide)} WHERE pro_id IS NOT NULL)
  ),
  -- professional players only ESPN's lines name, where that league's file is not downloaded
  espn_raw AS (
    SELECT e.espn, e.name, link_name(e.name) AS n, e.first_season
    FROM (${proEspn}) e
    WHERE e.espn NOT IN (SELECT espn FROM ${sqlIdent(t.proSide)} WHERE espn IS NOT NULL)
  ),
  -- such a player's draft line: the one line of their name labelled with their first season, which
  -- no one else's matches; the two are then one player
  tie AS (
    SELECT e.espn, d.pro_id FROM espn_raw e JOIN draft_raw d ON d.n = e.n AND d.label = e.first_season
  ),
  tie_once AS (
    SELECT * FROM tie WHERE espn IN (SELECT espn FROM tie GROUP BY espn HAVING count(*) = 1)
      AND pro_id IN (SELECT pro_id FROM tie GROUP BY pro_id HAVING count(*) = 1)
  ),
  tied AS (
    SELECT d.pro_id, e.espn, e.name, NULL::VARCHAR AS dob, NULL::BIGINT AS espn_college_id,
      e.first_season, d.label AS draft_label, d.organization, false AS may_have_played
    FROM tie_once t JOIN espn_raw e ON e.espn = t.espn JOIN draft_raw d ON d.pro_id = t.pro_id
  ),
  -- a draft line left untied whose name ESPN's professional lines also carry may be a player who has
  -- played: it is never matched by name, which would link a namesake
  draft_only AS (
    SELECT d.pro_id, NULL::BIGINT AS espn, d.name, NULL::VARCHAR AS dob, NULL::BIGINT AS espn_college_id,
      NULL::INTEGER AS first_season, d.label AS draft_label, d.organization,
      -- a nameless ESPN row (there is one) must not make every comparison unknown
      coalesce(d.n IN (SELECT n FROM espn_raw WHERE n IS NOT NULL
        AND espn NOT IN (SELECT espn FROM tie_once)), false) AS may_have_played
    FROM draft_raw d WHERE d.pro_id NOT IN (SELECT pro_id FROM tie_once)
  ),
  espn_pro AS (
    SELECT NULL::BIGINT AS pro_id, e.espn, e.name, NULL::VARCHAR AS dob, NULL::BIGINT AS espn_college_id,
      e.first_season, NULL::INTEGER AS draft_label, NULL::VARCHAR AS organization, false AS may_have_played
    FROM espn_raw e WHERE e.espn NOT IN (SELECT espn FROM tie_once)
  ),
  pro AS (
    SELECT p.*, link_name(p.name) AS n,
      p.draft_label - ${ahead} AS class,
      -- the last college season before the professional career: the draft's class, else the season
      -- before the first professional one
      coalesce(p.draft_label, p.first_season) - ${ahead} AS start_c,
      coalesce((SELECT a.espn_prefix FROM ${aliasesSql()} WHERE a.org = p.organization), p.organization) || ' ' AS org_prefix,
      row_number() OVER (ORDER BY p.pro_id NULLS LAST, p.espn NULLS LAST, p.name) AS pk
    FROM (
      SELECT *, false AS may_have_played FROM side_pro
      UNION ALL SELECT * FROM tied UNION ALL SELECT * FROM draft_only UNION ALL SELECT * FROM espn_pro
    ) p
  ),
  col AS (
    SELECT c.col_id, c.espn, c.name, link_name(c.name) AS n, c.dob, c.first_season, c.last_season,
      c.teams, c.team_names
    FROM ${sqlIdent(t.collegeSide)} c
    UNION ALL
    SELECT e.espn, e.espn, e.name, link_name(e.name), NULL, e.first_season, e.last_season, e.teams, e.team_names
    FROM (${collegeEspn}) e
    WHERE e.espn NOT IN (SELECT espn FROM ${sqlIdent(t.collegeSide)} WHERE espn IS NOT NULL)
  ),
  by_id AS (
    SELECT p.pk, c.col_id, 'id' AS method FROM pro p JOIN col c ON c.espn = p.espn
    WHERE p.espn IS NOT NULL AND (p.start_c IS NULL OR c.first_season <= p.start_c)
  ),
  id_once AS (
    SELECT * FROM by_id WHERE pk IN (SELECT pk FROM by_id GROUP BY pk HAVING count(*) = 1)
      AND col_id IN (SELECT col_id FROM by_id GROUP BY col_id HAVING count(*) = 1)
  ),
  by_birth AS (
    SELECT p.pk, c.col_id, 'name+birth' AS method FROM pro p JOIN col c ON c.n = p.n AND c.dob = p.dob
    WHERE p.pk NOT IN (SELECT pk FROM id_once) AND c.col_id NOT IN (SELECT col_id FROM id_once)
      AND (p.start_c IS NULL OR c.first_season <= p.start_c)
  ),
  birth_once AS (
    SELECT * FROM by_birth WHERE pk IN (SELECT pk FROM by_birth GROUP BY pk HAVING count(*) = 1)
      AND col_id IN (SELECT col_id FROM by_birth GROUP BY col_id HAVING count(*) = 1)
  ),
  taken AS (SELECT * FROM id_once UNION ALL SELECT * FROM birth_once),
  by_college AS (
    SELECT p.pk, c.col_id, 'name+college' AS method FROM pro p JOIN col c ON c.n = p.n
    WHERE p.espn IS NULL AND p.class IS NOT NULL AND NOT p.may_have_played
      AND p.pk NOT IN (SELECT pk FROM taken) AND c.col_id NOT IN (SELECT col_id FROM taken)
      AND c.last_season BETWEEN p.class - 1 AND p.class
      AND (p.organization IS NULL OR list_contains(c.teams, p.espn_college_id)
        OR len(list_filter(c.team_names, x -> starts_with(x, p.org_prefix))) > 0)
  ),
  college_once AS (
    SELECT * FROM by_college WHERE pk IN (SELECT pk FROM by_college GROUP BY pk HAVING count(*) = 1)
      AND col_id IN (SELECT col_id FROM by_college GROUP BY col_id HAVING count(*) = 1)
  ),
  links AS (SELECT * FROM taken UNION ALL SELECT * FROM college_once)
SELECT '${pair.college}' AS college, '${pair.pro}' AS pro,
  c.col_id AS college_id, c.espn AS college_espn, c.name AS college_name,
  p.pro_id, p.espn AS pro_espn, p.name AS pro_name, l.method,
  p.draft_label
FROM links l JOIN pro p ON p.pk = l.pk JOIN col c ON c.col_id = l.col_id
ORDER BY c.col_id, p.pro_id NULLS LAST, p.espn NULLS LAST`
}
