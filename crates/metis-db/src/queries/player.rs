use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::player::Player;

const UPSERT: &str = "
    INSERT INTO player (id, league_id, first_name, last_name, birth_date)
    VALUES (?, ?, ?, ?, CAST(? AS DATE))
    ON CONFLICT (id) DO UPDATE SET
        first_name = excluded.first_name,
        last_name  = excluded.last_name,
        birth_date = excluded.birth_date,
        updated_at = now()
";

const FIND_BY_ID: &str = "
    SELECT id, league_id, first_name, last_name, CAST(birth_date AS VARCHAR)
    FROM player
    WHERE id = ?
";

const LIST_ALL: &str = "
    SELECT id, league_id, first_name, last_name, CAST(birth_date AS VARCHAR)
    FROM player
    ORDER BY last_name, first_name, id
";

const LIST_BY_LEAGUE: &str = "
    SELECT id, league_id, first_name, last_name, CAST(birth_date AS VARCHAR)
    FROM player
    WHERE league_id = ?
    ORDER BY last_name, first_name, id
";

fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<Player> {
    Ok(Player {
        id: row.get(0)?,
        league_id: row.get(1)?,
        first_name: row.get(2)?,
        last_name: row.get(3)?,
        birth_date: row.get(4)?,
    })
}

pub(crate) fn upsert(conn: &Connection, player: &Player) -> Result<()> {
    conn.execute(
        UPSERT,
        params![
            player.id,
            player.league_id,
            player.first_name,
            player.last_name,
            player.birth_date,
        ],
    )?;
    Ok(())
}

pub(crate) fn find_by_id(conn: &Connection, id: &str) -> Result<Option<Player>> {
    match conn.query_row(FIND_BY_ID, params![id], map_row) {
        Ok(p) => Ok(Some(p)),
        Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Returns all players, optionally filtered by `league_id`.
pub(crate) fn list(conn: &Connection, league_id: Option<&str>) -> Result<Vec<Player>> {
    if let Some(lid) = league_id {
        let mut stmt = conn.prepare(LIST_BY_LEAGUE)?;
        let rows = stmt.query_map(params![lid], map_row)?;
        rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
    } else {
        let mut stmt = conn.prepare(LIST_ALL)?;
        let rows = stmt.query_map([], map_row)?;
        rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
    }
}

/// Returns players whose full name (`first_name || ' ' || last_name`) contains `search`
/// (case-insensitive), optionally further filtered by `league_id`.
pub(crate) fn search(
    conn: &Connection,
    search: &str,
    league_id: Option<&str>,
) -> Result<Vec<Player>> {
    let pattern = format!("%{search}%");
    let sql = if league_id.is_some() {
        "SELECT id, league_id, first_name, last_name, CAST(birth_date AS VARCHAR)
         FROM player
         WHERE league_id = ?
           AND (lower(first_name || ' ' || last_name) LIKE lower(?))
         ORDER BY last_name, first_name, id"
    } else {
        "SELECT id, league_id, first_name, last_name, CAST(birth_date AS VARCHAR)
         FROM player
         WHERE lower(first_name || ' ' || last_name) LIKE lower(?)
         ORDER BY last_name, first_name, id"
    };
    if let Some(lid) = league_id {
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params![lid, pattern], map_row)?;
        rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
    } else {
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params![pattern], map_row)?;
        rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
    }
}
