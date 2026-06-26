use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use metis_compute::{
    compute_advanced_stats, compute_game_splits, compute_player_team_season_totals,
    compute_player_team_season_totals_all, compute_season_rollups, reconcile_season, ReconcileConfig,
};
use metis_core::Season;
use metis_db::Db;

#[derive(Parser)]
#[command(name = "metis-cli", about = "Metis admin CLI")]
struct Cli {
    /// Path to the DuckDB database file.
    #[arg(long, global = true, default_value = "data/duckdb/metis.duckdb")]
    db: PathBuf,

    /// Path to the SQL migrations directory.
    #[arg(long, global = true, default_value = "sql/migrations")]
    migrations: PathBuf,

    /// Root of the local data directory (contains `parquet/` subdirectory).
    #[arg(long, global = true, default_value = "data")]
    data_root: PathBuf,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Load data from Parquet files into the DuckDB database.
    Load(LoadArgs),
    /// Run compute passes to derive stats from ingested data.
    Compute(ComputeArgs),
}

#[derive(clap::Args)]
struct LoadArgs {
    #[command(subcommand)]
    entity: LoadEntity,
}

#[derive(Subcommand)]
enum LoadEntity {
    /// Load player and team box scores for a season.
    ///
    /// Reads Parquet files from:
    ///   <data-root>/parquet/<source>/player_game_box/season=<SEASON>/
    ///   <data-root>/parquet/<source>/team_game_box/season=<SEASON>/
    ///
    /// Dimension rows (game, player, team) must already exist in the database.
    BoxScores {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u32,

        /// Ingest source name (must match the source written by the Python adapter).
        #[arg(long, default_value = "nba_stats")]
        source: String,
    },

    /// Load possession and lineup stint data for a season.
    ///
    /// Reads Parquet files from:
    ///   <data-root>/parquet/<source>/possession/season=<SEASON>/
    ///   <data-root>/parquet/<source>/lineup_stint/season=<SEASON>/
    ///
    /// Dimension rows (game, player, team) must already exist in the database.
    PossessionLineup {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u32,

        /// Ingest source name (must match the source written by the Python adapter).
        #[arg(long, default_value = "pbpstats")]
        source: String,
    },
}

#[derive(clap::Args)]
struct ComputeArgs {
    #[command(subcommand)]
    entity: ComputeEntity,
}

#[derive(Subcommand)]
enum ComputeEntity {
    /// Compute player and team season rollups from box score data.
    ///
    /// Reads from player_game_box and team_game_box and writes:
    ///   player_season_totals, player_season_per_game,
    ///   team_season_totals,   team_season_per_game
    ///
    /// Both --season and --source are required. Provenance must be explicit.
    SeasonRollups {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u16,

        /// Ingest source name (must match the source used when loading box scores).
        #[arg(long)]
        source: String,
    },

    /// Compute per-player on-off and lineup net ratings for a season.
    ///
    /// Reads from `lineup_stint` (all sources) and writes to `player_lineup_stats`.
    /// All season types present in the data for the given season are computed together.
    /// Safe to run multiple times — subsequent runs overwrite the previous output.
    LineupStats {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u32,
    },

    /// Compute advanced stats (TS%, eFG%, USG%, per-36, per-100) for a season.
    ///
    /// Reads from `player_season_totals` and `team_season_totals` (populated by
    /// `compute season-rollups`) and writes:
    ///   player_season_advanced, player_season_per_36, player_season_per_100
    ///
    /// Run `compute season-rollups` first for the same --season and --source.
    AdvancedStats {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u16,

        /// Ingest source name (must match the source used when loading box scores).
        #[arg(long, default_value = "nba_stats")]
        source: String,
    },

    /// Compute clutch, by-quarter, and garbage-time splits for each player-game.
    ///
    /// Reads from `possession` and `lineup_stint` and writes to `player_game_splits`.
    /// Run `load possession-lineup` first for the same --season.
    GameSplits {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u32,
    },

    /// Compute per-player team-season rollups from box score data.
    ///
    /// Reads from `player_game_box` and writes to `player_team_season_totals`,
    /// one row per (player, team, season, season_type, source). Enables the
    /// fast query path for team-filtered player stats.
    ///
    /// --season is optional. If omitted, all seasons are (re)computed.
    /// Run `load box-scores` for the relevant season(s) first.
    TeamRollups {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        /// Omit to compute all seasons at once.
        #[arg(long)]
        season: Option<u16>,

        /// Ingest source name.
        #[arg(long, default_value = "nba_stats")]
        source: String,
    },

    /// Reconcile player season stats from multiple sources into canonical rows.
    ///
    /// Reads from `player_season_totals` (all sources) and writes:
    ///   player_season_canonical — one row per (player, season, season_type)
    ///   stat_disagreement       — one row per stat that exceeds the threshold
    ///
    /// Run `compute season-rollups` for each source before reconciling.
    Reconcile {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u16,

        /// Most-preferred source. Rows from this source win ties.
        #[arg(long, default_value = "nba_stats")]
        primary_source: String,

        /// Percentage difference threshold above which disagreements are logged.
        #[arg(long, default_value = "5.0")]
        threshold: f64,
    },

    /// Run the full compute pipeline for a season.
    ///
    /// Equivalent to running, in order:
    ///   compute season-rollups  --season S --source SOURCE
    ///   compute advanced-stats  --season S --source SOURCE
    ///   compute team-rollups    --season S --source SOURCE
    ///   compute reconcile       --season S --primary-source SOURCE
    ///
    /// All steps are required to produce a complete `player_season_canonical`
    /// output.  Run `load box-scores --season S` first.
    Pipeline {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u16,

        /// Source to compute rollups from.
        #[arg(long, default_value = "nba_stats")]
        source: String,

        /// Percentage difference threshold for reconciliation disagreements.
        #[arg(long, default_value = "5.0")]
        threshold: f64,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    let db = Db::open_with_migrations(&cli.db, &cli.migrations)
        .with_context(|| format!("failed to open database at {}", cli.db.display()))?;
    db.migrate().context("failed to apply migrations")?;

    match cli.command {
        Commands::Load(LoadArgs {
            entity: LoadEntity::BoxScores { season, source },
        }) => {
            cmd_load_box_scores(&db, &cli.data_root, season, &source)?;
        }
        Commands::Load(LoadArgs {
            entity: LoadEntity::PossessionLineup { season, source },
        }) => {
            cmd_load_possession_lineup(&db, &cli.data_root, season, &source)?;
        }
        Commands::Compute(ComputeArgs {
            entity: ComputeEntity::SeasonRollups { season, source },
        }) => {
            cmd_compute_season_rollups(&db, season, &source)?;
        }
        Commands::Compute(ComputeArgs {
            entity: ComputeEntity::LineupStats { season },
        }) => {
            cmd_compute_lineup_stats(&db, season)?;
        }
        Commands::Compute(ComputeArgs {
            entity: ComputeEntity::GameSplits { season },
        }) => {
            cmd_compute_game_splits(&db, season)?;
        }
        Commands::Compute(ComputeArgs {
            entity: ComputeEntity::AdvancedStats { season, source },
        }) => {
            cmd_compute_advanced_stats(&db, season, &source)?;
        }
        Commands::Compute(ComputeArgs {
            entity: ComputeEntity::TeamRollups { season, source },
        }) => {
            cmd_compute_team_rollups(&db, season, &source)?;
        }
        Commands::Compute(ComputeArgs {
            entity:
                ComputeEntity::Reconcile {
                    season,
                    primary_source,
                    threshold,
                },
        }) => {
            cmd_reconcile(&db, season, &primary_source, threshold)?;
        }
        Commands::Compute(ComputeArgs {
            entity: ComputeEntity::Pipeline { season, source, threshold },
        }) => {
            cmd_pipeline(&db, season, &source, threshold)?;
        }
    }

    Ok(())
}

fn cmd_load_box_scores(db: &Db, data_root: &Path, season: u32, source: &str) -> Result<()> {
    let parquet_root = data_root.join("parquet");

    let player_glob = parquet_root
        .join(source)
        .join("player_game_box")
        .join(format!("season={season}"))
        .join("*.parquet");

    let team_glob = parquet_root
        .join(source)
        .join("team_game_box")
        .join(format!("season={season}"))
        .join("*.parquet");

    let player_glob_str = player_glob
        .to_str()
        .context("player glob path is not valid UTF-8")?;
    let team_glob_str = team_glob
        .to_str()
        .context("team glob path is not valid UTF-8")?;

    // Upsert dimension rows first so FK constraints are satisfied.
    db.upsert_box_score_dimensions(player_glob_str, team_glob_str)
        .context("failed to upsert dimension rows from box-score Parquet")?;
    println!("Upserted dimension rows (season, team, player, game) for {source} season={season}.");

    let player_count = db
        .player_game_boxes()
        .load_from_parquet(player_glob_str)
        .with_context(|| format!("failed to load player box scores from {player_glob_str}"))?;

    let team_count = db
        .team_game_boxes()
        .load_from_parquet(team_glob_str)
        .with_context(|| format!("failed to load team box scores from {team_glob_str}"))?;

    println!("Loaded {player_count} player box score row(s) for {source} season={season}.");
    println!("Loaded {team_count} team box score row(s) for {source} season={season}.");

    Ok(())
}

fn cmd_load_possession_lineup(db: &Db, data_root: &Path, season: u32, source: &str) -> Result<()> {
    let parquet_root = data_root.join("parquet");

    let possession_glob = parquet_root
        .join(source)
        .join("possession")
        .join(format!("season={season}"))
        .join("*.parquet");

    let lineup_glob = parquet_root
        .join(source)
        .join("lineup_stint")
        .join(format!("season={season}"))
        .join("*.parquet");

    let possession_glob_str = possession_glob
        .to_str()
        .context("possession glob path is not valid UTF-8")?;
    let lineup_glob_str = lineup_glob
        .to_str()
        .context("lineup glob path is not valid UTF-8")?;

    let possession_count = db
        .possessions()
        .load_from_parquet(possession_glob_str)
        .with_context(|| format!("failed to load possessions from {possession_glob_str}"))?;

    let lineup_count = db
        .lineup_stints()
        .load_from_parquet(lineup_glob_str)
        .with_context(|| format!("failed to load lineup stints from {lineup_glob_str}"))?;

    println!("Loaded {possession_count} possession row(s) for {source} season={season}.");
    println!("Loaded {lineup_count} lineup stint row(s) for {source} season={season}.");

    Ok(())
}

fn cmd_compute_season_rollups(db: &Db, season: u16, source: &str) -> Result<()> {
    let season_typed = Season(season);
    let summary = compute_season_rollups(db, season_typed, source)?;
    println!(
        "Computed rollups for {} players, {} teams (season={}, source={}).",
        summary.player_rows, summary.team_rows, season_typed, source
    );
    Ok(())
}

fn cmd_compute_advanced_stats(db: &Db, season: u16, source: &str) -> Result<()> {
    let season_typed = Season(season);
    let summary = compute_advanced_stats(db, season_typed, source)?;
    println!(
        "Computed advanced stats for season={season_typed} source={source}: \
         {} advanced row(s), {} per-36 row(s), {} per-100 row(s).",
        summary.player_advanced_rows, summary.player_per_36_rows, summary.player_per_100_rows,
    );
    Ok(())
}

fn cmd_compute_lineup_stats(db: &Db, season: u32) -> Result<()> {
    let n = metis_compute::on_off::compute_lineup_stats(db, Season(season as u16))
        .with_context(|| format!("failed to compute lineup stats for season={season}"))?;
    println!("Computed {n} player lineup stat row(s) for season={season}.");
    Ok(())
}

fn cmd_compute_game_splits(db: &Db, season: u32) -> Result<()> {
    let n = compute_game_splits(db, Season(season as u16))
        .with_context(|| format!("failed to compute game splits for season={season}"))?;
    println!("Computed {n} player-game split row(s) for season={season}.");
    Ok(())
}

fn cmd_compute_team_rollups(db: &Db, season: Option<u16>, source: &str) -> Result<()> {
    if let Some(s) = season {
        let season_typed = Season(s);
        let n = compute_player_team_season_totals(db, season_typed, source).with_context(
            || format!("failed to compute team rollups for season={season_typed} source={source}"),
        )?;
        println!(
            "Computed team rollups for season={season_typed} source={source}: {n} row(s)."
        );
    } else {
        let n = compute_player_team_season_totals_all(db, source).with_context(|| {
            format!("failed to compute team rollups for all seasons source={source}")
        })?;
        println!("Computed team rollups for all seasons source={source}: {n} row(s).");
    }
    Ok(())
}

fn cmd_reconcile(db: &Db, season: u16, primary_source: &str, threshold: f64) -> Result<()> {
    let season_typed = Season(season);
    let config = ReconcileConfig {
        source_priority: vec![primary_source.to_owned(), "bref".to_owned()],
        disagreement_threshold_pct: threshold,
    };
    let summary = reconcile_season(db, season_typed, &config)
        .with_context(|| format!("failed to reconcile season={season_typed}"))?;
    println!(
        "Reconciled season={season_typed}: {} canonical row(s), {} disagreement(s) logged.",
        summary.canonical_rows, summary.disagreements_logged,
    );
    Ok(())
}

fn cmd_pipeline(db: &Db, season: u16, source: &str, threshold: f64) -> Result<()> {
    println!("=== pipeline: season={season} source={source} ===");

    print!("[1/4] season rollups … ");
    cmd_compute_season_rollups(db, season, source)?;

    print!("[2/4] advanced stats  … ");
    cmd_compute_advanced_stats(db, season, source)?;

    print!("[3/4] team rollups    … ");
    cmd_compute_team_rollups(db, Some(season), source)?;

    print!("[4/4] reconcile       … ");
    cmd_reconcile(db, season, source, threshold)?;

    println!("=== pipeline complete ===");
    Ok(())
}
