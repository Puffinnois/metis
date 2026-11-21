-- columns of the college team and player-season tables
SELECT database_name AS db, table_name, string_agg(column_name, ', ' ORDER BY column_index) AS cols
FROM duckdb_columns() WHERE database_name = 'ncaam' AND table_name IN ('team', 'player_season', 'player_game')
GROUP BY ALL
;
-- the professional ESPN bio's college_id against the college's ESPN team id: Banchero, Holmgren, Clark
SELECT 'nba' AS lg, c.display_name, any_value(c.college_id) AS college_id FROM nba.src_espn_player_core c
WHERE c.display_name IN ('Paolo Banchero', 'Chet Holmgren', 'Zach Edey') GROUP BY ALL
UNION ALL
SELECT 'wnba', c.display_name, any_value(c.college_id) FROM wnba.src_espn_player_core c
WHERE c.display_name IN ('Caitlin Clark', 'Aliyah Boston', 'Paige Bueckers') GROUP BY ALL
;
-- every draft pick of the classes 2022 to 2026 in the NBA player table?
SELECT d.season - 1 AS class, d.organization_type, count(*) AS picks, count(p.player_id) AS in_player,
  count(p.espn_athlete_id) AS with_espn
FROM nba.src_nba_draft d LEFT JOIN nba.player p ON p.player_id = d.person_id
WHERE d.season BETWEEN 2023 AND 2027 GROUP BY ALL ORDER BY 1, 2
;
-- the same for the WNBA (its draft is labelled by its own year)
SELECT d.season AS class, d.organization_type, count(*) AS picks, count(DISTINCT d.person_id) AS people,
  count(DISTINCT p.player_id) AS in_player, count(DISTINCT p.espn_athlete_id) AS with_espn
FROM wnba.src_wnba_draft d LEFT JOIN wnba.player p ON p.player_id = d.person_id
WHERE d.season BETWEEN 2022 AND 2026 GROUP BY ALL ORDER BY 1, 2
