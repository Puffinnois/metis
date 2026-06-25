/// A single-game entry in a player's game log.
///
/// Produced by joining `player_game_box` with `game`. One row per player × game ×
/// source (multiple sources may appear for the same game).
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerGameLogRow {
    // --- game context ---
    pub game_id: String,
    /// ISO-8601 date string, e.g. `"2024-01-15"`.
    pub game_date: String,
    pub season_id: String,
    pub season_type: String,
    pub home_team_id: String,
    pub away_team_id: String,
    /// Score of the home team at final. `None` if game not yet final.
    pub home_score: Option<i16>,
    /// Score of the away team at final. `None` if game not yet final.
    pub away_score: Option<i16>,
    // --- player context ---
    pub player_id: String,
    pub team_id: String,
    pub source: String,
    pub starter: Option<bool>,
    // --- box score stats ---
    pub minutes_played: Option<f64>,
    pub points: Option<i16>,
    pub rebounds_offensive: Option<i16>,
    pub rebounds_defensive: Option<i16>,
    pub rebounds_total: Option<i16>,
    pub assists: Option<i16>,
    pub steals: Option<i16>,
    pub blocks: Option<i16>,
    pub turnovers: Option<i16>,
    pub personal_fouls: Option<i16>,
    pub field_goals_made: Option<i16>,
    pub field_goals_attempted: Option<i16>,
    pub three_pointers_made: Option<i16>,
    pub three_pointers_attempted: Option<i16>,
    pub free_throws_made: Option<i16>,
    pub free_throws_attempted: Option<i16>,
    pub plus_minus: Option<i16>,
}

/// Filter parameters for the player game log query.
#[derive(Debug, Clone, Default)]
pub struct GameLogFilter {
    /// Required: the player to retrieve the log for.
    pub player_id: String,
    /// Optional season label, e.g. `"2023-24"`. `None` returns all seasons.
    pub season_id: Option<String>,
    /// Optional season type filter, e.g. `"Regular"`. `None` returns all types.
    pub season_type: Option<String>,
    /// Ingest source to read from. Defaults to `"nba_stats"`.
    pub source: String,
    /// Maximum number of rows to return (default: 100).
    pub limit: u32,
    /// Zero-based offset for pagination (default: 0).
    pub offset: u32,
}

impl GameLogFilter {
    pub fn for_player(player_id: impl Into<String>) -> Self {
        Self {
            player_id: player_id.into(),
            source: "nba_stats".to_string(),
            limit: 100,
            ..Default::default()
        }
    }
}
