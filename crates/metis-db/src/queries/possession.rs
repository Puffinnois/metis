use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::possession::Possession;

const UPSERT: &str = "
    INSERT INTO possession (
        game_id, period, possession_num, global_possession_num,
        offense_team_id, defense_team_id,
        start_time_remaining, end_time_remaining, duration_seconds,
        score_margin, possession_start_type, points_scored,
        offense_lineup_id, defense_lineup_id, num_events,
        season_id, season_type,
        source, source_url, fetched_at, source_payload
    ) VALUES (
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?
    )
    ON CONFLICT (game_id, period, possession_num, source) DO UPDATE SET
        global_possession_num  = excluded.global_possession_num,
        offense_team_id        = excluded.offense_team_id,
        defense_team_id        = excluded.defense_team_id,
        start_time_remaining   = excluded.start_time_remaining,
        end_time_remaining     = excluded.end_time_remaining,
        duration_seconds       = excluded.duration_seconds,
        score_margin           = excluded.score_margin,
        possession_start_type  = excluded.possession_start_type,
        points_scored          = excluded.points_scored,
        offense_lineup_id      = excluded.offense_lineup_id,
        defense_lineup_id      = excluded.defense_lineup_id,
        num_events             = excluded.num_events,
        season_id              = excluded.season_id,
        season_type            = excluded.season_type,
        source_url             = excluded.source_url,
        fetched_at             = excluded.fetched_at,
        source_payload         = excluded.source_payload
";

const FIND_BY_ID: &str = "
    SELECT id, game_id, period, possession_num, global_possession_num,
           offense_team_id, defense_team_id,
           CAST(start_time_remaining AS DOUBLE),
           CAST(end_time_remaining   AS DOUBLE),
           CAST(duration_seconds     AS DOUBLE),
           score_margin, possession_start_type, points_scored,
           offense_lineup_id, defense_lineup_id, num_events,
           season_id, season_type,
           source, source_url,
           CAST(fetched_at   AS VARCHAR),
           source_payload,
           CAST(ingested_at  AS VARCHAR)
    FROM possession
    WHERE id = ?
";

fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<Possession> {
    Ok(Possession {
        id: row.get(0)?,
        game_id: row.get(1)?,
        period: row.get(2)?,
        possession_num: row.get(3)?,
        global_possession_num: row.get(4)?,
        offense_team_id: row.get(5)?,
        defense_team_id: row.get(6)?,
        start_time_remaining: row.get(7)?,
        end_time_remaining: row.get(8)?,
        duration_seconds: row.get(9)?,
        score_margin: row.get(10)?,
        possession_start_type: row.get(11)?,
        points_scored: row.get(12)?,
        offense_lineup_id: row.get(13)?,
        defense_lineup_id: row.get(14)?,
        num_events: row.get(15)?,
        season_id: row.get(16)?,
        season_type: row.get(17)?,
        source: row.get(18)?,
        source_url: row.get(19)?,
        fetched_at: row.get(20)?,
        source_payload: row.get(21)?,
        ingested_at: row.get(22)?,
    })
}

pub(crate) fn upsert(conn: &Connection, row: &Possession) -> Result<()> {
    conn.execute(
        UPSERT,
        params![
            row.game_id,
            row.period,
            row.possession_num,
            row.global_possession_num,
            row.offense_team_id,
            row.defense_team_id,
            row.start_time_remaining,
            row.end_time_remaining,
            row.duration_seconds,
            row.score_margin,
            row.possession_start_type,
            row.points_scored,
            row.offense_lineup_id,
            row.defense_lineup_id,
            row.num_events,
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

pub(crate) fn find_by_id(conn: &Connection, id: i64) -> Result<Option<Possession>> {
    match conn.query_row(FIND_BY_ID, params![id], map_row) {
        Ok(r) => Ok(Some(r)),
        Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Bulk-loads all rows from Parquet files matching `glob_path` into `possession`.
///
/// Returns the number of rows inserted or updated.
///
/// `glob_path` is embedded directly into the SQL statement; single quotes in the
/// path are escaped to prevent injection.
pub(crate) fn load_from_parquet(conn: &Connection, glob_path: &str) -> Result<u64> {
    let safe = glob_path.replace('\'', "''");
    let sql = format!(
        "INSERT INTO possession (
            game_id, period, possession_num, global_possession_num,
            offense_team_id, defense_team_id,
            start_time_remaining, end_time_remaining, duration_seconds,
            score_margin, possession_start_type, points_scored,
            offense_lineup_id, defense_lineup_id, num_events,
            season_id, season_type,
            source, source_url, fetched_at, source_payload
        )
        SELECT
            game_id,
            CAST(period                 AS SMALLINT),
            CAST(possession_num         AS SMALLINT),
            CAST(global_possession_num  AS INTEGER),
            offense_team_id,
            defense_team_id,
            CAST(start_time_remaining   AS DOUBLE),
            CAST(end_time_remaining     AS DOUBLE),
            CAST(duration_seconds       AS DOUBLE),
            CAST(score_margin           AS SMALLINT),
            possession_start_type,
            CAST(points_scored          AS SMALLINT),
            offense_lineup_id,
            defense_lineup_id,
            CAST(num_events             AS SMALLINT),
            season_id,
            season_type,
            source,
            source_url,
            CAST(fetched_at             AS TIMESTAMP),
            CAST(source_payload         AS JSON)
        FROM read_parquet('{safe}')
        ON CONFLICT (game_id, period, possession_num, source) DO UPDATE SET
            global_possession_num  = excluded.global_possession_num,
            offense_team_id        = excluded.offense_team_id,
            defense_team_id        = excluded.defense_team_id,
            start_time_remaining   = excluded.start_time_remaining,
            end_time_remaining     = excluded.end_time_remaining,
            duration_seconds       = excluded.duration_seconds,
            score_margin           = excluded.score_margin,
            possession_start_type  = excluded.possession_start_type,
            points_scored          = excluded.points_scored,
            offense_lineup_id      = excluded.offense_lineup_id,
            defense_lineup_id      = excluded.defense_lineup_id,
            num_events             = excluded.num_events,
            season_id              = excluded.season_id,
            season_type            = excluded.season_type,
            source_url             = excluded.source_url,
            fetched_at             = excluded.fetched_at,
            source_payload         = excluded.source_payload"
    );
    let n = conn.execute(&sql, params![])?;
    Ok(n as u64)
}
