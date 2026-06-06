use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::player_lineup_stats::PlayerLineupStats;

const FIND_BY_ID: &str = "
    SELECT id, player_id, team_id, season_id, season_type,
           CAST(minutes_on_court        AS DOUBLE),
           possessions_on_offense, possessions_on_defense,
           points_for_on, points_against_on,
           CAST(net_rating_on           AS DOUBLE),
           CAST(minutes_off_court       AS DOUBLE),
           possessions_off_offense, possessions_off_defense,
           points_for_off, points_against_off,
           CAST(net_rating_off          AS DOUBLE),
           CAST(on_off_net_rating       AS DOUBLE),
           CAST(computed_at             AS VARCHAR)
    FROM player_lineup_stats
    WHERE id = ?
";

fn map_row(row: &duckdb::Row<'_>) -> duckdb::Result<PlayerLineupStats> {
    Ok(PlayerLineupStats {
        id: row.get(0)?,
        player_id: row.get(1)?,
        team_id: row.get(2)?,
        season_id: row.get(3)?,
        season_type: row.get(4)?,
        minutes_on_court: row.get(5)?,
        possessions_on_offense: row.get(6)?,
        possessions_on_defense: row.get(7)?,
        points_for_on: row.get(8)?,
        points_against_on: row.get(9)?,
        net_rating_on: row.get(10)?,
        minutes_off_court: row.get(11)?,
        possessions_off_offense: row.get(12)?,
        possessions_off_defense: row.get(13)?,
        points_for_off: row.get(14)?,
        points_against_off: row.get(15)?,
        net_rating_off: row.get(16)?,
        on_off_net_rating: row.get(17)?,
        computed_at: row.get(18)?,
    })
}

pub(crate) fn find_by_id(conn: &Connection, id: i64) -> Result<Option<PlayerLineupStats>> {
    match conn.query_row(FIND_BY_ID, params![id], map_row) {
        Ok(r) => Ok(Some(r)),
        Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub(crate) fn find_by_player_season(
    conn: &Connection,
    player_id: &str,
    season_id: &str,
    season_type: &str,
) -> Result<Vec<PlayerLineupStats>> {
    let mut stmt = conn.prepare(
        "SELECT id, player_id, team_id, season_id, season_type,
                CAST(minutes_on_court        AS DOUBLE),
                possessions_on_offense, possessions_on_defense,
                points_for_on, points_against_on,
                CAST(net_rating_on           AS DOUBLE),
                CAST(minutes_off_court       AS DOUBLE),
                possessions_off_offense, possessions_off_defense,
                points_for_off, points_against_off,
                CAST(net_rating_off          AS DOUBLE),
                CAST(on_off_net_rating       AS DOUBLE),
                CAST(computed_at             AS VARCHAR)
         FROM player_lineup_stats
         WHERE player_id = ? AND season_id = ? AND season_type = ?
         ORDER BY team_id",
    )?;
    let rows = stmt.query_map(params![player_id, season_id, season_type], map_row)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

/// Computes on-off and lineup net ratings for all players in `season_id` and upserts
/// results into `player_lineup_stats`. All season types present in `lineup_stint`
/// for the given season are computed together.
///
/// Net rating formula: `(points_for − points_against) * 200 / (poss_offense + poss_defense)`
/// which is equivalent to `(pts_for − pts_against) / ((poss_off + poss_def) / 2) * 100`.
///
/// Off-court stats are derived as `team_total − on_court` per `(team_id, season_id, season_type)`.
///
/// Returns the number of rows inserted or updated.
///
/// `season_id` is embedded directly into the SQL; single quotes are escaped to prevent injection.
#[allow(clippy::too_many_lines)]
pub(crate) fn compute_for_season(conn: &Connection, season_id: &str) -> Result<u64> {
    let safe = season_id.replace('\'', "''");
    let sql = format!(
        "INSERT INTO player_lineup_stats (
            player_id, team_id, season_id, season_type,
            minutes_on_court,
            possessions_on_offense, possessions_on_defense,
            points_for_on, points_against_on, net_rating_on,
            minutes_off_court,
            possessions_off_offense, possessions_off_defense,
            points_for_off, points_against_off, net_rating_off,
            on_off_net_rating
        )
        WITH player_stints AS (
            SELECT player1_id AS player_id, team_id, season_id, season_type,
                   duration_seconds, possessions_offense, possessions_defense,
                   points_for, points_against
            FROM lineup_stint
            WHERE player1_id IS NOT NULL AND season_id = '{safe}'
            UNION ALL
            SELECT player2_id, team_id, season_id, season_type,
                   duration_seconds, possessions_offense, possessions_defense,
                   points_for, points_against
            FROM lineup_stint
            WHERE player2_id IS NOT NULL AND season_id = '{safe}'
            UNION ALL
            SELECT player3_id, team_id, season_id, season_type,
                   duration_seconds, possessions_offense, possessions_defense,
                   points_for, points_against
            FROM lineup_stint
            WHERE player3_id IS NOT NULL AND season_id = '{safe}'
            UNION ALL
            SELECT player4_id, team_id, season_id, season_type,
                   duration_seconds, possessions_offense, possessions_defense,
                   points_for, points_against
            FROM lineup_stint
            WHERE player4_id IS NOT NULL AND season_id = '{safe}'
            UNION ALL
            SELECT player5_id, team_id, season_id, season_type,
                   duration_seconds, possessions_offense, possessions_defense,
                   points_for, points_against
            FROM lineup_stint
            WHERE player5_id IS NOT NULL AND season_id = '{safe}'
        ),
        on_court AS (
            SELECT
                player_id,
                team_id,
                season_id,
                season_type,
                SUM(duration_seconds) / 60.0             AS minutes_on_court,
                CAST(SUM(possessions_offense) AS INTEGER) AS possessions_on_offense,
                CAST(SUM(possessions_defense) AS INTEGER) AS possessions_on_defense,
                CAST(SUM(points_for)          AS INTEGER) AS points_for_on,
                CAST(SUM(points_against)      AS INTEGER) AS points_against_on
            FROM player_stints
            GROUP BY player_id, team_id, season_id, season_type
        ),
        team_totals AS (
            SELECT
                team_id,
                season_id,
                season_type,
                SUM(duration_seconds) / 60.0             AS minutes_total,
                CAST(SUM(possessions_offense) AS INTEGER) AS possessions_offense_total,
                CAST(SUM(possessions_defense) AS INTEGER) AS possessions_defense_total,
                CAST(SUM(points_for)          AS INTEGER) AS points_for_total,
                CAST(SUM(points_against)      AS INTEGER) AS points_against_total
            FROM lineup_stint
            WHERE season_id = '{safe}'
            GROUP BY team_id, season_id, season_type
        ),
        combined AS (
            SELECT
                oc.player_id,
                oc.team_id,
                oc.season_id,
                oc.season_type,
                oc.minutes_on_court,
                oc.possessions_on_offense,
                oc.possessions_on_defense,
                oc.points_for_on,
                oc.points_against_on,
                CASE WHEN (oc.possessions_on_offense + oc.possessions_on_defense) > 0
                    THEN CAST(oc.points_for_on - oc.points_against_on AS DOUBLE)
                         / CAST(oc.possessions_on_offense + oc.possessions_on_defense AS DOUBLE)
                         * 200.0
                    ELSE NULL
                END AS net_rating_on,
                tt.minutes_total - oc.minutes_on_court                            AS minutes_off_court,
                tt.possessions_offense_total - oc.possessions_on_offense           AS possessions_off_offense,
                tt.possessions_defense_total - oc.possessions_on_defense           AS possessions_off_defense,
                tt.points_for_total  - oc.points_for_on                            AS points_for_off,
                tt.points_against_total - oc.points_against_on                     AS points_against_off,
                CASE WHEN (tt.possessions_offense_total - oc.possessions_on_offense
                         + tt.possessions_defense_total - oc.possessions_on_defense) > 0
                    THEN CAST(tt.points_for_total  - oc.points_for_on
                            - (tt.points_against_total - oc.points_against_on) AS DOUBLE)
                         / CAST(tt.possessions_offense_total - oc.possessions_on_offense
                              + tt.possessions_defense_total - oc.possessions_on_defense AS DOUBLE)
                         * 200.0
                    ELSE NULL
                END AS net_rating_off
            FROM on_court oc
            JOIN team_totals tt
              ON tt.team_id    = oc.team_id
             AND tt.season_id  = oc.season_id
             AND tt.season_type = oc.season_type
        )
        SELECT
            player_id,
            team_id,
            season_id,
            season_type,
            minutes_on_court,
            possessions_on_offense,
            possessions_on_defense,
            points_for_on,
            points_against_on,
            net_rating_on,
            minutes_off_court,
            possessions_off_offense,
            possessions_off_defense,
            points_for_off,
            points_against_off,
            net_rating_off,
            CASE WHEN net_rating_on IS NOT NULL AND net_rating_off IS NOT NULL
                THEN net_rating_on - net_rating_off
                ELSE NULL
            END AS on_off_net_rating
        FROM combined
        ON CONFLICT (player_id, team_id, season_id, season_type) DO UPDATE SET
            minutes_on_court      = excluded.minutes_on_court,
            possessions_on_offense = excluded.possessions_on_offense,
            possessions_on_defense = excluded.possessions_on_defense,
            points_for_on         = excluded.points_for_on,
            points_against_on     = excluded.points_against_on,
            net_rating_on         = excluded.net_rating_on,
            minutes_off_court     = excluded.minutes_off_court,
            possessions_off_offense = excluded.possessions_off_offense,
            possessions_off_defense = excluded.possessions_off_defense,
            points_for_off        = excluded.points_for_off,
            points_against_off    = excluded.points_against_off,
            net_rating_off        = excluded.net_rating_off,
            on_off_net_rating     = excluded.on_off_net_rating,
            computed_at           = now()"
    );
    let n = conn.execute(&sql, params![])?;
    Ok(n as u64)
}
