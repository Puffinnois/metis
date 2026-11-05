use duckdb::{params, Connection};

use crate::error::Result;

/// One row from `player_season_totals`, carrying all counting stats and metadata
/// needed for reconciliation.
#[derive(Debug, Clone)]
pub struct PlayerSeasonTotalsRow {
    pub player_id: String,
    pub season_id: String,
    pub season_type: String,
    pub source: String,
    pub games_played: i32,
    pub minutes_played: Option<f64>,
    pub points: Option<i32>,
    pub rebounds_offensive: Option<i32>,
    pub rebounds_defensive: Option<i32>,
    pub rebounds_total: Option<i32>,
    pub assists: Option<i32>,
    pub steals: Option<i32>,
    pub blocks: Option<i32>,
    pub turnovers: Option<i32>,
    pub personal_fouls: Option<i32>,
    pub field_goals_made: Option<i32>,
    pub field_goals_attempted: Option<i32>,
    pub three_pointers_made: Option<i32>,
    pub three_pointers_attempted: Option<i32>,
    pub free_throws_made: Option<i32>,
    pub free_throws_attempted: Option<i32>,
}

/// Load all `player_season_totals` rows for the given season (across all sources).
pub(crate) fn load_season_totals(
    conn: &Connection,
    season_id: &str,
) -> Result<Vec<PlayerSeasonTotalsRow>> {
    let mut stmt = conn.prepare(
        "SELECT player_id, season_id, season_type, source, games_played,
                minutes_played, points, rebounds_offensive, rebounds_defensive,
                rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
                field_goals_made, field_goals_attempted, three_pointers_made,
                three_pointers_attempted, free_throws_made, free_throws_attempted
         FROM player_season_totals
         WHERE season_id = ?
         ORDER BY player_id, season_type, source",
    )?;
    let rows = stmt.query_map(params![season_id], |row| {
        Ok(PlayerSeasonTotalsRow {
            player_id: row.get(0)?,
            season_id: row.get(1)?,
            season_type: row.get(2)?,
            source: row.get(3)?,
            games_played: row.get(4)?,
            minutes_played: row.get(5)?,
            points: row.get(6)?,
            rebounds_offensive: row.get(7)?,
            rebounds_defensive: row.get(8)?,
            rebounds_total: row.get(9)?,
            assists: row.get(10)?,
            steals: row.get(11)?,
            blocks: row.get(12)?,
            turnovers: row.get(13)?,
            personal_fouls: row.get(14)?,
            field_goals_made: row.get(15)?,
            field_goals_attempted: row.get(16)?,
            three_pointers_made: row.get(17)?,
            three_pointers_attempted: row.get(18)?,
            free_throws_made: row.get(19)?,
            free_throws_attempted: row.get(20)?,
        })
    })?;

    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

/// Upsert one row into `player_season_canonical`. On conflict, overwrites all
/// stat columns and updates `reconciled_at` to `now()`.
#[allow(clippy::too_many_arguments)]
pub(crate) fn upsert_canonical(
    conn: &Connection,
    row: &PlayerSeasonTotalsRow,
    canonical_source: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO player_season_canonical (
            player_id, season_id, season_type, canonical_source,
            games_played, minutes_played, points,
            rebounds_offensive, rebounds_defensive, rebounds_total,
            assists, steals, blocks, turnovers, personal_fouls,
            field_goals_made, field_goals_attempted,
            three_pointers_made, three_pointers_attempted,
            free_throws_made, free_throws_attempted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (player_id, season_id, season_type) DO UPDATE SET
            canonical_source         = excluded.canonical_source,
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
            reconciled_at            = now()",
        params![
            row.player_id,
            row.season_id,
            row.season_type,
            canonical_source,
            row.games_played,
            row.minutes_played,
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
        ],
    )?;
    Ok(())
}

/// Insert a disagreement record. Uses `ON CONFLICT DO NOTHING` so repeated
/// reconcile runs do not duplicate rows for the same stat conflict.
#[allow(clippy::too_many_arguments)]
pub(crate) fn insert_disagreement(
    conn: &Connection,
    player_id: &str,
    season_id: &str,
    season_type: &str,
    stat_name: &str,
    source_a: &str,
    value_a: Option<f64>,
    source_b: &str,
    value_b: Option<f64>,
    pct_diff: Option<f64>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO stat_disagreement
            (player_id, season_id, season_type, stat_name,
             source_a, value_a, source_b, value_b, pct_diff)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            player_id,
            season_id,
            season_type,
            stat_name,
            source_a,
            value_a,
            source_b,
            value_b,
            pct_diff,
        ],
    )?;
    Ok(())
}

/// Count rows in `player_season_canonical` for the given season.
pub(crate) fn count_canonical(conn: &Connection, season_id: &str) -> Result<u64> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM player_season_canonical WHERE season_id = ?",
        params![season_id],
        |row| row.get(0),
    )?;
    Ok(n as u64)
}

/// Count rows in `stat_disagreement` for the given season.
pub(crate) fn count_disagreements(conn: &Connection, season_id: &str) -> Result<u64> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM stat_disagreement WHERE season_id = ?",
        params![season_id],
        |row| row.get(0),
    )?;
    Ok(n as u64)
}
