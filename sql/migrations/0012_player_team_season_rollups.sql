-- player_team_season_totals: one row per (player_id, team_id, season_id, season_type, source).
-- Materializes the per-team split for players who may change teams during a season.
-- Enables a fast query path for team-filtered player stats (T062).

CREATE SEQUENCE IF NOT EXISTS seq_player_team_season_totals START 1;

CREATE TABLE IF NOT EXISTS player_team_season_totals (
    id                       BIGINT       NOT NULL DEFAULT nextval('seq_player_team_season_totals') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    team_id                  TEXT         NOT NULL REFERENCES team(id),
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

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_team_season_totals
    ON player_team_season_totals (player_id, team_id, season_id, season_type, source);

-- ── Covering index on player_game_box for the aggregation-path WHERE + GROUP BY ──
-- Helps queries that filter on (source, season_id, season_type, team_id) and
-- join on game_id — the common pattern in query_aggregated.

CREATE INDEX IF NOT EXISTS idx_pgb_agg_covering
    ON player_game_box (source, season_id, season_type, team_id, game_id);

-- ── Indexes on game to accelerate join conditions ─────────────────────────────

-- Date-range filters: game_date drives the CAST(? AS DATE) comparisons.
CREATE INDEX IF NOT EXISTS idx_game_date
    ON game (game_date, id);

-- Home/away and win/loss resolution joins home_team_id / away_team_id.
CREATE INDEX IF NOT EXISTS idx_game_home_team
    ON game (home_team_id, id);

CREATE INDEX IF NOT EXISTS idx_game_away_team
    ON game (away_team_id, id);
