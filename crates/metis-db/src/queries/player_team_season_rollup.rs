//! Queries for computing and listing `player_team_season_totals` (T062).
//!
//! One row per `(player_id, team_id, season_id, season_type, source)`.
//! Aggregated directly from `player_game_box`.

use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::player_team_season_totals::PlayerTeamSeasonTotals;

// ── Upsert ───────────────────────────────────────────────────────────────────

const UPSERT_COLS: &str = "
    player_id, team_id, season_id, season_type, source, games_played,
    minutes_played, points, rebounds_offensive, rebounds_defensive,
    rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
    field_goals_made, field_goals_attempted,
    three_pointers_made, three_pointers_attempted,
    free_throws_made, free_throws_attempted";

const SELECT_AGGS: &str = "
        player_id,
        team_id,
        season_id,
        season_type,
        source,
        COUNT(DISTINCT game_id)               AS games_played,
        SUM(minutes_played)                   AS minutes_played,
        SUM(points)                           AS points,
        SUM(rebounds_offensive)               AS rebounds_offensive,
        SUM(rebounds_defensive)               AS rebounds_defensive,
        SUM(rebounds_total)                   AS rebounds_total,
        SUM(assists)                          AS assists,
        SUM(steals)                           AS steals,
        SUM(blocks)                           AS blocks,
        SUM(turnovers)                        AS turnovers,
        SUM(personal_fouls)                   AS personal_fouls,
        SUM(field_goals_made)                 AS field_goals_made,
        SUM(field_goals_attempted)            AS field_goals_attempted,
        SUM(three_pointers_made)              AS three_pointers_made,
        SUM(three_pointers_attempted)         AS three_pointers_attempted,
        SUM(free_throws_made)                 AS free_throws_made,
        SUM(free_throws_attempted)            AS free_throws_attempted";

const ON_CONFLICT: &str = "
    ON CONFLICT (player_id, team_id, season_id, season_type, source) DO UPDATE SET
        games_played             = excluded.games_played,
        minutes_played           = excluded.minutes_played,
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
        computed_at              = now()";

/// Aggregates `player_game_box` into `player_team_season_totals` for a specific
/// `(season_id, source)` pair. Returns the number of rows inserted or updated.
pub(crate) fn upsert_player_team_totals_for_season(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let sql = format!(
        "INSERT INTO player_team_season_totals ({UPSERT_COLS})
         SELECT {SELECT_AGGS}
         FROM player_game_box
         WHERE season_id = ? AND source = ?
         GROUP BY player_id, team_id, season_id, season_type, source
         {ON_CONFLICT}"
    );
    let n = conn.execute(&sql, params![season_id, source])?;
    Ok(n as u64)
}

/// Aggregates `player_game_box` into `player_team_season_totals` for **all**
/// seasons for the given `source`. Returns the number of rows inserted or updated.
pub(crate) fn upsert_player_team_totals_all_seasons(
    conn: &Connection,
    source: &str,
) -> Result<u64> {
    let sql = format!(
        "INSERT INTO player_team_season_totals ({UPSERT_COLS})
         SELECT {SELECT_AGGS}
         FROM player_game_box
         WHERE source = ?
         GROUP BY player_id, team_id, season_id, season_type, source
         {ON_CONFLICT}"
    );
    let n = conn.execute(&sql, params![source])?;
    Ok(n as u64)
}

// ── List (for tests and debugging) ───────────────────────────────────────────

/// Returns all `player_team_season_totals` rows for the given `(season_id, source)`.
pub(crate) fn list_player_team_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<PlayerTeamSeasonTotals>> {
    let mut stmt = conn.prepare(
        "SELECT id, player_id, team_id, season_id, season_type, source, games_played,
                minutes_played, points, rebounds_offensive, rebounds_defensive,
                rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
                field_goals_made, field_goals_attempted,
                three_pointers_made, three_pointers_attempted,
                free_throws_made, free_throws_attempted,
                CAST(computed_at AS TEXT)
         FROM player_team_season_totals
         WHERE season_id = ? AND source = ?
         ORDER BY player_id, team_id",
    )?;
    let rows = stmt.query_map(params![season_id, source], |row| {
        Ok(PlayerTeamSeasonTotals {
            id: row.get(0)?,
            player_id: row.get(1)?,
            team_id: row.get(2)?,
            season_id: row.get(3)?,
            season_type: row.get(4)?,
            source: row.get(5)?,
            games_played: row.get(6)?,
            minutes_played: row.get(7)?,
            points: row.get(8)?,
            rebounds_offensive: row.get(9)?,
            rebounds_defensive: row.get(10)?,
            rebounds_total: row.get(11)?,
            assists: row.get(12)?,
            steals: row.get(13)?,
            blocks: row.get(14)?,
            turnovers: row.get(15)?,
            personal_fouls: row.get(16)?,
            field_goals_made: row.get(17)?,
            field_goals_attempted: row.get(18)?,
            three_pointers_made: row.get(19)?,
            three_pointers_attempted: row.get(20)?,
            free_throws_made: row.get(21)?,
            free_throws_attempted: row.get(22)?,
            computed_at: row.get(23)?,
        })
    })?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}
