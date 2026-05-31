/// A row from the `game` dimension table.
///
/// `home_score` and `away_score` are `None` until the game is final.
#[derive(Debug, Clone, PartialEq)]
pub struct Game {
    /// Source-assigned game identifier, e.g. `"nba_stats_0022300001"`.
    pub id: String,
    pub league_id: String,
    /// Season label, e.g. `"2023-24"`. Matches `season.id`.
    pub season_id: String,
    /// One of `"Regular"`, `"Playoffs"`, `"PlayIn"`, `"AllStar"`, `"Preseason"`.
    pub season_type: String,
    /// ISO-8601 date string (`"YYYY-MM-DD"`).
    pub game_date: String,
    pub home_team_id: String,
    pub away_team_id: String,
    pub home_score: Option<i16>,
    pub away_score: Option<i16>,
    /// One of `"scheduled"`, `"live"`, `"final"`.
    pub status: String,
}
