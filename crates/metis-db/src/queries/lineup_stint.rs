use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::lineup_stint::LineupStint;

const UPSERT: &str = "
    INSERT INTO lineup_stint (
        game_id, period, team_id,
        player1_id, player2_id, player3_id, player4_id, player5_id,
        lineup_id,
        start_time_remaining, end_time_remaining, duration_seconds,
        possessions_offense, possessions_defense,
        points_for, points_against, plus_minus,
        season_id, season_type,
        source, source_url, fetched_at, source_payload
    ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
    )
    ON CONFLICT (game_id, period, team_id, lineup_id, start_time_remaining, source) DO UPDATE SET
        player1_id          = excluded.player1_id,
        player2_id          = excluded.player2_id,
        player3_id          = excluded.player3_id,
        player4_id          = excluded.player4_id,
        player5_id          = excluded.player5_id,
        end_time_remaining  = excluded.end_time_remaining,
        duration_seconds    = excluded.duration_seconds,
        possessions_offense = excluded.possessions_offense,
        possessions_defense = excluded.possessions_defense,
        points_for          = excluded.points_for,
        points_against      = excluded.points_against,
        plus_minus          = excluded.plus_minus,
        season_id           = excluded.season_id,
        season_type         = excluded.season_type,
        source_url          = excluded.source_url,
        fetched_at          = excluded.fetched_at,
        source_payload      = excluded.source_payload
";

const FIND_BY_ID: &str = "
    SELECT id, game_id, period, team_id,
           player1_id, player2_id, player3_id, player4_id, player5_id,
           lineup_id,
           CAST(start_time_remaining AS DOUBLE),
           CAST(end_time_remaining   AS DOUBLE),
           CAST(duration_seconds     AS DOUBLE),
           possessions_offense, possessions_defense,
           points_for, points_against, plus_minus,
           season_id, season_type,
           source, source_url,
           CAST(fetched_at  AS VARCHAR),
           source_payload,
           CAST(ingested_at AS VARCHAR)
    FROM lineup_stint
    WHERE id = ?
";

fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<LineupStint> {
    Ok(LineupStint {
        id: row.get(0)?,
        game_id: row.get(1)?,
        period: row.get(2)?,
        team_id: row.get(3)?,
        player1_id: row.get(4)?,
        player2_id: row.get(5)?,
        player3_id: row.get(6)?,
        player4_id: row.get(7)?,
        player5_id: row.get(8)?,
        lineup_id: row.get(9)?,
        start_time_remaining: row.get(10)?,
        end_time_remaining: row.get(11)?,
        duration_seconds: row.get(12)?,
        possessions_offense: row.get(13)?,
        possessions_defense: row.get(14)?,
        points_for: row.get(15)?,
        points_against: row.get(16)?,
        plus_minus: row.get(17)?,
        season_id: row.get(18)?,
        season_type: row.get(19)?,
        source: row.get(20)?,
        source_url: row.get(21)?,
        fetched_at: row.get(22)?,
        source_payload: row.get(23)?,
        ingested_at: row.get(24)?,
    })
}

pub(crate) fn upsert(conn: &Connection, row: &LineupStint) -> Result<()> {
    conn.execute(
        UPSERT,
        params![
            row.game_id,
            row.period,
            row.team_id,
            row.player1_id,
            row.player2_id,
            row.player3_id,
            row.player4_id,
            row.player5_id,
            row.lineup_id,
            row.start_time_remaining,
            row.end_time_remaining,
            row.duration_seconds,
            row.possessions_offense,
            row.possessions_defense,
            row.points_for,
            row.points_against,
            row.plus_minus,
            row.season_id,
            row.season_type,
            row.source,
            row.source_url,
            row.fetched_at,
            row.source_payload,
        ],
    )?;
    Ok(())
}

pub(crate) fn find_by_id(conn: &Connection, id: i64) -> Result<Option<LineupStint>> {
    match conn.query_row(FIND_BY_ID, params![id], map_row) {
        Ok(r) => Ok(Some(r)),
        Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Bulk-loads all rows from Parquet files matching `glob_path` into `lineup_stint`.
///
/// Returns the number of rows inserted or updated.
///
/// `glob_path` is embedded directly into the SQL statement; single quotes in the
/// path are escaped to prevent injection.
pub(crate) fn load_from_parquet(conn: &Connection, glob_path: &str) -> Result<u64> {
    let safe = glob_path.replace('\'', "''");
    let sql = format!(
        "INSERT INTO lineup_stint (
            game_id, period, team_id,
            player1_id, player2_id, player3_id, player4_id, player5_id,
            lineup_id,
            start_time_remaining, end_time_remaining, duration_seconds,
            possessions_offense, possessions_defense,
            points_for, points_against, plus_minus,
            season_id, season_type,
            source, source_url, fetched_at, source_payload
        )
        SELECT
            game_id,
            CAST(period               AS SMALLINT),
            team_id,
            player1_id, player2_id, player3_id, player4_id, player5_id,
            lineup_id,
            CAST(start_time_remaining AS DOUBLE),
            CAST(end_time_remaining   AS DOUBLE),
            CAST(duration_seconds     AS DOUBLE),
            CAST(possessions_offense  AS SMALLINT),
            CAST(possessions_defense  AS SMALLINT),
            CAST(points_for           AS SMALLINT),
            CAST(points_against       AS SMALLINT),
            CAST(plus_minus           AS SMALLINT),
            season_id,
            season_type,
            source,
            source_url,
            CAST(fetched_at           AS TIMESTAMP),
            CAST(source_payload       AS JSON)
        FROM read_parquet('{safe}')
        ON CONFLICT (game_id, period, team_id, lineup_id, start_time_remaining, source) DO UPDATE SET
            player1_id          = excluded.player1_id,
            player2_id          = excluded.player2_id,
            player3_id          = excluded.player3_id,
            player4_id          = excluded.player4_id,
            player5_id          = excluded.player5_id,
            end_time_remaining  = excluded.end_time_remaining,
            duration_seconds    = excluded.duration_seconds,
            possessions_offense = excluded.possessions_offense,
            possessions_defense = excluded.possessions_defense,
            points_for          = excluded.points_for,
            points_against      = excluded.points_against,
            plus_minus          = excluded.plus_minus,
            season_id           = excluded.season_id,
            season_type         = excluded.season_type,
            source_url          = excluded.source_url,
            fetched_at          = excluded.fetched_at,
            source_payload      = excluded.source_payload"
    );
    let n = conn.execute(&sql, params![])?;
    Ok(n as u64)
}
