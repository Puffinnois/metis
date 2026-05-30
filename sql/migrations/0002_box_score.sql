-- Box score fact tables: one row per (player or team) × game × source.
--
-- Provenance columns are included here (rather than via ALTER TABLE in 0003) because
-- DuckDB does not support adding NOT NULL columns to existing tables via ALTER TABLE.
-- 0003_provenance.sql adds the uniqueness indexes that enforce the per-source invariant.
--
-- All stat columns are NULL when not reported by the source.

CREATE SEQUENCE IF NOT EXISTS seq_player_game_box START 1;
CREATE SEQUENCE IF NOT EXISTS seq_team_game_box START 1;

-- One row per player per game per ingest source.
-- season_id and season_type are denormalized from game to avoid joins on every filter query.
CREATE TABLE IF NOT EXISTS player_game_box (
    id                       BIGINT    DEFAULT nextval('seq_player_game_box') PRIMARY KEY,
    game_id                  TEXT      NOT NULL REFERENCES game(id),
    player_id                TEXT      NOT NULL REFERENCES player(id),
    team_id                  TEXT      NOT NULL REFERENCES team(id),
    season_id                TEXT      NOT NULL,  -- Denormalized from game for filter performance
    season_type              TEXT      NOT NULL,  -- 'Regular', 'Playoffs', 'PlayIn', 'AllStar', 'Preseason'
    starter                  BOOLEAN,
    minutes_played           DECIMAL(5, 2),       -- Fractional minutes, e.g. 32.50
    points                   SMALLINT,
    rebounds_offensive       SMALLINT,
    rebounds_defensive       SMALLINT,
    rebounds_total           SMALLINT,
    assists                  SMALLINT,
    steals                   SMALLINT,
    blocks                   SMALLINT,
    turnovers                SMALLINT,
    personal_fouls           SMALLINT,
    field_goals_made         SMALLINT,
    field_goals_attempted    SMALLINT,
    three_pointers_made      SMALLINT,
    three_pointers_attempted SMALLINT,
    free_throws_made         SMALLINT,
    free_throws_attempted    SMALLINT,
    plus_minus               SMALLINT,            -- Signed; NULL when not reported
    -- Provenance (ADR-005): always populated by the ingest pipeline, never NULL in practice.
    source                   TEXT      NOT NULL,  -- Adapter name, e.g. 'nba_stats', 'bref'
    source_url               TEXT      NOT NULL,  -- URL that was fetched
    fetched_at               TIMESTAMP NOT NULL,  -- When the source was fetched (UTC)
    source_payload           JSON      NOT NULL,  -- Full original JSON payload
    ingested_at              TIMESTAMP NOT NULL DEFAULT current_timestamp
);

-- One row per team per game per ingest source.
-- opponent_team_id and is_home are included so team queries need not join game.
CREATE TABLE IF NOT EXISTS team_game_box (
    id                       BIGINT    DEFAULT nextval('seq_team_game_box') PRIMARY KEY,
    game_id                  TEXT      NOT NULL REFERENCES game(id),
    team_id                  TEXT      NOT NULL REFERENCES team(id),
    opponent_team_id         TEXT      NOT NULL REFERENCES team(id),
    season_id                TEXT      NOT NULL,  -- Denormalized from game for filter performance
    season_type              TEXT      NOT NULL,  -- 'Regular', 'Playoffs', 'PlayIn', 'AllStar', 'Preseason'
    is_home                  BOOLEAN   NOT NULL,
    points                   SMALLINT,
    rebounds_offensive       SMALLINT,
    rebounds_defensive       SMALLINT,
    rebounds_total           SMALLINT,
    assists                  SMALLINT,
    steals                   SMALLINT,
    blocks                   SMALLINT,
    turnovers                SMALLINT,
    personal_fouls           SMALLINT,
    field_goals_made         SMALLINT,
    field_goals_attempted    SMALLINT,
    three_pointers_made      SMALLINT,
    three_pointers_attempted SMALLINT,
    free_throws_made         SMALLINT,
    free_throws_attempted    SMALLINT,
    fast_break_points        SMALLINT,            -- NULL when source does not report it
    points_in_paint          SMALLINT,
    second_chance_points     SMALLINT,
    bench_points             SMALLINT,
    -- Provenance (ADR-005): always populated by the ingest pipeline, never NULL in practice.
    source                   TEXT      NOT NULL,  -- Adapter name, e.g. 'nba_stats', 'bref'
    source_url               TEXT      NOT NULL,  -- URL that was fetched
    fetched_at               TIMESTAMP NOT NULL,  -- When the source was fetched (UTC)
    source_payload           JSON      NOT NULL,  -- Full original JSON payload
    ingested_at              TIMESTAMP NOT NULL DEFAULT current_timestamp
);
