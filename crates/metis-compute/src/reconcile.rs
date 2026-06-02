use metis_core::Season;
use metis_db::model::player_season_totals::PlayerSeasonTotals;
use metis_db::model::stat_disagreement::StatDisagreement;
use metis_db::Db;

use crate::error::ComputeError;

/// Summary of a completed reconciliation run.
#[derive(Debug, Clone, PartialEq)]
pub struct ReconcileSummary {
    /// Number of `player_season_canonical` rows written (inserts + updates).
    pub canonical_rows: u64,
    /// Number of `stat_disagreement` rows written across all source pairs.
    pub disagreement_rows: u64,
}

/// Reconciles `player_season_totals` for all sources into `player_season_canonical`.
///
/// Steps:
/// 1. Pre-flight: errors if no `player_season_totals` rows exist for the season.
/// 2. Writes `player_season_canonical` from `primary_source`.
/// 3. For every other source present in the season, detects stat-level
///    disagreements and logs them into `stat_disagreement`.
///
/// Idempotent: re-running produces the same row counts.
///
/// # Errors
///
/// Returns [`ComputeError::NoRollupData`] when no rollup rows exist for the season.
/// Returns [`ComputeError::Db`] on database errors.
pub fn reconcile_season(
    db: &Db,
    season: Season,
    primary_source: &str,
) -> Result<ReconcileSummary, ComputeError> {
    let season_id = season.to_string();
    let repo = db.reconcile();

    let count = repo.count_season_totals_rows(&season_id)?;
    if count == 0 {
        return Err(ComputeError::NoRollupData {
            season: season_id,
            start_year: season.0,
        });
    }

    let canonical_rows = repo.upsert_canonical(&season_id, primary_source)?;

    let sources = repo.list_distinct_sources(&season_id)?;
    let primary_rows = repo.list_totals_for_source(&season_id, primary_source)?;

    let mut disagreement_rows = 0u64;
    for other_source in sources.iter().filter(|s| s.as_str() != primary_source) {
        let other_rows = repo.list_totals_for_source(&season_id, other_source)?;
        let disagreements =
            find_disagreements(&primary_rows, primary_source, &other_rows, other_source);
        for d in &disagreements {
            repo.insert_disagreement(d)?;
        }
        disagreement_rows += disagreements.len() as u64;
    }

    Ok(ReconcileSummary {
        canonical_rows,
        disagreement_rows,
    })
}

/// Returns every stat field of `row` as `(name, value)` pairs.
fn stat_fields(row: &PlayerSeasonTotals) -> [(&'static str, Option<f64>); 17] {
    let i = |v: i32| f64::from(v);
    [
        ("games_played", Some(f64::from(row.games_played))),
        ("minutes_played", row.minutes_played),
        ("points", row.points.map(i)),
        ("rebounds_offensive", row.rebounds_offensive.map(i)),
        ("rebounds_defensive", row.rebounds_defensive.map(i)),
        ("rebounds_total", row.rebounds_total.map(i)),
        ("assists", row.assists.map(i)),
        ("steals", row.steals.map(i)),
        ("blocks", row.blocks.map(i)),
        ("turnovers", row.turnovers.map(i)),
        ("personal_fouls", row.personal_fouls.map(i)),
        ("field_goals_made", row.field_goals_made.map(i)),
        ("field_goals_attempted", row.field_goals_attempted.map(i)),
        ("three_pointers_made", row.three_pointers_made.map(i)),
        (
            "three_pointers_attempted",
            row.three_pointers_attempted.map(i),
        ),
        ("free_throws_made", row.free_throws_made.map(i)),
        ("free_throws_attempted", row.free_throws_attempted.map(i)),
    ]
}

/// Compares two slices of `PlayerSeasonTotals` (one per source) field-by-field.
///
/// Returns one `StatDisagreement` for every `(player, season_type, stat)` triple
/// where the two sources report different values (including NULL vs non-NULL).
/// Sources are stored in lexicographic order (`source_a <= source_b`).
fn find_disagreements(
    a_rows: &[PlayerSeasonTotals],
    source_a: &str,
    b_rows: &[PlayerSeasonTotals],
    source_b: &str,
) -> Vec<StatDisagreement> {
    use std::collections::HashMap;

    let b_index: HashMap<(&str, &str), &PlayerSeasonTotals> = b_rows
        .iter()
        .map(|r| (r.player_id.as_str(), r.season_type.as_str()))
        .zip(b_rows.iter())
        .collect();

    // Ensure sources are stored in lexicographic order.
    let (src_a, src_b, flip) = if source_a <= source_b {
        (source_a, source_b, false)
    } else {
        (source_b, source_a, true)
    };

    let mut out = Vec::new();

    for a in a_rows {
        let Some(b) = b_index.get(&(a.player_id.as_str(), a.season_type.as_str())) else {
            continue;
        };

        for ((stat_name, va), (_, vb)) in stat_fields(a).iter().zip(stat_fields(b)) {
            if va == &vb {
                continue;
            }
            let (value_a, value_b) = if flip { (vb, *va) } else { (*va, vb) };
            let delta = match (value_a, value_b) {
                (Some(x), Some(y)) => Some((x - y).abs()),
                _ => None,
            };
            out.push(StatDisagreement {
                id: 0,
                player_id: a.player_id.clone(),
                season_id: a.season_id.clone(),
                season_type: a.season_type.clone(),
                stat_name: stat_name.to_string(),
                source_a: src_a.to_string(),
                value_a,
                source_b: src_b.to_string(),
                value_b,
                delta,
                recorded_at: None,
            });
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use metis_db::model::player_season_totals::PlayerSeasonTotals;

    fn totals(player_id: &str, source: &str, points: i32) -> PlayerSeasonTotals {
        PlayerSeasonTotals {
            id: 0,
            player_id: player_id.to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            source: source.to_string(),
            games_played: 10,
            minutes_played: Some(300.0),
            points: Some(points),
            rebounds_offensive: Some(20),
            rebounds_defensive: Some(50),
            rebounds_total: Some(70),
            assists: Some(30),
            steals: Some(10),
            blocks: Some(5),
            turnovers: Some(20),
            personal_fouls: Some(20),
            field_goals_made: Some(40),
            field_goals_attempted: Some(100),
            three_pointers_made: Some(10),
            three_pointers_attempted: Some(30),
            free_throws_made: Some(20),
            free_throws_attempted: Some(25),
            computed_at: None,
        }
    }

    #[test]
    fn no_disagreements_when_values_identical() {
        let a = vec![totals("NBA_P001", "nba_stats", 200)];
        let b = vec![totals("NBA_P001", "bref", 200)];
        let result = find_disagreements(&a, "nba_stats", &b, "bref");
        assert!(result.is_empty());
    }

    #[test]
    fn detects_points_disagreement() {
        let a = vec![totals("NBA_P001", "nba_stats", 200)];
        let b = vec![totals("NBA_P001", "bref", 205)];
        let result = find_disagreements(&a, "nba_stats", &b, "bref");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].stat_name, "points");
        assert_eq!(result[0].source_a, "bref"); // lexicographic order
        assert_eq!(result[0].value_a, Some(205.0));
        assert_eq!(result[0].source_b, "nba_stats");
        assert_eq!(result[0].value_b, Some(200.0));
        assert_eq!(result[0].delta, Some(5.0));
    }

    #[test]
    fn sources_stored_in_lexicographic_order() {
        // source_a = "bref" < "nba_stats" = source_b regardless of argument order
        let a = vec![totals("NBA_P001", "nba_stats", 200)];
        let b = vec![totals("NBA_P001", "bref", 210)];

        let r1 = find_disagreements(&a, "nba_stats", &b, "bref");
        let r2 = find_disagreements(&b, "bref", &a, "nba_stats");

        assert_eq!(r1[0].source_a, "bref");
        assert_eq!(r1[0].source_b, "nba_stats");
        assert_eq!(r2[0].source_a, "bref");
        assert_eq!(r2[0].source_b, "nba_stats");
        // values follow the lexicographic ordering too
        assert_eq!(r1[0].value_a, Some(210.0)); // bref value
        assert_eq!(r1[0].value_b, Some(200.0)); // nba_stats value
        assert_eq!(r2[0].value_a, Some(210.0));
        assert_eq!(r2[0].value_b, Some(200.0));
    }

    #[test]
    fn skips_player_not_in_both_sources() {
        let a = vec![totals("NBA_P001", "nba_stats", 200)];
        let b = vec![totals("NBA_P002", "bref", 150)]; // different player
        let result = find_disagreements(&a, "nba_stats", &b, "bref");
        assert!(result.is_empty());
    }
}
