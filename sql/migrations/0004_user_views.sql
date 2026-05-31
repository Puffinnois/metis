-- Saved filter/sort/column combinations for the frontend dashboard (ADR-013).
-- id is a client-generated UUID assigned by the frontend or API layer.
CREATE TABLE IF NOT EXISTS user_view (
    id          TEXT      NOT NULL PRIMARY KEY, -- Client-generated UUID
    name        TEXT      NOT NULL,             -- Display name chosen by the user
    description TEXT,                           -- Optional longer description
    entity_type TEXT      NOT NULL,             -- 'player' or 'team'
    filters     JSON      NOT NULL DEFAULT '{}', -- Serialized filter state (season, team, date range, etc.)
    sort_config JSON,                            -- Serialized sort configuration; NULL uses the default sort
    columns     JSON,                            -- Serialized column visibility map; NULL uses all columns
    is_default  BOOLEAN   NOT NULL DEFAULT false, -- Load this view automatically on app launch
    created_at  TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at  TIMESTAMP NOT NULL DEFAULT current_timestamp
);
