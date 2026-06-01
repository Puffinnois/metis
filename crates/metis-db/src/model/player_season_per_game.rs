/// A row from the `player_season_per_game` materialized table.
///
/// One row per `(player_id, season_id, season_type, source)`.
/// Stat columns hold `total / games_played`; `None` when the total was `None`.
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerSeasonPerGame {
    pub id: i64,
    pub player_id: String,
    pub season_id: String,
    pub season_type: String,
    pub source: String,
    pub games_played: i32,
    pub minutes_played: Option<f64>,
    pub points: Option<f64>,
    pub rebounds_offensive: Option<f64>,
    pub rebounds_defensive: Option<f64>,
    pub rebounds_total: Option<f64>,
    pub assists: Option<f64>,
    pub steals: Option<f64>,
    pub blocks: Option<f64>,
    pub turnovers: Option<f64>,
    pub personal_fouls: Option<f64>,
    pub field_goals_made: Option<f64>,
    pub field_goals_attempted: Option<f64>,
    pub three_pointers_made: Option<f64>,
    pub three_pointers_attempted: Option<f64>,
    pub free_throws_made: Option<f64>,
    pub free_throws_attempted: Option<f64>,
    pub computed_at: Option<String>,
}
