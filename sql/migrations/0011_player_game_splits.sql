CREATE SEQUENCE IF NOT EXISTS seq_player_game_splits START 1;

CREATE TABLE IF NOT EXISTS player_game_splits (
    id           BIGINT    NOT NULL DEFAULT nextval('seq_player_game_splits') PRIMARY KEY,
    player_id    TEXT      NOT NULL REFERENCES player(id),
    game_id      TEXT      NOT NULL REFERENCES game(id),
    season_id    TEXT      NOT NULL,
    season_type  TEXT      NOT NULL,
    split_type   TEXT      NOT NULL,   -- 'clutch' | 'quarter_1'..'quarter_4'|'quarter_OT' | 'garbage_time'
    -- Possession-level aggregates for possessions matching the split
    possessions_offense  INTEGER NOT NULL DEFAULT 0,
    possessions_defense  INTEGER NOT NULL DEFAULT 0,
    points_for           INTEGER NOT NULL DEFAULT 0,
    points_against       INTEGER NOT NULL DEFAULT 0,
    minutes_played       DOUBLE,       -- sum(duration_seconds)/60 for matching stints
    computed_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_game_splits_key
    ON player_game_splits (player_id, game_id, split_type);
