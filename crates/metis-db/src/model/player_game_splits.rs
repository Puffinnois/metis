/// A row from the `player_game_splits` compute-output table.
///
/// One row per `(player_id, game_id, split_type)`. Populated by the game-splits
/// compute pass; not written by the ingest pipeline.
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerGameSplits {
    /// Surrogate BIGINT PK assigned by the DB sequence.
    pub id: i64,
    pub player_id: String,
    pub game_id: String,
    pub season_id: String,
    pub season_type: String,
    /// One of `"clutch"`, `"quarter_1"`, `"quarter_2"`, `"quarter_3"`,
    /// `"quarter_4"`, `"quarter_OT"`, or `"garbage_time"`.
    pub split_type: String,
    pub possessions_offense: i32,
    pub possessions_defense: i32,
    pub points_for: i32,
    pub points_against: i32,
    /// Sum of `duration_seconds` for matching stints divided by 60.
    pub minutes_played: Option<f64>,
    pub computed_at: String,
}
