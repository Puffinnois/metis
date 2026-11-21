-- setup: name normalizer and the draft organization's aliases to ESPN's college names
CREATE OR REPLACE MACRO nm(s) AS
  trim(regexp_replace(regexp_replace(regexp_replace(lower(strip_accents(s)), '[^a-z ]', '', 'g'), '\s+', ' ', 'g'),
    ' (jr|sr|ii|iii|iv|v)$', ''));
CREATE OR REPLACE TEMP TABLE org_alias(org, espn_prefix) AS VALUES
  ('Connecticut', 'UConn'), ('California-Los Angeles', 'UCLA'), ('Louisiana State', 'LSU'), ('Southern California', 'USC'),
  ('Brigham Young', 'BYU'), ('Miami (FL)', 'Miami Hurricanes'), ('Nevada-Reno', 'Nevada'), ('Southern Methodist', 'SMU'),
  ('Central Florida', 'UCF'), ('Virginia Commonwealth', 'VCU'), ('St. John''s (NY)', 'St. John''s'),
  ('California-Santa Barbara', 'UC Santa Barbara'), ('Wisconsin-Milwaukee', 'Milwaukee'), ('Saint Joseph''s', 'Saint Joseph''s'),
  ('Mississippi', 'Ole Miss'), ('Texas Christian', 'TCU'), ('Alabama-Birmingham', 'UAB'), ('Nevada-Las Vegas', 'UNLV'),
  ('North Carolina-Wilmington', 'UNC Wilmington'), ('Massachusetts', 'UMass'), ('Pennsylvania', 'Penn Quakers'),
  ('Texas-El Paso', 'UTEP'), ('Texas-San Antonio', 'UTSA'), ('Florida International', 'FIU'), ('Long Beach State', 'Long Beach State'),
  ('Loyola (IL)', 'Loyola Chicago'), ('Southern Mississippi', 'Southern Miss'), ('Detroit Mercy', 'Detroit Mercy'),
  ('Illinois-Chicago', 'UIC'), ('College of Charleston', 'Charleston'), ('North Carolina State', 'NC State'), ('Pittsburgh', 'Pitt');
-- the professional side: drafted classes 2022 to 2026 (draft table labelled class + 1), and players first on an NBA
-- floor in 2022-23 to 2026-27 who were never drafted
CREATE OR REPLACE TEMP TABLE pro AS
WITH drafted AS (
  SELECT person_id AS player_id, player_name AS name, season - 1 AS class, overall_pick, organization,
    organization_type FROM nba.src_nba_draft WHERE season BETWEEN 2023 AND 2027
),
undrafted AS (
  SELECT p.player_id, p.name, p.first_season - 1 AS class, NULL::BIGINT AS overall_pick,
    (SELECT any_value(college) FROM nba.src_dash_player_bio b WHERE b.player_id = p.player_id) AS organization,
    'Undrafted' AS organization_type
  FROM nba.player p WHERE p.first_season BETWEEN 2023 AND 2027
    AND p.player_id NOT IN (SELECT person_id FROM nba.src_nba_draft WHERE person_id IS NOT NULL)
)
SELECT u.*, coalesce((SELECT espn_prefix FROM org_alias a WHERE a.org = u.organization), u.organization) || ' ' AS org_prefix,
  p.espn_athlete_id AS espn, p.first_season AS pro_first,
  (SELECT left(any_value(date_of_birth), 10) FROM nba.src_espn_player_core c WHERE c.athlete_id = p.espn_athlete_id) AS dob,
  (SELECT any_value(college_id) FROM nba.src_espn_player_core c WHERE c.athlete_id = p.espn_athlete_id) AS espn_college_id
FROM (SELECT * FROM drafted UNION ALL SELECT * FROM undrafted) u LEFT JOIN nba.player p USING (player_id);
-- the college side: every player with a line, their teams and seasons
CREATE OR REPLACE TEMP TABLE col AS
SELECT c.player_id, c.name, nm(c.name) AS n, c.espn_athlete_id AS espn, c.first_season, c.last_season,
  left(c.birth_date, 10) AS dob, list(DISTINCT s.team_id) AS teams,
  list(DISTINCT t.name) AS team_names
FROM ncaam.player c
LEFT JOIN ncaam.player_season s ON s.player_id = c.player_id
LEFT JOIN ncaam.team t ON t.team_id = s.team_id AND t.season = s.season
GROUP BY ALL;
SELECT (SELECT count(*) FROM pro) AS pro_rows, (SELECT count(*) FROM col) AS college_players
;
-- candidates per professional player, by each matcher
CREATE OR REPLACE TEMP TABLE cand AS
SELECT p.player_id, p.class, p.organization_type, p.organization, p.name, p.espn, p.overall_pick, p.pro_first,
  c.player_id AS col_id, c.name AS col_name, c.espn AS col_espn, c.first_season, c.last_season, c.team_names,
  (c.espn = p.espn) AS by_id,
  (nm(p.name) = c.n) AS same_name,
  (nm(p.name) = c.n AND p.dob = c.dob) AS by_name_dob,
  (nm(p.name) = c.n AND c.last_season BETWEEN p.class - 1 AND p.class
    AND (list_contains(c.teams, p.espn_college_id)
      OR len(list_filter(c.team_names, x -> starts_with(x, p.org_prefix))) > 0)) AS by_name_college_class
FROM pro p JOIN col c ON c.espn = p.espn OR c.n = nm(p.name);
-- per pro player: how many candidates each matcher finds
CREATE OR REPLACE TEMP TABLE per AS
SELECT p.player_id, p.name, p.class, p.organization_type, p.organization, p.overall_pick, p.espn, p.pro_first,
  count(*) FILTER (WHERE by_id) AS n_id,
  count(*) FILTER (WHERE by_name_dob) AS n_name_dob,
  count(*) FILTER (WHERE by_name_college_class) AS n_name_college,
  count(*) FILTER (WHERE same_name) AS n_name,
  any_value(col_id) FILTER (WHERE by_id) AS id_col,
  any_value(col_id) FILTER (WHERE by_name_dob) AS dob_col,
  any_value(col_id) FILTER (WHERE by_name_college_class) AS college_col
FROM pro p LEFT JOIN cand c USING (player_id) GROUP BY ALL;
-- rates per class and kind: found by each matcher, ambiguous (two or more), and agreement with the id
SELECT class, organization_type AS kind, count(*) AS players, count(espn) AS with_pro_espn,
  count(*) FILTER (WHERE n_id = 1) AS id_1, count(*) FILTER (WHERE n_id > 1) AS id_amb,
  count(*) FILTER (WHERE n_name_dob = 1) AS dob_1, count(*) FILTER (WHERE n_name_dob > 1) AS dob_amb,
  count(*) FILTER (WHERE n_name_college = 1) AS col_1, count(*) FILTER (WHERE n_name_college > 1) AS col_amb,
  count(*) FILTER (WHERE n_name = 1) AS name_1, count(*) FILTER (WHERE n_name > 1) AS name_amb,
  count(*) FILTER (WHERE n_name_dob = 1 AND n_id = 1 AND dob_col <> id_col) AS dob_disagrees,
  count(*) FILTER (WHERE n_name_college = 1 AND n_id = 1 AND college_col <> id_col) AS col_disagrees,
  count(*) FILTER (WHERE n_id = 1 OR n_name_dob = 1 OR n_name_college = 1) AS any_1
FROM per GROUP BY ALL ORDER BY 1, 2
