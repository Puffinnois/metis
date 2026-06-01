-- team_season_totals: one row per (team_id, season_id, season_type, source).
-- Includes team-specific columns absent from player box: fast_break_points, etc.
-- No minutes_played: teams don't have individual minutes in the traditional box score.

CREATE SEQUENCE IF NOT EXISTS seq_team_season_totals START 1;
CREATE SEQUENCE IF NOT EXISTS seq_team_season_per_game START 1;

CREATE TABLE IF NOT EXISTS team_season_totals (
    id                       BIGINT       DEFAULT nextval('seq_team_season_totals') PRIMARY KEY,
    team_id                  TEXT         NOT NULL REFERENCES team(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
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
    fast_break_points        INTEGER,
    points_in_paint          INTEGER,
    second_chance_points     INTEGER,
    bench_points             INTEGER,
    computed_at              TIMESTAMP    NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_season_totals
    ON team_season_totals (team_id, season_id, season_type, source);

-- team_season_per_game: derived from team_season_totals (total / games_played).

CREATE TABLE IF NOT EXISTS team_season_per_game (
    id                       BIGINT       DEFAULT nextval('seq_team_season_per_game') PRIMARY KEY,
    team_id                  TEXT         NOT NULL REFERENCES team(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
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
    fast_break_points        DECIMAL(6,2),
    points_in_paint          DECIMAL(6,2),
    second_chance_points     DECIMAL(6,2),
    bench_points             DECIMAL(6,2),
    computed_at              TIMESTAMP    NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_season_per_game
    ON team_season_per_game (team_id, season_id, season_type, source);
