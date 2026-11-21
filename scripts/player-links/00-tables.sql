-- tables with player, draft, athlete, roster or bio in the name, per file
SELECT database_name, table_name, estimated_size AS rows, column_count
FROM duckdb_tables()
WHERE regexp_matches(table_name, 'player|draft|athlete|roster|core|bio|crosswalk|people|alias')
  AND NOT regexp_matches(table_name, 'game|season_stat|box|shot|lineup|stint|rapm|value|split|play_')
ORDER BY database_name, table_name
