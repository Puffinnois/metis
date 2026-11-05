//! Materialized rollup compute for `player_team_season_totals` (T062).
//!
//! Reads from `player_game_box` and upserts into `player_team_season_totals`,
//! one row per `(player_id, team_id, season_id, season_type, source)`.

use metis_core::Season;
use metis_db::Db;

use crate::error::ComputeError;

/// Computes (or refreshes) `player_team_season_totals` for the given season
/// and source.
///
/// Aggregates `player_game_box` grouped by `(player_id, team_id, season_id,
/// season_type, source)`. Existing rows are overwritten via upsert.
///
/// Returns the number of rows inserted or updated.
///
/// # Errors
///
/// Returns [`ComputeError::NoSourceData`] when no `player_game_box` rows exist
/// for the given `(season, source)`.
/// Returns [`ComputeError::Db`] on database errors.
pub fn compute_player_team_season_totals(
    db: &Db,
    season: Season,
    source: &str,
) -> Result<u64, ComputeError> {
    let season_id = season.to_string();

    // Pre-flight: ensure there is source data to aggregate.
    let count = db
        .season_rollups()
        .count_player_box_rows(&season_id, source)?;
    if count == 0 {
        return Err(ComputeError::NoSourceData {
            season: season_id,
            start_year: season.0,
            data_source: source.to_string(),
        });
    }

    let n = db
        .player_team_season_rollups()
        .compute_for_season(&season_id, source)?;
    Ok(n)
}

/// Computes (or refreshes) `player_team_season_totals` for **all** seasons for
/// the given source.
///
/// Useful for a one-shot backfill after initial ingestion. Returns the total
/// number of rows inserted or updated across all seasons.
///
/// # Errors
///
/// Returns [`ComputeError::Db`] on database errors.
pub fn compute_player_team_season_totals_all(
    db: &Db,
    source: &str,
) -> Result<u64, ComputeError> {
    let n = db.player_team_season_rollups().compute_all_seasons(source)?;
    Ok(n)
}
