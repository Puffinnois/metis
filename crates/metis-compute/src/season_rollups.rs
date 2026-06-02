use metis_core::Season;
use metis_db::Db;

use crate::error::ComputeError;

/// Summary of a completed rollup run.
#[derive(Debug, Clone, PartialEq)]
pub struct RollupSummary {
    /// Number of `player_season_totals` rows written (inserts + updates).
    pub player_rows: u64,
    /// Number of `team_season_totals` rows written (inserts + updates).
    pub team_rows: u64,
}

/// Computes season rollups for all players and teams from the given source.
///
/// Execution order: player totals → player per-game → team totals → team per-game.
///
/// # Errors
///
/// Returns `ComputeError::NoSourceData` if no `player_game_box` rows exist for the
/// requested `(season, source)` combination. Returns `ComputeError::Db` if a database
/// operation fails.
pub fn compute_season_rollups(
    _db: &Db,
    _season: Season,
    _source: &str,
) -> Result<RollupSummary, ComputeError> {
    todo!("implemented in Task 6")
}
