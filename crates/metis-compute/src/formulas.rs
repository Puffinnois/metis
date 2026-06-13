//! Pure, stateless formula functions for traditional advanced basketball statistics.
//!
//! All functions accept `f64` inputs and return `Option<f64>`. `None` is returned
//! whenever a denominator is zero or the result would be undefined. Callers are
//! responsible for converting integer/nullable DB values to `f64` before calling
//! these functions.
//!
//! Formula sources are cited per function.

// ── Shooting efficiency ───────────────────────────────────────────────────────

/// True Shooting Percentage (TS%).
///
/// Measures shooting efficiency accounting for field goals, three-pointers, and
/// free throws on a single scale.
///
/// Formula: `PTS / (2 × (FGA + 0.44 × FTA))`
///
/// The 0.44 factor approximates the fraction of free-throw trips that result from
/// two-shot fouls (the conventional Basketball-Reference value).
///
/// Source: <https://www.basketball-reference.com/about/glossary.html#ts>
///
/// Returns `None` when `FGA = 0` and `FTA = 0` (no shot attempts of any kind).
///
/// # Examples
///
/// ```
/// use metis_compute::formulas::true_shooting_pct;
///
/// // Hand-computed: 800 pts, 600 FGA, 200 FTA
/// // Denominator = 2 × (600 + 0.44 × 200) = 2 × 688 = 1376
/// // TS% = 800 / 1376 ≈ 0.5814
/// let ts = true_shooting_pct(800.0, 600.0, 200.0).unwrap();
/// assert!((ts - 0.5814).abs() < 0.0001);
/// ```
#[must_use]
pub fn true_shooting_pct(pts: f64, fga: f64, fta: f64) -> Option<f64> {
    let denom = 2.0 * (fga + 0.44 * fta);
    if denom == 0.0 {
        return None;
    }
    Some(pts / denom)
}

/// Effective Field Goal Percentage (eFG%).
///
/// Adjusts field goal percentage to account for the extra value of three-point
/// field goals.
///
/// Formula: `(FGM + 0.5 × FG3M) / FGA`
///
/// Source: <https://www.basketball-reference.com/about/glossary.html#efg>
///
/// Returns `None` when `FGA = 0`.
///
/// # Examples
///
/// ```
/// use metis_compute::formulas::effective_fg_pct;
///
/// // 10 FGM (including 4 three-pointers), 20 FGA
/// // eFG% = (10 + 0.5 × 4) / 20 = 12 / 20 = 0.60
/// let efg = effective_fg_pct(10.0, 4.0, 20.0).unwrap();
/// assert!((efg - 0.60).abs() < 1e-10);
/// ```
#[must_use]
pub fn effective_fg_pct(fgm: f64, threes_made: f64, fga: f64) -> Option<f64> {
    if fga == 0.0 {
        return None;
    }
    Some((fgm + 0.5 * threes_made) / fga)
}

/// Team stats bundle used as input to [`usage_rate`].
///
/// Groups the five team-season columns needed for the USG% formula to avoid
/// exceeding the clippy `too_many_arguments` limit.
pub struct TeamStats {
    /// Total team field goal attempts for the season.
    pub fga: f64,
    /// Total team free throw attempts for the season.
    pub fta: f64,
    /// Total team turnovers for the season.
    pub tov: f64,
    /// Total team minutes played for the season (all players combined).
    /// For NBA games: `games_played × 240` (5 players × 48 min).
    pub mp: f64,
}

/// Usage Rate (USG%).
///
/// Estimates the percentage of team plays used by a player while on the floor.
///
/// Formula:
/// ```text
/// USG% = 100 × (FGA + 0.44 × FTA + TOV) × (TmMP / 5)
///            / (MP × (TmFGA + 0.44 × TmFTA + TmTOV))
/// ```
///
/// `team.mp` is the team's total minutes (all players combined). For NBA games
/// this is `games_played × 240` (5 players × 48 minutes).
///
/// Source: <https://www.basketball-reference.com/about/glossary.html#usg>
///
/// Returns `None` when player minutes (`mp`) are zero or the team denominator
/// is zero (which would indicate no team possessions were recorded).
///
/// # Examples
///
/// ```
/// use metis_compute::formulas::{usage_rate, TeamStats};
///
/// // Player: 400 FGA, 200 FTA, 100 TOV, 1000 MP
/// // Team:   1600 FGA, 600 FTA, 400 TOV, team_mp = 82*240 = 19680
/// let team = TeamStats { fga: 1600.0, fta: 600.0, tov: 400.0, mp: 19680.0 };
/// let usg = usage_rate(400.0, 200.0, 100.0, 1000.0, &team).unwrap();
/// // player_poss = 588, team_denom = 2264, USG% ≈ 102.2
/// assert!(usg > 100.0 && usg < 105.0, "got {usg}");
/// ```
#[must_use]
pub fn usage_rate(fga: f64, fta: f64, tov: f64, mp: f64, team: &TeamStats) -> Option<f64> {
    let denom = mp * (team.fga + 0.44 * team.fta + team.tov);
    if denom == 0.0 {
        return None;
    }
    let player_poss = fga + 0.44 * fta + tov;
    let result = 100.0 * player_poss * (team.mp / 5.0) / denom;
    Some(result)
}

// ── Rate stats ────────────────────────────────────────────────────────────────

/// Per-36-minutes rate for a counting statistic.
///
/// Formula: `stat × 36 / minutes_played`
///
/// Used to compare players who play different amounts per game on a common scale.
///
/// Returns `None` when `minutes_played = 0`.
///
/// # Examples
///
/// ```
/// use metis_compute::formulas::per_36;
///
/// // 500 points over 1000 minutes → 500 × 36 / 1000 = 18.0 pts/36
/// let p36 = per_36(500.0, 1000.0).unwrap();
/// assert!((p36 - 18.0).abs() < 1e-10);
/// ```
#[must_use]
pub fn per_36(stat: f64, minutes_played: f64) -> Option<f64> {
    if minutes_played == 0.0 {
        return None;
    }
    Some(stat * 36.0 / minutes_played)
}

/// Estimated individual possessions used.
///
/// Formula: `FGA + 0.44 × FTA + TOV − ORB`
///
/// Offensive rebounds extend the same possession rather than beginning a new one,
/// so they are subtracted.
///
/// This is the denominator for [`per_100`].
///
/// Source: adapted from Basketball-Reference possession estimates.
///
/// # Examples
///
/// ```
/// use metis_compute::formulas::est_possessions;
///
/// // 500 FGA, 200 FTA, 100 TOV, 50 ORB
/// // 500 + 0.44*200 + 100 - 50 = 638
/// let poss = est_possessions(500.0, 200.0, 100.0, 50.0);
/// assert!((poss - 638.0).abs() < 1e-10);
/// ```
#[must_use]
pub fn est_possessions(fga: f64, fta: f64, tov: f64, orb: f64) -> f64 {
    fga + 0.44 * fta + tov - orb
}

/// Per-100-possessions rate for a counting statistic.
///
/// Formula: `stat × 100 / est_poss`
///
/// Normalises volume stats to a common possession count, useful for comparing
/// players at different usage levels.
///
/// Returns `None` when `est_poss ≤ 0` (guards against zero or negative estimated
/// possessions, both of which would produce undefined or misleading results).
///
/// # Examples
///
/// ```
/// use metis_compute::formulas::per_100;
///
/// // 500 points over 625 estimated possessions → 500 × 100 / 625 = 80.0
/// let p100 = per_100(500.0, 625.0).unwrap();
/// assert!((p100 - 80.0).abs() < 1e-10);
/// ```
#[must_use]
pub fn per_100(stat: f64, est_poss: f64) -> Option<f64> {
    if est_poss <= 0.0 {
        return None;
    }
    Some(stat * 100.0 / est_poss)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── true_shooting_pct ────────────────────────────────────────────────────

    #[test]
    fn ts_pct_hand_computed() {
        // 800 pts, 600 FGA, 200 FTA
        // denom = 2 × (600 + 0.44 × 200) = 2 × 688 = 1376
        // TS% = 800 / 1376 ≈ 0.58140
        let ts = true_shooting_pct(800.0, 600.0, 200.0).unwrap();
        assert!((ts - 0.581_395_349_f64).abs() < 1e-6, "got {ts}");
    }

    #[test]
    fn ts_pct_zero_fga_nonzero_fta() {
        // Player who only got fouled (0 FGA, 100 FTA, 80 pts)
        // denom = 2 × (0 + 0.44 × 100) = 88
        // TS% = 80 / 88 ≈ 0.9091
        let ts = true_shooting_pct(80.0, 0.0, 100.0).unwrap();
        assert!((ts - 0.909_090_909_f64).abs() < 1e-6, "got {ts}");
    }

    #[test]
    fn ts_pct_zero_denominator_returns_none() {
        assert_eq!(true_shooting_pct(0.0, 0.0, 0.0), None);
    }

    #[test]
    fn ts_pct_result_is_positive_ratio() {
        // Sane ratio sanity check with round numbers
        let ts = true_shooting_pct(2460.0, 1200.0, 600.0).unwrap();
        assert!(ts > 0.0 && ts < 2.0, "TS% should be a sane ratio, got {ts}");
    }

    // ── effective_fg_pct ─────────────────────────────────────────────────────

    #[test]
    fn efg_pct_hand_computed() {
        // 10 FGM, 4 three-pointers, 20 FGA
        // eFG% = (10 + 0.5 × 4) / 20 = 12 / 20 = 0.600
        let efg = effective_fg_pct(10.0, 4.0, 20.0).unwrap();
        assert!((efg - 0.60).abs() < 1e-10, "got {efg}");
    }

    #[test]
    fn efg_pct_no_threes() {
        // Same as plain FG% when no three-pointers
        let efg = effective_fg_pct(45.0, 0.0, 90.0).unwrap();
        assert!((efg - 0.50).abs() < 1e-10, "got {efg}");
    }

    #[test]
    fn efg_pct_zero_fga_returns_none() {
        assert_eq!(effective_fg_pct(0.0, 0.0, 0.0), None);
    }

    #[test]
    fn efg_pct_all_threes() {
        // 10 FGM all three-pointers, 10 FGA → eFG% = (10 + 5) / 10 = 1.5
        let efg = effective_fg_pct(10.0, 10.0, 10.0).unwrap();
        assert!((efg - 1.5).abs() < 1e-10, "got {efg}");
    }

    // ── usage_rate ────────────────────────────────────────────────────────────

    #[test]
    fn usage_rate_hand_computed() {
        // Player: 400 FGA, 200 FTA, 100 TOV, 1000 MP
        // Team:   1600 FGA, 600 FTA, 400 TOV, team_mp = 19680 (82*240)
        // player_poss = 400 + 88 + 100 = 588
        // team_poss_denom = 1600 + 264 + 400 = 2264
        // USG% = 100 × 588 × (19680/5) / (1000 × 2264)
        let team = TeamStats {
            fga: 1600.0,
            fta: 600.0,
            tov: 400.0,
            mp: 19680.0,
        };
        let usg = usage_rate(400.0, 200.0, 100.0, 1000.0, &team).unwrap();
        let expected = 100.0 * 588.0 * (19680.0 / 5.0) / (1000.0 * 2264.0);
        assert!(
            (usg - expected).abs() < 1e-6,
            "got {usg}, expected {expected}"
        );
    }

    #[test]
    fn usage_rate_realistic_range() {
        // Verify realistic result is in the 15–50% range
        let team = TeamStats {
            fga: 1600.0,
            fta: 600.0,
            tov: 320.0,
            mp: 4800.0,
        };
        let usg = usage_rate(400.0, 200.0, 80.0, 700.0, &team).unwrap();
        assert!(
            usg > 15.0 && usg < 55.0,
            "expected realistic USG%, got {usg}"
        );
    }

    #[test]
    fn usage_rate_zero_player_minutes_returns_none() {
        let team = TeamStats {
            fga: 100.0,
            fta: 50.0,
            tov: 20.0,
            mp: 240.0,
        };
        assert_eq!(usage_rate(10.0, 5.0, 2.0, 0.0, &team), None);
    }

    #[test]
    fn usage_rate_zero_team_denominator_returns_none() {
        let team = TeamStats {
            fga: 0.0,
            fta: 0.0,
            tov: 0.0,
            mp: 240.0,
        };
        assert_eq!(usage_rate(10.0, 5.0, 2.0, 36.0, &team), None);
    }

    // ── per_36 ───────────────────────────────────────────────────────────────

    #[test]
    fn per_36_hand_computed() {
        // 500 pts over 1000 minutes → 500 × 36 / 1000 = 18.0
        let p36 = per_36(500.0, 1000.0).unwrap();
        assert!((p36 - 18.0).abs() < 1e-10, "got {p36}");
    }

    #[test]
    fn per_36_zero_minutes_returns_none() {
        assert_eq!(per_36(100.0, 0.0), None);
    }

    #[test]
    fn per_36_exact_36_minutes() {
        // Exactly 36 minutes played: rate = stat itself
        let p36 = per_36(25.0, 36.0).unwrap();
        assert!((p36 - 25.0).abs() < 1e-10, "got {p36}");
    }

    // ── est_possessions ───────────────────────────────────────────────────────

    #[test]
    fn est_possessions_hand_computed() {
        // 500 FGA, 200 FTA, 100 TOV, 50 ORB
        // 500 + 0.44*200 + 100 - 50 = 500 + 88 + 100 - 50 = 638
        let poss = est_possessions(500.0, 200.0, 100.0, 50.0);
        assert!((poss - 638.0).abs() < 1e-10, "got {poss}");
    }

    #[test]
    fn est_possessions_no_orb() {
        // Without ORB, same as FGA + 0.44*FTA + TOV
        let poss = est_possessions(400.0, 100.0, 80.0, 0.0);
        assert!((poss - 524.0).abs() < 1e-10, "got {poss}");
    }

    // ── per_100 ───────────────────────────────────────────────────────────────

    #[test]
    fn per_100_hand_computed() {
        // 500 pts over 625 estimated possessions → 80.0
        let p100 = per_100(500.0, 625.0).unwrap();
        assert!((p100 - 80.0).abs() < 1e-10, "got {p100}");
    }

    #[test]
    fn per_100_zero_possessions_returns_none() {
        assert_eq!(per_100(100.0, 0.0), None);
    }

    #[test]
    fn per_100_negative_possessions_returns_none() {
        // Negative est_poss (e.g. huge ORB) should guard safely
        assert_eq!(per_100(100.0, -5.0), None);
    }

    #[test]
    fn per_100_exact_100_possessions() {
        // 100 possessions: rate = stat itself scaled by 1
        let p100 = per_100(30.0, 100.0).unwrap();
        assert!((p100 - 30.0).abs() < 1e-10, "got {p100}");
    }
}
