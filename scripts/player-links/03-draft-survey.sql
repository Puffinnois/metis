-- NBA draft history (src_nba_draft): picks per class and organization type, 2020 on
SELECT season, organization_type, count(*) AS picks, count(DISTINCT person_id) AS people
FROM nba.src_nba_draft WHERE season >= 2020 GROUP BY ALL ORDER BY season, organization_type
;
-- WNBA draft history (src_wnba_draft): picks per class and organization type, 2020 on
SELECT season, organization_type, count(*) AS picks, count(DISTINCT person_id) AS people
FROM wnba.src_wnba_draft WHERE season >= 2020 GROUP BY ALL ORDER BY season, organization_type
;
-- ESPN draft tables: seasons, and whether college or athlete ids are ever filled
SELECT 'nba' AS lg, season, count(*) AS picks, count(college_name) AS college, min(athlete_id) AS min_id, max(athlete_id) AS max_id
FROM nba.src_espn_draft WHERE season >= 2020 GROUP BY ALL
UNION ALL
SELECT 'wnba', season, count(*), count(college_name), min(athlete_id), max(athlete_id)
FROM wnba.src_espn_draft WHERE season >= 2020 GROUP BY ALL ORDER BY 1, 2
;
-- professional player table: how many rows have an ESPN id, by first season
SELECT 'nba' AS lg, first_season, count(*) AS players, count(espn_athlete_id) AS with_espn,
  count(*) FILTER (WHERE method IS NOT NULL) AS m FROM nba.player WHERE first_season >= 2020 GROUP BY ALL
UNION ALL
SELECT 'wnba', first_season, count(*), count(espn_athlete_id), count(*) FILTER (WHERE method IS NOT NULL)
FROM wnba.player WHERE first_season >= 2020 GROUP BY ALL ORDER BY 1, 2
;
-- methods in the professional player tables
SELECT 'nba' AS lg, method, count(*) FROM nba.player GROUP BY ALL
UNION ALL SELECT 'wnba', method, count(*) FROM wnba.player GROUP BY ALL ORDER BY 1, 3 DESC
;
-- sample of src_nba_draft 2025
SELECT * FROM nba.src_nba_draft WHERE season = 2025 ORDER BY overall_pick LIMIT 8
;
-- sample of src_wnba_draft 2025
SELECT * FROM wnba.src_wnba_draft WHERE season = 2025 ORDER BY overall_pick LIMIT 8
;
-- professional seasons present (box score lines), per league
SELECT 'nba' AS lg, max(last_season) AS last FROM nba.player UNION ALL SELECT 'wnba', max(last_season) FROM wnba.player
