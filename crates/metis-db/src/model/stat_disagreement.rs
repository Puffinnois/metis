/// A row from the `stat_disagreement` table.
///
/// Records a value difference between two ingest sources for the same
/// `(player_id, season_id, season_type, stat_name)`. `source_a` and `source_b`
/// are stored in lexicographic order to avoid duplicate pairs.
#[derive(Debug, Clone, PartialEq)]
pub struct StatDisagreement {
    pub id: i64,
    pub player_id: String,
    pub season_id: String,
    pub season_type: String,
    /// Column name from `player_season_totals` (e.g. `"points"`).
    pub stat_name: String,
    /// Lexicographically smaller source name.
    pub source_a: String,
    /// Value from `source_a`; `None` when that source had no value for this stat.
    pub value_a: Option<f64>,
    /// Lexicographically larger source name.
    pub source_b: String,
    /// Value from `source_b`; `None` when that source had no value for this stat.
    pub value_b: Option<f64>,
    /// `ABS(value_a - value_b)`; `None` when either value is `None`.
    pub delta: Option<f64>,
    pub recorded_at: Option<String>,
}
