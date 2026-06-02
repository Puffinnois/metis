use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::player_season_canonical::PlayerSeasonCanonical;
use crate::model::player_season_totals::PlayerSeasonTotals;
use crate::model::stat_disagreement::StatDisagreement;

// ── Pre-flight ────────────────────────────────────────────────────────────────

pub(crate) fn count_season_totals_rows(conn: &Connection, season_id: &str) -> Result<u64> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM player_season_totals WHERE season_id = ?",
        params![season_id],
        |row| row.get(0),
    )?;
    Ok(n as u64)
}

pub(crate) fn list_distinct_sources(conn: &Connection, season_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT source FROM player_season_totals WHERE season_id = ? ORDER BY source",
    )?;
    let rows = stmt.query_map(params![season_id], |row| row.get(0))?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

// ── Read player_season_totals (local copy — keeps reconcile queries self-contained) ──

const LIST_TOTALS_FOR_SOURCE: &str = "
    SELECT id, player_id, season_id, season_type, source, games_played,
           CAST(minutes_played AS DOUBLE),
           points, rebounds_offensive, rebounds_defensive, rebounds_total,
           assists, steals, blocks, turnovers, personal_fouls,
           field_goals_made, field_goals_attempted,
           three_pointers_made, three_pointers_attempted,
           free_throws_made, free_throws_attempted,
           CAST(computed_at AS VARCHAR)
    FROM player_season_totals
    WHERE season_id = ? AND source = ?
    ORDER BY player_id, season_type
";

fn map_player_totals(row: &duckdb::Row<'_>) -> duckdb::Result<PlayerSeasonTotals> {
    Ok(PlayerSeasonTotals {
        id: row.get(0)?,
        player_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        source: row.get(4)?,
        games_played: row.get(5)?,
        minutes_played: row.get(6)?,
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
        computed_at: row.get(22)?,
    })
}

pub(crate) fn list_totals_for_source(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<PlayerSeasonTotals>> {
    let mut stmt = conn.prepare(LIST_TOTALS_FOR_SOURCE)?;
    let rows = stmt.query_map(params![season_id, source], map_player_totals)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

// ── Canonical upsert ──────────────────────────────────────────────────────────

const UPSERT_CANONICAL: &str = "
    INSERT INTO player_season_canonical (
        player_id, season_id, season_type, primary_source, games_played,
        minutes_played, points, rebounds_offensive, rebounds_defensive,
        rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted
    )
    SELECT
        player_id, season_id, season_type, source, games_played,
        minutes_played, points, rebounds_offensive, rebounds_defensive,
        rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted
    FROM player_season_totals
    WHERE season_id = ? AND source = ?
    ON CONFLICT (player_id, season_id, season_type) DO UPDATE SET
        primary_source           = excluded.primary_source,
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
        computed_at              = now()
";

pub(crate) fn upsert_canonical(
    conn: &Connection,
    season_id: &str,
    primary_source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_CANONICAL, params![season_id, primary_source])?;
    Ok(n as u64)
}

// ── Disagreement insert ───────────────────────────────────────────────────────

const INSERT_DISAGREEMENT: &str = "
    INSERT INTO stat_disagreement
        (player_id, season_id, season_type, stat_name, source_a, value_a, source_b, value_b, delta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player_id, season_id, season_type, stat_name, source_a, source_b) DO UPDATE SET
        value_a     = excluded.value_a,
        value_b     = excluded.value_b,
        delta       = excluded.delta,
        recorded_at = now()
";

pub(crate) fn insert_disagreement(conn: &Connection, d: &StatDisagreement) -> Result<()> {
    conn.execute(
        INSERT_DISAGREEMENT,
        params![
            d.player_id,
            d.season_id,
            d.season_type,
            d.stat_name,
            d.source_a,
            d.value_a,
            d.source_b,
            d.value_b,
            d.delta,
        ],
    )?;
    Ok(())
}

// ── Read-back (for tests) ─────────────────────────────────────────────────────

const LIST_CANONICAL: &str = "
    SELECT id, player_id, season_id, season_type, primary_source, games_played,
           CAST(minutes_played AS DOUBLE),
           points, rebounds_offensive, rebounds_defensive, rebounds_total,
           assists, steals, blocks, turnovers, personal_fouls,
           field_goals_made, field_goals_attempted,
           three_pointers_made, three_pointers_attempted,
           free_throws_made, free_throws_attempted,
           CAST(computed_at AS VARCHAR)
    FROM player_season_canonical
    WHERE season_id = ?
    ORDER BY player_id, season_type
";

fn map_canonical(row: &duckdb::Row<'_>) -> duckdb::Result<PlayerSeasonCanonical> {
    Ok(PlayerSeasonCanonical {
        id: row.get(0)?,
        player_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        primary_source: row.get(4)?,
        games_played: row.get(5)?,
        minutes_played: row.get(6)?,
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
        computed_at: row.get(22)?,
    })
}

pub(crate) fn list_canonical(
    conn: &Connection,
    season_id: &str,
) -> Result<Vec<PlayerSeasonCanonical>> {
    let mut stmt = conn.prepare(LIST_CANONICAL)?;
    let rows = stmt.query_map(params![season_id], map_canonical)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

const LIST_DISAGREEMENTS: &str = "
    SELECT id, player_id, season_id, season_type, stat_name,
           source_a, value_a, source_b, value_b, delta,
           CAST(recorded_at AS VARCHAR)
    FROM stat_disagreement
    WHERE season_id = ?
    ORDER BY player_id, season_type, stat_name
";

fn map_disagreement(row: &duckdb::Row<'_>) -> duckdb::Result<StatDisagreement> {
    Ok(StatDisagreement {
        id: row.get(0)?,
        player_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        stat_name: row.get(4)?,
        source_a: row.get(5)?,
        value_a: row.get(6)?,
        source_b: row.get(7)?,
        value_b: row.get(8)?,
        delta: row.get(9)?,
        recorded_at: row.get(10)?,
    })
}

pub(crate) fn list_disagreements(
    conn: &Connection,
    season_id: &str,
) -> Result<Vec<StatDisagreement>> {
    let mut stmt = conn.prepare(LIST_DISAGREEMENTS)?;
    let rows = stmt.query_map(params![season_id], map_disagreement)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}
