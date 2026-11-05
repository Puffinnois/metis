use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::season::SeasonRow;

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

fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<SeasonRow> {
    Ok(SeasonRow {
        id: row.get(0)?,
        league_id: row.get(1)?,
        start_year: row.get(2)?,
        end_year: row.get(3)?,
    })
}

/// Returns all seasons, optionally filtered by `league_id`, ordered by `start_year`.
pub(crate) fn list(conn: &Connection, league_id: Option<&str>) -> Result<Vec<SeasonRow>> {
    if let Some(lid) = league_id {
        let mut stmt = conn.prepare(
            "SELECT id, league_id, start_year, end_year
             FROM season
             WHERE league_id = ?
             ORDER BY start_year DESC, id",
        )?;
        let rows = stmt.query_map(params![lid], map_row)?;
        rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, league_id, start_year, end_year
             FROM season
             ORDER BY start_year DESC, id",
        )?;
        let rows = stmt.query_map([], map_row)?;
        rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
    }
}
