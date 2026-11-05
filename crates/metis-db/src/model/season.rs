/// A row from the `season` dimension table.
#[derive(Debug, Clone, PartialEq)]
pub struct SeasonRow {
    /// Season label, e.g. `"2023-24"`. Matches `metis_core::Season::to_string()`.
    pub id: String,
    /// League identifier, e.g. `"NBA"`.
    pub league_id: String,
    /// First calendar year of the season, e.g. `2023`.
    pub start_year: i16,
    /// Second calendar year of the season, e.g. `2024`.
    pub end_year: i16,
}
