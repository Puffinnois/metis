use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::player_game_splits::PlayerGameSplits;

const FIND_BY_ID: &str = "
    SELECT id, player_id, game_id, season_id, season_type, split_type,
           possessions_offense, possessions_defense,
           points_for, points_against,
           CAST(minutes_played AS DOUBLE),
           CAST(computed_at AS VARCHAR)
    FROM player_game_splits
    WHERE id = ?
";

fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<PlayerGameSplits> {
    Ok(PlayerGameSplits {
        id: row.get(0)?,
        player_id: row.get(1)?,
        game_id: row.get(2)?,
        season_id: row.get(3)?,
        season_type: row.get(4)?,
        split_type: row.get(5)?,
        possessions_offense: row.get(6)?,
        possessions_defense: row.get(7)?,
        points_for: row.get(8)?,
        points_against: row.get(9)?,
        minutes_played: row.get(10)?,
        computed_at: row.get(11)?,
    })
}

pub(crate) fn find_by_id(conn: &Connection, id: i64) -> Result<Option<PlayerGameSplits>> {
    match conn.query_row(FIND_BY_ID, params![id], map_row) {
        Ok(r) => Ok(Some(r)),
        Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub(crate) fn find_by_player_game(
    conn: &Connection,
    player_id: &str,
    game_id: &str,
) -> Result<Vec<PlayerGameSplits>> {
    let mut stmt = conn.prepare(
        "SELECT id, player_id, game_id, season_id, season_type, split_type,
                possessions_offense, possessions_defense,
                points_for, points_against,
                CAST(minutes_played AS DOUBLE),
                CAST(computed_at AS VARCHAR)
         FROM player_game_splits
         WHERE player_id = ? AND game_id = ?
         ORDER BY split_type",
    )?;
    let rows = stmt.query_map(params![player_id, game_id], map_row)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

/// Computes clutch, by-quarter, and garbage-time splits for all players in
/// `season_id` and upserts results into `player_game_splits`.
///
/// Reads from `possession` (filtered by split conditions) joined to
/// `lineup_stint` to expand lineups to individual players.
///
/// Returns the number of rows inserted or updated.
///
/// `season_id` is embedded directly into the SQL; single quotes are escaped to
/// prevent injection.
#[allow(clippy::too_many_lines)]
pub(crate) fn compute_for_season(conn: &Connection, season_id: &str) -> Result<u64> {
    let safe = season_id.replace('\'', "''");
    let sql = format!(
        "INSERT INTO player_game_splits (
            player_id, game_id, season_id, season_type, split_type,
            possessions_offense, possessions_defense,
            points_for, points_against, minutes_played
        )
        WITH filtered_possessions AS (
            -- clutch: Q4/OT, margin ≤5, ≤5 min left
            SELECT p.game_id, p.period, p.season_id, p.season_type,
                   p.offense_lineup_id, p.defense_lineup_id,
                   p.points_scored, p.score_margin, p.start_time_remaining,
                   'clutch' AS split_type
            FROM possession p
            WHERE p.season_id = '{safe}'
              AND p.period >= 4
              AND ABS(p.score_margin) <= 5
              AND p.start_time_remaining <= 300
            UNION ALL
            -- by quarter (Q1–Q4 + OT)
            SELECT p.game_id, p.period, p.season_id, p.season_type,
                   p.offense_lineup_id, p.defense_lineup_id,
                   p.points_scored, p.score_margin, p.start_time_remaining,
                   CASE WHEN p.period >= 5 THEN 'quarter_OT'
                        ELSE 'quarter_' || CAST(p.period AS TEXT)
                   END AS split_type
            FROM possession p
            WHERE p.season_id = '{safe}'
            UNION ALL
            -- garbage time: ≤2 min left, margin ≥20
            SELECT p.game_id, p.period, p.season_id, p.season_type,
                   p.offense_lineup_id, p.defense_lineup_id,
                   p.points_scored, p.score_margin, p.start_time_remaining,
                   'garbage_time' AS split_type
            FROM possession p
            WHERE p.season_id = '{safe}'
              AND p.start_time_remaining <= 120
              AND ABS(p.score_margin) >= 20
        ),
        player_stints AS (
            SELECT fp.split_type, fp.game_id, fp.season_id, fp.season_type,
                   ls.player1_id AS player_id,
                   ls.duration_seconds,
                   ls.possessions_offense,
                   ls.possessions_defense,
                   CASE WHEN ls.lineup_id = fp.offense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_for,
                   CASE WHEN ls.lineup_id = fp.defense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_against
            FROM filtered_possessions fp
            JOIN lineup_stint ls
              ON ls.game_id  = fp.game_id
             AND ls.period   = fp.period
             AND (ls.lineup_id = fp.offense_lineup_id OR ls.lineup_id = fp.defense_lineup_id)
            WHERE ls.player1_id IS NOT NULL
            UNION ALL
            SELECT fp.split_type, fp.game_id, fp.season_id, fp.season_type,
                   ls.player2_id AS player_id,
                   ls.duration_seconds,
                   ls.possessions_offense,
                   ls.possessions_defense,
                   CASE WHEN ls.lineup_id = fp.offense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_for,
                   CASE WHEN ls.lineup_id = fp.defense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_against
            FROM filtered_possessions fp
            JOIN lineup_stint ls
              ON ls.game_id  = fp.game_id
             AND ls.period   = fp.period
             AND (ls.lineup_id = fp.offense_lineup_id OR ls.lineup_id = fp.defense_lineup_id)
            WHERE ls.player2_id IS NOT NULL
            UNION ALL
            SELECT fp.split_type, fp.game_id, fp.season_id, fp.season_type,
                   ls.player3_id AS player_id,
                   ls.duration_seconds,
                   ls.possessions_offense,
                   ls.possessions_defense,
                   CASE WHEN ls.lineup_id = fp.offense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_for,
                   CASE WHEN ls.lineup_id = fp.defense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_against
            FROM filtered_possessions fp
            JOIN lineup_stint ls
              ON ls.game_id  = fp.game_id
             AND ls.period   = fp.period
             AND (ls.lineup_id = fp.offense_lineup_id OR ls.lineup_id = fp.defense_lineup_id)
            WHERE ls.player3_id IS NOT NULL
            UNION ALL
            SELECT fp.split_type, fp.game_id, fp.season_id, fp.season_type,
                   ls.player4_id AS player_id,
                   ls.duration_seconds,
                   ls.possessions_offense,
                   ls.possessions_defense,
                   CASE WHEN ls.lineup_id = fp.offense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_for,
                   CASE WHEN ls.lineup_id = fp.defense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_against
            FROM filtered_possessions fp
            JOIN lineup_stint ls
              ON ls.game_id  = fp.game_id
             AND ls.period   = fp.period
             AND (ls.lineup_id = fp.offense_lineup_id OR ls.lineup_id = fp.defense_lineup_id)
            WHERE ls.player4_id IS NOT NULL
            UNION ALL
            SELECT fp.split_type, fp.game_id, fp.season_id, fp.season_type,
                   ls.player5_id AS player_id,
                   ls.duration_seconds,
                   ls.possessions_offense,
                   ls.possessions_defense,
                   CASE WHEN ls.lineup_id = fp.offense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_for,
                   CASE WHEN ls.lineup_id = fp.defense_lineup_id THEN CAST(fp.points_scored AS INTEGER) ELSE 0 END AS points_against
            FROM filtered_possessions fp
            JOIN lineup_stint ls
              ON ls.game_id  = fp.game_id
             AND ls.period   = fp.period
             AND (ls.lineup_id = fp.offense_lineup_id OR ls.lineup_id = fp.defense_lineup_id)
            WHERE ls.player5_id IS NOT NULL
        ),
        agg AS (
            SELECT player_id, game_id, season_id, season_type, split_type,
                   CAST(SUM(possessions_offense) AS INTEGER) AS possessions_offense,
                   CAST(SUM(possessions_defense) AS INTEGER) AS possessions_defense,
                   CAST(SUM(points_for)          AS INTEGER) AS points_for,
                   CAST(SUM(points_against)      AS INTEGER) AS points_against,
                   SUM(duration_seconds) / 60.0              AS minutes_played
            FROM player_stints
            GROUP BY player_id, game_id, season_id, season_type, split_type
        )
        SELECT player_id, game_id, season_id, season_type, split_type,
               possessions_offense, possessions_defense,
               points_for, points_against, minutes_played
        FROM agg
        ON CONFLICT (player_id, game_id, split_type) DO UPDATE SET
            season_id           = excluded.season_id,
            season_type         = excluded.season_type,
            possessions_offense = excluded.possessions_offense,
            possessions_defense = excluded.possessions_defense,
            points_for          = excluded.points_for,
            points_against      = excluded.points_against,
            minutes_played      = excluded.minutes_played,
            computed_at         = now()"
    );
    let n = conn.execute(&sql, params![])?;
    Ok(n as u64)
}
