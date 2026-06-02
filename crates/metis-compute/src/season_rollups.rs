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
/// Returns [`ComputeError::NoSourceData`] if no `player_game_box` rows exist for the
/// requested `(season, source)` combination.
///
/// # Errors
///
/// Returns [`ComputeError::NoSourceData`] when no box score rows exist.
/// Returns [`ComputeError::Db`] on database errors.
pub fn compute_season_rollups(
    db: &Db,
    season: Season,
    source: &str,
) -> Result<RollupSummary, ComputeError> {
    let season_id = season.to_string();
    let repo = db.season_rollups();

    let count = repo.count_player_box_rows(&season_id, source)?;
    if count == 0 {
        return Err(ComputeError::NoSourceData {
            season: season_id,
            start_year: season.0,
            data_source: source.to_string(),
        });
    }

    let player_rows = repo.compute_player_totals(&season_id, source)?;
    repo.compute_player_per_game(&season_id, source)?;
    let team_rows = repo.compute_team_totals(&season_id, source)?;
    repo.compute_team_per_game(&season_id, source)?;

    Ok(RollupSummary {
        player_rows,
        team_rows,
    })
}
