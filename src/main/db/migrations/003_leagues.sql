-- Leagues (D35, Plan T1301.2): saved views and per-league settings are kept per league, and every
-- view saved before this belongs to the NBA. App-wide settings (theme, dev mode, the notes folder)
-- stay in app_settings. SQLite cannot change a table's UNIQUE constraint, so the views move to a new
-- table keyed by league and name, keeping their ids.
CREATE TABLE stats_views_by_league (
  id INTEGER PRIMARY KEY,
  league TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  board_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (league, name)
);
INSERT INTO stats_views_by_league (id, league, name, board_json, created_at, updated_at)
  SELECT id, 'nba', name, board_json, created_at, updated_at FROM stats_views;
DROP TABLE stats_views;
ALTER TABLE stats_views_by_league RENAME TO stats_views;

-- A league's own settings, such as the scope it was left on (Plan T1301.3).
CREATE TABLE league_settings (
  league TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (league, key)
);
