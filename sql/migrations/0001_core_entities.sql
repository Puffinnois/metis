-- Core entity dimension tables.
-- All timestamps are stored in UTC.

-- Known basketball leagues. Seeded at migration time; matches the League enum in metis-core.
CREATE TABLE IF NOT EXISTS league (
    id         TEXT      NOT NULL PRIMARY KEY, -- 'NBA', 'WNBA', 'NCAAM', 'NCAAW', 'Euroleague'
    full_name  TEXT      NOT NULL,             -- Human-readable league name
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

INSERT INTO league (id, full_name) VALUES
    ('NBA',        'National Basketball Association'),
    ('WNBA',       'Women''s National Basketball Association'),
    ('NCAAM',      'NCAA Division I Men''s Basketball'),
    ('NCAAW',      'NCAA Division I Women''s Basketball'),
    ('Euroleague', 'EuroLeague Basketball')
ON CONFLICT (id) DO NOTHING;

-- A franchise or club within a league. id encodes league prefix + source team key,
-- e.g. 'NBA_BOS' for the Boston Celtics.
CREATE TABLE IF NOT EXISTS team (
    id           TEXT      NOT NULL PRIMARY KEY, -- 'NBA_BOS'
    league_id    TEXT      NOT NULL REFERENCES league(id),
    abbreviation TEXT      NOT NULL,             -- Short code used in box scores, e.g. 'BOS'
    full_name    TEXT      NOT NULL,             -- 'Boston Celtics'
    city         TEXT      NOT NULL,             -- 'Boston'
    created_at   TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at   TIMESTAMP NOT NULL DEFAULT current_timestamp
);

-- A player. id encodes league prefix + source player key, e.g. 'NBA_2544' for LeBron James
-- (NBA Stats player ID 2544).
CREATE TABLE IF NOT EXISTS player (
    id         TEXT      NOT NULL PRIMARY KEY, -- 'NBA_2544'
    league_id  TEXT      NOT NULL REFERENCES league(id),
    first_name TEXT      NOT NULL,
    last_name  TEXT      NOT NULL,
    birth_date DATE,                           -- NULL when not reported by the source
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

-- A season for a league. id is the canonical label used across the system,
-- e.g. '2023-24'. Matches the Display output of the Season newtype in metis-core.
CREATE TABLE IF NOT EXISTS season (
    id         TEXT     NOT NULL PRIMARY KEY, -- '2023-24'
    league_id  TEXT     NOT NULL REFERENCES league(id),
    start_year SMALLINT NOT NULL,             -- First calendar year, e.g. 2023
    end_year   SMALLINT NOT NULL,             -- Second calendar year, e.g. 2024
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

-- A single game between two teams.
CREATE TABLE IF NOT EXISTS game (
    id           TEXT      NOT NULL PRIMARY KEY, -- Source-assigned game identifier
    league_id    TEXT      NOT NULL REFERENCES league(id),
    season_id    TEXT      NOT NULL REFERENCES season(id),
    season_type  TEXT      NOT NULL,             -- 'Regular', 'Playoffs', 'PlayIn', 'AllStar', 'Preseason'
    game_date    DATE      NOT NULL,
    home_team_id TEXT      NOT NULL REFERENCES team(id),
    away_team_id TEXT      NOT NULL REFERENCES team(id),
    home_score   SMALLINT,                       -- NULL until game is final
    away_score   SMALLINT,                       -- NULL until game is final
    status       TEXT      NOT NULL DEFAULT 'final', -- 'scheduled', 'live', 'final'
    created_at   TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at   TIMESTAMP NOT NULL DEFAULT current_timestamp
);
