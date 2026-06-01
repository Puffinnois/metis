/// A row from the `team_season_totals` materialized table.
///
/// One row per `(team_id, season_id, season_type, source)`.
#[derive(Debug, Clone, PartialEq)]
pub struct TeamSeasonTotals {
    pub id: i64,
    pub team_id: String,
    pub season_id: String,
    pub season_type: String,
    pub source: String,
    pub games_played: i32,
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
    pub fast_break_points: Option<i32>,
    pub points_in_paint: Option<i32>,
    pub second_chance_points: Option<i32>,
    pub bench_points: Option<i32>,
    pub computed_at: Option<String>,
}
