use std::path::{Path, PathBuf};

use duckdb::{params, Connection};

use crate::error::{DbError, Result};
use crate::repos::{
    game::GameRepo,
    lineup_stint::LineupStintRepo,
    player::PlayerRepo,
    player_game_box::PlayerGameBoxRepo,
    player_lineup_stats::PlayerLineupStatsRepo,
    possession::PossessionRepo,
    season::SeasonRepo,
    season_rollup::SeasonRollupRepo,
    team::TeamRepo,
    team_game_box::TeamGameBoxRepo,
};

/// Handle to an open Metis DuckDB database.
pub struct Db {
    conn: Connection,
    migrations_dir: PathBuf,
}

impl Db {
    /// Opens or creates the DuckDB at `db_path`.
    ///
    /// Migrations are read from `sql/migrations/` relative to the current working
    /// directory — correct when running via `cargo run` or `metis-cli` from the
    /// project root. Use [`Db::open_with_migrations`] for an explicit path.
    pub fn open(db_path: impl AsRef<Path>) -> Result<Self> {
        Self::open_with_migrations(db_path, "sql/migrations")
    }

    /// Opens or creates the DuckDB at `db_path` with an explicit migrations directory.
    pub fn open_with_migrations(
        db_path: impl AsRef<Path>,
        migrations_dir: impl AsRef<Path>,
    ) -> Result<Self> {
        let path = db_path.as_ref();
        let conn = if path.to_str() == Some(":memory:") {
            Connection::open_in_memory()?
        } else {
            if let Some(parent) = path.parent() {
                if !parent.as_os_str().is_empty() {
                    std::fs::create_dir_all(parent)?;
                }
            }
            Connection::open(path)?
        };
        Ok(Self {
            conn,
            migrations_dir: migrations_dir.as_ref().to_owned(),
        })
    }

    /// Applies all pending migrations from the migrations directory in lexicographic order.
    ///
    /// Already-applied migrations are skipped. Calling `migrate` more than once is safe.
    pub fn migrate(&self) -> Result<()> {
        self.ensure_migrations_table()?;

        let mut files = self.collect_migration_files()?;
        files.sort_unstable_by(|(a, _), (b, _)| a.cmp(b));

        for (name, sql) in files {
            if !self.is_applied(&name)? {
                self.conn.execute_batch(&sql)?;
                self.mark_applied(&name)?;
            }
        }
        Ok(())
    }

    /// Returns the names of all applied migrations in application order.
    pub fn applied_migrations(&self) -> Result<Vec<String>> {
        self.ensure_migrations_table()?;
        let mut stmt = self
            .conn
            .prepare("SELECT name FROM _migrations ORDER BY applied_at, name")?;
        let names = stmt
            .query_map([], |row| row.get(0))?
            .collect::<duckdb::Result<Vec<String>>>()?;
        Ok(names)
    }

    /// Returns a handle to the player dimension repository.
    pub fn players(&self) -> PlayerRepo<'_> {
        PlayerRepo::new(&self.conn)
    }

    /// Returns a handle to the team dimension repository.
    pub fn teams(&self) -> TeamRepo<'_> {
        TeamRepo::new(&self.conn)
    }

    /// Returns a handle to the game dimension repository.
    pub fn games(&self) -> GameRepo<'_> {
        GameRepo::new(&self.conn)
    }

    /// Returns a handle to the player box score fact repository.
    pub fn player_game_boxes(&self) -> PlayerGameBoxRepo<'_> {
        PlayerGameBoxRepo::new(&self.conn)
    }

    /// Returns a handle to the team box score fact repository.
    pub fn team_game_boxes(&self) -> TeamGameBoxRepo<'_> {
        TeamGameBoxRepo::new(&self.conn)
    }

    /// Returns a handle to the season dimension repository.
    pub fn seasons(&self) -> SeasonRepo<'_> {
        SeasonRepo::new(&self.conn)
    }

    /// Returns a handle to the season rollup compute repository.
    pub fn season_rollups(&self) -> SeasonRollupRepo<'_> {
        SeasonRollupRepo::new(&self.conn)
    }

    /// Returns a handle to the possession fact repository.
    pub fn possessions(&self) -> PossessionRepo<'_> {
        PossessionRepo::new(&self.conn)
    }

    /// Returns a handle to the lineup stint fact repository.
    pub fn lineup_stints(&self) -> LineupStintRepo<'_> {
        LineupStintRepo::new(&self.conn)
    }

    /// Returns a handle to the player lineup stats compute-output repository.
    pub fn player_lineup_stats(&self) -> PlayerLineupStatsRepo<'_> {
        PlayerLineupStatsRepo::new(&self.conn)
    }

    #[cfg(test)]
    pub(crate) fn raw_conn(&self) -> &Connection {
        &self.conn
    }

    fn ensure_migrations_table(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (
                name       TEXT      NOT NULL PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL DEFAULT current_timestamp
            );",
        )?;
        Ok(())
    }

    fn collect_migration_files(&self) -> Result<Vec<(String, String)>> {
        let mut out = Vec::new();
        for entry in std::fs::read_dir(&self.migrations_dir).map_err(DbError::Io)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("sql") {
                let name = path
                    .file_name()
                    .expect("entry with .sql extension always has a file name")
                    .to_string_lossy()
                    .into_owned();
                let sql = std::fs::read_to_string(&path)?;
                out.push((name, sql));
            }
        }
        Ok(out)
    }

    fn is_applied(&self, name: &str) -> Result<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM _migrations WHERE name = ?",
            params![name],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    fn mark_applied(&self, name: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO _migrations (name, applied_at) VALUES (?, current_timestamp)",
            params![name],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_migration(dir: &Path, filename: &str, sql: &str) {
        std::fs::write(dir.join(filename), sql).expect("write migration fixture");
    }

    #[test]
    fn migrate_twice_is_noop() {
        let tmp = tempfile::tempdir().expect("tempdir");
        write_migration(
            tmp.path(),
            "0001_init.sql",
            "CREATE TABLE noop_test (id INTEGER);",
        );

        let db = Db::open_with_migrations(":memory:", tmp.path()).expect("open");
        db.migrate().expect("first migrate");
        db.migrate().expect("second migrate — must not error");

        let applied = db.applied_migrations().expect("applied_migrations");
        assert_eq!(applied, vec!["0001_init.sql"]);
    }

    #[test]
    fn migrations_applied_in_order() {
        let tmp = tempfile::tempdir().expect("tempdir");
        write_migration(tmp.path(), "0002_b.sql", "CREATE TABLE b (id INTEGER);");
        write_migration(tmp.path(), "0001_a.sql", "CREATE TABLE a (id INTEGER);");

        let db = Db::open_with_migrations(":memory:", tmp.path()).expect("open");
        db.migrate().expect("migrate");

        let applied = db.applied_migrations().expect("applied_migrations");
        assert_eq!(applied, vec!["0001_a.sql", "0002_b.sql"]);
    }

    #[test]
    fn non_sql_files_are_ignored() {
        let tmp = tempfile::tempdir().expect("tempdir");
        write_migration(tmp.path(), "0001_init.sql", "CREATE TABLE t (id INTEGER);");
        std::fs::write(tmp.path().join(".gitkeep"), "").expect("write .gitkeep");

        let db = Db::open_with_migrations(":memory:", tmp.path()).expect("open");
        db.migrate().expect("migrate");

        let applied = db.applied_migrations().expect("applied_migrations");
        assert_eq!(applied.len(), 1);
    }
}
