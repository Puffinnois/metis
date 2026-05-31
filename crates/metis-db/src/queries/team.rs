use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::team::Team;

const UPSERT: &str = "
    INSERT INTO team (id, league_id, abbreviation, full_name, city)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
        abbreviation = excluded.abbreviation,
        full_name    = excluded.full_name,
        city         = excluded.city,
        updated_at   = now()
";

const FIND_BY_ID: &str = "
    SELECT id, league_id, abbreviation, full_name, city
    FROM team
    WHERE id = ?
";

fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<Team> {
    Ok(Team {
        id: row.get(0)?,
        league_id: row.get(1)?,
        abbreviation: row.get(2)?,
        full_name: row.get(3)?,
        city: row.get(4)?,
    })
}

pub(crate) fn upsert(conn: &Connection, team: &Team) -> Result<()> {
    conn.execute(
        UPSERT,
        params![
            team.id,
            team.league_id,
            team.abbreviation,
            team.full_name,
            team.city
        ],
    )?;
    Ok(())
}

pub(crate) fn find_by_id(conn: &Connection, id: &str) -> Result<Option<Team>> {
    match conn.query_row(FIND_BY_ID, params![id], map_row) {
        Ok(t) => Ok(Some(t)),
        Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}
