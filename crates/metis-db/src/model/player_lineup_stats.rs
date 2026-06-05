/// A row from the `player_lineup_stats` compute-output table.
///
/// One row per `(player_id, team_id, season_id, season_type)`. Players who changed
/// teams mid-season get one row per team. Populated by `metis-compute` (T052), not
/// the ingest pipeline. `id` is DB-assigned; set to `0` for upsert.
///
/// Net rating formula: `(points_for − points_against) / ((poss_offense + poss_defense) / 2) * 100`
/// `on_off_net_rating = net_rating_on − net_rating_off`
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerLineupStats {
    /// Surrogate BIGINT PK. Set to `0` when constructing a record for upsert.
    pub id: i64,
    pub player_id: String,
    pub team_id: String,
    pub season_id: String,
    pub season_type: String,
    // On-court aggregates
    pub minutes_on_court: Option<f64>,
    pub possessions_on_offense: Option<i32>,
    pub possessions_on_defense: Option<i32>,
    pub points_for_on: Option<i32>,
    pub points_against_on: Option<i32>,
    pub net_rating_on: Option<f64>,
    // Off-court aggregates
    pub minutes_off_court: Option<f64>,
    pub possessions_off_offense: Option<i32>,
    pub possessions_off_defense: Option<i32>,
    pub points_for_off: Option<i32>,
    pub points_against_off: Option<i32>,
    pub net_rating_off: Option<f64>,
    /// `net_rating_on − net_rating_off`. `None` when either component is `None`.
    pub on_off_net_rating: Option<f64>,
    /// ISO-8601 datetime string of when this row was (re-)computed. DB-managed.
    pub computed_at: Option<String>,
}
