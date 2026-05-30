-- Uniqueness indexes enforcing the per-source provenance invariant (ADR-005).
--
-- These indexes allow the same game to be ingested from multiple sources, while
-- preventing duplicate rows from the same source for the same entity.
--
-- Note: provenance columns (source, source_url, fetched_at, source_payload) are
-- defined in 0002_box_score.sql because DuckDB does not support adding NOT NULL
-- columns to existing tables via ALTER TABLE.

-- One row per (player, game, source).
CREATE UNIQUE INDEX IF NOT EXISTS ux_player_game_box_source
    ON player_game_box (game_id, player_id, source);

-- One row per (team, game, source).
CREATE UNIQUE INDEX IF NOT EXISTS ux_team_game_box_source
    ON team_game_box (game_id, team_id, source);
