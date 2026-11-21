;
-- run after 10-match-nba.sql, in the same run, as the runner takes several files:
-- node scripts/player-links-sql.mjs scripts/player-links/10-match-nba.sql scripts/player-links/11-misses-nba.sql
-- every professional player the id did not link, with what the other matchers and the bios say
SELECT per.class, per.organization_type AS kind, per.name, per.overall_pick AS pick, per.organization, per.espn, per.pro_first,
  n_name_dob AS dob, n_name_college AS col, n_name AS name_only,
  (SELECT string_agg(c.col_name || ' [' || c.col_espn || ' ' || c.first_season || '-' || c.last_season || ']', '; ')
     FROM cand c WHERE c.player_id = per.player_id AND c.same_name) AS name_candidates,
  (SELECT any_value(college_id) FROM nba.src_espn_player_core e WHERE e.athlete_id = per.espn) AS espn_college,
  (SELECT any_value(birth_country) FROM nba.src_espn_player_core e WHERE e.athlete_id = per.espn) AS country
FROM per WHERE n_id = 0 AND per.organization_type <> 'Other Team/Club'
ORDER BY class, kind, name
;
-- Other Team/Club picks that some matcher links (players who went abroad or to the G League after college)
SELECT per.class, per.name, per.organization, n_id, n_name_dob, n_name_college, n_name,
  (SELECT string_agg(c.col_name || ' [' || c.col_espn || ' ' || c.first_season || '-' || c.last_season || ']', '; ')
     FROM cand c WHERE c.player_id = per.player_id AND c.same_name) AS name_candidates
FROM per WHERE organization_type = 'Other Team/Club' AND (n_id + n_name_dob + n_name_college + n_name) > 0
ORDER BY class
;
-- name-only ambiguity among the drafted college picks: who shares the name
SELECT per.class, per.name, per.organization, n_name,
  (SELECT string_agg(c.col_name || ' [' || c.col_espn || ' ' || c.first_season || '-' || c.last_season || ' ' || array_to_string(c.team_names, '/') || ']', '; ')
     FROM cand c WHERE c.player_id = per.player_id AND c.same_name) AS name_candidates
FROM per WHERE n_name > 1 ORDER BY class
