-- Uniqueness indexes for possession and lineup_stint (provenance invariant, ADR-005).
-- player_lineup_stats is a compute output; its index enforces functional uniqueness
-- rather than per-source deduplication.

-- One row per (game, period, possession number, source).
-- possession_num is a within-period counter assigned by pbpstats, so
-- (game_id, period, possession_num) is a stable natural key per game.
CREATE UNIQUE INDEX IF NOT EXISTS ux_possession_source
    ON possession (game_id, period, possession_num, source);

-- One row per (game, period, team, lineup, start clock, source).
-- start_time_remaining is NOT NULL (enforced in 0005) so this index provides
-- reliable deduplication across re-ingests even when the same lineup returns
-- to the floor within a period.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lineup_stint_source
    ON lineup_stint (game_id, period, team_id, lineup_id, start_time_remaining, source);

-- One compute row per (player, team, season, season_type).
CREATE UNIQUE INDEX IF NOT EXISTS ux_player_lineup_stats
    ON player_lineup_stats (player_id, team_id, season_id, season_type);
