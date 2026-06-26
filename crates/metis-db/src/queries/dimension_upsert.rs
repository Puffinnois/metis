use crate::error::Result;
use duckdb::Connection;

/// Upsert season, team, player, and game dimension rows derived from box-score Parquet.
///
/// Call this before `player_game_box::load_from_parquet` and
/// `team_game_box::load_from_parquet` so that FK constraints are satisfied.
pub(crate) fn upsert_from_box_score_parquet(
    conn: &Connection,
    player_glob: &str,
    team_glob: &str,
) -> Result<()> {
    let pg = player_glob.replace('\'', "''");
    let tg = team_glob.replace('\'', "''");

    // Seasons — derived from season_id column (format "YYYY-YY", e.g. "2024-25").
    conn.execute_batch(&format!(
        "INSERT INTO season (id, league_id, start_year, end_year)
         SELECT DISTINCT
             season_id,
             'NBA',
             CAST(SPLIT_PART(season_id, '-', 1) AS SMALLINT),
             CAST(SPLIT_PART(season_id, '-', 1) AS SMALLINT) + 1
         FROM read_parquet('{pg}')
         ON CONFLICT (id) DO NOTHING;"
    ))?;

    // Teams — derived from team_game_box; payload has TEAM_NAME, TEAM_ABBREVIATION, TEAM_CITY.
    conn.execute_batch(&format!(
        "INSERT INTO team (id, league_id, abbreviation, full_name, city)
         SELECT
             team_id,
             'NBA',
             MIN(source_payload->>'TEAM_ABBREVIATION'),
             MIN(source_payload->>'TEAM_NAME'),
             MIN(source_payload->>'TEAM_CITY')
         FROM read_parquet('{tg}')
         GROUP BY team_id
         ON CONFLICT (id) DO UPDATE SET
             abbreviation = excluded.abbreviation,
             full_name    = excluded.full_name,
             city         = excluded.city,
             updated_at   = now();"
    ))?;

    // Players — derived from player_game_box; payload has PLAYER_NAME.
    // Split "First Last" on first space; everything after is the last name.
    conn.execute_batch(&format!(
        "INSERT INTO player (id, league_id, first_name, last_name)
         SELECT
             player_id,
             'NBA',
             MIN(SPLIT_PART(source_payload->>'PLAYER_NAME', ' ', 1)),
             MIN(REGEXP_REPLACE(source_payload->>'PLAYER_NAME', '^[^ ]+ ', ''))
         FROM read_parquet('{pg}')
         GROUP BY player_id
         ON CONFLICT (id) DO NOTHING;"
    ))?;

    // Games — one row per game_id, home/away derived from is_home column.
    // game_date is set to placeholder 1900-01-01 because the box-score endpoint
    // does not return it; a future game-metadata ingest step will UPDATE real dates.
    // Some games have no is_home=true row (data quirk); fall back to MIN/MAX(team_id).
    conn.execute_batch(&format!(
        "INSERT INTO game (id, league_id, season_id, season_type, game_date, home_team_id, away_team_id)
         SELECT
             game_id,
             'NBA',
             MIN(season_id),
             MIN(season_type),
             DATE '1900-01-01',
             COALESCE(MIN(CASE WHEN is_home     THEN team_id END), MIN(team_id)),
             COALESCE(MIN(CASE WHEN NOT is_home THEN team_id END), MAX(team_id))
         FROM read_parquet('{tg}')
         GROUP BY game_id
         ON CONFLICT (id) DO NOTHING;"
    ))?;

    Ok(())
}
