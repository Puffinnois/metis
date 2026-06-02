-- stat_disagreement: one row per (player, season, season_type, stat, source_a, source_b).
-- Records any value difference between two ingest sources for the same stat.
-- source_a / source_b are stored in lexicographic order to avoid duplicate pairs.

CREATE SEQUENCE IF NOT EXISTS seq_stat_disagreement START 1;

CREATE TABLE IF NOT EXISTS stat_disagreement (
    id           BIGINT    DEFAULT nextval('seq_stat_disagreement') PRIMARY KEY,
    player_id    TEXT      NOT NULL REFERENCES player(id),
    season_id    TEXT      NOT NULL,
    season_type  TEXT      NOT NULL,
    stat_name    TEXT      NOT NULL,  -- column name from player_season_totals
    source_a     TEXT      NOT NULL,  -- lexicographically smaller source
    value_a      DOUBLE,              -- NULL when the source had no value
    source_b     TEXT      NOT NULL,  -- lexicographically larger source
    value_b      DOUBLE,              -- NULL when the source had no value
    delta        DOUBLE,              -- ABS(value_a - value_b), NULL when either is NULL
    recorded_at  TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_stat_disagreement
    ON stat_disagreement (player_id, season_id, season_type, stat_name, source_a, source_b);

-- player_season_canonical: one row per (player_id, season_id, season_type).
-- Stats come entirely from primary_source; the source that "won" is recorded.

CREATE SEQUENCE IF NOT EXISTS seq_player_season_canonical START 1;

CREATE TABLE IF NOT EXISTS player_season_canonical (
    id                       BIGINT       DEFAULT nextval('seq_player_season_canonical') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    primary_source           TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
    minutes_played           DECIMAL(7,2),
    points                   INTEGER,
    rebounds_offensive       INTEGER,
    rebounds_defensive       INTEGER,
    rebounds_total           INTEGER,
    assists                  INTEGER,
    steals                   INTEGER,
    blocks                   INTEGER,
    turnovers                INTEGER,
    personal_fouls           INTEGER,
    field_goals_made         INTEGER,
    field_goals_attempted    INTEGER,
    three_pointers_made      INTEGER,
    three_pointers_attempted INTEGER,
    free_throws_made         INTEGER,
    free_throws_attempted    INTEGER,
    computed_at              TIMESTAMP    NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_season_canonical
    ON player_season_canonical (player_id, season_id, season_type);
