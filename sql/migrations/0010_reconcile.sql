-- Reconciliation layer: canonical per-player-season stats and disagreement log.
-- player_season_canonical: the "winning" row chosen by source priority rules.
-- stat_disagreement: log of per-stat conflicts found between any two sources.
-- All timestamps are stored in UTC.

-- ── Sequences ────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_player_season_canonical START 1;
CREATE SEQUENCE IF NOT EXISTS seq_stat_disagreement START 1;

-- ── player_season_canonical ──────────────────────────────────────────────────
-- One row per (player_id, season_id, season_type).
-- Counting stats are taken from the highest-priority source present.
-- canonical_source records which source was chosen.

CREATE TABLE IF NOT EXISTS player_season_canonical (
    id                       BIGINT       NOT NULL DEFAULT nextval('seq_player_season_canonical') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    canonical_source         TEXT         NOT NULL,
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
    reconciled_at            TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_season_canonical
    ON player_season_canonical (player_id, season_id, season_type);

-- ── stat_disagreement ────────────────────────────────────────────────────────
-- One row per stat that exceeds the configured disagreement threshold between
-- any two sources for the same (player_id, season_id, season_type) group.

CREATE TABLE IF NOT EXISTS stat_disagreement (
    id           BIGINT        NOT NULL DEFAULT nextval('seq_stat_disagreement') PRIMARY KEY,
    player_id    TEXT          NOT NULL,
    season_id    TEXT          NOT NULL,
    season_type  TEXT          NOT NULL,
    stat_name    TEXT          NOT NULL,
    source_a     TEXT          NOT NULL,
    value_a      DECIMAL(10,2),
    source_b     TEXT          NOT NULL,
    value_b      DECIMAL(10,2),
    pct_diff     DECIMAL(8,4),
    logged_at    TIMESTAMP     NOT NULL DEFAULT now()
);
