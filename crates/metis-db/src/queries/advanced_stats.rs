use duckdb::{params, Connection};

use crate::error::Result;

// ── player_season_advanced ────────────────────────────────────────────────────

/// Computes TS%, eFG%, and USG% for every player in `player_season_totals` for
/// the given season+source, joining to `team_season_totals` through
/// `player_game_box` (which carries `team_id`).
///
/// The team join uses a lateral subquery to find the most-common team_id for each
/// player-season (handles mid-season trades by picking the team with the most
/// games). All three rates are guarded with `NULLIF` to avoid division by zero.
const UPSERT_PLAYER_ADVANCED: &str = "
    INSERT INTO player_season_advanced (
        player_id, season_id, season_type, source,
        true_shooting_pct, effective_fg_pct, usage_rate
    )
    SELECT
        p.player_id,
        p.season_id,
        p.season_type,
        p.source,
        -- TS%: PTS / (2 × (FGA + 0.44 × FTA))
        CAST(p.points AS DOUBLE) / NULLIF(
            2.0 * (CAST(p.field_goals_attempted AS DOUBLE) + 0.44 * CAST(p.free_throws_attempted AS DOUBLE)),
            0
        ),
        -- eFG%: (FGM + 0.5 × 3PM) / FGA
        (CAST(p.field_goals_made AS DOUBLE) + 0.5 * CAST(p.three_pointers_made AS DOUBLE))
            / NULLIF(CAST(p.field_goals_attempted AS DOUBLE), 0),
        -- USG%: 100 × (FGA + 0.44×FTA + TOV) × (TmMP/5) / (MP × (TmFGA + 0.44×TmFTA + TmTOV))
        -- TmMP = team.games_played × 240 (5 players × 48 min per NBA game)
        100.0
            * (CAST(p.field_goals_attempted AS DOUBLE) + 0.44 * CAST(p.free_throws_attempted AS DOUBLE) + CAST(p.turnovers AS DOUBLE))
            * (CAST(t.games_played AS DOUBLE) * 240.0 / 5.0)
            / NULLIF(
                CAST(p.minutes_played AS DOUBLE)
                * (CAST(t.field_goals_attempted AS DOUBLE) + 0.44 * CAST(t.free_throws_attempted AS DOUBLE) + CAST(t.turnovers AS DOUBLE)),
                0
            )
    FROM player_season_totals p
    -- Determine the player's primary team for this season+type: pick the team_id
    -- appearing in the most player_game_box rows.
    JOIN (
        SELECT
            player_id,
            season_id,
            season_type,
            source,
            team_id
        FROM (
            SELECT
                player_id,
                season_id,
                season_type,
                source,
                team_id,
                ROW_NUMBER() OVER (
                    PARTITION BY player_id, season_id, season_type, source
                    ORDER BY COUNT(*) DESC
                ) AS rn
            FROM player_game_box
            WHERE season_id = ? AND source = ?
            GROUP BY player_id, season_id, season_type, source, team_id
        ) ranked
        WHERE rn = 1
    ) pg ON pg.player_id  = p.player_id
        AND pg.season_id  = p.season_id
        AND pg.season_type = p.season_type
        AND pg.source     = p.source
    JOIN team_season_totals t
        ON  t.team_id    = pg.team_id
        AND t.season_id  = p.season_id
        AND t.season_type = p.season_type
        AND t.source     = p.source
    WHERE p.season_id = ? AND p.source = ?
    ON CONFLICT (player_id, season_id, season_type, source) DO UPDATE SET
        true_shooting_pct = excluded.true_shooting_pct,
        effective_fg_pct  = excluded.effective_fg_pct,
        usage_rate        = excluded.usage_rate,
        computed_at       = now()
";

/// Upserts TS%, eFG%, USG% rows into `player_season_advanced`.
/// Returns the number of rows inserted or updated.
pub(crate) fn upsert_player_advanced(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    // The query uses `?` twice for season_id and source (once for the subquery,
    // once for the outer WHERE).
    let n = conn.execute(
        UPSERT_PLAYER_ADVANCED,
        params![season_id, source, season_id, source],
    )?;
    Ok(n as u64)
}

// ── player_season_per_36 ──────────────────────────────────────────────────────

/// Computes per-36-minute rates for every counting stat in `player_season_totals`.
/// `NULLIF(minutes_played, 0)` guards against division by zero.
const UPSERT_PLAYER_PER_36: &str = "
    INSERT INTO player_season_per_36 (
        player_id, season_id, season_type, source, games_played,
        minutes_played,
        points, rebounds_offensive, rebounds_defensive, rebounds_total,
        assists, steals, blocks, turnovers, personal_fouls,
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
        -- minutes_played column stores the per-36 denominator reference (raw minutes)
        CAST(minutes_played AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(points                   AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(rebounds_offensive       AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(rebounds_defensive       AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(rebounds_total           AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(assists                  AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(steals                   AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(blocks                   AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(turnovers                AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(personal_fouls           AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(field_goals_made         AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(field_goals_attempted    AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(three_pointers_made      AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(three_pointers_attempted AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(free_throws_made         AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0),
        CAST(free_throws_attempted    AS DOUBLE) * 36.0 / NULLIF(CAST(minutes_played AS DOUBLE), 0)
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

/// Upserts per-36-minute rows into `player_season_per_36`.
/// Returns the number of rows inserted or updated.
pub(crate) fn upsert_player_per_36(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_PLAYER_PER_36, params![season_id, source])?;
    Ok(n as u64)
}

// ── player_season_per_100 ─────────────────────────────────────────────────────

/// Computes per-100-possession rates.
///
/// Estimated possessions = `FGA + 0.44×FTA + TOV − ORB`.
/// `NULLIF` guards the denominator so rows with zero possessions store `NULL`.
const UPSERT_PLAYER_PER_100: &str = "
    INSERT INTO player_season_per_100 (
        player_id, season_id, season_type, source, games_played,
        minutes_played,
        points, rebounds_offensive, rebounds_defensive, rebounds_total,
        assists, steals, blocks, turnovers, personal_fouls,
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
        CAST(minutes_played           AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(points                   AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(rebounds_offensive       AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(rebounds_defensive       AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(rebounds_total           AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(assists                  AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(steals                   AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(blocks                   AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(turnovers                AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(personal_fouls           AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(field_goals_made         AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(field_goals_attempted    AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(three_pointers_made      AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(three_pointers_attempted AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(free_throws_made         AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        ),
        CAST(free_throws_attempted    AS DOUBLE) * 100.0 / NULLIF(
            CAST(field_goals_attempted AS DOUBLE)
            + 0.44 * CAST(free_throws_attempted AS DOUBLE)
            + CAST(turnovers AS DOUBLE)
            - CAST(COALESCE(rebounds_offensive, 0) AS DOUBLE),
            0
        )
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

/// Upserts per-100-possession rows into `player_season_per_100`.
/// Returns the number of rows inserted or updated.
pub(crate) fn upsert_player_per_100(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_PLAYER_PER_100, params![season_id, source])?;
    Ok(n as u64)
}

/// Returns the number of `player_season_totals` rows for the given season+source.
pub(crate) fn count_player_totals_rows(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM player_season_totals WHERE season_id = ? AND source = ?",
        params![season_id, source],
        |row| row.get(0),
    )?;
    Ok(n as u64)
}
