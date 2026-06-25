use duckdb::Connection;

use crate::error::Result;
use crate::model::player_game_log::{GameLogFilter, PlayerGameLogRow};
use crate::queries;

/// Repository for player game log queries.
///
/// Returns per-game box score rows enriched with game context (date, opponent,
/// score). Obtain via [`crate::Db::player_game_log`].
pub struct PlayerGameLogRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> PlayerGameLogRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Returns a player's game-by-game box score log, joined with game context.
    ///
    /// Ordered by `game_date DESC` (most-recent first). Paginated via
    /// [`GameLogFilter::limit`] and [`GameLogFilter::offset`].
    pub fn find_by_player(&self, filter: &GameLogFilter) -> Result<Vec<PlayerGameLogRow>> {
        queries::player_game_log::find_by_player(self.conn, filter)
    }
}
