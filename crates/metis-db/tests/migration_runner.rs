use metis_db::Db;

/// Smoke test: apply the real sql/migrations files against an in-memory DuckDB.
/// This catches SQL syntax errors and ordering problems in the actual migration files.
#[test]
fn real_migrations_apply_cleanly() {
    let migrations_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("sql/migrations");

    let db = Db::open_with_migrations(":memory:", &migrations_dir).expect("open in-memory db");
    db.migrate()
        .expect("real migrations must apply without error");

    let applied = db.applied_migrations().expect("applied_migrations");
    assert_eq!(
        applied,
        vec![
            "0001_core_entities.sql",
            "0002_box_score.sql",
            "0003_provenance.sql",
            "0004_user_views.sql",
            "0005_player_season_rollups.sql",
            "0006_team_season_rollups.sql",
            "0007_possession_lineup.sql",
            "0008_possession_lineup_indexes.sql",
        ],
        "all eight schema migrations must be applied in order"
    );

    // Second run must be a no-op.
    db.migrate().expect("second migrate must be a no-op");
    let applied_again = db.applied_migrations().expect("applied_migrations again");
    assert_eq!(applied, applied_again);
}

/// Integration test: open a real on-disk DuckDB, apply one dummy migration,
/// verify it was recorded, re-run migrate, verify it remains a no-op.
#[test]
fn apply_dummy_migration_and_noop_on_rerun() {
    let tmp = tempfile::tempdir().expect("tempdir");

    let migration_sql = "CREATE TABLE dummy_entity (id INTEGER PRIMARY KEY, name TEXT NOT NULL);";
    std::fs::write(tmp.path().join("0001_dummy.sql"), migration_sql)
        .expect("write dummy migration");

    let db_path = tmp.path().join("test.duckdb");
    let db = Db::open_with_migrations(&db_path, tmp.path()).expect("open db");

    // First run: migration applied.
    db.migrate().expect("first migrate");
    let applied = db.applied_migrations().expect("applied_migrations");
    assert_eq!(applied, vec!["0001_dummy.sql"]);

    // Second run: no-op.
    db.migrate().expect("second migrate");
    let applied = db.applied_migrations().expect("applied_migrations");
    assert_eq!(applied, vec!["0001_dummy.sql"]);
}

/// Integration test: multiple migrations in a fresh DB are applied in filename order.
#[test]
fn multiple_migrations_applied_in_order() {
    let tmp = tempfile::tempdir().expect("tempdir");

    std::fs::write(
        tmp.path().join("0002_second.sql"),
        "CREATE TABLE second (id INTEGER);",
    )
    .expect("write second");
    std::fs::write(
        tmp.path().join("0001_first.sql"),
        "CREATE TABLE first (id INTEGER);",
    )
    .expect("write first");

    let db_path = tmp.path().join("ordered.duckdb");
    let db = Db::open_with_migrations(&db_path, tmp.path()).expect("open db");
    db.migrate().expect("migrate");

    let applied = db.applied_migrations().expect("applied_migrations");
    assert_eq!(applied, vec!["0001_first.sql", "0002_second.sql"]);
}
