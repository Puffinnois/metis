use duckdb::{Connection, Row};

use crate::error::Result;
use crate::model::player_game_log::{GameLogFilter, PlayerGameLogRow};

fn map_row(row: &Row<'_>) -> duckdb::Result<PlayerGameLogRow> {
    Ok(PlayerGameLogRow {
        game_id: row.get(0)?,
        game_date: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        home_team_id: row.get(4)?,
        away_team_id: row.get(5)?,
        home_score: row.get(6)?,
        away_score: row.get(7)?,
        player_id: row.get(8)?,
        team_id: row.get(9)?,
        source: row.get(10)?,
        starter: row.get(11)?,
        minutes_played: row.get(12)?,
        points: row.get(13)?,
        rebounds_offensive: row.get(14)?,
        rebounds_defensive: row.get(15)?,
        rebounds_total: row.get(16)?,
        assists: row.get(17)?,
        steals: row.get(18)?,
        blocks: row.get(19)?,
        turnovers: row.get(20)?,
        personal_fouls: row.get(21)?,
        field_goals_made: row.get(22)?,
        field_goals_attempted: row.get(23)?,
        three_pointers_made: row.get(24)?,
        three_pointers_attempted: row.get(25)?,
        free_throws_made: row.get(26)?,
        free_throws_attempted: row.get(27)?,
        plus_minus: row.get(28)?,
    })
}

/// Returns a player's game-by-game box score log, joined with game context.
///
/// Results are ordered by `game_date DESC` (most recent first).
pub(crate) fn find_by_player(conn: &Connection, filter: &GameLogFilter) -> Result<Vec<PlayerGameLogRow>> {
    let mut conditions = vec![
        "pgb.player_id = ?".to_string(),
        "pgb.source = ?".to_string(),
    ];
    let mut params: Vec<Box<dyn duckdb::ToSql>> = vec![
        Box::new(filter.player_id.clone()),
        Box::new(filter.source.clone()),
    ];

    if let Some(ref sid) = filter.season_id {
        conditions.push("pgb.season_id = ?".to_string());
        params.push(Box::new(sid.clone()));
    }
    if let Some(ref st) = filter.season_type {
        conditions.push("pgb.season_type = ?".to_string());
        params.push(Box::new(st.clone()));
    }

    let where_clause = format!("WHERE {}", conditions.join(" AND "));
    let sql = format!(
        "SELECT
            g.id              AS game_id,
            CAST(g.game_date AS VARCHAR) AS game_date,
            pgb.season_id,
            pgb.season_type,
            g.home_team_id,
            g.away_team_id,
            g.home_score,
            g.away_score,
            pgb.player_id,
            pgb.team_id,
            pgb.source,
            pgb.starter,
            CAST(pgb.minutes_played AS DOUBLE),
            pgb.points,
            pgb.rebounds_offensive,
            pgb.rebounds_defensive,
            pgb.rebounds_total,
            pgb.assists,
            pgb.steals,
            pgb.blocks,
            pgb.turnovers,
            pgb.personal_fouls,
            pgb.field_goals_made,
            pgb.field_goals_attempted,
            pgb.three_pointers_made,
            pgb.three_pointers_attempted,
            pgb.free_throws_made,
            pgb.free_throws_attempted,
            pgb.plus_minus
         FROM player_game_box pgb
         JOIN game g ON g.id = pgb.game_id
         {where_clause}
         ORDER BY g.game_date DESC, g.id
         LIMIT ? OFFSET ?"
    );

    params.push(Box::new(filter.limit));
    params.push(Box::new(filter.offset));

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn duckdb::ToSql> = params.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), map_row)?;
    Ok(rows.collect::<duckdb::Result<Vec<_>>>()?)
}
