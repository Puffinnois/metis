-- Saved views: a named leaderboard, with its tab, columns, sort and filters. The season and date range
-- stay the screen's own, so a view carries over from one season to the next.
CREATE TABLE stats_views (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  board_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
