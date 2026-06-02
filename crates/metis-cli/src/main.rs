use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use metis_compute::compute_season_rollups;
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
    /// Compute materialized rollup tables.
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
        season: u32,

        /// Ingest source name (must match the source used when loading box scores).
        #[arg(long)]
        source: String,
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
        Commands::Compute(ComputeArgs {
            entity: ComputeEntity::SeasonRollups { season, source },
        }) => {
            cmd_compute_season_rollups(&db, season, &source)?;
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

fn cmd_compute_season_rollups(db: &Db, season: u32, source: &str) -> Result<()> {
    let season_typed = Season(season as u16);
    let summary =
        compute_season_rollups(db, season_typed, source).map_err(|e| anyhow::anyhow!("{e}"))?;
    println!(
        "Computed rollups for {} players, {} teams (season={}, source={}).",
        summary.player_rows, summary.team_rows, season_typed, source
    );
    Ok(())
}
