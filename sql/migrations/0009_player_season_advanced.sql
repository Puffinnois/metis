-- Advanced stats derived tables: TS%, eFG%, USG%, per-36, per-100 possessions.
-- All timestamps are stored in UTC.

-- ── Sequences ────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_player_season_advanced START 1;
CREATE SEQUENCE IF NOT EXISTS seq_player_season_per_36 START 1;
CREATE SEQUENCE IF NOT EXISTS seq_player_season_per_100 START 1;

-- ── player_season_advanced ───────────────────────────────────────────────────
-- One row per (player, season, season_type, source).
-- Stores TS%, eFG%, USG%. NULL when the denominator is zero or team data is
-- unavailable (see NULLIF guards in the compute queries).

CREATE TABLE IF NOT EXISTS player_season_advanced (
    id               BIGINT    NOT NULL DEFAULT nextval('seq_player_season_advanced') PRIMARY KEY,
    player_id        TEXT      NOT NULL REFERENCES player(id),
    season_id        TEXT      NOT NULL,
    season_type      TEXT      NOT NULL,
    source           TEXT      NOT NULL,
    -- True Shooting %: PTS / (2 * (FGA + 0.44 * FTA))
    -- NULL when FGA = 0 and FTA = 0.
    true_shooting_pct  DECIMAL(6,4),
    -- Effective Field Goal %: (FGM + 0.5 * 3PM) / FGA
    -- NULL when FGA = 0.
    effective_fg_pct   DECIMAL(6,4),
    -- Usage Rate %: 100 * (FGA + 0.44*FTA + TOV) * (TmMP/5) / (MP * (TmFGA + 0.44*TmFTA + TmTOV))
    -- NULL when player MP = 0 or team denominators are zero.
    usage_rate         DECIMAL(6,4),
    computed_at      TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_season_advanced_key
    ON player_season_advanced (player_id, season_id, season_type, source);

-- ── player_season_per_36 ─────────────────────────────────────────────────────
-- One row per (player, season, season_type, source).
-- All counting stats scaled to per-36 minutes.

CREATE TABLE IF NOT EXISTS player_season_per_36 (
    id                       BIGINT       NOT NULL DEFAULT nextval('seq_player_season_per_36') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
    -- All per-36 fields are NULL when minutes_played = 0.
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_season_per_36_key
    ON player_season_per_36 (player_id, season_id, season_type, source);

-- ── player_season_per_100 ────────────────────────────────────────────────────
-- One row per (player, season, season_type, source).
-- All counting stats scaled to per-100 estimated individual possessions.
-- Estimated possessions = FGA + 0.44*FTA + TOV - ORB.

CREATE TABLE IF NOT EXISTS player_season_per_100 (
    id                       BIGINT       NOT NULL DEFAULT nextval('seq_player_season_per_100') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
    -- All per-100 fields are NULL when estimated possessions = 0.
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_season_per_100_key
    ON player_season_per_100 (player_id, season_id, season_type, source);
