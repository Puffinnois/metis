use std::fmt;

use serde::{Deserialize, Serialize};

/// Start year of a season. `Season(1996)` represents "1996-97".
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Season(pub u16);

impl Season {
    /// The end year of the season (start year + 1).
    #[must_use]
    pub fn end_year(self) -> u16 {
        self.0 + 1
    }
}

impl fmt::Display for Season {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}-{:02}", self.0, self.end_year() % 100)
    }
}

/// Identifies the type of games in a season segment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SeasonType {
    Regular,
    Playoffs,
    /// NBA play-in tournament (introduced 2021).
    PlayIn,
    AllStar,
    Preseason,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn season_display_standard() {
        assert_eq!(Season(1996).to_string(), "1996-97");
        assert_eq!(Season(2023).to_string(), "2023-24");
    }

    #[test]
    fn season_display_century_boundary() {
        assert_eq!(Season(1999).to_string(), "1999-00");
    }

    #[test]
    fn season_ordering() {
        assert!(Season(1996) < Season(2024));
    }

    #[test]
    fn season_type_variants_are_distinct() {
        assert_ne!(SeasonType::Regular, SeasonType::Playoffs);
        assert_ne!(SeasonType::PlayIn, SeasonType::AllStar);
    }
}
