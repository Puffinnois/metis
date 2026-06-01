use duckdb::{params, Connection};

use crate::error::Result;

/// Inserts a season dimension row, ignoring conflicts.
///
/// `season_id` must match `metis_core::Season::to_string()` format, e.g. `"2023-24"`.
/// `end_year` is derived as `start_year + 1`.
pub(crate) fn upsert(
    conn: &Connection,
    season_id: &str,
    league_id: &str,
    start_year: i16,
) -> Result<()> {
    conn.execute(
        "INSERT INTO season (id, league_id, start_year, end_year)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING",
        params![season_id, league_id, start_year, start_year + 1],
    )?;
    Ok(())
}
