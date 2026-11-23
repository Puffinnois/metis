-- Favourites (D49, Plan T1601): a starred player or team, kept here beside the saved views so a star
-- survives its league's stats file being deleted or rebuilt. Keyed by the league and the id as that
-- league's stats file knows it, since ids are a league's own and can be the same number in two. The
-- name is the one shown when the star was given, for when the file that names it is gone. A linked
-- player starred in one league is a favourite in the paired league too, resolved through the links
-- when read, so the row stays only where the star was given.
CREATE TABLE favourites (
  league TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('player', 'team')),
  entity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  starred_at TEXT NOT NULL,
  PRIMARY KEY (league, kind, entity_id)
);
