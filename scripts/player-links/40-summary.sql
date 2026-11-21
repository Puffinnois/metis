-- ESPN's season stats (src_espn_player_season): its columns
SELECT database_name AS db, string_agg(column_name || ':' || data_type, ', ' ORDER BY column_index) AS cols
FROM duckdb_columns() WHERE table_name = 'src_espn_player_season' AND database_name IN ('nba', 'ncaam') GROUP BY ALL
;
-- what a career line from it holds: Cooper Flagg's 2025-26 NBA rows, and his 2024-25 college rows
SELECT 'nba' AS lg, * FROM nba.src_espn_player_season WHERE athlete_id = 5041939 AND season = 2026 LIMIT 60
;
SELECT 'ncaam' AS lg, * FROM ncaam.src_espn_player_season WHERE athlete_id = 5041939 AND season = 2025 LIMIT 60
;
-- the stat names per league, and rows a player-season
SELECT 'nba' AS lg, count(DISTINCT name) AS stats, count(*) / count(DISTINCT (athlete_id, season)) AS rows_per_player_season
FROM nba.src_espn_player_season WHERE season >= 2022
UNION ALL SELECT 'wnba', count(DISTINCT name), count(*) / count(DISTINCT (athlete_id, season)) FROM wnba.src_espn_player_season WHERE season >= 2022
UNION ALL SELECT 'ncaam', count(DISTINCT name), count(*) / count(DISTINCT (athlete_id, season)) FROM ncaam.src_espn_player_season
UNION ALL SELECT 'ncaaw', count(DISTINCT name), count(*) / count(DISTINCT (athlete_id, season)) FROM ncaaw.src_espn_player_season
