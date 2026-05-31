use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::team_game_box::TeamGameBox;

const UPSERT: &str = "
    INSERT INTO team_game_box (
        game_id, team_id, opponent_team_id, season_id, season_type, is_home,
        points, rebounds_offensive, rebounds_defensive, rebounds_total,
        assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted,
        fast_break_points, points_in_paint, second_chance_points, bench_points,
        source, source_url, fetched_at, source_payload
    ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
    )
    ON CONFLICT (game_id, team_id, source) DO UPDATE SET
        opponent_team_id         = excluded.opponent_team_id,
        season_id                = excluded.season_id,
        season_type              = excluded.season_type,
        is_home                  = excluded.is_home,
        points                   = excluded.points,
        rebounds_offensive       = excluded.rebounds_offensive,
        rebounds_defensive       = excluded.rebounds_defensive,
        rebounds_total           = excluded.rebounds_total,
        assists                  = excluded.assists,
        steals                   = excluded.steals,
        blocks                   = excluded.blocks,
        turnovers                = excluded.turnovers,
        personal_fouls           = excluded.personal_fouls,
        field_goals_made         = excluded.field_goals_made,
        field_goals_attempted    = excluded.field_goals_attempted,
        three_pointers_made      = excluded.three_pointers_made,
        three_pointers_attempted = excluded.three_pointers_attempted,
        free_throws_made         = excluded.free_throws_made,
        free_throws_attempted    = excluded.free_throws_attempted,
        fast_break_points        = excluded.fast_break_points,
        points_in_paint          = excluded.points_in_paint,
        second_chance_points     = excluded.second_chance_points,
        bench_points             = excluded.bench_points,
        source_url               = excluded.source_url,
        fetched_at               = excluded.fetched_at,
        source_payload           = excluded.source_payload
";

const FIND_BY_ID: &str = "
    SELECT id, game_id, team_id, opponent_team_id, season_id, season_type, is_home,
           points, rebounds_offensive, rebounds_defensive, rebounds_total,
           assists, steals, blocks, turnovers, personal_fouls,
           field_goals_made, field_goals_attempted,
           three_pointers_made, three_pointers_attempted,
           free_throws_made, free_throws_attempted,
           fast_break_points, points_in_paint, second_chance_points, bench_points,
           source, source_url,
           CAST(fetched_at AS VARCHAR), source_payload,
           CAST(ingested_at AS VARCHAR)
    FROM team_game_box
    WHERE id = ?
";

const FIND_BY_GAME: &str = "
    SELECT id, game_id, team_id, opponent_team_id, season_id, season_type, is_home,
           points, rebounds_offensive, rebounds_defensive, rebounds_total,
           assists, steals, blocks, turnovers, personal_fouls,
           field_goals_made, field_goals_attempted,
           three_pointers_made, three_pointers_attempted,
           free_throws_made, free_throws_attempted,
           fast_break_points, points_in_paint, second_chance_points, bench_points,
           source, source_url,
           CAST(fetched_at AS VARCHAR), source_payload,
           CAST(ingested_at AS VARCHAR)
    FROM team_game_box
    WHERE game_id = ?
    ORDER BY team_id, source
";

const SCAN_BY_SEASON: &str = "
    SELECT id, game_id, team_id, opponent_team_id, season_id, season_type, is_home,
           points, rebounds_offensive, rebounds_defensive, rebounds_total,
           assists, steals, blocks, turnovers, personal_fouls,
           field_goals_made, field_goals_attempted,
           three_pointers_made, three_pointers_attempted,
           free_throws_made, free_throws_attempted,
           fast_break_points, points_in_paint, second_chance_points, bench_points,
           source, source_url,
           CAST(fetched_at AS VARCHAR), source_payload,
           CAST(ingested_at AS VARCHAR)
    FROM team_game_box
    WHERE season_id = ?
    ORDER BY game_id, team_id, source
";

#[allow(clippy::too_many_lines)]
fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<TeamGameBox> {
    Ok(TeamGameBox {
        id: row.get(0)?,
        game_id: row.get(1)?,
        team_id: row.get(2)?,
        opponent_team_id: row.get(3)?,
        season_id: row.get(4)?,
        season_type: row.get(5)?,
        is_home: row.get(6)?,
        points: row.get(7)?,
        rebounds_offensive: row.get(8)?,
        rebounds_defensive: row.get(9)?,
        rebounds_total: row.get(10)?,
        assists: row.get(11)?,
        steals: row.get(12)?,
        blocks: row.get(13)?,
        turnovers: row.get(14)?,
        personal_fouls: row.get(15)?,
        field_goals_made: row.get(16)?,
        field_goals_attempted: row.get(17)?,
        three_pointers_made: row.get(18)?,
        three_pointers_attempted: row.get(19)?,
        free_throws_made: row.get(20)?,
        free_throws_attempted: row.get(21)?,
        fast_break_points: row.get(22)?,
        points_in_paint: row.get(23)?,
        second_chance_points: row.get(24)?,
        bench_points: row.get(25)?,
        source: row.get(26)?,
        source_url: row.get(27)?,
        fetched_at: row.get(28)?,
        source_payload: row.get(29)?,
        ingested_at: row.get(30)?,
    })
}

pub(crate) fn upsert(conn: &Connection, row: &TeamGameBox) -> Result<()> {
    conn.execute(
        UPSERT,
        params![
            row.game_id,
            row.team_id,
            row.opponent_team_id,
            row.season_id,
            row.season_type,
            row.is_home,
            row.points,
            row.rebounds_offensive,
            row.rebounds_defensive,
            row.rebounds_total,
            row.assists,
            row.steals,
            row.blocks,
            row.turnovers,
            row.personal_fouls,
            row.field_goals_made,
            row.field_goals_attempted,
            row.three_pointers_made,
            row.three_pointers_attempted,
            row.free_throws_made,
            row.free_throws_attempted,
            row.fast_break_points,
            row.points_in_paint,
            row.second_chance_points,
            row.bench_points,
            row.source,
            row.source_url,
            row.fetched_at,
            row.source_payload,
        ],
    )?;
    Ok(())
}

pub(crate) fn find_by_id(conn: &Connection, id: i64) -> Result<Option<TeamGameBox>> {
    match conn.query_row(FIND_BY_ID, params![id], map_row) {
        Ok(r) => Ok(Some(r)),
        Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub(crate) fn find_by_game(conn: &Connection, game_id: &str) -> Result<Vec<TeamGameBox>> {
    let mut stmt = conn.prepare(FIND_BY_GAME)?;
    let rows = stmt.query_map(params![game_id], map_row)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

pub(crate) fn list_by_season(conn: &Connection, season_id: &str) -> Result<Vec<TeamGameBox>> {
    let mut stmt = conn.prepare(SCAN_BY_SEASON)?;
    let rows = stmt.query_map(params![season_id], map_row)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}
