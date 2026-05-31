/// A row from the `team` dimension table.
#[derive(Debug, Clone, PartialEq)]
pub struct Team {
    /// Composite key: `{LEAGUE}_{abbreviation}`, e.g. `"NBA_BOS"`.
    pub id: String,
    /// League identifier, e.g. `"NBA"`.
    pub league_id: String,
    /// Short code used in box scores, e.g. `"BOS"`.
    pub abbreviation: String,
    pub full_name: String,
    pub city: String,
}
