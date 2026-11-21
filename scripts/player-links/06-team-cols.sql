-- college team table columns and a sample
SELECT * FROM ncaam.team WHERE season = 2024 AND espn_team_id IN (150, 41, 2509)
;
SELECT column_name, data_type FROM duckdb_columns() WHERE database_name = 'ncaam' AND table_name = 'player_season' AND column_index < 12
;
-- organizations of college picks, sample
SELECT DISTINCT organization FROM nba.src_nba_draft WHERE season BETWEEN 2023 AND 2027 AND organization_type = 'College/University' ORDER BY 1 LIMIT 200
