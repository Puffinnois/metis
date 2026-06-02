/// A row from the `player_season_canonical` materialized table.
///
/// One row per `(player_id, season_id, season_type)`. All stat values come from
/// `primary_source`. Built by the reconciliation step.
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerSeasonCanonical {
    pub id: i64,
    pub player_id: String,
    pub season_id: String,
    pub season_type: String,
    /// The ingest source whose values populate this row.
    pub primary_source: String,
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
    pub computed_at: Option<String>,
}
