use duckdb::Connection;
use metis_core::Season;

use crate::error::Result;
use crate::model::player_game_splits::PlayerGameSplits;
use crate::queries;

/// Repository for the `player_game_splits` compute-output table.
///
/// Obtain via [`crate::Db::player_game_splits`].
///
/// Uniqueness is per `(player_id, game_id, split_type)`. Populated by
/// [`compute_for_season`][Self::compute_for_season], not the ingest pipeline.
pub struct PlayerGameSplitsRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> PlayerGameSplitsRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Returns the row with the given surrogate `id`, or `None` if not found.
    pub fn find_by_id(&self, id: i64) -> Result<Option<PlayerGameSplits>> {
        queries::player_game_splits::find_by_id(self.conn, id)
    }

    /// Returns all split rows for a player in the given game, ordered by split type.
    pub fn find_by_player_game(
        &self,
        player_id: &str,
        game_id: &str,
    ) -> Result<Vec<PlayerGameSplits>> {
        queries::player_game_splits::find_by_player_game(self.conn, player_id, game_id)
    }

    /// Computes clutch, by-quarter, and garbage-time splits for all players in
    /// `season` from `possession` + `lineup_stint` data and upserts the results
    /// into `player_game_splits`.
    ///
    /// Running this multiple times is safe — subsequent calls overwrite the
    /// previous compute output.
    ///
    /// Returns the number of rows inserted or updated.
    pub fn compute_for_season(&self, season: Season) -> Result<u64> {
        queries::player_game_splits::compute_for_season(self.conn, &season.to_string())
    }
}
