use duckdb::Connection;

use crate::error::Result;
use crate::queries;

/// Repository for the `season` dimension table.
///
/// Obtain via [`crate::Db::seasons`].
pub struct SeasonRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> SeasonRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Inserts or ignores a season row.
    ///
    /// `season_id` must match `metis_core::Season::to_string()` format, e.g. `"2023-24"`.
    /// `start_year` is the first calendar year of the season (e.g. `2023`).
    pub fn upsert(&self, season_id: &str, league_id: &str, start_year: i16) -> Result<()> {
        queries::season::upsert(self.conn, season_id, league_id, start_year)
    }
}
