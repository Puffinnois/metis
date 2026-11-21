-- columns of the tables that can identify a player, per file
SELECT database_name AS db, table_name, string_agg(column_name || ':' || data_type, ', ' ORDER BY column_index) AS cols
FROM duckdb_columns()
WHERE table_name IN ('player', 'player_ids', 'ncaa_player_ids', 'src_espn_draft', 'src_nba_draft', 'src_wnba_draft',
  'src_espn_player_core', 'src_xwalk_player', 'src_player_aliases', 'src_dash_player_bio', 'src_espn_rosters',
  'src_nba_rosters', 'src_wnba_rosters', 'src_ncaa_team_rosters')
GROUP BY ALL
ORDER BY table_name, db
