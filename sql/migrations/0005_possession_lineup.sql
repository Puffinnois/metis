-- Possession and lineup stint fact tables for PBP-level data (pbpstats source).
-- player_lineup_stats is a compute output populated by metis-compute (T052),
-- not the ingest pipeline.
--
-- Provenance columns are included inline because DuckDB does not support
-- adding NOT NULL columns to existing tables via ALTER TABLE.
-- Uniqueness indexes live in 0006_possession_lineup_indexes.sql.

CREATE SEQUENCE IF NOT EXISTS seq_possession START 1;
CREATE SEQUENCE IF NOT EXISTS seq_lineup_stint START 1;
CREATE SEQUENCE IF NOT EXISTS seq_player_lineup_stats START 1;

-- One row per possession per ingest source.
-- A possession is a single offensive sequence for one team, bounded by the
-- change of ball possession. season_id and season_type are denormalized from
-- game for filter performance (ADR-011).
--
-- offense_lineup_id and defense_lineup_id are hyphen-separated sorted pbpstats
-- numeric player ID strings (e.g. '203500-1628384-1629029'). They intentionally
-- omit the NBA_ prefix so they join directly to lineup_stint.lineup_id.
CREATE TABLE IF NOT EXISTS possession (
    id                    BIGINT    DEFAULT nextval('seq_possession') PRIMARY KEY,
    game_id               TEXT      NOT NULL REFERENCES game(id),
    period                SMALLINT  NOT NULL,                        -- 1–4, then 5+ for OT periods
    possession_num        SMALLINT  NOT NULL,                        -- Within-period counter assigned by pbpstats
    global_possession_num INTEGER   NOT NULL,                        -- Season-run ordering hint; resets on re-ingest
    offense_team_id       TEXT      NOT NULL REFERENCES team(id),
    defense_team_id       TEXT      REFERENCES team(id),             -- NULL on jump balls or when unknown
    start_time_remaining  DOUBLE,                                    -- Seconds left in period at possession start
    end_time_remaining    DOUBLE,                                    -- Seconds left in period at possession end
    duration_seconds      DOUBLE,                                    -- Derived: start_time_remaining − end_time_remaining
    score_margin          SMALLINT,                                  -- Offense team's lead at possession start; negative = trailing
    possession_start_type TEXT,                                      -- e.g. 'LiveBallTurnover'; NULL when unavailable
    points_scored         SMALLINT  NOT NULL,                        -- Points scored by the offense this possession
    offense_lineup_id     TEXT,                                      -- NULL when lineup data unavailable for this event
    defense_lineup_id     TEXT,                                      -- NULL when lineup data unavailable for this event
    num_events            SMALLINT  NOT NULL,                        -- Number of PBP events comprising this possession
    season_id             TEXT      NOT NULL,                        -- Denormalized from game for filter performance
    season_type           TEXT      NOT NULL,                        -- 'Regular', 'Playoffs', 'PlayIn'
    -- Provenance (ADR-005)
    source                TEXT      NOT NULL,                        -- 'pbpstats'
    source_url            TEXT      NOT NULL,
    fetched_at            TIMESTAMP NOT NULL,
    source_payload        JSON      NOT NULL,
    ingested_at           TIMESTAMP NOT NULL DEFAULT current_timestamp
);

-- One row per lineup stint per ingest source.
-- A lineup stint is a maximal consecutive-possession run within a period where
-- a team's 5-player unit remains unchanged. One stint is produced per team per
-- contiguous block, so both teams' stints are tracked for every possession span.
--
-- lineup_id is the raw pbpstats hyphen-separated sorted numeric player ID string.
-- It omits the NBA_ prefix deliberately so it joins to possession.offense_lineup_id
-- and possession.defense_lineup_id without transformation. Individual player{N}_id
-- columns use the NBA_ prefix to reference the player dimension table.
--
-- start_time_remaining is NOT NULL by design: if pbpstats cannot provide a clock
-- value for the start of a stint, ingest must fail loudly rather than silently
-- corrupt the deduplication index in 0006_possession_lineup_indexes.sql.
CREATE TABLE IF NOT EXISTS lineup_stint (
    id                   BIGINT    DEFAULT nextval('seq_lineup_stint') PRIMARY KEY,
    game_id              TEXT      NOT NULL REFERENCES game(id),
    period               SMALLINT  NOT NULL,
    team_id              TEXT      NOT NULL REFERENCES team(id),
    player1_id           TEXT      REFERENCES player(id),            -- NULL when fewer than 5 players tracked
    player2_id           TEXT      REFERENCES player(id),
    player3_id           TEXT      REFERENCES player(id),
    player4_id           TEXT      REFERENCES player(id),
    player5_id           TEXT      REFERENCES player(id),
    lineup_id            TEXT      NOT NULL,
    start_time_remaining DOUBLE    NOT NULL,                         -- NOT NULL to support the deduplication index
    end_time_remaining   DOUBLE,
    duration_seconds     DOUBLE,
    possessions_offense  SMALLINT  NOT NULL,
    possessions_defense  SMALLINT  NOT NULL,
    points_for           SMALLINT  NOT NULL,
    points_against       SMALLINT  NOT NULL,
    plus_minus           SMALLINT  NOT NULL,                         -- points_for − points_against
    season_id            TEXT      NOT NULL,
    season_type          TEXT      NOT NULL,
    -- Provenance (ADR-005)
    source               TEXT      NOT NULL,
    source_url           TEXT      NOT NULL,
    fetched_at           TIMESTAMP NOT NULL,
    source_payload       JSON      NOT NULL,
    ingested_at          TIMESTAMP NOT NULL DEFAULT current_timestamp
);

-- Per-player per-season on-off summary. Populated by metis-compute (T052),
-- not the ingest pipeline. No provenance columns.
-- Players who changed teams mid-season get one row per team stint.
CREATE TABLE IF NOT EXISTS player_lineup_stats (
    id                      BIGINT    DEFAULT nextval('seq_player_lineup_stats') PRIMARY KEY,
    player_id               TEXT      NOT NULL REFERENCES player(id),
    team_id                 TEXT      NOT NULL REFERENCES team(id),
    season_id               TEXT      NOT NULL,
    season_type             TEXT      NOT NULL,                      -- 'Regular', 'Playoffs', 'PlayIn'
    -- On-court aggregates (possessions where this player was on the floor)
    minutes_on_court        DOUBLE,
    possessions_on_offense  INTEGER,
    possessions_on_defense  INTEGER,
    points_for_on           INTEGER,
    points_against_on       INTEGER,
    net_rating_on           DOUBLE,                                  -- (points_for_on − points_against_on) / possessions * 100
    -- Off-court aggregates (possessions where this player was on the bench)
    minutes_off_court       DOUBLE,
    possessions_off_offense INTEGER,
    possessions_off_defense INTEGER,
    points_for_off          INTEGER,
    points_against_off      INTEGER,
    net_rating_off          DOUBLE,                                  -- (points_for_off − points_against_off) / possessions * 100
    on_off_net_rating       DOUBLE,                                  -- net_rating_on − net_rating_off
    computed_at             TIMESTAMP NOT NULL DEFAULT current_timestamp
);
