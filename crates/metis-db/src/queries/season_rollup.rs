use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::player_season_per_game::PlayerSeasonPerGame;
use crate::model::player_season_totals::PlayerSeasonTotals;
use crate::model::team_season_per_game::TeamSeasonPerGame;
use crate::model::team_season_totals::TeamSeasonTotals;

// ── Player ───────────────────────────────────────────────────────────────────

pub(crate) fn count_player_box_rows(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM player_game_box WHERE season_id = ? AND source = ?",
        params![season_id, source],
        |row| row.get(0),
    )?;
    Ok(n as u64)
}

const UPSERT_PLAYER_TOTALS: &str = "
    INSERT INTO player_season_totals (
        player_id, season_id, season_type, source, games_played,
        minutes_played, points, rebounds_offensive, rebounds_defensive,
        rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted
    )
    SELECT
        player_id,
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
        SUM(free_throws_attempted)            AS free_throws_attempted
    FROM player_game_box
    WHERE season_id = ? AND source = ?
    GROUP BY player_id, season_id, season_type, source
    ON CONFLICT (player_id, season_id, season_type, source) DO UPDATE SET
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

pub(crate) fn upsert_player_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_PLAYER_TOTALS, params![season_id, source])?;
    Ok(n as u64)
}

const UPSERT_PLAYER_PER_GAME: &str = "
    INSERT INTO player_season_per_game (
        player_id, season_id, season_type, source, games_played,
        minutes_played, points, rebounds_offensive, rebounds_defensive,
        rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted
    )
    SELECT
        player_id,
        season_id,
        season_type,
        source,
        games_played,
        CAST(minutes_played           AS DECIMAL(6,2)) / games_played,
        CAST(points                   AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_offensive       AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_defensive       AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_total           AS DECIMAL(6,2)) / games_played,
        CAST(assists                  AS DECIMAL(6,2)) / games_played,
        CAST(steals                   AS DECIMAL(6,2)) / games_played,
        CAST(blocks                   AS DECIMAL(6,2)) / games_played,
        CAST(turnovers                AS DECIMAL(6,2)) / games_played,
        CAST(personal_fouls           AS DECIMAL(6,2)) / games_played,
        CAST(field_goals_made         AS DECIMAL(6,2)) / games_played,
        CAST(field_goals_attempted    AS DECIMAL(6,2)) / games_played,
        CAST(three_pointers_made      AS DECIMAL(6,2)) / games_played,
        CAST(three_pointers_attempted AS DECIMAL(6,2)) / games_played,
        CAST(free_throws_made         AS DECIMAL(6,2)) / games_played,
        CAST(free_throws_attempted    AS DECIMAL(6,2)) / games_played
    FROM player_season_totals
    WHERE season_id = ? AND source = ?
    ON CONFLICT (player_id, season_id, season_type, source) DO UPDATE SET
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

pub(crate) fn upsert_player_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_PLAYER_PER_GAME, params![season_id, source])?;
    Ok(n as u64)
}

const LIST_PLAYER_TOTALS: &str = "
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

pub(crate) fn list_player_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<PlayerSeasonTotals>> {
    let mut stmt = conn.prepare(LIST_PLAYER_TOTALS)?;
    let rows = stmt.query_map(params![season_id, source], map_player_totals)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

const LIST_PLAYER_PER_GAME: &str = "
    SELECT id, player_id, season_id, season_type, source, games_played,
           CAST(minutes_played AS DOUBLE),
           CAST(points AS DOUBLE),
           CAST(rebounds_offensive AS DOUBLE),
           CAST(rebounds_defensive AS DOUBLE),
           CAST(rebounds_total AS DOUBLE),
           CAST(assists AS DOUBLE),
           CAST(steals AS DOUBLE),
           CAST(blocks AS DOUBLE),
           CAST(turnovers AS DOUBLE),
           CAST(personal_fouls AS DOUBLE),
           CAST(field_goals_made AS DOUBLE),
           CAST(field_goals_attempted AS DOUBLE),
           CAST(three_pointers_made AS DOUBLE),
           CAST(three_pointers_attempted AS DOUBLE),
           CAST(free_throws_made AS DOUBLE),
           CAST(free_throws_attempted AS DOUBLE),
           CAST(computed_at AS VARCHAR)
    FROM player_season_per_game
    WHERE season_id = ? AND source = ?
    ORDER BY player_id, season_type
";

fn map_player_per_game(row: &duckdb::Row<'_>) -> duckdb::Result<PlayerSeasonPerGame> {
    Ok(PlayerSeasonPerGame {
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

pub(crate) fn list_player_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<PlayerSeasonPerGame>> {
    let mut stmt = conn.prepare(LIST_PLAYER_PER_GAME)?;
    let rows = stmt.query_map(params![season_id, source], map_player_per_game)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

// ── Team ──────────────────────────────────────────────────────────────────────

const UPSERT_TEAM_TOTALS: &str = "
    INSERT INTO team_season_totals (
        team_id, season_id, season_type, source, games_played,
        points, rebounds_offensive, rebounds_defensive, rebounds_total,
        assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted,
        fast_break_points, points_in_paint, second_chance_points, bench_points
    )
    SELECT
        team_id,
        season_id,
        season_type,
        source,
        COUNT(DISTINCT game_id)               AS games_played,
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
        SUM(free_throws_attempted)            AS free_throws_attempted,
        SUM(fast_break_points)                AS fast_break_points,
        SUM(points_in_paint)                  AS points_in_paint,
        SUM(second_chance_points)             AS second_chance_points,
        SUM(bench_points)                     AS bench_points
    FROM team_game_box
    WHERE season_id = ? AND source = ?
    GROUP BY team_id, season_id, season_type, source
    ON CONFLICT (team_id, season_id, season_type, source) DO UPDATE SET
        games_played             = excluded.games_played,
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
        computed_at              = now()
";

pub(crate) fn upsert_team_totals(conn: &Connection, season_id: &str, source: &str) -> Result<u64> {
    let n = conn.execute(UPSERT_TEAM_TOTALS, params![season_id, source])?;
    Ok(n as u64)
}

const UPSERT_TEAM_PER_GAME: &str = "
    INSERT INTO team_season_per_game (
        team_id, season_id, season_type, source, games_played,
        points, rebounds_offensive, rebounds_defensive, rebounds_total,
        assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted,
        fast_break_points, points_in_paint, second_chance_points, bench_points
    )
    SELECT
        team_id,
        season_id,
        season_type,
        source,
        games_played,
        CAST(points                   AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_offensive       AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_defensive       AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_total           AS DECIMAL(6,2)) / games_played,
        CAST(assists                  AS DECIMAL(6,2)) / games_played,
        CAST(steals                   AS DECIMAL(6,2)) / games_played,
        CAST(blocks                   AS DECIMAL(6,2)) / games_played,
        CAST(turnovers                AS DECIMAL(6,2)) / games_played,
        CAST(personal_fouls           AS DECIMAL(6,2)) / games_played,
        CAST(field_goals_made         AS DECIMAL(6,2)) / games_played,
        CAST(field_goals_attempted    AS DECIMAL(6,2)) / games_played,
        CAST(three_pointers_made      AS DECIMAL(6,2)) / games_played,
        CAST(three_pointers_attempted AS DECIMAL(6,2)) / games_played,
        CAST(free_throws_made         AS DECIMAL(6,2)) / games_played,
        CAST(free_throws_attempted    AS DECIMAL(6,2)) / games_played,
        CAST(fast_break_points        AS DECIMAL(6,2)) / games_played,
        CAST(points_in_paint          AS DECIMAL(6,2)) / games_played,
        CAST(second_chance_points     AS DECIMAL(6,2)) / games_played,
        CAST(bench_points             AS DECIMAL(6,2)) / games_played
    FROM team_season_totals
    WHERE season_id = ? AND source = ?
    ON CONFLICT (team_id, season_id, season_type, source) DO UPDATE SET
        games_played             = excluded.games_played,
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
        computed_at              = now()
";

pub(crate) fn upsert_team_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_TEAM_PER_GAME, params![season_id, source])?;
    Ok(n as u64)
}

const LIST_TEAM_TOTALS: &str = "
    SELECT id, team_id, season_id, season_type, source, games_played,
           points, rebounds_offensive, rebounds_defensive, rebounds_total,
           assists, steals, blocks, turnovers, personal_fouls,
           field_goals_made, field_goals_attempted,
           three_pointers_made, three_pointers_attempted,
           free_throws_made, free_throws_attempted,
           fast_break_points, points_in_paint, second_chance_points, bench_points,
           CAST(computed_at AS VARCHAR)
    FROM team_season_totals
    WHERE season_id = ? AND source = ?
    ORDER BY team_id, season_type
";

fn map_team_totals(row: &duckdb::Row<'_>) -> duckdb::Result<TeamSeasonTotals> {
    Ok(TeamSeasonTotals {
        id: row.get(0)?,
        team_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        source: row.get(4)?,
        games_played: row.get(5)?,
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
        fast_break_points: row.get(21)?,
        points_in_paint: row.get(22)?,
        second_chance_points: row.get(23)?,
        bench_points: row.get(24)?,
        computed_at: row.get(25)?,
    })
}

pub(crate) fn list_team_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<TeamSeasonTotals>> {
    let mut stmt = conn.prepare(LIST_TEAM_TOTALS)?;
    let rows = stmt.query_map(params![season_id, source], map_team_totals)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

const LIST_TEAM_PER_GAME: &str = "
    SELECT id, team_id, season_id, season_type, source, games_played,
           CAST(points AS DOUBLE),
           CAST(rebounds_offensive AS DOUBLE),
           CAST(rebounds_defensive AS DOUBLE),
           CAST(rebounds_total AS DOUBLE),
           CAST(assists AS DOUBLE),
           CAST(steals AS DOUBLE),
           CAST(blocks AS DOUBLE),
           CAST(turnovers AS DOUBLE),
           CAST(personal_fouls AS DOUBLE),
           CAST(field_goals_made AS DOUBLE),
           CAST(field_goals_attempted AS DOUBLE),
           CAST(three_pointers_made AS DOUBLE),
           CAST(three_pointers_attempted AS DOUBLE),
           CAST(free_throws_made AS DOUBLE),
           CAST(free_throws_attempted AS DOUBLE),
           CAST(fast_break_points AS DOUBLE),
           CAST(points_in_paint AS DOUBLE),
           CAST(second_chance_points AS DOUBLE),
           CAST(bench_points AS DOUBLE),
           CAST(computed_at AS VARCHAR)
    FROM team_season_per_game
    WHERE season_id = ? AND source = ?
    ORDER BY team_id, season_type
";

fn map_team_per_game(row: &duckdb::Row<'_>) -> duckdb::Result<TeamSeasonPerGame> {
    Ok(TeamSeasonPerGame {
        id: row.get(0)?,
        team_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        source: row.get(4)?,
        games_played: row.get(5)?,
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
        fast_break_points: row.get(21)?,
        points_in_paint: row.get(22)?,
        second_chance_points: row.get(23)?,
        bench_points: row.get(24)?,
        computed_at: row.get(25)?,
    })
}

pub(crate) fn list_team_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<TeamSeasonPerGame>> {
    let mut stmt = conn.prepare(LIST_TEAM_PER_GAME)?;
    let rows = stmt.query_map(params![season_id, source], map_team_per_game)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}
