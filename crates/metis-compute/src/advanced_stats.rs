use metis_core::Season;
use metis_db::Db;

use crate::error::ComputeError;

/// Summary of a completed advanced-stats compute run.
#[derive(Debug, Clone, PartialEq)]
pub struct AdvancedStatsSummary {
    /// Number of `player_season_advanced` rows written (inserts + updates).
    pub player_advanced_rows: u64,
    /// Number of `player_season_per_36` rows written (inserts + updates).
    pub player_per_36_rows: u64,
    /// Number of `player_season_per_100` rows written (inserts + updates).
    pub player_per_100_rows: u64,
}

/// Computes TS%, eFG%, USG%, per-36, and per-100-possession stats from the
/// already-materialised `player_season_totals` and `team_season_totals` tables.
///
/// Must be called **after** [`crate::compute_season_rollups`] has populated the
/// totals tables for the requested `(season, source)` combination.
///
/// Execution order:
/// 1. `player_season_advanced` — TS%, eFG%, USG%
/// 2. `player_season_per_36`   — per-36-minute rates
/// 3. `player_season_per_100`  — per-100-possession rates
///
/// Returns [`ComputeError::NoSourceData`] if no `player_season_totals` rows
/// exist for the requested `(season, source)` combination.
///
/// # Errors
///
/// Returns [`ComputeError::NoSourceData`] when no rollup rows exist.
/// Returns [`ComputeError::Db`] on database errors.
pub fn compute_advanced_stats(
    db: &Db,
    season: Season,
    source: &str,
) -> Result<AdvancedStatsSummary, ComputeError> {
    let season_id = season.to_string();
    let repo = db.advanced_stats();

    let count = repo.count_player_totals_rows(&season_id, source)?;
    if count == 0 {
        return Err(ComputeError::NoSourceData {
            season: season_id,
            start_year: season.0,
            data_source: source.to_string(),
        });
    }

    let player_advanced_rows = repo.upsert_player_advanced(&season_id, source)?;
    let player_per_36_rows = repo.upsert_player_per_36(&season_id, source)?;
    let player_per_100_rows = repo.upsert_player_per_100(&season_id, source)?;

    Ok(AdvancedStatsSummary {
        player_advanced_rows,
        player_per_36_rows,
        player_per_100_rows,
    })
}
