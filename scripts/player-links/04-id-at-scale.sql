-- the season label of the NBA draft table: Banchero (drafted June 2022) and Flagg (June 2025)
SELECT season, overall_pick, player_name, organization FROM nba.src_nba_draft
WHERE player_name IN ('Paolo Banchero', 'Cooper Flagg', 'Victor Wembanyama') ORDER BY season
;
-- the season label of the WNBA draft table: Boston (April 2023), Clark (April 2024)
SELECT season, overall_pick, player_name FROM wnba.src_wnba_draft
WHERE player_name IN ('Aliyah Boston', 'Caitlin Clark', 'Rhyne Howard') ORDER BY season
;
-- NBA players whose ESPN id is a college player's id: names and birth dates agree?
WITH pro AS (
  SELECT p.player_id, p.name, p.espn_athlete_id AS espn, p.first_season,
    (SELECT any_value(date_of_birth) FROM nba.src_espn_player_core c WHERE c.athlete_id = p.espn_athlete_id) AS dob
  FROM nba.player p WHERE p.espn_athlete_id IS NOT NULL
)
SELECT count(*) AS pro_with_espn, count(c.player_id) AS in_ncaam,
  count(*) FILTER (WHERE c.player_id IS NOT NULL AND lower(strip_accents(c.name)) = lower(strip_accents(pro.name))) AS same_name,
  count(*) FILTER (WHERE c.player_id IS NOT NULL AND pro.dob IS NOT NULL AND c.birth_date IS NOT NULL) AS both_dob,
  count(*) FILTER (WHERE c.player_id IS NOT NULL AND left(pro.dob, 10) = left(c.birth_date, 10)) AS same_dob
FROM pro LEFT JOIN ncaam.player c ON c.espn_athlete_id = pro.espn
;
-- the same for the WNBA
WITH pro AS (
  SELECT p.player_id, p.name, p.espn_athlete_id AS espn, p.first_season,
    (SELECT any_value(date_of_birth) FROM wnba.src_espn_player_core c WHERE c.athlete_id = p.espn_athlete_id) AS dob
  FROM wnba.player p WHERE p.espn_athlete_id IS NOT NULL
)
SELECT count(*) AS pro_with_espn, count(c.player_id) AS in_ncaaw,
  count(*) FILTER (WHERE c.player_id IS NOT NULL AND lower(strip_accents(c.name)) = lower(strip_accents(pro.name))) AS same_name,
  count(*) FILTER (WHERE c.player_id IS NOT NULL AND pro.dob IS NOT NULL AND c.birth_date IS NOT NULL) AS both_dob,
  count(*) FILTER (WHERE c.player_id IS NOT NULL AND left(pro.dob, 10) = left(c.birth_date, 10)) AS same_dob
FROM pro LEFT JOIN ncaaw.player c ON c.espn_athlete_id = pro.espn
;
-- id matches whose names differ (NBA)
SELECT p.name AS nba_name, c.name AS ncaa_name, p.espn_athlete_id, c.first_season, c.last_season
FROM nba.player p JOIN ncaam.player c ON c.espn_athlete_id = p.espn_athlete_id
WHERE lower(strip_accents(c.name)) <> lower(strip_accents(p.name))
;
-- id matches whose names differ (WNBA)
SELECT p.name AS wnba_name, c.name AS ncaa_name, p.espn_athlete_id, c.first_season, c.last_season
FROM wnba.player p JOIN ncaaw.player c ON c.espn_athlete_id = p.espn_athlete_id
WHERE lower(strip_accents(c.name)) <> lower(strip_accents(p.name))
;
-- does an ESPN id from a men's college file ever land on a WNBA player, or a women's on an NBA one?
SELECT (SELECT count(*) FROM nba.player p JOIN ncaaw.player c USING (espn_athlete_id)) AS nba_x_ncaaw,
  (SELECT count(*) FROM wnba.player p JOIN ncaam.player c USING (espn_athlete_id)) AS wnba_x_ncaam,
  (SELECT count(*) FROM ncaam.player p JOIN ncaaw.player c USING (espn_athlete_id)) AS ncaam_x_ncaaw
;
-- professional ESPN bio: college_id and draft fields filled, by season of the bio file
SELECT 'nba' AS lg, season, count(*) AS rows, count(college_id) AS college_id, count(draft_year) AS draft_year,
  count(date_of_birth) AS dob FROM nba.src_espn_player_core WHERE season >= 2022 GROUP BY ALL
UNION ALL
SELECT 'wnba', season, count(*), count(college_id), count(draft_year), count(date_of_birth)
FROM wnba.src_espn_player_core WHERE season >= 2022 GROUP BY ALL ORDER BY 1, 2
