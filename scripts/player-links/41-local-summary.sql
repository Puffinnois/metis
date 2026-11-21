-- the size of a summary kept locally: every linked player's season rows on each side, written as Parquet to a scratch
-- folder (METIS_SCRATCH, default /tmp), whole rows and a 20-column career line
CREATE OR REPLACE TEMP TABLE links AS
SELECT 'nba' AS pro, p.player_id AS pro_id, c.player_id AS col_id FROM nba.player p JOIN ncaam.player c USING (espn_athlete_id)
UNION ALL
SELECT 'wnba', p.player_id, c.player_id FROM wnba.player p JOIN ncaaw.player c USING (espn_athlete_id);
SELECT pro, count(*) AS links, count(DISTINCT pro_id) AS pro_players, count(DISTINCT col_id) AS college_players FROM links GROUP BY pro
;
-- rows and columns to keep
SELECT 'nba pro seasons' AS what, count(*) AS rows FROM nba.player_season WHERE player_id IN (SELECT pro_id FROM links WHERE pro = 'nba')
UNION ALL SELECT 'wnba pro seasons', count(*) FROM wnba.player_season WHERE player_id IN (SELECT pro_id FROM links WHERE pro = 'wnba')
UNION ALL SELECT 'ncaam college seasons', count(*) FROM ncaam.player_season WHERE player_id IN (SELECT col_id FROM links WHERE pro = 'nba')
UNION ALL SELECT 'ncaaw college seasons', count(*) FROM ncaaw.player_season WHERE player_id IN (SELECT col_id FROM links WHERE pro = 'wnba')
;
-- the first 24 columns of player_season, per league (what a 20-column career line would take)
SELECT database_name AS db, string_agg(column_name, ', ' ORDER BY column_index) AS cols
FROM duckdb_columns() WHERE table_name = 'player_season' AND column_index <= 24 GROUP BY ALL
;
-- written as Parquet (zstd): whole rows, and a career line of the first 24 columns plus blocks, turnovers, fouls, points
COPY (SELECT * FROM nba.player_season WHERE player_id IN (SELECT pro_id FROM links WHERE pro = 'nba'))
  TO '${SCRATCH}/pl-nba-whole.parquet' (FORMAT parquet, COMPRESSION zstd);
COPY (SELECT COLUMNS('^(player_id|season|game_type|team_id|last_team_id|last_date|position|games|starts|wins|losses|seconds|minutes|fgm|fga|fg3m|fg3a|ftm|fta|oreb|dreb|reb|ast|stl|blk|tov|pf|pts)$')
  FROM nba.player_season WHERE player_id IN (SELECT pro_id FROM links WHERE pro = 'nba'))
  TO '${SCRATCH}/pl-nba-line.parquet' (FORMAT parquet, COMPRESSION zstd);
COPY (SELECT * FROM wnba.player_season WHERE player_id IN (SELECT pro_id FROM links WHERE pro = 'wnba'))
  TO '${SCRATCH}/pl-wnba-whole.parquet' (FORMAT parquet, COMPRESSION zstd);
COPY (SELECT * FROM ncaam.player_season WHERE player_id IN (SELECT col_id FROM links WHERE pro = 'nba'))
  TO '${SCRATCH}/pl-ncaam-whole.parquet' (FORMAT parquet, COMPRESSION zstd);
COPY (SELECT COLUMNS('^(player_id|season|game_type|team_id|last_team_id|last_date|position|games|starts|wins|losses|seconds|minutes|fgm|fga|fg3m|fg3a|ftm|fta|oreb|dreb|reb|ast|stl|blk|tov|pf|pts)$')
  FROM ncaam.player_season WHERE player_id IN (SELECT col_id FROM links WHERE pro = 'nba'))
  TO '${SCRATCH}/pl-ncaam-line.parquet' (FORMAT parquet, COMPRESSION zstd);
COPY (SELECT * FROM ncaaw.player_season WHERE player_id IN (SELECT col_id FROM links WHERE pro = 'wnba'))
  TO '${SCRATCH}/pl-ncaaw-whole.parquet' (FORMAT parquet, COMPRESSION zstd);
SELECT 1
;
-- their sizes
SELECT m.file_name, any_value(f.num_rows) AS rows, count(DISTINCT m.path_in_schema) AS columns,
  sum(m.total_compressed_size) AS bytes_in_columns
FROM parquet_metadata('${SCRATCH}/pl-*.parquet') m JOIN parquet_file_metadata('${SCRATCH}/pl-*.parquet') f USING (file_name)
GROUP BY 1 ORDER BY 1
