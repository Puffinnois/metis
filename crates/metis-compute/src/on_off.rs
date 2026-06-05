use metis_core::Season;
use metis_db::{Db, Result};

/// Computes on-off and lineup net ratings for all players in `season` and upserts
/// the results into `player_lineup_stats`.
///
/// Reads from `lineup_stint` (all sources). All season types present for the given
/// season are computed in one pass. Running this multiple times is safe — subsequent
/// calls overwrite the previous compute output.
///
/// Returns the number of `player_lineup_stats` rows inserted or updated.
///
/// # Errors
///
/// Returns [`metis_db::DbError`] if the database query fails.
pub fn compute_lineup_stats(db: &Db, season: Season) -> Result<u64> {
    db.player_lineup_stats().compute_for_season(season)
}
