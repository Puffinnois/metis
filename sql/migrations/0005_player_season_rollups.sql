-- player_season_totals: one row per (player_id, season_id, season_type, source).
-- Counting stats summed from player_game_box. plus_minus excluded (see design spec).
-- Nullable stats follow the box table convention: NULL when source did not report.

CREATE SEQUENCE IF NOT EXISTS seq_player_season_totals START 1;
CREATE SEQUENCE IF NOT EXISTS seq_player_season_per_game START 1;

CREATE TABLE IF NOT EXISTS player_season_totals (
    id                       BIGINT       DEFAULT nextval('seq_player_season_totals') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_season_totals
    ON player_season_totals (player_id, season_id, season_type, source);

-- player_season_per_game: derived from player_season_totals (total / games_played).
-- Column names mirror player_season_totals; types are DECIMAL(6,2).

CREATE TABLE IF NOT EXISTS player_season_per_game (
    id                       BIGINT       DEFAULT nextval('seq_player_season_per_game') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
    minutes_played           DECIMAL(6,2),
    points                   DECIMAL(6,2),
    rebounds_offensive       DECIMAL(6,2),
    rebounds_defensive       DECIMAL(6,2),
    rebounds_total           DECIMAL(6,2),
    assists                  DECIMAL(6,2),
    steals                   DECIMAL(6,2),
    blocks                   DECIMAL(6,2),
    turnovers                DECIMAL(6,2),
    personal_fouls           DECIMAL(6,2),
    field_goals_made         DECIMAL(6,2),
    field_goals_attempted    DECIMAL(6,2),
    three_pointers_made      DECIMAL(6,2),
    three_pointers_attempted DECIMAL(6,2),
    free_throws_made         DECIMAL(6,2),
    free_throws_attempted    DECIMAL(6,2),
    computed_at              TIMESTAMP    NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_season_per_game
    ON player_season_per_game (player_id, season_id, season_type, source);
