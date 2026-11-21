-- setup (WNBA with NCAA Women): the same normalizer; the WNBA draft is labelled by its own year, which is the
-- spring the college season ends, so a draft class and a first WNBA season share a label with the last college season
CREATE OR REPLACE MACRO nm(s) AS
  trim(regexp_replace(regexp_replace(regexp_replace(lower(strip_accents(s)), '[^a-z ]', '', 'g'), '\s+', ' ', 'g'),
    ' (jr|sr|ii|iii|iv|v)$', ''));
CREATE OR REPLACE TEMP TABLE org_alias(org, espn_prefix) AS VALUES
  ('Connecticut', 'UConn'), ('California-Los Angeles', 'UCLA'), ('UCLA', 'UCLA'), ('Louisiana State', 'LSU'), ('LSU', 'LSU'),
  ('Southern California', 'USC'), ('USC', 'USC'), ('Brigham Young', 'BYU'), ('Miami (FL)', 'Miami Hurricanes'),
  ('Mississippi', 'Ole Miss'), ('Texas Christian', 'TCU'), ('North Carolina State', 'NC State'), ('NC State', 'NC State'),
  ('Florida Gulf Coast', 'Florida Gulf Coast'), ('Massachusetts', 'UMass'), ('Pittsburgh', 'Pitt'),
  ('Central Florida', 'UCF'), ('Nevada-Las Vegas', 'UNLV'), ('Southern Methodist', 'SMU'), ('Virginia Commonwealth', 'VCU');
CREATE OR REPLACE TEMP TABLE pro AS
WITH drafted AS (
  SELECT person_id AS player_id, any_value(player_name) AS name, season AS class, min(overall_pick) AS overall_pick,
    nullif(any_value(organization), '') AS organization, coalesce(nullif(any_value(organization_type), ''), 'Drafted, type blank') AS organization_type
  FROM wnba.src_wnba_draft WHERE season BETWEEN 2022 AND 2026 GROUP BY person_id, season
),
undrafted AS (
  SELECT p.player_id, p.name, p.first_season AS class, NULL::BIGINT AS overall_pick, p.school AS organization,
    'Undrafted' AS organization_type
  FROM wnba.player p WHERE p.first_season BETWEEN 2022 AND 2026
    AND p.player_id NOT IN (SELECT person_id FROM wnba.src_wnba_draft WHERE person_id IS NOT NULL)
)
SELECT u.*, coalesce(u.organization, p.school) AS school,
  coalesce((SELECT espn_prefix FROM org_alias a WHERE a.org = coalesce(u.organization, p.school)), coalesce(u.organization, p.school)) || ' ' AS org_prefix,
  p.espn_athlete_id AS espn, p.first_season AS pro_first,
  coalesce((SELECT left(any_value(date_of_birth), 10) FROM wnba.src_espn_player_core c WHERE c.athlete_id = p.espn_athlete_id),
    strftime(try_strptime(p.birth_date, '%b %d, %Y'), '%Y-%m-%d')) AS dob,
  (SELECT any_value(college_id) FROM wnba.src_espn_player_core c WHERE c.athlete_id = p.espn_athlete_id) AS espn_college_id
FROM (SELECT * FROM drafted UNION ALL SELECT * FROM undrafted) u LEFT JOIN wnba.player p USING (player_id);
CREATE OR REPLACE TEMP TABLE col AS
SELECT c.player_id, c.name, nm(c.name) AS n, c.espn_athlete_id AS espn, c.first_season, c.last_season,
  left(c.birth_date, 10) AS dob, list(DISTINCT s.team_id) AS teams, list(DISTINCT t.name) AS team_names
FROM ncaaw.player c
LEFT JOIN ncaaw.player_season s ON s.player_id = c.player_id
LEFT JOIN ncaaw.team t ON t.team_id = s.team_id AND t.season = s.season
GROUP BY ALL;
SELECT (SELECT count(*) FROM pro) AS pro_rows, (SELECT count(*) FROM col) AS college_players
;
-- candidates per professional player, by each matcher
CREATE OR REPLACE TEMP TABLE cand AS
SELECT p.player_id, p.class, p.organization_type, p.school, p.name, p.espn, p.overall_pick, p.pro_first,
  c.player_id AS col_id, c.name AS col_name, c.espn AS col_espn, c.first_season, c.last_season, c.team_names,
  (c.espn = p.espn) AS by_id,
  (nm(p.name) = c.n) AS same_name,
  (nm(p.name) = c.n AND p.dob = c.dob) AS by_name_dob,
  (nm(p.name) = c.n AND c.last_season BETWEEN p.class - 1 AND p.class
    AND (list_contains(c.teams, p.espn_college_id)
      OR len(list_filter(c.team_names, x -> starts_with(x, p.org_prefix))) > 0)) AS by_name_college_class,
  (nm(p.name) = c.n AND c.last_season BETWEEN p.class - 1 AND p.class) AS by_name_class
FROM pro p JOIN col c ON c.espn = p.espn OR c.n = nm(p.name);
CREATE OR REPLACE TEMP TABLE per AS
SELECT p.player_id, p.name, p.class, p.organization_type, p.school, p.overall_pick, p.espn, p.pro_first,
  count(*) FILTER (WHERE by_id) AS n_id,
  count(*) FILTER (WHERE by_name_dob) AS n_name_dob,
  count(*) FILTER (WHERE by_name_college_class) AS n_name_college,
  count(*) FILTER (WHERE by_name_class) AS n_name_class,
  count(*) FILTER (WHERE same_name) AS n_name,
  any_value(col_id) FILTER (WHERE by_id) AS id_col,
  any_value(col_id) FILTER (WHERE by_name_dob) AS dob_col,
  any_value(col_id) FILTER (WHERE by_name_college_class) AS college_col,
  any_value(col_id) FILTER (WHERE by_name_class) AS class_col
FROM pro p LEFT JOIN cand c USING (player_id) GROUP BY ALL;
SELECT class, organization_type AS kind, count(*) AS players, count(pro_first) AS played, count(espn) AS with_pro_espn,
  count(*) FILTER (WHERE n_id = 1) AS id_1, count(*) FILTER (WHERE n_id > 1) AS id_amb,
  count(*) FILTER (WHERE n_name_dob = 1) AS dob_1, count(*) FILTER (WHERE n_name_dob > 1) AS dob_amb,
  count(*) FILTER (WHERE n_name_college = 1) AS col_1, count(*) FILTER (WHERE n_name_college > 1) AS col_amb,
  count(*) FILTER (WHERE n_name_class = 1) AS cls_1, count(*) FILTER (WHERE n_name_class > 1) AS cls_amb,
  count(*) FILTER (WHERE n_name = 1) AS name_1, count(*) FILTER (WHERE n_name > 1) AS name_amb,
  count(*) FILTER (WHERE n_name_dob = 1 AND n_id = 1 AND dob_col <> id_col) AS dob_dis,
  count(*) FILTER (WHERE n_name_college = 1 AND n_id = 1 AND college_col <> id_col) AS col_dis,
  count(*) FILTER (WHERE n_name_class = 1 AND n_id = 1 AND class_col <> id_col) AS cls_dis,
  count(*) FILTER (WHERE n_id = 1 OR n_name_dob = 1 OR n_name_college = 1) AS any_1
FROM per GROUP BY ALL ORDER BY 1, 2
;
-- every WNBA player of these classes the id did not link
SELECT per.class, per.organization_type AS kind, per.name, per.overall_pick AS pick, per.school, per.espn, per.pro_first,
  n_name_dob AS dob, n_name_college AS col, n_name_class AS cls, n_name AS name_only,
  (SELECT string_agg(c.col_name || ' [' || coalesce(c.col_espn::VARCHAR, 'no espn') || ' ' || c.first_season || '-' || c.last_season || ' ' || array_to_string(c.team_names, '/') || ']', '; ')
     FROM cand c WHERE c.player_id = per.player_id AND c.same_name) AS name_candidates,
  (SELECT any_value(birth_country) FROM wnba.src_espn_player_core e WHERE e.athlete_id = per.espn) AS country
FROM per WHERE n_id = 0 AND per.organization_type <> 'Other Team/Club'
ORDER BY class, kind, name
