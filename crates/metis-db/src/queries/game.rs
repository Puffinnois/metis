use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::game::Game;

const UPSERT: &str = "
    INSERT INTO game
        (id, league_id, season_id, season_type, game_date,
         home_team_id, away_team_id, home_score, away_score, status)
    VALUES (?, ?, ?, ?, CAST(? AS DATE), ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
        season_type  = excluded.season_type,
        game_date    = excluded.game_date,
        home_score   = excluded.home_score,
        away_score   = excluded.away_score,
        status       = excluded.status,
        updated_at   = now()
";

const FIND_BY_ID: &str = "
    SELECT id, league_id, season_id, season_type,
           CAST(game_date AS VARCHAR),
           home_team_id, away_team_id, home_score, away_score, status
    FROM game
    WHERE id = ?
";

const LIST_BY_SEASON: &str = "
    SELECT id, league_id, season_id, season_type,
           CAST(game_date AS VARCHAR),
           home_team_id, away_team_id, home_score, away_score, status
    FROM game
    WHERE season_id = ?
    ORDER BY game_date, id
";

fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<Game> {
    Ok(Game {
        id: row.get(0)?,
        league_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        game_date: row.get(4)?,
        home_team_id: row.get(5)?,
        away_team_id: row.get(6)?,
        home_score: row.get(7)?,
        away_score: row.get(8)?,
        status: row.get(9)?,
    })
}

pub(crate) fn upsert(conn: &Connection, game: &Game) -> Result<()> {
    conn.execute(
        UPSERT,
        params![
            game.id,
            game.league_id,
            game.season_id,
            game.season_type,
            game.game_date,
            game.home_team_id,
            game.away_team_id,
            game.home_score,
            game.away_score,
            game.status,
        ],
    )?;
    Ok(())
}

pub(crate) fn find_by_id(conn: &Connection, id: &str) -> Result<Option<Game>> {
    match conn.query_row(FIND_BY_ID, params![id], map_row) {
        Ok(g) => Ok(Some(g)),
        Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub(crate) fn list_by_season(conn: &Connection, season_id: &str) -> Result<Vec<Game>> {
    let mut stmt = conn.prepare(LIST_BY_SEASON)?;
    let rows = stmt.query_map(params![season_id], map_row)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}
