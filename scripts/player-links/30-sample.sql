;
-- run after 10-match-nba.sql or 20-match-wnba.sql in the same run: a repeatable sample of 50 links by the id, with
-- what a reader checks them by (names, birth dates, the professional side's school against the college teams)
SELECT setseed(0.1304)
;
-- 50 links by the id, for the hand check
SELECT c.class, c.name AS pro_name, c.col_name, p.dob AS pro_dob, col.dob AS col_dob, p.organization AS pro_school,
  c.first_season || '-' || c.last_season AS col_seasons, array_to_string(c.team_names, ' / ') AS col_teams
FROM cand c JOIN pro p USING (player_id) JOIN col ON col.player_id = c.col_id
WHERE c.by_id ORDER BY random() LIMIT 50
;
-- every link the id did not make but another matcher did (unique candidate), for the hand check
SELECT per.class, per.organization_type AS kind, per.name, per.espn AS pro_espn, c.col_espn, c.col_name, p.dob AS pro_dob,
  col.dob AS col_dob, p.organization AS pro_school, c.first_season || '-' || c.last_season AS col_seasons,
  array_to_string(c.team_names, ' / ') AS col_teams, c.by_name_dob AS dob, c.by_name_college_class AS college
FROM per JOIN cand c USING (player_id) JOIN pro p USING (player_id) JOIN col ON col.player_id = c.col_id
WHERE per.n_id = 0 AND ((per.n_name_dob = 1 AND c.by_name_dob) OR (per.n_name_dob = 0 AND per.n_name_college = 1 AND c.by_name_college_class))
ORDER BY per.class, per.name
;
-- name alone, where the id links: how often is the unique same-name college player the id's player?
SELECT count(*) FILTER (WHERE n_id = 1 AND n_name = 1) AS name_unique_and_id,
  count(*) FILTER (WHERE n_id = 1 AND n_name = 1 AND (SELECT any_value(col_id) FROM cand c WHERE c.player_id = per.player_id AND c.same_name) = id_col) AS agree,
  count(*) FILTER (WHERE n_id = 1 AND n_name = 0) AS id_but_name_differs,
  count(*) FILTER (WHERE n_id = 1 AND n_name > 1) AS id_but_name_ambiguous
FROM per
