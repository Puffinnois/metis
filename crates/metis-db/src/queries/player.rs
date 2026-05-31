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
